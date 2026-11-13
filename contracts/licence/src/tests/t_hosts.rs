use super::*;

const REL: u64 = T0 + 10; // released_at_ms (dead_and_released runs at this time)
const EP: u64 = 120_000;

fn host_out(verified: u64) -> String {
    format!(r#"{{"ok":true,"mode":"host","reachable":true,"build_ok":true,"verified":{verified},"rejected":0,"truncated":false}}"#)
}

/// Dead, released, with `pledges` holders (yuna, dario in order) having pledged 0.1 N each.
fn released(pledges: usize) -> Licence {
    let mut c = four();
    dead_and_released(&mut c, REL);
    for (k, w) in [YUNA, DARIO].iter().take(pledges).enumerate() {
        env_at(w, 0, REL + 1);
        c.choose((k + 3).to_string(), Choice::Pledge);
    }
    c
}

fn register(c: &mut Licence, host: &str) {
    env_at(host, 10 * MILLI, REL + 2);
    c.register_host(format!("https://{}.trycloudflare.com", host.split('.').next().unwrap()), "ed25519:6E47bYh2ByodXWbJdCDbHRycwJ4bqGsB2FycdP1M3N5h".into());
}

fn claim_start(c: &mut Licence, host: &str, epoch: u64, t: u64) -> u64 {
    env_at(host, 10 * MILLI, t);
    let _ = c.claim_epoch(epoch, None);
    store::host(&acct(host)).unwrap().flight.unwrap().id
}

fn claim_finish(c: &mut Licence, host: &str, epoch: u64, flight: u64, t: u64, r: R) {
    env_cb(t, r);
    c.on_claim(Cb { host: Some(acct(host)), epoch, ..cb(flight, host) });
}

fn claim(c: &mut Licence, host: &str, epoch: u64, t: u64, r: R) {
    let f = claim_start(c, host, epoch, t);
    claim_finish(c, host, epoch, f, t, r);
}

#[test]
fn register_host_needs_release_deposit_and_valid_fields() {
    let mut c = four();
    env_at(FANHOST, 10 * MILLI, REL);
    assert_refused(|| c.register_host("https://a.example.test".into(), "ed25519:abc".into()), "not released");
    let mut c = released(0);
    env_at(FANHOST, 9 * MILLI, REL + 1);
    assert_refused(|| c.register_host("https://a.example.test".into(), "ed25519:abc".into()), "0.01 NEAR");
    env_at(FANHOST, 10 * MILLI, REL + 1);
    assert_refused(|| c.register_host("http://a.example.test".into(), "ed25519:abc".into()), "https");
    assert_refused(|| c.register_host("https://a.example.test".into(), "bogus".into()), "ed25519");
}

#[test]
fn register_refunds_excess_and_updates_in_place() {
    let mut c = released(0);
    env_at(FANHOST, 50 * MILLI, REL + 1);
    c.register_host("https://one.trycloudflare.com".into(), "ed25519:AAA111".into());
    assert!(logs_have("host_registered"));
    assert_eq!(transfers(), vec![(FANHOST.to_string(), 40 * MILLI)]);
    env_at(FANHOST, 0, REL + 2);
    c.register_host("https://two.trycloudflare.com".into(), "ed25519:BBB222".into());
    assert!(transfers().is_empty());
    let h = c.get_hosts();
    assert_eq!(h.len(), 1);
    assert_eq!((h[0].host_id.as_str(), h[0].endpoint.as_str(), h[0].host_pubkey.as_str()), (FANHOST, "https://two.trycloudflare.com", "ed25519:BBB222"));
    assert_eq!(c.get_info().hosts, 1);
}

#[test]
fn claim_needs_registration_a_complete_epoch_and_deposit() {
    let mut c = released(2);
    env_at(FANHOST, 10 * MILLI, REL + EP);
    assert_refused(|| drop(c.claim_epoch(0, None)), "Register as a host");
    register(&mut c, FANHOST);
    env_at(FANHOST, 10 * MILLI, REL + EP - 1);
    assert_refused(|| drop(c.claim_epoch(0, None)), "not complete");
    env_at(FANHOST, 10 * MILLI, REL + 2 * EP - 1);
    assert_refused(|| drop(c.claim_epoch(1, None)), "not complete");
    env_at(FANHOST, 9 * MILLI, REL + EP);
    assert_refused(|| drop(c.claim_epoch(0, None)), "Attach at least 0.01");
}

#[test]
fn claim_sends_host_mode_input_with_the_epoch_window() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    env_at(FANHOST, 10 * MILLI, REL + EP);
    let _ = c.claim_epoch(0, None);
    let call = &calls()[0];
    assert!(call.2.contains("\\\"mode\\\":\\\"host\\\""));
    assert!(call.2.contains(&format!("\\\"from_ms\\\":{REL},\\\"to_ms\\\":{},\\\"epoch\\\":0", REL + EP)));
    assert!(call.2.contains("\\\"host_id\\\":\\\"lastsave-fanhost.testnet\\\""));
    assert!(call.2.contains("trycloudflare.com"));
}

