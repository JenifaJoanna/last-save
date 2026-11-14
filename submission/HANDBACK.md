# Last Save — handback (v2, final)

Status, 15 Nov 2026 ~02:00 IST: v2 is built and live on NEAR testnet, with wallet-first sign-in. The judge instance
`ember-rift` was launched, played, shut down and declared dead on camera; its **key was released on 15 Nov at 01:05 IST**
(tx ADPZTugjaHDJZwYMsqR33z8zTxhoE7RsotaT7vTupV8N, `proof/judge-v2-release.json`), after filming.
All film takes are delivered. Nothing has been posted or submitted.

## Repository
- github.com/JenifaJoanna/last-save, branch `main`. Final SHA: the commit that last touched this file
  (`git log -1 --format=%H -- submission/HANDBACK.md`), checked against `git ls-remote origin main` at handback.

## Live URLs
| What | URL | State |
|---|---|---|
| Platform | https://last-save.pages.dev | live, wallet-first (NEAR Connect), wired to `ember-rift` |
| Wallet run on the dev instance | https://wallet-v2dev.last-save.pages.dev | branch preview, wired to `v2dev` |
| Tap-through preview (no wallet) | https://last-save-preview.pages.dev | live |
| Gas-free relayer | https://lastsave-relay.pages.dev | live (`/relay`, `/attack`) |
| Encrypted judge build | https://archive.org/details/ember-rift-server-ember-rift-lastsave | public; sha256 = on-chain artifact hash |
| Judge instance | `ember-rift.lastsave-factory.testnet` | Dead (cause: players), released 15 Nov 01:05 IST |
| Judge community host | https://emberrift-community-v2.pages.dev | live, registered on `ember-rift` (tx 2Gv9w2Fm…), serving the released build |
| Dev community host | https://emberrift-community-v2dev.pages.dev | live, registered on `v2dev` (tx 3w3HcBmW…) |
| Dev instance | `v2dev.lastsave-factory.testnet` | Dead (cause: probes), released, community host serving |
| Second studio | `tidebreak.lastsave-factory.testnet` | Alive, launched in one transaction; not on sale (escrow needs OutLayer) |
| Official judge server | https://emberrift-ember-rift.pages.dev | shut down 14 Nov 22:08 IST as the demo; stays dead |

## Verify (`pnpm verify --all`, saved as `proof/verify-all.json`)
| Instance | Pass | Fail | Warn | n/a |
|---|---|---|---|---|
| ember-rift (v2 judge) | 16 | 0 | 1 | 6 |
| v2dev (v2 dev) | 18 | 0 | 0 | 5 |
| lastsave-licence (v1 judge) | 13 | 0 | 0 | 10 |

## Evidence
- `proof/judge-v2.json`: the filmed judge run with the release folded in, 70 of 72 assertions (release details in
  `proof/judge-v2-release.json`). The 2 misses are the probe-path death checks: the instance died by the 2-of-4 holder
  report quorum instead. Afterlife facts read from chain: refunds
  2 / 0.2 Ⓝ, pledges 2 / 0.2 Ⓝ, pool 0.2 → 0.423 Ⓝ around the post-death buy, runway 8 epochs; every on-camera take
  with its tx.
- `proof/launch-ember-rift.json`: CI build (Rekor 3881246795), Walrus blob, studio CDN, mirrors, instance, escrow,
  attestation, snapshot key, official server, verify, Internet Archive item. `proof/launch-tidebreak.json`: studio #2.
- `proof/run-v2dev-20261114T0857Z.json` + `proof/v2-e2e.md`: the full v2 lifecycle on `v2dev`, incl. the OutLayer
  release, fan host, paid claims and the Base Sepolia payout (0x7351064a…e8eb).
- Real wallet (Meteor Web, `jenifajoanna.testnet`, on `v2dev`): sign-in with the limited key, licence buy
  (Hw6jqPnR…), host registration (DvaU8XF9…), NEP-413 game login; each read back on chain.
