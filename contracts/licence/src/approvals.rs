//! NEP-178 approvals. Each approval costs a few bytes of storage, paid by the owner.

use near_sdk::{assert_one_yocto, env, near, require, AccountId, Gas, NearToken, Promise};

use crate::util::jstr;
use crate::{store, Licence, LicenceExt};

fn cost_of(bytes: u64) -> NearToken {
    NearToken::from_yoctonear(bytes as u128 * env::storage_byte_cost().as_yoctonear())
}

impl Licence {
    fn owned_token(&self, token_id: &str) -> (u64, crate::TokenData) {
        let (n, td) = self.load_token(token_id);
        require!(td.owner == env::predecessor_account_id(), "Only the owner can manage approvals");
        (n, td)
    }
}

#[near]
impl Licence {
    #[payable]
    pub fn nft_approve(&mut self, token_id: String, account_id: AccountId, msg: Option<String>) -> Option<Promise> {
        let (n, mut td) = self.owned_token(&token_id);
        let before = env::storage_usage();
        let approval_id = td.next_approval_id;
        td.next_approval_id += 1;
        td.approvals.retain(|(a, _)| a != &account_id);
        td.approvals.push((account_id.clone(), approval_id));
        store::set_token(n, &td);
        let cost = cost_of(env::storage_usage().saturating_sub(before));
        let paid = env::attached_deposit();
        require!(paid >= cost, "Attach more NEAR to cover approval storage");
        let extra = paid.saturating_sub(cost);
        if !extra.is_zero() {
            Promise::new(td.owner.clone()).transfer(extra).detach();
        }
        msg.map(|m| {
            let args = format!(
                "{{\"token_id\":\"{token_id}\",\"owner_id\":\"{}\",\"approval_id\":{approval_id},\"msg\":{}}}",
                td.owner,
                jstr(&m)
            );
            Promise::new(account_id).function_call_weight(
                "nft_on_approve",
                args.into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_gas(0),
                near_sdk::GasWeight(1),
            )
        })
    }

    #[payable]
    pub fn nft_revoke(&mut self, token_id: String, account_id: AccountId) {
        assert_one_yocto();
        let (n, mut td) = self.owned_token(&token_id);
        let before = env::storage_usage();
        td.approvals.retain(|(a, _)| a != &account_id);
        store::set_token(n, &td);
        self.refund_storage(&td.owner, before);
    }

    #[payable]
    pub fn nft_revoke_all(&mut self, token_id: String) {
        assert_one_yocto();
        let (n, mut td) = self.owned_token(&token_id);
        let before = env::storage_usage();
        td.approvals.clear();
        store::set_token(n, &td);
        self.refund_storage(&td.owner, before);
    }

    pub fn nft_is_approved(&self, token_id: String, approved_account_id: AccountId, approval_id: Option<u64>) -> bool {
        let (_, td) = self.load_token(&token_id);
        td.approvals
            .iter()
            .any(|(a, id)| a == &approved_account_id && approval_id.is_none_or(|x| x == *id))
    }
}

impl Licence {
    fn refund_storage(&self, to: &AccountId, usage_before: u64) {
        let freed = usage_before.saturating_sub(env::storage_usage());
        if freed > 0 {
            Promise::new(to.clone()).transfer(cost_of(freed)).detach();
        }
    }
}
