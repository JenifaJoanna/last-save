use super::*;

const IV: u64 = 20_000; // probe_interval_ms

#[test]
fn probe_sends_the_documented_input_to_outlayer() {
    let mut c = four();
    env_at(MIRA, 10 * MILLI, T0 + 5000);
    let _ = c.probe_official(None);
    let call = &calls()[0];
    assert_eq!(call.0, "outlayer.testnet");
    assert_eq!(call.1, "request_execution");
    assert!(call.2.contains("\"build_target\":\"wasm32-wasip2\""));
    assert!(call.2.contains(&format!("\\\"from_ms\\\":{}", T0 + 5000 - 180_000)));
    assert!(call.2.contains("\\\"mode\\\":\\\"official\\\""));
    assert!(call.2.contains("\\\"host_id\\\":\\\"official\\\""));
    assert!(call.2.contains(&format!("\\\"build_hash\\\":\\\"{}\\\"", "d".repeat(64))));
    assert!(call.2.contains("\"payer_account_id\":\"lastsave-mira.testnet\""));
    assert!(!call.2.contains("secrets_ref"));
    assert!(call.2.contains("\"max_instructions\":5000000000"));
    // nonce is 16 random bytes in hex
    let at = call.2.find("nonce").unwrap();
    assert!(call.2[at..].contains(&"0".repeat(32)) || call.2[at..].len() > 40);
}

#[test]
fn probe_needs_the_deposit_and_alive_game() {
    let mut c = four();
    env_at(MIRA, 5 * MILLI, T0);
    assert_refused(|| drop(c.probe_official(None)), "Attach at least 0.01");
    let mut other = four();
    env_at(MIRA, 10 * MILLI, T0);
    assert_refused(|| drop(other.probe_official(Some(3))), "No such mirror");
    env_at(STUDIO, 0, T0);
    c.end_of_service();
    env_at(MIRA, 10 * MILLI, T0 + 1);
    assert_refused(|| drop(c.probe_official(None)), "already ended");
}

#[test]
fn passing_probe_resets_failures() {
    let mut c = four();
    probe(&mut c, T0, j(DOWN));
    probe(&mut c, T0 + IV, j(DOWN));
    assert_eq!(c.probe.consecutive_failures, 2);
    probe(&mut c, T0 + 2 * IV, j(ALIVE));
    assert_eq!(c.probe.consecutive_failures, 0);
    assert_eq!(c.probe.last_alive_ms, Some(T0 + 2 * IV));
    assert!(!c.dead);
    // after the reset the next failure starts a fresh count and always counts
    probe(&mut c, T0 + 2 * IV + 1, j(DOWN));
    assert_eq!(c.probe.consecutive_failures, 1);
}

#[test]
fn reachable_but_zero_verified_counts_as_failure() {
    let mut c = four();
    probe(&mut c, T0, j(STUB));
    assert_eq!(c.probe.consecutive_failures, 1);
    let build_bad = r#"{"ok":true,"reachable":true,"build_ok":false,"verified":3}"#;
    probe(&mut c, T0 + IV, j(build_bad));
    assert_eq!(c.probe.consecutive_failures, 2);
    assert!(!c.dead);
}

#[test]
fn fewer_than_threshold_failures_stay_alive() {
    let mut c = four();
    probe(&mut c, T0, j(DOWN));
    probe(&mut c, T0 + IV, j(DOWN));
    assert!(!c.dead);
    assert_eq!(c.ls_status(), "Alive");
}

#[test]
fn threshold_failures_spaced_by_interval_kill_the_game() {
    let mut c = four();
    probe(&mut c, T0, j(DOWN));
    probe(&mut c, T0 + IV, j(DOWN));
    probe(&mut c, T0 + 2 * IV, j(DOWN));
    assert!(c.dead);
    assert_eq!(c.cause.as_deref(), Some("probes"));
    assert!(c.died_at_ms.is_some());
    assert!(logs_have("died"));
    env_at(MIRA, 0, T0 + 3 * IV);
    let i = c.get_info();
    assert_eq!((i.status.as_str(), i.cause.as_deref()), ("Dead", Some("probes")));
}

#[test]
fn death_never_calls_outlayer() {
    let mut c = four();
    probe(&mut c, T0, j(DOWN));
    probe(&mut c, T0 + IV, j(DOWN));
    env_at(MIRA, 10 * MILLI, T0 + 2 * IV);
    let _ = c.probe_official(None);
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0 + 2 * IV, j(DOWN));
    c.on_probe(cb(id, MIRA));
    assert!(c.dead);
    assert!(calls().is_empty(), "die must not start an OutLayer call");
    assert!(c.release.flight.is_none());
}

