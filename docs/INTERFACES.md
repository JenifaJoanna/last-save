# Last Save — interfaces (the contract between components)

Every component builds against this file. Change it only through the coordinator (the build session).
Units: time in **milliseconds** (u64, `env::block_timestamp_ms()`), money in **yoctoNEAR** (`U128` strings in JSON).
Network: NEAR testnet. RPC: `https://test.rpc.fastnear.com` primary, `https://near-testnet.drpc.org` fallback, retry with
backoff on 429/5xx everywhere (scripts, Workers, wasm). Explorer: `https://testnet.nearblocks.io/txns/<hash>`.

## 1. Accounts
| Role | Account |
|---|---|
| Licence contract (locked after escrow: no full-access keys) | `lastsave-licence.testnet` (demo:fresh uses a fresh sub-account) |
| Studio (sale share, royalties, `end_of_service`; its function-call key = official server key, method `post_snapshot` only) | `lastsave-studio.testnet` |
| Fan host | `lastsave-fanhost.testnet` |
| Players | `lastsave-mira` `lastsave-kofi` `lastsave-yuna` `lastsave-dario` `.testnet` |
| OutLayer | `outlayer.testnet`, API `https://testnet-api.outlayer.ai` |

## 2. Licence contract (`contracts/licence`, near-sdk 5, Rust 1.86, near-contract-standards)
NEP-171 core + NEP-177 metadata + NEP-181 enumeration + NEP-178 approvals + NEP-199 payouts + NEP-297 events.

### 2.1 Init
```
new(config: InitConfig)
InitConfig {
  studio: AccountId, outlayer: AccountId,
  title: String, game_id: String, media: String,           // "Ember Rift", "ember-rift", icon URL
  price: U128, fund_bps: u16, royalty_bps: u16,             // e.g. 0.25 N, 4000 (40% locked), 1000 (10% resale)
  release: Program, probe: Program,                         // Program { urls: Vec<String>, sha256: String }  (wasm32-wasip2)
  key_commitment: String,                                   // sha256 hex of K (32-byte AES key)
  artifact: Artifact,                                       // Artifact { urls: Vec<String>, sha256: String (of encrypted file), build_hash: String (sha256 of plaintext tar.gz), size: u64 }
  official_endpoint: String,                                // https://<official>.pages.dev
  liveness: Liveness { probe_interval_ms: u64, fail_threshold: u32, receipt_window_ms: u64, report_window_ms: u64, quorum_bps: u16 },
  pool: PoolCfg { epoch_ms: u64, pay_per_session: U128, epoch_cap: U128 },
}
```
Production defaults (README): probe_interval 6 h, fail_threshold 4, receipt_window 72 h, report_window 72 h, quorum 5000,
epoch 7 days. Demo instance: probe_interval 20 s, fail_threshold 3, receipt_window 180 s, report_window 120 s, quorum 5000, epoch 120 s.

### 2.2 Change methods (panic messages are user-facing and short)
| Method | Who / when | Effect |
|---|---|---|
| `escrow_key(encrypted_secrets_base64)` payable | studio, once, before any sale | `outlayer.store_secrets(accessor WasmHash{release.sha256}, profile "escrow", access And[Predecessor{Whitelist[self]}, WasmHash{release.sha256}], vault_id null)`, deposit forwarded. Callback `on_escrow` sets `escrowed`; failure reverts. |
| `add_mirror(kind: "release"\|"probe"\|"artifact", url)` payable 0.01 | anyone, any time (content is hash-pinned) | appends URL (max 8 per kind, https only). |
| `attest()` payable ≥ 0.01 N | anyone, escrowed | OutLayer release.wasm mode `attest`; ok ⇔ key_sha256 == commitment ∧ artifact_ok ∧ build_ok ⇒ `escrow_verified = true` (+ attested_at). |
| `buy_licence()` payable, **exact** price | anyone | mints next token id ("1","2",…) to caller. Alive: `pot_share = price*fund_bps/10000` stays in contract, rest to studio (minus mint storage). Dead: whole price → `pool`, pot_share 0. Wrong deposit panics. |
| `post_snapshot(seq: u64, hash, blob_base64)` | studio only, Alive | blob ≤ 16384 bytes decoded, `sha256(blob)==hash`, `seq` > last. Stores latest {seq, hash, blob, at_ms}; keeps hash history (last 32). |
| `probe_official()` payable ≥ 0.01 N | anyone, Alive, no probe in flight (or in flight > 10 min) | OutLayer probe.wasm mode `official`, window [now − receipt_window, now]. |
| `report_down(token_id)` | token owner, Alive, token minted before death | one report per token per report_window. Counts reports in window; if `count*10000 ≥ quorum_bps*live_tokens` ⇒ die("players"). |
| `end_of_service()` | studio, Alive | die("studio"). |
| `release()` payable ≥ 0.01 N | anyone, Dead, not released, not in flight (or in flight > 10 min) | OutLayer release.wasm mode `release`. Callback checks `sha256(K)==commitment`, stores K hex publicly, `released_at_ms`. |
| `choose(token_id, choice: "Refund"\|"Pledge")` | token owner, Dead, pot_share > 0, no choice yet | Refund ⇒ transfer pot_share to owner; Pledge ⇒ pool += pot_share. Final. |
| `register_host(endpoint, host_pubkey)` payable 0.01 | anyone, released | host id = caller account; updatable by the same caller. |
| `claim_epoch(epoch: u64)` payable ≥ 0.01 N | a registered host, released, epoch complete, not already paid for (host, epoch), no claim in flight for this host | OutLayer probe.wasm mode `host`. Pay = min(verified × pay_per_session, epoch_cap, pool); pays only when verified ≥ 1; record claim. |
| NEP-171/178/199 | standard | `nft_transfer_payout`/`nft_payout`: royalty_bps to studio, rest to owner. Transfers carry pot_share and the unused choice. |

