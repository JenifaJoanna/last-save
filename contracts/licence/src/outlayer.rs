//! OutLayer plumbing: request_execution calls, result reading, escrow and attest.

use near_sdk::serde_json;
use near_sdk::{env, near, require, AccountId, Gas, GasWeight, NearToken, Promise, PromiseError};

use crate::events::{emit, log_activity};
use crate::util::{jstr, Cb};
use crate::{Licence, LicenceExt, Program};

pub const PROFILE: &str = "escrow";
pub const CALLBACK_GAS: Gas = Gas::from_tgas(25);
const RESERVE_GAS: Gas = Gas::from_tgas(20);
const STORE_GAS: Gas = Gas::from_tgas(40);
pub const MIN_ATTACH: NearToken = NearToken::from_millinear(10);
const MAX_OUT: usize = 16_384;

/// The fields we read from probe.wasm and release.wasm output; anything else is ignored.
#[near(serializers=[json])]
pub struct OutRes {
    pub ok: Option<bool>,
    pub reachable: Option<bool>,
    pub build_ok: Option<bool>,
    pub verified: Option<u64>,
    pub key: Option<String>,
    pub key_sha256: Option<String>,
    pub artifact_ok: Option<bool>,
}

/// What a finished OutLayer run left in our callback.
pub enum Out {
    Res(OutRes),
    /// OutLayer's marker for a failed or timed-out run (it refunds the caller itself),
    /// or any output we cannot read. Never a probe failure.
    Null,
    /// The request_execution promise itself failed (the deposit came back to us).
    Failed,
}

pub fn read_out() -> Out {
    match env::promise_result_checked(0, MAX_OUT) {
        Ok(bytes) => match serde_json::from_slice::<OutRes>(&bytes) {
            Ok(r) => Out::Res(r),
            Err(_) => Out::Null,
        },
        Err(PromiseError::Failed) => Out::Failed,
        Err(_) => Out::Null,
    }
}

pub fn pick_url(p: &Program, mirror: Option<u32>) -> &str {
    p.urls.get(mirror.unwrap_or(0) as usize).map(|s| s.as_str()).unwrap_or_else(|| env::panic_str("No such mirror"))
}

/// A 16-byte hex nonce from the chain's random seed.
pub fn nonce_hex() -> String {
    hex::encode(&env::random_seed()[..16])
}

impl Licence {
    /// Hands back an attached deposit when the OutLayer promise itself failed.
    pub(crate) fn refund_failed(payer: &AccountId, deposit: u128) {
        if deposit > 0 {
            Promise::new(payer.clone()).transfer(NearToken::from_yoctonear(deposit)).detach();
        }
    }

    /// request_execution to OutLayer with the caller's deposit, then `callback(cb)`.
    /// `input` is the JSON text handed to the wasm program.
    pub(crate) fn outlayer_call(
        &self,
        program: &Program,
        mirror: Option<u32>,
        input: &str,
        secrets: bool,
        callback: &str,
        cb: &Cb,
    ) -> Promise {
        let deposit = env::attached_deposit();
        require!(deposit >= MIN_ATTACH, "Attach at least 0.01 NEAR for OutLayer");
        let secrets_ref = if secrets {
            format!(",\"secrets_ref\":{{\"profile\":\"{PROFILE}\",\"account_id\":\"{}\"}}", env::current_account_id())
        } else {
            String::new()
        };
        let args = format!(
            "{{\"source\":{{\"WasmUrl\":{{\"url\":{},\"hash\":\"{}\",\"build_target\":\"wasm32-wasip2\"}}}},\
             \"resource_limits\":{{\"max_instructions\":5000000000,\"max_memory_mb\":256,\"max_execution_seconds\":60}},\
             \"input_data\":{}{secrets_ref},\"response_format\":\"Json\",\"payer_account_id\":\"{}\",\"params\":null}}",
            jstr(pick_url(program, mirror)),
            program.sha256,
            jstr(input),
            env::predecessor_account_id(),
        );
        let gas = env::prepaid_gas()
            .saturating_sub(env::used_gas())
            .saturating_sub(CALLBACK_GAS)
            .saturating_sub(RESERVE_GAS);
        Promise::new(self.cfg.outlayer.clone())
            .function_call_weight("request_execution", args.into_bytes(), deposit, gas, GasWeight(1))
            .then(Promise::new(env::current_account_id()).function_call(
                callback,
                cb.bytes(),
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ))
    }

