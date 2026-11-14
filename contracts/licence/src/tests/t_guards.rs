//! Review fixes: ops-budget drain limits, sync_ops, bump gap and cap clamp, the signing storage
//! reserve, the parity retry and overflow-safe fee arithmetic.

use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{env, Gas};

use super::t_evm::*;
use super::t_rlp::{sig_json, vector, Vector};
use super::*;
use crate::ops::{OPS_ATTACH, OPS_RELEASE_GAP_MS};

fn env_bal(pred: &str, deposit: u128, t_ms: u64, balance: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(LICENCE))
        .predecessor_account_id(acct(pred))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_yoctonear(balance))
        .prepaid_gas(Gas::from_tgas(300))
        .block_timestamp(t_ms * 1_000_000);
    testing_env!(b.build());
}

fn funded_four() -> Licence {
    let mut c = four();
    env_at(STUDIO, 100 * MILLI, T0 + 1);
    c.fund_ops();
    c
}

// ---- 1a probe spacing

#[test]
fn budget_paid_probes_are_spaced_by_the_probe_interval() {
    let mut c = funded_four();
    let gap = c.cfg.liveness.probe_interval_ms;
    env_at(MIRA, 0, T0 + 10);
    let _ = c.probe_official(None);
    let b = c.totals.ops_budget;
    // the first one is still in flight, then it finishes; a second one inside the interval is refused
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0 + 11, j(ALIVE));
    c.on_probe(Cb { flight: id, ..cb(id, MIRA) }.funded(true));
    env_at(KOFI, 0, T0 + 10 + gap - 1);
    assert_refused(|| drop(c.probe_official(None)), "ran recently");
    assert_eq!(c.totals.ops_budget, b, "a refused call spends nothing");
    // with a deposit there is no spacing
    env_at(KOFI, 10 * MILLI, T0 + 12);
    let _ = c.probe_official(None);
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0 + 13, j(ALIVE));
    c.on_probe(cb(id, KOFI));
    // after the interval a budget-paid probe is fine again
    env_at(KOFI, 0, T0 + 13 + gap);
    let _ = c.probe_official(None);
}

// ---- 1b claims once per (host, epoch)

#[test]
fn a_budget_paid_claim_is_allowed_once_per_host_and_epoch() {
    let mut c = world(10_000_000_000);
    let t = REL + EP + 1;
    env_at(FANHOST, 0, t);
    let _ = c.claim_epoch(0, None);
    let f = store::host(&acct(FANHOST)).unwrap().flight.unwrap().id;
    env_cb(t, R::Null); // the enclave run failed: it can not be retried on the budget
    c.on_claim(Cb { host: Some(acct(FANHOST)), epoch: 0, ..cb(f, FANHOST) }.funded(true));
    let b = c.totals.ops_budget;
    env_at(FANHOST, 0, t + 1);
    assert_refused(|| drop(c.claim_epoch(0, None)), "Gas-free claim already used");
    assert_eq!(c.totals.ops_budget, b);
    env_at(OTHERHOST, 0, t + 1);
    let _ = c.claim_epoch(0, None); // another host is unaffected
    env_at(FANHOST, 10 * MILLI, t + 2);
    let _ = c.claim_epoch(0, None); // retry with a deposit is always possible
    assert_eq!(store::host(&acct(FANHOST)).unwrap().flight.is_some(), true);
}

// ---- 1c release

#[test]
fn a_budget_paid_release_waits_for_the_flight_and_a_minute_between_tries() {
    let mut c = funded_four();
    env_at(STUDIO, 0, T0 + 5);
    c.end_of_service();
    env_at(KOFI, 0, T0 + 10);
    let _ = c.release(None);
    env_at(KOFI, 0, T0 + 11);
    assert_refused(|| drop(c.release(None)), "already running");
    let id = c.release.flight.clone().unwrap().id;
    env_cb(T0 + 12, R::Null);
    c.on_release(Cb { flight: id, ..cb(id, KOFI) }.funded(true));
    env_at(KOFI, 0, T0 + 10 + OPS_RELEASE_GAP_MS - 1);
    assert_refused(|| drop(c.release(None)), "ran recently");
    env_at(KOFI, 10 * MILLI, T0 + 20);
    let _ = c.release(None); // a paid retry is never blocked
    let id = c.release.flight.clone().unwrap().id;
    env_cb(T0 + 21, R::Null);
    c.on_release(cb(id, KOFI));
    env_at(KOFI, 0, T0 + 10 + OPS_RELEASE_GAP_MS);
    let _ = c.release(None);
}

// ---- 1d sync_ops

fn solvent_sum(c: &Licence) -> u128 {
    c.tracked()
}

