//! JSON mirror of the licence contract's `InitConfig` (contracts/licence/src/types.rs).
//! The factory forwards it untouched to `new({config})` on the new instance, so the field
//! names and shapes must match the licence exactly. The licence validates every value;
//! the factory only needs it to size the deposit.

use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers=[json])]
#[derive(Clone)]
pub struct Program {
    pub urls: Vec<String>,
    pub sha256: String,
}

#[near(serializers=[json])]
#[derive(Clone)]
pub struct Artifact {
    pub urls: Vec<String>,
    pub sha256: String,
    pub build_hash: String,
    pub size: u64,
}

#[near(serializers=[json])]
#[derive(Clone)]
pub struct Liveness {
    pub probe_interval_ms: u64,
    pub fail_threshold: u32,
    pub receipt_window_ms: u64,
    pub report_window_ms: u64,
    pub quorum_bps: u16,
}

#[near(serializers=[json])]
#[derive(Clone)]
pub struct PoolCfg {
    pub epoch_ms: u64,
    pub pay_per_session: U128,
    pub epoch_cap: U128,
}

#[near(serializers=[json])]
#[derive(Clone)]
pub struct EvmCfg {
    pub mpc: AccountId,
    pub path: String,
    pub address: String,
    pub demo_wei_per_session: U128,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub max_fee_cap: U128,
    pub gas_limit: u64,
    #[serde(default)]
    pub start_nonce: u64,
}

#[near(serializers=[json])]
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
    #[serde(default)]
    pub evm_payout: Option<EvmCfg>,
}
