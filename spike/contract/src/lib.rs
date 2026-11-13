//! Day-one spike for Last Save (brief section 5).
//!
//! Proves three things on testnet before anything is built on them:
//! 1. a contract can own an OutLayer secret (`escrow_key` -> `store_secrets`)
//!    whose access rule is "only requests this contract makes, only this exact
//!    release build";
//! 2. the contract can run that build through `request_execution` with
//!    `secrets_ref` and get the key back in its own callback (yield/resume);
//! 3. a failed or timed-out execution leaves the contract retryable.
//!
//! Spike-only shortcuts: `kill` is studio-only here (the real contract dies by
//! probes, holder quorum or end_of_service).

use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, near, require, AccountId, Gas, GasWeight, NearToken, PanicOnDefault, Promise, PromiseResult};

const PROFILE: &str = "escrow";
const CALLBACK_GAS: Gas = Gas::from_tgas(20);
const STORE_GAS: Gas = Gas::from_tgas(40);

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Spike {
    studio: AccountId,
    outlayer: AccountId,
    release_url: String,
    release_hash: String,
    key_commitment: String,
    escrowed: bool,
    dead: bool,
    in_flight: bool,
    released_key: Option<String>,
    attested_sha256: Option<String>,
    attempts: u32,
    last_error: Option<String>,
}

#[near]
impl Spike {
    #[init]
    pub fn new(
        studio: AccountId,
        outlayer: AccountId,
        release_url: String,
        release_hash: String,
        key_commitment: String,
    ) -> Self {
        require!(release_hash.len() == 64, "release_hash must be 64 hex chars");
        require!(key_commitment.len() == 64, "key_commitment must be 64 hex chars");
        Self {
            studio,
            outlayer,
            release_url,
            release_hash: release_hash.to_lowercase(),
            key_commitment: key_commitment.to_lowercase(),
            escrowed: false,
            dead: false,
            in_flight: false,
            released_key: None,
            attested_sha256: None,
            attempts: 0,
            last_error: None,
        }
    }

    /// The access rule every escrowed key gets: only a request whose
    /// predecessor is this contract, and only this exact release build.
    pub fn escrow_access(&self) -> Value {
        json!({ "Logic": { "operator": "And", "conditions": [
            { "Predecessor": { "condition": { "Whitelist": { "accounts": [env::current_account_id()] } } } },
            { "WasmHash": { "hash": self.release_hash } }
        ]}})
    }

    /// Studio hands over K encrypted to the keystore (ECIES, seed bound to this
    /// contract + the release hash). The contract becomes the secret's owner.
    #[payable]
    pub fn escrow_key(&mut self, encrypted_secrets_base64: String) -> Promise {
        require!(env::predecessor_account_id() == self.studio, "only the studio escrows");
        require!(!self.escrowed, "already escrowed");
        let args = json!({
            "accessor": { "WasmHash": { "hash": self.release_hash } },
            "profile": PROFILE,
            "encrypted_secrets_base64": encrypted_secrets_base64,
            "access": self.escrow_access(),
            "vault_id": Value::Null,
        });
        self.escrowed = true;
        Promise::new(self.outlayer.clone())
            .function_call("store_secrets", args.to_string().into_bytes(), env::attached_deposit(), STORE_GAS)
            .then(Promise::new(env::current_account_id()).function_call(
                "on_escrow",
                vec![],
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ))
    }

    #[private]
    pub fn on_escrow(&mut self) -> bool {
        let ok = matches!(env::promise_result(0), PromiseResult::Successful(_));
        if !ok {
            self.escrowed = false;
            self.last_error = Some("store_secrets failed".into());
        }
        ok
    }

    pub fn ls_status(&self) -> String {
        if self.dead { "Dead".into() } else { "Alive".into() }
    }

    pub fn kill(&mut self) {
        require!(env::predecessor_account_id() == self.studio, "spike: only the studio kills");
        self.dead = true;
    }

    /// Anyone may trigger once Dead. Attached deposit pays OutLayer; excess and
    /// failures are refunded to the caller.
    #[payable]
    pub fn release(&mut self) -> Promise {
        require!(self.dead, "not dead");
        require!(self.escrowed, "nothing escrowed");
        require!(self.released_key.is_none(), "already released");
        self.run("release", "on_release")
    }

