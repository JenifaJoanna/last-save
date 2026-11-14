use super::*;
use crate::util::b64_encode;

fn blob(n: usize) -> (String, String) {
    let bytes = vec![7u8; n];
    (hex::encode(sha256(&bytes)), b64_encode(&bytes))
}

#[test]
fn escrow_stores_secret_with_access_rule_and_sets_flag() {
    let mut c = fresh();
    env_at(STUDIO, 50 * MILLI, T0);
    let _ = c.escrow_key("QUJDRA==".into());
    let calls = calls();
    assert_eq!(calls[0].0, "outlayer.testnet");
    assert_eq!(calls[0].1, "store_secrets");
    assert!(calls[0].2.contains("\"profile\":\"escrow\""));
    assert!(calls[0].2.contains("\"Predecessor\""));
    assert!(calls[0].2.contains(&"a".repeat(64)));
    assert!(calls[0].2.contains("\"vault_id\":null"));
    assert!(!c.escrow.escrowed);
    let id = c.escrow.flight.clone().unwrap().id;
    env_cb(T0, R::Empty);
    assert!(c.on_escrow(cb(id, STUDIO)));
    assert!(c.escrow.escrowed && c.escrow.flight.is_none());
    assert!(logs_have("escrowed"));
}

#[test]
fn escrow_twice_refused_even_while_in_flight() {
    let mut c = fresh();
    env_at(STUDIO, 50 * MILLI, T0);
    let _ = c.escrow_key("QUJDRA==".into());
    env_at(STUDIO, 50 * MILLI, T0 + 1000);
    assert_refused(|| drop(c.escrow_key("QUJDRA==".into())), "already running");
    let id = c.escrow.flight.clone().unwrap().id;
    env_cb(T0, R::Empty);
    c.on_escrow(cb(id, STUDIO));
    env_at(STUDIO, 50 * MILLI, T0 + 2000);
    assert_refused(|| drop(c.escrow_key("QUJDRA==".into())), "already escrowed");
}

#[test]
fn escrow_by_non_studio_refused() {
    let mut c = fresh();
    env_at(MIRA, 50 * MILLI, T0);
    assert_refused(|| drop(c.escrow_key("QUJDRA==".into())), "Only the studio");
}

#[test]
fn escrow_failure_reverts_and_refunds_the_studio() {
    let mut c = fresh();
    env_at(STUDIO, 50 * MILLI, T0);
    let _ = c.escrow_key("QUJDRA==".into());
    let id = c.escrow.flight.clone().unwrap().id;
    env_cb(T0, R::Failed);
    let mut cbk = cb(id, STUDIO);
    cbk.deposit = 50 * MILLI;
    assert!(!c.on_escrow(cbk));
    assert_eq!(transfers(), vec![(STUDIO.to_string(), 50 * MILLI)]);
    assert!(!c.escrow.escrowed && c.escrow.flight.is_none());
    env_at(STUDIO, 50 * MILLI, T0 + 1);
    let _ = c.escrow_key("QUJDRA==".into());
}

