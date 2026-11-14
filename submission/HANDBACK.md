# Last Save — handback (v2)

Status, 14 Nov 2026 late evening IST: v2 is built and live on NEAR testnet. The judge instance `ember-rift` was launched,
played, killed and declared dead on camera; its **key release is still pending** (see Known limits). Nothing has been
posted or submitted.

## Repository
- github.com/JenifaJoanna/last-save, branch `main`. Commit SHA: `git log -1 --format=%H -- submission/HANDBACK.md`,
  verified against GitHub at handback time.

## Live URLs
| What | URL | State |
|---|---|---|
| Platform (wallet-first, NEAR Connect) | https://last-save.pages.dev | live, wired to `ember-rift` |
| Run on the dev instance (wallet checklist) | https://wallet-v2dev.last-save.pages.dev | branch preview, wired to `v2dev` |
| Tap-through preview (no wallet) | https://last-save-preview.pages.dev | live |
| Gas-free relayer | https://lastsave-relay.pages.dev | live (`/relay`, `/attack`) |
| Judge instance | `ember-rift.lastsave-factory.testnet` | Dead (cause: players), release pending |
| Dev instance | `v2dev.lastsave-factory.testnet` | Dead (cause: probes), released, community host registered |
| Second studio | `tidebreak.lastsave-factory.testnet` | Alive; launched in one transaction (not escrowed) |
| Official server (judge) | https://emberrift-ember-rift.pages.dev | shut down 14 Nov 22:08 IST as the demo; stays dead |

## Evidence
- `proof/judge-v2.json`: the judge run. e2e phases preflight → report pass 64/64; afterlife facts read from chain
  (refunds 2 / 0.2 Ⓝ, pledges 2 / 0.2 Ⓝ, pool 0.2 → 0.423 Ⓝ around the post-death buy, runway 8 epochs) and the
  on-camera takes (buy, reports, pledges, refund, post-death buy) with their tx hashes.
- `proof/launch-ember-rift.json`: CI build (Rekor 3881246795), Walrus blob, studio CDN, mirrors, instance, escrow,
  attestation, snapshot key, official server, verify. `proof/launch-tidebreak.json`: the second studio.
- `proof/verify-ember-rift.json`, `proof/verify-v2dev.json`, `proof/verify-all.json`: `pnpm verify --json`.
- `proof/run-v2dev-20261114T0857Z.json` + `proof/v2-e2e.md`: the full v2 lifecycle on `v2dev`, including the OutLayer
  release, fan host, paid claims and the Base Sepolia payout (tx 0x7351064a…e8eb).
- v1: `proof/judge-run.md` and the `proof/run-20261113*.json` files (unchanged).

## Tests (passed / failed)
| Suite | Passed | Failed |
|---|---|---|
| Licence contract unit / factory / sandbox | 122 / 9 / 3 | 0 |
| Relayer | 43 | 0 |
| Verify scripts | 12 | 0 |
| Game server unit / integration (incl. NEP-413 replay refusal) | 55 / 15 | 0 |
| Host CLI | 30 | 0 |
| Judge e2e (ember-rift, through report) | 64 | 0 |
| v2dev e2e (full lifecycle) | 173 | 1 |

Not covered by an automated run: a person signing in with Meteor or MetaMask on the deployed site (the checklist for that
run is ready; the on-chain proof of the gas-free key path is tx BM781HeC…), ember-rift's release and everything after it
(waiting on OutLayer), and the 0x-account game login.

## Identity gate
`node scripts/check-identity.mjs --live` → `check-identity: ok … live=38` (repo, build output, git authorship, Worker
configs, every deployed page and asset; deleted pages listed as expected gone).

## Film
Owned by the film session (`demo/film/**`). Takes in `demo/film/public/footage/raw/` (gitignored), recorded on
`ember-rift` (launch, buy, match, attack, kill, reports, pledges, refund, post-death buy) and on `v2dev` for the release
and hosting beats, labelled on screen as the dev instance.

## Submission drafts
- Form fields: `submission/FORM.md`. Declaration fields are left empty for the submitter (lead name, email, team size,
  payout address, consent).
- X post: `submission/X-POST.md`, not posted.
- Launch checklist results: `submission/LAUNCH-CHECK.md`.

## Known limits
See README "Known limits". Most important tonight:
- `ember-rift`'s release is pending. The pinned release and probe programs read chain state through public RPCs inside
  the enclave; on the deadline night both rate-limited, so OutLayer runs failed and counted inconclusive, as designed.
  The instance died by holder reports (2 of 4). Anyone can retry the release; v1 and v2dev show completed releases.
- Tidebreak cannot sell licences until its key is escrowed and attested (needs OutLayer too).
- Ethereum-wallet (0x) accounts can sign NEAR transactions but cannot log into the game yet.
- No email/Google login: the shared NEAR Auth testnet tenant only accepts a localhost callback.
- HOT Kit needs `VITE_HOT_API_KEY`; WalletConnect needs `VITE_WALLETCONNECT_PROJECT_ID`. Neither is set.

## Disclosed incidents
- Internet Archive S3 keys: a page snapshot printed the auto-generated key pair into the session log. The pair was
  destroyed immediately and a new pair generated, which was never displayed (stored 0600 in `local/`).
- Discord: the alert feed posted three false "SERVER KEY RELEASED" alerts for timed-out release attempts. The feed is
  fixed (ffbfbae) and a correction was posted in the channel; nothing was deleted.
- Two headless test browsers ran unmuted for about 12 minutes (20:57–21:09 IST) after a viewport change relaunched
  Chrome without its mute flag; nothing played. Capture tooling now keeps the flag across relaunches.