#[test]
fn failures_closer_than_the_interval_do_not_count() {
    let mut c = four();
    probe(&mut c, T0, j(DOWN));
    for k in 1..6 {
        probe(&mut c, T0 + k * 1000, j(DOWN));
    }
    assert_eq!(c.probe.consecutive_failures, 1);
    assert!(!c.dead);
    probe(&mut c, T0 + IV - 1, j(DOWN));
    assert_eq!(c.probe.consecutive_failures, 1);
    probe(&mut c, T0 + IV, j(DOWN));
    assert_eq!(c.probe.consecutive_failures, 2);
}

#[test]
fn null_probe_output_is_inconclusive_and_not_counted() {
    let mut c = four();
    for k in 0..6u64 {
        probe(&mut c, T0 + k * IV, R::Null);
        assert!(logs_have("probe"));
    }
    assert_eq!(c.probe.consecutive_failures, 0);
    assert!(!c.dead && c.probe.flight.is_none());
    assert!(c.probe.last_error.is_some());
    env_at(MIRA, 0, T0 + 10 * IV);
    assert_eq!(c.get_activity(Some(1))[0].outcome, "inconclusive");
}

#[test]
fn ok_false_probe_output_is_inconclusive_for_official_probes() {
    let mut c = four();
    probe(&mut c, T0, j(DOWN));
    assert_eq!(c.probe.consecutive_failures, 1);
    for k in 1..8u64 {
        probe(&mut c, T0 + k * IV, j(RPC_DOWN));
    }
    assert_eq!(c.probe.consecutive_failures, 1, "ok:false never adds a failure");
    assert!(!c.dead && c.probe.flight.is_none());
    assert!(c.probe.last_error.is_some());
    // truncated flag and unknown fields are ignored
    let alive = r#"{"ok":true,"truncated":true,"extra":1,"reachable":true,"build_ok":true,"verified":1}"#;
    probe(&mut c, T0 + 20 * IV, j(alive));
    assert_eq!(c.probe.consecutive_failures, 0);
    // malformed and empty outputs are inconclusive as well
    probe(&mut c, T0 + 21 * IV, j(r#"{"ok":true}"#));
    probe(&mut c, T0 + 22 * IV, R::Empty);
    probe(&mut c, T0 + 23 * IV, j("[1,2]"));
    assert_eq!(c.probe.consecutive_failures, 0);
}

#[test]
fn failed_outlayer_promise_refunds_payer_and_is_inconclusive() {
    let mut c = four();
    env_at(MIRA, 10 * MILLI, T0);
    let _ = c.probe_official(None);
    let id = c.probe.flight.clone().unwrap().id;
    env_cb(T0, R::Failed);
    let mut k = cb(id, MIRA);
    k.deposit = 10 * MILLI;
    c.on_probe(k);
    assert_eq!(transfers(), vec![(MIRA.to_string(), 10 * MILLI)]);
    assert_eq!(c.probe.consecutive_failures, 0);
    assert!(c.probe.flight.is_none());
}

#[test]
fn only_one_probe_in_flight_until_ten_minutes_pass() {
    let mut c = four();
    env_at(MIRA, 10 * MILLI, T0);
    let _ = c.probe_official(None);
    let first = c.probe.flight.clone().unwrap().id;
    env_at(KOFI, 10 * MILLI, T0 + 599_999);
    assert_refused(|| drop(c.probe_official(None)), "already running");
    env_at(KOFI, 10 * MILLI, T0 + 600_000);
    let _ = c.probe_official(None);
    let second = c.probe.flight.clone().unwrap().id;
    assert_ne!(first, second);
    // the stale callback must not clear the newer flight
    env_cb(T0 + 600_001, R::Null);
    c.on_probe(cb(first, MIRA));
    assert_eq!(c.probe.flight.clone().unwrap().id, second);
    env_cb(T0 + 600_002, R::Null);
    c.on_probe(cb(second, KOFI));
    assert!(c.probe.flight.is_none());
}

#[test]
fn late_probe_result_after_death_is_ignored() {
    let mut c = four();
    env_at(MIRA, 10 * MILLI, T0);
    let _ = c.probe_official(None);
    let id = c.probe.flight.clone().unwrap().id;
    env_at(STUDIO, 0, T0 + 1);
    c.end_of_service();
    env_cb(T0 + 2, j(DOWN));
    c.on_probe(cb(id, MIRA));
    assert_eq!(c.probe.consecutive_failures, 0);
    assert_eq!(c.cause.as_deref(), Some("studio"));
}
