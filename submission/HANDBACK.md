# Last Save — handback

Status: build complete on NEAR testnet; judge instance launched, locked, and taken through its whole life on camera.
The film is a **rough cut** (not final). Nothing has been posted or submitted.

## Repository
- github.com/JenifaJoanna/last-save, branch `main` — commit SHA: see the last line of this file's commit
  (`git log -1 --format=%H -- submission/HANDBACK.md`), verified against GitHub at handback time.

## Live URLs
| What | URL | State |
|---|---|---|
| Platform | https://last-save.pages.dev | live (landing, `/status`, `/how`, `/judges`, `/signin`, `/app/*`) |
| Official Ember Rift server | https://emberrift.pages.dev | shut down on 14 Nov 02:44 IST as the demo; stays dead by design |
| Community server (released build) | https://emberrift-community.pages.dev | live, registered on-chain, progress restored from snapshot #7 |
| Licence contract | https://testnet.near.rocks/account/lastsave-licence.testnet | Dead, released, 0 access keys |

## Evidence
- `proof/judge-run.md` — the locked instance's life, every transaction linked (launch → lock → buys → probes → death →
  release → refunds/pledges → post-shutdown buy → fan host → paid claims → persistent host).
- `proof/run-20261113T202809Z.json`, `proof/run-20261113T203700Z.json`, `proof/run-20261113T204054Z.json` — end-to-end
  testnet run on the dev instance, 98/98 assertions.
- `proof/spike.md` — day-one escrow spike (contract-owned OutLayer secret, refusal while alive, stranger denied).
- `proof/launch-lastsave-licence.json` — launch transactions of the judge instance.

## Tests (passed / failed / not covered)
| Suite | Passed | Failed |
|---|---|---|
| Contract unit | 77 | 0 |
| Contract sandbox lifecycle (deployed binary) | 1 | 0 |
| probe.wasm unit / wasmtime e2e | 33 / 13 | 0 |
| Game server unit / integration | 40 / 15 | 0 |
| Server bundle / host CLI | 6 / 12 | 0 |
| E2E testnet assertions | 98 | 0 |

Not covered: Meteor / MyNearWallet sign-in end to end (no keys imported into third-party wallets; UI flows were driven by a
localhost-only test-account signer), `pnpm demo:fresh` live run (needs a ~3.4 testnet NEAR funder), real-time 90 s match
in the automated integration suite (it runs time-scaled; real-time matches were played live on testnet).

## Identity gate
`node scripts/check-identity.mjs --live` → `check-identity: ok … live=15` (repo, build output, git authorship, Worker
configs with workers_dev = false and preview_urls = false, every deployed page and asset, and workers.dev unreachability
for emberrift-arena and emberrift-community-arena).

## Film
- Rough cut: `demo/film/out/last-save-rough-cut.mp4` (2:39, 1920x1080), assembled in Remotion from `demo/film/edl.json`
  over real takes in `demo/film/public/footage/raw/` (gitignored; all recorded on the judge instance).
- Vertical 45 s composition `LastSaveVertical` is defined; not rendered yet.
- Narration, music and SFX: `demo/AUDIO.md`; verified quotes: `demo/SOURCES.md`; brief: `demo/demo-brief.md`.

## Submission drafts
- Form fields: `submission/FORM.md` — declaration fields left empty for the submitter (lead name, email, team size, payout
  address, consent).
- X post: `submission/X-POST.md` — not posted.

## Known limits
See README "Known limits". In short: reconnect-within-grace keeps an old input counter (clients start sequences from a
timestamp), community hosts cannot post progress on-chain, open sockets outlive a Worker deletion for ~3 minutes,
OutLayer timeouts are inconclusive and retryable, a host needs ~0.05 testnet NEAR per claim.

## Pending, by decision of the owner
- Optional extra NEAR features and the platform UI reference: either would mean a new locked instance and a re-film.
- Web redeploy with small copy fixes made after the filmed run (held; the live site works as is).
