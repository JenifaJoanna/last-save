//! Dev-only state cleaner: deployed over a dev licence instance, it removes the given storage keys so the account
//! can be re-initialised with a fresh contract. `#[private]`: only the account itself (its own full-access key) can call.
use near_sdk::json_types::Base64VecU8;
use near_sdk::{env, near};

#[near(contract_state)]
#[derive(Default)]
pub struct Cleaner {}

#[near]
impl Cleaner {
    #[private]
    pub fn clean(&mut self, keys: Vec<Base64VecU8>) -> u32 {
        let mut n = 0;
        for k in keys {
            if env::storage_remove(&k.0) {
                n += 1;
            }
        }
        n
    }
}
