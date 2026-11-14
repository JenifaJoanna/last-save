//! EVM payouts: booking, signing, retry, the one-at-a-time lock, bumps and the guards.

use near_sdk::mock::MockAction;
use near_sdk::test_utils::get_created_receipts;

use super::t_rlp::{sig_json, signer_address, vector};
use super::*;
use crate::evm::EvmCb;

pub const REL: u64 = T0 + 10;
pub const EP: u64 = 120_000;
pub const TO1: &str = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
pub const TO2: &str = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
pub const WEI: u128 = 10_000_000_000_000; // demo_wei_per_session (1e13)

pub fn evm_cfg(cap: u128) -> InitConfig {
    InitConfig {
        evm_payout: Some(EvmCfg {
            mpc: acct("v1.signer-prod.testnet"),
            path: "lastsave/host-payouts".into(),
            address: signer_address(),
            demo_wei_per_session: near_sdk::json_types::U128(WEI),
            max_fee_per_gas: near_sdk::json_types::U128(2_000_000_000),
            max_priority_fee_per_gas: near_sdk::json_types::U128(1_000_000),
            max_fee_cap: near_sdk::json_types::U128(cap),
            gas_limit: 21_000,
            start_nonce: 0,
        }),
        ..cfg()
    }
}

/// Dead, released, pool 0.2 N (two pledges), two registered hosts, ops budget funded with 1 N.
pub fn world(cap: u128) -> Licence {
    let mut c = fresh_with(evm_cfg(cap));
    env_at(STUDIO, 50 * MILLI, T0);
    let _ = c.escrow_key("QUJDRA==".into());
    let id = c.escrow.flight.clone().unwrap().id;
    env_cb(T0, R::Empty);
    assert!(c.on_escrow(cb(id, STUDIO)));
    for w in [MIRA, KOFI, YUNA, DARIO] {
        buy(&mut c, w, T0);
    }
    dead_and_released(&mut c, REL);
    for (k, w) in [YUNA, DARIO].iter().enumerate() {
        env_at(w, 0, REL + 1);
        c.choose((k + 3).to_string(), Choice::Pledge);
    }
    for h in [FANHOST, OTHERHOST] {
        env_at(h, 10 * MILLI, REL + 2);
        c.register_host(format!("https://{}.example.test", h.split('.').next().unwrap()), "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h".into());
    }
    env_at(STUDIO, N, REL + 3);
    c.fund_ops();
    c
}

pub fn set_addr(c: &mut Licence, host: &str, addr: &str) {
    env_at(host, 0, REL + 3);
    c.set_payout_evm(addr.into());
}

