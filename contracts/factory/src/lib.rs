//! Last Save studio factory.
//!
//! `create_instance(name, config)` makes `<name>.<this account>` in ONE receipt batch:
//! CreateAccount, Transfer(min deposit), UseGlobalContract(code hash), FunctionCall `new({config})`,
//! and, when more than the minimum was attached, FunctionCall `fund_ops` with the excess so the
//! new instance can make gas-free calls straight away.
//! No access key is ever added, so the instance is born locked: nobody, including the studio
//! and this factory, can sign for it, and its code is the immutable global contract named by
//! hash (NEP-591). The batch is atomic: if `new` rejects the config the account is not created
//! and the deposit comes back through the callback.

mod types;

use near_sdk::json_types::{Base58CryptoHash, U128};
use near_sdk::serde_json;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

pub use types::*;

const INIT_GAS: Gas = Gas::from_tgas(40);
const FUND_GAS: Gas = Gas::from_tgas(10);
const CALLBACK_GAS: Gas = Gas::from_tgas(15);
/// Account record, global-contract reference and the licence's fixed state (counters, flags).
const BASE_BYTES: u64 = 200 + 512;
/// Room for the latest snapshot (16 KB) and its bookkeeping.
const SNAPSHOT_BYTES: u64 = 17_408;
/// Room for tokens, hosts, claims and EVM payouts the instance stores as it lives.
const GROWTH_BYTES: u64 = 12_288;
/// Working float on top of storage.
const FLOAT_YOCTO: u128 = 50_000_000_000_000_000_000_000;

#[near(serializers=[borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Pending,
    Ready,
    Failed,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Instance {
    pub account_id: AccountId,
    pub creator: AccountId,
    pub deposit: U128,
    pub created_ms: u64,
    pub status: Status,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    owner: AccountId,
    code_hash: [u8; 32],
    open: bool,
    instances: Vec<Instance>,
    /// Deposits a failed creation could not return at once (claim_refund pays them out).
    refunds: Vec<(AccountId, U128)>,
}

fn emit(event: &str, data: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"lastsave-factory\",\"version\":\"1.0.0\",\"event\":\"{event}\",\"data\":[{{{data}}}]}}"
    ));
}

fn valid_name(n: &str) -> bool {
    let b = n.as_bytes();
    (2..=32).contains(&b.len())
        && b.iter().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == b'-' || *c == b'_')
        && b[0].is_ascii_alphanumeric()
        && b[b.len() - 1].is_ascii_alphanumeric()
}

#[near]
impl Factory {
    /// `licence_code_hash`: sha256 of the licence wasm, already published as a global contract.
    #[init]
    pub fn new(owner: AccountId, licence_code_hash: Base58CryptoHash) -> Self {
        Self { owner, code_hash: licence_code_hash.into(), open: true, instances: vec![], refunds: vec![] }
    }

