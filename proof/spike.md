# Day-one spike: contract-owned OutLayer secret, released only on death

**Result: PASS on the primary path (no fallback needed).** Run 14 Nov 2026, 00:44–01:05 IST, NEAR testnet.
Raw log with every tx: [`spike-run.json`](spike-run.json).

## What was proven

| # | Claim | Evidence (testnet) |
|---|---|---|
| 1 | A contract can own an OutLayer secret. `escrow_key` (studio-only, once) forwards K, sealed with ECIES to the keystore seed `wasm_hash:{release}:{contract}`, to `outlayer.testnet store_secrets`. Owner = the contract. | escrow [B42cqTp…](https://testnet.nearblocks.io/txns/B42cqTp371TNCVYir817uXXBBkprByfwpfgfvrTUvbXd); `secrets_exist` = true; storage 0.00691 Ⓝ |
| 2 | Access rule = `And[ Predecessor{Whitelist[contract]}, WasmHash(release.wasm) ]`, accessor `WasmHash`. | stored with the escrow tx above (`escrow_access` view) |
| 3 | The contract can run release.wasm with that secret through `request_execution` + `secrets_ref`, and the result lands in its own callback (yield/resume). `attest` mode returns sha256(K) only, and it matched the on-chain commitment. | attest [5yQP755…](https://testnet.nearblocks.io/txns/5yQP755umx7MqfUa2RQmNpu4kpBKGr8s3cAeVAxQKPX5) (~69 s end to end) |
| 4 | release.wasm itself refuses while alive: inside the TEE it reads `ls_status` of `NEAR_PREDECESSOR_ID` over RPC and outputs `refused: … reports status Alive, not Dead`. K never left. (Spike-only door `release_unchecked`; the real contract has no path that runs release while alive.) | [5ZgfSav…](https://testnet.nearblocks.io/txns/5ZgfSav9SX9c4hJXkFhzQUcQrgLKZjk51x4HXGmFksG) |
| 5 | Failure / timeout path: a starved run never resolved, NEAR's yield timed out (~2 min), OutLayer charged only the 0.001 Ⓝ base fee and refunded the rest to the caller, and returned `null` to our callback. The contract cleared `in_flight`, recorded the error and stayed retryable. | [DQZ8xNx…](https://testnet.nearblocks.io/txns/DQZ8xNxJigvSQG6bqWCS18svboKzvZnLffKooc3xGXHK) |
| 6 | Release after death: status Dead → anyone (a player account) calls `release` → OutLayer TEE → K returned, sha256(K) checked against the commitment, stored publicly, `key_released` event emitted. Released K == the studio's local K. Cost 0.00109 Ⓝ, run 908 ms, 33 s end to end. | [HwhFnAC…](https://testnet.nearblocks.io/txns/HwhFnACKtBmqttDL8xvcsY8Hy4jaqvJRLDAAiKaLF3uG) |
| 7 | A stranger cannot use the secret: `lastsave-mira` calling `outlayer.request_execution` directly with `secrets_ref {account_id: <contract>}` is refused by the keystore: "Access denied by access condition — signer lastsave-mira.testnet, called from lastsave-mira.testnet". The same signer succeeds only when the call passes through the contract, so the Predecessor rule is what admits it. | [8BEx2xv…](https://testnet.nearblocks.io/txns/8BEx2xv23ioq7BW8vfqKqDDcpKC6uNw9J6AjM1tua1Nw) |

## Observed operational facts (design inputs)
- OutLayer resolves a failed or timed-out run with a **successful promise whose value is `null`**, not a failed
  promise. Callbacks must treat `null` as failure.
- Three consecutive runs (00:56–01:00 IST) timed out while OutLayer's executors were cycling (uptime resetting
  each ~60 s); the next attempt succeeded. **Release must be retryable by anyone, any number of times**, and the
  demo script must retry. Each failed attempt costs the caller 0.001 Ⓝ.
- The keystore checks leaves against the **signer** unless wrapped in `Predecessor{}`; a plain
  `Whitelist[contract]` would deny every release because the signer is whoever pressed the button.
- The pubkey endpoint is `POST /secrets/pubkey {accessor, owner, profile, secrets_json}` on
  `testnet-api.outlayer.ai`; ECIES v1 envelope `[0x01|eph_pub|nonce|ct+tag]`, HKDF info `outlayer-keystore-v1`.
  The legacy symmetric format must not be used (its key is the public key).
- Public testnet RPCs rate-limit; fastnear primary + drpc fallback with backoff, signed locally and polled by hash.
- The release program is fetched by URL but pinned by SHA-256, so the final contract can let anyone add mirror URLs.

## Not covered by the spike (moves to the licence contract and its tests)
- Deleting the contract's full-access keys after escrow (`list-keys` empty) — done on the real instance.
- Probe- and quorum-driven death (spike used a studio-only `kill`).
- Reproducible (Docker) build of release.wasm; the spike build used local cargo with path remapping.

## Accounts
Spike account `spike.lastsave-licence.testnet` (deleted after this run; balance returned to `lastsave-licence`).
Release program: `outlayer/dist/lastsave-release.wasm` at commit `a94b1a8`, sha256 `4179cc41…bc29`.