/// A whole claim round trip for `epoch` with `verified` sessions; the epoch is complete at REL+EP*(epoch+1).
pub fn claim(c: &mut Licence, host: &str, epoch: u64, verified: u64) {
    let t = REL + EP * (epoch + 1) + 1;
    env_at(host, 10 * MILLI, t);
    let _ = c.claim_epoch(epoch, None);
    let f = store::host(&acct(host)).unwrap().flight.unwrap().id;
    let out = format!(r#"{{"ok":true,"mode":"host","reachable":true,"build_ok":true,"verified":{verified},"rejected":0}}"#);
    env_cb(t, R::Json(out));
    c.on_claim(Cb { host: Some(acct(host)), epoch, ..cb(f, host) });
}

pub fn lock_flight(c: &Licence) -> u64 {
    c.evm_lock.as_ref().expect("a signing is running").flight.id
}

/// Starts a signing with a zero deposit; returns the callback context.
pub fn sign_start(c: &mut Licence, id: u64, t: u64, bump: bool) -> EvmCb {
    env_at(MIRA, 0, t);
    let _ = if bump { c.bump_evm_payout(id) } else { c.sign_evm_payout(id) };
    let p = store::evm(id).unwrap();
    let fee = if bump { crate::evm::bumped(p.max_fee) } else { p.max_fee };
    let prio = if bump { crate::evm::bumped(p.max_prio).min(fee) } else { p.max_prio };
    EvmCb { flight: lock_flight(c), id, nonce: p.nonce.unwrap(), max_fee: fee, max_prio: prio, bump }
}

pub fn sign_finish(c: &mut Licence, k: EvmCb, t: u64, r: R) -> bool {
    env_cb(t, r);
    c.on_evm_signed(k)
}

/// Books payout 0 for FANHOST (to TO1, 2 sessions = 2e13 wei, 20 milli NEAR).
pub fn booked() -> Licence {
    let mut c = world(10_000_000_000);
    set_addr(&mut c, FANHOST, TO1);
    claim(&mut c, FANHOST, 0, 2);
    c
}

pub fn deposit_of(method: &str) -> Option<u128> {
    get_created_receipts().iter().find_map(|r| {
        r.actions.iter().find_map(|a| match a {
            MockAction::FunctionCallWeight { method_name, attached_deposit, .. } if method_name == method.as_bytes() => Some(attached_deposit.as_yoctonear()),
            _ => None,
        })
    })
}

#[test]
fn claim_books_an_eth_payout_instead_of_paying_near() {
    let mut c = world(10_000_000_000);
    set_addr(&mut c, FANHOST, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    let pool0 = c.totals.pool;
    claim(&mut c, FANHOST, 0, 2);
    assert!(transfers().is_empty(), "no NEAR goes to the host");
    let p = store::evm(0).unwrap();
    assert_eq!((p.status, p.nonce, p.epoch, p.verified), (EvmStatus::Booked, None, 0, 2));
    assert_eq!((hex::encode(p.to), p.value_wei, p.near_debited), (TO1[2..].to_string(), 2 * WEI, 20 * MILLI));
    assert_eq!((c.totals.evm_settled, c.totals.paid_out), (20 * MILLI, 0));
    let spent = pool0 - c.totals.pool;
    assert!(spent >= 20 * MILLI && spent < 25 * MILLI, "pool fell by pay plus record storage: {spent}");
    assert!(logs_have("evm_booked") && logs_have("epoch_claimed"));
    env_at(MIRA, 0, REL + 9 * EP);
    let v = c.get_evm_payouts(0, 10);
    assert_eq!((v.len(), v[0].status.as_str(), v[0].to.as_str()), (1, "Booked", TO1));
    assert_eq!(c.get_claims(0, 10)[0].evm_payout, Some(0));
    assert_eq!(c.get_hosts()[0].evm_address.as_deref(), Some(TO1));
}

#[test]
fn caps_and_rules_are_the_same_as_the_near_rail() {
    // epoch_cap 50 milli: 9 verified sessions pay 50 milli = 5 sessions, not 9
    let mut c = world(10_000_000_000);
    set_addr(&mut c, FANHOST, TO1);
    claim(&mut c, FANHOST, 0, 9);
    let p = store::evm(0).unwrap();
    assert_eq!((p.near_debited, p.value_wei), (50 * MILLI, 5 * WEI));
    // zero verified sessions book nothing
    let mut c = world(10_000_000_000);
    set_addr(&mut c, FANHOST, TO1);
    claim(&mut c, FANHOST, 0, 0);
    assert_eq!((c.evm_count, c.totals.evm_settled), (0, 0));
    assert!(!store::epoch_paid(&acct(FANHOST), 0));
    // pool smaller than one session books nothing and leaves no record
    let mut c = world(10_000_000_000);
    set_addr(&mut c, FANHOST, TO1);
    c.totals.pool = 12 * MILLI; // storage reserve leaves less than 10 milli
    claim(&mut c, FANHOST, 0, 2);
    assert_eq!((c.evm_count, c.totals.evm_settled, c.claim_count), (0, 0, 0));
    assert!(!store::epoch_paid(&acct(FANHOST), 0));
}

#[test]
fn an_epoch_pays_exactly_once_on_either_rail() {
    let mut c = booked();
    env_at(FANHOST, 10 * MILLI, REL + 3 * EP);
    assert_refused(|| drop(c.claim_epoch(0, None)), "already paid");
    assert_eq!((c.evm_count, c.totals.evm_settled), (1, 20 * MILLI));
    // the reverse: paid in NEAR first, then an ETH address is set, the epoch is still closed
    let mut c = world(10_000_000_000);
    claim(&mut c, OTHERHOST, 0, 2);
    assert_eq!(c.totals.paid_out, 20 * MILLI);
    set_addr(&mut c, OTHERHOST, TO2);
    env_at(OTHERHOST, 10 * MILLI, REL + 3 * EP);
    assert_refused(|| drop(c.claim_epoch(0, None)), "already paid");
    assert_eq!((c.evm_count, c.totals.evm_settled), (0, 0));
    // a claim whose callback lands after another already paid the epoch pays nothing more
    let mut c = world(10_000_000_000);
    set_addr(&mut c, FANHOST, TO1);
    let t = REL + EP + 1;
    env_at(FANHOST, 10 * MILLI, t);
    let _ = c.claim_epoch(0, None);
    let f = store::host(&acct(FANHOST)).unwrap().flight.unwrap().id;
    store::set_epoch_paid(&acct(FANHOST), 0);
    env_cb(t, j(r#"{"ok":true,"mode":"host","reachable":true,"build_ok":true,"verified":2}"#));
    c.on_claim(Cb { host: Some(acct(FANHOST)), epoch: 0, ..cb(f, FANHOST) });
    assert_eq!((c.evm_count, c.totals.evm_settled, c.totals.paid_out), (0, 0, 0));
}

#[test]
fn signing_stores_a_relayable_raw_tx_that_matches_ethers() {
    let mut c = booked();
    let v = vector("small");
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert_eq!(c.get_evm_payouts(0, 1)[0].status, "Signing");
    let calls = calls();
    let (to, method, args) = calls.iter().find(|x| x.1 == "sign").unwrap();
    assert_eq!((to.as_str(), method.as_str()), ("v1.signer-prod.testnet", "sign"));
    let want = format!(
        r#"{{"request":{{"path":"lastsave/host-payouts","payload_v2":{{"Ecdsa":"{}"}},"domain_id":0}}}}"#,
        hex::encode(v.payload)
    );
    assert_eq!(args, &want);
    assert_eq!(deposit_of("sign"), Some(1), "the MPC fee is 1 yocto");
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&v))));
    assert!(c.evm_lock.is_none() && logs_have("evm_signed"));
    env_at(MIRA, 0, REL + 6 * EP);
    let p = &c.get_evm_payouts(0, 1)[0];
    assert_eq!((p.status.as_str(), p.nonce), ("Signed", Some(0)));
    assert_eq!(p.signed_tx.as_deref(), Some(format!("0x{}", hex::encode(&v.raw)).as_str()));
    assert_eq!(p.signed_txs, vec![p.signed_tx.clone().unwrap()]);
    assert_eq!(p.tx_hash.as_deref(), Some(format!("0x{}", hex::encode(v.tx_hash)).as_str()));
    assert_eq!(c.evm_payout_info().unwrap().next_nonce, 1);
}

