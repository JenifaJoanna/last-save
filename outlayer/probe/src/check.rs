//! Local (no network) validation of one session entry: signatures, binding, time rules.

use crate::nep413::{login_signature_ok, receipt_fields_wellformed, receipt_signature_ok};
use crate::wire::{Entry, Input, LoginMessage};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reason {
    Sig,
    Key,
    Licence,
    Window,
    Host,
    Replay,
}

pub struct Checked {
    pub account_id: String,
    pub public_key: String,
    pub receipt_nonce: String,
}

/// Order matters for the reason bucket: signatures first, then binding, then time.
pub fn check_local(input: &Input, raw: &Value) -> Result<Checked, Reason> {
    let entry: Entry = serde_json::from_value(raw.clone()).map_err(|_| Reason::Sig)?;
    let (login, receipt) = (&entry.login, &entry.receipt);

    if !login_signature_ok(login) {
        return Err(Reason::Sig);
    }
    let msg: LoginMessage = serde_json::from_str(&login.message).map_err(|_| Reason::Sig)?;
    if msg.app != "ember-rift" {
        return Err(Reason::Sig);
    }
    if !receipt_fields_wellformed(receipt) || !receipt_signature_ok(&msg.session_pubkey, receipt) {
        return Err(Reason::Sig);
    }
    if receipt.account_id != login.account_id {
        return Err(Reason::Sig);
    }

    if login.recipient != input.contract
        || msg.host != input.host_id
        || receipt.host != input.host_id
    {
        return Err(Reason::Host);
    }

    if receipt.ts_ms >= msg.exp_ms
        || receipt.ts_ms < input.from_ms
        || receipt.ts_ms > input.to_ms
        || (input.mode == "host" && receipt.epoch != input.epoch)
    {
        return Err(Reason::Window);
    }

    Ok(Checked {
        account_id: login.account_id.clone(),
        public_key: login.public_key.clone(),
        receipt_nonce: receipt.nonce.clone(),
    })
}
