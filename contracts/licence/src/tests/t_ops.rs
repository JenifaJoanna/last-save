//! Ops budget (zero-deposit enclave calls), the 250 Tgas ceiling for gasless methods,
//! and the evm_settled lock.

use near_sdk::mock::MockAction;
use near_sdk::test_utils::{get_created_receipts, VMContextBuilder};
use near_sdk::{env, Gas};

use super::t_evm::*;
use super::t_rlp::{sig_json, vector};
use super::*;
use crate::ops::OPS_ATTACH;

const TGAS: u64 = 1_000_000_000_000;

/// Like env_at, with an explicit prepaid gas in Tgas.
fn env_gas(pred: &str, deposit: u128, t_ms: u64, tgas: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(LICENCE))
        .predecessor_account_id(acct(pred))
        .signer_account_id(acct(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(100))
        .prepaid_gas(Gas::from_tgas(tgas))
        .block_timestamp(t_ms * 1_000_000);
    testing_env!(b.build());
}

fn static_gas() -> u64 {
    get_created_receipts()
        .iter()
        .flat_map(|r| r.actions.iter())
        .map(|a| match a {
            MockAction::FunctionCallWeight { prepaid_gas, .. } => prepaid_gas.as_gas(),
            _ => 0,
        })
        .sum()
}

fn exec_args() -> String {
    calls().into_iter().find(|c| c.1 == "request_execution").expect("request_execution").2
}

fn funded_four(budget: u128) -> Licence {
    let mut c = four();
    if budget > 0 {
        env_at(STUDIO, budget, T0 + 1);
        c.fund_ops();
    }
    c
}

#[test]
fn fund_ops_is_open_to_anyone_and_visible() {
    let mut c = four();
    env_at(KOFI, 0, T0 + 1);
    assert_refused(|| { c.fund_ops(); }, "Attach NEAR");
    env_at(KOFI, 3 * MILLI, T0 + 1);
    assert_eq!(c.fund_ops().0, 3 * MILLI);
    env_at(MIRA, 4 * MILLI, T0 + 2);
    c.fund_ops();
    assert!(logs_have("ops_funded"));
    env_at(MIRA, 0, T0 + 3);
    assert_eq!((c.ops_budget().0, c.get_info().totals.ops_budget.0), (7 * MILLI, 7 * MILLI));
}

#[test]
fn zero_deposit_probe_is_paid_from_the_budget_and_the_contract_is_the_payer() {
    let mut c = funded_four(100 * MILLI);
    env_at(MIRA, 0, T0 + 10);
    let _ = c.probe_official(None);
    assert_eq!(deposit_of("request_execution"), Some(OPS_ATTACH));
    assert_eq!(c.totals.ops_budget, 100 * MILLI - OPS_ATTACH);
    assert!(exec_args().contains(&format!("\"payer_account_id\":\"{LICENCE}\"")));
    // the enclave call fails: the budget gets the 0.02 back, nobody is sent NEAR
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0 + 11, R::Failed);
    c.on_probe(Cb { flight: id, ..cb(id, MIRA) }.funded(true));
    assert_eq!(c.totals.ops_budget, 100 * MILLI);
    assert!(transfers().is_empty());
}

#[test]
fn with_a_deposit_the_calls_behave_as_before_and_leave_the_budget_alone() {
    let mut c = funded_four(100 * MILLI);
    env_at(MIRA, 10 * MILLI, T0 + 10);
    let _ = c.probe_official(None);
    assert_eq!(deposit_of("request_execution"), Some(10 * MILLI));
    assert!(exec_args().contains(&format!("\"payer_account_id\":\"{MIRA}\"")));
    assert_eq!(c.totals.ops_budget, 100 * MILLI);
    // too small a deposit is still refused, not silently topped up
    let mut c = funded_four(100 * MILLI);
    env_at(MIRA, 5 * MILLI, T0 + 10);
    assert_refused(|| drop(c.probe_official(None)), "0.01 NEAR");
}