#[test]
fn claim_pays_verified_times_rate_and_records_it() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    let pool0 = c.totals.pool;
    claim(&mut c, FANHOST, 0, REL + EP, j(&host_out(3)));
    let t = transfers();
    assert_eq!(t, vec![(FANHOST.to_string(), 30 * MILLI)]);
    assert!(logs_have("epoch_claimed"));
    assert!(pool0 - c.totals.pool >= 30 * MILLI && pool0 - c.totals.pool < 35 * MILLI);
    assert_eq!(c.totals.paid_out, 30 * MILLI);
    env_at(MIRA, 0, REL + EP + 1);
    let cl = c.get_claims(0, 10);
    assert_eq!((cl.len(), cl[0].epoch, cl[0].verified, cl[0].paid.0), (1, 0, 3, 30 * MILLI));
    let h = c.get_hosts();
    assert_eq!((h[0].epochs_paid, h[0].sessions_paid, h[0].earned.0), (1, 3, 30 * MILLI));
    assert_eq!(c.get_info().claims, 1);
    assert_eq!(c.get_activity(Some(1))[0].outcome, "paid");
}

#[test]
fn claim_is_capped_at_epoch_cap() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    claim(&mut c, FANHOST, 0, REL + EP, j(&host_out(9)));
    assert_eq!(transfers(), vec![(FANHOST.to_string(), 50 * MILLI)]);
}

#[test]
fn two_hosts_are_paid_by_their_own_verified_counts() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    register(&mut c, OTHERHOST);
    claim(&mut c, FANHOST, 0, REL + EP, j(&host_out(3)));
    assert_eq!(transfers(), vec![(FANHOST.to_string(), 30 * MILLI)]);
    claim(&mut c, OTHERHOST, 0, REL + EP + 1, j(&host_out(1)));
    assert_eq!(transfers(), vec![(OTHERHOST.to_string(), 10 * MILLI)]);
    let h = c.get_hosts();
    assert_eq!((h[0].earned.0, h[1].earned.0), (30 * MILLI, 10 * MILLI));
    assert_eq!(c.totals.paid_out, 40 * MILLI);
}

#[test]
fn a_paid_epoch_cannot_be_claimed_again_but_the_next_can() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    claim(&mut c, FANHOST, 0, REL + EP, j(&host_out(2)));
    env_at(FANHOST, 10 * MILLI, REL + EP + 5);
    assert_refused(|| drop(c.claim_epoch(0, None)), "already paid");
    let paid = c.totals.paid_out;
    claim(&mut c, FANHOST, 1, REL + 2 * EP, j(&host_out(2)));
    assert_eq!(c.totals.paid_out, paid + 20 * MILLI);
    assert_eq!(c.get_claims(0, 10).len(), 2);
    assert_eq!(c.get_claims(1, 10).len(), 1);
}

#[test]
fn a_duplicate_success_callback_never_pays_twice() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    let f = claim_start(&mut c, FANHOST, 0, REL + EP);
    claim_finish(&mut c, FANHOST, 0, f, REL + EP, j(&host_out(3)));
    let paid = c.totals.paid_out;
    claim_finish(&mut c, FANHOST, 0, f, REL + EP + 1, j(&host_out(3)));
    assert_eq!(c.totals.paid_out, paid);
    assert!(transfers().is_empty());
}