    /// Owner only: close the factory to everyone else, or open it again.
    pub fn set_open(&mut self, open: bool) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can do this");
        self.open = open;
    }

    /// Creates `<name>.<factory>`, funds it with the whole attached deposit, points it at the
    /// global licence code by hash and initialises it, all in one batch. Adds no access key.
    #[payable]
    pub fn create_instance(&mut self, name: String, config: InitConfig) -> Promise {
        let creator = env::predecessor_account_id();
        require!(self.open || creator == self.owner, "The factory is closed");
        require!(valid_name(&name), "Name must be 2 to 32 characters: a-z, 0-9, - or _");
        let account_id: AccountId = format!("{name}.{}", env::current_account_id())
            .parse()
            .unwrap_or_else(|_| env::panic_str("Name does not make a valid account id"));
        require!(
            !self.instances.iter().any(|i| i.account_id == account_id && i.status != Status::Failed),
            "That name is taken"
        );
        let deposit = env::attached_deposit();
        let need = Self::deposit_for(&config);
        require!(
            deposit.as_yoctonear() >= need,
            format!("Deposit is below the minimum of {need} yoctoNEAR (account, state and headroom)")
        );
        let args = serde_json::to_vec(&serde_json::json!({ "config": config })).unwrap_or_default();
        self.instances.retain(|i| i.account_id != account_id);
        self.instances.push(Instance {
            account_id: account_id.clone(),
            creator: creator.clone(),
            deposit: U128(deposit.as_yoctonear()),
            created_ms: env::block_timestamp_ms(),
            status: Status::Pending,
        });
        emit("instance_requested", &format!("\"account_id\":\"{account_id}\",\"creator\":\"{creator}\""));
        let excess = deposit.as_yoctonear() - need;
        let mut batch = Promise::new(account_id.clone())
            .create_account()
            .transfer(NearToken::from_yoctonear(need))
            .use_global_contract(self.code_hash)
            .function_call("new".to_string(), args, NearToken::from_yoctonear(0), INIT_GAS);
        if excess > 0 {
            batch = batch.function_call("fund_ops".to_string(), b"{}".to_vec(), NearToken::from_yoctonear(excess), FUND_GAS);
        }
        batch
            .then(Promise::new(env::current_account_id()).function_call(
                "on_created".to_string(),
                serde_json::to_vec(&serde_json::json!({ "account_id": account_id, "creator": creator, "deposit": U128(deposit.as_yoctonear()) })).unwrap_or_default(),
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ))
    }

    #[private]
    pub fn on_created(&mut self, account_id: AccountId, creator: AccountId, deposit: U128) -> bool {
        let ok = !matches!(env::promise_result_checked(0, 16), Err(PromiseError::Failed));
        if let Some(i) = self.instances.iter_mut().find(|i| i.account_id == account_id) {
            i.status = if ok { Status::Ready } else { Status::Failed };
        }
        if ok {
            emit("instance_created", &format!("\"account_id\":\"{account_id}\",\"creator\":\"{creator}\",\"deposit\":\"{}\"", deposit.0));
            return true;
        }
        emit("instance_failed", &format!("\"account_id\":\"{account_id}\",\"creator\":\"{creator}\""));
        // the failed batch hands the deposit back to us; pass it on if we can already cover it
        let storage = env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear();
        let free = env::account_balance().as_yoctonear().saturating_sub(storage);
        if free >= deposit.0 {
            Promise::new(creator.clone()).transfer(NearToken::from_yoctonear(deposit.0)).detach();
            emit("refunded", &format!("\"to\":\"{creator}\",\"amount\":\"{}\"", deposit.0));
        } else {
            self.refunds.push((creator.clone(), deposit));
            emit("refund_owed", &format!("\"to\":\"{creator}\",\"amount\":\"{}\"", deposit.0));
        }
        false
    }

    /// Pays out deposits a failed creation could not return at once. The entry is taken out first
    /// (so two calls cannot both be paid) and put back by the callback if the transfer fails.
    pub fn claim_refund(&mut self) -> Promise {
        let who = env::predecessor_account_id();
        let owed: u128 = self.refunds.iter().filter(|(a, _)| *a == who).map(|(_, d)| d.0).sum();
        require!(owed > 0, "Nothing to refund");
        let storage = env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear();
        require!(env::account_balance().as_yoctonear().saturating_sub(storage) >= owed, "The factory cannot cover this yet, try again shortly");
        self.refunds.retain(|(a, _)| *a != who);
        Promise::new(who.clone()).transfer(NearToken::from_yoctonear(owed)).then(Promise::new(env::current_account_id()).function_call(
            "on_refund_paid".to_string(),
            serde_json::to_vec(&serde_json::json!({ "who": who, "owed": U128(owed) })).unwrap_or_default(),
            NearToken::from_yoctonear(0),
            CALLBACK_GAS,
        ))
    }

    #[private]
    pub fn on_refund_paid(&mut self, who: AccountId, owed: U128) -> bool {
        if matches!(env::promise_result_checked(0, 16), Err(PromiseError::Failed)) {
            self.refunds.push((who.clone(), owed));
            emit("refund_failed", &format!("\"to\":\"{who}\",\"amount\":\"{}\"", owed.0));
            return false;
        }
        emit("refunded", &format!("\"to\":\"{who}\",\"amount\":\"{}\"", owed.0));
        true
    }

    pub fn instances(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<Instance> {
        let from = from_index.unwrap_or(0) as usize;
        self.instances.iter().skip(from).take(limit.unwrap_or(100).min(100) as usize).cloned().collect()
    }

    pub fn code_hash(&self) -> Base58CryptoHash {
        self.code_hash.into()
    }

    pub fn owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn is_open(&self) -> bool {
        self.open
    }

    /// The smallest deposit `create_instance` accepts for this config.
    pub fn min_deposit(&self, config: InitConfig) -> U128 {
        U128(Self::deposit_for(&config))
    }
}

impl Factory {
    /// Storage of the account, the global-code reference, the config and room to grow, plus a float.
    fn deposit_for(config: &InitConfig) -> u128 {
        let cfg_bytes = serde_json::to_string(config).map(|s| s.len()).unwrap_or(4096) as u64;
        let bytes = BASE_BYTES + cfg_bytes + SNAPSHOT_BYTES + GROWTH_BYTES;
        bytes as u128 * env::storage_byte_cost().as_yoctonear() + FLOAT_YOCTO
    }
}

#[cfg(test)]
mod tests;
