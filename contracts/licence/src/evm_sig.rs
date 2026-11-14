//! The MPC signer's response, turned into an Ethereum-valid (r, s, yParity) and checked
//! against the payer address before a transaction is stored.
//!
//! Signer response (near/mpc 3.x): `{"scheme":"Secp256k1","big_r":{"affine_point":"<33 byte hex>"},
//! "s":{"scalar":"<32 byte hex>"},"recovery_id":0|1}`.

use near_sdk::{env, near, serde_json};

#[near(serializers=[json])]
struct Point {
    affine_point: String,
}

#[near(serializers=[json])]
struct Scalar {
    scalar: String,
}

#[near(serializers=[json])]
struct SigResp {
    big_r: Point,
    s: Scalar,
    recovery_id: u8,
}

pub struct Sig {
    pub r: [u8; 32],
    pub s: [u8; 32],
    pub y: u8,
}

/// secp256k1 group order n.
const N: [u8; 32] = [
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe, 0xba, 0xae, 0xdc, 0xe6, 0xaf, 0x48,
    0xa0, 0x3b, 0xbf, 0xd2, 0x5e, 0x8c, 0xd0, 0x36, 0x41, 0x41,
];

fn is_zero(a: &[u8; 32]) -> bool {
    a.iter().all(|b| *b == 0)
}

/// n - s, big-endian.
fn n_minus(s: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let mut borrow = 0i16;
    for i in (0..32).rev() {
        let mut d = N[i] as i16 - s[i] as i16 - borrow;
        borrow = if d < 0 { 1 } else { 0 };
        if d < 0 {
            d += 256;
        }
        out[i] = d as u8;
    }
    out
}

/// s > n/2 (compared as s > n - s, which avoids a shift).
fn is_high(s: &[u8; 32]) -> bool {
    *s > n_minus(s)
}

fn hex_fixed<const L: usize>(h: &str) -> Option<[u8; L]> {
    let v = hex::decode(h).ok()?;
    v.try_into().ok()
}

/// Parses the signer's JSON and applies low-s (EIP-2): a high s is replaced by n - s and the
/// parity flipped, which is the same signature in canonical form.
pub fn parse(bytes: &[u8]) -> Result<Sig, &'static str> {
    let r: SigResp = serde_json::from_slice(bytes).map_err(|_| "Signer reply was not a signature")?;
    let point: [u8; 33] = hex_fixed(&r.big_r.affine_point).ok_or("Signer reply has a bad R")?;
    let mut s: [u8; 32] = hex_fixed(&r.s.scalar).ok_or("Signer reply has a bad s")?;
    if r.recovery_id > 1 || !(point[0] == 2 || point[0] == 3) {
        return Err("Signer reply has an unusable recovery id");
    }
    let mut x = [0u8; 32];
    x.copy_from_slice(&point[1..]);
    if is_zero(&x) || is_zero(&s) || x >= N || s >= N {
        return Err("Signer reply is out of range");
    }
    let mut y = r.recovery_id;
    if is_high(&s) {
        s = n_minus(&s);
        y ^= 1;
    }
    Ok(Sig { r: x, s, y })
}

/// The Ethereum address that signed `hash`, or None if the signature does not recover.
pub fn recover_address(hash: &[u8; 32], sig: &Sig) -> Option<[u8; 20]> {
    let mut rs = [0u8; 64];
    rs[..32].copy_from_slice(&sig.r);
    rs[32..].copy_from_slice(&sig.s);
    let pubkey = env::ecrecover(hash, &rs, sig.y, true)?;
    let h = env::keccak256_array(&pubkey);
    let mut a = [0u8; 20];
    a.copy_from_slice(&h[12..]);
    Some(a)
}

/// "0x" + 40 hex chars to 20 bytes.
pub fn parse_address(a: &str) -> Option<[u8; 20]> {
    hex_fixed(a.strip_prefix("0x")?)
}
