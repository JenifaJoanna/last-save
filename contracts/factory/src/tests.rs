use near_sdk::mock::{MockAction, Receipt};
use near_sdk::test_utils::{get_created_receipts, get_logs, VMContextBuilder};
use near_sdk::{test_vm_config, testing_env, AccountId, NearToken, PromiseResult, RuntimeFeesConfig};

use super::*;

const FACTORY: &str = "studio.testnet";
const OWNER: &str = "lastsave-studio.testnet";
const BOB: &str = "bob.testnet";
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn acct(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn hash() -> [u8; 32] {
    [7u8; 32]
}

fn at(pred: &str, deposit: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(FACTORY))
        .predecessor_account_id(acct(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(50))
        .prepaid_gas(near_sdk::Gas::from_tgas(300));
    testing_env!(b.build());
}

fn cb_env(result: PromiseResult, balance_near: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(FACTORY)).predecessor_account_id(acct(FACTORY)).account_balance(NearToken::from_near(balance_near));
    testing_env!(b.build(), test_vm_config(), RuntimeFeesConfig::test(), Default::default(), vec![result]);
}

fn factory() -> Factory {
    at(OWNER, 0);
    Factory::new(acct(OWNER), Base58CryptoHash::from(hash()))
}

fn config() -> InitConfig {
    let h = |c: char| c.to_string().repeat(64);
    let prog = |p: &str, c: char| Program { urls: vec![format!("https://example.test/{p}.wasm")], sha256: h(c) };
    InitConfig {
        studio: acct(OWNER),
        outlayer: acct("outlayer.testnet"),
        title: "Ember Rift".into(),
        game_id: "ember-rift".into(),
        media: "https://ember-rift.pages.dev/icon.png".into(),
        price: U128(250_000_000_000_000_000_000_000),
        fund_bps: 4000,
        royalty_bps: 1000,
        release: prog("release", 'a'),
        probe: prog("probe", 'b'),
        key_commitment: h('e'),
        artifact: Artifact { urls: vec!["https://example.test/server.bin".into()], sha256: h('c'), build_hash: h('d'), size: 1234 },
        official_endpoint: "https://ember-rift-official.pages.dev".into(),
        liveness: Liveness { probe_interval_ms: 20_000, fail_threshold: 3, receipt_window_ms: 180_000, report_window_ms: 120_000, quorum_bps: 5000 },
        pool: PoolCfg { epoch_ms: 120_000, pay_per_session: U128(10_000_000_000_000_000_000_000), epoch_cap: U128(50_000_000_000_000_000_000_000) },
        evm_payout: None,
    }
}

fn refused<F: FnOnce()>(f: F) -> String {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
    std::panic::set_hook(prev);
    match r {
        Ok(_) => panic!("call was accepted but should have been refused"),
        Err(e) => e.downcast_ref::<String>().cloned().or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_default(),
    }
}

fn actions() -> Vec<MockAction> {
    get_created_receipts().iter().flat_map(|r: &Receipt| r.actions.clone()).collect()
}

fn create(f: &mut Factory, who: &str, name: &str, deposit: u128) {
    at(who, deposit);
    let _ = f.create_instance(name.into(), config());
}

#[test]
fn views_report_the_code_hash_and_start_empty() {
    let f = factory();
    assert_eq!(f.code_hash(), Base58CryptoHash::from(hash()));
    assert!(f.instances(None, None).is_empty());
    assert_eq!((f.owner(), f.is_open()), (acct(OWNER), true));
}

#[test]
fn an_instance_is_created_in_one_batch_by_hash_and_born_with_no_keys() {
    let mut f = factory();
    create(&mut f, BOB, "ember", 2 * NEAR);
    let a = actions();
    let kinds: Vec<&str> = a
        .iter()
        .map(|x| match x {
            MockAction::CreateAccount { .. } => "create",
            MockAction::Transfer { .. } => "transfer",
            MockAction::UseGlobalContract { .. } => "use_global",
            MockAction::FunctionCallWeight { .. } => "call",
            MockAction::AddKeyWithFullAccess { .. } | MockAction::AddKeyWithFunctionCall { .. } => "ADD_KEY",
            MockAction::DeployContract { .. } => "DEPLOY_CODE",
            _ => "other",
        })
        .collect();
    assert_eq!(kinds, vec!["create", "transfer", "use_global", "call", "call"], "instance batch, then the callback");
    assert!(!kinds.contains(&"ADD_KEY") && !kinds.contains(&"DEPLOY_CODE"), "no key, no code of its own");
    let receipts = get_created_receipts();
    assert_eq!(receipts[0].receiver_id.as_str(), "ember.studio.testnet");
    match &a[1] {
        MockAction::Transfer { deposit, .. } => assert_eq!(deposit.as_yoctonear(), 2 * NEAR, "the whole deposit funds the instance"),
        _ => unreachable!(),
    }
    match &a[2] {
        MockAction::UseGlobalContract { contract_id, .. } => {
            let d = format!("{contract_id:?}");
            assert!(d.contains("CodeHash") && d.contains(&String::from(&Base58CryptoHash::from(hash()))), "referenced by hash, not by account: {d}");
        }
        _ => unreachable!(),
    }
    match &a[3] {
        MockAction::FunctionCallWeight { method_name, args, .. } => {
            assert_eq!(method_name, b"new");
            let v: near_sdk::serde_json::Value = near_sdk::serde_json::from_slice(args).unwrap();
            assert_eq!(v["config"]["game_id"], "ember-rift");
            assert_eq!(v["config"]["studio"], OWNER);
        }
        _ => unreachable!(),
    }
    let list = f.instances(None, None);
    assert_eq!((list.len(), list[0].status, list[0].creator.as_str()), (1, Status::Pending, BOB));
    assert!(get_logs().iter().any(|l| l.contains("instance_requested")));
}

