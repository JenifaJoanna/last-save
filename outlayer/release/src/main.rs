//! Last Save release program (WASI P2, runs inside an OutLayer TEE worker).
//!
//! The server key K is an OutLayer secret owned by the licence contract and
//! readable only by (a) a request the licence contract itself makes and
//! (b) this exact build (its SHA-256 is pinned in the secret's access rule).
//!
//! Modes (stdin JSON `{"mode": "..."}`):
//! - `attest`  : always allowed. Outputs sha256(K) so anyone can check, while the
//!               studio is still alive, that the escrowed key matches the
//!               commitment stored on-chain. K itself never leaves.
//! - `release` : re-reads the calling contract's state over NEAR RPC and outputs
//!               K only if that contract reports `Dead`. Anything else refuses.
//!
//! The contract checked is NEAR_PREDECESSOR_ID (set by the worker from the
//! on-chain request), never a value from the input, so a caller cannot point
//! the check at some other contract that happens to say "Dead".

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;

const SECRET_NAME: &str = "LASTSAVE_SERVER_KEY";
/// Primary then fallback; each retried with backoff (public testnet RPCs rate-limit).
const RPC_URLS: [&str; 2] = [
    "https://test.rpc.fastnear.com",
    "https://near-testnet.drpc.org",
];
const ATTEMPTS_PER_RPC: u32 = 3;

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
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn main() {
    let out = run().unwrap_or_else(|(mode, error)| Output {
        ok: false,
        mode,
        error: Some(error),
        ..Default::default()
    });
    print!("{}", serde_json::to_string(&out).unwrap_or_else(|_| "{\"ok\":false}".into()));
}

fn run() -> Result<Output, (String, String)> {
    let mut raw = String::new();
    std::io::stdin()
        .read_to_string(&mut raw)
        .map_err(|e| ("unknown".into(), format!("stdin: {e}")))?;
    let input: Input = serde_json::from_str(&raw)
        .map_err(|e| ("unknown".into(), format!("input: {e}")))?;
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

    match mode.as_str() {
        "attest" => Ok(Output {
            ok: true,
            mode,
            key_sha256: Some(key_sha256),
            ..Default::default()
        }),
        "release" => {
            let contract = std::env::var("NEAR_PREDECESSOR_ID")
                .ok()
                .filter(|s| !s.is_empty())
                .ok_or_else(|| fail("no on-chain caller: release only runs from the licence contract".into()))?;
            let status = read_status(&contract).map_err(|e| fail(e))?;
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

/// Calls the view method `ls_status` on `contract` at final finality, trying
/// each RPC in turn. Returns the status string (e.g. "Alive", "Dead").
fn read_status(contract: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": "lastsave-release",
        "method": "query",
        "params": {
            "request_type": "call_function",
            "finality": "final",
            "account_id": contract,
            "method_name": "ls_status",
            "args_base64": "e30="
        }
    })
    .to_string();
    let mut last_err = String::from("no RPC reachable");
    for url in RPC_URLS {
        for attempt in 0..ATTEMPTS_PER_RPC {
            match rpc_view(url, body.as_bytes()) {
                Ok(s) => return Ok(s),
                Err(e) => last_err = format!("{url}: {e}"),
            }
            std::thread::sleep(std::time::Duration::from_millis(400 << attempt));
        }
    }
    Err(last_err)
}

fn rpc_view(url: &str, body: &[u8]) -> Result<String, String> {
    let resp = wasi_http_client::Client::new()
        .post(url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .map_err(|e| format!("send: {e}"))?;
    let bytes = resp.body().map_err(|e| format!("body: {e}"))?;
    let v: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|e| format!("rpc json: {e}"))?;
    if let Some(err) = v.get("error") {
        return Err(format!("rpc error: {err}"));
    }
    let result = v
        .pointer("/result/result")
        .and_then(|r| r.as_array())
        .ok_or("rpc: no result bytes")?;
    let raw: Vec<u8> = result
        .iter()
        .map(|b| b.as_u64().unwrap_or(0) as u8)
        .collect();
    let status: String =
        serde_json::from_slice(&raw).map_err(|e| format!("status decode: {e}"))?;
    Ok(status)
}