#[test]
fn zero_verified_or_wrong_build_pays_nothing_and_leaves_no_record() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    let pool = c.totals.pool;
    let bad_build = r#"{"ok":true,"reachable":true,"build_ok":false,"verified":4}"#;
    let unreachable = r#"{"ok":true,"reachable":false,"build_ok":true,"verified":4}"#;
    for (i, r) in [host_out(0), bad_build.to_string(), unreachable.to_string()].into_iter().enumerate() {
        claim(&mut c, FANHOST, 0, REL + EP + i as u64, j(&r));
        assert!(transfers().is_empty(), "case {i}");
        assert!(!store::epoch_paid(&acct(FANHOST), 0), "case {i}");
        assert_eq!((c.claim_count, c.totals.pool, c.totals.paid_out), (0, pool, 0), "case {i}");
        assert!(store::host(&acct(FANHOST)).unwrap().flight.is_none());
    }
    // retry is allowed and now succeeds
    claim(&mut c, FANHOST, 0, REL + EP + 10, j(&host_out(2)));
    assert_eq!(c.totals.paid_out, 20 * MILLI);
}

#[test]
fn ok_false_null_and_failed_probe_outputs_are_inconclusive_for_claims() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    let pool = c.totals.pool;
    for (i, r) in [j(RPC_DOWN), R::Null, R::Empty, j(r#"{"ok":false}"#)].into_iter().enumerate() {
        claim(&mut c, FANHOST, 0, REL + EP + i as u64, r);
        assert!(transfers().is_empty());
        assert_eq!((c.claim_count, c.totals.pool), (0, pool));
        assert!(!store::epoch_paid(&acct(FANHOST), 0));
        assert!(store::host(&acct(FANHOST)).unwrap().flight.is_none(), "in-flight cleared");
    }
    let f = claim_start(&mut c, FANHOST, 0, REL + EP + 9);
    env_cb(REL + EP + 9, R::Failed);
    let mut k = Cb { host: Some(acct(FANHOST)), epoch: 0, ..cb(f, FANHOST) };
    k.deposit = 10 * MILLI;
    c.on_claim(k);
    assert_eq!(transfers(), vec![(FANHOST.to_string(), 10 * MILLI)]);
    assert_eq!(c.get_activity(Some(1))[0].outcome, "none");
}

#[test]
fn one_claim_in_flight_per_host_until_ten_minutes_pass() {
    let mut c = released(2);
    register(&mut c, FANHOST);
    let first = claim_start(&mut c, FANHOST, 0, REL + EP);
    env_at(FANHOST, 10 * MILLI, REL + EP + 599_999);
    assert_refused(|| drop(c.claim_epoch(0, None)), "already running");
    let second = claim_start(&mut c, FANHOST, 0, REL + EP + 600_000);
    assert_ne!(first, second);
    claim_finish(&mut c, FANHOST, 0, first, REL + EP + 600_001, R::Null);
    assert_eq!(store::host(&acct(FANHOST)).unwrap().flight.unwrap().id, second);
}

#[test]
fn pool_exhaustion_pays_what_is_left_and_never_goes_negative() {
    let mut c = released(1); // pool = 0.1 N
    register(&mut c, FANHOST);
    register(&mut c, OTHERHOST);
    let pool0 = c.totals.pool;
    assert_eq!(pool0, POT);
    claim(&mut c, FANHOST, 0, REL + EP, j(&host_out(9)));
    assert_eq!(transfers(), vec![(FANHOST.to_string(), 50 * MILLI)]);
    let left = c.totals.pool;
    assert!(left > 0 && left < 50 * MILLI);
    claim(&mut c, OTHERHOST, 0, REL + EP + 1, j(&host_out(9)));
    let paid = transfers();
    assert_eq!(paid.len(), 1);
    assert!(paid[0].1 > 0 && paid[0].1 <= left, "paid {} of {}", paid[0].1, left);
    assert_eq!(c.totals.pool, 0);
    assert!(c.totals.paid_out + c.totals.pool <= pool0);
    // an empty pool refuses further claims at the door
    env_at(FANHOST, 10 * MILLI, REL + 2 * EP);
    assert_refused(|| drop(c.claim_epoch(1, None)), "pool is empty");
}

#[test]
fn claim_with_pool_emptied_mid_flight_leaves_no_record() {
    let mut c = released(1);
    register(&mut c, FANHOST);
    let f = claim_start(&mut c, FANHOST, 0, REL + EP);
    c.totals.pool = 0; // drained by another claim while this one was running
    claim_finish(&mut c, FANHOST, 0, f, REL + EP, j(&host_out(3)));
    assert!(transfers().is_empty());
    assert_eq!(c.claim_count, 0);
    assert!(!store::epoch_paid(&acct(FANHOST), 0));
}
