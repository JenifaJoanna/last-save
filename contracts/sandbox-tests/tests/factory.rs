//! NEP-591 on a local sandbox (neard 2.13): publish the licence wasm as a global contract by hash,
//! then create born-locked licence instances through the factory.
//!
//! workspaces 0.22 has no global-contract action builder, so the DeployGlobalContract transaction is
//! built and signed with near-primitives and sent over the sandbox's JSON-RPC.
//!
//! Build first (repo root): ./scripts/build-wasm.sh licence, then in contracts/factory:
//!   cargo build --target wasm32-unknown-unknown --release   (RUSTFLAGS="--cfg near")
//! Then: cd contracts/sandbox-tests && cargo test --test factory -- --nocapture

use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;

use near_crypto::{InMemorySigner, SecretKey};
use near_primitives::action::{Action, DeployGlobalContractAction, GlobalContractDeployMode};
use near_primitives::borsh;
use near_primitives::hash::{hash as sha256, CryptoHash};
use near_primitives::transaction::{Transaction, TransactionV0};
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, AccountId, Worker};
use serde_json::{json, Value};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn wasm(rel: &str) -> Vec<u8> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(rel);
    std::fs::read(&p).unwrap_or_else(|e| panic!("missing {rel}: {e} (see the header of this file)"))
}

async fn rpc(addr: &str, method: &str, params: Value) -> anyhow::Result<Value> {
    let r: Value = reqwest::Client::new()
        .post(addr)
        .json(&json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params }))
        .send()
        .await?
        .json()
        .await?;
    if let Some(e) = r.get("error") {
        anyhow::bail!("{method}: {e}");
    }
    Ok(r["result"].clone())
}

/// Publishes `code` as a global contract by hash from `publisher`; returns the code hash.
async fn publish_global(worker: &Worker<near_workspaces::network::Sandbox>, publisher: &Account, code: &[u8]) -> anyhow::Result<CryptoHash> {
    let addr = worker.rpc_addr();
    let sk = SecretKey::from_str(&publisher.secret_key().to_string())?;
    let signer = InMemorySigner::from_secret_key(publisher.id().as_str().parse()?, sk.clone());
    let pk = sk.public_key();
    let ak = rpc(&addr, "query", json!({ "request_type": "view_access_key", "finality": "final", "account_id": publisher.id(), "public_key": pk.to_string() })).await?;
    let block = rpc(&addr, "block", json!({ "finality": "final" })).await?;
    let tx = Transaction::V0(TransactionV0 {
        signer_id: publisher.id().as_str().parse()?,
        public_key: pk,
        nonce: ak["nonce"].as_u64().unwrap() + 1,
        receiver_id: publisher.id().as_str().parse()?,
        block_hash: block["header"]["hash"].as_str().unwrap().parse().map_err(|e| anyhow::anyhow!("{e:?}"))?,
        actions: vec![Action::DeployGlobalContract(DeployGlobalContractAction { code: Arc::from(code), deploy_mode: GlobalContractDeployMode::CodeHash })],
    });
    let signed = tx.sign(&signer);
    let b64 = near_primitives::serialize::to_base64(&borsh::to_vec(&signed)?);
    let out = rpc(&addr, "send_tx", json!({ "signed_tx_base64": b64, "wait_until": "FINAL" })).await?;
    assert!(out["status"].get("SuccessValue").is_some(), "global deploy failed: {}", out["status"]);
    Ok(sha256(code))
}

fn config(studio: &AccountId, price: u128) -> Value {
    let h = |c: char| c.to_string().repeat(64);
    json!({
        "studio": studio, "outlayer": "outlayer.test.near",
        "title": "Ember Rift", "game_id": "ember-rift", "media": "https://ember-rift.pages.dev/icon.png",
        "price": price.to_string(), "fund_bps": 4000, "royalty_bps": 1000,
        "release": { "urls": ["https://example.test/release.wasm"], "sha256": h('a') },
        "probe": { "urls": ["https://example.test/probe.wasm"], "sha256": h('b') },
        "key_commitment": h('e'),
        "artifact": { "urls": ["https://example.test/server.bin"], "sha256": h('c'), "build_hash": h('d'), "size": 1234 },
        "official_endpoint": "https://ember-rift-official.pages.dev",
        "liveness": { "probe_interval_ms": 20000, "fail_threshold": 3, "receipt_window_ms": 180000, "report_window_ms": 120000, "quorum_bps": 5000 },
        "pool": { "epoch_ms": 120000, "pay_per_session": (10 * NEAR / 1000).to_string(), "epoch_cap": (50 * NEAR / 1000).to_string() },
    })
}

