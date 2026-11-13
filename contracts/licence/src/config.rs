//! Init validation and mirror management.

use near_sdk::{env, near, require, NearToken, Promise};

use crate::util::{is_hex64, is_https};
use crate::{InitConfig, Licence, LicenceExt};

pub const MAX_MIRRORS: usize = 8;
pub const MIRROR_DEPOSIT: NearToken = NearToken::from_millinear(10);

fn check_urls(urls: &[String]) {
    require!(!urls.is_empty() && urls.len() <= MAX_MIRRORS, "Need 1 to 8 urls");
    for u in urls {
        require!(is_https(u), "Urls must be https");
    }
}

pub fn validate(c: &mut InitConfig) {
    c.release.sha256 = c.release.sha256.to_ascii_lowercase();
    c.probe.sha256 = c.probe.sha256.to_ascii_lowercase();
    c.artifact.sha256 = c.artifact.sha256.to_ascii_lowercase();
    c.artifact.build_hash = c.artifact.build_hash.to_ascii_lowercase();
    c.key_commitment = c.key_commitment.to_ascii_lowercase();
    for h in [&c.release.sha256, &c.probe.sha256, &c.artifact.sha256, &c.artifact.build_hash, &c.key_commitment] {
        require!(is_hex64(h), "Hashes must be 64 hex chars");
    }
    check_urls(&c.release.urls);
    check_urls(&c.probe.urls);
    check_urls(&c.artifact.urls);
    require!(is_https(&c.official_endpoint), "Official endpoint must be https");
    require!(c.price.0 > 0, "Price must be above zero");
    require!(c.fund_bps <= 10_000, "fund_bps is at most 10000");
    require!(c.royalty_bps <= 10_000, "royalty_bps is at most 10000");
    require!(c.liveness.probe_interval_ms > 0, "probe_interval_ms must be above zero");
    require!(c.liveness.fail_threshold > 0, "fail_threshold must be above zero");
    require!(c.liveness.receipt_window_ms > 0 && c.liveness.report_window_ms > 0, "Windows must be above zero");
    require!(c.liveness.quorum_bps > 0 && c.liveness.quorum_bps <= 10_000, "quorum_bps is 1 to 10000");
    require!(c.pool.epoch_ms > 0, "epoch_ms must be above zero");
    require!(c.title.len() <= 80 && c.game_id.len() <= 40 && c.media.len() <= 300, "Title, game id or media too long");
}

#[near]
impl Licence {
    /// Anyone may add a mirror url (content is pinned by sha256, so mirrors cannot lie).
    #[payable]
    pub fn add_mirror(&mut self, kind: String, url: String) {
        let paid = env::attached_deposit();
        require!(paid >= MIRROR_DEPOSIT, "Attach 0.01 NEAR for storage");
        require!(is_https(&url), "Url must be https");
        let urls = match kind.as_str() {
            "release" => &mut self.cfg.release.urls,
            "probe" => &mut self.cfg.probe.urls,
            "artifact" => &mut self.cfg.artifact.urls,
            _ => env::panic_str("Kind is release, probe or artifact"),
        };
        require!(urls.len() < MAX_MIRRORS, "Mirror list is full");
        require!(!urls.contains(&url), "Mirror already listed");
        urls.push(url);
        let extra = paid.saturating_sub(MIRROR_DEPOSIT);
        if !extra.is_zero() {
            Promise::new(env::predecessor_account_id()).transfer(extra).detach();
        }
    }
}