#[test]
fn zero_deposit_calls_refuse_with_a_clear_message_when_the_budget_is_empty() {
    let mut c = funded_four(0);
    env_at(MIRA, 0, T0 + 10);
    assert_refused(|| drop(c.probe_official(None)), "Ops budget is empty");
    let mut c = funded_four(OPS_ATTACH - 1);
    env_at(MIRA, 0, T0 + 10);
    assert_refused(|| drop(c.probe_official(None)), "Ops budget is empty");
    assert!(c.probe.flight.is_none(), "a refused call leaves no flight behind");
    env_at(STUDIO, 0, T0 + 11);
    c.end_of_service();
    env_at(MIRA, 0, T0 + 12);
    assert_refused(|| drop(c.release(None)), "Ops budget is empty");
    let mut w = world(10_000_000_000);
    w.totals.ops_budget = 0;
    env_at(FANHOST, 0, REL + EP + 1);
    assert_refused(|| drop(w.claim_epoch(0, None)), "Ops budget is empty");
    assert!(store::host(&acct(FANHOST)).unwrap().flight.is_none());
    let mut b = booked();
    b.totals.ops_budget = 0;
    env_at(MIRA, 0, REL + 5 * EP);
    assert_refused(|| drop(b.sign_evm_payout(0)), "Ops budget is empty");
    assert_eq!(store::evm(0).unwrap().status, EvmStatus::Booked);
}