#[tokio::test]
async fn global_publish_and_born_locked_instances() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let mk = |n: &'static str, near: u128| {
        let root = root.clone();
        async move { root.create_subaccount(n).initial_balance(NearToken::from_near(near)).transact().await.unwrap().into_result().unwrap() }
    };
    let (publisher, factory_acc, studio) = (mk("publisher", 100).await, mk("factory", 20).await, mk("studio", 20).await);

    // 1. publish the licence wasm by hash and measure what it costs
    let code = wasm(&std::env::var("LICENCE_WASM").unwrap_or("../licence/target/near/lastsave_licence.opt.wasm".into()));
    let before = publisher.view_account().await?.balance.as_yoctonear();
    let hash = publish_global(&worker, &publisher, &code).await?;
    let spent = before - publisher.view_account().await?.balance.as_yoctonear();
    println!("global publish of {} bytes cost {:.4} NEAR (burnt storage + gas); code hash {hash}", code.len(), spent as f64 / NEAR as f64);
    assert!(spent > code.len() as u128 * 10u128.pow(20), "burn is at least 1e20 yocto per byte");

    // 2. factory
    let fac = factory_acc.deploy(&wasm("../factory/target/near/lastsave_factory.wasm")).await?.into_result()?;
    fac.call("new").args_json(json!({ "owner": studio.id(), "licence_code_hash": hash.to_string() })).transact().await?.into_result()?;
    let ch: String = fac.view("code_hash").await?.json()?;
    assert_eq!(ch, hash.to_string());
    let cfg = config(studio.id(), 250 * NEAR / 1000);
    let min: String = fac.view("min_deposit").args_json(json!({ "config": cfg })).await?.json()?;
    let min: u128 = min.parse()?;
    println!("minimum instance deposit {:.4} NEAR", min as f64 / NEAR as f64);

    // 3. too small a deposit is refused
    let too_small = studio.call(fac.id(), "create_instance").args_json(json!({ "name": "ember", "config": cfg })).deposit(NearToken::from_yoctonear(min - 1)).gas(Gas::from_tgas(300)).transact().await?;
    assert!(too_small.is_failure(), "deposit below the minimum");

    // 4. create: one transaction, born locked, running the global code
    let bal0 = studio.view_account().await?.balance.as_yoctonear();
    let out = studio.call(fac.id(), "create_instance").args_json(json!({ "name": "ember", "config": cfg })).deposit(NearToken::from_near(2)).gas(Gas::from_tgas(300)).transact().await?;
    println!("create_instance gas burnt: {:.1} Tgas", out.total_gas_burnt.as_gas() as f64 / 1e12);
    out.into_result()?;
    let inst_id: AccountId = format!("ember.{}", fac.id()).parse()?;
    let list: Vec<Value> = fac.view("instances").args_json(json!({})).await?.json()?;
    assert_eq!((list.len(), list[0]["status"].as_str(), list[0]["creator"].as_str()), (1, Some("Ready"), Some(studio.id().as_str())));
    let acc = worker.view_account(&inst_id).await?;
    let raw = rpc(&worker.rpc_addr(), "query", json!({ "request_type": "view_account", "finality": "optimistic", "account_id": inst_id })).await?;
    assert_eq!(raw["global_contract_hash"].as_str(), Some(hash.to_string().as_str()), "runs the global code by hash: {raw}");
    assert!(acc.balance.as_yoctonear() > NEAR, "funded with the deposit");
    let keys = worker.view_access_keys(&inst_id).await?;
    assert!(keys.is_empty(), "born locked: {} access keys", keys.len());
    let status: String = worker.view(&inst_id, "ls_status").await?.json()?;
    assert_eq!(status, "Alive");
    let info: Value = worker.view(&inst_id, "get_info").await?.json()?;
    assert_eq!(info["config"]["game_id"], "ember-rift");
    // the instance works like a normal contract: the studio can call it, and it is the only one who can end service
    studio.call(&inst_id, "end_of_service").transact().await?.into_result()?;
    let status: String = worker.view(&inst_id, "ls_status").await?.json()?;
    assert_eq!(status, "Dead");
    let paid = bal0 - studio.view_account().await?.balance.as_yoctonear();
    assert!(paid >= 2 * NEAR && paid < 2 * NEAR + NEAR / 10, "creator paid the deposit plus gas only: {paid}");

    // 5. a config the licence rejects: nothing is created, the deposit comes back
    let bad = config(studio.id(), 0);
    let bal1 = studio.view_account().await?.balance.as_yoctonear();
    let out = studio.call(fac.id(), "create_instance").args_json(json!({ "name": "broken", "config": bad })).deposit(NearToken::from_near(2)).gas(Gas::from_tgas(300)).transact().await?;
    out.into_result()?;
    let broken: AccountId = format!("broken.{}", fac.id()).parse()?;
    assert!(worker.view_account(&broken).await.is_err(), "no account was created");
    let list: Vec<Value> = fac.view("instances").args_json(json!({})).await?.json()?;
    assert_eq!(list[1]["status"].as_str(), Some("Failed"));
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    let lost = bal1 as i128 - studio.view_account().await?.balance.as_yoctonear() as i128;
    println!("net change for the failed creation (yocto, positive = lost): {lost}");
    assert!(lost < (NEAR / 10) as i128 && lost > -((NEAR / 10) as i128), "deposit refunded exactly once, only gas lost: {lost}");

    // 6. duplicate name refused
    let dup = studio.call(fac.id(), "create_instance").args_json(json!({ "name": "ember", "config": cfg })).deposit(NearToken::from_near(2)).gas(Gas::from_tgas(300)).transact().await?;
    assert!(dup.is_failure());
    println!("factory ok");
    Ok(())
}
