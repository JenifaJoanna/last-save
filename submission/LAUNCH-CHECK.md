# Last Save: launch checklist run

- Run: Sat 14 Nov 2026, 20:56 to 21:28 IST
- URL: https://last-save.pages.dev (instance `v2dev.lastsave-factory.testnet`: Dead, cause probes, key released)
- Commit deployed to production: `fd84073` (Cloudflare Pages production deployment list, about 1 h before the run).
  Repo HEAD when this file was written: `bf48328`. The fixes below are in `35d1943` and are **not deployed yet**.
- Checklist: `_buildroom/launch-checklist.md`, with the approved deviations in BUILD-BRIEF §8 and the re-skin
  contract in §12 (the terminal chrome replaces the classic sidebar; where they conflict the row says which rule applied).
- Method: agent-browser, headless and muted, at 1440×900, 1000×800 and 390×844. A DOM audit on every screen
  measured horizontal overflow in the terminal's scroll area, clipped text, native controls, images without alt and
  controls without an accessible name, and read the page errors. Chain values were compared with direct RPC reads
  (`get_info`, `view_access_key_list`, `view_account`, `get_hosts`, `nft_tokens`, `licence_of`, `get_activity`).
- Signed in: production sign-in is wallet-only, so signed-in screens ran on a local production build of this tree
  (same instance, relayer and factory env as the deploy) with the localhost-only test signer, as five accounts:
  mira (pledged), dario (refunded), fanhost (bought after the shutdown, registered host), bank1 (no licence) and
  signed out. Nothing was bought, pledged, refunded, claimed or registered.

## 1. Routes and auth

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Public `/`, `/how`, `/signin` | yes | PASS | prod, all 3 widths: each renders, 0 page errors, 0 console errors | none |
| Public `/pricing`, `/terms`, `/privacy` | no: deviation §8 (no plans, licences sold on-chain) | n/a | prod: each shows the in-theme 404 "Empty save slot" with links back; nothing crashes | none |
| Product routes under `/app/*` | yes | PASS | `/app/store`, `/library`, `/play`, `/afterlife`, `/hosts` render signed in (local build); `/app` goes to `/app/library` | none |
| `/app/*` redirects to `/signin?next=<path>` without a session | yes (client guard; static SPA, no server middleware) | PASS | prod, signed out: all 5 app routes plus `/app` and `/app/nope` land on `/signin?next=…` | none |
| Second guard (`/api/me`) for an expired session | no: deviation §8 (wallet sign-in, no server session; chain data is public) | n/a | no API, no cookie | none |
| API proxy refuses data routes; webhook allowlist and signature checks | no: deviation §8 (no API proxy, no webhooks) | n/a | the only backend is the relayer; its allowlist was not exercised (see Not covered) | none |
| Sign-in links read the session | yes | PASS | signed out: menu 1–4 open `/signin?next=…` (prod); signed in: the same rows open the app screen (local build) | none |
| `/signin` with a session skips the form; `next` only under `/app` | yes | PASS | local build, mira: `/signin` → `/app/library`; `?next=/app/hosts` → `/app/hosts`; `?next=//evil.example/x` → `/app/library` | none |
| Moved routes keep working | yes | PASS | prod: `/app/how` → `/how`, `/app/judges` → `/judges`, `/app` → `/app/library` | none |
| Signed-in check on the deployed URL | yes | NOT COVERED | prod sign-in needs a real wallet (Meteor or MyNearWallet; NEAR Connect upgrade in progress); the test signer refuses any host but localhost | none |

## 2. Flow: landing → product

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Landing → sign in → app | yes | PASS | prod: Home "1 Store" → `/signin?next=/app/store`; local build after sign-in: Store shows "You own licence #1 · Go to your library" | none |
| Workspace, choose plan, judges' code, `?plan=` carry-through | no: deviation §8 | n/a | no plans or workspaces | none |
| Buy a licence end to end | yes | NOT COVERED | a purchase spends 0.25 Ⓝ, which this run may not spend; bank1 (no licence) sees the price read from chain and "Buy · fund hosts" | none |
| Public attack flow end to end | yes | PASS | prod `/attack`, attack 3: tx `4kf7JA…wpvZRF` sent with relayer gas, contract refused "Register as a host first", rule link shown, counter 1 refused | none |

## 3. Pricing

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| `/pricing` page, generous free plan, one paid plan name | no: deviation §8 (licences are sold on-chain at the contract price) | n/a | the Store shows the on-chain price and the sale split | none |

