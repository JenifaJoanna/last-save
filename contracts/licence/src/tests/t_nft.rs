use near_sdk::json_types::U128;

use super::*;
use crate::nft::Resolve;

fn payout_map(p: &crate::nft::Payout) -> Vec<(String, u128)> {
    p.payout.0.iter().map(|(a, v)| (a.to_string(), v.0)).collect()
}

#[test]
fn nft_payout_pays_royalty_to_studio_and_rest_to_owner() {
    let c = four();
    env_at(MIRA, 0, T0 + 1);
    let p = c.nft_payout("1".into(), U128(10 * N), Some(2));
    let mut m = payout_map(&p);
    m.sort();
    assert_eq!(m, vec![(MIRA.to_string(), 9 * N), (STUDIO.to_string(), N)]);
    assert_eq!(m.iter().map(|x| x.1).sum::<u128>(), 10 * N);
    // too many recipients for the caller's limit
    assert_refused(|| drop(c.nft_payout("1".into(), U128(10 * N), Some(1))), "Too many payout");
    // tiny balances never mint dust recipients
    assert_eq!(payout_map(&c.nft_payout("1".into(), U128(5), None)), vec![(MIRA.to_string(), 5)]);
    assert_refused(|| drop(c.nft_payout("9".into(), U128(1), None)), "No such licence");
}

#[test]
fn nft_payout_when_the_studio_owns_the_token_is_one_line() {
    let mut c = four();
    env_at(MIRA, 1, T0 + 1);
    c.nft_transfer(acct(STUDIO), "1".into(), None, None);
    env_at(MIRA, 0, T0 + 2);
    let p = c.nft_payout("1".into(), U128(10 * N), None);
    assert_eq!(payout_map(&p), vec![(STUDIO.to_string(), 10 * N)]);
}

#[test]
fn nft_transfer_payout_moves_token_and_pays_the_previous_owner() {
    let mut c = four();
    env_at(KOFI, 1, T0 + 1);
    let p = c.nft_transfer_payout(acct(DARIO), "2".into(), None, Some("sale".into()), U128(4 * N), None);
    let mut m = payout_map(&p);
    m.sort();
    assert_eq!(m, vec![(KOFI.to_string(), 36 * N / 10), (STUDIO.to_string(), 4 * N / 10)]);
    assert!(get_logs().iter().any(|l| l.contains("nft_transfer") && l.contains("\"memo\":\"sale\"")));
    env_at(KOFI, 0, T0 + 2);
    assert_eq!(c.get_token("2".into()).unwrap().owner_id.as_str(), DARIO);
    // needs exactly one yocto
    env_at(KOFI, 0, T0 + 3);
    assert_refused(|| drop(c.nft_transfer_payout(acct(YUNA), "2".into(), None, None, U128(N), None)), "exactly 1 yoctoNEAR");
    env_at(DARIO, 1, T0 + 3);
    c.nft_transfer_payout(acct(YUNA), "2".into(), None, None, U128(N), None);
}

#[test]
fn transfers_carry_pot_share_and_the_unused_choice() {
    let mut c = four();
    env_at(YUNA, 1, T0 + 1);
    c.nft_transfer(acct(MIRA), "3".into(), None, None);
    env_at(MIRA, 0, T0 + 2);
    let v = c.get_token("3".into()).unwrap();
    assert_eq!((v.owner_id.as_str(), v.pot_share.0, v.choice), (MIRA, POT, None));
    assert_eq!(c.nft_supply_for_owner(acct(MIRA)).0, 2);
    assert_eq!(c.nft_supply_for_owner(acct(YUNA)).0, 0);
    assert!(c.licence_of(acct(YUNA)).is_none());
    assert_eq!(c.licence_of(acct(MIRA)).unwrap().token_id, "1");
    // totals are untouched by a transfer
    assert_eq!(c.totals.pot_locked, 4 * POT);
    // a chosen token keeps its choice across a later transfer
    env_at(STUDIO, 0, T0 + 3);
    c.end_of_service();
    env_at(MIRA, 0, T0 + 4);
    c.choose("3".into(), Choice::Pledge);
    env_at(MIRA, 1, T0 + 5);
    c.nft_transfer(acct(DARIO), "3".into(), None, None);
    env_at(DARIO, 0, T0 + 6);
    assert_eq!(c.get_token("3".into()).unwrap().choice, Some(Choice::Pledge));
    assert_refused(|| drop(c.choose("3".into(), Choice::Refund)), "already made");
}