`die(cause)`: status Dead, `died_at_ms`, `cause ∈ {"probes","players","studio"}`. Release is a separate anyone-callable step
(the UI and scripts call it immediately). **OutLayer `null` output (failure/timeout) never counts as a probe failure** and
never changes state beyond clearing in-flight and recording `last_error`.

Probe judgement (official): alive ⇔ `reachable ∧ build_ok ∧ verified ≥ 1`. A failed probe is counted only if
`now − last_counted_failure_ms ≥ probe_interval_ms` (first failure always counts); a passing probe resets the count.
`consecutive_failures ≥ fail_threshold` ⇒ die("probes").

Epochs: `epoch(t) = (t − released_at_ms) / epoch_ms`; epoch e is complete when `now ≥ released_at + (e+1)*epoch_ms`.

### 2.3 Views
`ls_status() -> "Alive"|"Dead"` (read by release.wasm) · `release_info() -> {artifact_urls, artifact_sha256, build_hash, key_commitment, status}`
(read by release.wasm attest) · `licence_of(account_id) -> Option<LicenceView>` (read by servers and probe.wasm) ·
`get_info() -> Info` (one call for the dashboard: config, status, cause, died_at, escrowed, escrow_verified, release state,
released_key, released_at, totals {supply, live_supply, pot_locked, pool, refunded, pledged, paid_out}, probe state
{consecutive_failures, last_alive_ms, last_probe_ms, in_flight, last_error}, reports_in_window, current_epoch, snapshot meta) ·
`get_token(token_id) -> LicenceView {token_id, owner_id, pot_share, choice, minted_at_ms, post_death}` ·
`get_hosts() -> Vec<HostView {host_id, endpoint, host_pubkey, registered_at_ms, epochs_paid, sessions_paid, earned}>` ·
`get_claims(from_index, limit)` · `get_snapshot() -> Option<{seq, hash, blob_base64, at_ms}>` · `get_activity(limit)` (last 64
probe/report/claim outcomes, newest first) · standard `nft_*` views.

### 2.4 Events (NEP-297, `standard: "lastsave"`, `version: "1.0.0"`)
`escrowed` · `escrow_verified` · `licence_sold {token_id, buyer, price, pot_share, phase}` · `snapshot_posted {seq, hash}` ·
`probe {result: "alive"|"failed"|"inconclusive", failures, verified}` · `report_down {token_id, count, needed}` · `died {cause}` ·
`release_requested` · `key_released {key}` · `choice {token_id, choice, amount}` · `host_registered {host_id, endpoint}` ·
`epoch_claimed {host_id, epoch, verified, paid}`. NFT mint/transfer use the standard `nep171` events.

### 2.5 OutLayer call shape (proven in `proof/spike.md`)
`request_execution(source: {WasmUrl:{url, hash, build_target:"wasm32-wasip2"}}, resource_limits:{max_instructions: 5e9,
max_memory_mb: 256, max_execution_seconds: 60}, input_data: <json string>, secrets_ref: {profile:"escrow", account_id: self}
(release only), response_format: "Json", payer_account_id: caller, params: null)`; attached = caller's deposit; then a
`#[private]` callback reading `env::promise_result(0)`: `null` ⇒ inconclusive. Gas: give OutLayer all but 35 Tgas, callback 25 Tgas.
URL used = `urls[mirror_index]` (caller passes optional `mirror_index`, default 0).

