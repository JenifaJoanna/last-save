//! RLP, the EIP-1559 payload and signature handling, against ethers-generated vectors
//! (tests/fixtures/gen-vectors.mjs). Every field is rebuilt here independently of the contract.

use near_sdk::env;
use near_sdk::serde_json::{self, Value};

use super::*;
use crate::evm_sig;
use crate::rlp::{self, Tx1559, EVM_CHAIN_ID};

pub struct Vector {
    pub name: String,
    pub tx: Tx1559,
    pub unsigned: Vec<u8>,
    pub payload: [u8; 32],
    pub r: [u8; 32],
    pub s: [u8; 32],
    pub y: u8,
    pub raw: Vec<u8>,
    pub tx_hash: [u8; 32],
}

fn h(v: &Value) -> Vec<u8> {
    hex::decode(v.as_str().unwrap().trim_start_matches("0x")).unwrap()
}

fn arr<const L: usize>(v: &Value) -> [u8; L] {
    h(v).try_into().unwrap()
}

pub fn raw_json() -> Value {
    serde_json::from_str(include_str!("../../tests/fixtures/evm-vectors.json")).unwrap()
}

pub fn signer_address() -> String {
    raw_json()["signer_address"].as_str().unwrap().to_string()
}

pub fn vectors() -> Vec<Vector> {
    raw_json()["vectors"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| Vector {
            name: v["name"].as_str().unwrap().into(),
            tx: Tx1559 {
                nonce: v["nonce"].as_u64().unwrap(),
                max_priority_fee: v["prio"].as_str().unwrap().parse().unwrap(),
                max_fee: v["fee"].as_str().unwrap().parse().unwrap(),
                gas_limit: v["gas"].as_u64().unwrap(),
                to: arr(&v["to"]),
                value: v["value"].as_str().unwrap().parse().unwrap(),
            },
            unsigned: h(&v["unsigned"]),
            payload: arr(&v["payload"]),
            r: arr(&v["r"]),
            s: arr(&v["s"]),
            y: v["y_parity"].as_u64().unwrap() as u8,
            raw: h(&v["raw"]),
            tx_hash: arr(&v["tx_hash"]),
        })
        .collect()
}

pub fn vector(name: &str) -> Vector {
    vectors().into_iter().find(|v| v.name == name).unwrap_or_else(|| panic!("no vector {name}"))
}

/// The MPC signer's JSON reply for a vector's signature.
pub fn sig_json(v: &Vector) -> String {
    format!(
        r#"{{"scheme":"Secp256k1","big_r":{{"affine_point":"02{}"}},"s":{{"scalar":"{}"}},"recovery_id":{}}}"#,
        hex::encode(v.r),
        hex::encode(v.s),
        v.y
    )
}

#[test]
fn rlp_matches_the_ethers_encoding_for_every_vector() {
    env_at(MIRA, 0, T0);
    for v in vectors() {
        assert_eq!(v.tx.unsigned(), v.unsigned, "unsigned encoding of {}", v.name);
        assert_eq!(v.tx.payload(), v.payload, "signing hash of {}", v.name);
        assert_eq!(v.tx.signed(v.y, &v.r, &v.s), v.raw, "signed raw tx of {}", v.name);
        assert_eq!(env::keccak256_array(&v.raw), v.tx_hash, "tx hash of {}", v.name);
    }
}

#[test]
fn vectors_cover_both_parities_and_a_short_r_or_s() {
    let vs = vectors();
    assert!(vs.iter().any(|v| v.y == 0) && vs.iter().any(|v| v.y == 1));
    assert!(vs.iter().any(|v| v.r[0] == 0 || v.s[0] == 0), "a vector with a leading zero byte in r or s");
}

#[test]
fn chain_id_is_the_constant_84532_in_the_encoded_payload() {
    assert_eq!(EVM_CHAIN_ID, 84532);
    for v in vectors() {
        let u = v.tx.unsigned();
        assert_eq!(u[0], 0x02, "EIP-1559 type byte");
        let list_header = if u[1] >= 0xf8 { 1 + (u[1] - 0xf7) as usize } else { 1 };
        let at = 1 + list_header;
        // 84532 = 0x014a34, RLP: 0x83 01 4a 34
        assert_eq!(&u[at..at + 4], &[0x83, 0x01, 0x4a, 0x34], "chainId bytes in {}", v.name);
    }
}

