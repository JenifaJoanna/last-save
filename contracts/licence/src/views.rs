//! Read-only views. `get_info` is one call a dashboard can render from.

use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId};

use crate::types::*;
use crate::{store, Licence, LicenceExt};

const MAX_PAGE: u64 = 100;

impl Licence {
    pub(crate) fn status_str(&self) -> String {
        if self.dead { "Dead" } else { "Alive" }.to_string()
    }

    fn token_view(&self, n: u64) -> Option<LicenceView> {
        let d = store::token(n)?;
        Some(LicenceView {
            token_id: n.to_string(),
            owner_id: d.owner,
            pot_share: U128(d.pot_share),
            choice: d.choice,
            minted_at_ms: d.minted_at_ms,
            post_death: d.post_death,
        })
    }

    fn reports_in_window(&self) -> u32 {
        let now = Self::now();
        let w = self.cfg.liveness.report_window_ms;
        store::reports().iter().filter(|(_, t)| now.saturating_sub(*t) < w).count() as u32
    }
}

#[near]
impl Licence {
    /// Read by release.wasm inside the TEE before it hands out K.
    pub fn ls_status(&self) -> String {
        self.status_str()
    }

    /// Read by release.wasm in attest mode.
    pub fn release_info(&self) -> ReleaseInfo {
        ReleaseInfo {
            artifact_urls: self.cfg.artifact.urls.clone(),
            artifact_sha256: self.cfg.artifact.sha256.clone(),
            build_hash: self.cfg.artifact.build_hash.clone(),
            key_commitment: self.cfg.key_commitment.clone(),
            status: self.status_str(),
        }
    }

    /// One of the account's licences (the oldest), or null. Servers use this as the gate.
    pub fn licence_of(&self, account_id: AccountId) -> Option<LicenceView> {
        let first = store::owner_tokens(&account_id).into_iter().min()?;
        self.token_view(first)
    }

    pub fn get_token(&self, token_id: String) -> Option<LicenceView> {
        self.token_view(token_id.parse::<u64>().ok()?)
    }

    pub fn get_info(&self) -> Info {
        let now = Self::now();
        let t = &self.totals;
        let epoch = self.release.released_at_ms.map(|r| now.saturating_sub(r) / self.cfg.pool.epoch_ms);
        Info {
            now_ms: now,
            contract_id: env::current_account_id(),
            config: self.cfg.clone(),
            status: self.status_str(),
            cause: self.cause.clone(),
            died_at_ms: self.died_at_ms,
            escrowed: self.escrow.escrowed,
            escrow_in_flight: self.escrow.flight.is_some(),
            escrow_verified: self.escrow.verified,
            attested_at_ms: self.escrow.attested_at_ms,
            escrow_error: self.escrow.last_error.clone(),
            release: ReleaseView {
                in_flight: self.release.flight.is_some(),
                in_flight_since_ms: self.release.flight.as_ref().map(|f| f.started_ms),
                released: self.release.released_key.is_some(),
                released_key: self.release.released_key.clone(),
                released_at_ms: self.release.released_at_ms,
                last_error: self.release.last_error.clone(),
            },
            released_key: self.release.released_key.clone(),
            released_at_ms: self.release.released_at_ms,
            totals: TotalsView {
                supply: self.supply,
                live_supply: self.live_supply,
                pot_locked: U128(t.pot_locked),
                pool: U128(t.pool),
                refunded: U128(t.refunded),
                pledged: U128(t.pledged),
                paid_out: U128(t.paid_out),
            },
            probe: ProbeView {
                consecutive_failures: self.probe.consecutive_failures,
                last_alive_ms: self.probe.last_alive_ms,
                last_probe_ms: self.probe.last_probe_ms,
                in_flight: self.probe.flight.is_some(),
                in_flight_since_ms: self.probe.flight.as_ref().map(|f| f.started_ms),
                last_error: self.probe.last_error.clone(),
            },
            reports_in_window: self.reports_in_window(),
            reports_needed: self.reports_needed(),
            current_epoch: epoch,
            hosts: store::host_ids().len() as u64,
            claims: self.claim_count,
            snapshot: self.snap.clone(),
            snapshot_hashes: self.snap_hashes.iter().map(hex::encode).collect(),
        }
    }

    pub fn get_hosts(&self) -> Vec<HostView> {
        store::host_ids()
            .into_iter()
            .take(200)
            .filter_map(|id| {
                let h = store::host(&id)?;
                Some(HostView {
                    host_id: id,
                    endpoint: h.endpoint,
                    host_pubkey: h.host_pubkey,
                    registered_at_ms: h.registered_at_ms,
                    epochs_paid: h.epochs_paid,
                    sessions_paid: h.sessions_paid,
                    earned: U128(h.earned),
                })
            })
            .collect()
    }

    pub fn get_claims(&self, from_index: u64, limit: u64) -> Vec<ClaimView> {
        let end = self.claim_count.min(from_index.saturating_add(limit.min(MAX_PAGE)));
        (from_index..end)
            .filter_map(|i| {
                let c = store::claim(i)?;
                Some(ClaimView {
                    index: i,
                    host_id: c.host_id,
                    epoch: c.epoch,
                    verified: c.verified,
                    paid: U128(c.paid),
                    at_ms: c.at_ms,
                })
            })
            .collect()
    }

    pub fn get_snapshot(&self) -> Option<SnapshotView> {
        let s = store::snapshot()?;
        Some(SnapshotView {
            seq: s.meta.seq,
            hash: s.meta.hash,
            blob_base64: crate::util::b64_encode(&s.blob),
            at_ms: s.meta.at_ms,
        })
    }

    /// Last probe, report and claim outcomes, newest first (at most 64 are kept).
    pub fn get_activity(&self, limit: Option<u32>) -> Vec<Activity> {
        let mut v = store::activity();
        v.reverse();
        v.truncate(limit.unwrap_or(64) as usize);
        v
    }
}
