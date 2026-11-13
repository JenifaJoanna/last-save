//! NEAR JSON-RPC reads (view_access_key, call_function licence_of) behind the `Net`
//! trait: primary then fallback, retry with backoff on 429/5xx/network errors.

use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;

pub struct HttpResp {
    pub status: u16,
    pub body: Vec<u8>,
}

/// The only I/O the probe needs. `Err` means a transport failure (timeout, DNS, refused).
pub trait Net {
    fn get(&self, url: &str) -> Result<HttpResp, String>;
    fn post_json(&self, url: &str, body: &[u8]) -> Result<HttpResp, String>;
    fn sleep_ms(&self, ms: u64);
    fn elapsed_ms(&self) -> u64;
}

const ATTEMPTS_PER_RPC: u32 = 3;
/// Failed attempts tolerated across the whole run before giving up (keeps a dead RPC
/// from eating the 60 s execution limit one account at a time).
const FAILURE_BUDGET: u32 = 10;

pub struct Rpc<'a> {
    net: &'a dyn Net,
    urls: Vec<String>,
    contract: String,
    failures: Cell<u32>,
    keys: RefCell<HashMap<(String, String), bool>>,
    licences: RefCell<HashMap<String, bool>>,
}

impl<'a> Rpc<'a> {
    pub fn new(net: &'a dyn Net, urls: Vec<String>, contract: &str) -> Self {
        Rpc {
            net,
            urls,
            contract: contract.to_string(),
            failures: Cell::new(0),
            keys: RefCell::new(HashMap::new()),
            licences: RefCell::new(HashMap::new()),
        }
    }

    /// POSTs `params` as a `query` call; `classify` turns a parsed response into an
    /// answer, or `None` when the response is not a definitive answer (retry).
    fn query<T>(&self, params: Value, classify: impl Fn(&Value) -> Option<T>) -> Result<T, String> {
        let body = json!({"jsonrpc": "2.0", "id": "lastsave-probe", "method": "query", "params": params})
            .to_string();
        let mut last = String::from("no RPC configured");
        for url in &self.urls {
            for attempt in 0..ATTEMPTS_PER_RPC {
                if self.failures.get() >= FAILURE_BUDGET {
                    return Err(format!("rpc unavailable: {last}"));
                }
                match self.net.post_json(url, body.as_bytes()) {
                    Err(e) => last = format!("{url}: {e}"),
                    Ok(r) if r.status == 429 || r.status >= 500 => last = format!("{url}: http {}", r.status),
                    Ok(r) if r.status != 200 => {
                        last = format!("{url}: http {}", r.status);
                        self.failures.set(self.failures.get() + 1);
                        break; // a 4xx will not improve with a retry; try the next RPC
                    }
                    Ok(r) => match serde_json::from_slice::<Value>(&r.body) {
                        Err(_) => last = format!("{url}: bad json"),
                        Ok(v) => match classify(&v) {
                            Some(t) => return Ok(t),
                            None => last = format!("{url}: unusable rpc answer"),
                        },
                    },
                }
                self.failures.set(self.failures.get() + 1);
                if attempt + 1 < ATTEMPTS_PER_RPC {
                    self.net.sleep_ms(400 << attempt);
                }
            }
        }
        Err(format!("rpc unavailable: {last}"))
    }

    /// Does `account_id` have access key `public_key` at final finality?
    pub fn key_exists(&self, account_id: &str, public_key: &str) -> Result<bool, String> {
        let cache_key = (account_id.to_string(), public_key.to_string());
        if let Some(v) = self.keys.borrow().get(&cache_key) {
            return Ok(*v);
        }
        let params = json!({
            "request_type": "view_access_key", "finality": "final",
            "account_id": account_id, "public_key": public_key
        });
        let exists = self.query(params, |v| {
            if v.pointer("/result/nonce").is_some() && v.pointer("/result/permission").is_some() {
                return Some(true);
            }
            let missing_msg = v
                .pointer("/result/error")
                .and_then(Value::as_str)
                .is_some_and(|e| e.contains("does not exist"));
            let cause = v.pointer("/error/cause/name").and_then(Value::as_str).unwrap_or("");
            if missing_msg || cause == "UNKNOWN_ACCESS_KEY" || cause == "UNKNOWN_ACCOUNT" {
                return Some(false);
            }
            None
        })?;
        self.keys.borrow_mut().insert(cache_key, exists);
        Ok(exists)
    }

    /// `contract.licence_of({account_id})` is non-null at final finality.
    pub fn has_licence(&self, account_id: &str) -> Result<bool, String> {
        if let Some(v) = self.licences.borrow().get(account_id) {
            return Ok(*v);
        }
        let args = json!({ "account_id": account_id }).to_string();
        let params = json!({
            "request_type": "call_function", "finality": "final",
            "account_id": self.contract, "method_name": "licence_of",
            "args_base64": STANDARD.encode(args.as_bytes())
        });
        let held = self.query(params, |v| {
            let bytes: Vec<u8> = v
                .pointer("/result/result")?
                .as_array()?
                .iter()
                .map(|b| b.as_u64().unwrap_or(0) as u8)
                .collect();
            let parsed: Value = serde_json::from_slice(&bytes).ok()?;
            Some(!parsed.is_null())
        })?;
        self.licences.borrow_mut().insert(account_id.to_string(), held);
        Ok(held)
    }
}
