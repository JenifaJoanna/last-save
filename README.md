# Last Save

**We killed our server. You still have the game.**

Last Save is a game licence on NEAR that outlives its publisher. A licence is an NFT. Part of every sale is locked by
contract. The studio's server build is encrypted, and its key is escrowed in an OutLayer enclave that only the licence
contract can open, with only one exact release program. When the official server goes dark, the contract flips to
Dead, the enclave releases the key on-chain, each holder takes a refund or pledges their share to a pool that pays fans
to host the game, and players sign back in with the same progress.

Tracks: **NFTs That Do Something** and **Games With Real Economies**. Network: **NEAR testnet only** (no real money).

**v2 adds** gas-free holder actions (NEP-366 meta-transactions), host payouts on Base Sepolia signed by NEAR's MPC network
(Chain Signatures), one global licence contract that any studio instantiates in a single transaction (NEP-591 global
contracts + a factory), a Walrus mirror of the encrypted build, Sigstore build provenance, and a page where anyone can
attack the live contract and watch it refuse.

| | |
|---|---|
| Platform | https://last-save.pages.dev (live status at `/status`, judge guide at `/judges`) |
| Official game server (Ember Rift) | https://emberrift.pages.dev — shut down on 14 Nov as part of the demo; it stays dead by design |
| Community server (the released build, hosted by a fan) | https://emberrift-community.pages.dev |
| Licence contract v1 (locked, 0 access keys) | [`lastsave-licence.testnet`](https://testnet.near.rocks/account/lastsave-licence.testnet) |
| Licence v2, published once as a global contract | code hash `4AwoknekGdP3CMhHFpCJyDUCXnF6Rp79snrVr23i6rt1` ([publish tx](https://testnet.near.rocks/tx/3g7AQ41U5hmiuJUWCxBAXVviVhVGQUQYpqjyU2amWphF)) |
| Studio factory (one tx per studio, instances born with 0 keys) | [`lastsave-factory.testnet`](https://testnet.near.rocks/account/lastsave-factory.testnet) |
| v2 judge instance | `ember-rift.lastsave-factory.testnet` (launched for the v2 film; its run is recorded in `proof/judge-v2.json`) |
| v2 dev instance (full lifecycle incl. a Base Sepolia payout) | [`v2dev.lastsave-factory.testnet`](https://testnet.near.rocks/account/v2dev.lastsave-factory.testnet) |
| Gas-free relayer | https://lastsave-relay.pages.dev (`/health`) |
| Try to kill it (real attacks, real refusals) | https://last-save.pages.dev/attack |
| The judge instance's whole life, every tx | [`proof/judge-run.md`](proof/judge-run.md) |
| Day-one escrow spike | [`proof/spike.md`](proof/spike.md) |
| End-to-end testnet runs (98/98 assertions) | `proof/run-*.json` |

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
         buy_licence() after death: price minus mint storage, 90% to the pool, 10% to the gas-free ops budget (v1: all to the pool)
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

## v2: three NEAR features, each doing real work

**1. Gas-free holder actions (NEP-366 meta-transactions).** Holders sign a delegate action; the relayer wraps it and
pays the gas. Refund or pledge, report the server down, run a probe, trigger the release, claim a host epoch, set or sign
a Base payout: all cost the player 0 NEAR. Zero-deposit `probe_official` / `release` / `claim_epoch` are paid from the
contract's own `ops_budget` (funded at launch, plus 10 % of every post-death sale), throttled so nobody can drain it.
*Trust line:* the relayer can only pay. It verifies the delegate signature and the key's permissions, forwards only
zero-deposit calls of an allowlist to allowlisted instances, rate-limits, and cannot change what the player signed.
*Sign-in:* wallets connect through **NEAR Connect** (`@hot-labs/near-connect`; the deprecated wallet-selector is gone).
On testnet that offers Meteor, Intear, Ledger, Nightly and NEAR CLI, plus Ethereum wallets (MetaMask) through the
evm-on-near executor. At sign-in a NEAR wallet is asked to add one function-call key that this app generated and that can
only call this licence's zero-deposit methods; holder actions are then signed as NEP-366 delegates and the relayer pays.
Verified on chain: a key with the app's exact parameters signed a delegate that the protocol accepted and the relayer
paid for ([tx BM781HeC…](https://testnet.nearblocks.io/txns/BM781HeCWRQr4RYd882WgWCr81Z5ivBqmyhbYSruRiuh)). Not yet
verified with a person at a real wallet: that Meteor or Intear adds the key during their own sign-in. Ethereum wallets
cannot add that key, so their users pay normal gas. You can also play without any wallet (practice offline).

**2. Host payouts on Base Sepolia, signed by NEAR's MPC network (Chain Signatures).** The licence contract controls one
Base Sepolia address derived from `v1.signer-prod.testnet` with path `lastsave/host-payouts`; no person or server holds
its key. A host may set a payout address; `claim_epoch` then books the epoch on the EVM rail and `sign_evm_payout`
(anyone, gas-free) has the MPC network sign an EIP-1559 transfer, stored on-chain for anyone to broadcast.
Guarantees, each covered by a unit test:
- exactly once per (host, epoch): an epoch paid in ETH can never also pay in NEAR; a re-sign keeps nonce, value and recipient, so only one transfer can land;
- a stuck nonce can be re-signed by anyone with a higher fee (×1.25, capped, ≥ 120 s apart); later payouts never wait on earlier ones;
- chainId 84532 is a constant in the signed payload; only the host account itself can set its payout address;
- the NEAR an EVM payout replaces moves into a visible `evm_settled` bucket that no method can withdraw. The rate (0.00001 ETH per verified session) is a **demo rate**; on mainnet this would settle through NEAR Intents;
- the contract checks `ecrecover` of every MPC signature against its own address before storing it.

Re-derive the contract's Base address yourself, from public inputs only:
```
node scripts/chainsig/derive.mjs --contract <instance id> --path lastsave/host-payouts
# epsilon = sha3_256("near-mpc-recovery v0.1.0 epsilon derivation:" + <instance id> + "," + path)
# derived = signer root public key (view `public_key` on v1.signer-prod.testnet) + epsilon·G
# address = last 20 bytes of keccak256(x ‖ y); checked against the signer's own `derived_public_key` view
```
Anyone can broadcast a signed payout: `node scripts/chainsig/relay.mjs --contract <instance id>`.

**3. One global contract, one transaction per studio (NEP-591 + factory).** The licence code is published once by hash.
`lastsave-factory.testnet` `create_instance(name, config)` creates `<name>.lastsave-factory.testnet`, attaches the global
code by hash, initialises it and funds its gas-free budget in one transaction, and never adds an access key: every
instance is born locked. *Trust line:* the code can't change (it is pinned by hash) and no instance can be upgraded.

## Preservation beyond the studio

- **Walrus mirror.** The encrypted build is stored on Walrus. Each instance lists its mirrors at birth: the studio's own
  copy, then Walrus, then GitHub. When the studio copy is gone, `pnpm host` says so and falls back; the sha256 on-chain
  decides, whichever mirror served it. (Walrus testnet storage is not permanent; a judge replaying much later may find
  only the GitHub mirror.)
- **Build provenance.** The plaintext server build is built by `.github/workflows/release-build.yml` and attested with
  Sigstore (public Rekor entry, logged before any shutdown). The on-chain `build_hash` is that attested digest, and
  `pnpm host` prints `built by workflow … at commit …, logged …` before it decrypts.
- **Snapshots** are posted on-chain after every match and mirrored to Walrus by the official server.
- **Internet Archive.** After a release, `scripts/archive/ia-upload.mjs` decrypts the released build with the on-chain key,
  checks it against the committed build hash and preserves it with the last progress snapshot on archive.org.

## Try to kill it

https://last-save.pages.dev/attack sends **real** hostile transactions to the live contract (signed by a public attacker
account, gas paid by the relayer): release the key early, fake a death report, drain the pool, redirect a host's payout,
double-pay a host. Each refusal on screen is the contract's own message, with the transaction link.

## Host this game

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/JenifaJoanna/last-save/tree/main/community-host)

One click deploys the community server of a released instance into **your own Cloudflare account**. Cloudflare copies
[`community-host/`](community-host/) into a repository of yours and Workers Builds runs its build: it reads the released key and the
artifact mirrors from NEAR, takes the first copy whose sha256 matches the chain (studio, Walrus, GitHub), checks the Sigstore build
provenance, decrypts, checks `build_hash`, restores the last on-chain snapshot and deploys the Worker. It refuses, and deploys nothing,
if the instance has not released its key or any hash differs. Set `LICENCE_CONTRACT` (default `ember-rift.lastsave-factory.testnet`) and
`HOST_ID` (your NEAR account) as described in [`community-host/README.md`](community-host/README.md).
Registering as a host (`register_host`, a signed 0.01 N call from your own account) is a separate step: use the
[Hosts page](https://last-save.pages.dev/app/hosts).

## Verify it yourself

<!-- proof-link:start -->
- **One command, no funds, no keys:** `pnpm verify` re-checks every claim from chain in about 2 s. The claim map is [`JUDGE.md`](JUDGE.md) and machine-readable at [`/proof.json`](https://last-save.pages.dev/proof.json) (`web/public/proof.json`).
<!-- proof-link:end -->
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
- **The whole lifecycle, no funds:** `pnpm demo:fresh` runs buy → probes → death → release → refund/pledge → fan host → claim →
  Chain Signatures payouts on a local NEAR sandbox (real licence wasm, mock OutLayer and signer), printing every step (about 40 s once built).
  `pnpm demo:fresh --testnet` does the same on a fresh testnet instance and prints every transaction (needs about 3.4 testnet NEAR).

## Tests and runs

| Suite | Result |
|---|---|
| Licence contract unit tests (`contracts/licence`, v1 edge cases + gas-free budget + Chain Signatures guards, RLP/EIP-1559 vectors) | 122 / 122 |
| Factory unit tests (`contracts/factory`) | 9 / 9 |
| near-workspaces sandbox (`contracts/sandbox-tests`): v1 lifecycle, EVM payout lifecycle with a mock MPC signer, factory with a global contract | 3 / 3 |
| Relayer (`relayer`): delegate decode/verify, allowlist refusals, rate limits, attack route | 43 / 43 |
| `pnpm verify` checks (`scripts/verify`) | 12 / 12 |
| probe.wasm unit tests incl. the canonical NEP-413 vector (`outlayer/probe`) | 33 / 33 |
| probe.wasm under wasmtime against fixture servers (valid, stub, forged, non-holder, replay, wrong build, flaky RPC, stall…) | 13 / 13 |
| Game server unit / integration (real `wrangler dev`, 4–9 clients, reconnect, persistence, `/attest`, snapshots) | 40 / 40 · 15 / 15 |
| Server bundle crypto + tar; host CLI incl. mirror fallback and provenance | 6 / 6 · 30 / 30 |
| End-to-end on NEAR testnet (`pnpm e2e`, dev instance: buy → play → probes → kill → death → release → refund/pledge → post-shutdown buy → fan host → claim) | 98 / 98 assertions |
| End-to-end on the v2 dev instance (`proof/v2-e2e.md`): v1 lifecycle + gas-free relayer + relayer refusals + factory + an MPC-signed, fee-bumped Base Sepolia payout mined on-chain | 173 / 174 (the one miss is a test assertion that ignored Base's L1 data fee; re-verified to the wei) |
| The locked judge instance, filmed (`proof/judge-run.md`) | full lifecycle, every step on-chain |

## What is real and what is rehearsed

| Real | Rehearsed for the demo |
|---|---|
| Every contract call, enclave run, MPC signature and Base Sepolia transfer shown | Liveness timers are seconds (production defaults are days) |
| The locked judge instances (0 access keys) and their transactions | Ember Rift and its studio are fictional |
| The escrow rule, refusals and attacks on `/attack` | UI flows in the film use a localhost-only test-account signer (no keys in third-party wallets) |
| Walrus storage and the Sigstore attestation | NEAR testnet and Base Sepolia only; Walrus testnet retention is limited |

The full claim-by-claim map, with transactions, code lines and tests, is [`JUDGE.md`](JUDGE.md).

## Known limits

- A pilot who reconnects from a new process within the server's 20 s grace window gets their old ship back with its old
  input counter. Clients start their input sequence from a timestamp, so this never stalls a player; the escrowed server
  build itself is unchanged.
- Community hosts restore the last on-chain progress snapshot, but only the studio's key can post snapshots, so progress
  earned on a community host lives in that host's database.
- Deleting the official Worker breaks new connections at once; an already-open WebSocket stayed up for 2 min 48 s until
  Cloudflare evicted the Durable Object. Liveness is judged by probes, so this only affects how quickly players notice.
- OutLayer runs occasionally time out (we saw ~10 minutes of timeouts once). Those runs are inconclusive by design and
  can be retried by anyone; each failed attempt costs its caller 0.001 testnet NEAR.
- The pinned release and probe programs read chain state inside the enclave through public RPCs (FastNEAR, then
  dRPC). On the deadline night both rate-limited (HTTP 429), so those reads failed, OutLayer returned a failure and the
  contract counted each run inconclusive, as designed. The judge instance `ember-rift` therefore died by holder reports
  (2 of 4, after one counted probe failure), and its release waits for the RPCs to answer again; anyone can retry it.
  `v1` and `v2dev` show completed, real OutLayer releases with the same code. Fix for v3: more RPC fallbacks, including
  an archival endpoint, inside the wasm.
- A host account needs ~0.05 testnet NEAR per paid claim; gas-free claims come out of the instance's ops budget.
- Gas-free holder actions need the wallet to add the app's function-call key at sign-in (NEAR Connect's
  `addFunctionCallKey`); a wallet that declines, and every Ethereum wallet, pays normal gas instead. Tested with a real
  Meteor Web wallet on testnet: Meteor adds the key for the licence contract with an empty method list
  (`method_names: []`), which allows any zero-deposit method on that one contract, rather than the app's requested list
  of eight methods. A function-call key can never attach a deposit, so it still cannot move the holder's NEAR; its gas
  allowance is capped at 0.25 NEAR.
- No email or Google login yet: the shared NEAR Auth testnet login only accepts a `http://localhost:3000` callback, so it
  needs its own client id for our domains. No passkey sign-in: that NEAR Connect executor is mainnet-only.
- The game server's single-use NEP-413 login nonce (replay refusal) landed after the ember-rift build was cut, so the
  judge instance's server checks recipient, host and expiry but not nonce reuse.
- The deploy-to-Cloudflare template deploys into the clicker's own account; we prove it by local build and dry run.
- Testnet only. Demo timers are seconds-scale; production defaults are days.

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
| `web` | Platform (the Last Save terminal): store, library, live licence status, community hosts, Base payouts, judge guide, `/attack` |
| `contracts/factory` | Studio factory: NEP-591 global contract by hash, instances born with 0 keys |
| `relayer` | NEP-366 relayer Worker (Pages front) and the attack route |
| `scripts/chainsig`, `scripts/verify`, `scripts/alerts`, `scripts/archive` | Address derivation + Base relay; `pnpm verify`; Discord alert feed; Internet Archive preservation |
| `scripts/launch` | Studio launch pipeline: bundle, mirrors, deploy, escrow, attest, snapshot key, official server, lock |
| `scripts/e2e` | End-to-end testnet run and `demo:fresh` |
| `scripts/ops`, `demo/` | Studio shutdown script, fan-host wrapper, film sources, narration, music, Remotion film |
| `scripts/check-identity.mjs`, `scripts/check-secrets.mjs` | Gates run before every commit and deploy |

## FAQ

**The server code is public after release. Can pirates skip the licence?** Yes, anyone can run the released build.
They earn nothing from the pool: hosts are paid only for sessions signed by real licence holders, and your progress and
the paid hosts follow the licence.

**What if the pool runs out?** The dashboard shows its runway. Post-shutdown sales put 90% of their price into the
pool (10% funds the gas-free budget for probes and claims; v1 put in 100%), pledges top it up, and hosts can keep hosting for free.

**Why would a studio opt in?** Player pressure to keep bought games playable, a guarantee badge it can show next to the
price, and royalties on every resale.

**What if OutLayer is down?** A probe that does not complete is inconclusive and never counts against the studio.
Release is retryable by anyone, from any of the hash-pinned mirrors.

## License

MIT. `scripts/outlayer-build-wasm.sh` is vendored from OutLayer (MIT OR Apache-2.0) with one marked change.

## Built with, and disclosure

Built during the NEAR Hackathon window (repository created 13 Nov 2026; no earlier code). Libraries: near-sdk 5
(contract), wasi-http-client, ed25519-dalek, aes-gcm, sha2 (OutLayer programs), near-api-js, NEAR Connect (@hot-labs/near-connect),
@noble/curves|hashes|ciphers, PixiJS 8, React 19, Tailwind 4, motion, wouter, lucide-react, Cloudflare Workers + Durable
Objects, wrangler, vitest, near-workspaces, NEAR Chain Signatures (MPC signer), NEP-591 global contracts, NEP-366
meta-transactions, Walrus (testnet publisher/aggregator), Sigstore / GitHub artifact attestations, Base Sepolia. AI assistance: code, tests and copy were written with AI coding agents (Claude
Code); narration voice by ElevenLabs; the Ember Rift key art was generated with ChatGPT image generation. Ember Rift is a
fictional studio title made for this demo.
