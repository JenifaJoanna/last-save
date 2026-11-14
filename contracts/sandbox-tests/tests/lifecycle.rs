//! Full Last Save lifecycle on a local NEAR sandbox, against a mock OutLayer.
//!
//! Build the artifacts first (from the repo root):
//!   ./scripts/build-wasm.sh licence
//!   (cd contracts/mock-outlayer && cargo build --target wasm32-unknown-unknown --release)
//! Defaults to the wasm-opt output (lastsave_licence.opt.wasm), the exact file publish-global publishes.
//! Then: cd contracts/sandbox-tests && cargo test -- --nocapture

use std::path::PathBuf;
use std::time::Duration;

use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const MILLI: u128 = 1_000_000_000_000_000_000_000;
const PRICE: u128 = 250 * MILLI;
const POT: u128 = 100 * MILLI;
const EPOCH_MS: u64 = 5000;
const INTERVAL_MS: u64 = 1500;

fn wasm(rel: &str) -> Vec<u8> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(rel);
    std::fs::read(&p).unwrap_or_else(|e| panic!("missing {rel}: {e} (see the header of this file)"))
}

fn milli(n: u128) -> NearToken {
    NearToken::from_yoctonear(n * MILLI)
}

async fn bal(a: &Account) -> u128 {
    a.view_account().await.unwrap().balance.as_yoctonear()
}

async fn call(from: &Account, to: &Contract, m: &str, args: Value, dep: NearToken) -> anyhow::Result<Value> {
    let r = from.call(to.id(), m).args_json(args).deposit(dep).gas(Gas::from_tgas(300)).transact().await?;
    let r = r.into_result().map_err(|e| anyhow::anyhow!("{m} failed: {e}"))?;
    Ok(r.json::<Value>().unwrap_or(Value::Null))
}

async fn info(c: &Contract) -> Value {
    c.view("get_info").await.unwrap().json::<Value>().unwrap()
}

fn u(v: &Value) -> u128 {
    v.as_str().unwrap().parse().unwrap()
}

async fn set_out(mock: &Contract, owner: &Account, key: &str, out: &str) {
    call(owner, mock, "set_output", json!({ "key": key, "json": out }), NearToken::from_yoctonear(0)).await.unwrap();
}

