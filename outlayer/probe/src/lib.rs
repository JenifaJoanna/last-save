//! Last Save probe: decides whether a game server really serves licence holders.
//! Verification logic is target-independent; `Net` is the only I/O seam.

pub mod check;
pub mod nep413;
pub mod probe;
pub mod rpc;
#[cfg(target_os = "wasi")]
pub mod wasi_net;
pub mod wire;

pub use probe::run;
