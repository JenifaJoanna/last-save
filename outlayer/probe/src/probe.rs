//! Orchestration: fetch `/attest`, judge reachability and build, verify each session.

use crate::check::{check_local, Reason};
use crate::rpc::{Net, Rpc};
use crate::wire::{render, render_error, Attest, Input, Output, MAX_ENTRIES};
use std::collections::HashSet;

/// Stop starting new RPC work after this long (OutLayer allows 60 s per run).
const TIME_BUDGET_MS: u64 = 45_000;

/// Runs one probe and returns the single JSON line to print. Never panics.
pub fn run(raw_input: &str, net: &dyn Net) -> String {
    let input = match Input::parse(raw_input) {
        Ok(i) => i,
        Err(e) => return render_error(&e),
    };
    match probe(&input, net) {
        Ok(mut out) => render(&mut out),
        Err(e) => render_error(&e),
    }
}

fn pct(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
            o.push(b as char);
        } else {
            o.push_str(&format!("%{b:02X}"));
        }
    }
    o
}

/// `{endpoint}/attest?nonce=&host=&from=&to=&epoch=`; `epoch` is omitted when null.
pub fn attest_url(input: &Input) -> String {
    let mut url = format!(
        "{}/attest?nonce={}&host={}&from={}&to={}",
        input.endpoint.trim_end_matches('/'),
        pct(&input.nonce),
        pct(&input.host_id),
        input.from_ms,
        input.to_ms
    );
    if let Some(e) = input.epoch {
        url.push_str(&format!("&epoch={e}"));
    }
    url
}

fn fetch_attest(input: &Input, net: &dyn Net) -> Option<Attest> {
    let resp = net.get(&attest_url(input)).ok()?;
    if resp.status != 200 {
        return None;
    }
    serde_json::from_slice(&resp.body).ok()
}

fn probe(input: &Input, net: &dyn Net) -> Result<Output, String> {
    let mut out = Output { ok: true, mode: input.mode.clone(), ..Default::default() };
    let Some(att) = fetch_attest(input, net) else { return Ok(out) };
    out.reachable = true;
    out.build_ok = att.nonce == input.nonce && att.build_hash == input.build_hash;
    if !out.build_ok {
        return Ok(out);
    }

    let rpc = Rpc::new(net, input.rpc_urls(), &input.contract);
    let mut seen: HashSet<(String, String)> = HashSet::new();
    let mut done: HashSet<String> = HashSet::new();
    for raw in att.sessions.iter().take(MAX_ENTRIES) {
        let local = match check_local(input, raw) {
            Ok(l) => l,
            Err(r) => {
                count(&mut out, r);
                continue;
            }
        };
        if !seen.insert((local.account_id.clone(), local.receipt_nonce.clone())) {
            count(&mut out, Reason::Replay);
            continue;
        }
        if done.contains(&local.account_id) {
            continue; // same account, new nonce: counted once
        }
        if net.elapsed_ms() > TIME_BUDGET_MS {
            out.truncated = true;
            break;
        }
        if !rpc.key_exists(&local.account_id, &local.public_key)? {
            count(&mut out, Reason::Key);
        } else if !rpc.has_licence(&local.account_id)? {
            count(&mut out, Reason::Licence);
        } else {
            done.insert(local.account_id.clone());
            out.verified += 1;
            if out.sample.len() < 4 {
                out.sample.push(local.account_id);
            }
        }
    }
    Ok(out)
}

fn count(out: &mut Output, r: Reason) {
    out.rejected += 1;
    let c = &mut out.reasons;
    match r {
        Reason::Sig => c.sig += 1,
        Reason::Key => c.key += 1,
        Reason::Licence => c.licence += 1,
        Reason::Window => c.window += 1,
        Reason::Host => c.host += 1,
        Reason::Replay => c.replay += 1,
    }
}