#[test]
fn attest_sets_verified_only_when_key_artifact_and_build_all_match() {
    let mut c = escrowed();
    let good = hex::encode(sha256(&key()));
    let cases = [
        (format!(r#"{{"ok":true,"key_sha256":"{}","artifact_ok":true,"build_ok":true}}"#, "0".repeat(64)), false),
        (format!(r#"{{"ok":true,"key_sha256":"{good}","artifact_ok":false,"build_ok":true}}"#), false),
        (format!(r#"{{"ok":true,"key_sha256":"{good}","artifact_ok":true,"build_ok":false}}"#), false),
        (format!(r#"{{"ok":false,"key_sha256":"{good}","artifact_ok":true,"build_ok":true}}"#), false),
        (format!(r#"{{"ok":true,"key_sha256":"{good}","artifact_ok":true,"build_ok":true}}"#), true),
    ];
    for (i, (out, ok)) in cases.into_iter().enumerate() {
        env_at(MIRA, 10 * MILLI, T0 + i as u64);
        let _ = c.attest(None);
        let id = c.escrow.attest_flight.clone().unwrap().id;
        assert!(calls().iter().any(|x| x.2.contains("secrets_ref")));
        env_cb(T0 + i as u64, R::Json(out));
        assert_eq!(c.on_attest(cb(id, MIRA)), ok, "case {i}");
        assert_eq!(c.escrow.verified, ok, "case {i}");
    }
    assert!(c.escrow.attested_at_ms.is_some());
}

#[test]
fn attest_null_changes_nothing_and_can_retry() {
    let mut c = escrowed();
    env_at(MIRA, 10 * MILLI, T0);
    let _ = c.attest(None);
    let id = c.escrow.attest_flight.clone().unwrap().id;
    env_cb(T0, R::Null);
    assert!(!c.on_attest(cb(id, MIRA)));
    assert!(!c.escrow.verified && c.escrow.attest_flight.is_none());
    env_at(MIRA, 10 * MILLI, T0 + 1);
    let _ = c.attest(None);
}

#[test]
fn buy_alive_splits_pot_and_studio_share() {
    let mut c = escrowed();
    let id = buy(&mut c, MIRA, T0);
    assert_eq!(id, "1");
    let t = transfers();
    assert_eq!(t.len(), 1);
    assert_eq!(t[0].0, STUDIO);
    assert!(t[0].1 > 140 * MILLI && t[0].1 < 150 * MILLI, "studio got {}", t[0].1);
    assert_eq!(c.totals.pot_locked, POT);
    assert_eq!((c.supply, c.live_supply), (1, 1));
    assert!(logs_have("licence_sold"));
    env_at(MIRA, 0, T0);
    let v = c.get_token("1".into()).unwrap();
    assert_eq!((v.owner_id.as_str(), v.pot_share.0, v.post_death, v.choice), (MIRA, POT, false, None));
    let l = c.licence_of(acct(MIRA)).unwrap();
    assert_eq!(l.token_id, "1");
    assert!(c.licence_of(acct(KOFI)).is_none());
}

#[test]
fn buy_with_wrong_deposit_refused() {
    let mut c = escrowed();
    for d in [PRICE - 1, PRICE + 1, 0] {
        env_at(MIRA, d, T0);
        assert_refused(|| drop(c.buy_licence()), "exactly the price");
    }
    assert_eq!(c.supply, 0);
}

#[test]
fn buy_before_escrow_refused() {
    let mut c = fresh();
    env_at(MIRA, PRICE, T0);
    assert_refused(|| drop(c.buy_licence()), "not on sale");
}

#[test]
fn buy_after_death_goes_to_pool_with_no_pot_share() {
    let mut c = four();
    env_at(STUDIO, 0, T0 + 10);
    c.end_of_service();
    let pot_before = c.totals.pot_locked;
    buy(&mut c, "lastsave-late.testnet", T0 + 20);
    assert!(transfers().is_empty(), "no studio payout after death");
    // net of mint storage: 90% feeds the pool, 10% the ops budget (OPS_SALE_BPS)
    let net = c.totals.pool + c.totals.ops_budget;
    assert!(net > PRICE - 10 * MILLI && net <= PRICE, "net {net}");
    assert_eq!(c.totals.ops_budget, net / 10, "10% of a post-death sale funds ops");
    assert_eq!(c.totals.pot_locked, pot_before);
    assert_eq!((c.supply, c.live_supply), (5, 4));
    assert!(logs_have("licence_sold"));
    env_at(MIRA, 0, T0 + 30);
    let v = c.get_token("5".into()).unwrap();
    assert!(v.post_death && v.pot_share.0 == 0);
}

#[test]
fn snapshot_ok_keeps_latest_and_last_32_hashes() {
    let mut c = escrowed();
    for seq in 1..=40u64 {
        let (h, b) = blob(10 + seq as usize);
        env_at(STUDIO, 0, T0 + seq);
        c.post_snapshot(seq, h, b);
    }
    env_at(MIRA, 0, T0 + 50);
    let s = c.get_snapshot().unwrap();
    assert_eq!(s.seq, 40);
    assert_eq!(crate::util::b64_decode(&s.blob_base64).unwrap().len(), 50);
    assert_eq!(c.get_info().snapshot_hashes.len(), 32);
    assert_eq!(c.get_info().snapshot_hashes.last().unwrap(), &s.hash);
}

#[test]
fn snapshot_rejections() {
    let mut c = escrowed();
    let (h, b) = blob(100);
    env_at(MIRA, 0, T0);
    assert_refused(|| c.post_snapshot(1, h.clone(), b.clone()), "Only the studio");
    env_at(STUDIO, 0, T0);
    let (hb, bb) = blob(16_385);
    assert_refused(|| c.post_snapshot(1, hb, bb), "over 16384");
    let (hm, bm) = blob(16_384);
    c.post_snapshot(1, hm, bm);
    assert_refused(|| c.post_snapshot(2, "0".repeat(64), b.clone()), "hash does not match");
    assert_refused(|| c.post_snapshot(1, h.clone(), b.clone()), "must increase");
    assert_refused(|| c.post_snapshot(0, h.clone(), b.clone()), "must increase");
    assert_refused(|| c.post_snapshot(5, h.clone(), "not base64!".into()), "base64");
    c.post_snapshot(5, h.clone(), b.clone());
    env_at(STUDIO, 0, T0 + 5);
    c.end_of_service();
    assert_refused(|| c.post_snapshot(6, h, b), "already ended");
}

#[test]
fn base64_roundtrip_matches_standard_vectors() {
    for (raw, enc) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("foob", "Zm9vYg=="), ("fooba", "Zm9vYmE="), ("foobar", "Zm9vYmFy")] {
        assert_eq!(b64_encode(raw.as_bytes()), enc);
        assert_eq!(crate::util::b64_decode(enc).unwrap(), raw.as_bytes());
    }
    assert!(crate::util::b64_decode("Zg=").is_none());
    assert!(crate::util::b64_decode("Z===").is_none());
    assert!(crate::util::b64_decode("Zm9v====").is_none());
}

#[test]
fn mirrors_need_deposit_https_and_cap_at_eight() {
    let mut c = fresh();
    env_at(MIRA, 5 * MILLI, T0);
    assert_refused(|| c.add_mirror("release".into(), "https://m1.example.test/r.wasm".into()), "0.01 NEAR");
    env_at(MIRA, 10 * MILLI, T0);
    assert_refused(|| c.add_mirror("release".into(), "http://m1.example.test/r.wasm".into()), "https");
    assert_refused(|| c.add_mirror("other".into(), "https://m1.example.test/r.wasm".into()), "Kind is");
    c.add_mirror("release".into(), "https://m1.example.test/r.wasm".into());
    assert_refused(|| c.add_mirror("release".into(), "https://m1.example.test/r.wasm".into()), "already listed");
    for i in 2..=7 {
        c.add_mirror("probe".into(), format!("https://m{i}.example.test/p.wasm"));
    }
    c.add_mirror("probe".into(), "https://m8.example.test/p.wasm".into());
    assert_eq!(c.cfg.probe.urls.len(), 8);
    assert_refused(|| c.add_mirror("probe".into(), "https://m9.example.test/p.wasm".into()), "full");
    assert_eq!(c.cfg.release.urls.len(), 2);
}

#[test]
fn init_rejects_bad_config() {
    let mut bad = cfg();
    bad.key_commitment = "zz".into();
    env_at(STUDIO, 0, T0);
    assert_refused(|| drop(Licence::new(bad)), "64 hex");
    let mut bad = cfg();
    bad.release.urls = vec!["ftp://x".into()];
    assert_refused(|| drop(Licence::new(bad)), "https");
    let mut bad = cfg();
    bad.fund_bps = 10_001;
    assert_refused(|| drop(Licence::new(bad)), "fund_bps");
}
