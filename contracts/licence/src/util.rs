//! Small helpers that keep the wasm lean: JSON strings are assembled by hand
//! (serde_json::Value and json! pull in float formatting and a lot of code).

use near_sdk::borsh;
use near_sdk::serde::{Serialize, Serializer};
use near_sdk::{env, near, AccountId};

/// Quotes and escapes a string as a JSON string literal.
pub fn jstr(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2);
    o.push('"');
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            c if (c as u32) < 0x20 => o.push(' '),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

pub fn is_hex64(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

pub fn is_https(u: &str) -> bool {
    u.starts_with("https://")
        && u.len() > 8
        && u.len() <= 300
        && u.bytes().all(|b| b > 0x20 && b < 0x7f && b != b'"' && b != b'\\')
}

/// Context carried from a request into its callback (borsh, so no JSON struct code is needed).
#[near(serializers=[borsh])]
pub struct Cb {
    pub flight: u64,
    pub payer: AccountId,
    pub deposit: u128,
    pub host: Option<AccountId>,
    pub epoch: u64,
    pub token: u64,
}

impl Cb {
    pub fn new(flight: u64) -> Self {
        Cb { flight, payer: env::predecessor_account_id(), deposit: env::attached_deposit().as_yoctonear(), host: None, epoch: 0, token: 0 }
    }
    pub fn bytes(&self) -> Vec<u8> {
        borsh::to_vec(self).unwrap_or_default()
    }
}

/// sha256 through the host function (env::sha256 would link a software sha2 on wasm).
#[cfg(target_arch = "wasm32")]
pub fn sha256(data: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    unsafe {
        near_sys::sha256(data.len() as u64, data.as_ptr() as u64, 0);
        near_sys::read_register(0, out.as_mut_ptr() as u64);
    }
    out
}

#[cfg(not(target_arch = "wasm32"))]
pub fn sha256(data: &[u8]) -> [u8; 32] {
    env::sha256_array(data)
}

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn b64_encode(d: &[u8]) -> String {
    let mut o = String::with_capacity(d.len().div_ceil(3) * 4);
    for c in d.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= c.len() {
                o.push(B64[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                o.push('=');
            }
        }
    }
    o
}

/// Standard base64 with padding; None on any bad character or length.
pub fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let b = s.as_bytes();
    if b.len() % 4 != 0 {
        return None;
    }
    let mut o = Vec::with_capacity(b.len() / 4 * 3);
    for (ci, c) in b.chunks(4).enumerate() {
        let last = (ci + 1) * 4 == b.len();
        let pad = c.iter().rev().take_while(|x| **x == b'=').count();
        if pad > 2 || (pad > 0 && !last) {
            return None;
        }
        let mut n = 0u32;
        for (i, x) in c.iter().enumerate() {
            let v = if i >= 4 - pad { 0 } else { B64.iter().position(|y| y == x)? as u32 };
            n = n << 6 | v;
        }
        for i in 0..3 - pad {
            o.push((n >> (16 - 8 * i)) as u8);
        }
    }
    Some(o)
}

/// A JSON object serialised from ordered pairs (keeps BTreeMap code out of the wasm).
pub struct Pairs<V>(pub Vec<(AccountId, V)>);

impl<V: Serialize> Serialize for Pairs<V> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.collect_map(self.0.iter().map(|(k, v)| (k, v)))
    }
}