#[tokio::test]
async fn full_lifecycle() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let mk = |n: &'static str, near: u128| {
        let root = root.clone();
        async move { root.create_subaccount(n).initial_balance(NearToken::from_near(near)).transact().await.unwrap().into_result().unwrap() }
    };
    let studio = mk("studio", 10).await;
    let (mira, kofi, yuna, dario, late) = (mk("mira", 10).await, mk("kofi", 10).await, mk("yuna", 10).await, mk("dario", 10).await, mk("late", 10).await);
    let (fanhost, otherhost) = (mk("fanhost", 10).await, mk("otherhost", 10).await);
    let outlayer_acc = mk("outlayer", 10).await;
    let licence_acc = mk("licence", 20).await;
    let mock = outlayer_acc.deploy(&wasm("../mock-outlayer/target/wasm32-unknown-unknown/release/mock_outlayer.wasm")).await?.into_result()?;
    mock.call("new").transact().await?.into_result()?;
    let lic = licence_acc.deploy(&wasm(&std::env::var("LICENCE_WASM").unwrap_or("../licence/target/near/lastsave_licence.opt.wasm".into()))).await?.into_result()?;

    let key = [0x11u8; 32];
    let commitment = hex::encode(Sha256::digest(key));
    let h = |c: char| c.to_string().repeat(64);
    let cfg = json!({
        "studio": studio.id(), "outlayer": mock.id(),
        "title": "Ember Rift", "game_id": "ember-rift", "media": "https://ember-rift.pages.dev/icon.png",
        "price": PRICE.to_string(), "fund_bps": 4000, "royalty_bps": 1000,
        "release": { "urls": ["https://example.test/release.wasm"], "sha256": h('a') },
        "probe": { "urls": ["https://example.test/probe.wasm"], "sha256": h('b') },
        "key_commitment": commitment,
        "artifact": { "urls": ["https://example.test/server.bin"], "sha256": h('c'), "build_hash": h('d'), "size": 1234 },
        "official_endpoint": "https://ember-rift-official.pages.dev",
        "liveness": { "probe_interval_ms": INTERVAL_MS, "fail_threshold": 3, "receipt_window_ms": 180000, "report_window_ms": 120000, "quorum_bps": 5000 },
        "pool": { "epoch_ms": EPOCH_MS, "pay_per_session": (10 * MILLI).to_string(), "epoch_cap": (50 * MILLI).to_string() },
    });
    call(&licence_acc, &lic, "new", json!({ "config": cfg }), NearToken::from_yoctonear(0)).await?;
    assert_eq!(info(&lic).await["status"], "Alive");

    // escrow: studio only, once; the mock records the store_secrets call
    assert!(call(&mira, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), milli(50)).await.is_err());
    call(&studio, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), milli(50)).await?;
    assert!(call(&studio, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), milli(50)).await.is_err());
    assert_eq!(info(&lic).await["escrowed"], true);
    let sc: Vec<String> = mock.view("secrets_calls").await?.json()?;
    assert_eq!(sc.len(), 1);
    assert!(sc[0].contains("\"profile\":\"escrow\"") && sc[0].contains(&licence_acc.id().to_string()));

    // attest
    set_out(&mock, &outlayer_acc, "attest", &json!({ "ok": true, "mode": "attest", "key_sha256": commitment, "artifact_ok": true, "build_ok": true }).to_string()).await;
    call(&mira, &lic, "attest", json!({}), milli(10)).await?;
    assert_eq!(info(&lic).await["escrow_verified"], true);

    // four buys: pot stays, studio gets the rest minus mint storage
    let studio_before = bal(&studio).await;
    assert!(call(&mira, &lic, "buy_licence", json!({}), milli(249)).await.is_err(), "wrong deposit");
    for p in [&mira, &kofi, &yuna, &dario] {
        call(p, &lic, "buy_licence", json!({}), NearToken::from_yoctonear(PRICE)).await?;
    }
    let gained = bal(&studio).await - studio_before;
    assert!(gained > 4 * 140 * MILLI && gained <= 4 * 150 * MILLI, "studio gained {gained}");
    let i = info(&lic).await;
    assert_eq!((u(&i["totals"]["pot_locked"]), i["totals"]["supply"].as_u64()), (4 * POT, Some(4)));
    let tok: Value = lic.view("get_token").args_json(json!({ "token_id": "3" })).await?.json()?;
    assert_eq!((tok["owner_id"].as_str().unwrap(), u(&tok["pot_share"])), (yuna.id().as_str(), POT));

    // snapshot
    let blob = "e30="; // {}
    let hash = hex::encode(Sha256::digest(b"{}"));
    assert!(call(&mira, &lic, "post_snapshot", json!({ "seq": 1, "hash": hash, "blob_base64": blob }), NearToken::from_yoctonear(0)).await.is_err());
    call(&studio, &lic, "post_snapshot", json!({ "seq": 1, "hash": hash, "blob_base64": blob }), NearToken::from_yoctonear(0)).await?;
    let snap: Value = lic.view("get_snapshot").await?.json()?;
    assert_eq!((snap["seq"].as_u64(), snap["blob_base64"].as_str()), (Some(1), Some(blob)));

    // a passing probe, then three failing probes spaced by the interval: Dead
    set_out(&mock, &outlayer_acc, "official", r#"{"ok":true,"reachable":true,"build_ok":true,"verified":2}"#).await;
    call(&mira, &lic, "probe_official", json!({}), milli(10)).await?;
    assert_eq!(info(&lic).await["probe"]["consecutive_failures"], 0);
    set_out(&mock, &outlayer_acc, "official", r#"{"ok":true,"reachable":true,"build_ok":true,"verified":0}"#).await;
    for k in 0..3 {
        tokio::time::sleep(Duration::from_millis(INTERVAL_MS + 300)).await;
        call(&mira, &lic, "probe_official", json!({}), milli(10)).await?;
        assert_eq!(info(&lic).await["probe"]["consecutive_failures"], k + 1);
    }
    let i = info(&lic).await;
    assert_eq!((i["status"].as_str(), i["cause"].as_str()), (Some("Dead"), Some("probes")));
    let before = mock.view("exec_calls").await?.json::<Vec<String>>()?.len();
    assert!(call(&mira, &lic, "probe_official", json!({}), milli(10)).await.is_err(), "no probes after death");
    assert_eq!(mock.view("exec_calls").await?.json::<Vec<String>>()?.len(), before, "death itself never calls OutLayer");

    // release: first run times out (null), retry works
    assert!(call(&mira, &lic, "release", json!({}), milli(10)).await.is_ok());
    assert_eq!(info(&lic).await["release"]["released"], false);
    set_out(&mock, &outlayer_acc, "release", &json!({ "ok": true, "mode": "release", "key": hex::encode(key), "key_sha256": commitment, "status": "Dead" }).to_string()).await;
    call(&yuna, &lic, "release", json!({}), milli(10)).await?;
    let i = info(&lic).await;
    assert_eq!(i["released_key"].as_str(), Some(hex::encode(key).as_str()));
    let ex: Vec<String> = mock.view("exec_calls").await?.json()?;
    assert!(ex.iter().any(|e| e.contains("\"mode\":\"release\"") && e.contains("\"secrets\":true")));

    // refunds x2, pledges x2; double choice refused
    let (mira_b, kofi_b) = (bal(&mira).await, bal(&kofi).await);
    call(&mira, &lic, "choose", json!({ "token_id": "1", "choice": "Refund" }), NearToken::from_yoctonear(0)).await?;
    call(&kofi, &lic, "choose", json!({ "token_id": "2", "choice": "Refund" }), NearToken::from_yoctonear(0)).await?;
    let (mira_a, kofi_a) = (bal(&mira).await, bal(&kofi).await);
    assert!(mira_a + 40 * MILLI > mira_b + POT && kofi_a + 40 * MILLI > kofi_b + POT && mira_a > mira_b + 50 * MILLI, "refund balances: mira {mira_b} -> {mira_a}, kofi {kofi_b} -> {kofi_a}");
    assert!(call(&mira, &lic, "choose", json!({ "token_id": "1", "choice": "Refund" }), NearToken::from_yoctonear(0)).await.is_err());
    call(&yuna, &lic, "choose", json!({ "token_id": "3", "choice": "Pledge" }), NearToken::from_yoctonear(0)).await?;
    call(&dario, &lic, "choose", json!({ "token_id": "4", "choice": "Pledge" }), NearToken::from_yoctonear(0)).await?;
    let t = info(&lic).await["totals"].clone();
    assert_eq!((u(&t["refunded"]), u(&t["pledged"]), u(&t["pot_locked"]), u(&t["pool"])), (2 * POT, 2 * POT, 0, 2 * POT));

    // buy after death: whole price into the pool, no pot share, cannot choose
    call(&late, &lic, "buy_licence", json!({}), NearToken::from_yoctonear(PRICE)).await?;
    let t = info(&lic).await["totals"].clone();
    // 90% of the net price feeds the pool, 10% the ops budget
    let (pool, ops) = (u(&t["pool"]), u(&t["ops_budget"]));
    assert!(pool + ops > 2 * POT + PRICE - 10 * MILLI && pool + ops <= 2 * POT + PRICE && ops > 20 * MILLI, "pool {pool} ops {ops}");
    let late_tok: Value = lic.view("get_token").args_json(json!({ "token_id": "5" })).await?.json()?;
    assert_eq!((late_tok["post_death"].clone(), u(&late_tok["pot_share"])), (json!(true), 0));
    assert!(call(&late, &lic, "choose", json!({ "token_id": "5", "choice": "Refund" }), NearToken::from_yoctonear(0)).await.is_err());

    // hosts: register, wait for epoch 0 to finish, claim by their own verified counts
    for (a, n) in [(&fanhost, "one"), (&otherhost, "two")] {
        call(a, &lic, "register_host", json!({ "endpoint": format!("https://{n}.trycloudflare.com"), "host_pubkey": "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h" }), milli(10)).await?;
    }
    assert!(call(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), milli(10)).await.is_err(), "epoch 0 not complete yet");
    let released_at = info(&lic).await["released_at_ms"].as_u64().unwrap();
    let now_ms = || std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    let wait = (released_at + EPOCH_MS + 1500).saturating_sub(now_ms());
    tokio::time::sleep(Duration::from_millis(wait)).await;
    let host_json = |v: u32| format!(r#"{{"ok":true,"mode":"host","reachable":true,"build_ok":true,"verified":{v}}}"#);
    set_out(&mock, &outlayer_acc, &format!("host:{}", fanhost.id()), &host_json(3)).await;
    set_out(&mock, &outlayer_acc, &format!("host:{}", otherhost.id()), &host_json(1)).await;
    let (fb, ob) = (bal(&fanhost).await, bal(&otherhost).await);
    call(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), milli(10)).await?;
    call(&otherhost, &lic, "claim_epoch", json!({ "epoch": 0 }), milli(10)).await?;
    println!("host balance change (net of gas): fanhost {} otherhost {}", bal(&fanhost).await as i128 - fb as i128, bal(&otherhost).await as i128 - ob as i128);
    let hosts: Vec<Value> = lic.view("get_hosts").await?.json()?;
    let earned: Vec<u128> = hosts.iter().map(|h| u(&h["earned"])).collect();
    assert_eq!(earned, vec![30 * MILLI, 10 * MILLI]);
    assert!(call(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), milli(10)).await.is_err(), "no double pay");
    let claims: Vec<Value> = lic.view("get_claims").args_json(json!({ "from_index": 0, "limit": 10 })).await?.json()?;
    assert_eq!(claims.len(), 2);
    assert_eq!(u(&info(&lic).await["totals"]["paid_out"]), 40 * MILLI);

    // royalty: transfer with payout; the studio's cut is 10%
    let payout = lic.view("nft_payout").args_json(json!({ "token_id": "2", "balance": (10 * MILLI * 100).to_string(), "max_len_payout": 5 })).await?.json::<Value>()?;
    let p = payout["payout"].as_object().unwrap();
    assert_eq!(u(&p[studio.id().as_str()]), 100 * MILLI);
    assert_eq!(u(&p[kofi.id().as_str()]), 900 * MILLI);
    let r = kofi.call(lic.id(), "nft_transfer_payout")
        .args_json(json!({ "receiver_id": late.id(), "token_id": "2", "balance": (1000 * MILLI).to_string(), "max_len_payout": 5 }))
        .deposit(NearToken::from_yoctonear(1)).gas(Gas::from_tgas(100)).transact().await?.into_result()?;
    let rp = r.json::<Value>()?;
    assert_eq!(u(&rp["payout"][studio.id().as_str()]), 100 * MILLI);
    let tok: Value = lic.view("nft_token").args_json(json!({ "token_id": "2" })).await?.json()?;
    assert_eq!(tok["owner_id"].as_str(), Some(late.id().as_str()));
    println!("lifecycle ok");
    Ok(())
}
