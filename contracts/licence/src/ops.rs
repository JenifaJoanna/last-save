//! Ops budget: gas money the contract keeps so enclave calls and MPC signing can be
//! made with a zero deposit (for example through a gasless relayer).
//!
//! Funding: `fund_ops` (anyone; the studio funds it at launch) and a fixed slice of every
//! sale made after death (`OPS_SALE_BPS`). It is spent only by `probe_official`, `release`,
//! `claim_epoch` (0.02 N each) and EVM signing (1 yocto plus signed-record storage).
//! OutLayer's own refund of an unused deposit lands in the contract balance and is not
//! credited back to the budget, so the budget is never overstated.

use near_sdk::json_types::U128;
use near_sdk::{env, near, require};

use crate::events::emit;
use crate::{Licence, LicenceExt};

/// Attached to request_execution when the caller attaches nothing: 0.02 N.
pub const OPS_ATTACH: u128 = 20_000_000_000_000_000_000_000;
/// Share of a post-death sale that goes to the ops budget (10%); the rest feeds the pool.
pub const OPS_SALE_BPS: u128 = 1000;

impl Licence {
    /// True when the call attached nothing and so is paid from the ops budget (debited here).
    pub(crate) fn take_attach(&mut self) -> bool {
        if !env::attached_deposit().is_zero() {
            return false;
        }
        require!(self.totals.ops_budget >= OPS_ATTACH, "Ops budget is empty, fund it first");
        self.totals.ops_budget -= OPS_ATTACH;
        true
    }
}

#[near]
impl Licence {
    /// Anyone adds to the ops budget. Returns the new budget.
    #[payable]
    pub fn fund_ops(&mut self) -> U128 {
        let paid = env::attached_deposit().as_yoctonear();
        require!(paid > 0, "Attach NEAR to fund ops");
        self.totals.ops_budget += paid;
        emit("ops_funded", &format!("\"from\":\"{}\",\"amount\":\"{paid}\"", env::predecessor_account_id()));
        U128(self.totals.ops_budget)
    }

    pub fn ops_budget(&self) -> U128 {
        U128(self.totals.ops_budget)
    }
}