## 3. OutLayer modules (wasm32-wasip2, read stdin JSON, print one JSON line < 900 bytes)
**release** (`outlayer/release`): secret env `LASTSAVE_SERVER_KEY` (64 hex). Contract checked = `NEAR_PREDECESSOR_ID`.
`{"mode":"attest"}` ⇒ reads `release_info` over RPC, downloads the artifact, checks sha256, AES-GCM-decrypts with K, checks
sha256(plaintext)==build_hash ⇒ `{ok, mode, key_sha256, artifact_ok, build_ok}`. `{"mode":"release"}` ⇒ requires `ls_status`
== "Dead" ⇒ `{ok, mode, key, key_sha256, status}`; otherwise `{ok:false, error}`.

**probe** (`outlayer/probe`): input `{mode:"official"|"host", contract, endpoint, host_id, build_hash, nonce, from_ms, to_ms,
epoch: u64|null}`. GET `{endpoint}/attest?nonce=&host=&from=&to=&epoch=` (10 s timeout). Output
`{ok:true, mode, reachable, build_ok, verified, rejected, reasons:{sig,key,licence,window,host,replay}, sample:[≤4 accounts]}`.
`ok:false` only for a malformed input. Verification per session entry (§4.3), dedupe by account, max 64 entries.

## 4. Formats
### 4.1 Server artifact
Plaintext = `server-bundle.tar.gz` (Worker script + Durable Object + game client assets + restore logic + wrangler template).
`build_hash = sha256(plaintext)`. Encrypted file = `"LSV1"`(4 bytes) ‖ nonce(12) ‖ AES-256-GCM(K, nonce, plaintext, aad="LSV1")
ciphertext‖tag(16). `artifact.sha256 = sha256(encrypted file)`. K = 32 random bytes, hex in the secret, `key_commitment = sha256(K)`.

### 4.2 NEP-413 login (one wallet signature per session)
Payload signed: `sha256( borsh(u32 2147484061) ‖ borsh({message: String, nonce: [u8;32], recipient: String, callback_url: Option<String>}) )`.
`message` = JSON `{"app":"ember-rift","host":"<host_id>","session_pubkey":"ed25519:<base58>","exp_ms":<ms>}`; `recipient` = licence
contract id. Login object: `{account_id, public_key:"ed25519:<b58>", signature:<base64>, message, nonce:<base64 32 bytes>, recipient}`.
Valid ⇔ signature verifies ∧ `public_key` is an access key of `account_id` (RPC `view_access_key`, final) ∧ `licence_of(account_id)`
is non-null ∧ host matches ∧ `now < exp_ms ≤ now + 24 h`. Replay protection for joining: every `hello` carries a
fresh `proof` signed by the session key over `lastsave-hello:v1|{host}|{ts_ms}|{account_id}` with `|now − ts_ms| ≤ 60 s` (the same
login may reconnect any number of times; a captured login without the session key is useless).
`host_id`: `"official"` for the studio server, else the host's account id.

### 4.3 Session receipt (signed by the session key, no wallet prompt)
`{host, epoch: u64|null, nonce:<hex 16 bytes>, ts_ms, account_id, signature:<base64>}`; signed bytes = UTF-8
`lastsave-receipt:v1|{host}|{epoch or "-"}|{nonce}|{ts_ms}|{account_id}` with the login's `session_pubkey`.
The server requests one at match start and each new epoch (`receipt_req`). Probe accepts an entry iff login valid (§4.2, exp
compared to receipt ts), receipt sig valid, `receipt.host == login host == host_id`, account matches, time/epoch in range,
`(account, nonce)` not seen twice in the response.

### 4.4 `GET /attest` response
`{host_id, build_hash, nonce (echo), now_ms, sessions: [{login, receipt}]}` — sessions whose receipt is in [from,to] (official) or
has `epoch == epoch` (host), newest first, max 64, at most 2 per account.

### 4.5 Progress snapshot
Canonical JSON (keys sorted, no spaces): `{"at_ms":…,"game":"ember-rift","players":{"<account>":{"kos":…,"level":…,"matches":…,
"shards":…,"skin":"…","xp":…}},"seq":…}`; `hash = sha256(utf8)`. Posted after every match while Alive. Hosts restore the latest
on-chain snapshot after checking its hash; a mismatch refuses to start.

