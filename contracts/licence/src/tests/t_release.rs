use super::*;

fn dead_four() -> Licence {
    let mut c = four();
    env_at(STUDIO, 0, T0 + 10);
    c.end_of_service();
    c
}

fn start_release(c: &mut Licence, who: &str, t: u64) -> u64 {
    env_at(who, 10 * MILLI, t);
    let _ = c.release(None);
    c.release.flight.clone().unwrap().id
}

#[test]
fn release_while_alive_refused() {
    let mut c = four();
    env_at(MIRA, 10 * MILLI, T0);
    assert_refused(|| drop(c.release(None)), "still alive");
    assert!(c.release.flight.is_none());
}

#[test]
fn release_needs_escrow_and_deposit() {
    let mut c = fresh();
    c.dead = true;
    env_at(MIRA, 10 * MILLI, T0);
    assert_refused(|| drop(c.release(None)), "Nothing is escrowed");
    let mut c = dead_four();
    env_at(MIRA, 9 * MILLI, T0 + 20);
    assert_refused(|| drop(c.release(None)), "Attach at least 0.01");
}

#[test]
fn release_sends_secrets_ref_and_the_release_mode() {
    let mut c = dead_four();
    start_release(&mut c, KOFI, T0 + 20);
    assert!(logs_have("release_requested"));
    let call = &calls()[0];
    assert_eq!(call.1, "request_execution");
    assert!(call.2.contains("\"secrets_ref\":{\"profile\":\"escrow\",\"account_id\":\"lastsave-licence.testnet\"}"));
    assert!(call.2.contains("{\\\"mode\\\":\\\"release\\\"}"));
    assert!(call.2.contains(&"a".repeat(64)));
    assert!(call.2.contains("\"payer_account_id\":\"lastsave-kofi.testnet\""));
    assert!(call.2.contains("\"response_format\":\"Json\""));
}

#[test]
fn release_success_stores_key_after_commitment_check() {
    let mut c = dead_four();
    let id = start_release(&mut c, KOFI, T0 + 20);
    env_cb(T0 + 30, R::Json(release_ok()));
    assert!(c.on_release(cb(id, KOFI)));
    assert!(logs_have("key_released"));
    assert_eq!(c.release.released_key.as_deref(), Some(hex::encode(key()).as_str()));
    assert_eq!(c.release.released_at_ms, Some(T0 + 30));
    assert!(c.release.flight.is_none());
    let i = info(&c, T0 + 40);
    assert!(i.release.released && i.released_key.is_some());
    assert_eq!(i.current_epoch, Some(0));
    env_at(MIRA, 10 * MILLI, T0 + 50);
    assert_refused(|| drop(c.release(None)), "already released");
}

#[test]
fn release_null_is_retryable_and_clears_in_flight() {
    let mut c = dead_four();
    let id = start_release(&mut c, KOFI, T0 + 20);
    env_at(MIRA, 10 * MILLI, T0 + 21);
    assert_refused(|| drop(c.release(None)), "already running");
    env_cb(T0 + 22, R::Null);
    assert!(!c.on_release(cb(id, KOFI)));
    assert!(c.release.flight.is_none() && c.release.released_key.is_none());
    assert!(c.release.last_error.is_some());
    assert!(c.dead);
    start_release(&mut c, MIRA, T0 + 23); // retry is allowed at once
}