#[test]
fn sync_ops_only_adds_the_strict_surplus_and_never_touches_other_buckets() {
    let storage = |c: &Licence| {
        env_bal(MIRA, 0, T0, 0);
        let _ = c;
        env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear()
    };
    for (in_flight, reserve, surplus) in [(0u128, 0u128, 0u128), (7 * MILLI, 0, 0), (0, 3 * MILLI, 0), (7 * MILLI, 3 * MILLI, 500 * MILLI), (0, 0, 1)] {
        let mut c = four();
        c.in_flight = in_flight;
        c.totals.pool = 33 * MILLI;
        c.totals.evm_settled = 21 * MILLI;
        c.totals.ops_budget = 5 * MILLI;
        if reserve > 0 {
            c.evm_lock = Some(crate::EvmLock { flight: crate::Flight { started_ms: T0, id: 99 }, payout: 0, reserve });
        }
        let (pot, pool, evm, flight) = (c.totals.pot_locked, c.totals.pool, c.totals.evm_settled, c.in_flight);
        let tracked = solvent_sum(&c);
        env_bal(MIRA, 0, T0, 0);
        let balance = storage(&c) + tracked + surplus;
        env_bal(MIRA, 0, T0, balance);
        assert_eq!(c.sync_ops().0, surplus);
        assert_eq!((c.totals.pot_locked, c.totals.pool, c.totals.evm_settled, c.in_flight), (pot, pool, evm, flight), "buckets untouched");
        assert_eq!(c.totals.ops_budget, 5 * MILLI + surplus);
        assert!(solvent_sum(&c) <= balance - storage(&c) || surplus == 0, "never books more than the contract holds");
        env_bal(MIRA, 0, T0, balance);
        assert_eq!(c.sync_ops().0, 0, "a second call finds nothing");
    }
}

#[test]
fn sync_ops_does_nothing_when_the_balance_does_not_cover_the_buckets() {
    let mut c = four();
    let tracked = c.tracked();
    env_bal(MIRA, 0, T0, 0);
    let storage = env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear();
    for balance in [0, storage / 2, storage, storage + tracked / 2, storage + tracked - 1, storage + tracked] {
        env_bal(MIRA, 0, T0, balance);
        let before = c.totals.ops_budget;
        assert_eq!(c.sync_ops().0, 0, "balance {balance}");
        assert_eq!(c.totals.ops_budget, before);
    }
}

#[test]
fn money_that_may_still_bounce_back_is_never_swept_into_ops() {
    // a pot refund in flight: pot_locked is already lowered, the money is still in the balance
    let mut c = four();
    dead_and_released(&mut c, T0 + 5);
    env_bal(MIRA, 0, T0 + 50, 0);
    let storage = env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear();
    let before_choose = c.tracked();
    env_at(MIRA, 0, T0 + 51);
    let _ = c.choose("1".into(), Choice::Refund);
    assert_eq!(c.in_flight, POT);
    assert_eq!(c.tracked(), before_choose, "moving pot to in_flight keeps every yocto accounted");
    env_bal(MIRA, 0, T0 + 52, storage + before_choose);
    assert_eq!(c.sync_ops().0, 0, "the refund in flight is not surplus");
    // the transfer bounces: the callback restores the pot and the books still balance
    env_cb(T0 + 53, R::Failed);
    assert!(!c.on_refund(Cb { token: 1, deposit: POT, payer: acct(MIRA), ..cb(0, MIRA) }));
    assert_eq!((c.in_flight, c.tracked()), (0, before_choose));
}

#[test]
fn in_flight_deposits_are_tracked_for_every_enclave_call_and_cleared_by_its_callback() {
    let mut c = funded_four();
    env_at(MIRA, 0, T0 + 10);
    let _ = c.probe_official(None);
    assert_eq!(c.in_flight, OPS_ATTACH);
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0 + 11, R::Failed);
    c.on_probe(Cb { flight: id, ..cb(id, MIRA) }.funded(true));
    assert_eq!(c.in_flight, 0);
    env_at(MIRA, 10 * MILLI, T0 + 40);
    let _ = c.probe_official(None);
    assert_eq!(c.in_flight, 10 * MILLI);
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0 + 41, j(ALIVE));
    c.on_probe(cb(id, MIRA));
    assert_eq!(c.in_flight, 0);
}

// ---- 2 and 3: bump gap and clamp

fn signed_world(cap: u128) -> Licence {
    let mut c = world(cap);
    set_addr(&mut c, FANHOST, TO1);
    claim(&mut c, FANHOST, 0, 2);
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    c
}

#[test]
fn a_bump_needs_the_previous_signature_to_be_two_minutes_old() {
    let mut c = signed_world(10_000_000_000);
    assert_eq!(store::evm(0).unwrap().last_signed_ms, REL + 5 * EP);
    env_at(MIRA, 0, REL + 5 * EP + 119_999);
    assert_refused(|| drop(c.bump_evm_payout(0)), "Wait 2 minutes");
    env_at(MIRA, 0, REL + 5 * EP + 120_000);
    let _ = c.bump_evm_payout(0);
    assert_eq!(store::evm(0).unwrap().status, EvmStatus::Signing);
    env_at(MIRA, 0, REL + 6 * EP);
    assert_eq!(c.get_evm_payouts(0, 1)[0].last_signed_ms, REL + 5 * EP);
}

