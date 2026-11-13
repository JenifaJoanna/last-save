//! The canonical NEP-413 vector (docs/test-vector-nep413.json): hash, login and receipt.

mod common;

use base64::{engine::general_purpose::STANDARD, Engine};
use common::*;
use lastsave_probe::nep413::{
    login_signature_ok, parse_pubkey, payload_hash, receipt_message, receipt_signature_ok,
};
use lastsave_probe::wire::{Login, Receipt};
use serde_json::{json, Value};

const VECTOR: &str = include_str!("../../../docs/test-vector-nep413.json");
const NONCE: [u8; 32] = [7u8; 32];
const RECIPIENT: &str = "lastsave-licence.testnet";
const ACCOUNT: &str = "lastsave-mira.testnet";

fn vector() -> Value {
    serde_json::from_str(VECTOR).unwrap()
}

fn s(v: &Value, k: &str) -> String {
    v[k].as_str().unwrap().to_string()
}

fn login(v: &Value) -> Login {
    Login {
        account_id: ACCOUNT.into(),
        public_key: s(v, "account_pk"),
        signature: s(v, "login_signature_b64"),
        message: s(v, "message"),
        nonce: STANDARD.encode(NONCE),
        recipient: RECIPIENT.into(),
    }
}

fn receipt(v: &Value) -> Receipt {
    Receipt {
        host: "official".into(),
        epoch: None,
        nonce: "00112233445566778899aabbccddeeff".into(),
        ts_ms: 1_799_999_000_000,
        account_id: ACCOUNT.into(),
        signature: s(v, "receipt_signature_b64"),
    }
}

#[test]
fn payload_hash_matches_vector() {
    let v = vector();
    let h = payload_hash(&s(&v, "message"), &NONCE, RECIPIENT, None);
    let hex: String = h.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hex, s(&v, "payload_sha256"));
}

#[test]
fn login_signature_verifies() {
    let v = vector();
    assert!(parse_pubkey(&s(&v, "account_pk")).is_some());
    assert!(login_signature_ok(&login(&v)));
}

#[test]
fn login_signature_rejects_tampering() {
    let v = vector();
    let mut l = login(&v);
    l.recipient = "someone-else.testnet".into();
    assert!(!login_signature_ok(&l), "recipient is part of the signed payload");
    let mut l = login(&v);
    l.message = l.message.replace("1800000000000", "1900000000000");
    assert!(!login_signature_ok(&l), "message is part of the signed payload");
    let mut l = login(&v);
    l.nonce = STANDARD.encode([8u8; 32]);
    assert!(!login_signature_ok(&l), "nonce is part of the signed payload");
}

#[test]
fn receipt_message_and_signature_match_vector() {
    let v = vector();
    let r = receipt(&v);
    assert_eq!(receipt_message(&r), s(&v, "receipt_message"));
    assert!(receipt_signature_ok(&s(&v, "session_pk"), &r));
    let mut bad = receipt(&v);
    bad.ts_ms += 1;
    assert!(!receipt_signature_ok(&s(&v, "session_pk"), &bad));
}

#[test]
fn vector_entry_passes_the_whole_probe() {
    let v = vector();
    let l = login(&v);
    let r = receipt(&v);
    let entry = json!({"login": {
        "account_id": l.account_id, "public_key": l.public_key, "signature": l.signature,
        "message": l.message, "nonce": l.nonce, "recipient": l.recipient
    }, "receipt": {
        "host": r.host, "epoch": r.epoch, "nonce": r.nonce, "ts_ms": r.ts_ms,
        "account_id": r.account_id, "signature": r.signature
    }});
    let mut net = FakeNet::new(Some((200, good_attest(vec![entry]))));
    net.keys.insert((ACCOUNT.into(), s(&v, "account_pk")));
    net.licensed.insert(ACCOUNT.into());
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 1, "{out}");
    assert_eq!(out["sample"][0], ACCOUNT);
}