#[test]
fn a_signed_payout_cannot_be_signed_again_and_the_nonce_is_kept() {
    let mut c = booked();
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    env_at(MIRA, 0, REL + 6 * EP);
    assert_refused(|| drop(c.sign_evm_payout(0)), "Already signed");
    assert_refused(|| drop(c.sign_evm_payout(7)), "No such payout");
    assert_eq!(c.next_evm_nonce, 1);
}

#[test]
fn signer_failures_return_to_booked_without_using_the_nonce_and_can_retry() {
    for r in [R::Failed, R::Null, R::Json("{}".into()), R::Empty] {
        let mut c = booked();
        let k = sign_start(&mut c, 0, REL + 5 * EP, false);
        assert!(!sign_finish(&mut c, k, REL + 5 * EP, r));
        let p = store::evm(0).unwrap();
        assert_eq!((p.status, p.nonce, p.signed.len()), (EvmStatus::Booked, None, 0));
        assert!(p.last_error.is_some());
        assert_eq!((c.next_evm_nonce, c.evm_lock.is_none()), (0, true));
        let k = sign_start(&mut c, 0, REL + 6 * EP, false);
        assert!(sign_finish(&mut c, k, REL + 6 * EP, R::Json(sig_json(&vector("small")))));
        assert_eq!(store::evm(0).unwrap().status, EvmStatus::Signed);
    }
}

#[test]
fn a_signature_that_does_not_recover_to_the_payer_is_never_stored() {
    let mut c = booked();
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    // a valid signature, but over another transaction's hash
    assert!(!sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("wide")))));
    let p = store::evm(0).unwrap();
    assert_eq!((p.status, p.signed.len(), c.next_evm_nonce), (EvmStatus::Booked, 0, 0));
    assert!(p.last_error.unwrap().contains("payer"));
}

#[test]
fn only_one_payout_signs_at_a_time_but_signing_never_waits_for_confirmation() {
    let mut c = booked();
    set_addr(&mut c, OTHERHOST, TO2);
    claim(&mut c, OTHERHOST, 0, 2);
    let k0 = sign_start(&mut c, 0, REL + 5 * EP, false);
    env_at(KOFI, 0, REL + 5 * EP + 1);
    assert_refused(|| drop(c.sign_evm_payout(1)), "Another payout is being signed");
    assert_refused(|| drop(c.bump_evm_payout(0)), "Another payout is being signed");
    assert!(sign_finish(&mut c, k0, REL + 5 * EP + 2, R::Json(sig_json(&vector("small")))));
    // payout 0 is Signed (never confirmed); payout 1 signs at the next nonce anyway
    let k1 = sign_start(&mut c, 1, REL + 5 * EP + 3, false);
    assert_eq!(k1.nonce, 1);
    assert!(sign_finish(&mut c, k1, REL + 5 * EP + 4, R::Json(sig_json(&vector("second")))));
    env_at(MIRA, 0, REL + 6 * EP);
    let v = c.get_evm_payouts(0, 10);
    assert_eq!((v[0].status.as_str(), v[1].status.as_str(), v[1].nonce), ("Signed", "Signed", Some(1)));
    assert_eq!(c.evm_payout_info().unwrap().next_nonce, 2);
}

#[test]
fn a_stuck_signing_is_released_after_ten_minutes_and_its_late_callback_is_ignored() {
    let mut c = booked();
    let stale = sign_start(&mut c, 0, REL + 5 * EP, false);
    env_at(MIRA, 0, REL + 5 * EP + 599_000);
    assert_refused(|| drop(c.sign_evm_payout(0)), "Another payout is being signed");
    let fresh = sign_start(&mut c, 0, REL + 5 * EP + 600_000, false);
    assert_ne!(stale.flight, fresh.flight);
    assert!(!sign_finish(&mut c, stale, REL + 5 * EP + 600_001, R::Json(sig_json(&vector("small")))), "late result is ignored");
    assert_eq!(store::evm(0).unwrap().status, EvmStatus::Signing);
    assert!(sign_finish(&mut c, fresh, REL + 5 * EP + 600_002, R::Json(sig_json(&vector("small")))));
    assert_eq!(store::evm(0).unwrap().status, EvmStatus::Signed);
}