#[test]
fn a_successful_init_marks_the_instance_ready() {
    let mut f = factory();
    create(&mut f, BOB, "ember", 2 * NEAR);
    cb_env(PromiseResult::Successful(vec![]), 50);
    assert!(f.on_created(acct("ember.studio.testnet"), acct(BOB), U128(2 * NEAR)));
    assert_eq!(f.instances(None, None)[0].status, Status::Ready);
    assert!(get_logs().iter().any(|l| l.contains("instance_created")));
    at(BOB, 2 * NEAR);
    assert!(refused(|| drop(f.create_instance("ember".into(), config()))).contains("taken"));
}

#[test]
fn a_failed_init_refunds_the_creator_and_frees_the_name() {
    let mut f = factory();
    create(&mut f, BOB, "ember", 2 * NEAR);
    cb_env(PromiseResult::Failed, 50);
    assert!(!f.on_created(acct("ember.studio.testnet"), acct(BOB), U128(2 * NEAR)));
    assert_eq!(f.instances(None, None)[0].status, Status::Failed);
    let refund: Vec<(String, u128)> = get_created_receipts()
        .iter()
        .flat_map(|r| r.actions.iter().filter_map(move |a| if let MockAction::Transfer { deposit, .. } = a { Some((r.receiver_id.to_string(), deposit.as_yoctonear())) } else { None }))
        .collect();
    assert_eq!(refund, vec![(BOB.to_string(), 2 * NEAR)]);
    create(&mut f, BOB, "ember", 2 * NEAR); // same name can be tried again
    assert_eq!(f.instances(None, None).len(), 1);
}

#[test]
fn a_refund_the_factory_cannot_cover_yet_is_owed_and_claimable_once() {
    let mut f = factory();
    create(&mut f, BOB, "ember", 2 * NEAR);
    cb_env(PromiseResult::Failed, 1); // the returned deposit has not landed yet
    assert!(!f.on_created(acct("ember.studio.testnet"), acct(BOB), U128(2 * NEAR)));
    assert!(get_created_receipts().is_empty(), "nothing sent that the factory cannot cover");
    assert!(get_logs().iter().any(|l| l.contains("refund_owed")));
    at("carol.testnet", 0);
    assert!(refused(|| drop(f.claim_refund())).contains("Nothing"));
    at(BOB, 0);
    assert_eq!(f.claim_refund().0, 2 * NEAR);
    assert!(refused(|| drop(f.claim_refund())).contains("Nothing"), "paid once");
}

#[test]
fn a_deposit_below_the_minimum_is_refused() {
    let mut f = factory();
    at(BOB, 0);
    let need = f.min_deposit(config()).0;
    assert!(need > 0 && need < NEAR, "minimum is a fraction of a NEAR: {need}");
    at(BOB, need - 1);
    assert!(refused(|| drop(f.create_instance("ember".into(), config()))).contains("below the minimum"));
    at(BOB, need);
    let _ = f.create_instance("ember".into(), config());
    assert_eq!(f.instances(None, None).len(), 1);
}

#[test]
fn names_must_make_a_direct_sub_account() {
    let mut f = factory();
    for bad in ["a", "Ember", "em.ber", "-ember", "ember-", "em ber", "", &"x".repeat(33)] {
        at(BOB, 2 * NEAR);
        assert!(refused(|| drop(f.create_instance(bad.into(), config()))).contains("Name"), "{bad}");
    }
    for good in ["ember", "ember-rift_2", "ab"] {
        create(&mut f, BOB, good, 2 * NEAR);
    }
}

#[test]
fn only_the_owner_can_close_the_factory_and_then_only_the_owner_creates() {
    let mut f = factory();
    at(BOB, 0);
    assert!(refused(|| f.set_open(false)).contains("owner"));
    at(OWNER, 0);
    f.set_open(false);
    at(BOB, 2 * NEAR);
    assert!(refused(|| drop(f.create_instance("ember".into(), config()))).contains("closed"));
    create(&mut f, OWNER, "ember", 2 * NEAR);
}

#[test]
fn the_factory_cannot_change_the_code_it_points_instances_at() {
    // the hash is set once in new() and nothing writes it again
    let src = include_str!("lib.rs");
    let writes = src.lines().filter(|l| l.contains("self.code_hash") && l.contains('=') && !l.contains("==") && !l.contains("use_global")).count();
    assert_eq!(writes, 0);
}
