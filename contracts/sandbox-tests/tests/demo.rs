//! `pnpm demo:fresh` (default, no testnet funds): the whole Last Save lifecycle on a local NEAR sandbox, narrated step by step.
//! Real licence wasm (the published one), mock OutLayer (canned enclave outputs), mock MPC signer (real ecrecover, real receipts and gas).
//! Output lines starting with `STEP` are parsed by scripts/demo/sandbox.mjs. Build first: see the header of lifecycle.rs and evm_lifecycle.rs.
//! Run directly: cd contracts/sandbox-tests && cargo test --test demo -- --nocapture

use std::path::PathBuf;
use std::time::Duration;

use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sha3::Keccak256;

const MILLI: u128 = 1_000_000_000_000_000_000_000;
const PRICE: u128 = 250 * MILLI;
const POT: u128 = 100 * MILLI;
const EPOCH_MS: u64 = 5000;
const INTERVAL_MS: u64 = 1500;
const WEI: u128 = 10_000_000_000_000;
const ZERO: NearToken = NearToken::from_yoctonear(0);
const TOTAL: u32 = 16;

fn wasm(rel: &str) -> Vec<u8> {
    std::fs::read(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(rel)).unwrap_or_else(|e| panic!("missing {rel}: {e} (build the wasm first, see lifecycle.rs)"))
}
fn milli(n: u128) -> NearToken { NearToken::from_yoctonear(n * MILLI) }
fn u(v: &Value) -> u128 { v.as_str().unwrap().parse().unwrap() }
fn n(x: u128) -> String { format!("{:.3} N", x as f64 / 1e24) }
async fn bal(a: &Account) -> u128 { a.view_account().await.unwrap().balance.as_yoctonear() }
async fn info(c: &Contract) -> Value { c.view("get_info").await.unwrap().json().unwrap() }
async fn call(from: &Account, to: &Contract, m: &str, args: Value, dep: NearToken) -> anyhow::Result<Value> {
    let r = from.call(to.id(), m).args_json(args).deposit(dep).gas(Gas::from_tgas(250)).transact().await?;
    Ok(r.into_result().map_err(|e| anyhow::anyhow!("{m} failed: {e}"))?.json::<Value>().unwrap_or(Value::Null))
}
async fn refused(from: &Account, to: &Contract, m: &str, args: Value, dep: NearToken) -> bool { call(from, to, m, args, dep).await.is_err() }
async fn set_out(mock: &Contract, owner: &Account, key: &str, out: &str) { call(owner, mock, "set_output", json!({ "key": key, "json": out }), ZERO).await.unwrap(); }
fn step(i: u32, title: &str) { println!("STEP {i}/{TOTAL}  {title}"); }
fn note(s: &str) { println!("         {s}"); }

