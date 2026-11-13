//! NEAR RPC views and artifact download/decrypt for the release program.
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use serde::Deserialize;
use sha2::{Digest, Sha256};

/// Primary then fallback; each retried with backoff (public testnet RPCs rate-limit).
const RPC_URLS: [&str; 2] = ["https://test.rpc.fastnear.com", "https://near-testnet.drpc.org"];
const ATTEMPTS_PER_RPC: u32 = 3;
const MAGIC: &[u8; 4] = b"LSV1";
const MAX_ARTIFACT_BYTES: usize = 48 * 1024 * 1024;

#[derive(Deserialize)]
pub struct ReleaseInfo {
    pub artifact_urls: Vec<String>,
    pub artifact_sha256: String,
    pub build_hash: String,
    pub key_commitment: String,
    pub status: String,
}

/// Calls a view method at final finality and decodes its JSON result.
pub fn view<T: for<'de> Deserialize<'de>>(contract: &str, method: &str) -> Result<T, String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0", "id": "lastsave-release", "method": "query",
        "params": { "request_type": "call_function", "finality": "final", "account_id": contract,
                    "method_name": method, "args_base64": "e30=" }
    })
    .to_string();
    let mut last_err = String::from("no RPC reachable");
    for url in RPC_URLS {
        for attempt in 0..ATTEMPTS_PER_RPC {
            match rpc_call(url, body.as_bytes()) {
                Ok(bytes) => return serde_json::from_slice(&bytes).map_err(|e| format!("{method} decode: {e}")),
                Err(e) => last_err = format!("{url}: {e}"),
            }
            std::thread::sleep(std::time::Duration::from_millis(400 << attempt));
        }
    }
    Err(last_err)
}

fn rpc_call(url: &str, body: &[u8]) -> Result<Vec<u8>, String> {
    let resp = wasi_http_client::Client::new()
        .post(url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .map_err(|e| format!("send: {e}"))?;
    let bytes = resp.body().map_err(|e| format!("body: {e}"))?;
    let v: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| format!("rpc json: {e}"))?;
    if let Some(err) = v.get("error") {
        return Err(format!("rpc error: {err}"));
    }
    let result = v.pointer("/result/result").and_then(|r| r.as_array()).ok_or("rpc: no result bytes")?;
    Ok(result.iter().map(|b| b.as_u64().unwrap_or(0) as u8).collect())
}

fn download(urls: &[String]) -> Result<Vec<u8>, String> {
    let mut last_err = String::from("no artifact URL");
    for url in urls {
        if !url.starts_with("https://") {
            continue;
        }
        let got = wasi_http_client::Client::new()
            .get(url)
            .send()
            .map_err(|e| format!("{url}: {e}"))
            .and_then(|r| {
                if r.status() != 200 {
                    return Err(format!("{url}: HTTP {}", r.status()));
                }
                r.body().map_err(|e| format!("{url}: {e}"))
            });
        match got {
            Ok(b) if b.len() <= MAX_ARTIFACT_BYTES => return Ok(b),
            Ok(_) => last_err = format!("{url}: artifact too large"),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

pub struct ArtifactCheck {
    pub artifact_ok: bool,
    pub build_ok: bool,
    pub detail: String,
}

/// Downloads the encrypted artifact, checks its sha256 against the contract's
/// commitment, decrypts it with K and checks sha256(plaintext) == build_hash.
pub fn check_artifact(info: &ReleaseInfo, key: &[u8]) -> ArtifactCheck {
    let fail = |artifact_ok, detail: String| ArtifactCheck { artifact_ok, build_ok: false, detail };
    let file = match download(&info.artifact_urls) {
        Ok(f) => f,
        Err(e) => return fail(false, e),
    };
    if hex::encode(Sha256::digest(&file)) != info.artifact_sha256.to_lowercase() {
        return fail(false, "artifact sha256 does not match the contract".into());
    }
    if file.len() < 4 + 12 + 16 || &file[..4] != MAGIC {
        return fail(true, "artifact is not LSV1".into());
    }
    let cipher = match Aes256Gcm::new_from_slice(key) {
        Ok(c) => c,
        Err(_) => return fail(true, "bad key length".into()),
    };
    let nonce = Nonce::from_slice(&file[4..16]);
    let plain = match cipher.decrypt(nonce, Payload { msg: &file[16..], aad: MAGIC }) {
        Ok(p) => p,
        Err(_) => return fail(true, "escrowed key does not open the artifact".into()),
    };
    let build_ok = hex::encode(Sha256::digest(&plain)) == info.build_hash.to_lowercase();
    ArtifactCheck { artifact_ok: true, build_ok, detail: if build_ok { "ok".into() } else { "build hash mismatch".into() } }
}
