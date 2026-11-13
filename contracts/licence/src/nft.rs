//! NEP-171 core, NEP-177 metadata, NEP-181 enumeration and NEP-199 payouts, hand-rolled
//! to keep the wasm small. The per-token pot share and choice live in the same record as the
//! owner, so every transfer carries them automatically. Approvals (NEP-178): approvals.rs.

use near_sdk::borsh;
use near_sdk::json_types::U128;
use near_sdk::{assert_one_yocto, env, near, require, AccountId, Gas, GasWeight, NearToken, Promise, PromiseOrValue};

use crate::events::emit_nep171;
use crate::util::{jstr, Pairs};
use crate::{store, Licence, LicenceExt, Token, TokenData, TokenMeta};

const RESOLVE_GAS: Gas = Gas::from_tgas(15);
const MAX_PAGE: u64 = 100;

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Payout {
    pub payout: Pairs<U128>,
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers=[borsh])]
pub struct Resolve {
    pub previous_owner: AccountId,
    pub receiver: AccountId,
    pub token: u64,
    pub approvals: Vec<(AccountId, u64)>,
}

impl Licence {
    pub(crate) fn load_token(&self, token_id: &str) -> (u64, TokenData) {
        let n = token_id.parse::<u64>().unwrap_or_else(|_| env::panic_str("No such licence"));
        (n, store::token(n).unwrap_or_else(|| env::panic_str("No such licence")))
    }

    pub(crate) fn mint_token(&mut self, number: u64, td: TokenData) {
        let owner = td.owner.clone();
        store::set_token(number, &td);
        let mut list = store::owner_tokens(&owner);
        list.push(number);
        store::set_owner_tokens(&owner, &list);
        emit_nep171("nft_mint", &format!("\"owner_id\":\"{owner}\",\"token_ids\":[\"{number}\"]"));
    }

    fn move_in_lists(from: &AccountId, to: &AccountId, number: u64) {
        let mut a = store::owner_tokens(from);
        a.retain(|n| *n != number);
        store::set_owner_tokens(from, &a);
        let mut b = store::owner_tokens(to);
        b.push(number);
        store::set_owner_tokens(to, &b);
    }

    /// Moves a token, checking the sender is the owner or approved. Returns the previous
    /// owner and the approvals that were cleared.
    pub(crate) fn do_transfer(
        &mut self,
        sender: &AccountId,
        receiver: &AccountId,
        token_id: &str,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) -> (AccountId, Vec<(AccountId, u64)>) {
        let (n, mut td) = self.load_token(token_id);
        let owner = td.owner.clone();
        let mut authorized = String::new();
        if sender != &owner {
            let found = td.approvals.iter().find(|(a, _)| a == sender).map(|(_, id)| *id);
            let id = found.unwrap_or_else(|| env::panic_str("Sender is not approved"));
            require!(approval_id.is_none() || approval_id == Some(id), "Approval id does not match");
            authorized = format!(",\"authorized_id\":\"{sender}\"");
        }
        require!(&owner != receiver, "Current and next owner must differ");
        let old = std::mem::take(&mut td.approvals);
        td.owner = receiver.clone();
        store::set_token(n, &td);
        Self::move_in_lists(&owner, receiver, n);
        let memo = memo.map(|m| format!(",\"memo\":{}", jstr(&m))).unwrap_or_default();
        emit_nep171(
            "nft_transfer",
            &format!("\"old_owner_id\":\"{owner}\",\"new_owner_id\":\"{receiver}\",\"token_ids\":[\"{n}\"]{authorized}{memo}"),
        );
        (owner, old)
    }

    pub(crate) fn token_json(&self, n: u64) -> Option<Token> {
        let td = store::token(n)?;
        let extra = format!(
            "{{\"pot_share\":\"{}\",\"post_death\":{},\"minted_at_ms\":{},\"choice\":{}}}",
            td.pot_share,
            td.post_death,
            td.minted_at_ms,
            td.choice.map(|c| format!("\"{}\"", c.name())).unwrap_or_else(|| "null".into())
        );
        Some(Token {
            token_id: n.to_string(),
            owner_id: td.owner,
            metadata: TokenMeta {
                title: format!("{} licence #{n}", self.cfg.title),
                description: format!("A licence to play {} that outlives its server.", self.cfg.title),
                media: self.cfg.media.clone(),
                extra,
            },
            approved_account_ids: Pairs(td.approvals),
        })
    }

