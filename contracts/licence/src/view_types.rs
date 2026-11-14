//! JSON view types returned by the read-only methods.

use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

use crate::{Choice, InitConfig, SnapMeta};

#[near(serializers=[json])]
pub struct LicenceView {
    pub token_id: String,
    pub owner_id: AccountId,
    pub pot_share: U128,
    pub choice: Option<Choice>,
    pub minted_at_ms: u64,
    pub post_death: bool,
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMeta {
    pub title: String,
    pub description: String,
    pub media: String,
    pub extra: String,
}

#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Token {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMeta,
    pub approved_account_ids: crate::util::Pairs<u64>,
}

#[near(serializers=[json])]
pub struct HostView {
    pub host_id: AccountId,
    pub endpoint: String,
    pub host_pubkey: String,
    pub registered_at_ms: u64,
    pub epochs_paid: u64,
    pub sessions_paid: u64,
    pub earned: U128,
    pub evm_address: Option<String>,
}

#[near(serializers=[json])]
pub struct ClaimView {
    pub index: u64,
    pub host_id: AccountId,
    pub epoch: u64,
    pub verified: u64,
    pub paid: U128,
    pub at_ms: u64,
    pub evm_payout: Option<u64>,
}

#[near(serializers=[json])]
pub struct SnapshotView {
    pub seq: u64,
    pub hash: String,
    pub blob_base64: String,
    pub at_ms: u64,
}

#[near(serializers=[json])]
pub struct ReleaseInfo {
    pub artifact_urls: Vec<String>,
    pub artifact_sha256: String,
    pub build_hash: String,
    pub key_commitment: String,
    pub status: String,
}

#[near(serializers=[json])]
pub struct TotalsView {
    pub supply: u64,
    pub live_supply: u64,
    pub pot_locked: U128,
    pub pool: U128,
    pub refunded: U128,
    pub pledged: U128,
    pub paid_out: U128,
    pub ops_budget: U128,
    pub evm_settled: U128,
}

#[near(serializers=[json])]
pub struct ProbeView {
    pub consecutive_failures: u32,
    pub last_alive_ms: Option<u64>,
    pub last_probe_ms: Option<u64>,
    pub in_flight: bool,
    pub in_flight_since_ms: Option<u64>,
    pub last_error: Option<String>,
}

#[near(serializers=[json])]
pub struct ReleaseView {
    pub in_flight: bool,
    pub in_flight_since_ms: Option<u64>,
    pub released: bool,
    pub released_key: Option<String>,
    pub released_at_ms: Option<u64>,
    pub last_error: Option<String>,
}

#[near(serializers=[json])]
pub struct Info {
    pub now_ms: u64,
    pub contract_id: AccountId,
    pub config: InitConfig,
    pub status: String,
    pub cause: Option<String>,
    pub died_at_ms: Option<u64>,
    pub escrowed: bool,
    pub escrow_in_flight: bool,
    pub escrow_verified: bool,
    pub attested_at_ms: Option<u64>,
    pub escrow_error: Option<String>,
    pub release: ReleaseView,
    pub released_key: Option<String>,
    pub released_at_ms: Option<u64>,
    pub totals: TotalsView,
    pub probe: ProbeView,
    pub reports_in_window: u32,
    pub reports_needed: u32,
    pub current_epoch: Option<u64>,
    pub hosts: u64,
    pub claims: u64,
    pub snapshot: Option<SnapMeta>,
    pub snapshot_hashes: Vec<String>,
}

#[near(serializers=[json])]
pub struct EvmPayoutView {
    pub id: u64,
    pub host_id: AccountId,
    pub epoch: u64,
    pub to: String,
    pub verified: u64,
    pub value_wei: U128,
    pub near_debited: U128,
    pub nonce: Option<u64>,
    /// "Booked" | "Signing" | "Signed"
    pub status: String,
    /// Newest signed raw transaction (0x hex), ready to broadcast.
    pub signed_tx: Option<String>,
    /// Every signed version, oldest first (bumps append).
    pub signed_txs: Vec<String>,
    pub tx_hash: Option<String>,
    pub tx_hashes: Vec<String>,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub booked_at_ms: u64,
    pub last_error: Option<String>,
}

#[near(serializers=[json])]
pub struct EvmInfoView {
    pub address: String,
    pub next_nonce: u64,
    pub mpc: AccountId,
    pub path: String,
    pub chain_id: u64,
    /// The account the MPC derives the key for: this contract.
    pub derivation_account: AccountId,
    pub domain_id: u32,
    pub demo_wei_per_session: U128,
    pub max_fee_cap: U128,
    pub evm_settled: U128,
    pub signing_payout: Option<u64>,
    pub payouts: u64,
}