## 5. Game server (one codebase: official deploy and every fan host) — `game/server`
Cloudflare Worker + Durable Object `Arena` (WebSocket Hibernation API, SQLite storage). Public face: a Pages project whose
`_worker.js` forwards to the Worker through a service binding (Worker has `workers_dev=false`, `preview_urls=false`). Local fan
host: `wrangler dev` + `cloudflared` quick tunnel.
Env: `HOST_ID`, `BUILD_HASH`, `LICENCE_CONTRACT`, `RPC_URLS`, `SNAPSHOT_SIGNER` (studio only: function-call key secret, posts
`post_snapshot`), `RESTORE_SNAPSHOT` (fan host: base64 snapshot + hash, verified on first boot).
HTTP: `GET /health` → `{ok, host_id, build_hash, players_online, match}` · `GET /attest` (§4.4) · `GET /profile?account=` →
`{account_id, level, xp, skin, matches}` · `GET /ws` (WebSocket) · static client at `/`.
WebSocket messages: `game/shared/protocol.ts` (owned by the coordinator).

## 6. Host CLI (`host/`, `pnpm host`)
Reads chain (`get_info`, `release_info`, `get_snapshot`), refuses unless released; downloads artifact from any mirror, verifies
sha256 (tampered ⇒ refuse), decrypts with released K, checks build_hash, unpacks to `.host/<build_hash>/`, verifies snapshot hash,
then `--local` (wrangler dev + cloudflared, prints public URL) or `--deploy <name>` (Worker + Pages, pages.dev URL), then
`register_host(endpoint, host_pubkey)` and optionally `--claim` each completed epoch. Prints every tx URL.

## 7. Ownership
| Path | Owner |
|---|---|
| `docs/INTERFACES.md`, `game/shared/*`, `game/client/*`, `web/*`, `outlayer/release/*`, `scripts/lib/*`, root files | coordinator (Opus) |
| `contracts/licence/*` | contract agent |
| `outlayer/probe/*` | probe agent |
| `game/server/*`, `server-bundle/*`, `host/*` | game-backend agent |

## 8. As built (deviations recorded at integration, 14 Nov)
- NEP-171/177/178/181/199 are hand-rolled (same method names and JSON shapes) instead of near-contract-standards, to keep the
  wasm deployable (434 KB with the crate, 287 KB without, wasm-opt -Oz). `nft_resolve_transfer` takes borsh args.
- `buy_licence` requires the key to be escrowed first ("Licences are not on sale yet").
- Dead-phase buys put `price − mint storage` (~0.004 N) into the pool; claim-record storage is paid from the pool.
- `attest`, `probe_official`, `release`, `claim_epoch` take an optional `mirror_index`.
- Any OutLayer output with `ok != true` is inconclusive (null, probe RPC outage, malformed): never a failure, never a record.
- `/attest` omits `epoch` from the query when null; receipts with a missing epoch are filtered by time only.
- `register_host` sends the host account's own access-key public key as `host_pubkey`.
- Reproducible wasm builds use OutLayer's pinned compiler image (`scripts/outlayer-build-wasm.sh`, amd64, rustc 1.97.1).

## 9. v2 additions, as built (14 Nov)
Licence v2 is published once as a NEAR global contract (code hash `4AwoknekGdP3CMhHFpCJyDUCXnF6Rp79snrVr23i6rt1`, 332,631 B)
and instantiated by the factory. v1 (`lastsave-licence.testnet`) is unchanged.

**Gas-free holder actions (NEP-366).**
- `probe_official`, `release` and `claim_epoch` accept a zero deposit; the contract then pays OutLayer 0.02 N from `ops_budget`.
- Limits: a budget-paid probe at most once per `probe_interval_ms`; one budget-paid claim per (host, epoch); a budget-paid release only when none is in flight and ≥ 60 s after the last.
- `fund_ops()` is payable and anyone can call it. `sync_ops()` credits only untracked surplus (balance − storage − pot − pool − evm_settled − ops_budget − in-flight deposits − signing reserve).
- 10 % of each post-death sale goes to `ops_budget`.
- Relayer: `https://lastsave-relay.pages.dev` `POST /relay {signed_delegate}`.
  - Allowed: receivers from an allowlist, and methods `choose, report_down, probe_official, release, claim_epoch, sign_evm_payout, bump_evm_payout, set_payout_evm`, with zero deposit and ≤ 300 Tgas.
  - It verifies the delegate signature, expiry and key permissions before paying. The relayer pays gas only.

