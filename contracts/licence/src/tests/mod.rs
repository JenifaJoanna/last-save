//! Unit tests. Callbacks are driven directly with mocked promise results.

mod t_hosts;
mod t_liveness;
mod t_nft;
mod t_reports;
mod t_release;
mod t_sale;

use std::panic::{catch_unwind, AssertUnwindSafe};

use near_sdk::mock::{MockAction, Receipt};
use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
use near_sdk::{test_vm_config, testing_env, AccountId, NearToken, PromiseResult, RuntimeFeesConfig};

use crate::util::{sha256, Cb};
use crate::*;

pub const N: u128 = 1_000_000_000_000_000_000_000_000;
pub const MILLI: u128 = N / 1000;
pub const T0: u64 = 1_800_000_000_000;
pub const STUDIO: &str = "lastsave-studio.testnet";
pub const LICENCE: &str = "lastsave-licence.testnet";
pub const MIRA: &str = "lastsave-mira.testnet";
pub const KOFI: &str = "lastsave-kofi.testnet";
pub const YUNA: &str = "lastsave-yuna.testnet";
pub const DARIO: &str = "lastsave-dario.testnet";
pub const FANHOST: &str = "lastsave-fanhost.testnet";
pub const OTHERHOST: &str = "lastsave-otherhost.testnet";
pub const PRICE: u128 = 250 * MILLI;
pub const POT: u128 = 100 * MILLI;

pub fn acct(s: &str) -> AccountId {
    s.parse().unwrap()
}

pub fn key() -> [u8; 32] {
    [0x11; 32]
}

/// Sets the mocked chain: who calls, with what deposit, at what time (ms).
pub fn env_at(pred: &str, deposit: u128, t_ms: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(LICENCE))
        .predecessor_account_id(acct(pred))
        .signer_account_id(acct(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(100))
        .prepaid_gas(near_sdk::Gas::from_tgas(300))
        .block_timestamp(t_ms * 1_000_000);
    testing_env!(b.build());
}

pub enum R {
    Json(String),
    Null,
    Failed,
    Empty,
}

pub fn j(s: &str) -> R {
    R::Json(s.to_string())
}

/// Sets the chain up as the licence calling itself back with one promise result.
pub fn env_cb(t_ms: u64, r: R) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(LICENCE))
        .predecessor_account_id(acct(LICENCE))
        .signer_account_id(acct(MIRA))
        .account_balance(NearToken::from_near(100))
        .block_timestamp(t_ms * 1_000_000);
    let res = match r {
        R::Json(s) => PromiseResult::Successful(s.into_bytes()),
        R::Null => PromiseResult::Successful(b"null".to_vec()),
        R::Empty => PromiseResult::Successful(vec![]),
        R::Failed => PromiseResult::Failed,
    };
    testing_env!(b.build(), test_vm_config(), RuntimeFeesConfig::test(), Default::default(), vec![res]);
}

pub fn cb(flight: u64, payer: &str) -> Cb {
    Cb { flight, payer: acct(payer), deposit: 10 * MILLI, host: None, epoch: 0, token: 0 }
}

pub fn cfg() -> InitConfig {
    let h = |c: char| c.to_string().repeat(64);
    InitConfig {
        studio: acct(STUDIO),
        outlayer: acct("outlayer.testnet"),
        title: "Ember Rift".into(),
        game_id: "ember-rift".into(),
        media: "https://ember-rift.pages.dev/icon.png".into(),
        price: near_sdk::json_types::U128(PRICE),
        fund_bps: 4000,
        royalty_bps: 1000,
        release: Program { urls: vec!["https://example.test/release.wasm".into()], sha256: h('a') },
        probe: Program { urls: vec!["https://example.test/probe.wasm".into()], sha256: h('b') },
        key_commitment: hex::encode(sha256(&key())),
        artifact: Artifact { urls: vec!["https://example.test/server.bin".into()], sha256: h('c'), build_hash: h('d'), size: 1234 },
        official_endpoint: "https://ember-rift-official.pages.dev".into(),
        liveness: Liveness { probe_interval_ms: 20_000, fail_threshold: 3, receipt_window_ms: 180_000, report_window_ms: 120_000, quorum_bps: 5000 },
        pool: PoolCfg { epoch_ms: 120_000, pay_per_session: near_sdk::json_types::U128(10 * MILLI), epoch_cap: near_sdk::json_types::U128(50 * MILLI) },
    }
}