#[test]
fn release_refused_or_failed_outputs_do_not_release() {
    let mut c = dead_four();
    for (i, r) in [
        j(r#"{"ok":false,"error":"refused: status Alive"}"#),
        j(&format!(r#"{{"ok":true,"key":"{}"}}"#, "22".repeat(32))), // wrong key
        j(r#"{"ok":true,"key":"not-hex"}"#),
        j(r#"{"ok":true}"#),
        R::Empty,
    ]
    .into_iter()
    .enumerate()
    {
        let id = start_release(&mut c, KOFI, T0 + 20 + i as u64);
        env_cb(T0 + 30, r);
        assert!(!c.on_release(cb(id, KOFI)), "case {i}");
        assert!(c.release.released_key.is_none() && c.release.flight.is_none(), "case {i}");
    }
}

#[test]
fn release_failed_promise_refunds_the_caller() {
    let mut c = dead_four();
    let id = start_release(&mut c, KOFI, T0 + 20);
    env_cb(T0 + 30, R::Failed);
    let mut k = cb(id, KOFI);
    k.deposit = 10 * MILLI;
    assert!(!c.on_release(k));
    assert_eq!(transfers(), vec![(KOFI.to_string(), 10 * MILLI)]);
}

#[test]
fn stale_in_flight_can_be_retried_after_ten_minutes() {
    let mut c = dead_four();
    let first = start_release(&mut c, KOFI, T0 + 20);
    env_at(MIRA, 10 * MILLI, T0 + 20 + 599_999);
    assert_refused(|| drop(c.release(None)), "already running");
    let second = start_release(&mut c, MIRA, T0 + 20 + 600_000);
    assert_ne!(first, second);
    env_cb(T0 + 700_000, R::Null);
    c.on_release(cb(first, KOFI)); // late callback from the first request
    assert_eq!(c.release.flight.clone().unwrap().id, second);
    env_cb(T0 + 700_001, R::Json(release_ok()));
    assert!(c.on_release(cb(second, MIRA)));
    // a duplicate success callback changes nothing
    let at = c.release.released_at_ms;
    env_cb(T0 + 800_000, R::Json(release_ok()));
    assert!(!c.on_release(cb(second, MIRA)));
    assert_eq!(c.release.released_at_ms, at);
}

// ---- choose ----

#[test]
fn choose_while_alive_refused() {
    let mut c = four();
    env_at(MIRA, 0, T0 + 1);
    assert_refused(|| drop(c.choose("1".into(), Choice::Refund)), "still alive");
}

#[test]
fn refund_pays_the_holder_and_updates_totals() {
    let mut c = dead_four();
    env_at(MIRA, 0, T0 + 20);
    let p = c.choose("1".into(), Choice::Refund);
    assert!(p.is_some());
    drop(p);
    assert_eq!(transfers(), vec![(MIRA.to_string(), POT)]);
    assert_eq!((c.totals.refunded, c.totals.pot_locked), (POT, 3 * POT));
    env_cb(T0 + 21, R::Empty);
    assert!(c.on_refund(Cb { token: 1, deposit: POT, payer: acct(MIRA), ..cb(0, MIRA) }));
    assert!(logs_have("choice"));
    assert_eq!(c.get_token("1".into()).unwrap().choice, Some(Choice::Refund));
}

#[test]
fn refund_twice_and_pledge_after_refund_refused() {
    let mut c = dead_four();
    env_at(MIRA, 0, T0 + 20);
    let _ = c.choose("1".into(), Choice::Refund);
    assert_refused(|| drop(c.choose("1".into(), Choice::Refund)), "already made");
    assert_refused(|| drop(c.choose("1".into(), Choice::Pledge)), "already made");
    assert_eq!(c.totals.refunded, POT);
}

#[test]
fn pledge_moves_the_share_to_the_pool_and_is_final() {
    let mut c = dead_four();
    env_at(KOFI, 0, T0 + 20);
    assert!(c.choose("2".into(), Choice::Pledge).is_none());
    assert!(transfers().is_empty());
    assert!(logs_have("choice"));
    assert_eq!((c.totals.pledged, c.totals.pool, c.totals.pot_locked), (POT, POT, 3 * POT));
    assert_refused(|| drop(c.choose("2".into(), Choice::Refund)), "already made");
    assert_refused(|| drop(c.choose("2".into(), Choice::Pledge)), "already made");
    assert_eq!(c.totals.refunded, 0);
}

#[test]
fn choose_by_non_holder_refused() {
    let mut c = dead_four();
    env_at(KOFI, 0, T0 + 20);
    assert_refused(|| drop(c.choose("1".into(), Choice::Refund)), "Only the licence holder");
    env_at("lastsave-stranger.testnet", 0, T0 + 20);
    assert_refused(|| drop(c.choose("1".into(), Choice::Pledge)), "Only the licence holder");
    assert_refused(|| drop(c.choose("77".into(), Choice::Pledge)), "No such licence");
    assert_eq!(c.totals.pot_locked, 4 * POT);
}

#[test]
fn post_death_token_cannot_choose() {
    let mut c = dead_four();
    buy(&mut c, "lastsave-late.testnet", T0 + 20);
    env_at("lastsave-late.testnet", 0, T0 + 21);
    assert_refused(|| drop(c.choose("5".into(), Choice::Refund)), "no locked share");
    assert_refused(|| drop(c.choose("5".into(), Choice::Pledge)), "no locked share");
}

#[test]
fn transfer_after_death_then_new_owner_chooses_and_is_refunded() {
    let mut c = dead_four();
    env_at(YUNA, 1, T0 + 20);
    c.nft_transfer(acct(DARIO), "3".into(), None, None);
    env_at(YUNA, 0, T0 + 21);
    assert_refused(|| drop(c.choose("3".into(), Choice::Refund)), "Only the licence holder");
    env_at(DARIO, 0, T0 + 22);
    let _ = c.choose("3".into(), Choice::Refund);
    assert_eq!(transfers(), vec![(DARIO.to_string(), POT)], "refund goes to the current owner");
    env_at(DARIO, 0, T0 + 23);
    assert_eq!(c.get_token("3".into()).unwrap().pot_share.0, POT);
}

#[test]
fn failed_refund_transfer_undoes_the_choice() {
    let mut c = dead_four();
    env_at(MIRA, 0, T0 + 20);
    let _ = c.choose("1".into(), Choice::Refund);
    env_cb(T0 + 21, R::Failed);
    assert!(!c.on_refund(Cb { token: 1, deposit: POT, payer: acct(MIRA), ..cb(0, MIRA) }));
    assert_eq!((c.totals.refunded, c.totals.pot_locked), (0, 4 * POT));
    assert_eq!(c.get_token("1".into()).unwrap().choice, None);
    env_at(MIRA, 0, T0 + 22);
    let _ = c.choose("1".into(), Choice::Pledge); // can choose again
    assert_eq!(c.totals.pool, POT);
}

#[test]
fn all_four_choose_and_the_books_balance() {
    let mut c = dead_four();
    env_at(MIRA, 0, T0 + 20);
    let _ = c.choose("1".into(), Choice::Refund);
    env_at(KOFI, 0, T0 + 20);
    let _ = c.choose("2".into(), Choice::Refund);
    env_at(YUNA, 0, T0 + 20);
    c.choose("3".into(), Choice::Pledge);
    env_at(DARIO, 0, T0 + 20);
    c.choose("4".into(), Choice::Pledge);
    let t = &c.totals;
    assert_eq!((t.pot_locked, t.refunded, t.pledged, t.pool), (0, 2 * POT, 2 * POT, 2 * POT));
    assert_eq!(t.pot_locked + t.refunded + t.pledged, 4 * POT);
}
