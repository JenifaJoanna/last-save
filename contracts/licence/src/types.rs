//! Shared data types: init config, stored records and JSON views.

use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Program {
    pub urls: Vec<String>,
    pub sha256: String,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Artifact {
    pub urls: Vec<String>,
    pub sha256: String,
    pub build_hash: String,
    pub size: u64,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Liveness {
    pub probe_interval_ms: u64,
    pub fail_threshold: u32,
    pub receipt_window_ms: u64,
    pub report_window_ms: u64,
    pub quorum_bps: u16,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct PoolCfg {
    pub epoch_ms: u64,
    pub pay_per_session: U128,
    pub epoch_cap: U128,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct InitConfig {
    pub studio: AccountId,
    pub outlayer: AccountId,
    pub title: String,
    pub game_id: String,
    pub media: String,
    pub price: U128,
    pub fund_bps: u16,
    pub royalty_bps: u16,
    pub release: Program,
    pub probe: Program,
    pub key_commitment: String,
    pub artifact: Artifact,
    pub official_endpoint: String,
    pub liveness: Liveness,
    pub pool: PoolCfg,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Choice {
    Refund,
    Pledge,
}

impl Choice {
    pub fn name(&self) -> &'static str {
        match self {
            Choice::Refund => "Refund",
            Choice::Pledge => "Pledge",
        }
    }
}

/// Per-token state kept next to the NEP-171 ownership maps.
#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct TokenData {
    pub owner: AccountId,
    pub approvals: Vec<(AccountId, u64)>,
    pub next_approval_id: u64,
    pub pot_share: u128,
    pub choice: Option<Choice>,
    pub minted_at_ms: u64,
    pub post_death: bool,
    pub last_report_ms: Option<u64>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Flight {
    pub started_ms: u64,
    pub id: u64,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Default)]
pub struct ProbeState {
    pub consecutive_failures: u32,
    pub last_alive_ms: Option<u64>,
    pub last_probe_ms: Option<u64>,
    pub last_counted_failure_ms: Option<u64>,
    pub flight: Option<Flight>,
    pub last_error: Option<String>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Default)]
pub struct ReleaseState {
    pub flight: Option<Flight>,
    pub released_key: Option<String>,
    pub released_at_ms: Option<u64>,
    pub last_error: Option<String>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Default)]
pub struct EscrowState {
    pub escrowed: bool,
    pub flight: Option<Flight>,
    pub attest_flight: Option<Flight>,
    pub verified: bool,
    pub attested_at_ms: Option<u64>,
    pub last_error: Option<String>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Default)]
pub struct Totals {
    pub pot_locked: u128,
    pub pool: u128,
    pub refunded: u128,
    pub pledged: u128,
    pub paid_out: u128,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct SnapMeta {
    pub seq: u64,
    pub hash: String,
    pub at_ms: u64,
}

#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct SnapBlob {
    pub meta: SnapMeta,
    pub blob: Vec<u8>,
}

#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct Host {
    pub endpoint: String,
    pub host_pubkey: String,
    pub registered_at_ms: u64,
    pub epochs_paid: u64,
    pub sessions_paid: u64,
    pub earned: u128,
    pub flight: Option<Flight>,
}

#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct Claim {
    pub host_id: AccountId,
    pub epoch: u64,
    pub verified: u64,
    pub paid: u128,
    pub at_ms: u64,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Activity {
    pub at_ms: u64,
    pub kind: String,
    pub outcome: String,
    pub detail: String,
}

pub use crate::view_types::*;
