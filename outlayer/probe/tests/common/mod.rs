//! Test helpers: deterministic keys, signed entries and a fake network.
#![allow(dead_code)]

use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use lastsave_probe::nep413::payload_hash;
use lastsave_probe::rpc::{HttpResp, Net};
use serde_json::{json, Value};
use std::cell::{Cell, RefCell};
use std::collections::HashSet;

pub const CONTRACT: &str = "lastsave-licence.testnet";
pub const BUILD: &str = "5f1d0c4b8a7e9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a29181716";
pub const FROM: u64 = 1_799_000_000_000;
pub const TO: u64 = 1_799_999_999_999;
pub const TS: u64 = 1_799_999_000_000;
pub const EXP: u64 = 1_800_000_000_000;

pub fn sk(fill: u8) -> SigningKey {
    SigningKey::from_bytes(&[fill; 32])
}

pub fn pk_str(k: &SigningKey) -> String {
    format!("ed25519:{}", bs58::encode(k.verifying_key().as_bytes()).into_string())
}

/// One session entry; every field can be bent by a test before `build`.
#[derive(Clone)]
pub struct E {
    pub account: String,
    pub acct_key: u8,
    pub sess_key: u8,
    pub receipt_key: u8,
    pub host: String,
    pub login_host: String,
    pub recipient: String,
    pub exp_ms: u64,
    pub ts_ms: u64,
    pub epoch: Option<u64>,
    pub nonce_hex: String,
    pub forge_login_sig: bool,
}

impl E {
    /// A valid official-mode entry for player number `n` (own account key and session key).
    pub fn new(name: &str, n: u8) -> E {
        E {
            account: format!("{name}.testnet"),
            acct_key: 0x40 + n,
            sess_key: 0x60 + n,
            receipt_key: 0x60 + n,
            host: "official".into(),
            login_host: "official".into(),
            recipient: CONTRACT.into(),
            exp_ms: EXP,
            ts_ms: TS,
            epoch: None,
            nonce_hex: format!("{:032x}", 0xabc0_0000u64 + n as u64),
            forge_login_sig: false,
        }
    }

    pub fn account_pk(&self) -> String {
        pk_str(&sk(self.acct_key))
    }

    pub fn build(&self) -> Value {
        let acct = sk(self.acct_key);
        let sess = sk(self.sess_key);
        let message = json!({
            "app": "ember-rift", "host": self.login_host,
            "session_pubkey": pk_str(&sess), "exp_ms": self.exp_ms
        })
        .to_string();
        let nonce = [7u8; 32];
        let hash = payload_hash(&message, &nonce, &self.recipient, None);
        let mut login_sig = acct.sign(&hash).to_bytes();
        if self.forge_login_sig {
            login_sig[0] ^= 0xff;
        }
        let epoch = self.epoch.map(|e| e.to_string()).unwrap_or_else(|| "-".into());
        let rmsg = format!(
            "lastsave-receipt:v1|{}|{}|{}|{}|{}",
            self.host, epoch, self.nonce_hex, self.ts_ms, self.account
        );
        let rsig = sk(self.receipt_key).sign(rmsg.as_bytes()).to_bytes();
        json!({
            "login": {
                "account_id": self.account, "public_key": pk_str(&acct),
                "signature": STANDARD.encode(login_sig), "message": message,
                "nonce": STANDARD.encode(nonce), "recipient": self.recipient
            },
            "receipt": {
                "host": self.host, "epoch": self.epoch, "nonce": self.nonce_hex,
                "ts_ms": self.ts_ms, "account_id": self.account,
                "signature": STANDARD.encode(rsig)
            }
        })
    }
}

pub fn input(mode: &str) -> String {
    input_with(mode, "official", None, None)
}

pub fn input_with(mode: &str, host: &str, epoch: Option<u64>, rpc: Option<Vec<&str>>) -> String {
    let mut v = json!({
        "mode": mode, "contract": CONTRACT, "endpoint": "https://game.example/",
        "host_id": host, "build_hash": BUILD, "nonce": "c0ffee11", "from_ms": FROM,
        "to_ms": TO, "epoch": epoch
    });
    if let Some(r) = rpc {
        v["rpc_urls"] = json!(r);
    }
    v.to_string()
}

pub fn attest_body(build: &str, nonce: &str, sessions: Vec<Value>) -> String {
    json!({"host_id": "official", "build_hash": build, "nonce": nonce,
           "now_ms": TS + 1000, "sessions": sessions})
    .to_string()
}

pub fn good_attest(sessions: Vec<Value>) -> String {
    attest_body(BUILD, "c0ffee11", sessions)
}