#[test]
fn rlp_primitives() {
    let enc = |f: &dyn Fn(&mut Vec<u8>)| {
        let mut o = vec![];
        f(&mut o);
        o
    };
    assert_eq!(enc(&|o| rlp::put_uint(o, 0)), vec![0x80]);
    assert_eq!(enc(&|o| rlp::put_uint(o, 0x7f)), vec![0x7f]);
    assert_eq!(enc(&|o| rlp::put_uint(o, 0x80)), vec![0x81, 0x80]);
    assert_eq!(enc(&|o| rlp::put_uint(o, 1024)), vec![0x82, 0x04, 0x00]);
    assert_eq!(enc(&|o| rlp::put_bytes(o, &[])), vec![0x80]);
    assert_eq!(enc(&|o| rlp::put_uint_be(o, &[0, 0, 5])), vec![0x05]);
    let long = vec![7u8; 60];
    let e = enc(&|o| rlp::put_bytes(o, &long));
    assert_eq!(&e[..2], &[0xb8, 60]);
    assert_eq!(rlp::list(&[]), vec![0xc0]);
    assert_eq!(&rlp::list(&long)[..2], &[0xf8, 60]);
}

#[test]
fn signature_parses_and_recovers_the_signer_address() {
    env_at(MIRA, 0, T0);
    let v = vector("small");
    let sig = evm_sig::parse(sig_json(&v).as_bytes()).unwrap();
    assert_eq!((sig.r, sig.s, sig.y), (v.r, v.s, v.y));
    let addr = evm_sig::recover_address(&v.payload, &sig).unwrap();
    assert_eq!(format!("0x{}", hex::encode(addr)), signer_address());
}

/// n - s, written independently of the contract.
fn flip(s: &[u8; 32]) -> [u8; 32] {
    let n = hex::decode("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141").unwrap();
    let mut out = [0u8; 32];
    let mut borrow = 0i32;
    for i in (0..32).rev() {
        let mut d = n[i] as i32 - s[i] as i32 - borrow;
        borrow = (d < 0) as i32;
        d += 256 * borrow;
        out[i] = d as u8;
    }
    out
}

#[test]
fn a_high_s_signature_is_normalised_to_the_same_transaction() {
    env_at(MIRA, 0, T0);
    for v in vectors() {
        let high = Vector { s: flip(&v.s), y: v.y ^ 1, ..vector(&v.name) };
        let sig = evm_sig::parse(sig_json(&high).as_bytes()).unwrap();
        assert_eq!((sig.s, sig.y), (v.s, v.y), "{}", v.name);
        assert_eq!(v.tx.signed(sig.y, &sig.r, &sig.s), v.raw);
    }
}

#[test]
fn bad_signer_replies_are_refused() {
    let v = vector("small");
    let good = sig_json(&v);
    for bad in [
        "null".to_string(),
        "{}".to_string(),
        good.replace("\"recovery_id\":1", "\"recovery_id\":2").replace("\"recovery_id\":0", "\"recovery_id\":2"),
        good.replace("\"02", "\"05"),
        good.replace(&hex::encode(v.s), &"00".repeat(32)),
        good.replace(&hex::encode(v.s), "abcd"),
        good.replace(&hex::encode(v.s), &"ff".repeat(32)),
    ] {
        assert!(evm_sig::parse(bad.as_bytes()).is_err(), "accepted {bad}");
    }
}

#[test]
fn address_parsing_is_strict() {
    assert!(evm_sig::parse_address("0x70997970c51812dc3a010c7d01b50e0d17dc79c8").is_some());
    assert!(evm_sig::parse_address("0x70997970C51812dc3A010C7d01b50e0d17dc79C8").is_some(), "checksum case is fine");
    for bad in ["70997970c51812dc3a010c7d01b50e0d17dc79c8", "0x70997970c51812dc3a010c7d01b50e0d17dc79c", "0x70997970c51812dc3a010c7d01b50e0d17dc79c8a", "0xzz997970c51812dc3a010c7d01b50e0d17dc79c8", ""] {
        assert!(evm_sig::parse_address(bad).is_none(), "{bad}");
    }
}
