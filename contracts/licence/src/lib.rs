//! Last Save licence: a NEP-171 game licence plus the end-of-life lifecycle.
//!
//! While the game is Alive the studio holds an escrowed server key inside
//! OutLayer. When the game dies (failed liveness probes, a holder quorum, or
//! the studio ending service) anyone can have OutLayer release the key, so
//! players can host the game themselves, and each licence can take its locked
//! share of the sale back or pledge it to the hosting pool.
//!
//! Units: time in milliseconds (`env::block_timestamp_ms()`), money in yoctoNEAR.

mod afterlife;
mod approvals;
mod config;
mod events;
mod evm;
mod evm_sig;
mod evm_views;
mod hosts;
mod liveness;
mod nft;
mod ops;
mod outlayer;
mod release;
mod rlp;
mod sale;
mod store;
mod types;
mod util;
mod view_types;
mod views;

#[cfg(test)]
mod tests;

use near_sdk::{env, near, require, PanicOnDefault};

pub use types::*;

/// An in-flight OutLayer request older than this may be retried by anyone.
pub const FLIGHT_TIMEOUT_MS: u64 = 600_000;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Licence {
    pub(crate) cfg: InitConfig,
    pub(crate) supply: u64,
    pub(crate) live_supply: u64,
    pub(crate) dead: bool,
    pub(crate) cause: Option<String>,
    pub(crate) died_at_ms: Option<u64>,
    pub(crate) escrow: EscrowState,
    pub(crate) probe: ProbeState,
    pub(crate) release: ReleaseState,
    pub(crate) totals: Totals,
    pub(crate) snap: Option<SnapMeta>,
    pub(crate) snap_hashes: Vec<[u8; 32]>,
    pub(crate) claim_count: u64,
    pub(crate) next_flight: u64,
    pub(crate) next_evm_nonce: u64,
    pub(crate) evm_count: u64,
    pub(crate) evm_lock: Option<EvmLock>,
    /// Sum of deposits riding on OutLayer calls (and pending pot refunds) that may still bounce back.
    pub(crate) in_flight: u128,
    pub(crate) last_ops_probe_ms: u64,
    pub(crate) last_ops_release_ms: u64,
}

#[near]
impl Licence {
    #[init]
    pub fn new(config: InitConfig) -> Self {
        let mut cfg = config;
        config::validate(&mut cfg);
        let start_nonce = cfg.evm_payout.as_ref().map_or(0, |e| e.start_nonce);
        Self {
            cfg,
            supply: 0,
            live_supply: 0,
            dead: false,
            cause: None,
            died_at_ms: None,
            escrow: EscrowState::default(),
            probe: ProbeState::default(),
            release: ReleaseState::default(),
            totals: Totals::default(),
            snap: None,
            snap_hashes: vec![],
            claim_count: 0,
            next_flight: 0,
            next_evm_nonce: start_nonce,
            evm_count: 0,
            evm_lock: None,
            in_flight: 0,
            last_ops_probe_ms: 0,
            last_ops_release_ms: 0,
        }
    }

    /// Studio ends service: the game dies at once.
    pub fn end_of_service(&mut self) {
        require!(env::predecessor_account_id() == self.cfg.studio, "Only the studio can end service");
        self.require_alive();
        self.die("studio");
    }
}

impl Licence {
    pub(crate) fn now() -> u64 {
        env::block_timestamp_ms()
    }

    pub(crate) fn require_alive(&self) {
        require!(!self.dead, "The game has already ended");
    }

    pub(crate) fn require_studio(&self) {
        require!(env::predecessor_account_id() == self.cfg.studio, "Only the studio can do this");
    }

    /// Marks the game Dead. Idempotent; never calls OutLayer (release is a separate step).
    pub(crate) fn die(&mut self, cause: &str) {
        if self.dead {
            return;
        }
        self.dead = true;
        self.cause = Some(cause.to_string());
        self.died_at_ms = Some(Self::now());
        events::emit("died", &format!("\"cause\":\"{cause}\""));
        events::log_activity("death", cause, "");
    }

    /// Claims the in-flight slot, or panics while a fresh request is still running.
    pub(crate) fn begin_flight(slot: &mut Option<Flight>, counter: &mut u64, what: &str) -> u64 {
        let now = Self::now();
        if let Some(f) = slot {
            if now.saturating_sub(f.started_ms) < FLIGHT_TIMEOUT_MS {
                env::panic_str(&format!("{what} is already running, try again in a few minutes"));
            }
        }
        *counter += 1;
        *slot = Some(Flight { started_ms: now, id: *counter });
        *counter
    }

    /// Clears the slot only if it still belongs to this request.
    pub(crate) fn end_flight(slot: &mut Option<Flight>, id: u64) {
        if slot.as_ref().map(|f| f.id) == Some(id) {
            *slot = None;
        }
    }
}