#[test]
fn transfer_rules() {
    let mut c = four();
    env_at(MIRA, 0, T0);
    assert_refused(|| c.nft_transfer(acct(KOFI), "1".into(), None, None), "exactly 1 yoctoNEAR");
    env_at(KOFI, 1, T0);
    assert_refused(|| c.nft_transfer(acct(YUNA), "1".into(), None, None), "not approved");
    env_at(MIRA, 1, T0);
    assert_refused(|| c.nft_transfer(acct(MIRA), "1".into(), None, None), "must differ");
    assert_refused(|| c.nft_transfer(acct(KOFI), "42".into(), None, None), "No such licence");
}

#[test]
fn approvals_allow_a_marketplace_transfer_until_revoked() {
    let mut c = four();
    let market = "lastsave-market.testnet";
    env_at(MIRA, 10 * MILLI, T0);
    assert!(c.nft_approve("1".into(), acct(market), None).is_none());
    assert!(!transfers().is_empty(), "unused storage deposit is refunded");
    env_at(MIRA, 0, T0 + 1);
    assert!(c.nft_is_approved("1".into(), acct(market), Some(0)));
    assert!(!c.nft_is_approved("1".into(), acct(market), Some(7)));
    assert_eq!(c.nft_token("1".into()).unwrap().approved_account_ids.0, vec![(acct(market), 0)]);
    env_at(KOFI, 10 * MILLI, T0);
    assert_refused(|| drop(c.nft_approve("1".into(), acct(market), None)), "Only the owner");
    env_at(MIRA, 0, T0);
    assert_refused(|| drop(c.nft_approve("1".into(), acct("lastsave-other-market.testnet"), None)), "Attach more NEAR");
    env_at(market, 1, T0 + 2);
    assert_refused(|| c.nft_transfer(acct(YUNA), "1".into(), Some(5), None), "Approval id does not match");
    c.nft_transfer(acct(YUNA), "1".into(), Some(0), None);
    env_at(YUNA, 0, T0 + 3);
    assert!(!c.nft_is_approved("1".into(), acct(market), None), "transfer clears approvals");
    // revoke and revoke_all
    env_at(YUNA, 10 * MILLI, T0 + 4);
    drop(c.nft_approve("1".into(), acct(market), None));
    env_at(YUNA, 1, T0 + 5);
    c.nft_revoke("1".into(), acct(market));
    env_at(YUNA, 0, T0 + 6);
    assert!(!c.nft_is_approved("1".into(), acct(market), None));
    env_at(YUNA, 10 * MILLI, T0 + 7);
    drop(c.nft_approve("1".into(), acct(market), Some("list".into())));
    assert_eq!(calls().last().unwrap().1, "nft_on_approve");
    env_at(YUNA, 1, T0 + 8);
    c.nft_revoke_all("1".into());
    env_at(YUNA, 0, T0 + 9);
    assert!(!c.nft_is_approved("1".into(), acct(market), None));
}

