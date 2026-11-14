//! Host payouts in ETH on Base Sepolia, signed with NEAR Chain Signatures.
//!
//! Lifecycle of an `EvmPayout`: Booked (claim_epoch debited the NEAR pool into `evm_settled`)
//! -> Signing (one at a time, nonce safety) -> Signed (raw tx stored, relayable by anyone).
//! A failed or timed-out signature returns it to Booked (or Signed on a bump), nonce unspent.
//! `bump_evm_payout` re-signs at the SAME nonce, recipient and value with a higher fee, so
//! at most one transaction can ever land. There is no "Settled" state: the contract cannot
//! see Base, and will not take anyone's word for it.
//!
//! `evm_settled` is only ever increased, by claim_epoch's booking (`book_evm` callers).

use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, Promise, PromiseError};

use crate::events::{emit, log_activity};
use crate::evm_sig;
use crate::rlp::{Tx1559, EVM_CHAIN_ID};
use crate::util::jstr;
use crate::{store, EvmLock, EvmPayout, EvmPayoutView, EvmStatus, Flight, Licence, LicenceExt, FLIGHT_TIMEOUT_MS};

/// Storage reserved from the pool when a claim books an EVM payout.
pub const EVM_RECORD_RESERVE_BYTES: u64 = 512;
/// The MPC `sign` call needs 15 Tgas attached; its own yield callback is paid from that.
const SIGN_GAS: Gas = Gas::from_tgas(50);
const SIGN_CB_GAS: Gas = Gas::from_tgas(40);
const MPC_DEPOSIT: u128 = 1;
/// A signing needs this much ops budget for the signed record's storage.
const SIGN_MIN_BUDGET: u128 = 5_000_000_000_000_000_000_000;
pub const MAX_BUMPS: usize = 5;
/// MPC domain 0: the secp256k1 key `public_key` returns.
const DOMAIN_ID: u32 = 0;

#[near(serializers=[borsh])]
pub struct EvmCb {
    pub flight: u64,
    pub id: u64,
    pub nonce: u64,
    pub max_fee: u128,
    pub max_prio: u128,
    pub bump: bool,
}

/// Fee after a bump: at least x1.25 (EIP-1559 replacement needs +10%), rounded up.
pub fn bumped(v: u128) -> u128 {
    (v * 125).div_ceil(100).max(v + 1)
}

impl Licence {
    pub(crate) fn evm_cfg(&self) -> &crate::EvmCfg {
        self.cfg.evm_payout.as_ref().unwrap_or_else(|| env::panic_str("EVM payouts are not enabled"))
    }

    /// Books a payout for a finished claim. The caller moves the NEAR (pool -> evm_settled).
    pub(crate) fn book_evm(&mut self, host: &AccountId, epoch: u64, to: [u8; 20], verified: u64, value_wei: u128, near_debited: u128) -> u64 {
        let c = self.evm_cfg().clone();
        let id = self.evm_count;
        self.evm_count += 1;
        store::set_evm(&EvmPayout {
            id,
            host_id: host.clone(),
            epoch,
            to,
            verified,
            value_wei,
            near_debited,
            nonce: None,
            status: EvmStatus::Booked,
            max_fee: c.max_fee_per_gas.0,
            max_prio: c.max_priority_fee_per_gas.0,
            signed: vec![],
            hashes: vec![],
            booked_ms: Self::now(),
            last_error: None,
        });
        emit(
            "evm_booked",
            &format!("\"id\":{id},\"host_id\":\"{host}\",\"epoch\":{epoch},\"to\":\"0x{}\",\"value_wei\":\"{value_wei}\"", hex::encode(to)),
        );
        id
    }

    fn tx_for(&self, p: &EvmPayout, nonce: u64, max_fee: u128, max_prio: u128) -> Tx1559 {
        Tx1559 { nonce, max_priority_fee: max_prio, max_fee, gas_limit: self.evm_cfg().gas_limit, to: p.to, value: p.value_wei }
    }

    /// Back to the state before a signing started; the nonce is only kept once something was signed.
    fn evm_back(p: &mut EvmPayout, why: &str) {
        if p.signed.is_empty() {
            p.nonce = None;
            p.status = EvmStatus::Booked;
        } else {
            p.status = EvmStatus::Signed;
        }
        p.last_error = Some(why.to_string());
    }

