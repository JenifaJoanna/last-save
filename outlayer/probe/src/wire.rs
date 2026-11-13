//! JSON shapes: the probe input, the `/attest` response and the probe output.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Default RPC endpoints (docs/INTERFACES.md section 1): primary then fallback.
pub const DEFAULT_RPC_URLS: [&str; 2] = [
    "https://test.rpc.fastnear.com",
    "https://near-testnet.drpc.org",
];
/// Hard cap on session entries inspected per probe (section 3).
pub const MAX_ENTRIES: usize = 64;
/// Output must stay under 900 bytes (OutLayer return limit used by the contract).
pub const MAX_OUTPUT_BYTES: usize = 890;

#[derive(Deserialize, Clone, Debug)]
pub struct Input {
    pub mode: String,
    pub contract: String,
    pub endpoint: String,
    pub host_id: String,
    pub build_hash: String,
    pub nonce: String,
    pub from_ms: u64,
    pub to_ms: u64,
    #[serde(default)]
    pub epoch: Option<u64>,
    /// Test seam only: the contract never sets this in production.
    #[serde(default)]
    pub rpc_urls: Option<Vec<String>>,
}

impl Input {
    pub fn parse(raw: &str) -> Result<Input, String> {
        let input: Input = serde_json::from_str(raw).map_err(|e| format!("input: {e}"))?;
        if input.mode != "official" && input.mode != "host" {
            return Err("input: mode must be official or host".into());
        }
        if input.contract.is_empty() || input.host_id.is_empty() || input.nonce.is_empty() {
            return Err("input: contract, host_id and nonce are required".into());
        }
        if !(input.endpoint.starts_with("https://") || input.endpoint.starts_with("http://")) {
            return Err("input: endpoint must be an http(s) URL".into());
        }
        if input.from_ms > input.to_ms {
            return Err("input: from_ms is after to_ms".into());
        }
        if input.mode == "host" && input.epoch.is_none() {
            return Err("input: host mode needs an epoch".into());
        }
        if input.rpc_urls.as_ref().is_some_and(|u| u.iter().any(|s| !s.starts_with("http"))) {
            return Err("input: rpc_urls must be http(s) URLs".into());
        }
        Ok(input)
    }

    pub fn rpc_urls(&self) -> Vec<String> {
        match &self.rpc_urls {
            Some(u) if !u.is_empty() => u.clone(),
            _ => DEFAULT_RPC_URLS.iter().map(|s| s.to_string()).collect(),
        }
    }
}

/// `GET /attest` response (section 4.4). Sessions stay raw so one malformed
/// entry is rejected on its own instead of failing the whole response.
#[derive(Deserialize)]
pub struct Attest {
    pub build_hash: String,
    pub nonce: String,
    pub sessions: Vec<Value>,
}

#[derive(Deserialize)]
pub struct Entry {
    pub login: Login,
    pub receipt: Receipt,
}

#[derive(Deserialize)]
pub struct Login {
    pub account_id: String,
    pub public_key: String,
    pub signature: String,
    pub message: String,
    pub nonce: String,
    pub recipient: String,
}

#[derive(Deserialize)]
pub struct Receipt {
    pub host: String,
    #[serde(default)]
    pub epoch: Option<u64>,
    pub nonce: String,
    pub ts_ms: u64,
    pub account_id: String,
    pub signature: String,
}

/// The signed content of `login.message` (section 4.2).
#[derive(Deserialize)]
pub struct LoginMessage {
    pub app: String,
    pub host: String,
    pub session_pubkey: String,
    pub exp_ms: u64,
}

#[derive(Serialize, Default, Clone, Debug, PartialEq)]
pub struct Reasons {
    pub sig: u32,
    pub key: u32,
    pub licence: u32,
    pub window: u32,
    pub host: u32,
    pub replay: u32,
}

#[derive(Serialize, Default, Debug)]
pub struct Output {
    pub ok: bool,
    pub mode: String,
    pub reachable: bool,
    pub build_ok: bool,
    pub verified: u32,
    pub rejected: u32,
    pub reasons: Reasons,
    pub sample: Vec<String>,
    /// Present (true) only when the time budget ran out before every entry was checked.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub truncated: bool,
}

/// One-line JSON, always under the size limit: the sample is dropped first if needed.
pub fn render(out: &mut Output) -> String {
    let mut s = serde_json::to_string(out).unwrap_or_else(|_| "{\"ok\":false}".into());
    if s.len() > MAX_OUTPUT_BYTES {
        out.sample.clear();
        s = serde_json::to_string(out).unwrap_or_else(|_| "{\"ok\":false}".into());
    }
    s
}

pub fn render_error(error: &str) -> String {
    let msg: String = error.chars().take(300).collect();
    serde_json::json!({ "ok": false, "error": msg }).to_string()
}
