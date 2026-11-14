//! Test double for the MPC signer (`v1.signer-prod.testnet`, near/mpc 3.x).
//! Same request shape (`{"request":{"path","payload_v2":{"Ecdsa":hex32},"domain_id"}}`), same
//! minimum attachments (1 yocto, 15 Tgas) and the same reply
//! (`{"scheme":"Secp256k1","big_r":{"affine_point"},"s":{"scalar"},"recovery_id"}`), but signs
//! with one fixed throwaway test signer. Modes: ok | high_s (returns the equivalent high-s form) |
//! fail (panics, like a yield timeout) | garbage (a reply that is not a signature).

use k256::ecdsa::SigningKey;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, near, require, Gas, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockSigner {
    scalar: [u8; 32],
    mode: String,
    calls: Vec<String>,
}

#[near(serializers=[json])]
pub struct Req {
    path: String,
    payload_v2: Value,
    domain_id: u32,
}

const N_HEX: &str = "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";

fn n_minus(s: &[u8]) -> Vec<u8> {
    let n = hex::decode(N_HEX).unwrap();
    let mut out = vec![0u8; 32];
    let mut borrow = 0i32;
    for i in (0..32).rev() {
        let mut d = n[i] as i32 - s[i] as i32 - borrow;
        borrow = (d < 0) as i32;
        d += 256 * borrow;
        out[i] = d as u8;
    }
    out
}

#[near]
impl MockSigner {
    /// `signer_hex`: the 32-byte test signer every signature is made with.
    #[init]
    pub fn new(signer_hex: String) -> Self {
        let scalar: [u8; 32] = hex::decode(signer_hex).unwrap().try_into().unwrap();
        Self { scalar, mode: "ok".into(), calls: vec![] }
    }

    pub fn set_mode(&mut self, mode: String) {
        require!(["ok", "high_s", "fail", "garbage"].contains(&mode.as_str()), "bad mode");
        self.mode = mode;
    }

    /// 0x address of the test signer (what the licence's `evm_payout.address` must be).
    pub fn address(&self) -> String {
        let key = SigningKey::from_bytes((&self.scalar).into()).unwrap();
        let pt = key.verifying_key().to_encoded_point(false);
        let h = env::keccak256_array(&pt.as_bytes()[1..]);
        format!("0x{}", hex::encode(&h[12..]))
    }

    /// Recorded requests: `{predecessor, path, payload, domain_id, deposit, gas_tgas}`.
    pub fn calls(&self) -> Vec<String> {
        self.calls.clone()
    }

    #[payable]
    pub fn sign(&mut self, request: Req) -> Value {
        require!(env::attached_deposit().as_yoctonear() >= 1, "Attach at least 1 yoctoNEAR");
        require!(env::prepaid_gas() >= Gas::from_tgas(15), "Attach at least 15 Tgas");
        let payload = request.payload_v2["Ecdsa"].as_str().unwrap_or_else(|| env::panic_str("Payload is not Ecdsa"));
        let hash = hex::decode(payload).unwrap_or_else(|_| env::panic_str("Payload is not hex"));
        require!(hash.len() == 32 && request.domain_id == 0, "Bad payload or domain");
        self.calls.push(
            json!({ "predecessor": env::predecessor_account_id(), "path": request.path, "payload": payload,
                "domain_id": request.domain_id, "deposit": env::attached_deposit().as_yoctonear().to_string(),
                "gas_tgas": env::prepaid_gas().as_tgas() })
            .to_string(),
        );
        match self.mode.as_str() {
            "fail" => env::panic_str("MPC: request timed out"),
            "garbage" => return json!({ "scheme": "Secp256k1", "oops": true }),
            _ => {}
        }
        let key = SigningKey::from_bytes((&self.scalar).into()).unwrap();
        let (sig, rec) = key.sign_prehash_recoverable(&hash).unwrap_or_else(|_| env::panic_str("sign failed"));
        let (r, s) = (sig.r().to_bytes().to_vec(), sig.s().to_bytes().to_vec());
        let (s, recid) = if self.mode == "high_s" { (n_minus(&s), rec.to_byte() ^ 1) } else { (s, rec.to_byte()) };
        let prefix = if recid & 1 == 1 { "03" } else { "02" };
        serde_json::from_value(json!({
            "scheme": "Secp256k1",
            "big_r": { "affine_point": format!("{prefix}{}", hex::encode(&r)) },
            "s": { "scalar": hex::encode(&s) },
            "recovery_id": recid,
        }))
        .unwrap()
    }
}
