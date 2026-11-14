//! Chain Signatures payouts and zero-deposit enclave calls on a local NEAR sandbox, against a
//! mock OutLayer and a mock MPC signer (real `ecrecover` host function, real receipts and gas).
//!
//! Build first (repo root):
//!   ./scripts/build-wasm.sh licence
//!   (cd contracts/mock-outlayer && cargo build --target wasm32-unknown-unknown --release)
//!   (cd contracts/mock-signer && cargo build --target wasm32-unknown-unknown --release)
//! Then: cd contracts/sandbox-tests && cargo test --test evm_lifecycle -- --nocapture
//! Every gasless method here is called with 250 Tgas and zero deposit, as the relayer does.

use std::path::PathBuf;
use std::time::Duration;

use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sha3::Keccak256;

const MILLI: u128 = 1_000_000_000_000_000_000_000;
const PRICE: u128 = 250 * MILLI;
const EPOCH_MS: u64 = 5000;
const WEI: u128 = 10_000_000_000_000;
const NO_DEPOSIT: NearToken = NearToken::from_yoctonear(0);

fn wasm(rel: &str) -> Vec<u8> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(rel);
    std::fs::read(&p).unwrap_or_else(|e| panic!("missing {rel}: {e} (see the header of this file)"))
}

fn u(v: &Value) -> u128 {
    v.as_str().unwrap().parse().unwrap()
}

/// One call with 250 Tgas; returns (result, gas burnt over the whole receipt tree).
async fn call(from: &Account, to: &Contract, m: &str, args: Value, dep: NearToken) -> anyhow::Result<(Value, u64)> {
    let r = from.call(to.id(), m).args_json(args).deposit(dep).gas(Gas::from_tgas(250)).transact().await?;
    let burnt = r.total_gas_burnt.as_gas();
    let r = r.into_result().map_err(|e| anyhow::anyhow!("{m} failed: {e}"))?;
    Ok((r.json::<Value>().unwrap_or(Value::Null), burnt))
}

async fn info(c: &Contract) -> Value {
    c.view("get_info").await.unwrap().json::<Value>().unwrap()
}

async fn payouts(c: &Contract) -> Vec<Value> {
    c.view("get_evm_payouts").args_json(json!({ "from_index": 0, "limit": 10 })).await.unwrap().json().unwrap()
}

fn keccak(b: &[u8]) -> Vec<u8> {
    Keccak256::digest(b).to_vec()
}

