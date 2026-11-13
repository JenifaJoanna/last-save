//! WASI entry: reads stdin JSON, prints exactly one JSON line to stdout.

use std::io::Read;

#[cfg(target_os = "wasi")]
fn main() {
    let mut raw = String::new();
    let line = match std::io::stdin().read_to_string(&mut raw) {
        Ok(_) => lastsave_probe::run(&raw, &lastsave_probe::wasi_net::WasiNet::new()),
        Err(_) => lastsave_probe::wire::render_error("stdin: unreadable"),
    };
    print!("{line}");
}

/// Host builds exist only so `cargo build` and `cargo test` work on a laptop.
#[cfg(not(target_os = "wasi"))]
fn main() {
    let mut raw = String::new();
    let _ = std::io::stdin().read_to_string(&mut raw);
    print!("{}", lastsave_probe::wire::render_error("probe runs only as wasm32-wasip2"));
}
