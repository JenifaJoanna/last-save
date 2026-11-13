//! Liveness: OutLayer probes of the official server and holder reports.

use near_sdk::{env, near, require, Promise};

use crate::events::{emit, log_activity};
use crate::outlayer::{nonce_hex, read_out, Out};
use crate::util::Cb;
use crate::{store, Licence, LicenceExt};

impl Licence {
    pub(crate) fn reports_needed(&self) -> u32 {
        let q = self.cfg.liveness.quorum_bps as u128;
        (q * self.live_supply as u128).div_ceil(10_000) as u32
    }

    fn probe_inconclusive(&mut self, why: &str) {
        self.probe.last_probe_ms = Some(Self::now());
        self.probe.last_error = Some(why.to_string());
        emit("probe", &format!("\"result\":\"inconclusive\",\"failures\":{},\"verified\":0", self.probe.consecutive_failures));
        log_activity("probe", "inconclusive", why);
    }

    /// Applies one conclusive official probe. Alive = reachable, right build, and
    /// at least one verified session. A failure counts only if it is spaced at least
    /// probe_interval after the last counted failure.
    fn judge_probe(&mut self, reachable: bool, build_ok: bool, verified: u64) {
        let now = Self::now();
        self.probe.last_probe_ms = Some(now);
        self.probe.last_error = None;
        if reachable && build_ok && verified >= 1 {
            self.probe.consecutive_failures = 0;
            self.probe.last_counted_failure_ms = None;
            self.probe.last_alive_ms = Some(now);
            emit("probe", &format!("\"result\":\"alive\",\"failures\":0,\"verified\":{verified}"));
            log_activity("probe", "alive", &format!("{verified} verified sessions"));
            return;
        }
        let spaced = self
            .probe
            .last_counted_failure_ms
            .is_none_or(|t| now.saturating_sub(t) >= self.cfg.liveness.probe_interval_ms);
        if spaced {
            self.probe.consecutive_failures += 1;
            self.probe.last_counted_failure_ms = Some(now);
        }
        let why = if !reachable {
            "unreachable"
        } else if !build_ok {
            "wrong build"
        } else {
            "no verified sessions"
        };
        let failures = self.probe.consecutive_failures;
        emit("probe", &format!("\"result\":\"failed\",\"failures\":{failures},\"verified\":{verified}"));
        log_activity("probe", "failed", &format!("{why}{}", if spaced { "" } else { " (too soon, not counted)" }));
        if failures >= self.cfg.liveness.fail_threshold {
            self.die("probes");
        }
    }
}

#[near]
impl Licence {
    /// Anyone, while Alive: OutLayer asks the official server for fresh signed sessions.
    #[payable]
    pub fn probe_official(&mut self, mirror_index: Option<u32>) -> Promise {
        self.require_alive();
        let id = Self::begin_flight(&mut self.probe.flight, &mut self.next_flight, "A probe");
        let now = Self::now();
        let input = format!(
            "{{\"mode\":\"official\",\"contract\":\"{}\",\"endpoint\":\"{}\",\"host_id\":\"official\",\"build_hash\":\"{}\",\"nonce\":\"{}\",\"from_ms\":{},\"to_ms\":{now},\"epoch\":null}}",
            env::current_account_id(),
            self.cfg.official_endpoint,
            self.cfg.artifact.build_hash,
            nonce_hex(),
            now.saturating_sub(self.cfg.liveness.receipt_window_ms),
        );
        self.outlayer_call(&self.cfg.probe, mirror_index, &input, false, "on_probe", &Cb::new(id))
    }

    #[private]
    pub fn on_probe(&mut self, #[serializer(borsh)] cb: Cb) {
        Self::end_flight(&mut self.probe.flight, cb.flight);
        let out = read_out();
        if let Out::Failed = out {
            Self::refund_failed(&cb.payer, cb.deposit);
        }
        if self.dead {
            return;
        }
        match out {
            Out::Failed => self.probe_inconclusive("probe call failed"),
            Out::Null => self.probe_inconclusive("probe run failed or timed out"),
            Out::Res(r) => match (r.ok, r.reachable, r.build_ok, r.verified) {
                (Some(true), Some(a), Some(b), Some(n)) => self.judge_probe(a, b, n),
                _ => self.probe_inconclusive("probe output was not usable"),
            },
        }
    }

    /// A holder says the game is down. Quorum of holders inside the window kills it.
    pub fn report_down(&mut self, token_id: String) {
        self.require_alive();
        let (n, mut td) = self.load_token(&token_id);
        require!(td.owner == env::predecessor_account_id(), "Only the licence holder can report");
        require!(!td.post_death, "Licences bought after the game ended cannot report");
        let now = Self::now();
        let window = self.cfg.liveness.report_window_ms;
        if let Some(t) = td.last_report_ms {
            require!(now.saturating_sub(t) >= window, "Already reported in this window");
        }
        let mut reps = store::reports();
        reps.retain(|(_, t)| now.saturating_sub(*t) < window);
        reps.push((n, now));
        store::set_reports(&reps);
        td.last_report_ms = Some(now);
        store::set_token(n, &td);
        let count = reps.len() as u32;
        let needed = self.reports_needed();
        emit("report_down", &format!("\"token_id\":\"{token_id}\",\"count\":{count},\"needed\":{needed}"));
        log_activity("report", "down", &format!("licence {token_id}: {count} of {needed}"));
        if count as u128 * 10_000 >= self.cfg.liveness.quorum_bps as u128 * self.live_supply as u128 {
            self.die("players");
        }
    }
}
