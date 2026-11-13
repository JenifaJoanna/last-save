//! Selling licences and posting progress snapshots.

use near_sdk::{env, near, require, NearToken, Promise};

use crate::events::emit;
use crate::util::{b64_decode, sha256};
use crate::{store, Licence, LicenceExt, SnapBlob, SnapMeta, TokenData};

pub const MAX_BLOB: usize = 16_384;
pub const HASH_HISTORY: usize = 32;

#[near]
impl Licence {
    /// Mints the next licence to the caller for exactly the price.
    /// Alive: the pot share stays here, the rest (minus mint storage) goes to the studio.
    /// Dead: the whole price (minus mint storage) goes to the hosting pool.
    #[payable]
    pub fn buy_licence(&mut self) -> String {
        require!(self.escrow.escrowed, "Licences are not on sale yet");
        let price = self.cfg.price.0;
        require!(env::attached_deposit().as_yoctonear() == price, "Attach exactly the price");
        let buyer = env::predecessor_account_id();
        let dead = self.dead;
        let pot = if dead { 0 } else { price * self.cfg.fund_bps as u128 / 10_000 };
        let number = self.supply + 1;

        let before = env::storage_usage();
        self.mint_token(
            number,
            TokenData {
                owner: buyer.clone(),
                approvals: vec![],
                next_approval_id: 0,
                pot_share: pot,
                choice: None,
                minted_at_ms: Self::now(),
                post_death: dead,
                last_report_ms: None,
            },
        );
        let cost = env::storage_usage().saturating_sub(before) as u128 * env::storage_byte_cost().as_yoctonear();
        self.supply = number;
        if dead {
            self.totals.pool += price.saturating_sub(cost);
        } else {
            self.live_supply += 1;
            self.totals.pot_locked += pot;
            let to_studio = (price - pot).saturating_sub(cost);
            if to_studio > 0 {
                Promise::new(self.cfg.studio.clone()).transfer(NearToken::from_yoctonear(to_studio)).detach();
            }
        }
        emit(
            "licence_sold",
            &format!(
                "\"token_id\":\"{number}\",\"buyer\":\"{buyer}\",\"price\":\"{price}\",\"pot_share\":\"{pot}\",\"phase\":\"{}\"",
                if dead { "dead" } else { "alive" }
            ),
        );
        number.to_string()
    }

    /// Studio's server posts the latest progress snapshot after each match.
    pub fn post_snapshot(&mut self, seq: u64, hash: String, blob_base64: String) {
        self.require_studio();
        self.require_alive();
        let blob = b64_decode(&blob_base64).unwrap_or_else(|| env::panic_str("Snapshot is not valid base64"));
        require!(!blob.is_empty(), "Snapshot is empty");
        require!(blob.len() <= MAX_BLOB, "Snapshot is over 16384 bytes");
        let digest = sha256(&blob);
        require!(hash.to_ascii_lowercase() == hex::encode(digest), "Snapshot hash does not match");
        if let Some(last) = &self.snap {
            require!(seq > last.seq, "Snapshot seq must increase");
        }
        let meta = SnapMeta { seq, hash: hex::encode(digest), at_ms: Self::now() };
        store::set_snapshot(&SnapBlob { meta: meta.clone(), blob });
        self.snap = Some(meta);
        self.snap_hashes.push(digest);
        if self.snap_hashes.len() > HASH_HISTORY {
            let cut = self.snap_hashes.len() - HASH_HISTORY;
            self.snap_hashes.drain(0..cut);
        }
        emit("snapshot_posted", &format!("\"seq\":{seq},\"hash\":\"{}\"", hex::encode(digest)));
    }
}