    /// Keystore access rule: only requests this contract makes, only this release build.
    pub fn escrow_access_rule(&self) -> String {
        format!(
            "{{\"Logic\":{{\"operator\":\"And\",\"conditions\":[\
             {{\"Predecessor\":{{\"condition\":{{\"Whitelist\":{{\"accounts\":[\"{}\"]}}}}}}}},\
             {{\"WasmHash\":{{\"hash\":\"{}\"}}}}]}}}}",
            env::current_account_id(),
            self.cfg.release.sha256
        )
    }
}

#[near]
impl Licence {
    /// The studio hands over K, sealed to the keystore. The contract becomes the secret's owner.
    #[payable]
    pub fn escrow_key(&mut self, encrypted_secrets_base64: String) -> Promise {
        self.require_studio();
        require!(!self.escrow.escrowed, "Key is already escrowed");
        require!(self.supply == 0, "Sales have already started");
        require!(
            !encrypted_secrets_base64.is_empty()
                && encrypted_secrets_base64.len() < 8192
                && encrypted_secrets_base64.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'=' | b'-' | b'_')),
            "Bad sealed secret"
        );
        let id = Self::begin_flight(&mut self.escrow.flight, &mut self.next_flight, "Escrow");
        let deposit = env::attached_deposit();
        let args = format!(
            "{{\"accessor\":{{\"WasmHash\":{{\"hash\":\"{}\"}}}},\"profile\":\"{PROFILE}\",\
             \"encrypted_secrets_base64\":\"{encrypted_secrets_base64}\",\"access\":{},\"vault_id\":null}}",
            self.cfg.release.sha256,
            self.escrow_access_rule()
        );
        Promise::new(self.cfg.outlayer.clone())
            .function_call("store_secrets", args.into_bytes(), deposit, STORE_GAS)
            .then(Promise::new(env::current_account_id()).function_call(
                "on_escrow",
                Cb::new(id).bytes(),
                NearToken::from_yoctonear(0),
                CALLBACK_GAS,
            ))
    }

    #[private]
    pub fn on_escrow(&mut self, #[serializer(borsh)] cb: Cb) -> bool {
        Self::end_flight(&mut self.escrow.flight, cb.flight);
        match env::promise_result_checked(0, MAX_OUT) {
            Err(PromiseError::Failed) => {
                self.escrow.last_error = Some("OutLayer refused the secret".into());
                Self::refund_failed(&cb.payer, cb.deposit);
                false
            }
            _ => {
                self.escrow.escrowed = true;
                self.escrow.last_error = None;
                emit("escrowed", "");
                true
            }
        }
    }

    /// Anyone: OutLayer opens the escrowed key inside the TEE and proves it matches the
    /// commitment and the encrypted server build, without revealing it.
    #[payable]
    pub fn attest(&mut self, mirror_index: Option<u32>) -> Promise {
        require!(self.escrow.escrowed, "Nothing is escrowed yet");
        let id = Self::begin_flight(&mut self.escrow.attest_flight, &mut self.next_flight, "Attestation");
        self.outlayer_call(&self.cfg.release, mirror_index, "{\"mode\":\"attest\"}", true, "on_attest", &Cb::new(id))
    }

    #[private]
    pub fn on_attest(&mut self, #[serializer(borsh)] cb: Cb) -> bool {
        Self::end_flight(&mut self.escrow.attest_flight, cb.flight);
        let r = match crate::outlayer::read_out() {
            Out::Failed => {
                Self::refund_failed(&cb.payer, cb.deposit);
                self.escrow.last_error = Some("Attestation call failed".into());
                return false;
            }
            Out::Null => {
                self.escrow.last_error = Some("Attestation timed out, retry".into());
                return false;
            }
            Out::Res(r) => r,
        };
        let sha = r.key_sha256.unwrap_or_default().to_ascii_lowercase();
        let ok = r.ok == Some(true)
            && sha == self.cfg.key_commitment
            && r.artifact_ok == Some(true)
            && r.build_ok == Some(true);
        if !ok {
            self.escrow.last_error = Some("Attestation did not match".into());
            log_activity("attest", "mismatch", "key, artifact or build check failed");
            return false;
        }
        self.escrow.last_error = None;
        self.escrow.attested_at_ms = Some(Self::now());
        if !self.escrow.verified {
            self.escrow.verified = true;
            emit("escrow_verified", "");
        }
        true
    }
}