#[tokio::test]
async fn evm_payouts_and_gasless_calls() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let mk = |n: &'static str, near: u128| {
        let root = root.clone();
        async move { root.create_subaccount(n).initial_balance(NearToken::from_near(near)).transact().await.unwrap().into_result().unwrap() }
    };
    let studio = mk("studio", 10).await;
    let (mira, kofi, yuna, dario) = (mk("mira", 10).await, mk("kofi", 10).await, mk("yuna", 10).await, mk("dario", 10).await);
    let (fanhost, otherhost, relayer) = (mk("fanhost", 10).await, mk("otherhost", 10).await, mk("relayer", 10).await);
    let (outlayer_acc, signer_acc, licence_acc) = (mk("outlayer", 10).await, mk("signer", 10).await, mk("licence", 20).await);
    let mock = outlayer_acc.deploy(&wasm("../mock-outlayer/target/wasm32-unknown-unknown/release/mock_outlayer.wasm")).await?.into_result()?;
    mock.call("new").transact().await?.into_result()?;
    let signer = signer_acc.deploy(&wasm("../mock-signer/target/wasm32-unknown-unknown/release/mock_signer.wasm")).await?.into_result()?;
    let test_signer = hex::encode(keccak(b"lastsave-test-signer-v1"));
    signer.call("new").args_json(json!({ "signer_hex": test_signer })).transact().await?.into_result()?;
    let payer: String = signer.view("address").await?.json()?;
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
        "liveness": { "probe_interval_ms": 1500, "fail_threshold": 3, "receipt_window_ms": 180000, "report_window_ms": 120000, "quorum_bps": 5000 },
        "pool": { "epoch_ms": EPOCH_MS, "pay_per_session": (10 * MILLI).to_string(), "epoch_cap": (50 * MILLI).to_string() },
        "evm_payout": { "mpc": signer.id(), "path": "lastsave/host-payouts", "address": payer,
            "demo_wei_per_session": WEI.to_string(), "max_fee_per_gas": "2000000000", "max_priority_fee_per_gas": "1000000",
            "max_fee_cap": "10000000000", "gas_limit": 21000 },
    });
    call(&licence_acc, &lic, "new", json!({ "config": cfg }), NO_DEPOSIT).await?;
    call(&studio, &lic, "escrow_key", json!({ "encrypted_secrets_base64": "QUJDRA==" }), NearToken::from_yoctonear(50 * MILLI)).await?;
    for p in [&mira, &kofi, &yuna, &dario] {
        call(p, &lic, "buy_licence", json!({}), NearToken::from_yoctonear(PRICE)).await?;
    }
    let mut gas: Vec<(&str, u64)> = vec![];
    let out = |m: &Contract, k: &str, v: &str| {
        let (m, k, v, o) = (m.clone(), k.to_string(), v.to_string(), outlayer_acc.clone());
        async move { call(&o, &m, "set_output", json!({ "key": k, "json": v }), NO_DEPOSIT).await.unwrap() }
    };

    // ops budget: empty at first, so a zero-deposit probe is refused; fund_ops then opens it
    assert_eq!(u(&lic.view("ops_budget").await?.json::<Value>()?), 0);
    assert!(call(&relayer, &lic, "probe_official", json!({}), NO_DEPOSIT).await.is_err(), "empty ops budget");
    call(&studio, &lic, "fund_ops", json!({}), NearToken::from_near(1)).await?;
    out(&mock, "official", r#"{"ok":true,"reachable":true,"build_ok":true,"verified":2}"#).await;
    let (_, g) = call(&relayer, &lic, "probe_official", json!({}), NO_DEPOSIT).await?;
    gas.push(("probe_official", g));
    let ex: Vec<String> = mock.view("exec_calls").await?.json()?;
    let last: Value = serde_json::from_str(ex.last().unwrap())?;
    assert_eq!(last["payer"].as_str(), Some(lic.id().as_str()), "the contract pays and is the refund target");
    assert_eq!(last["deposit"].as_str(), Some((20 * MILLI).to_string().as_str()));
    assert_eq!(u(&lic.view("ops_budget").await?.json::<Value>()?), NearToken::from_near(1).as_yoctonear() - 20 * MILLI);
    let (_, g) = call(&mira, &lic, "report_down", json!({ "token_id": "1" }), NO_DEPOSIT).await?;
    gas.push(("report_down", g));

    // death, then a zero-deposit release
    call(&studio, &lic, "end_of_service", json!({}), NO_DEPOSIT).await?;
    out(&mock, "release", &json!({ "ok": true, "mode": "release", "key": hex::encode(key), "key_sha256": commitment, "status": "Dead" }).to_string()).await;
    let (_, g) = call(&relayer, &lic, "release", json!({}), NO_DEPOSIT).await?;
    gas.push(("release", g));
    assert_eq!(info(&lic).await["released_key"].as_str(), Some(hex::encode(key).as_str()));
    let (_, g) = call(&yuna, &lic, "choose", json!({ "token_id": "3", "choice": "Pledge" }), NO_DEPOSIT).await?;
    gas.push(("choose", g));
    call(&dario, &lic, "choose", json!({ "token_id": "4", "choice": "Pledge" }), NO_DEPOSIT).await?;

    // hosts: register, set an ETH payout address (own record only), claim in ETH
    for (a, n) in [(&fanhost, "one"), (&otherhost, "two")] {
        call(a, &lic, "register_host", json!({ "endpoint": format!("https://{n}.trycloudflare.com"), "host_pubkey": "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h" }), NearToken::from_yoctonear(10 * MILLI)).await?;
    }
    let to1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
    let to2 = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
    assert!(call(&mira, &lic, "set_payout_evm", json!({ "address": to1 }), NO_DEPOSIT).await.is_err(), "not a host");
    assert!(call(&fanhost, &lic, "set_payout_evm", json!({ "address": "0x12" }), NO_DEPOSIT).await.is_err(), "bad address");
    let (_, g) = call(&fanhost, &lic, "set_payout_evm", json!({ "address": to1 }), NO_DEPOSIT).await?;
    gas.push(("set_payout_evm", g));
    call(&otherhost, &lic, "set_payout_evm", json!({ "address": to2 }), NO_DEPOSIT).await?;
    let released_at = info(&lic).await["released_at_ms"].as_u64().unwrap();
    let now_ms = || std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    tokio::time::sleep(Duration::from_millis((released_at + EPOCH_MS + 1500).saturating_sub(now_ms()))).await;
    let host_json = r#"{"ok":true,"mode":"host","reachable":true,"build_ok":true,"verified":2}"#;
    out(&mock, &format!("host:{}", fanhost.id()), host_json).await;
    out(&mock, &format!("host:{}", otherhost.id()), host_json).await;
    let fan_before = fanhost.view_account().await?.balance.as_yoctonear();
    let (_, g) = call(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), NO_DEPOSIT).await?;
    gas.push(("claim_epoch", g));
    call(&otherhost, &lic, "claim_epoch", json!({ "epoch": 0 }), NO_DEPOSIT).await?;
    assert!(fanhost.view_account().await?.balance.as_yoctonear() <= fan_before, "no NEAR paid to an ETH host");
    assert!(call(&fanhost, &lic, "claim_epoch", json!({ "epoch": 0 }), NO_DEPOSIT).await.is_err(), "an epoch pays once");
    let t = info(&lic).await["totals"].clone();
    assert_eq!((u(&t["evm_settled"]), u(&t["paid_out"])), (40 * MILLI, 0));
    let ps = payouts(&lic).await;
    assert_eq!((ps.len(), ps[0]["status"].as_str(), u(&ps[0]["value_wei"])), (2, Some("Booked"), 2 * WEI));

    // signing: timeout-like failure, garbage reply, then a high-s reply that is normalised
    let sign = |who: &Account, id: u64, m: &'static str| {
        let (who, lic) = (who.clone(), lic.clone());
        async move { call(&who, &lic, m, json!({ "id": id }), NO_DEPOSIT).await }
    };
    for mode in ["fail", "garbage"] {
        signer.call("set_mode").args_json(json!({ "mode": mode })).transact().await?.into_result()?;
        sign(&relayer, 0, "sign_evm_payout").await?;
        let p = payouts(&lic).await;
        assert_eq!((p[0]["status"].as_str(), p[0]["nonce"].clone()), (Some("Booked"), Value::Null), "mode {mode}");
        assert_eq!(lic.view("evm_payout_info").await?.json::<Value>()?["next_nonce"], 0);
    }
    signer.call("set_mode").args_json(json!({ "mode": "high_s" })).transact().await?.into_result()?;
    let (_, g) = sign(&relayer, 0, "sign_evm_payout").await?;
    gas.push(("sign_evm_payout", g));
    assert!(sign(&relayer, 0, "sign_evm_payout").await.is_err(), "already signed");
    let p0 = payouts(&lic).await[0].clone();
    assert_eq!((p0["status"].as_str(), p0["nonce"].as_u64()), (Some("Signed"), Some(0)));
    let raw = hex::decode(p0["signed_tx"].as_str().unwrap().trim_start_matches("0x"))?;
    assert_eq!(hex::encode(keccak(&raw)), p0["tx_hash"].as_str().unwrap().trim_start_matches("0x"));
    let at = if raw[1] >= 0xf8 { 1 + 1 + (raw[1] - 0xf7) as usize } else { 2 };
    assert_eq!((raw[0], &raw[at..at + 4]), (0x02, &[0x83u8, 0x01, 0x4a, 0x34][..]), "type 2, chainId 84532");
    assert!(raw.windows(20).any(|w| w == hex::decode(&to1[2..]).unwrap().as_slice()), "recipient in the tx");
    let n_half = hex::decode("7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0")?;
    assert!(raw[raw.len() - 32..] <= n_half[..], "s was normalised to the low half");
    let calls: Vec<Value> = signer.view("calls").await?.json::<Vec<String>>()?.iter().map(|s| serde_json::from_str(s).unwrap()).collect();
    let c0 = calls.last().unwrap();
    assert_eq!((c0["predecessor"].as_str(), c0["path"].as_str(), c0["deposit"].as_str(), c0["domain_id"].as_u64()), (Some(lic.id().as_str()), Some("lastsave/host-payouts"), Some("1"), Some(0)));
    assert!(c0["gas_tgas"].as_u64().unwrap() >= 15);
    assert_eq!(c0["payload"].as_str().unwrap().len(), 64);

    // no confirmation gate: payout 1 signs at nonce 1 while payout 0 is only Signed
    signer.call("set_mode").args_json(json!({ "mode": "ok" })).transact().await?.into_result()?;
    sign(&kofi, 1, "sign_evm_payout").await?;
    let p1 = payouts(&lic).await[1].clone();
    assert_eq!((p1["status"].as_str(), p1["nonce"].as_u64()), (Some("Signed"), Some(1)));
    assert_eq!(lic.view("evm_payout_info").await?.json::<Value>()?["next_nonce"], 2);

    // bump: refused inside 2 minutes of the last signature; then same nonce, to and value, fee x1.25, history kept
    assert!(sign(&relayer, 0, "bump_evm_payout").await.is_err(), "bump gap");
    let signed_at = payouts(&lic).await[0]["last_signed_ms"].as_u64().unwrap();
    worker.fast_forward(1000).await?;
    loop {
        let now = info(&lic).await["now_ms"].as_u64().unwrap();
        if now >= signed_at + 120_000 + 500 { break; }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
    let (_, g) = sign(&relayer, 0, "bump_evm_payout").await?;
    gas.push(("bump_evm_payout", g));
    let b0 = payouts(&lic).await[0].clone();
    assert_eq!((b0["nonce"].as_u64(), b0["to"].as_str(), b0["value_wei"].as_str()), (Some(0), Some(to1), p0["value_wei"].as_str()));
    assert_eq!((b0["max_fee_per_gas"].as_str(), b0["signed_txs"].as_array().unwrap().len()), (Some("2500000000"), 2));
    assert_eq!(b0["signed_txs"][0], p0["signed_tx"], "oldest first");
    assert_eq!(b0["signed_tx"], b0["signed_txs"][1], "signed_tx is the newest");
    assert_ne!(b0["tx_hash"], p0["tx_hash"]);
    let t = info(&lic).await["totals"].clone();
    assert_eq!(u(&t["evm_settled"]), 40 * MILLI, "evm_settled only moves on a claim");
    assert_eq!(lic.view("evm_payout_info").await?.json::<Value>()?["next_nonce"], 2);

    // sync_ops: the books are solvent as they stand, and a sweep only ever adds the strict surplus
    let acc = lic.view_account().await?;
    let tracked = |t: &Value| u(&t["pot_locked"]) + u(&t["pool"]) + u(&t["evm_settled"]) + u(&t["ops_budget"]);
    let free = acc.balance.as_yoctonear() - acc.storage_usage as u128 * 10u128.pow(19);
    let t0 = info(&lic).await["totals"].clone();
    assert!(free >= tracked(&t0), "solvent: free {free} tracked {}", tracked(&t0));
    let (swept, _) = call(&relayer, &lic, "sync_ops", json!({}), NO_DEPOSIT).await?;
    let t1 = info(&lic).await["totals"].clone();
    assert_eq!(u(&swept), free - tracked(&t0), "exactly the strict surplus");
    assert_eq!((u(&t1["pot_locked"]), u(&t1["pool"]), u(&t1["evm_settled"])), (u(&t0["pot_locked"]), u(&t0["pool"]), u(&t0["evm_settled"])));
    assert_eq!(u(&t1["ops_budget"]), u(&t0["ops_budget"]) + u(&swept));
    println!("sync_ops swept {:.4} NEAR of surplus", u(&swept) as f64 / 1e24);
    println!("gas burnt per gasless call at 250 Tgas prepaid (whole receipt tree), Tgas:");
    for (m, g) in &gas {
        println!("  {m:<16} {:>6.1}", *g as f64 / 1e12);
        assert!(*g < 250_000_000_000_000);
    }
    println!("evm lifecycle ok");
    Ok(())
}
