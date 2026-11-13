//! Reachability, build check, malformed input and RPC resilience.

mod common;

use common::*;
use serde_json::json;

#[test]
fn stub_server_is_reachable_with_right_build_but_no_sessions() {
    let net = net_with(&[], &[]);
    let out = run(&input("official"), &net);
    assert_eq!(out["reachable"], true);
    assert_eq!(out["build_ok"], true);
    assert_eq!(out["verified"], 0);
    assert_eq!(out["rejected"], 0);
}

#[test]
fn wrong_build_hash_is_not_build_ok_and_nothing_counts() {
    let e = E::new("lastsave-mira", 1);
    let body = attest_body(&"0".repeat(64), "c0ffee11", vec![e.build()]);
    let net = FakeNet::new(Some((200, body))).holder(&e);
    let out = run(&input("official"), &net);
    assert_eq!((out["reachable"].clone(), out["build_ok"].clone()), (json!(true), json!(false)));
    assert_eq!(out["verified"], 0);
}

#[test]
fn nonce_not_echoed_is_not_build_ok() {
    let e = E::new("lastsave-mira", 1);
    let body = attest_body(BUILD, "stale-nonce", vec![e.build()]);
    let net = FakeNet::new(Some((200, body))).holder(&e);
    let out = run(&input("official"), &net);
    assert_eq!(out["build_ok"], false);
    assert_eq!(out["verified"], 0);
}

#[test]
fn unreachable_non_200_and_bad_json_are_not_reachable() {
    for attest in [None, Some((503, "down".to_string())), Some((200, "<html>".to_string())),
                   Some((200, "{\"build_hash\":1}".to_string()))] {
        let out = run(&input("official"), &FakeNet::new(attest));
        assert_eq!(out["ok"], true);
        assert_eq!((out["reachable"].clone(), out["build_ok"].clone()), (json!(false), json!(false)));
        assert_eq!(out["verified"], 0);
    }
}

#[test]
fn malformed_entries_are_rejected_individually() {
    let e = E::new("lastsave-mira", 1);
    let net = FakeNet::new(Some((200, good_attest(vec![json!({"login": 5}), json!("x"), e.build()])))).holder(&e);
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 1);
    assert_eq!(reasons(&out)["sig"], 2);
}

#[test]
fn malformed_input_is_ok_false() {
    let net = FakeNet::new(None);
    for bad in ["", "not json", "{}", &input("weird"), &input("host")] {
        let out = run(bad, &net);
        assert_eq!(out["ok"], false, "{bad}");
        assert!(out["error"].as_str().unwrap().starts_with("input"));
        assert!(out.get("verified").is_none());
    }
}

#[test]
fn rpc_retries_on_429_then_succeeds() {
    let e = E::new("lastsave-mira", 1);
    let net = net_with(&[&e], &[&e]);
    net.flaky_remaining.set(2);
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 1);
    assert_eq!(*net.sleeps.borrow(), vec![400, 800]);
}

#[test]
fn rpc_falls_back_to_second_url() {
    let e = E::new("lastsave-mira", 1);
    let mut net = net_with(&[&e], &[&e]);
    net.down_urls.insert("http://rpc-primary".into());
    let inp = input_with("official", "official", None, Some(vec!["http://rpc-primary", "http://rpc-fallback"]));
    let out = run(&inp, &net);
    assert_eq!(out["verified"], 1);
    assert!(net.urls_used.borrow().iter().any(|u| u == "http://rpc-fallback"));
}

#[test]
fn rpc_outage_is_an_error_not_a_verdict_on_the_host() {
    let e = E::new("lastsave-mira", 1);
    let mut net = net_with(&[&e], &[&e]);
    net.down_urls.insert("http://rpc-primary".into());
    net.down_urls.insert("http://rpc-fallback".into());
    let inp = input_with("official", "official", None, Some(vec!["http://rpc-primary", "http://rpc-fallback"]));
    let out = run(&inp, &net);
    assert_eq!(out["ok"], false);
    assert!(out["error"].as_str().unwrap().contains("rpc unavailable"));
}
