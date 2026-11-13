//! Fan hosts: registration and per-epoch pay from the pool, verified by OutLayer.

use near_sdk::{env, near, require, AccountId, NearToken, Promise};

use crate::events::{emit, log_activity};
use crate::outlayer::{nonce_hex, read_out, Out};
use crate::util::{is_https, Cb};
use crate::{store, Claim, Host, Licence, LicenceExt};

pub const HOST_DEPOSIT: NearToken = NearToken::from_millinear(10);

impl Licence {
    pub(crate) fn released_at(&self) -> u64 {
        self.release.released_at_ms.unwrap_or_else(|| env::panic_str("Key is not released yet"))
    }

    fn claim_skipped(host: &AccountId, epoch: u64, why: &str) {
        log_activity("claim", "none", &format!("{host} epoch {epoch}: {why}"));
    }

    /// Records the claim and pays min(verified * pay_per_session, epoch_cap, pool).
    /// The record's storage is taken from the pool so the contract never goes short.
    fn pay_claim(&mut self, host_id: &AccountId, epoch: u64, verified: u64) {
        let mut host = match store::host(host_id) {
            Some(h) => h,
            None => return,
        };
        if store::epoch_paid(host_id, epoch) {
            return Self::claim_skipped(host_id, epoch, "already paid");
        }
        let idx = self.claim_count;
        let before = env::storage_usage();
        let now = Self::now();
        store::set_claim(idx, &Claim { host_id: host_id.clone(), epoch, verified, paid: 0, at_ms: now });
        store::set_epoch_paid(host_id, epoch);
        let cost = env::storage_usage().saturating_sub(before) as u128 * env::storage_byte_cost().as_yoctonear();
        let avail = self.totals.pool.saturating_sub(cost);
        if avail == 0 {
            store::remove_claim(idx);
            store::unset_epoch_paid(host_id, epoch);
            return Self::claim_skipped(host_id, epoch, "pool is empty");
        }
        let owed = (verified as u128).saturating_mul(self.cfg.pool.pay_per_session.0);
        let pay = owed.min(self.cfg.pool.epoch_cap.0).min(avail);
        self.totals.pool -= cost + pay;
        self.totals.paid_out += pay;
        self.claim_count += 1;
        host.epochs_paid += 1;
        host.sessions_paid += verified;
        host.earned += pay;
        store::set_host(host_id, &host);
        store::set_claim(idx, &Claim { host_id: host_id.clone(), epoch, verified, paid: pay, at_ms: now });
        if pay > 0 {
            Promise::new(host_id.clone()).transfer(NearToken::from_yoctonear(pay)).detach();
        }
        emit(
            "epoch_claimed",
            &format!("\"host_id\":\"{host_id}\",\"epoch\":{epoch},\"verified\":{verified},\"paid\":\"{pay}\""),
        );
        log_activity("claim", "paid", &format!("{host_id} epoch {epoch}: {verified} verified, paid {pay}"));
    }
}

#[near]
impl Licence {
    /// Anyone, once released. The host id is the caller; the same caller may update it.
    #[payable]
    pub fn register_host(&mut self, endpoint: String, host_pubkey: String) {
        self.released_at();
        require!(is_https(&endpoint), "Endpoint must be https");
        require!(
            host_pubkey.starts_with("ed25519:") && host_pubkey.len() > 8 && host_pubkey.len() <= 100,
            "Host key must look like ed25519:<base58>"
        );
        let id = env::predecessor_account_id();
        let paid = env::attached_deposit();
        let refund = match store::host(&id) {
            Some(mut h) => {
                h.endpoint = endpoint.clone();
                h.host_pubkey = host_pubkey;
                store::set_host(&id, &h);
                paid
            }
            None => {
                require!(paid >= HOST_DEPOSIT, "Attach 0.01 NEAR to register");
                let host = Host {
                    endpoint: endpoint.clone(),
                    host_pubkey,
                    registered_at_ms: Self::now(),
                    epochs_paid: 0,
                    sessions_paid: 0,
                    earned: 0,
                    flight: None,
                };
                store::set_host(&id, &host);
                let mut ids = store::host_ids();
                ids.push(id.clone());
                store::set_host_ids(&ids);
                paid.saturating_sub(HOST_DEPOSIT)
            }
        };
        if !refund.is_zero() {
            Promise::new(id.clone()).transfer(refund).detach();
        }
        emit("host_registered", &format!("\"host_id\":\"{id}\",\"endpoint\":{}", crate::util::jstr(&endpoint)));
    }

    /// A registered host asks to be paid for a finished epoch. OutLayer re-checks the sessions.
    #[payable]
    pub fn claim_epoch(&mut self, epoch: u64, mirror_index: Option<u32>) -> Promise {
        let released = self.released_at();
        let id = env::predecessor_account_id();
        let mut host = store::host(&id).unwrap_or_else(|| env::panic_str("Register as a host first"));
        require!(!store::epoch_paid(&id, epoch), "This epoch is already paid");
        let epoch_ms = self.cfg.pool.epoch_ms as u128;
        let end = released as u128 + (epoch as u128 + 1) * epoch_ms;
        require!(Self::now() as u128 >= end, "This epoch is not complete yet");
        require!(self.totals.pool > 0, "The hosting pool is empty");
        let flight = Self::begin_flight(&mut host.flight, &mut self.next_flight, "A claim");
        store::set_host(&id, &host);
        let from = (released as u128 + epoch as u128 * epoch_ms) as u64;
        let input = format!(
            "{{\"mode\":\"host\",\"contract\":\"{}\",\"endpoint\":\"{}\",\"host_id\":\"{id}\",\"build_hash\":\"{}\",\"nonce\":\"{}\",\"from_ms\":{from},\"to_ms\":{},\"epoch\":{epoch}}}",
            env::current_account_id(),
            host.endpoint,
            self.cfg.artifact.build_hash,
            nonce_hex(),
            from + self.cfg.pool.epoch_ms,
        );
        let cb = Cb { host: Some(id), epoch, ..Cb::new(flight) };
        self.outlayer_call(&self.cfg.probe, mirror_index, &input, false, "on_claim", &cb)
    }

    #[private]
    pub fn on_claim(&mut self, #[serializer(borsh)] cb: Cb) {
        let host_id = cb.host.clone().unwrap_or_else(|| env::panic_str("Bad callback"));
        let epoch = cb.epoch;
        if let Some(mut h) = store::host(&host_id) {
            Self::end_flight(&mut h.flight, cb.flight);
            store::set_host(&host_id, &h);
        }
        match read_out() {
            Out::Failed => {
                Self::refund_failed(&cb.payer, cb.deposit);
                Self::claim_skipped(&host_id, epoch, "claim call failed, retry");
            }
            Out::Null => Self::claim_skipped(&host_id, epoch, "probe run failed or timed out, retry"),
            Out::Res(v) => {
                let verified = v.verified.unwrap_or(0);
                if v.ok != Some(true) || v.build_ok != Some(true) {
                    Self::claim_skipped(&host_id, epoch, "wrong build or bad probe output");
                } else if v.reachable != Some(true) || verified == 0 {
                    Self::claim_skipped(&host_id, epoch, "no verified sessions");
                } else {
                    self.pay_claim(&host_id, epoch, verified);
                }
            }
        }
    }
}
