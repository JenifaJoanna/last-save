//! Probe behaviour against a fake network: every rejection path and the happy path.

mod common;

use common::*;
use serde_json::{json, Value};

fn only(out: &Value, reason: &str) {
    assert_eq!(out["verified"], 0, "{out}");
    assert_eq!(out["rejected"], 1, "{out}");
    for k in ["sig", "key", "licence", "window", "host", "replay"] {
        assert_eq!(reasons(out)[k], if k == reason { 1 } else { 0 }, "{k}: {out}");
    }
}

#[test]
fn valid_session_verifies() {
    let mira = E::new("lastsave-mira", 1);
    let net = net_with(&[&mira], &[&mira]);
    let out = run(&input("official"), &net);
    assert_eq!(out["ok"], true);
    assert_eq!(out["mode"], "official");
    assert_eq!((out["reachable"].clone(), out["build_ok"].clone()), (json!(true), json!(true)));
    assert_eq!(out["verified"], 1);
    assert_eq!(out["rejected"], 0);
    assert_eq!(out["sample"], json!(["lastsave-mira.testnet"]));
    assert!(out.get("truncated").is_none());
}

#[test]
fn attest_request_carries_query_and_omits_null_epoch() {
    let mira = E::new("lastsave-mira", 1);
    let net = net_with(&[&mira], &[&mira]);
    run(&input("official"), &net);
    let url = net.get_urls.borrow()[0].clone();
    assert_eq!(
        url,
        format!("https://game.example/attest?nonce=c0ffee11&host=official&from={FROM}&to={TO}")
    );
}

#[test]
fn forged_login_signature_is_rejected() {
    let mut e = E::new("lastsave-mira", 1);
    e.forge_login_sig = true;
    let net = net_with(&[&e], &[&e]);
    only(&run(&input("official"), &net), "sig");
    assert_eq!(net.calls("view_access_key"), 0, "no RPC for an entry that fails locally");
}

#[test]
fn forged_receipt_signature_is_rejected() {
    let mut v = E::new("lastsave-mira", 1).build();
    let sig = v["receipt"]["signature"].as_str().unwrap().to_string();
    let flipped = if sig.starts_with('A') { "B" } else { "A" };
    v["receipt"]["signature"] = json!(format!("{flipped}{}", &sig[1..]));
    let e = E::new("lastsave-mira", 1);
    let mut net = FakeNet::new(Some((200, good_attest(vec![v])))).holder(&e);
    net.licensed.insert(e.account.clone());
    only(&run(&input("official"), &net), "sig");
}

#[test]
fn receipt_signed_by_another_session_key_is_rejected() {
    let mut e = E::new("lastsave-mira", 1);
    e.receipt_key = 0x7f; // not the session key named in the login
    let net = net_with(&[&e], &[&e]);
    only(&run(&input("official"), &net), "sig");
}

#[test]
fn wrong_host_is_rejected() {
    let mut e = E::new("lastsave-mira", 1);
    e.host = "lastsave-fanhost.testnet".into();
    e.login_host = "lastsave-fanhost.testnet".into();
    let net = net_with(&[&e], &[&e]);
    only(&run(&input("official"), &net), "host");
}

#[test]
fn login_for_another_host_is_rejected_even_with_matching_receipt_host() {
    let mut e = E::new("lastsave-mira", 1);
    e.login_host = "lastsave-fanhost.testnet".into();
    let net = net_with(&[&e], &[&e]);
    only(&run(&input("official"), &net), "host");
}

#[test]
fn wrong_recipient_is_rejected() {
    let mut e = E::new("lastsave-mira", 1);
    e.recipient = "other-game.testnet".into();
    let net = net_with(&[&e], &[&e]);
    only(&run(&input("official"), &net), "host");
}

#[test]
fn expired_login_is_rejected() {
    let mut e = E::new("lastsave-mira", 1);
    e.exp_ms = TS; // receipt ts is not strictly before exp
    let net = net_with(&[&e], &[&e]);
    only(&run(&input("official"), &net), "window");
}

#[test]
fn receipt_outside_window_is_rejected() {
    let mut early = E::new("lastsave-mira", 1);
    early.ts_ms = FROM - 1;
    let mut late = E::new("lastsave-kofi", 2);
    late.ts_ms = TO + 1;
    late.exp_ms = TO + 10_000;
    let net = net_with(&[&early, &late], &[&early, &late]);
    let out = run(&input("official"), &net);
    assert_eq!((out["verified"].clone(), out["rejected"].clone()), (json!(0), json!(2)));
    assert_eq!(reasons(&out)["window"], 2);
}

