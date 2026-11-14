//! Read-only views of EVM payouts.

use near_sdk::json_types::U128;
use near_sdk::{env, near};

use crate::rlp::EVM_CHAIN_ID;
use crate::{store, EvmInfoView, EvmPayout, EvmPayoutView, Licence, LicenceExt};

#[near]
impl Licence {
    pub fn get_evm_payouts(&self, from_index: u64, limit: u64) -> Vec<EvmPayoutView> {
        let end = self.evm_count.min(from_index.saturating_add(limit.min(100)));
        (from_index..end).filter_map(store::evm).map(view).collect()
    }

    /// Where the payer address comes from, for anyone to re-derive and check.
    pub fn evm_payout_info(&self) -> Option<EvmInfoView> {
        let c = self.cfg.evm_payout.as_ref()?;
        Some(EvmInfoView {
            address: c.address.clone(),
            next_nonce: self.next_evm_nonce,
            mpc: c.mpc.clone(),
            path: c.path.clone(),
            chain_id: EVM_CHAIN_ID,
            derivation_account: env::current_account_id(),
            domain_id: crate::evm::DOMAIN_ID,
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
        last_signed_ms: p.last_signed_ms,
        last_error: p.last_error,
    }
}
