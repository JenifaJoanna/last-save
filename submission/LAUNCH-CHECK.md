# Last Save: launch checklist run

- Run: Sun 15 Nov 2026, 00:55 to 01:47 IST. Browser and build work paused from 00:59 to 01:03 IST while another
  project recorded. The run used one headless session at a time and two production builds in all: one of the deployed
  code (00:55) and one with the fixes (01:45).
- URL: https://last-save.pages.dev, wired to `ember-rift.lastsave-factory.testnet` (the judge instance).
- Commit deployed to production: `051cdce` (Cloudflare Pages production deployment `16205746`, listed at 00:55 IST).
  Repo HEAD was `1ed68aa` at the start and `4148f80` (another session's film commits) during the checks. The web,
  game and scripts code of both is identical to `051cdce`. The fixes from this run are in `44cc7ee` (pushed) and
  are **not deployed**. This file is in the commit after it.
- Chain state, read directly over RPC (drpc):
  - 00:58 IST: Dead, cause `players` (holders reported it down, 14 Nov 22:44 IST). The release was **pending**: not
    released, last error "Release timed out, retry". The on-chain log showed a release retry about every 10 min.
  - **01:05:01 IST: the key was released on-chain** (activity "release · released · key published", key `d5080e…`).
    The status bar went from `DEAD` to `RELEASED`, and every screen read after 01:05 shows the released state.
  - Totals at 01:06 IST: supply 5 (4 sold before the shutdown), 0 Ⓝ locked, pool 0.4233 Ⓝ, refunded 0.2 Ⓝ,
    pledged 0.2 Ⓝ, paid to hosts 0, gas-free budget 0.9448 Ⓝ (0.9648 Ⓝ before the release). 0 hosts, 0 access keys,
    global contract hash `4Awokn…6rt1`, price 0.25 Ⓝ.
  - Later: another session's commit `74391d8` records that ember-rift's community host was registered after the
    release. Every hosts reading in this run, the last at about 01:12 IST, showed 0 hosts.
- Checklist: `_buildroom/launch-checklist.md`, with the approved deviations in BUILD-BRIEF §8 and the re-skin
  contract in §12. The terminal chrome replaces the classic sidebar; where the two conflict, the row names the rule applied.
- Method: agent-browser 0.41.0, headless and muted (`--mute-audio` confirmed in the session Chrome's arguments).
  One session ran at a time, at 1440×900, 1000×800 and 390×844. A DOM audit on every screen measured:
  - horizontal overflow of the page and of the scroll area, and elements past the right edge;
  - clipped text, native controls, images without alt and controls without an accessible name;
  - forbidden strings (lorem, TODO, undefined, NaN, 100%, `[object`), and terminal height against the viewport.
  It also read page errors and console errors and warnings about 3 s after each load.
  Chain values were compared with RPC reads: `get_info`, `get_hosts`, `licence_of`, `nft_tokens`, `get_activity`,
  `evm_payout_info`, `view_access_key_list` and `view_account`.
- Signed-in screens: production sign-in is wallet-only, so they ran on a local production build of the same code.
  The build used `vite build` with the `NAME=ember-rift` env from `scripts/deploy-web.sh` plus `VITE_CAPTURE_SIGNER=1`,
  served on 127.0.0.1:4180, with the localhost-only test signer. The accounts were:
  - lastsave-mira: pledged, licence #3;
  - lastsave-yuna: refunded, licence #1;
  - lastsave-ines: bought after the shutdown, licence #5;
  - lastsave-fanhost: no licence and not a host on this instance.
  Signed-out screens ran on production. Nothing was bought, pledged, refunded, claimed, released or registered.
  The only transaction sent was one public zero-deposit attack on `/attack`; the relayer paid its gas.
- Totals: 57 production page loads (19 paths × 3 widths) and 59 local signed-in loads. Every load had 0 page errors
  and 0 console errors or warnings.

## 1. Routes and auth

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Public `/`, `/how`, `/signin` | yes | PASS | prod, 1440 / 1000 / 390, signed out: each renders in the full-height terminal; 0 page or console errors | none |
| Public `/pricing`, `/terms`, `/privacy` | no: deviation §8 (no plans; licences are sold on-chain) | n/a | prod, all 3 widths: each shows the in-theme 404 "Empty save slot · no screen at this address"; nothing crashes | none |
| Product routes under `/app/*` | yes | PASS | local build: `/app/store`, `/library`, `/play`, `/afterlife`, `/hosts` render for mira at 3 widths and for yuna, ines and fanhost at 1440 and 390 | none |
| `/app/*` redirects to `/signin?next=<path>` without a session | yes (client guard; static SPA, no server middleware) | PASS | prod, signed out, 3 widths: `/app`, the 5 app routes and `/app/nope` land on `/signin?next=…` (`/app` → `next=/app/library`) | none |
| Second guard (`/api/me`) for an expired session | no: deviation §8 (wallet sign-in, no server session; chain data is public) | n/a | no API, no cookie | none |
| API proxy refuses data routes; webhook allowlist and signature checks | no: deviation §8 (no API proxy, no webhooks) | n/a | the only backend is the relayer; its allowlist was not exercised (see Not covered) | none |
| Sign-in links read the session | yes | PASS | prod, signed out: the header shows "Connect wallet", and app links go to `/signin?next=…`. Local, signed in: the header shows the account chip, and `/signin` forwards to the app | none |
| `/signin` with a session skips the form; `next` only under `/app` | yes | PASS | local, mira, 3 widths: `/signin` → `/app/library`; `?next=/app/hosts` → `/app/hosts`; `?next=//evil.example/x` → `/app/library` | none |
| Moved routes keep working | yes | PASS | prod: `/app/how` → `/how`, `/app/judges` → `/judges` at 3 widths | none |
| Signed-in check on the deployed URL | yes | NOT COVERED | prod sign-in needs a real wallet session (NEAR Connect); the test signer refuses any host but localhost | none |

## 2. Flow: landing → product

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Landing → sign in → app | yes | PASS | prod: menu 1 "Store" → `/signin?next=/app/store`. Local, mira, after sign-in: Store shows "You own licence #3 · Go to your library"; Library shows licence #3 | none |
| Workspace, choose plan, judges' code, `?plan=` carry-through | no: deviation §8 | n/a | no plans or workspaces | none |
| Buy a licence end to end | yes | NOT COVERED | a purchase spends 0.25 Ⓝ, which this run may not spend. fanhost (no licence) sees the on-chain price 0.25 Ⓝ, the 90 / 10 split and "Buy and fund the hosts" | none |
| Public attack flow end to end | yes | PASS | prod `/attack`, 390, attack 3 at 01:07 IST: tx `8XxxL1…hBtFh9` sent with relayer gas; the contract refused it with "Register as a host first"; the rule `hosts.rs` is shown | none |

## 3. Pricing

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| `/pricing` page, generous free plan, one paid plan name | no: deviation §8 (licences are sold on-chain at the contract price) | n/a | the Store shows the on-chain price and the sale split | none |

## 4. Landing quality

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Real brand logos from official files | yes | PASS | `/` "Built on": the NEAR wordmark SVG and the OutLayer PNG from `web/public/brand` (sources in `SOURCES.md`); both load and both have alt text | none |
| Logo row: white by default, brand colour on hover, role label per logo | yes | FAIL (partly fixed) | prod: there is no role label per logo, only one shared caption. The NEAR mark is white with an opacity-only hover; OutLayer keeps its own colours | role labels ("licence chain", "enclave escrow"): `44cc7ee`, seen on the fixed local build at 1440; brand-colour hover: proposed |
| Every section has a real heading | yes, judged under §12 | PASS | §12: home is one terminal screen (h1 "Last Save", `// SUMMARY` numbered menu, fact box); the long-form sections are on `/how` with headings | none |
| Data as designed views | yes | PASS | bracketed fact box, stat rows, probe lines, escrow steps, money rows, log timeline, decoded key | none |
| Numbers real and sourced | yes | PASS | prod `/`: 0 access keys, 0 Ⓝ locked, 0.423 Ⓝ pool, 0 hosts and Store 0.25 Ⓝ all match RPC (pool 0.4233 Ⓝ, shown rounded down to 3 decimals) | none |
| No horizontal overflow at 1440 / 1000 / 390 | yes | PASS | 0 px page overflow and nothing past the right edge on 57 prod and 59 local loads. Only the `/how` diagram scrolls sideways inside its own card at 390 (466 px), with no cue | none (cue: proposed) |
| No clipped text | yes | FAIL (partly fixed) | 1. Escrow step "2h ago · licence holders reported the server down" cut on `/status` and `/app/afterlife` at 1440 (330 px) and 390 (250 px). 2. Store check "0 access keys on ember-rift.lastsave-factory.testn…" cut at 1440 (419 px) and 390 (254 px). 3. Library "Emberwing" cut at 390 (127 px). 4. Phone primary keycap "Buy · fund hosts" and "Go to store" cut at 99 px. Deliberate truncation stays: hashes on `/judges` and the Base address (each has a copy button), the official URL on Play, and the account chip at 390 (full id in its title and explorer link) | 1–3: `44cc7ee`. On the fixed local production build, the audit found 0 clipped text on mira's Library, Store and Afterlife and on fanhost's Store and Library at 390, except the deliberate truncation, and Emberwing shows in full. 4: a wrapping keycap was tried and reverted, because "Buy · fund hosts" then overflowed its 40 px keycap (scroll height 67 px): proposed |
| Sticky elements | yes, judged under §12 | PASS | §12: no sticky elements; the chrome is a fixed full-height layout and only the screen scrolls | none |

## 5. Sign-in page

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Full screen, no site header or footer | yes, judged under §12 | PASS | §12: sign-in sits in the terminal like every screen; the header hides its account chip on `/signin` | none |
| Split layout: options on one side, product visual on the other | yes | FAIL (below 1024 px) | 1440: options plus the live arena. At 1000 and 390 the arena is `hidden lg:block`, so the page is one column | proposed |
| Logo and back to site | yes | PASS | LS-0001 home link (labelled "Last Save home") and the SUMMARY / BACK keycaps | none |
| E-mail, code boxes, resend, change e-mail, terms line | no: deviation §8 (NEAR wallet sign-in) | n/a | — | none |
| Built in the product's design system | yes | PASS | terminal tokens, numbered rows, bracket box, group labels | none |
| Phone width | yes | PASS | prod 390: no clipped text; the primary keycap reads "Connect" in full; the rows wrap | none |
| Wallet groups: NEAR Connect first, judge demo secondary and labelled | yes (rebuilt sign-in) | PASS | prod: group 1 "Your wallet · NEAR Connect" has 1 NEAR wallet (gas-free tag) and 2 Ethereum wallet. Group 2 is "Judge demo · no wallet · nothing is saved, nothing is signed", with 3 Practice offline and 4 Tap-through preview | none |
| NEAR Connect modal renders themed | yes (rebuilt sign-in) | PASS | prod, key 1 opens "Select wallet" with Meteor, Intear, Ledger, Nightly, Ethereum Wallets and NEAR CLI. 1440: a centred 420×522 panel. 390: a full-width bottom sheet with 356 px rows. Both use IBM Plex Mono and the ink panel, with 0 overflow (screenshots taken) | none |
| NEAR Connect modal closes cleanly | yes (rebuilt sign-in) | FAIL | prod: a backdrop click closes the modal and stays on `/signin`. Esc also closes it and the toast says "Sign-in cancelled · Nothing was signed and no key was added", but the terminal's own Esc = Back fired too and left `/signin` for `/`. The arrow keys, S and Enter would also act behind the modal | `44cc7ee`: terminal keys ignore keystrokes while the wallet modal is open (`nav.ts` `typing`). On the fixed local build, with the modal open, → stayed on `/signin`; Esc closed the modal and stayed on `/signin`; a second Esc, with no modal, went Back to `/` as before |

## 6. Data and copy correctness

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Real data from every intake path; missing optional fields never crash | yes | PASS | local, four account states (pledged, refunded, post-shutdown buyer, no licence) plus signed out on prod: every screen renders; 0 page and 0 console errors on all loads | none |
| Every number comes from chain or a proof file | yes | PASS | mira 0.1 Ⓝ pledged, yuna 0.1 Ⓝ refunded and ines 0 Ⓝ (post-shutdown) match `licence_of`. The money rows match `get_info` totals; runway 8 epochs = ⌊0.4233 / 0.05⌋. "0/2 reports · 50% of the 4 licences sold before shutdown" matches. Snapshot #6 `798d96…` matches. The Base address `0x7a8e…935a` matches `evm_payout_info`. `/judges`: code hash, wasm hashes and 0 access keys match | none |
| Copy matches what the product does | yes | PASS | The release-pending state was honest: status `DEAD`, not released, with the release offered as "Retry the release"; its full text was not captured before the key landed at 01:05. After 01:05: "Studio gone · server released", "released 3m ago", "Key released on-chain". Refund, pledge and post-shutdown cards match each account. The post-shutdown buyer's stat label read "Locked for you · 0 Ⓝ"; it now reads "Your share" | label: `44cc7ee` |
| No "100%" post-shutdown pool claim | yes | PASS | rendered Store, Library, Afterlife and FAQ say 90% to the pool and 10% to the gas-free budget; the forbidden-string audit found no "100%" on any screen | none |
| No placeholder, lorem or persona names | yes | PASS | the audit found no lorem, TODO, undefined, NaN or `[object` on any screen; identity gate below | none |
| An API disappears: re-check, degrade, keep copy true | yes | PASS | the dead official server shows "Unreachable" on `/app/play`; RPC goes to drpc first, then FastNEAR. One console warning outside the 3 s window: a PixiJS deprecation warning from the `/play` arena iframe on `/signin` (not an error) | none |
| Every route after a deploy, signed out | yes | PASS | prod: 19 paths × 3 widths, nothing crashed, 0 errors | none |
| Every route after a deploy, signed in | yes | NOT COVERED | wallet-only on prod; covered on the local production build instead (above) | none |
| Every route after a deploy, expired session | no: deviation §8 (wallet sign-in, no expiring session) | n/a | — | none |

## 7. Identity isolation

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| Sender, domains and service accounts belong to the persona | yes, except hosting (§8 allows the approved Cloudflare account) | PASS | no e-mail sender; source, host command and proof links point at `JenifaJoanna/last-save` | none |
| Sign-in codes through the persona's Gmail | no: deviation §8 (wallet sign-in) | n/a | — | none |
| Own domain upgrade route | no: deviation §8 | n/a | — | none |
| Grep repo and deployed pages for other products and names | yes | PASS | `node scripts/check-identity.mjs --live` → `check-identity: ok files=674 built=179 wrangler=6 live=38` (exit 0, 00:57 IST) | none |

## 8. Product UI

| Item | Applies? | Result | Evidence | Fix |
|---|---|---|---|---|
| App shell | yes, judged under §12 (terminal chrome replaces the sidebar) | PASS | status bar `LS-0001 · TERMINAL · <screen> · <clock> · DEAD / RELEASED`, numbered menu, keycap bar with shortcuts, SOUND toggle, account chip | none |
| One identity block with sign out | yes | PASS | local: the header chip shows "lastsave-mira · <wallet name> · gas-free · Disconnect" (the wallet name reads "Capture signer" in this build). Disconnect → `/signin`, the chip is gone, the session is cleared, and `/app/hosts` then → `/signin?next=/app/hosts` | none |
| Phone navigation | yes, judged under §12 | PASS | 390: the keycap bar becomes a compact bottom bar (MENU · BACK · ◂ · ▸ · primary) | none |
| Pages fill the viewport; no disclaimer footers | yes | PASS | terminal height = viewport height on every load (900 / 800 / 844); no in-app footer | none |
| No native controls | yes | PASS | DOM audit, every screen at every width checked, signed in and out: no select, date, time, file, checkbox, radio or range input; only token-styled text fields (host endpoint, key, epoch) | none |
| Dashboard says little and shows a lot | yes | PASS | Status and Library: stat rows, probe lines, escrow steps, money rows, log; one primary action on the keycap bar | none |
| In-app How it works and Help | yes (Pricing: deviation §8) | PASS | menu 5 How it works and 6 Judge guide open inside the terminal; `/app/how` and `/app/judges` redirect there | none |
| Billing ($0 subscriptions) | no: deviation §8 | n/a | — | none |
| Completeness: everything the pitch names has a place | yes | PASS | escrow, probes, holder vote, release, refund or pledge, money (Status); hosting, pool, Chain Signatures Base address (Hosts); global-contract factory with 4 instances (Judges); gas-free labels; attacks (`/attack`) | none |
| Controls have accessible names, images have alt | yes | PASS | 0 unnamed controls and 0 images without alt on every load | none |
| Toasts carry transaction hashes | yes (rebuilt sign-in) | NOT COVERED | needs a sent transaction; this run sent none from a signed-in account. The sign-in-cancelled toast was seen (§5) | none |
| Payout address by signature on `/app/hosts` | yes (rebuilt sign-in) | NOT COVERED | the binder shows only for a registered host. No account is a host on `ember-rift`, and registering costs 0.01 Ⓝ. The contract's Base address card renders and matches chain | none |

## Proposed (needs a decision)

1. Sign-in visual below 1024 px. In `web/src/pages/Signin.tsx` the arena panel is `hidden lg:block`. Show a short
   arena strip or the heartbeat line under the options on tablet and phone; the arena iframe is heavy on a phone.
2. Logo row brand colour on hover. In `web/src/components/brand.tsx` `PartnerLogo`, the NEAR mark is white through
   `brightness-0 invert`. It needs an inline or mask-image rendering to take NEAR's brand colour on hover.
3. The `/how` diagram at 390 scrolls 466 px sideways inside its card with no cue. Add a stacked phone variant or a
   "scroll ▸" hint.
4. The phone primary keycap truncates at 99 px: "Buy · fund hosts" on Store and "Go to store" on an empty Library,
   in the `KeycapBar` in `web/src/components/terminal/chrome.tsx`.
   - Tried and reverted: wrapping the label. Even with narrower ◂ ▸ keys, live styles at 131 px still overflowed the
     40 px keycap.
   - Options: short phone labels ("Buy", "Store"), a smaller phone font for the primary keycap, or the primary keycap
     on its own full-width row above the four keys.

## Not covered, and why

- Signed-in screens on the deployed URL: sign-in there is wallet-only. They were covered on a local production build
  of the same code with the localhost test signer, against the same instance.
- Buy, refund, pledge, probe, release, register host, claim, EVM sign or relay: each spends more than gas or changes
  holder state. Only the zero-deposit public attack ran.
- Toasts with transaction hashes and the payout-address binder: each needs one of those transactions or a registered host.
- Real wallets (Meteor, Intear, Nightly, Ledger, Ethereum wallets): connecting needs a human wallet session. The modal
  was opened and cancelled only.
- The release-pending screen text: the key was released at 01:05 IST, before its full text was captured.
- Relayer allowlist refusals (non-zero deposit, other contract): backend, out of this run's scope.

## Delta vs the previous run (14 Nov, 20:56–21:28 IST, 52 items)

- Six of that run's nine FAILs are now PASS on production:
  - horizontal overflow, the sourced numbers on `/judges`, copy correctness and accessible names (all fixed in
    `35d1943`, deployed);
  - identity block with sign out, and the sign-in page at phone width (both resolved by the rebuilt sign-in).
- Clipped text is FAIL again, on four different elements, three of them shown only signed in. The earlier clipped
  titles and rows now wrap. Three of the four are fixed in `44cc7ee` (not deployed); the phone primary keycap is proposed.
- Still FAIL: the logo row (per-logo role labels added in `44cc7ee`; the brand-colour hover is proposed) and the
  sign-in visual below 1024 px (proposed).
- New rows for the rebuilt sign-in (5):
  - wallet groups: PASS;
  - modal themed: PASS;
  - modal closes cleanly: FAIL, fixed in `44cc7ee`;
  - toasts with transaction hashes: NOT COVERED;
  - payout binder: NOT COVERED.
- Accounts: fanhost replaces bank1 as the no-licence account, and yuna replaces dario as the refunded one.
- Chain: the previous run used `v2dev` (released). This run is on `ember-rift`, where the release landed mid-run at
  01:05:01 IST.
- The previous run's proposals:
  - 1 (sign-in visual) and 5 (`/how` diagram cue) are carried forward;
  - 2 (phone keycap) and 3 (identity and sign out) were resolved by the rebuild;
  - 4 (logo row) is half done: the role labels are added and the hover colour is carried forward;
  - 7 (landing "Verify it on-chain" opened `/judges` in a new tab) is fixed in `44cc7ee`: it now navigates inside the terminal;
  - 6 (the `v2dev` fan-host claim loop) does not apply on `ember-rift`, which has 0 hosts.

## Summary

57 items: PASS 38 · FAIL 4 (1 fixed in `44cc7ee`, 2 partly fixed, 1 proposed) · NOT COVERED 5 · not
applicable 10. Until the parent redeploys `44cc7ee`, production still shows all 4 FAILs. A redeploy clears the modal
Esc FAIL and three of the four clipped-text elements, and adds the logo role labels.