## 4. Landing quality

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Real brand logos from official files | yes | PASS | `/` "Built on" row: NEAR wordmark SVG and OutLayer PNG from `web/public/brand` (sources in `SOURCES.md`), both load, both have alt text | none |
| Logo row: white by default, brand colour on hover, role label per logo | yes | FAIL | NEAR mark is white with an opacity-only hover; OutLayer keeps its own colours; one shared caption instead of a role per logo | proposed |
| Every section has a real heading | yes, judged under §12 | PASS | §12: home is one terminal screen (h1 "Last Save", `// SUMMARY` numbered menu, fact box); long-form sections are on `/how` with h2 headings | none |
| Data as designed views | yes | PASS | bracketed fact box, stat rows, probe bars, step list, log timeline, decoded key | none |
| Numbers real and sourced | yes | PASS | `/`: 0 access keys, 0 Ⓝ locked, 0.337 Ⓝ pool, 1 host all match RPC. The store price was a hard-coded "0.25" (it matched `config.price`); it is now read from chain | done in 35d1943 |
| No horizontal overflow at 1440 / 1000 / 390 | yes | FAIL (prod) | prod 390, overflow inside the screen: `/status` +184 px, `/judges` +167 px. Signed in at 390: `/app/store` +125, `/app/hosts` +296, `/app/afterlife` +164; `/app/play` squeezed the official URL to 4 px under overlapping text. After the fix: 0 px on all 10 screens × 3 widths (local production build) | done in 35d1943 |
| No clipped text | yes | FAIL (prod) | 390: status-bar titles cut ("LICENCE ST…", "TRY TO KIL…", "HOW IT WO…"); `/attack` titles cut at 1440 ("DRAIN THE HOSTING P…") and all five at 390; landing menu subtitles cut at 390. They wrap now. What stays truncated is deliberate: long URLs, hashes (each has a copy button) and log lines | done in 35d1943 |
| Sticky elements | yes, judged under §12 | PASS | §12: no sticky elements; the chrome is a fixed full-height layout, and only the screen scrolls (real 1440 viewport scrolled on `/`) | none |

## 5. Sign-in page

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Full screen, no site header or footer | yes, judged under §12 | PASS | §12: sign-in sits in the terminal like every screen; the status bar and keycaps are terminal chrome, not a marketing header | none |
| Split layout: options on one side, product visual on the other | yes | FAIL (below 1024 px) | 1440: options plus live arena. At 1000 and 390 the arena is `hidden lg:block`, so the page is one column over empty space | proposed (superseded by auth upgrade) |
| Logo and back to site | yes | PASS | LS-0001 home link and the BACK / SUMMARY keycaps | none |
| E-mail, code boxes, resend, change e-mail, terms line | no: deviation §8 (NEAR wallet sign-in) | n/a | — | none |
| Built in the product's design system | yes | PASS | terminal tokens, numbered rows, bracket box | none |
| Phone width | yes | FAIL (prod) | 390: "CONNECT A WALLET" row title cut (wraps now, shared row component); primary keycap "CONNECT WALLET" cut to 99 px | row: done in 35d1943; keycap: proposed (superseded by auth upgrade) |

## 6. Data and copy correctness

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Real data from every intake path; missing optional fields never crash | yes | PASS | local build, five account states (pledged, refunded, post-shutdown buyer and host, no licence, signed out): every app screen renders; 0 page errors and 0 console errors over the whole production-build sweep | none |
| Every number comes from chain or a proof file | yes | FAIL (prod) | `/judges` showed "Contract code hash 1111…1111" (the empty placeholder for a global-contract account) and factory rows "0 access keys · never" built from missing fields. Now: `global_contract_hash` `4Awokn…6rt1` (matches `view_account`), creator, creation time and a live access-key count per instance | done in 35d1943 |
| Copy matches what the product does | yes | FAIL (prod) | menu said "lifecycle in six steps" (page shows four); "> no probe has run yet" beside "3/3 failed" (probes had fallen out of the 30-entry log); 30 log rows "Epoch claimed · NONE" for claims that paid nothing; "Every yoctoNEAR accounted for" omitted the 0.856 Ⓝ gas-free budget; Library told a holder who had pledged to "take your locked share back or pledge it"; a post-shutdown buyer saw "Your share is locked for you" at 0 Ⓝ; the empty library after shutdown said part of the price is locked for you (90% goes to the pool) | done in 35d1943 |
| No "100%" post-shutdown pool claim | yes | PASS | `web/src` states only the 90% pool / 10% gas-free budget split (Store, FAQ, licence card) | none |
| No placeholder, lorem or persona names | yes | PASS | `web/src` grep for lorem, TODO, persona and other product names: none. Identity gate: see §7 | none |
| An API disappears: re-check, degrade, keep copy true | yes | PASS | FastNEAR answered 429 to this IP during the run; the app fell over to drpc and every screen loaded. The dead official server shows "Unreachable" on `/app/play` | none |
| Every route after a deploy, signed out | yes | PASS | prod: 16 paths × 3 widths, nothing crashed, 0 errors | none |
| Every route after a deploy, signed in | yes | NOT COVERED | wallet-only on prod; covered on the local production build instead (above) | none |
| Every route after a deploy, expired session | no: deviation §8 (wallet sign-in, no expiring session) | n/a | — | none |

