//! Releasing the escrowed server key once the game is Dead.

use near_sdk::{near, require, Promise};

use crate::events::{emit, log_activity};
use crate::outlayer::{read_out, Out};
use crate::util::Cb;
use crate::{Licence, LicenceExt};

impl Licence {
    fn release_failed(&mut self, why: &str) {
        self.release.last_error = Some(why.to_string());
        log_activity("release", "retry", why);
    }
}

#[near]
impl Licence {
    /// Anyone, once Dead: OutLayer checks ls_status again inside the TEE, then returns K.
    #[payable]
    pub fn release(&mut self, mirror_index: Option<u32>) -> Promise {
        require!(self.dead, "The game is still alive");
        require!(self.escrow.escrowed, "Nothing is escrowed");
        require!(self.release.released_key.is_none(), "Key is already released");
        let ops = self.take_attach();
        let id = Self::begin_flight(&mut self.release.flight, &mut self.next_flight, "Release");
        emit("release_requested", "");
        self.outlayer_call(&self.cfg.release, mirror_index, "{\"mode\":\"release\"}", true, "on_release", &Cb::new(id).funded(ops))
    }

    /// A key is stored only if sha256(K) equals the commitment made at init.
    #[private]
    pub fn on_release(&mut self, #[serializer(borsh)] cb: Cb) -> bool {
        Self::end_flight(&mut self.release.flight, cb.flight);
        if self.release.released_key.is_some() {
            return false;
        }
        match read_out() {
            Out::Failed => {
                self.refund_cb(&cb);
                self.release_failed("Release call failed, retry");
                false
            }
            Out::Null => {
                self.release_failed("Release timed out, retry");
                false
            }
            Out::Res(v) => {
                if v.ok != Some(true) {
                    self.release_failed("Release was refused");
                    return false;
                }
                let key = v.key.unwrap_or_default().to_ascii_lowercase();
                let raw = match hex::decode(&key) {
                    Ok(r) => r,
                    Err(_) => {
                        self.release_failed("Released key was not hex");
                        return false;
                    }
                };
                if hex::encode(crate::util::sha256(&raw)) != self.cfg.key_commitment {
                    self.release_failed("Released key does not match the commitment");
                    return false;
                }
                self.release.released_key = Some(key.clone());
                self.release.released_at_ms = Some(Self::now());
                self.release.last_error = None;
                emit("key_released", &format!("\"key\":\"{key}\""));
                log_activity("release", "released", "key published");
                true
            }
        }
    }
}