    fn payout_for(&self, owner: &AccountId, balance: u128, max_len: Option<u32>) -> Payout {
        let royalty = balance
            .checked_mul(self.cfg.royalty_bps as u128)
            .unwrap_or_else(|| env::panic_str("Balance too large"))
            / 10_000;
        let rest = balance - royalty;
        let mut payout: Vec<(AccountId, U128)> = vec![];
        if owner == &self.cfg.studio {
            payout.push((owner.clone(), U128(balance)));
        } else {
            if royalty > 0 {
                payout.push((self.cfg.studio.clone(), U128(royalty)));
            }
            if rest > 0 {
                payout.push((owner.clone(), U128(rest)));
            }
        }
        payout.retain(|(_, v)| v.0 > 0);
        if let Some(m) = max_len {
            require!(payout.len() as u32 <= m, "Too many payout recipients");
        }
        Payout { payout: Pairs(payout) }
    }
}

#[near]
impl Licence {
    #[payable]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>) {
        assert_one_yocto();
        self.do_transfer(&env::predecessor_account_id(), &receiver_id, &token_id, approval_id, memo);
    }

    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        assert_one_yocto();
        let sender = env::predecessor_account_id();
        let (previous, approvals) = self.do_transfer(&sender, &receiver_id, &token_id, approval_id, memo);
        let args = format!(
            "{{\"sender_id\":\"{sender}\",\"previous_owner_id\":\"{previous}\",\"token_id\":\"{token_id}\",\"msg\":{}}}",
            jstr(&msg)
        );
        let resolve = Resolve { previous_owner: previous, receiver: receiver_id.clone(), token: token_id.parse().unwrap_or(0), approvals };
        Promise::new(receiver_id)
            .function_call_weight("nft_on_transfer", args.into_bytes(), NearToken::from_yoctonear(0), Gas::from_gas(0), GasWeight(1))
            .then(Promise::new(env::current_account_id()).function_call_weight(
                "nft_resolve_transfer",
                borsh::to_vec(&resolve).unwrap_or_default(),
                NearToken::from_yoctonear(0),
                RESOLVE_GAS,
                GasWeight(0),
            ))
            .into()
    }

    /// Gives the token back to the previous owner unless the receiver kept it.
    #[private]
    pub fn nft_resolve_transfer(&mut self, #[serializer(borsh)] r: Resolve) -> bool {
        let must_revert = match env::promise_result_checked(0, 8) {
            Ok(b) => near_sdk::serde_json::from_slice::<bool>(&b).unwrap_or(true),
            Err(_) => true,
        };
        if !must_revert {
            return true;
        }
        let mut td = match store::token(r.token) {
            Some(t) if t.owner == r.receiver => t,
            _ => return true,
        };
        td.owner = r.previous_owner.clone();
        td.approvals = r.approvals;
        store::set_token(r.token, &td);
        Self::move_in_lists(&r.receiver, &r.previous_owner, r.token);
        emit_nep171(
            "nft_transfer",
            &format!(
                "\"old_owner_id\":\"{}\",\"new_owner_id\":\"{}\",\"token_ids\":[\"{}\"],\"memo\":\"refund\"",
                r.receiver, r.previous_owner, r.token
            ),
        );
        false
    }

    pub fn nft_token(&self, token_id: String) -> Option<Token> {
        self.token_json(token_id.parse().ok()?)
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.supply as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        let from = from_index.map(|i| i.0).unwrap_or(0).min(self.supply as u128) as u64;
        let end = (self.supply).min(from.saturating_add(limit.unwrap_or(MAX_PAGE).min(MAX_PAGE)));
        ((from + 1)..=end).filter_map(|n| self.token_json(n)).collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(store::owner_tokens(&account_id).len() as u128)
    }

    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        let mut ids = store::owner_tokens(&account_id);
        ids.sort_unstable();
        ids.into_iter()
            .skip(from_index.map(|i| i.0).unwrap_or(0).min(u32::MAX as u128) as usize)
            .take(limit.unwrap_or(MAX_PAGE).min(MAX_PAGE) as usize)
            .filter_map(|n| self.token_json(n))
            .collect()
    }

    pub fn nft_metadata(&self) -> ContractMetadata {
        ContractMetadata {
            spec: "nft-1.0.0".into(),
            name: self.cfg.title.clone(),
            symbol: "LSAVE".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    /// NEP-199: royalty_bps of the sale price to the studio, the rest to the current owner.
    pub fn nft_payout(&self, token_id: String, balance: U128, max_len_payout: Option<u32>) -> Payout {
        let (_, td) = self.load_token(&token_id);
        self.payout_for(&td.owner, balance.0, max_len_payout)
    }

    /// NEP-199: transfer, and return who must be paid (computed for the previous owner).
    #[payable]
    pub fn nft_transfer_payout(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
        balance: U128,
        max_len_payout: Option<u32>,
    ) -> Payout {
        assert_one_yocto();
        let (_, td) = self.load_token(&token_id);
        let payout = self.payout_for(&td.owner, balance.0, max_len_payout);
        self.do_transfer(&env::predecessor_account_id(), &receiver_id, &token_id, approval_id, memo);
        payout
    }
}

