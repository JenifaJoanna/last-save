# Ember Rift server bundle

This is the game server that Last Save keeps playable after a studio shuts down: a Cloudflare Worker with one
SQLite-backed Durable Object (the arena), the built game client in `assets/`, and a Pages front door in `pages/`.

It is normally unpacked and started by `pnpm host` (see `host/` in the repository), which first checks the released
decryption key, the artifact hash and the latest on-chain progress snapshot. To run it by hand:

    wrangler dev --var HOST_ID:<your-account>.testnet --var BUILD_HASH:<build_hash>

The server verifies every login against the licence contract on NEAR testnet. Environment variables:
`HOST_ID`, `BUILD_HASH`, `LICENCE_CONTRACT`, `RPC_URLS`, and (host start-up only) `RESTORE_SNAPSHOT`.
