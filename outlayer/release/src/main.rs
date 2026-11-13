//! Last Save release program (WASI P2, runs inside an OutLayer TEE worker).
//!
//! The server key K is an OutLayer secret owned by the licence contract and
//! readable only by (a) a request the licence contract itself makes and
//! (b) this exact build (its SHA-256 is pinned in the secret's access rule).
//!
//! Modes (stdin JSON `{"mode": "..."}`):
//! - `attest`  : always allowed. Reads `release_info` from the contract, downloads
//!               the encrypted server artifact, checks its sha256, decrypts it with
//!               K and checks the plaintext build hash. Outputs sha256(K) and the
//!               two checks, so anyone can confirm, while the studio is alive, that
//!               the escrowed key really opens the committed build. K never leaves.
//! - `release` : reads `ls_status` of the calling contract and outputs K only if
//!               it reports `Dead`. Anything else refuses.
//!
//! The contract read is always NEAR_PREDECESSOR_ID (set by the worker from the
//! on-chain request), never a value from the input.

mod chain;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;

const SECRET_NAME: &str = "LASTSAVE_SERVER_KEY";

#[derive(Deserialize)]
struct Input {
    mode: String,
}

#[derive(Serialize, Default)]
struct Output {
    ok: bool,
    mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    key_sha256: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    artifact_ok: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    build_ok: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn main() {
    let out = run().unwrap_or_else(|(mode, error)| Output { ok: false, mode, error: Some(error), ..Default::default() });
    print!("{}", serde_json::to_string(&out).unwrap_or_else(|_| "{\"ok\":false}".into()));
}

fn run() -> Result<Output, (String, String)> {
    let mut raw = String::new();
    std::io::stdin().read_to_string(&mut raw).map_err(|e| ("unknown".into(), format!("stdin: {e}")))?;
    let input: Input = serde_json::from_str(&raw).map_err(|e| ("unknown".into(), format!("input: {e}")))?;
    let mode = input.mode.clone();
    let fail = |e: String| (mode.clone(), e);

    let key_hex = std::env::var(SECRET_NAME)
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| fail("escrowed key not available to this run".into()))?;
    let key = hex::decode(key_hex.trim()).map_err(|_| fail("escrowed key is not hex".into()))?;
    if key.len() != 32 {
        return Err(fail("escrowed key is not 32 bytes".into()));
    }
    let key_sha256 = hex::encode(Sha256::digest(&key));
    let contract = std::env::var("NEAR_PREDECESSOR_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| fail("no on-chain caller: this program only runs from the licence contract".into()))?;

    match mode.as_str() {
        "attest" => {
            let info: chain::ReleaseInfo = chain::view(&contract, "release_info").map_err(&fail)?;
            let check = chain::check_artifact(&info, &key);
            Ok(Output {
                ok: true,
                mode,
                key_sha256: Some(key_sha256),
                artifact_ok: Some(check.artifact_ok),
                build_ok: Some(check.build_ok),
                detail: Some(check.detail),
                ..Default::default()
            })
        }
        "release" => {
            let status: String = chain::view(&contract, "ls_status").map_err(&fail)?;
            if status != "Dead" {
                return Err(fail(format!("refused: {contract} reports status {status}, not Dead")));
            }
            Ok(Output {
                ok: true,
                mode,
                key: Some(hex::encode(&key)),
                key_sha256: Some(key_sha256),
                status: Some(status),
                ..Default::default()
            })
        }
        other => Err(fail(format!("unknown mode {other}"))),
    }
}