## 7. Identity isolation

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Sender, domains and service accounts belong to the persona | yes, except hosting (§8 allows the approved Cloudflare account) | PASS | no e-mail sender; source and proof links point at `JenifaJoanna/last-save`; commits authored by JenifaJoanna | none |
| Sign-in codes through the persona's Gmail | no: deviation §8 (wallet sign-in) | n/a | — | none |
| Own domain upgrade route | no: deviation §8 | n/a | — | none |
| Grep repo and deployed pages for other products and names | yes | PASS | `node scripts/check-identity.mjs --live` → `check-identity: ok files=647 built=194 wrangler=6 live=34` (exit 0); pre-commit run on 35d1943 → `ok files=653 built=177 wrangler=6 live=skipped` | none |

## 8. Product UI

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| App shell | yes, judged under §12 (terminal chrome replaces the sidebar) | PASS | status bar `LS-0001 · TERMINAL · <screen> · <clock> · RELEASED`, numbered menu, keycap bar with shortcuts, SOUND toggle on every screen | none |
| One identity block with sign out | yes | FAIL | no account readout in the chrome and no sign-out control anywhere (`signOut` exists in the wallet context but nothing calls it); the account only appears as "Held by …" in Library | proposed (fold into auth upgrade) |
| Phone navigation | yes, judged under §12 | PASS | 390: the keycap bar becomes a compact bottom bar (MENU · BACK · ◂ · ▸ · primary) | none |
| Pages fill the viewport; no disclaimer footers | yes | PASS | the terminal is `h-dvh`; short screens (Play, Sign in) sit in the full-height screen; no in-app footer | none |
| No native controls | yes | PASS | DOM audit on every screen × 3 widths: no select, date, time, file, checkbox or radio input; only token-styled text fields (host endpoint, key, epoch, EVM address) | none |
| Dashboard says little and shows a lot | yes | PASS | Status and Library: stat rows, probe bars, steps, money rows, log; one primary action on the keycap bar | none |
| In-app How it works and Help | yes (Pricing: deviation §8) | PASS | menu 5 How it works and 6 Judge guide open inside the terminal; `/app/how` and `/app/judges` redirect there | none |
| Billing ($0 subscriptions) | no: deviation §8 | n/a | — | none |
| Completeness: everything the pitch names has a place | yes | PASS | escrow, probes, holder vote, release, refund or pledge, money (Status); hosting, claims, Chain Signatures payouts (Hosts); global-contract factory (Judges); gas-free labels; attacks (`/attack`) | none |
| Controls have accessible names | yes | FAIL (prod) | below 480 px the header home link had no text and no label | done in 35d1943 |

## Proposed (needs a decision)

1. Sign-in visual below 1024 px (superseded by auth upgrade): `web/src/pages/Signin.tsx`, arena panel `hidden lg:block`. Show a short arena strip or the heartbeat panel under the options on tablet and phone.
2. Sign-in primary keycap at 390 (superseded by auth upgrade): `KeycapBar` primary label `truncate` (99 px). Use a short phone label ("Connect"), or give the primary keycap its own row.
3. Identity and sign out (fold into auth upgrade): `web/src/components/terminal/Terminal.tsx` header, next to SOUND. Show `<account> · SIGN OUT`, calling the wallet's `signOut`.
4. Logo row: `web/src/pages/Landing.tsx` "Built on". Give each logo a role label ("Licence chain", "TEE enclave") and the NEAR brand colour on hover.
5. `/how` diagram at 390: the SVG (`min-w-[760px]`) scrolls sideways inside its card with no cue. Add a stacked phone variant or a "scroll ▸" hint.
6. Fan-host claims (ops, not UI): all 30 latest on-chain log entries are fanhost claims that paid nothing (epochs 56–85: "no verified sessions", then "probe run failed or timed out, retry"; last one about 20:57 IST, current epoch about 196). The host's tunnel URL also changed during the run. Check the fan-host claim loop before judging.
7. Landing "Verify it on-chain" opens `/judges` in a new tab (`Ext` always sets `target=_blank`). Use in-terminal navigation for internal links.

## Not covered, and why

- Signed-in screens on the deployed URL: wallet-only sign-in. Covered instead on a local production build of this tree with the localhost test signer, against the same instance.
- Buy, refund, pledge, probe, release, register host, claim, EVM sign or relay: each spends more than gas or changes holder state. Only the zero-deposit attack call ran.
- Real wallets (Meteor, MyNearWallet, NEAR Connect): needs a human wallet session.
- Relayer allowlist refusals (non-zero deposit, other contract): backend, out of this run's scope.

## Summary

52 items: PASS 30 · FAIL 9 (5 fixed in 35d1943, not deployed yet; 1 partly fixed; 3 proposed) · NOT COVERED 3 ·
not applicable 10. Until the parent deploys 35d1943, production still shows the 6 fixed or partly fixed FAILs.