#[tokio::test]
async fn demo_lifecycle() -> anyhow::Result<()> {
    let started = std::time::Instant::now();
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let mk = |name: &'static str, near: u128| { let root = root.clone(); async move { root.create_subaccount(name).initial_balance(NearToken::from_near(near)).transact().await.unwrap().into_result().unwrap() } };
    let studio = mk("studio", 10).await;
    let (mira, kofi, yuna, dario, late) = (mk("mira", 10).await, mk("kofi", 10).await, mk("yuna", 10).await, mk("dario", 10).await, mk("late", 10).await);
    let (fanhost, otherhost, relayer) = (mk("fanhost", 10).await, mk("otherhost", 10).await, mk("relayer", 10).await);
    let (outlayer_acc, signer_acc, licence_acc) = (mk("outlayer", 10).await, mk("signer", 10).await, mk("licence", 20).await);
    let mock = outlayer_acc.deploy(&wasm("../mock-outlayer/target/wasm32-unknown-unknown/release/mock_outlayer.wasm")).await?.into_result()?;
    mock.call("new").transact().await?.into_result()?;
    let signer = signer_acc.deploy(&wasm("../mock-signer/target/wasm32-unknown-unknown/release/mock_signer.wasm")).await?.into_result()?;
    signer.call("new").args_json(json!({ "signer_hex": hex::encode(Keccak256::digest(b"lastsave-test-signer-v1")) })).transact().await?.into_result()?;
    let payer: String = signer.view("address").await?.json()?;
    let code = wasm(&std::env::var("LICENCE_WASM").unwrap_or("../licence/target/near/lastsave_licence.opt.wasm".into()));
    let code_sha = hex::encode(Sha256::digest(&code));
    let lic = licence_acc.deploy(&code).await?.into_result()?;

    let key = [0x11u8; 32];
    let commitment = hex::encode(Sha256::digest(key));
    let h = |c: char| c.to_string().repeat(64);
    let cfg = json!({
        "studio": studio.id(), "outlayer": mock.id(), "title": "Ember Rift", "game_id": "ember-rift", "media": "https://ember-rift.pages.dev/icon.png",
        "price": PRICE.to_string(), "fund_bps": 4000, "royalty_bps": 1000,
        "release": { "urls": ["https://example.test/release.wasm"], "sha256": h('a') }, "probe": { "urls": ["https://example.test/probe.wasm"], "sha256": h('b') },
        "key_commitment": commitment, "artifact": { "urls": ["https://example.test/server.bin"], "sha256": h('c'), "build_hash": h('d'), "size": 1234 },
        "official_endpoint": "https://ember-rift-official.pages.dev",
        "liveness": { "probe_interval_ms": INTERVAL_MS, "fail_threshold": 3, "receipt_window_ms": 180000, "report_window_ms": 120000, "quorum_bps": 5000 },
        "pool": { "epoch_ms": EPOCH_MS, "pay_per_session": (10 * MILLI).to_string(), "epoch_cap": (50 * MILLI).to_string() },
        "evm_payout": { "mpc": signer.id(), "path": "lastsave/host-payouts", "address": payer, "demo_wei_per_session": WEI.to_string(),
            "max_fee_per_gas": "2000000000", "max_priority_fee_per_gas": "1000000", "max_fee_cap": "10000000000", "gas_limit": 21000 },
    });

    step(1, "deploy the real licence wasm and initialise it (demo timers: probe 1.5 s, epoch 5 s)");
    call(&licence_acc, &lic, "new", json!({ "config": cfg }), ZERO).await?;
    note(&format!("code sha256 {}…, status {}, Chain Signatures payer {payer}", &code_sha[..12], info(&lic).await["status"]));

    step(2, "escrow the server key: studio only, once; the mock keystore records the access rule");
    assert!(refused(&mira, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), milli(50)).await, "non-studio escrow");
    call(&studio, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), milli(50)).await?;
    assert!(refused(&studio, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), milli(50)).await, "second escrow");
    let sc: Vec<String> = mock.view("secrets_calls").await?.json()?;
    assert!(sc[0].contains("\"profile\":\"escrow\"") && sc[0].contains(&licence_acc.id().to_string()));
    note("mira could not escrow, the studio could once, a second escrow was refused; store_secrets targets profile \"escrow\"");

    step(3, "attest: the enclave (mock) confirms key commitment, artifact hash and build hash");
    set_out(&mock, &outlayer_acc, "attest", &json!({ "ok": true, "mode": "attest", "key_sha256": commitment, "artifact_ok": true, "build_ok": true }).to_string()).await;
    call(&mira, &lic, "attest", json!({}), milli(10)).await?;
    assert_eq!(info(&lic).await["escrow_verified"], true);
    note("escrow_verified = true");

    step(4, "four holders buy: exact price only, 40% locked as each token's pot share, the rest to the studio");
    assert!(refused(&mira, &lic, "buy_licence", json!({}), milli(249)).await, "wrong deposit");
    for p in [&mira, &kofi, &yuna, &dario] { call(p, &lic, "buy_licence", json!({}), NearToken::from_yoctonear(PRICE)).await?; }
    let t = info(&lic).await["totals"].clone();
    assert_eq!(u(&t["pot_locked"]), 4 * POT);
    note(&format!("4 tokens, pot locked {}, a 0.249 N buy was refused", n(u(&t["pot_locked"]))));

    step(5, "the official server posts a hashed progress snapshot (studio only)");
    let hash = hex::encode(Sha256::digest(b"{}"));
    assert!(refused(&mira, &lic, "post_snapshot", json!({ "seq": 1, "hash": hash, "blob_base64": "e30=" }), ZERO).await);
    call(&studio, &lic, "post_snapshot", json!({ "seq": 1, "hash": hash, "blob_base64": "e30=" }), ZERO).await?;
    note(&format!("snapshot #1 stored, hash {}…", &hash[..12]));

    step(6, "gas-free actions: an empty ops budget refuses; fund_ops opens it; a relayer account (no deposit) triggers a probe");
    assert!(refused(&relayer, &lic, "probe_official", json!({}), ZERO).await, "empty ops budget");
    call(&studio, &lic, "fund_ops", json!({}), NearToken::from_near(1)).await?;
    set_out(&mock, &outlayer_acc, "official", r#"{"ok":true,"reachable":true,"build_ok":true,"verified":2}"#).await;
    call(&relayer, &lic, "probe_official", json!({}), ZERO).await?;
    let ex: Vec<Value> = mock.view("exec_calls").await?.json::<Vec<String>>()?.iter().map(|s| serde_json::from_str(s).unwrap()).collect();
    assert_eq!(ex.last().unwrap()["payer"].as_str(), Some(lic.id().as_str()));
    note(&format!("the contract paid OutLayer from its ops budget (now {}); the caller attached nothing", n(u(&info(&lic).await["totals"]["ops_budget"]))));

    step(7, "three failing probes spaced by the interval (official server unreachable): the contract dies");
    set_out(&mock, &outlayer_acc, "official", r#"{"ok":true,"reachable":false,"build_ok":false,"verified":0}"#).await;
    for k in 0..3 {
        tokio::time::sleep(Duration::from_millis(INTERVAL_MS + 400)).await;
        call(&relayer, &lic, "probe_official", json!({}), ZERO).await?;
        note(&format!("failure {} counted", k + 1));
    }
    let i = info(&lic).await;
    assert_eq!((i["status"].as_str(), i["cause"].as_str()), (Some("Dead"), Some("probes")));
    note("status Dead, cause probes; further probes are refused and OutLayer is not called");

    step(8, "release: only after death; the key is stored publicly only if sha256(key) = the commitment");
    set_out(&mock, &outlayer_acc, "release", &json!({ "ok": true, "mode": "release", "key": hex::encode(key), "key_sha256": commitment, "status": "Dead" }).to_string()).await;
    call(&relayer, &lic, "release", json!({}), ZERO).await?;
    assert_eq!(info(&lic).await["released_key"].as_str(), Some(hex::encode(key).as_str()));
    note(&format!("released key {}… hashes to the commitment", &hex::encode(key)[..12]));

    step(9, "afterlife: two refunds, two pledges; a second choice is refused");
    let (mb, kb) = (bal(&mira).await, bal(&kofi).await);
    call(&mira, &lic, "choose", json!({ "token_id": "1", "choice": "Refund" }), ZERO).await?;
    call(&kofi, &lic, "choose", json!({ "token_id": "2", "choice": "Refund" }), ZERO).await?;
    assert!(bal(&mira).await + 40 * MILLI > mb + POT && bal(&kofi).await + 40 * MILLI > kb + POT);
    assert!(refused(&mira, &lic, "choose", json!({ "token_id": "1", "choice": "Pledge" }), ZERO).await);
    call(&yuna, &lic, "choose", json!({ "token_id": "3", "choice": "Pledge" }), ZERO).await?;
    call(&dario, &lic, "choose", json!({ "token_id": "4", "choice": "Pledge" }), ZERO).await?;
    let t = info(&lic).await["totals"].clone();
    assert_eq!((u(&t["refunded"]), u(&t["pledged"]), u(&t["pot_locked"])), (2 * POT, 2 * POT, 0));
    note(&format!("refunded {}, pledged {}, pool {}", n(u(&t["refunded"])), n(u(&t["pledged"])), n(u(&t["pool"]))));

    step(10, "a sale after death: no pot share, the price feeds the pool (90%) and the ops budget (10%)");
    call(&late, &lic, "buy_licence", json!({}), NearToken::from_yoctonear(PRICE)).await?;
    let tok: Value = lic.view("get_token").args_json(json!({ "token_id": "5" })).await?.json()?;
    assert_eq!((tok["post_death"].clone(), u(&tok["pot_share"])), (json!(true), 0));
    assert!(refused(&late, &lic, "choose", json!({ "token_id": "5", "choice": "Refund" }), ZERO).await);
    note("token #5 minted after death has post_death = true and cannot take a refund");

    step(11, "two fan hosts register and set their own ETH payout address (only a host can, only on its own record)");
    for (a, name) in [(&fanhost, "one"), (&otherhost, "two")] {
        call(a, &lic, "register_host", json!({ "endpoint": format!("https://{name}.trycloudflare.com"), "host_pubkey": "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h" }), milli(10)).await?;
    }
    let (to1, to2) = ("0x70997970c51812dc3a010c7d01b50e0d17dc79c8", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc");
    assert!(refused(&mira, &lic, "set_payout_evm", json!({ "address": to1 }), ZERO).await, "not a host");
    call(&fanhost, &lic, "set_payout_evm", json!({ "address": to1 }), ZERO).await?;
    call(&otherhost, &lic, "set_payout_evm", json!({ "address": to2 }), ZERO).await?;
    note("fanhost and otherhost registered; mira (not a host) could not set a payout address");

    step(12, "claim_epoch: verified sessions x rate, booked as ETH payouts; NEAR moves pool -> evm_settled; an epoch pays once");
    let released_at = info(&lic).await["released_at_ms"].as_u64().unwrap();
    let now_ms = || std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    tokio::time::sleep(Duration::from_millis((released_at + EPOCH_MS + 1500).saturating_sub(now_ms()))).await;
    let host_json = r#"{"ok":true,"mode":"host","reachable":true,"build_ok":true,"verified":2}"#;
    set_out(&mock, &outlayer_acc, &format!("host:{}", fanhost.id()), host_json).await;
    set_out(&mock, &outlayer_acc, &format!("host:{}", otherhost.id()), host_json).await;
    call(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), ZERO).await?;
    call(&otherhost, &lic, "claim_epoch", json!({ "epoch": 0 }), ZERO).await?;
    assert!(refused(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), ZERO).await, "no double pay");
    let t = info(&lic).await["totals"].clone();
    assert_eq!((u(&t["evm_settled"]), u(&t["paid_out"])), (40 * MILLI, 0));
    note(&format!("2 payouts booked, evm_settled {} (no method can withdraw it), second claim refused", n(u(&t["evm_settled"]))));

    step(13, "sign_evm_payout: a signer outage and a garbage reply change nothing; then a high-s signature is normalised and stored");
    for mode in ["fail", "garbage"] {
        signer.call("set_mode").args_json(json!({ "mode": mode })).transact().await?.into_result()?;
        call(&relayer, &lic, "sign_evm_payout", json!({ "id": 0 }), ZERO).await?;
        let p: Vec<Value> = lic.view("get_evm_payouts").args_json(json!({ "from_index": 0, "limit": 10 })).await?.json()?;
        assert_eq!(p[0]["status"].as_str(), Some("Booked"));
    }
    signer.call("set_mode").args_json(json!({ "mode": "high_s" })).transact().await?.into_result()?;
    call(&relayer, &lic, "sign_evm_payout", json!({ "id": 0 }), ZERO).await?;
    let p: Vec<Value> = lic.view("get_evm_payouts").args_json(json!({ "from_index": 0, "limit": 10 })).await?.json()?;
    assert_eq!((p[0]["status"].as_str(), p[0]["nonce"].as_u64()), (Some("Signed"), Some(0)));
    let raw = hex::decode(p[0]["signed_tx"].as_str().unwrap().trim_start_matches("0x"))?;
    assert_eq!(hex::encode(Keccak256::digest(&raw)), p[0]["tx_hash"].as_str().unwrap().trim_start_matches("0x"));
    note(&format!("signed EIP-1559 tx for Base Sepolia (chain 84532), nonce 0, hash {}…, ecrecover = payer checked in the contract", &p[0]["tx_hash"].as_str().unwrap()[..14]));

    step(14, "a second payout signs at the next nonce without waiting for the first to confirm");
    signer.call("set_mode").args_json(json!({ "mode": "ok" })).transact().await?.into_result()?;
    call(&kofi, &lic, "sign_evm_payout", json!({ "id": 1 }), ZERO).await?;
    let ep: Value = lic.view("evm_payout_info").await?.json()?;
    assert_eq!(ep["next_nonce"], 2);
    note("next_nonce = 2");

    step(15, "bump: refused inside two minutes of the last signature (same nonce, higher fee afterwards, history kept)");
    assert!(refused(&relayer, &lic, "bump_evm_payout", json!({ "id": 0 }), ZERO).await);
    note("an early bump was refused; the 120 s wait is not rehearsed here (see evm_lifecycle.rs and t_evm_bump.rs)");

    step(16, "solvency: the contract's spendable balance covers every tracked bucket, and sync_ops adds only the strict surplus");
    let acc = lic.view_account().await?;
    let t0 = info(&lic).await["totals"].clone();
    let tracked = |t: &Value| u(&t["pot_locked"]) + u(&t["pool"]) + u(&t["evm_settled"]) + u(&t["ops_budget"]);
    let free = acc.balance.as_yoctonear() - acc.storage_usage as u128 * 10u128.pow(19);
    assert!(free >= tracked(&t0));
    let swept = u(&call(&relayer, &lic, "sync_ops", json!({}), ZERO).await?);
    let t1 = info(&lic).await["totals"].clone();
    assert_eq!(swept, free - tracked(&t0));
    assert_eq!((u(&t1["pool"]), u(&t1["evm_settled"])), (u(&t0["pool"]), u(&t0["evm_settled"])));
    note(&format!("spendable {} >= tracked {}; sync_ops swept {} of surplus into ops and touched nothing else", n(free), n(tracked(&t0)), n(swept)));

    note(&format!("done in {:.0} s; every assertion above is a real contract call against the real licence wasm", started.elapsed().as_secs_f64()));
    note("not rehearsed here: key deletion / born-locked instances (tests/factory.rs) and the 120 s bump wait (evm_lifecycle.rs)");
    println!("DEMO OK");
    Ok(())
}