**Chain Signatures payouts (Base Sepolia, chainId 84532 fixed).**
- Config: `evm_payout {mpc, path, address, demo_wei_per_session, max_fee_per_gas, max_priority_fee_per_gas, max_fee_cap, gas_limit, start_nonce}`.
- `set_payout_evm(address)` acts on the caller's own host record only.
- `claim_epoch` for a host with `evm_address` books an `EvmPayout`. It moves the NEAR from `pool` to `evm_settled`, which no method can withdraw. The same `epoch_paid` flag guards both rails.
- `sign_evm_payout(id)`: anyone, zero deposit.
  - Builds the EIP-1559 tx and calls `v1.signer-prod.testnet.sign({request:{path, payload_v2:{Ecdsa}, domain_id:0}})` with 1 yocto attached.
  - Checks `ecrecover == address` (with a parity retry) and stores `signed_tx` and `tx_hash`.
  - Only one payout can be Signing at a time, and the lock frees after 10 min.
- `bump_evm_payout(id)`: same nonce, recipient and value; fee ×1.25 (clamped to `max_fee_cap`); ≥ 120 s since the last signature; at most 5 bumps.
- Views:
  - `get_evm_payouts(from_index, limit)`: `id, host_id, epoch, to, verified, value_wei, near_debited, nonce, status (Booked|Signing|Signed), signed_tx, tx_hash, signed_txs[], tx_hashes[], max_fee_per_gas, max_priority_fee_per_gas, booked_at_ms, last_signed_ms, last_error`.
  - `evm_payout_info()`: `address, next_nonce, mpc, path, chain_id, derivation_account, domain_id, demo_wei_per_session, max_fee_cap, evm_settled, signing_payout, payouts`.
- Re-derive the address from public inputs: `node scripts/chainsig/derive.mjs --contract <instance> --path lastsave/host-payouts`.
- Relay a signed payout (anyone): `node scripts/chainsig/relay.mjs`.

**Global contract + factory (NEP-591).**
- `lastsave-factory.testnet`: `new(owner, licence_code_hash)`.
- `create_instance(name, config)` is payable. It creates `<name>.lastsave-factory.testnet`, transfers the deposit, runs `UseGlobalContract(code hash)`, calls `new({config})`, and forwards any deposit above `min_deposit(config)` to the instance's `fund_ops`. No access key is ever added (born locked).
- Views: `instances(from_index?, limit?)`, `code_hash()`, `owner()`, `is_open()`, `min_deposit(config)`.
- Refunds on failure go through `claim_refund()`, which pays via a callback.

**Artifact pipeline: provenance + Walrus mirror (14 Nov).**
- `.github/workflows/release-build.yml`: pushing tag `build-<name>` builds the plaintext bundle for `<name>.lastsave-factory.testnet`, attests it (GitHub artifact attestation, Sigstore, Rekor) and publishes `server-bundle.tar.gz`, `.sha256` and `.sigstore.json` as a public Release.
- Launch: `cibuild` (tags with plain git, waits for the release, verifies provenance over public endpoints, encrypts that tarball: `build_hash` = attested digest), `walrus` (testnet publisher `PUT /v1/blobs?epochs=53&permanent=true`, read back and hashed), `cdn` (Pages `kiln-cdn-<name>`, the studio's own copy), then `mirrors` sets `artifact.urls = [studio copy, Walrus aggregator, GitHub raw]`.
- Provenance check (`host/lib/provenance.mjs`, shared by `cibuild` and the host): GitHub attestations REST API (unauthenticated, falls back to the release's `.sigstore.json`), then `sigstore` verification against the public trust root with the issuer pinned and the signer identity required to be this repo's release workflow; the signed statement must name the digest, the `release-build.yml` workflow and a commit. Prints `built by workflow … at commit …, logged … UTC (Rekor #n)`. Digest ≠ on-chain `build_hash` or an invalid bundle refuses; an unreachable API only warns (the on-chain hash still gates). `pnpm host --verify-only` runs mirrors + provenance without a key.
- Host mirrors are tried in order, one line each (`studio copy … 404 (gone)`, `walrus … 200, sha256 matches on-chain ✓`), stopping at the first verified copy.
- Official server: each posted snapshot's canonical JSON is also PUT to Walrus (non-blocking); `/health` lists `walrus.latest[{seq, blob_id, url}]`. The on-chain snapshot stays authoritative.
- Studio shutdown: `scripts/ops/kill-studio-copy.sh <name>` deletes `kiln-cdn-<name>`. Walrus testnet is not permanent storage (periodic wipes).