#[test]
fn near_the_cap_a_bump_is_clamped_to_the_cap_when_it_still_gives_ten_percent() {
    // x1.25 would be 2.5 gwei; the cap 2.4 gwei is +20%: sign at exactly the cap
    let mut c = signed_world(2_400_000_000);
    let k = sign_start(&mut c, 0, REL + 6 * EP, true);
    assert_eq!((k.max_fee, k.max_prio), (2_400_000_000, 1_250_000));
    let tx = crate::rlp::Tx1559 { nonce: 0, max_priority_fee: 1_250_000, max_fee: 2_400_000_000, gas_limit: 21_000, to: store::evm(0).unwrap().to, value: 2 * WEI };
    let want = hex::encode(tx.payload());
    assert!(calls().iter().any(|c| c.1 == "sign" && c.2.contains(&want)), "the signed payload carries the clamped fee");
    // a +5% cap is not enough for a replacement
    let mut c = signed_world(2_100_000_000);
    env_at(MIRA, 0, REL + 6 * EP);
    assert_refused(|| drop(c.bump_evm_payout(0)), "Fee cap reached");
    // at the cap already: nothing left
    let mut c = signed_world(2_400_000_000);
    let mut p = store::evm(0).unwrap();
    p.max_fee = 2_400_000_000;
    p.status = EvmStatus::Signed;
    store::set_evm(&p);
    env_at(MIRA, 0, REL + 9 * EP);
    assert_refused(|| drop(c.bump_evm_payout(0)), "Fee cap reached");
}

#[test]
fn fee_arithmetic_cannot_overflow() {
    use crate::evm::bumped;
    assert_eq!(bumped(u128::MAX), u128::MAX);
    assert_eq!(bumped(u128::MAX / 100 * 90), u128::MAX);
    assert_eq!(bumped(100), 125);
}

// ---- 4 storage reserve

#[test]
fn signing_needs_budget_for_its_storage_and_the_real_growth_fits_the_reserve() {
    let mut c = booked();
    let reserve = crate::evm::SIGNED_RESERVE_BYTES as u128 * env::storage_byte_cost().as_yoctonear();
    c.totals.ops_budget = reserve; // enough for the reserve but not the 1 yocto fee on top
    env_at(MIRA, 0, REL + 5 * EP);
    assert_refused(|| drop(c.sign_evm_payout(0)), "Ops budget is empty");
    assert_eq!((c.totals.ops_budget, store::evm(0).unwrap().status), (reserve, EvmStatus::Booked), "a refusal changes nothing");
    // an attached deposit joins the budget and pays
    env_at(MIRA, 1, REL + 5 * EP); // the deposit tops the budget up to reserve + 1
    let _ = c.sign_evm_payout(0);
    assert_eq!(c.totals.ops_budget, 0);
    let k = crate::evm::EvmCb { flight: lock_flight(&c), id: 0, nonce: 0, max_fee: 2_000_000_000, max_prio: 1_000_000, bump: false };
    assert_eq!(c.evm_lock.as_ref().unwrap().reserve, reserve);
    // a signer failure returns the reserve (the 1 yocto fee is spent)
    assert!(!sign_finish(&mut c, k, REL + 5 * EP, R::Failed));
    assert_eq!(c.totals.ops_budget, reserve);
    // the widest vector's real storage growth is below the reserve
    for name in ["small", "wide", "bumped", "short-int"] {
        let v = vector(name);
        let mut w = world(10_000_000_000);
        let mut p = EvmPayout { id: 0, host_id: acct(FANHOST), epoch: 0, to: v.tx.to, verified: 1, value_wei: v.tx.value, near_debited: 1, nonce: None, status: EvmStatus::Booked, max_fee: v.tx.max_fee, max_prio: v.tx.max_priority_fee, signed: vec![], hashes: vec![], booked_ms: 0, last_signed_ms: 0, last_error: None };
        store::set_evm(&p);
        w.evm_count = 1;
        w.next_evm_nonce = v.tx.nonce;
        let before = env::storage_usage();
        p.signed.push(v.raw.clone());
        p.hashes.push([0; 32]);
        p.nonce = Some(v.tx.nonce);
        p.status = EvmStatus::Signed;
        store::set_evm(&p);
        let growth = env::storage_usage() - before;
        assert!(growth < crate::evm::SIGNED_RESERVE_BYTES, "{name}: grew {growth} bytes");
    }
}

#[test]
fn a_stale_signing_returns_its_reserve_to_the_budget() {
    let mut c = booked();
    let b0 = c.totals.ops_budget;
    let _ = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(c.totals.ops_budget < b0);
    env_at(MIRA, 0, REL + 5 * EP + 600_000);
    let _ = c.sign_evm_payout(0); // takes over the stale lock, returns its reserve, pays a new one
    let reserve = crate::evm::SIGNED_RESERVE_BYTES as u128 * env::storage_byte_cost().as_yoctonear();
    assert_eq!(c.totals.ops_budget, b0 - 2 - reserve);
}

// ---- 6 parity retry

#[test]
fn a_signer_reply_with_the_other_parity_is_still_accepted() {
    let mut c = booked();
    let v = vector("small");
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    let flipped = Vector { y: v.y ^ 1, ..vector("small") };
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&flipped))));
    assert_eq!(store::evm(0).unwrap().signed[0], v.raw, "stored tx carries the parity that really recovers to the payer");
}