    /// Anyone may trigger at any time: proves the escrowed key matches the
    /// commitment without revealing it.
    #[payable]
    pub fn attest(&mut self) -> Promise {
        require!(self.escrowed, "nothing escrowed");
        self.run("attest", "on_attest")
    }

    #[private]
    pub fn on_release(&mut self) -> bool {
        self.in_flight = false;
        match self.read_output() {
            Ok(v) if v["ok"] == true => {
                let key = v["key"].as_str().unwrap_or_default().to_lowercase();
                let raw = hex::decode(&key).unwrap_or_default();
                let sha = hex::encode(env::sha256(&raw));
                if sha != self.key_commitment {
                    self.last_error = Some("released key does not match commitment".into());
                    return false;
                }
                env::log_str(&format!("EVENT_JSON:{{\"standard\":\"lastsave\",\"version\":\"0.1.0\",\"event\":\"key_released\",\"data\":[{{\"key\":\"{key}\"}}]}}"));
                self.released_key = Some(key);
                self.last_error = None;
                true
            }
            Ok(v) => {
                self.last_error = Some(format!("release refused: {}", v["error"]));
                false
            }
            Err(e) => {
                self.last_error = Some(e);
                false
            }
        }
    }

    #[private]
    pub fn on_attest(&mut self) -> bool {
        self.in_flight = false;
        match self.read_output() {
            Ok(v) if v["ok"] == true => {
                let sha = v["key_sha256"].as_str().unwrap_or_default().to_lowercase();
                let matches = sha == self.key_commitment;
                self.attested_sha256 = Some(sha);
                self.last_error = if matches { None } else { Some("attested hash != commitment".into()) };
                matches
            }
            Ok(v) => {
                self.last_error = Some(format!("attest refused: {}", v["error"]));
                false
            }
            Err(e) => {
                self.last_error = Some(e);
                false
            }
        }
    }

    pub fn get_state(&self) -> Value {
        json!({
            "studio": self.studio, "outlayer": self.outlayer,
            "release_url": self.release_url, "release_hash": self.release_hash,
            "key_commitment": self.key_commitment, "escrowed": self.escrowed,
            "status": self.ls_status(), "in_flight": self.in_flight,
            "released_key": self.released_key, "attested_sha256": self.attested_sha256,
            "attempts": self.attempts, "last_error": self.last_error,
            "escrow_access": self.escrow_access(),
        })
    }
}

impl Spike {
    fn run(&mut self, mode: &str, callback: &str) -> Promise {
        require!(!self.in_flight, "an execution is already in flight");
        require!(env::attached_deposit() >= NearToken::from_millinear(10), "attach at least 0.01 NEAR for OutLayer");
        self.in_flight = true;
        self.attempts += 1;
        let args = json!({
            "source": { "WasmUrl": { "url": self.release_url, "hash": self.release_hash, "build_target": "wasm32-wasip2" } },
            "resource_limits": { "max_instructions": 2_000_000_000u64, "max_memory_mb": 128, "max_execution_seconds": 40 },
            "input_data": json!({ "mode": mode }).to_string(),
            "secrets_ref": { "profile": PROFILE, "account_id": env::current_account_id() },
            "response_format": "Json",
            "payer_account_id": env::predecessor_account_id(),
            "params": Value::Null,
        });
        let outlayer_gas = env::prepaid_gas()
            .saturating_sub(env::used_gas())
            .saturating_sub(CALLBACK_GAS)
            .saturating_sub(Gas::from_tgas(15));
        Promise::new(self.outlayer.clone())
            .function_call_weight(
                "request_execution",
                args.to_string().into_bytes(),
                env::attached_deposit(),
                outlayer_gas,
                GasWeight(1),
            )
            .then(Promise::new(env::current_account_id()).function_call(
                callback,
                vec![],
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ))
    }

    fn read_output(&self) -> Result<Value, String> {
        match env::promise_result(0) {
            PromiseResult::Successful(bytes) => {
                serde_json::from_slice::<Value>(&bytes).map_err(|e| format!("output not json: {e}"))
            }
            PromiseResult::Failed => Err("OutLayer execution failed or timed out".into()),
        }
    }
}