#[test]
fn window_edges_are_inclusive() {
    let mut a = E::new("lastsave-mira", 1);
    a.ts_ms = FROM;
    let mut b = E::new("lastsave-kofi", 2);
    b.ts_ms = TO;
    b.exp_ms = TO + 10_000;
    let net = net_with(&[&a, &b], &[&a, &b]);
    assert_eq!(run(&input("official"), &net)["verified"], 2);
}

#[test]
fn wrong_epoch_is_rejected_and_right_epoch_passes() {
    let mut bad = E::new("lastsave-mira", 1);
    bad.host = "lastsave-fanhost.testnet".into();
    bad.login_host = bad.host.clone();
    bad.epoch = Some(4);
    let mut good = bad.clone();
    good.epoch = Some(5);
    good.account = "lastsave-kofi.testnet".into();
    good.acct_key = 0x42;
    good.nonce_hex = format!("{:032x}", 99);
    let inp = input_with("host", "lastsave-fanhost.testnet", Some(5), None);
    let net = net_with(&[&bad, &good], &[&bad, &good]);
    let out = run(&inp, &net);
    assert_eq!(out["verified"], 1, "{out}");
    assert_eq!(reasons(&out)["window"], 1);
    assert_eq!(out["sample"], json!(["lastsave-kofi.testnet"]));
    assert!(net.get_urls.borrow()[0].ends_with("&epoch=5"));
}

#[test]
fn replayed_nonce_is_rejected_once_counted_once() {
    let e = E::new("lastsave-mira", 1);
    let net = net_with(&[&e, &e], &[&e]);
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 1);
    assert_eq!(out["rejected"], 1);
    assert_eq!(reasons(&out)["replay"], 1);
}

#[test]
fn same_account_twice_counts_once() {
    let first = E::new("lastsave-mira", 1);
    let mut second = first.clone();
    second.nonce_hex = format!("{:032x}", 12345);
    let net = net_with(&[&first, &second], &[&first]);
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 1);
    assert_eq!(out["rejected"], 0);
    assert_eq!(out["sample"], json!(["lastsave-mira.testnet"]));
    assert_eq!(net.calls("view_access_key"), 1, "answers are cached per account");
    assert_eq!(net.calls("call_function"), 1);
}

#[test]
fn forged_copy_of_a_nonce_cannot_burn_the_real_one() {
    let real = E::new("lastsave-mira", 1);
    let mut forged = real.clone();
    forged.forge_login_sig = true;
    let net = net_with(&[&forged, &real], &[&real]);
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 1);
    assert_eq!(reasons(&out)["sig"], 1);
    assert_eq!(reasons(&out)["replay"], 0);
}

#[test]
fn key_that_is_not_an_access_key_is_rejected() {
    let e = E::new("lastsave-mira", 1);
    let mut net = net_with(&[&e], &[]);
    net.licensed.insert(e.account.clone()); // holds a licence, but the signing key is not on the account
    only(&run(&input("official"), &net), "key");
    assert_eq!(net.calls("call_function"), 0);
}

#[test]
fn non_holder_is_rejected() {
    let e = E::new("lastsave-mira", 1);
    let mut net = net_with(&[&e], &[]);
    net.keys.insert((e.account.clone(), e.account_pk()));
    only(&run(&input("official"), &net), "licence");
}

#[test]
fn mixed_batch_counts_each_reason_and_samples_at_most_four() {
    let holders: Vec<E> = (1..=6).map(|n| E::new(&format!("lastsave-p{n}"), n)).collect();
    let nobody = E::new("lastsave-nobody", 9);
    let mut all: Vec<&E> = holders.iter().collect();
    all.push(&nobody);
    let net = net_with(&all, &holders.iter().collect::<Vec<_>>());
    let out = run(&input("official"), &net);
    assert_eq!(out["verified"], 6);
    assert_eq!(out["rejected"], 1);
    assert_eq!(out["sample"].as_array().unwrap().len(), 4);
}

#[test]
fn more_than_64_entries_are_capped() {
    let es: Vec<E> = (0..70u8).map(|n| E::new(&format!("lastsave-bot{n}"), n % 16 + 1)).collect();
    let mut es = es;
    for (i, e) in es.iter_mut().enumerate() {
        e.nonce_hex = format!("{i:032x}");
        e.account = format!("lastsave-bot{i}.testnet");
    }
    let refs: Vec<&E> = es.iter().collect();
    let net = net_with(&refs, &refs);
    assert_eq!(run(&input("official"), &net)["verified"], 64);
}