    /// A signing that never called back for 10 minutes no longer blocks others.
    fn release_stale_lock(&mut self) {
        let stale = matches!(&self.evm_lock, Some(l) if Self::now().saturating_sub(l.flight.started_ms) >= FLIGHT_TIMEOUT_MS);
        if stale {
            if let Some(l) = self.evm_lock.take() {
                if let Some(mut p) = store::evm(l.payout) {
                    Self::evm_back(&mut p, "Signing timed out");
                    store::set_evm(&p);
                }
            }
        }
    }

    /// The MPC fee: 1 yocto from the caller's deposit, or from the ops budget when nothing is attached.
    fn pay_sign_fee(&mut self) {
        let dep = env::attached_deposit().as_yoctonear();
        if dep == 0 {
            require!(self.totals.ops_budget >= SIGN_MIN_BUDGET, "Ops budget is empty, fund it first");
            self.totals.ops_budget -= MPC_DEPOSIT;
        } else if dep > MPC_DEPOSIT {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(dep - MPC_DEPOSIT)).detach();
        }
    }

    fn start_sign(&mut self, id: u64, bump: bool) -> Promise {
        let cfg = self.evm_cfg().clone();
        self.release_stale_lock();
        require!(self.evm_lock.is_none(), "Another payout is being signed, try again shortly");
        let mut p = store::evm(id).unwrap_or_else(|| env::panic_str("No such payout"));
        let (nonce, fee, prio) = if bump {
            require!(p.status == EvmStatus::Signed, "Nothing signed to bump");
            require!(p.signed.len() <= MAX_BUMPS, "Too many bumps");
            let fee = bumped(p.max_fee);
            require!(fee <= cfg.max_fee_cap.0, "Fee cap reached");
            (p.nonce.unwrap_or_default(), fee, bumped(p.max_prio).min(fee))
        } else {
            require!(p.status == EvmStatus::Booked, "Already signed");
            (self.next_evm_nonce, p.max_fee, p.max_prio)
        };
        self.pay_sign_fee();
        p.status = EvmStatus::Signing;
        p.nonce = Some(nonce);
        store::set_evm(&p);
        self.next_flight += 1;
        let flight = self.next_flight;
        self.evm_lock = Some(EvmLock { flight: Flight { started_ms: Self::now(), id: flight }, payout: id });
        let payload = self.tx_for(&p, nonce, fee, prio).payload();
        let args = format!(
            "{{\"request\":{{\"path\":{},\"payload_v2\":{{\"Ecdsa\":\"{}\"}},\"domain_id\":{DOMAIN_ID}}}}}",
            jstr(&cfg.path),
            hex::encode(payload)
        );
        let cb = EvmCb { flight, id, nonce, max_fee: fee, max_prio: prio, bump };
        emit("evm_sign_requested", &format!("\"id\":{id},\"nonce\":{nonce},\"bump\":{bump}"));
        Promise::new(cfg.mpc.clone())
            .function_call("sign", args.into_bytes(), NearToken::from_yoctonear(MPC_DEPOSIT), SIGN_GAS)
            .then(Promise::new(env::current_account_id()).function_call(
                "on_evm_signed",
                near_sdk::borsh::to_vec(&cb).unwrap_or_default(),
                NearToken::from_yoctonear(0),
                SIGN_CB_GAS,
            ))
    }

    fn evm_sign_failed(&mut self, mut p: EvmPayout, why: &str) -> bool {
        Self::evm_back(&mut p, why);
        store::set_evm(&p);
        emit("evm_sign_failed", &format!("\"id\":{},\"reason\":{}", p.id, jstr(why)));
        log_activity("evm", "retry", &format!("payout {}: {why}", p.id));
        false
    }
}

#[near]
impl Licence {
    /// A registered host sets where its ETH payouts go (Base Sepolia). Only for the caller's own
    /// host record: there is no host argument.
    pub fn set_payout_evm(&mut self, address: String) {
        self.evm_cfg();
        let id = env::predecessor_account_id();
        let mut host = store::host(&id).unwrap_or_else(|| env::panic_str("Register as a host first"));
        require!(evm_sig::parse_address(&address).is_some(), "Address must be 0x plus 40 hex characters");
        let a = address.to_ascii_lowercase();
        emit("payout_evm_set", &format!("\"host_id\":\"{id}\",\"address\":\"{a}\""));
        host.evm_address = Some(a);
        store::set_host(&id, &host);
    }

    /// Anyone: asks the MPC signer to sign a booked payout. Zero deposit is fine (ops budget pays).
    #[payable]
    pub fn sign_evm_payout(&mut self, id: u64) -> Promise {
        self.start_sign(id, false)
    }