#[test]
fn zero_deposit_release_claim_and_signing_are_each_paid_from_the_budget() {
    let mut c = funded_four(100 * MILLI);
    env_at(STUDIO, 0, T0 + 10);
    c.end_of_service();
    env_at(KOFI, 0, T0 + 11);
    let _ = c.release(None);
    assert_eq!((deposit_of("request_execution"), c.totals.ops_budget), (Some(OPS_ATTACH), 100 * MILLI - OPS_ATTACH));
    let mut w = world(10_000_000_000);
    let b0 = w.totals.ops_budget;
    env_at(FANHOST, 0, REL + EP + 1);
    let _ = w.claim_epoch(0, None);
    let flag = b0 - OPS_ATTACH - w.totals.ops_budget;
    assert_eq!(deposit_of("request_execution"), Some(OPS_ATTACH));
    assert!(flag > 0 && flag < 2 * MILLI, "the once-per-epoch flag's storage also comes from ops: {flag}");
    let mut b = booked();
    let b0 = b.totals.ops_budget;
    let k = sign_start(&mut b, 0, REL + 5 * EP, false);
    let reserve = crate::evm::SIGNED_RESERVE_BYTES as u128 * env::storage_byte_cost().as_yoctonear();
    assert_eq!(b.totals.ops_budget, b0 - 1 - reserve, "the MPC fee and the storage reserve are set aside");
    assert!(sign_finish(&mut b, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    let spent = b0 - b.totals.ops_budget;
    assert!(spent > 1 && spent < reserve, "only the real storage growth stays spent: {spent}");
}

#[test]
fn a_dead_phase_sale_funds_ops_with_ten_percent() {
    let mut c = four();
    env_at(STUDIO, 0, T0 + 10);
    c.end_of_service();
    buy(&mut c, "lastsave-late.testnet", T0 + 20);
    assert!(c.totals.ops_budget > 20 * MILLI && c.totals.ops_budget < 25 * MILLI);
    let net = c.totals.pool + c.totals.ops_budget;
    assert_eq!(c.totals.ops_budget, net / 10, "the other 90% feeds the pool");
}

#[test]
fn every_gasless_method_fits_inside_250_tgas() {
    let limit = 250 * TGAS;
    // probe_official
    let mut c = funded_four(100 * MILLI);
    env_gas(MIRA, 0, T0 + 10, 250);
    let _ = c.probe_official(None);
    assert!(static_gas() <= limit, "probe_official {}", static_gas() / TGAS);
    // report_down (no promise)
    env_gas(KOFI, 0, T0 + 11, 250);
    c.report_down("2".into());
    // release
    env_gas(STUDIO, 0, T0 + 12, 250);
    c.end_of_service();
    env_gas(MIRA, 0, T0 + 13, 250);
    let _ = c.release(None);
    assert!(static_gas() <= limit, "release {}", static_gas() / TGAS);
    // claim_epoch, set_payout_evm, sign, bump, choose
    let mut w = world(10_000_000_000);
    env_gas(FANHOST, 0, REL + 4, 250);
    w.set_payout_evm(TO1.into());
    env_gas(FANHOST, 0, REL + EP + 1, 250);
    let _ = w.claim_epoch(0, None);
    assert!(static_gas() <= limit, "claim_epoch {}", static_gas() / TGAS);
    let mut b = booked();
    env_gas(MIRA, 0, REL + 5 * EP, 250);
    let _ = b.sign_evm_payout(0);
    assert!(static_gas() <= limit, "sign_evm_payout {}", static_gas() / TGAS);
    let k = crate::evm::EvmCb { flight: lock_flight(&b), id: 0, nonce: 0, max_fee: 2_000_000_000, max_prio: 1_000_000, bump: false };
    assert!(sign_finish(&mut b, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    env_gas(MIRA, 0, REL + 6 * EP, 250);
    let _ = b.bump_evm_payout(0);
    assert!(static_gas() <= limit, "bump_evm_payout {}", static_gas() / TGAS);
    // the whole chain, with the MPC call and its callback, is far below the ceiling
    assert!(static_gas() <= 100 * TGAS, "sign + callback {}", static_gas() / TGAS);
    let _ = env::used_gas();
}

#[test]
fn evm_settled_moves_only_when_claim_epoch_books() {
    let mut c = booked();
    let settled = c.totals.evm_settled;
    assert_eq!(settled, 20 * MILLI);
    let same = |c: &Licence, what: &str| assert_eq!(c.totals.evm_settled, settled, "{what} touched evm_settled");
    env_at(STUDIO, 5 * MILLI, REL + 100);
    c.fund_ops();
    same(&c, "fund_ops");
    buy(&mut c, "lastsave-late.testnet", REL + 101);
    same(&c, "buy_licence");
    env_at(KOFI, 10 * MILLI, REL + 102);
    c.add_mirror("probe".into(), "https://m.example.test/p.wasm".into());
    same(&c, "add_mirror");
    env_at(OTHERHOST, 10 * MILLI, REL + 103);
    c.register_host("https://other.example.test".into(), "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h".into());
    same(&c, "register_host");
    set_addr(&mut c, OTHERHOST, TO2);
    same(&c, "set_payout_evm");
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    same(&c, "sign_evm_payout");
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    same(&c, "on_evm_signed");
    let k = sign_start(&mut c, 0, REL + 6 * EP, true);
    assert!(sign_finish(&mut c, k, REL + 6 * EP, R::Json(sig_json(&vector("bumped")))));
    same(&c, "bump_evm_payout");
    // a NEAR-rail claim by a host with no ETH address leaves it alone too
    let mut c2 = world(10_000_000_000);
    claim(&mut c2, FANHOST, 0, 2);
    assert_eq!((c2.totals.evm_settled, c2.totals.paid_out), (0, 20 * MILLI));
    // and a second booking adds exactly its debit
    set_addr(&mut c, OTHERHOST, TO2);
    claim(&mut c, OTHERHOST, 3, 1);
    assert_eq!(c.totals.evm_settled, settled + 10 * MILLI);
}

/// No code path can lower or reassign evm_settled: it appears with `+=` exactly once (the
/// booking in hosts.rs) and is never decremented or assigned anywhere else in the contract.
#[test]
fn source_has_no_way_to_move_evm_settled_out() {
    let files: [(&str, &str); 20] = [
        ("afterlife", include_str!("../afterlife.rs")),
        ("approvals", include_str!("../approvals.rs")),
        ("config", include_str!("../config.rs")),
        ("events", include_str!("../events.rs")),
        ("evm", include_str!("../evm.rs")),
        ("evm_sig", include_str!("../evm_sig.rs")),
        ("hosts", include_str!("../hosts.rs")),
        ("lib", include_str!("../lib.rs")),
        ("liveness", include_str!("../liveness.rs")),
        ("nft", include_str!("../nft.rs")),
        ("ops", include_str!("../ops.rs")),
        ("outlayer", include_str!("../outlayer.rs")),
        ("release", include_str!("../release.rs")),
        ("rlp", include_str!("../rlp.rs")),
        ("sale", include_str!("../sale.rs")),
        ("store", include_str!("../store.rs")),
        ("types", include_str!("../types.rs")),
        ("util", include_str!("../util.rs")),
        ("view_types", include_str!("../view_types.rs")),
        ("views", include_str!("../views.rs")),
    ];
    let mut adds = vec![];
    for (name, src) in files {
        for line in src.lines().filter(|l| l.contains("evm_settled") && !l.trim_start().starts_with("//")) {
            let l = line.replace(' ', "");
            assert!(!l.contains("evm_settled-=") && !l.contains("evm_settled="), "{name}: {line}");
            assert!(!l.contains("&mutself.totals.evm_settled") && !l.contains("mem::"), "{name}: {line}");
            if l.contains("evm_settled+=") {
                adds.push(name);
            }
        }
    }
    assert_eq!(adds, vec!["hosts"], "evm_settled is credited only by claim booking");
}
