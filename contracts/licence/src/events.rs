//! NEP-297 events (`standard: "lastsave"`) and the rolling activity log.

use near_sdk::env;

use crate::store;
use crate::types::Activity;

const MAX_ACTIVITY: usize = 64;

/// `data` is a JSON object body without braces, e.g. `"cause":"studio"`.
pub fn emit(event: &str, data: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"lastsave\",\"version\":\"1.0.0\",\"event\":\"{event}\",\"data\":[{{{data}}}]}}"
    ));
}

/// NEP-171 events use their own standard name.
pub fn emit_nep171(event: &str, data: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.2.0\",\"event\":\"{event}\",\"data\":[{{{data}}}]}}"
    ));
}

/// Appends one outcome to the log (newest last in storage, capped at 64).
pub fn log_activity(kind: &str, outcome: &str, detail: &str) {
    let mut v = store::activity();
    let mut d = detail.to_string();
    d.truncate(120);
    v.push(Activity {
        at_ms: env::block_timestamp_ms(),
        kind: kind.to_string(),
        outcome: outcome.to_string(),
        detail: d,
    });
    if v.len() > MAX_ACTIVITY {
        let cut = v.len() - MAX_ACTIVITY;
        v.drain(0..cut);
    }
    store::set_activity(&v);
}
