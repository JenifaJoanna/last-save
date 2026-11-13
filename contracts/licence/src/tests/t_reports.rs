use super::*;

// ---- reports ----

#[test]
fn report_below_quorum_does_not_kill() {
    let mut c = four(); // 4 live tokens, quorum 50% => 2 needed
    env_at(MIRA, 0, T0 + 1);
    c.report_down("1".into());
    assert!(logs_have("report_down"));
    assert!(!c.dead);
    assert_eq!(info(&c, T0 + 2).reports_in_window, 1);
    assert_eq!(c.get_info().reports_needed, 2);
}

#[test]
fn quorum_of_holders_kills_the_game() {
    let mut c = four();
    env_at(MIRA, 0, T0 + 1);
    c.report_down("1".into());
    env_at(KOFI, 0, T0 + 2);
    c.report_down("2".into());
    assert!(c.dead);
    assert_eq!(c.cause.as_deref(), Some("players"));
    assert!(logs_have("died"));
}

#[test]
fn reports_outside_the_window_expire() {
    let mut c = four();
    env_at(MIRA, 0, T0);
    c.report_down("1".into());
    env_at(KOFI, 0, T0 + 120_000); // exactly one window later: first report no longer counts
    c.report_down("2".into());
    assert!(!c.dead);
    env_at(YUNA, 0, T0 + 120_001);
    c.report_down("3".into());
    assert!(c.dead, "two reports inside one window reach quorum");
}

#[test]
fn only_the_holder_can_report_and_only_real_tokens() {
    let mut c = four();
    env_at(KOFI, 0, T0 + 1);
    assert_refused(|| c.report_down("1".into()), "Only the licence holder");
    env_at("lastsave-stranger.testnet", 0, T0 + 1);
    assert_refused(|| c.report_down("1".into()), "Only the licence holder");
    assert_refused(|| c.report_down("99".into()), "No such licence");
    assert_refused(|| c.report_down("abc".into()), "No such licence");
}

#[test]
fn a_token_reports_once_per_window() {
    let mut c = four();
    env_at(MIRA, 0, T0);
    c.report_down("1".into());
    env_at(MIRA, 0, T0 + 119_999);
    assert_refused(|| c.report_down("1".into()), "Already reported");
    assert!(!c.dead);
    env_at(MIRA, 0, T0 + 120_000);
    c.report_down("1".into());
    assert_eq!(c.get_info().reports_in_window, 1);
}

#[test]
fn post_death_tokens_cannot_report_and_dead_game_refuses_reports() {
    let mut c = four();
    env_at(STUDIO, 0, T0);
    c.end_of_service();
    buy(&mut c, "lastsave-late.testnet", T0 + 5);
    env_at("lastsave-late.testnet", 0, T0 + 6);
    assert_refused(|| c.report_down("5".into()), "already ended");
    // the post_death flag itself blocks the report even if the state machine were alive
    c.dead = false;
    assert_refused(|| c.report_down("5".into()), "bought after the game ended");
}

#[test]
fn end_of_service_is_studio_only_and_final() {
    let mut c = four();
    env_at(MIRA, 0, T0);
    assert_refused(|| c.end_of_service(), "Only the studio");
    env_at(STUDIO, 0, T0 + 1);
    c.end_of_service();
    assert_eq!((c.dead, c.cause.as_deref()), (true, Some("studio")));
    let died = c.died_at_ms;
    env_at(STUDIO, 0, T0 + 2);
    assert_refused(|| c.end_of_service(), "already ended");
    c.die("probes"); // double death is a no-op
    assert_eq!((c.cause.as_deref(), c.died_at_ms), (Some("studio"), died));
    assert!(calls().is_empty());
}

#[test]
fn a_transferred_token_can_still_report_by_its_new_owner() {
    let mut c = four();
    env_at(MIRA, 1, T0);
    c.nft_transfer(acct(YUNA), "1".into(), None, None);
    env_at(MIRA, 0, T0 + 1);
    assert_refused(|| c.report_down("1".into()), "Only the licence holder");
    env_at(YUNA, 0, T0 + 1);
    c.report_down("1".into());
}
