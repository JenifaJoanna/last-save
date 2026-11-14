//! EVM payouts: fee bumps, host address setting and config validation.

use super::t_evm::*;
use super::t_rlp::{sig_json, signer_address, vector};
use super::*;

#[test]
fn bump_resigns_at_the_same_nonce_to_and_value_with_a_higher_fee_and_keeps_history() {
    let mut c = booked();
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    env_at(MIRA, 0, REL + 5 * EP + 1);
    assert_refused(|| drop(c.bump_evm_payout(3)), "No such payout");
    let k = sign_start(&mut c, 0, REL + 6 * EP, true);
    assert_eq!((k.nonce, k.max_fee, k.max_prio), (0, 2_500_000_000, 1_250_000));
    assert!(sign_finish(&mut c, k, REL + 6 * EP, R::Json(sig_json(&vector("bumped")))));
    env_at(MIRA, 0, REL + 7 * EP);
    let p = &c.get_evm_payouts(0, 1)[0];
    assert_eq!((p.status.as_str(), p.nonce, p.to.as_str(), p.value_wei.0), ("Signed", Some(0), TO1, 2 * WEI));
    assert_eq!((p.max_fee_per_gas.0, p.max_priority_fee_per_gas.0), (2_500_000_000, 1_250_000));
    assert_eq!(p.signed_txs.len(), 2);
    assert_eq!(p.signed_txs[0], format!("0x{}", hex::encode(vector("small").raw)), "oldest first");
    assert_eq!(p.signed_tx.as_deref(), Some(p.signed_txs[1].as_str()), "signed_tx is the newest");
    assert_eq!(p.signed_tx.as_deref(), Some(format!("0x{}", hex::encode(vector("bumped").raw)).as_str()));
    assert_eq!(p.tx_hashes.len(), 2);
    assert_eq!(c.next_evm_nonce, 1, "a bump never takes a new nonce");
}

#[test]
fn bump_needs_a_signed_payout_respects_the_cap_and_a_failed_bump_changes_nothing() {
    let mut c = booked();
    env_at(MIRA, 0, REL + 5 * EP);
    assert_refused(|| drop(c.bump_evm_payout(0)), "Nothing signed to bump");
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    let before = c.get_evm_payouts(0, 1)[0].signed_txs.clone();
    let k = sign_start(&mut c, 0, REL + 6 * EP, true);
    assert!(!sign_finish(&mut c, k, REL + 6 * EP, R::Failed));
    let p = store::evm(0).unwrap();
    assert_eq!((p.status, p.max_fee, p.signed.len()), (EvmStatus::Signed, 2_000_000_000, 1));
    env_at(MIRA, 0, REL + 7 * EP);
    assert_eq!(c.get_evm_payouts(0, 1)[0].signed_txs, before);
    // cap 2.1 gwei: x1.25 would be 2.5 gwei and the cap leaves less than the +10% a replacement needs (2.2)
    let mut c = world(2_100_000_000);
    set_addr(&mut c, FANHOST, TO1);
    claim(&mut c, FANHOST, 0, 2);
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    env_at(MIRA, 0, REL + 6 * EP);
    assert_refused(|| drop(c.bump_evm_payout(0)), "Fee cap reached");
}

#[test]
fn bump_fee_arithmetic_is_strictly_higher_and_bumps_are_limited() {
    use crate::evm::bumped;
    assert_eq!((bumped(2_000_000_000), bumped(1_000_000), bumped(1), bumped(0)), (2_500_000_000, 1_250_000, 2, 1));
    assert_eq!(bumped(3), 4);
    let mut c = booked();
    let k = sign_start(&mut c, 0, REL + 5 * EP, false);
    assert!(sign_finish(&mut c, k, REL + 5 * EP, R::Json(sig_json(&vector("small")))));
    let mut p = store::evm(0).unwrap();
    p.signed = vec![vec![1]; crate::evm::MAX_BUMPS + 1];
    store::set_evm(&p);
    env_at(MIRA, 0, REL + 6 * EP);
    assert_refused(|| drop(c.bump_evm_payout(0)), "Too many bumps");
}

#[test]
fn set_payout_evm_is_the_callers_own_record_and_validated() {
    let mut c = world(10_000_000_000);
    env_at(DARIO, 0, REL + 3);
    assert_refused(|| c.set_payout_evm(TO1.into()), "Register as a host first");
    for bad in ["", "70997970c51812dc3a010c7d01b50e0d17dc79c8", "0x1234", "0xzz997970c51812dc3a010c7d01b50e0d17dc79c8"] {
        env_at(FANHOST, 0, REL + 3);
        assert_refused(|| c.set_payout_evm(bad.into()), "0x plus 40 hex");
    }
    set_addr(&mut c, FANHOST, TO1);
    set_addr(&mut c, OTHERHOST, TO2);
    let hs = c.get_hosts();
    let of = |id: &str| hs.iter().find(|h| h.host_id.as_str() == id).unwrap().evm_address.clone();
    assert_eq!((of(FANHOST).as_deref(), of(OTHERHOST).as_deref()), (Some(TO1), Some(TO2)));
    // B setting an address never touches A's
    set_addr(&mut c, OTHERHOST, "0x0000000000000000000000000000000000000001");
    assert_eq!(c.get_hosts().iter().find(|h| h.host_id.as_str() == FANHOST).unwrap().evm_address.as_deref(), Some(TO1));
    // disabled config
    let mut off = four_released_without_evm();
    env_at(FANHOST, 0, REL + 3);
    assert_refused(|| off.set_payout_evm(TO1.into()), "not enabled");
}

fn four_released_without_evm() -> Licence {
    let mut c = four();
    dead_and_released(&mut c, REL);
    env_at(FANHOST, 10 * MILLI, REL + 2);
    c.register_host("https://a.example.test".into(), "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h".into());
    c
}

#[test]
fn evm_info_reports_the_derivation_inputs() {
    let c = world(10_000_000_000);
    env_at(MIRA, 0, REL + 9);
    let i = c.evm_payout_info().unwrap();
    assert_eq!((i.address.as_str(), i.mpc.as_str(), i.path.as_str()), (signer_address().as_str(), "v1.signer-prod.testnet", "lastsave/host-payouts"));
    assert_eq!((i.chain_id, i.derivation_account.as_str(), i.domain_id, i.next_nonce), (84532, LICENCE, 0, 0));
    assert_eq!(i.demo_wei_per_session.0, WEI);
    assert!(four_released_without_evm().evm_payout_info().is_none());
}

#[test]
fn init_rejects_bad_evm_config() {
    for tweak in 0..9 {
        let mut c = evm_cfg(10_000_000_000);
        let e = c.evm_payout.as_mut().unwrap();
        match tweak {
            0 => e.address = "0x1234".into(),
            1 => e.gas_limit = 20_999,
            2 => e.max_fee_per_gas = near_sdk::json_types::U128(20_000_000_000),
            3 => e.demo_wei_per_session = near_sdk::json_types::U128(0),
            5 => e.demo_wei_per_session = near_sdk::json_types::U128(10u128.pow(18) + 1),
            6 => e.max_fee_cap = near_sdk::json_types::U128(2_000_000_000_000),
            7 => e.gas_limit = 100_001,
            8 => e.start_nonce = u32::MAX as u64,
            _ => e.max_priority_fee_per_gas = near_sdk::json_types::U128(3_000_000_000),
        }
        assert!(catch_unwind(AssertUnwindSafe(|| drop(fresh_with(c)))).is_err(), "tweak {tweak}");
    }
}