#[test]
fn enumeration_and_metadata_views() {
    let c = four();
    env_at(MIRA, 0, T0);
    assert_eq!(c.nft_total_supply().0, 4);
    let all = c.nft_tokens(None, None);
    assert_eq!(all.len(), 4);
    assert_eq!(all[0].token_id, "1");
    assert_eq!(c.nft_tokens(Some(U128(2)), Some(1))[0].token_id, "3");
    assert!(c.nft_tokens(Some(U128(9)), None).is_empty());
    let t = c.nft_tokens_for_owner(acct(KOFI), None, None);
    assert_eq!((t.len(), t[0].token_id.as_str(), t[0].owner_id.as_str()), (1, "2", KOFI));
    assert!(t[0].metadata.title.contains("Ember Rift licence #2"));
    assert!(t[0].metadata.extra.contains(&POT.to_string()));
    assert!(c.nft_token("5".into()).is_none() && c.nft_token("x".into()).is_none());
    let m = c.nft_metadata();
    assert_eq!((m.spec.as_str(), m.name.as_str(), m.symbol.as_str()), ("nft-1.0.0", "Ember Rift", "LSAVE"));
}

#[test]
fn nft_transfer_call_reverts_when_the_receiver_returns_true() {
    let mut c = four();
    env_at(MIRA, 1, T0);
    drop(c.nft_transfer_call(acct("lastsave-market.testnet"), "1".into(), None, None, "buy".into()));
    let cs = calls();
    assert_eq!(cs[0].1, "nft_on_transfer");
    assert!(cs[0].2.contains("\"msg\":\"buy\""));
    assert_eq!(cs[1].1, "nft_resolve_transfer");
    env_at(MIRA, 0, T0 + 1);
    assert_eq!(c.get_token("1".into()).unwrap().owner_id.as_str(), "lastsave-market.testnet");
    let r = || Resolve { previous_owner: acct(MIRA), receiver: acct("lastsave-market.testnet"), token: 1, approvals: vec![] };
    env_cb(T0 + 2, j("false")); // receiver kept it
    assert!(c.nft_resolve_transfer(r()));
    assert_eq!(c.get_token("1".into()).unwrap().owner_id.as_str(), "lastsave-market.testnet");
    env_cb(T0 + 3, j("true")); // receiver wants it returned
    assert!(!c.nft_resolve_transfer(r()));
    env_at(MIRA, 0, T0 + 4);
    let v = c.get_token("1".into()).unwrap();
    assert_eq!((v.owner_id.as_str(), v.pot_share.0), (MIRA, POT));
    assert_eq!(c.nft_supply_for_owner(acct(MIRA)).0, 1);
}

#[test]
fn get_info_is_one_call_for_the_dashboard() {
    let mut c = four();
    probe(&mut c, T0 + 1000, j(ALIVE));
    env_at(STUDIO, 0, T0 + 2000);
    c.post_snapshot(1, hex::encode(sha256(b"{}")), crate::util::b64_encode(b"{}"));
    let i = info(&c, T0 + 3000);
    assert_eq!(i.status, "Alive");
    assert_eq!((i.totals.supply, i.totals.live_supply, i.totals.pot_locked.0), (4, 4, 4 * POT));
    assert_eq!((i.config.title.as_str(), i.config.price.0), ("Ember Rift", PRICE));
    assert!(i.escrowed && !i.escrow_verified && !i.release.released);
    assert_eq!(i.probe.last_alive_ms, Some(T0 + 1000));
    assert_eq!(i.snapshot.unwrap().seq, 1);
    assert_eq!(i.now_ms, T0 + 3000);
    assert_eq!(i.reports_needed, 2);
    assert_eq!(i.current_epoch, None);
    assert_eq!(c.release_info().status, "Alive");
    assert_eq!(c.release_info().build_hash, "d".repeat(64));
    // serialises to JSON without panicking
    let _ = near_sdk::serde_json::to_string(&c.get_info()).unwrap();
}

#[test]
fn activity_log_keeps_the_last_64_newest_first() {
    let mut c = four();
    for k in 0..70u64 {
        probe(&mut c, T0 + k * 1000, R::Null);
    }
    env_at(MIRA, 0, T0 + 100_000);
    let a = c.get_activity(None);
    assert_eq!(a.len(), 64);
    assert!(a[0].at_ms > a[63].at_ms);
    assert_eq!(c.get_activity(Some(3)).len(), 3);
}
