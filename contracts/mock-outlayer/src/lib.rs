//! Test double for OutLayer. `request_execution` returns the JSON configured for its key:
//! `host:<host_id>` (claims) first, then the program mode (`official`, `host`, `attest`, `release`).
//! A configured `null` models OutLayer's failed or timed-out run. `store_secrets` records its call.

use near_sdk::serde_json::{self, Value};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockOutlayer {
    owner: AccountId,
    outputs: LookupMap<String, String>,
    secrets_calls: Vec<String>,
    exec_calls: Vec<String>,
    fail_store: bool,
}

#[near]
impl MockOutlayer {
    #[init]
    pub fn new() -> Self {
        Self {
            owner: env::predecessor_account_id(),
            outputs: LookupMap::new(b"o"),
            secrets_calls: vec![],
            exec_calls: vec![],
            fail_store: false,
        }
    }

    /// Configure the JSON text returned for a key (for example "official" or "host:lastsave-fanhost.testnet").
    pub fn set_output(&mut self, key: String, json: String) {
        require!(env::predecessor_account_id() == self.owner, "owner only");
        self.outputs.insert(key, json);
    }

    pub fn set_fail_store(&mut self, fail: bool) {
        require!(env::predecessor_account_id() == self.owner, "owner only");
        self.fail_store = fail;
    }

    #[payable]
    pub fn store_secrets(&mut self, accessor: Value, profile: String, encrypted_secrets_base64: String, access: Value, vault_id: Value) {
        require!(!self.fail_store, "store refused");
        self.secrets_calls.push(
            serde_json::json!({ "predecessor": env::predecessor_account_id(), "accessor": accessor, "profile": profile,
                "len": encrypted_secrets_base64.len(), "access": access, "vault_id": vault_id, "deposit": env::attached_deposit().as_yoctonear().to_string() })
            .to_string(),
        );
    }

    #[payable]
    pub fn request_execution(
        &mut self,
        source: Value,
        resource_limits: Value,
        input_data: String,
        secrets_ref: Option<Value>,
        response_format: String,
        payer_account_id: AccountId,
        params: Value,
    ) -> Value {
        let _ = (source, resource_limits, response_format, params);
        let input: Value = serde_json::from_str(&input_data).unwrap_or(Value::Null);
        let mode = input["mode"].as_str().unwrap_or("").to_string();
        let host = input["host_id"].as_str().unwrap_or("").to_string();
        self.exec_calls.push(
            serde_json::json!({ "mode": mode, "host": host, "payer": payer_account_id, "secrets": secrets_ref.is_some(),
                "deposit": env::attached_deposit().as_yoctonear().to_string() })
            .to_string(),
        );
        let key = if mode == "host" { format!("host:{host}") } else { mode.clone() };
        let out = self.outputs.get(&key).or_else(|| self.outputs.get(&mode)).cloned().unwrap_or_else(|| "null".into());
        serde_json::from_str(&out).unwrap_or(Value::Null)
    }

    pub fn secrets_calls(&self) -> Vec<String> {
        self.secrets_calls.clone()
    }

    pub fn exec_calls(&self) -> Vec<String> {
        self.exec_calls.clone()
    }
}
