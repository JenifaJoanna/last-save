# Last Save

**We killed our server. You still have the game.**

Last Save is a game licence on NEAR that outlives its publisher. A licence is an NFT. Part of every sale is locked by
contract. The studio's server build is encrypted, and its key is escrowed in an OutLayer enclave that only the licence
contract can open, with only one exact release program. When the official server goes dark, the contract flips to
Dead, the enclave releases the key on-chain, each holder takes a refund or pledges their share to a pool that pays fans
to host the game, and players sign back in with the same progress.

Tracks: **NFTs That Do Something** and **Games With Real Economies**. Network: **NEAR testnet only** (no real money).

| | |
|---|---|
| Platform | https://last-save.pages.dev (live status at `/status`, judge guide at `/judges`) |
| Official game server (Ember Rift) | https://emberrift.pages.dev |
| Licence contract | [`lastsave-licence.testnet`](https://testnet.nearblocks.io/address/lastsave-licence.testnet) |
| Escrow spike (day one, every tx) | [`proof/spike.md`](proof/spike.md) |
| Launch transactions | [`proof/launch-lastsave-licence.json`](proof/launch-lastsave-licence.json) |

## How it works

```
LAUNCH   studio encrypts the server bundle (AES-256-GCM, key K); artifact + sha256 committed on-chain
         licence contract stores K as an OutLayer secret it owns:
           access = Predecessor{Whitelist[contract]} AND WasmHash(release.wasm); no delete path; then its keys are deleted
         attest(): the enclave downloads the artifact, decrypts it with K and checks the build hash, outputs sha256(K) only
SALE     buy_licence() mints a NEP-171 token; 60% to the studio, 40% locked as that token's pot share
LIVE     the official server posts a progress snapshot on-chain after every match (studio function-call key)
DEATH    the studio's own word never keeps it alive:
           probes: anyone calls probe_official(); OutLayer runs probe.wasm, which must find sessions signed by licence
                   holders in the last window (a signed 200 is not enough); K failed probes spaced in time -> Dead
           players: holders report_down(); a quorum within the window -> Dead
           studio: end_of_service()
         release(): anyone; OutLayer runs release.wasm, which re-reads the contract over RPC, requires Dead, outputs K
AFTER    each holder: choose(Refund) -> pot share back, or choose(Pledge) -> keep-alive pool
         buy_licence() after death sends 100% to the pool
         a fan runs `pnpm host`: reads K + artifact hash from chain, verifies, decrypts, restores the last snapshot,
           serves it (wrangler dev + cloudflared, or Cloudflare), register_host()
         claim_epoch(): probe.wasm verifies holder-signed sessions at that host; the pool pays per unique verified holder
SALES    NEP-199 royalties: 10% of every resale to the studio
```

**Liveness policy:** if no licence holder is served for the whole window, the game is released. Production defaults
are days (probe every 6 h, 4 failures, 72 h windows); the demo instance uses seconds so the lifecycle fits a video.

**Trust model (no overclaim).** No single party can stop the release, not the studio and not us. You do rely on NEAR,
OutLayer's TEE workers (Intel TDX) and OutLayer's keystore (master derived by NEAR MPC, keystores approved by a DAO).
What nobody can do: delete or replace the escrow (the contract has no path for it and no keys), release early (the
contract and release.wasm both check Dead), fake liveness with a stub server (probes need holder-signed sessions), or
point a release at another contract (release.wasm reads its caller's own state).

## Verify it yourself

- **The escrow rule is real.** The spike shows a stranger calling OutLayer with our secret reference being refused by
  the keystore, and release.wasm refusing while alive. See [`proof/spike.md`](proof/spike.md).
- **The wasm is reproducible.** Both OutLayer programs are built in OutLayer's pinned compiler image:
  ```
  OUTLAYER_OUT_DIR=$PWD/local/repro/release ./scripts/outlayer-build-wasm.sh --dir outlayer/release --target wasm32-wasip2 --keep
  # -> 9fafaf8e417245337c30af82b045ecd0b75a6e2885f1c03300808a3f4f472b7a  (release.wasm, the escrow's WasmHash)
  OUTLAYER_OUT_DIR=$PWD/local/repro/probe ./scripts/outlayer-build-wasm.sh --dir outlayer/probe --target wasm32-wasip2 --keep
  # -> b0cb38e1bc3e77eccabd6db0e21a6d8747d63955ccfd649ad3f8d7d349e0b0b4  (probe.wasm)
  ```
  Compare with `release.sha256` / `probe.sha256` in `get_info` on the contract.
- **The whole lifecycle:** `pnpm demo:fresh` deploys a fresh licence instance with seconds-scale timers and runs
  buy → play → probes → death → release → refund/pledge → fan host → claim, printing every transaction.

## Repository

| Path | What |
|---|---|
| `contracts/licence` | Licence contract (Rust, near-sdk 5): NEP-171/177/178/181/199, lifecycle, OutLayer calls, pool, hosts. 77 unit tests + a near-workspaces sandbox lifecycle test (`contracts/sandbox-tests`, with `contracts/mock-outlayer`) |
| `outlayer/release` | release.wasm (WASI P2): attest and release modes |
| `outlayer/probe` | probe.wasm (WASI P2): NEP-413 + session-receipt verification, access-key and licence checks over RPC; unit tests + wasmtime e2e fixtures |
| `game/shared` | Ember Rift wire protocol, deterministic simulation, NEP-413 / receipt signing |
| `game/server` | Authoritative server: Cloudflare Durable Object (WebSocket Hibernation API, SQLite), auth, receipts, `/attest`, on-chain snapshots |
| `game/client` | Pixi renderer, prediction + interpolation, wallet or key sign-in, offline practice |
| `server-bundle`, `host` | Encrypted server artifact build; the fan-host CLI |
| `web` | Platform: landing, store, library, live licence status, community hosts, judge guide |
| `scripts/launch` | Studio launch pipeline: bundle, mirrors, deploy, escrow, attest, snapshot key, official server, lock |
| `scripts/e2e` | End-to-end testnet run and `demo:fresh` |
| `scripts/check-identity.mjs`, `scripts/check-secrets.mjs` | Gates run before every commit and deploy |

## FAQ

**The server code is public after release. Can pirates skip the licence?** Yes, anyone can run the released build.
They earn nothing from the pool: hosts are paid only for sessions signed by real licence holders, and your progress and
the paid hosts follow the licence.

**What if the pool runs out?** The dashboard shows its runway. Post-shutdown sales put 100% of their price into the
pool, pledges top it up, and hosts can keep hosting for free.

**Why would a studio opt in?** Player pressure to keep bought games playable, a guarantee badge it can show next to the
price, and royalties on every resale.

**What if OutLayer is down?** A probe that does not complete is inconclusive and never counts against the studio.
Release is retryable by anyone, from any of the hash-pinned mirrors.

## License

MIT. `scripts/outlayer-build-wasm.sh` is vendored from OutLayer (MIT OR Apache-2.0) with one marked change.

## Built with, and disclosure

Built during the NEAR Hackathon window (repository created 13 Nov 2026; no earlier code). Libraries: near-sdk 5
(contract), wasi-http-client, ed25519-dalek, aes-gcm, sha2 (OutLayer programs), near-api-js, @near-wallet-selector,
@noble/curves|hashes|ciphers, PixiJS 8, React 19, Tailwind 4, motion, wouter, lucide-react, Cloudflare Workers + Durable
Objects, wrangler, vitest, near-workspaces. AI assistance: code, tests and copy were written with AI coding agents (Claude
Code); narration voice by ElevenLabs; the Ember Rift key art was generated with ChatGPT image generation. Ember Rift is a
fictional studio title made for this demo.