- v1: `proof/judge-run.md`, `proof/run-20261113*.json` (unchanged).

## Tests (passed / failed)
| Suite | Passed | Failed |
|---|---|---|
| Licence contract unit / factory / sandbox | 122 / 9 / 3 | 0 |
| Relayer | 43 | 0 |
| Verify scripts | 12 | 0 |
| probe.wasm unit / wasmtime e2e | 33 / 13 | 0 |
| Game server unit / integration | 55 / 15 | 0 |
| Server bundle / host CLI | 6 / 30 | 0 |
| Web wallet library | 5 | 0 |
| v2 judge e2e (ember-rift), release folded in | 70 | 2 (probe-path death checks: it died by holder reports) |
| v2dev e2e (full lifecycle) | 173 | 1 (a test that ignored Base's L1 data fee; re-verified) |

Not covered: a person running the MetaMask paths (sign-in, payout address by signature); the 0x-account game login (not
built); paid claims on ember-rift's community host (hosting is live; claims need OutLayer runs).

## Real vs rehearsed
Real: every contract call, enclave run, MPC signature, Base transfer, relayed attack and refusal; the locked instances;
Walrus, Sigstore and the archive.org copy; the Meteor Web wallet runs above. Rehearsed: seconds-scale liveness timers;
a fictional game and studio; most film UI actions driven by a localhost-only capture signer; the afterlife beats shown
on the dev instance (labelled) because the judge instance's release landed only after filming. Full map: README and
`JUDGE.md`.

## Identity gate
`node scripts/check-identity.mjs --live` → `ok … live=44` (repo, build output, git authorship, Worker configs, every
deployed page; deleted pages listed as expected gone).

## Submission drafts
- `submission/FORM.md`: idea text 1,885 chars. Declaration fields left EMPTY for the submitter: lead name, email, team
  size, mainnet payout address, consent. `demoUrl` = the submitter's X post (draft `submission/X-POST.md`, not posted).
- `submission/LAUNCH-CHECK.md`: re-run end to end on production on 15 Nov after the wallet-first rebuild: 57 items,
  38 pass, 4 fail (1 fixed, 2 partly fixed, 1 proposed; fixes deployed at 1e8edfa), 5 not covered, 10 n/a.

## Known limits (details in README)
- ember-rift's release took 14 inconclusive runs: the pinned enclave programs read the chain through public RPCs (FastNEAR,
  then dRPC), which rate-limited on the deadline night; OutLayer counted those runs inconclusive by design, and a gas-free
  retry every 10 minutes landed it at 01:05 IST. Fix for v3: more RPC fallbacks inside the wasm.
- Meteor adds the gas-free key as any zero-deposit method on the one contract (not our 8-method list); it can never
  attach a deposit.
- Not built: EIP-191 login for 0x accounts; NEAR Auth (shared tenant accepts only localhost); passkeys (mainnet-only).
  Not configured: `VITE_HOT_API_KEY`, `VITE_WALLETCONNECT_PROJECT_ID`.
- The judge build's game server predates the single-use NEP-413 nonce; an open socket outlives a Worker deletion.

## Disclosed incidents
- Internet Archive S3 keys: a page snapshot printed the auto-generated pair into the session log; that pair was
  destroyed at once and a new pair generated without being displayed (stored 0600 in `local/`).
- Discord: the alert feed posted three false "SERVER KEY RELEASED" alerts (timed-out attempts) and a DEAD card with the
  old "three probes failed" wording; the feed is fixed (ffbfbae) and a correction was posted; nothing deleted.
- Two headless test browsers ran unmuted ~12 min (20:57–21:09 IST) after a viewport relaunch dropped the mute flag;
  nothing played. Capture tooling now holds the flag across relaunches.
- A persona-named wallet account was proposed for the real-wallet run; it was refused (identity gate) and a persona-safe
  account used instead.