/// Fake network: one scripted `/attest` answer plus an on-chain world.
pub struct FakeNet {
    pub attest: Option<(u16, String)>,
    pub keys: HashSet<(String, String)>,
    pub licensed: HashSet<String>,
    pub down_urls: HashSet<String>,
    pub flaky_remaining: Cell<u32>,
    pub rpc_log: RefCell<Vec<String>>,
    pub urls_used: RefCell<Vec<String>>,
    pub sleeps: RefCell<Vec<u64>>,
    pub get_urls: RefCell<Vec<String>>,
}

impl FakeNet {
    pub fn new(attest: Option<(u16, String)>) -> FakeNet {
        FakeNet {
            attest,
            keys: HashSet::new(),
            licensed: HashSet::new(),
            down_urls: HashSet::new(),
            flaky_remaining: Cell::new(0),
            rpc_log: RefCell::new(vec![]),
            urls_used: RefCell::new(vec![]),
            sleeps: RefCell::new(vec![]),
            get_urls: RefCell::new(vec![]),
        }
    }

    /// Registers `e` as a real licence holder with a live access key.
    pub fn holder(mut self, e: &E) -> Self {
        self.keys.insert((e.account.clone(), e.account_pk()));
        self.licensed.insert(e.account.clone());
        self
    }

    pub fn calls(&self, method: &str) -> usize {
        self.rpc_log.borrow().iter().filter(|m| *m == method).count()
    }
}

fn ok(v: Value) -> Result<HttpResp, String> {
    Ok(HttpResp { status: 200, body: v.to_string().into_bytes() })
}

impl Net for FakeNet {
    fn get(&self, url: &str) -> Result<HttpResp, String> {
        self.get_urls.borrow_mut().push(url.to_string());
        match &self.attest {
            None => Err("connection refused".into()),
            Some((s, b)) => Ok(HttpResp { status: *s, body: b.clone().into_bytes() }),
        }
    }

    fn post_json(&self, url: &str, body: &[u8]) -> Result<HttpResp, String> {
        self.urls_used.borrow_mut().push(url.to_string());
        if self.down_urls.contains(url) {
            return Err("timeout".into());
        }
        if self.flaky_remaining.get() > 0 {
            self.flaky_remaining.set(self.flaky_remaining.get() - 1);
            return Ok(HttpResp { status: 429, body: b"rate limited".to_vec() });
        }
        let req: Value = serde_json::from_slice(body).map_err(|e| e.to_string())?;
        let p = &req["params"];
        let kind = p["request_type"].as_str().unwrap_or("").to_string();
        self.rpc_log.borrow_mut().push(kind.clone());
        assert_eq!(p["finality"], "final", "every read must use final finality");
        match kind.as_str() {
            "view_access_key" => {
                let a = p["account_id"].as_str().unwrap().to_string();
                let k = p["public_key"].as_str().unwrap().to_string();
                if self.keys.contains(&(a, k.clone())) {
                    ok(json!({"jsonrpc":"2.0","id":"x","result":{"nonce":3,"permission":"FullAccess","block_height":1,"block_hash":"h"}}))
                } else {
                    ok(json!({"jsonrpc":"2.0","id":"x","result":{"error":format!("access key {k} does not exist while viewing"),"logs":[],"block_height":1,"block_hash":"h"}}))
                }
            }
            "call_function" => {
                assert_eq!(p["account_id"], CONTRACT);
                assert_eq!(p["method_name"], "licence_of");
                let args = STANDARD.decode(p["args_base64"].as_str().unwrap()).unwrap();
                let a: Value = serde_json::from_slice(&args).unwrap();
                let acct = a["account_id"].as_str().unwrap();
                let out = if self.licensed.contains(acct) {
                    json!({"token_id":"1","owner_id":acct,"pot_share":"100","choice":null,"minted_at_ms":1,"post_death":false})
                } else {
                    Value::Null
                };
                let bytes: Vec<u8> = out.to_string().into_bytes();
                ok(json!({"jsonrpc":"2.0","id":"x","result":{"result":bytes,"logs":[],"block_height":1,"block_hash":"h"}}))
            }
            other => Err(format!("unexpected request_type {other}")),
        }
    }

    fn sleep_ms(&self, ms: u64) {
        self.sleeps.borrow_mut().push(ms);
    }

    fn elapsed_ms(&self) -> u64 {
        0
    }
}

pub fn run(inp: &str, net: &FakeNet) -> Value {
    let line = lastsave_probe::run(inp, net);
    assert!(line.len() < 900, "output must stay under 900 bytes, got {}", line.len());
    assert!(!line.contains('\n'));
    serde_json::from_str(&line).expect("output is one JSON object")
}

pub fn net_with(entries: &[&E], holders: &[&E]) -> FakeNet {
    let sessions = entries.iter().map(|e| e.build()).collect();
    let mut net = FakeNet::new(Some((200, good_attest(sessions))));
    for h in holders {
        net = net.holder(h);
    }
    net
}

pub fn reasons(out: &Value) -> Value {
    out["reasons"].clone()
}
