//! NEP-413 login verification and session-receipt signatures (docs/INTERFACES.md 4.2, 4.3).
//! Pure functions, no I/O.

use crate::wire::{Login, Receipt};
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use sha2::{Digest, Sha256};

/// NEP-413 tag: 2^31 + 413.
pub const NEP413_TAG: u32 = 2_147_484_061;

pub fn parse_pubkey(s: &str) -> Option<[u8; 32]> {
    let b58 = s.strip_prefix("ed25519:")?;
    let bytes = bs58::decode(b58).into_vec().ok()?;
    bytes.try_into().ok()
}

fn put_str(buf: &mut Vec<u8>, s: &str) {
    buf.extend_from_slice(&(s.len() as u32).to_le_bytes());
    buf.extend_from_slice(s.as_bytes());
}

/// Borsh of `{message: String, nonce: [u8;32], recipient: String, callback_url: Option<String>}`
/// prefixed by the u32 tag, then SHA-256: the 32 bytes the wallet signs.
pub fn payload_hash(
    message: &str,
    nonce: &[u8; 32],
    recipient: &str,
    callback_url: Option<&str>,
) -> [u8; 32] {
    let mut buf = Vec::with_capacity(message.len() + recipient.len() + 64);
    buf.extend_from_slice(&NEP413_TAG.to_le_bytes());
    put_str(&mut buf, message);
    buf.extend_from_slice(nonce);
    put_str(&mut buf, recipient);
    match callback_url {
        None => buf.push(0),
        Some(u) => {
            buf.push(1);
            put_str(&mut buf, u);
        }
    }
    Sha256::digest(&buf).into()
}

fn verify(pk: &[u8; 32], msg: &[u8], sig_b64: &str) -> bool {
    let Ok(sig_bytes) = STANDARD.decode(sig_b64) else { return false };
    let Ok(sig_arr) = <[u8; 64]>::try_from(sig_bytes.as_slice()) else { return false };
    let Ok(vk) = VerifyingKey::from_bytes(pk) else { return false };
    vk.verify_strict(msg, &Signature::from_bytes(&sig_arr)).is_ok()
}

/// True iff `login.signature` is a valid ed25519 signature by `login.public_key`
/// over the NEP-413 payload hash (callback_url is always None for Last Save).
pub fn login_signature_ok(login: &Login) -> bool {
    let Some(pk) = parse_pubkey(&login.public_key) else { return false };
    let Ok(nonce_bytes) = STANDARD.decode(&login.nonce) else { return false };
    let Ok(nonce) = <[u8; 32]>::try_from(nonce_bytes.as_slice()) else { return false };
    let hash = payload_hash(&login.message, &nonce, &login.recipient, None);
    verify(&pk, &hash, &login.signature)
}

/// UTF-8 bytes `lastsave-receipt:v1|{host}|{epoch or "-"}|{nonce}|{ts_ms}|{account_id}`.
pub fn receipt_message(r: &Receipt) -> String {
    let epoch = r.epoch.map(|e| e.to_string()).unwrap_or_else(|| "-".into());
    format!(
        "lastsave-receipt:v1|{}|{}|{}|{}|{}",
        r.host, epoch, r.nonce, r.ts_ms, r.account_id
    )
}

pub fn receipt_signature_ok(session_pubkey: &str, r: &Receipt) -> bool {
    let Some(pk) = parse_pubkey(session_pubkey) else { return false };
    verify(&pk, receipt_message(r).as_bytes(), &r.signature)
}

/// Receipt fields are joined with `|`, so they must not contain it; the nonce is 16 hex bytes.
pub fn receipt_fields_wellformed(r: &Receipt) -> bool {
    let clean = |s: &str| !s.is_empty() && s.len() <= 64 && !s.contains('|');
    clean(&r.host)
        && clean(&r.account_id)
        && r.nonce.len() == 32
        && r.nonce.bytes().all(|b| b.is_ascii_hexdigit())
}