    /// Anyone: re-signs a Signed payout at the same nonce, recipient and value with a fee at
    /// least x1.25 higher, up to `max_fee_cap`. Earlier signed versions stay in the history.
    #[payable]
    pub fn bump_evm_payout(&mut self, id: u64) -> Promise {
        self.start_sign(id, true)
    }

    #[private]
    pub fn on_evm_signed(&mut self, #[serializer(borsh)] cb: EvmCb) -> bool {
        match &self.evm_lock {
            Some(l) if l.flight.id == cb.flight => {}
            _ => return false, // superseded by a timeout takeover
        }
        self.evm_lock = None;
        let mut p = match store::evm(cb.id) {
            Some(p) => p,
            None => return false,
        };
        let tx = self.tx_for(&p, cb.nonce, cb.max_fee, cb.max_prio);
        let sig = match env::promise_result_checked(0, 2048) {
            Ok(bytes) => match evm_sig::parse(&bytes) {
                Ok(s) => s,
                Err(why) => return self.evm_sign_failed(p, why),
            },
            Err(PromiseError::Failed) => return self.evm_sign_failed(p, "Signer failed or timed out"),
            Err(_) => return self.evm_sign_failed(p, "Signer reply was unusable"),
        };
        let payer = evm_sig::parse_address(&self.evm_cfg().address);
        if evm_sig::recover_address(&tx.payload(), &sig) != payer {
            return self.evm_sign_failed(p, "Signature does not match the payer address");
        }
        if !cb.bump && cb.nonce != self.next_evm_nonce {
            return self.evm_sign_failed(p, "Nonce moved, retry");
        }
        let raw = tx.signed(sig.y, &sig.r, &sig.s);
        let before = env::storage_usage();
        p.hashes.push(env::keccak256_array(&raw));
        p.signed.push(raw);
        p.max_fee = cb.max_fee;
        p.max_prio = cb.max_prio;
        p.nonce = Some(cb.nonce);
        p.status = EvmStatus::Signed;
        p.last_error = None;
        store::set_evm(&p);
        if !cb.bump {
            self.next_evm_nonce = cb.nonce + 1;
        }
        let cost = env::storage_usage().saturating_sub(before) as u128 * env::storage_byte_cost().as_yoctonear();
        self.totals.ops_budget = self.totals.ops_budget.saturating_sub(cost);
        emit(
            "evm_signed",
            &format!("\"id\":{},\"nonce\":{},\"tx_hash\":\"0x{}\",\"bump\":{}", p.id, cb.nonce, hex::encode(p.hashes[p.hashes.len() - 1]), cb.bump),
        );
        true
    }

    pub fn get_evm_payouts(&self, from_index: u64, limit: u64) -> Vec<EvmPayoutView> {
        let end = self.evm_count.min(from_index.saturating_add(limit.min(100)));
        (from_index..end).filter_map(store::evm).map(view).collect()
    }

    /// Where the payer address comes from, for anyone to re-derive and check.
    pub fn evm_payout_info(&self) -> Option<crate::EvmInfoView> {
        let c = self.cfg.evm_payout.as_ref()?;
        Some(crate::EvmInfoView {
            address: c.address.clone(),
            next_nonce: self.next_evm_nonce,
            mpc: c.mpc.clone(),
            path: c.path.clone(),
            chain_id: EVM_CHAIN_ID,
            derivation_account: env::current_account_id(),
            domain_id: DOMAIN_ID,
            demo_wei_per_session: c.demo_wei_per_session,
            max_fee_cap: c.max_fee_cap,
            evm_settled: U128(self.totals.evm_settled),
            signing_payout: self.evm_lock.as_ref().map(|l| l.payout),
            payouts: self.evm_count,
        })
    }
}

fn view(p: EvmPayout) -> EvmPayoutView {
    let h = |b: &[u8]| format!("0x{}", hex::encode(b));
    EvmPayoutView {
        id: p.id,
        host_id: p.host_id,
        epoch: p.epoch,
        to: h(&p.to),
        verified: p.verified,
        value_wei: U128(p.value_wei),
        near_debited: U128(p.near_debited),
        nonce: p.nonce,
        status: p.status.name().to_string(),
        signed_tx: p.signed.last().map(|b| h(b)),
        signed_txs: p.signed.iter().map(|b| h(b)).collect(),
        tx_hash: p.hashes.last().map(|b| h(b)),
        tx_hashes: p.hashes.iter().map(|b| h(b)).collect(),
        max_fee_per_gas: U128(p.max_fee),
        max_priority_fee_per_gas: U128(p.max_prio),
        booked_at_ms: p.booked_ms,
        last_error: p.last_error,
    }
}
