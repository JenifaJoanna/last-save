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

/// Chain Signatures payouts on Base Sepolia (chain id is a constant, see `evm::EVM_CHAIN_ID`).
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct EvmCfg {
    /// The MPC signer contract (v1.signer-prod.testnet).
    pub mpc: AccountId,
    /// Derivation path ("lastsave/host-payouts"); the derivation account is this contract.
    pub path: String,
    /// 0x address derived off-chain from (mpc root key, this contract, path); the payer on Base Sepolia.
    pub address: String,
    /// Demo rate: wei paid per verified session. Not a market price.
    pub demo_wei_per_session: U128,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    /// Hard ceiling for max_fee_per_gas, including every fee bump.
    pub max_fee_cap: U128,
    pub gas_limit: u64,
    /// The payer address's next transaction nonce at launch (0 for a fresh address).
    #[serde(default)]
    pub start_nonce: u64,
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
    /// None disables EVM payouts.
    pub evm_payout: Option<EvmCfg>,
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
    /// Gas money for zero-deposit enclave calls and MPC signing (yocto).
    pub ops_budget: u128,
    /// NEAR debited from the pool for epochs paid in ETH. Nothing can move it out again.
    pub evm_settled: u128,
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
    pub evm_address: Option<String>,
}

#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct Claim {
    pub host_id: AccountId,
    pub epoch: u64,
    pub verified: u64,
    pub paid: u128,
    pub at_ms: u64,
    pub evm_payout: Option<u64>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Activity {
    pub at_ms: u64,
    pub kind: String,
    pub outcome: String,
    pub detail: String,
}

#[near(serializers=[borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EvmStatus {
    Booked,
    Signing,
    Signed,
}

impl EvmStatus {
    pub fn name(&self) -> &'static str {
        match self {
            EvmStatus::Booked => "Booked",
            EvmStatus::Signing => "Signing",
            EvmStatus::Signed => "Signed",
        }
    }
}

/// One host payout in ETH. `signed`/`hashes` keep every signed version (oldest first).
#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct EvmPayout {
    pub id: u64,
    pub host_id: AccountId,
    pub epoch: u64,
    pub to: [u8; 20],
    pub verified: u64,
    pub value_wei: u128,
    pub near_debited: u128,
    pub nonce: Option<u64>,
    pub status: EvmStatus,
    pub max_fee: u128,
    pub max_prio: u128,
    pub signed: Vec<Vec<u8>>,
    pub hashes: Vec<[u8; 32]>,
    pub booked_ms: u64,
    pub last_signed_ms: u64,
    pub last_error: Option<String>,
}

/// At most one payout is being signed at a time (nonce safety).
#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct EvmLock {
    pub flight: Flight,
    pub payout: u64,
    /// Storage money set aside from the ops budget for the signed record this signing will add.
    pub reserve: u128,
}

pub use crate::view_types::*;
