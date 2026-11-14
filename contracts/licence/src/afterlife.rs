//! After death: each licence holder takes the locked share back or pledges it.

use near_sdk::{env, near, require, NearToken, Promise, PromiseError};

use crate::events::emit;
use crate::outlayer::CALLBACK_GAS;
use crate::util::Cb;
use crate::{store, Choice, Licence, LicenceExt};

#[near]
impl Licence {
    /// Holder of a pre-death licence, once Dead, one final choice per licence.
    /// Refund pays the locked share to the current owner; Pledge moves it to the hosting pool.
    pub fn choose(&mut self, token_id: String, choice: Choice) -> Option<Promise> {
        require!(self.dead, "The game is still alive");
        let (n, mut td) = self.load_token(&token_id);
        let owner = td.owner.clone();
        require!(owner == env::predecessor_account_id(), "Only the licence holder can choose");
        require!(td.pot_share > 0, "This licence has no locked share");
        require!(td.choice.is_none(), "Choice already made");
        let amount = td.pot_share;
        td.choice = Some(choice);
        store::set_token(n, &td);
        self.totals.pot_locked = self.totals.pot_locked.saturating_sub(amount);
        match choice {
            Choice::Pledge => {
                emit("choice", &format!("\"token_id\":\"{token_id}\",\"choice\":\"Pledge\",\"amount\":\"{amount}\""));
                self.totals.pledged += amount;
                self.totals.pool += amount;
                None
            }
            Choice::Refund => {
                self.totals.refunded += amount;
                let cb = Cb { flight: 0, payer: owner.clone(), deposit: amount, host: None, epoch: 0, token: n, ops: false };
                Some(
                    Promise::new(owner)
                        .transfer(NearToken::from_yoctonear(amount))
                        .then(Promise::new(env::current_account_id()).function_call(
                            "on_refund",
                            cb.bytes(),
                            NearToken::from_yoctonear(0),
                            CALLBACK_GAS,
                        )),
                )
            }
        }
    }

    /// If the refund transfer failed (for example the account is gone) the choice is undone.
    #[private]
    pub fn on_refund(&mut self, #[serializer(borsh)] cb: Cb) -> bool {
        let (n, amount) = (cb.token, cb.deposit);
        if !matches!(env::promise_result_checked(0, 16), Err(PromiseError::Failed)) {
            emit("choice", &format!("\"token_id\":\"{n}\",\"choice\":\"Refund\",\"amount\":\"{amount}\",\"to\":\"{}\"", cb.payer));
            return true;
        }
        if let Some(mut td) = store::token(n) {
            if td.choice == Some(Choice::Refund) {
                td.choice = None;
                store::set_token(n, &td);
                self.totals.refunded = self.totals.refunded.saturating_sub(amount);
                self.totals.pot_locked += amount;
            }
        }
        false
    }
}