pub fn fresh() -> Licence {
    fresh_with(cfg())
}

pub fn fresh_with(c: InitConfig) -> Licence {
    env_at(STUDIO, 0, T0);
    Licence::new(c)
}

/// New contract with the key escrowed (sales open).
pub fn escrowed() -> Licence {
    let mut c = fresh();
    env_at(STUDIO, 50 * MILLI, T0);
    let _ = c.escrow_key("QUJDRA==".into());
    let id = c.escrow.flight.clone().unwrap().id;
    env_cb(T0, R::Empty);
    assert!(c.on_escrow(cb(id, STUDIO)));
    c
}

pub fn buy(c: &mut Licence, who: &str, t: u64) -> String {
    env_at(who, PRICE, t);
    c.buy_licence()
}

/// Escrowed contract with four holders: mira=1, kofi=2, yuna=3, dario=4, all bought at T0.
pub fn four() -> Licence {
    let mut c = escrowed();
    for w in [MIRA, KOFI, YUNA, DARIO] {
        buy(&mut c, w, T0);
    }
    c
}

pub const ALIVE: &str = r#"{"ok":true,"mode":"official","reachable":true,"build_ok":true,"verified":2,"rejected":0}"#;
pub const STUB: &str = r#"{"ok":true,"mode":"official","reachable":true,"build_ok":true,"verified":0,"rejected":0}"#;
pub const DOWN: &str = r#"{"ok":true,"mode":"official","reachable":false,"build_ok":false,"verified":0,"rejected":0}"#;
pub const RPC_DOWN: &str = r#"{"ok":false,"error":"rpc unavailable: timeout"}"#;

/// Runs one full probe_official round trip with the given OutLayer result.
pub fn probe(c: &mut Licence, t: u64, r: R) {
    env_at(MIRA, 10 * MILLI, t);
    let _ = c.probe_official(None);
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(t, r);
    c.on_probe(cb(id, MIRA));
}

pub fn release_ok() -> String {
    format!(r#"{{"ok":true,"mode":"release","key":"{}","key_sha256":"x","status":"Dead"}}"#, hex::encode(key()))
}

/// Kills the game through the studio and releases the key successfully.
pub fn dead_and_released(c: &mut Licence, t: u64) {
    env_at(STUDIO, 0, t);
    c.end_of_service();
    env_at(KOFI, 10 * MILLI, t);
    let _ = c.release(None);
    let id = c.release.flight.clone().unwrap().id;
    env_cb(t, R::Json(release_ok()));
    assert!(c.on_release(cb(id, KOFI)));
}

/// Panic message of a call that must be refused.
pub fn refused<F: FnOnce()>(f: F) -> String {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let r = catch_unwind(AssertUnwindSafe(f));
    std::panic::set_hook(prev);
    match r {
        Ok(_) => panic!("call was accepted but should have been refused"),
        Err(e) => e
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_default(),
    }
}

pub fn assert_refused<F: FnOnce()>(f: F, needle: &str) {
    let m = refused(f);
    assert!(m.contains(needle), "expected refusal containing {needle:?}, got {m:?}");
}

pub fn transfers() -> Vec<(String, u128)> {
    get_created_receipts()
        .iter()
        .flat_map(|r: &Receipt| {
            r.actions.iter().filter_map(move |a| match a {
                MockAction::Transfer { deposit, .. } => Some((r.receiver_id.to_string(), deposit.as_yoctonear())),
                _ => None,
            })
        })
        .collect()
}

/// (receiver, method, args as text) of every function call created.
pub fn calls() -> Vec<(String, String, String)> {
    get_created_receipts()
        .iter()
        .flat_map(|r: &Receipt| {
            r.actions.iter().filter_map(move |a| match a {
                MockAction::FunctionCallWeight { method_name, args, .. } => Some((
                    r.receiver_id.to_string(),
                    String::from_utf8_lossy(method_name).to_string(),
                    String::from_utf8_lossy(args).to_string(),
                )),
                _ => None,
            })
        })
        .collect()
}

pub fn logs_have(event: &str) -> bool {
    get_logs().iter().any(|l| l.contains(&format!("\"event\":\"{event}\"")))
}

pub fn info(c: &Licence, t: u64) -> Info {
    env_at(MIRA, 0, t);
    c.get_info()
}
