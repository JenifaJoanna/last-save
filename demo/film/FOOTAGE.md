# Last Save film: take list for the v2 judge run (owner: Last Save · Build; consumer: Last Save · Film)

Save each take as `demo/film/public/footage/raw/<slot>.mp4` (gitignored; `scripts/remote/m2-sync.sh` copies it to the render box).
Shot on the locked v2 judge instance `ember-rift.lastsave-factory.testnet`, real chain only, with the **production
build** (no PREVIEW pill, no preview strip). Until a take arrives, the film shows an on-brand placeholder in that slot.

## Spec for every take (unless a row says otherwise)
- Web: viewport 1920×1080 at deviceScaleFactor 2, 30 or 60 fps, recorded with agent-browser `record start … --cursor`.
  The address bar, browser chrome, OS notifications and any personal data stay out of frame. Sound ON in the app is fine
  (the film replaces the audio).
- Cursor: slow and deliberate, about 0.6 s per move. Rest it beside the button for 0.5 s before each click, then click once.
  Keyboard shortcuts are welcome where the app has them (Enter = primary).
- Hold still for 1 s at the start and 1 s at the end of every take. One action per take, 5–15 s, unless the row says
  "long" (those are cut down in the edit; never speed up or fake a wait).
- Terminal: a real shell recorded with asciinema and replayed by `demo/capture/term.html`. Use the terminal palette (bg
  #120e22, fg #efe5d0, prompt gold #ffc94a, ok #45e394, fail #ff4d5e), IBM Plex Mono at 26 px, 96 columns × 26 rows,
  no hostname or user in the prompt (`$ `), and no secrets or env values on screen.
- Terminal commands run as `pnpm -s …` (without -s pnpm prints the project path) and never show a cwd or home path.
- Sidecars the film reads (agreed with the builder, 14 Nov):
  - `match.events.json` (and `lost`, `back`): the client's capture-only impact log (`?capture`). Format
    `[{ "t": s from the saved mp4's first frame, "kind": "hit"|"kill"|"shard"|"dash" }]`, plus `{ "kind": "trim", "s" }`
    if the head was cut. `node scripts/hits.mjs` writes S08's MATCH_HITS from it.
  - `<slot>.cast` beside every terminal take: the asciinema file, so key lines are re-set as crisp type.
  - `hostbtn` may be a screenshot burst: `hostbtn/0001.png…` + `hostbtn/frames.json` `[{ "file", "t" }]`, page content
    only, device scale 2. `node scripts/burst.mjs hostbtn` makes the mp4, holding each shot for its real interval.
- Intake: `node scripts/takes.mjs --sheets <dir>` checks every take against this spec and makes contact sheets.
- Explorer flashes: testnet explorer page at browser zoom 125 %, with the field that matters (status, method, args or
  the access-key list) visible without scrolling. Hold 3 s. Name the take `x-<slot>.mp4`.
- Players: mira, kofi, yuna and dario (holders), fanhost (the fan), plus one non-holder. Same names as the preview.

## Takes, in film order
| Slot | Beat (≈t) | Screen and state at start | Exact actions | Must be visible at the end | Length |
|---|---|---|---|---|---|
| store | Buy 0:29 | `/app/store` signed in as **yuna**, no licence yet | hold 1 s; move to BUY; click; sign in the wallet or test signer (keep the sign step on screen ≥ 1 s) | toast + "You own licence #n", the split bar 60/40 | 12 s |
| library | Buy 0:35 | `/app/library` as yuna, right after the buy | hold; hover over the licence card | licence #n, locked share in Ⓝ, royalty line | 6 s |
| x-buy | Buy 0:38 | explorer: the buy_licence tx | — | method `buy_licence`, deposit, status Success | 3 s |
| x-keys | Promise 0:52 | explorer: the instance account's access keys | — | "0 access keys" (or the empty key list) | 3 s |
| x-launch | Promise 0:44 | explorer or page showing the artifact record: Walrus blob page AND the studio CDN copy (curl `-I` in the terminal, 200), plus the Sigstore/Rekor entry for the build | one take each: `x-walrus`, `t-cdn`, `x-rekor` | blob id + sha256; HTTP 200; Rekor log index + workflow name | 3 s each |
| attack | Try to kill it 0:56 | `/attack` **while the instance is ONLINE (before the kill)** | run all five in turn, each result line printing (actual answers on the fresh judge instance, 14 Nov): 1 release → "The game is still alive", 2 report_down → "No such licence", 3 claim_epoch → "Key is not released yet", 4 set_payout_evm → "Register as a host first", 5 sign_evm_payout → "No such payout" | 5 refusals, each with its tx link; open one link → `x-attack` | long, 40 s |
| t-factory | Any studio 1:06 | terminal | `create_instance` on the factory for a second studio (the real command) | new instance account + tx hash | 10 s |
| x-factory | Any studio 1:12 | explorer: the new instance | — | code hash = the global code hash; 0 access keys | 3 s |
| match | Live match 1:16 | game client as **mira** on the official server + 3 bots, Emberwing skin, level badges visible, status ONLINE | play: dash through two rivals, grab shards (hit-stop, shake, particles visible) | HUD levels + "Official server" chip | long, 40 s |
| t-kill | Kill 1:27 | terminal | delete the official Worker (the real command) | the delete confirmation | 8 s |
| t-404 | Kill 1:30 | terminal | `curl -I` the studio CDN download URL | `404` | 4 s |
| lost | Kill 1:31 | game client as mira, mid-match on the official server, recording **through** the kill | keep playing until the client shows CONNECTION LOST; hold 2 s | CONNECTION LOST overlay | long, until lost |
| probes | Kill 1:33 | `/status` from ONLINE | Run a probe ×3 (as the contract allows), each result printing; record straight through the waits | 1/3, 2/3, 3/3 FAILED with holder-signed session counts, then the screen flips DEAD (red flatline) | long |
| discord | Kill 1:41 | the Discord channel that receives the alert, dark theme, window cropped to the message | wait for the alert to land | "Ember Rift: server DEAD" message | 5 s |
| release | Release 1:44 | `/status` in DEAD | Release the server (gas-free) | OutLayer receipt link, key decoding char by char, status gold RELEASED | long |
| x-release | Release 1:47 | explorer: the OutLayer execution / on_release tx | — | key value on-chain, status Released | 3 s |
| refund | Choose 1:50 | `/app/afterlife` as **yuna** | choose 1 REFUND, confirm | toast "Gas paid by the relayer: you paid 0 Ⓝ", refunded amount | 8 s |
| refund2 | Choose | same as **dario** | choose 1 REFUND | same toast | 6 s |
| pledge | Choose 1:53 | `/app/afterlife` as **mira**, then **kofi** (two takes: pledge, pledge2) | choose 2 PLEDGE | pool total rising | 6 s each |
| postbuy | Choose 1:55 | `/app/store` as the non-holder after death | buy | the 90/10 split bar (90 % to the keep-alive pool, 10 % gas-free budget), pool rises about 0.223 Ⓝ, runway in epochs | 8 s |
| x-archive | Preserved 1:58 | the Internet Archive item page of the released build | scroll to the file list or sha256 | item title + sha256 matching the chain | 4 s |
| x-walrus2 | Preserved 2:00 | the Walrus blob page of the released build | — | blob id; sha256 = on-chain value | 3 s |
| hostbtn | Fan hosts 2:04 | the "Host this game" page as **fanhost** | click it; follow the one-click deploy to its end | the deployed host URL | long, ≤ 40 s |
| t-host | Fan hosts 2:07 | terminal | `pnpm host …` (the real command), full run | studio copy 404 → Walrus 200 → sha256 ✓ → built by workflow … logged ✓ → snapshot restored → host registered | long |
| back | Back in 2:15 | community host game client, signed out | Sign in with NEAR as mira → licence checked → lobby → match resumes | same level and Emberwing skin as in `match` | 15 s |
| bounce | Back in 2:20 | community host as the non-holder | try to join | the "no licence" refusal | 5 s |
| epoch | Back in 2:23 | `/app/hosts` | run the epoch probe / claim | 4 player-signed sessions verified, host paid | 10 s |
| base | Paid on Base 2:27 | `/app/hosts`, the Base payout row | Sign → "Signed by MPC" → Relay | the relay result with the Basescan link; then open it → `x-base` | 12 s + 3 s |
| t-verify | Verify 2:35 | terminal | `pnpm verify` against the judge instance, full run | every ✓ row, ending with the summary line | long |

## Placeholders used until the takes land
Preview captures of `last-save-preview.pages.dev` and the 14 Nov 02:00 v1 takes in `public/footage/raw/`. None of their
numbers appear in the final film.
