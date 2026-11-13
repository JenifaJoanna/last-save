//! Thin helpers over raw storage for the records that are too big or too
//! numerous to live in the main state blob (snapshot, hosts, claims, tokens).

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, AccountId};

use crate::types::{Activity, Claim, Host, SnapBlob, TokenData};

pub fn load<T: BorshDeserialize>(key: &[u8]) -> Option<T> {
    env::storage_read(key).and_then(|b| borsh::from_slice(&b).ok())
}

pub fn save<T: BorshSerialize>(key: &[u8], v: &T) {
    if let Ok(b) = borsh::to_vec(v) {
        env::storage_write(key, &b);
    }
}

fn keyed(prefix: u8, tail: &[u8]) -> Vec<u8> {
    let mut k = vec![b'~', prefix];
    k.extend_from_slice(tail);
    k
}

pub fn token(id: u64) -> Option<TokenData> {
    load(&keyed(b't', &id.to_be_bytes()))
}
pub fn set_token(id: u64, d: &TokenData) {
    save(&keyed(b't', &id.to_be_bytes()), d)
}

pub fn host(id: &AccountId) -> Option<Host> {
    load(&keyed(b'h', id.as_bytes()))
}
pub fn set_host(id: &AccountId, h: &Host) {
    save(&keyed(b'h', id.as_bytes()), h)
}
pub fn host_ids() -> Vec<AccountId> {
    load(&keyed(b'H', &[])).unwrap_or_default()
}
pub fn set_host_ids(v: &Vec<AccountId>) {
    save(&keyed(b'H', &[]), v)
}

pub fn claim(i: u64) -> Option<Claim> {
    load(&keyed(b'c', &i.to_be_bytes()))
}
pub fn set_claim(i: u64, c: &Claim) {
    save(&keyed(b'c', &i.to_be_bytes()), c)
}
pub fn remove_claim(i: u64) {
    env::storage_remove(&keyed(b'c', &i.to_be_bytes()));
}

fn paid_key(host: &AccountId, epoch: u64) -> Vec<u8> {
    let mut tail = host.as_bytes().to_vec();
    tail.push(b'|');
    tail.extend_from_slice(&epoch.to_be_bytes());
    keyed(b'p', &tail)
}
pub fn epoch_paid(host: &AccountId, epoch: u64) -> bool {
    env::storage_has_key(&paid_key(host, epoch))
}
pub fn set_epoch_paid(host: &AccountId, epoch: u64) {
    env::storage_write(&paid_key(host, epoch), &[1]);
}
pub fn unset_epoch_paid(host: &AccountId, epoch: u64) {
    env::storage_remove(&paid_key(host, epoch));
}

pub fn snapshot() -> Option<SnapBlob> {
    load(&keyed(b's', &[]))
}
pub fn set_snapshot(s: &SnapBlob) {
    save(&keyed(b's', &[]), s)
}

pub fn activity() -> Vec<Activity> {
    load(&keyed(b'a', &[])).unwrap_or_default()
}
pub fn set_activity(v: &Vec<Activity>) {
    save(&keyed(b'a', &[]), v)
}

/// Reports in the rolling window: (token number, reported at ms).
pub fn reports() -> Vec<(u64, u64)> {
    load(&keyed(b'r', &[])).unwrap_or_default()
}
pub fn set_reports(v: &Vec<(u64, u64)>) {
    save(&keyed(b'r', &[]), v)
}

pub fn owner_tokens(a: &AccountId) -> Vec<u64> {
    load(&keyed(b'O', a.as_bytes())).unwrap_or_default()
}
pub fn set_owner_tokens(a: &AccountId, v: &Vec<u64>) {
    if v.is_empty() {
        env::storage_remove(&keyed(b'O', a.as_bytes()));
    } else {
        save(&keyed(b'O', a.as_bytes()), v)
    }
}
