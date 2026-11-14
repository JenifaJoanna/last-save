# Re-skin inventory (prepared 14 Nov, before the reference pick)

Rule (owner, 14 Nov): all UI follows one reference the owner picks from vibrant.design or awwwards.com/websites, which sets
the theme, fonts and component style patterns. Components come from our ReUI Pro licence, adapted to that reference.
No UI changes until the pick and the re-skin contract arrive.

## ReUI Pro access: verified 14 Nov
- Licence token `REUI_LICENSE_TOKEN` from the vault is in `web/.env.local` (gitignored; never committed).
- Registry checks with `curl -sL https://reui.io/r/<name>.json`:
  - Licensed blocks return 401 anonymously and 200 with the token. Checked: `agent-activity-1`, `dashboard-1` to `dashboard-4`.
  - Free items return 200 either way. Checked: `c-calendar-1`.
- The shadcn CLI 4.21.0 with `registries.@reui = { url: "https://reui.io/r/{name}.json", headers: { Authorization: "Bearer ${REUI_LICENSE_TOKEN}" } }` resolves Pro blocks. `shadcn view @reui/dashboard-1` returned the block, its files and its dependencies.
- The registry has 1,943 blocks and 82 ui items. The relevant families are mapped per screen below.
- Licence position: the repo keeps only our adapted code. Pro blocks are never committed as is, and never committed as a component library. The registry header reads the token from the environment, so `components.json` holds no secret.

## Order of work once the pick lands
1. **Tokens.** Fonts, colour scale, radius, shadows and motion curves from the reference go into `web/src/styles.css` `@theme`, with the same tokens in `game/client/src/ui/styles.css` and `demo/film/src/theme.ts`.
2. **Set up shadcn in `web/`.** Add `components.json` with the `@reui` registry, plus `cn` and the base ui items the chosen blocks need. Tailwind 4 is already in place.
3. **Primitives.** Button, Card, Badge, Note/Alert, Skeleton, Copy chip, Segmented → Tabs, Toast → Sonner-style.
4. **Shell.** The app sidebar and drawer, and the public navbar and footer.
5. **Screens, in film order.** Store → Afterlife → Hosts → Library and Play → Landing → Sign in → How → Judges → Status → 404.
6. **Preview chrome.** Index, dock and host terminal. Then redeploy the preview and check at narrow, medium and wide widths.
7. **Game client DOM UI.** HUD, sign-in overlay, results screen, and the connection and denied cards. The Pixi arena palette follows the tokens.
8. **Film motion scenes and labels.** The re-film runs after the re-skin is approved.

## Screens (web/src)
| Screen | File(s) | States to keep | ReUI families to adapt |
|---|---|---|---|
| Landing `/` | pages/Landing.tsx, landing-sections.tsx | alive/dead heartbeat, live stats, hosts strip, partner logos, arena iframe | hero, stats, feature, cta, faq, logo cloud, footer |
| Public nav/footer | components/SiteNav.tsx | signed in/out | navbar, footer |
| How it works `/how`, `/app/how` | pages/How.tsx | lifecycle steps | timeline, c-stepper, feature |
| Sign in `/signin` | pages/Signin.tsx | wallet ready/loading, localhost test-key panel, arena side | auth |
| Judge guide `/judges`, `/app/judges` | pages/Judges.tsx | live facts loading/ok, keys 0, factory instances list | data-grid-base / list, card, c-code-block |
| Status `/status` | pages/Status.tsx (renders AfterlifeView) | same as Afterlife | (inherits) |
| 404 | pages/NotFound.tsx | — | c-empty / empty-state |
| App shell | components/AppShell.tsx | sidebar groups, active pill, alive/dead dot, identity menu, phone drawer | app-shell, c-sidebar |
| Store `/app/store` | pages/app/Store.tsx | launch / owned / post-death buy, guarantee checks loading/ok, price split | product-detail, product-card, stats |
| Library `/app/library` | pages/app/Library.tsx | no licence / licence + progress (level, XP, skin) | profile, card, stats |
| Play `/app/play` | pages/app/Play.tsx | official alive/unreachable, community hosts online, none yet | list, card, c-empty |
| Afterlife `/app/afterlife` | pages/app/Afterlife.tsx, afterlife-cards.tsx | alive, probing, 1–3 failed, report quorum, Dead, release in flight, released, refund/pledge, chosen, post-death, missing contract, RPC error | stats, c-progress, c-stepper/timeline, card, agent-activity (feed), c-alert |
| Community hosts `/app/hosts` | pages/app/Hosts.tsx | before release, register form, your host + claim, registered list, empty | c-code-block, card, data-grid-base, settings-style form |
| Base payouts (v2) | pages/app/evm-payouts.tsx | not offered (v1), set address, Booked/Signing/Signed/On Base, bump, relay error | data-grid-base / list, c-badge, card |
| Toasts | lib/toast.tsx | ok, info, error, with tx link | sonner-style toast |
| Wallet modal | styles.css (.nws-*) | wallet-selector theme override | (theme tokens only) |

## Shared components
- `components/ui.tsx`: Button (4 variants, 3 sizes, loading), LinkButton, StatusBadge (alive/dead), Stat, Copy, Ext, Card, Skeleton, Note (3 tones), Segmented.
- `components/brand.tsx`: Mark and Wordmark (the logo itself is kept unless the owner says otherwise), PartnerLogo, Heartbeat (ECG line).
- `styles.css`: `@theme` tokens, plus the glass, card, num, mono, eyebrow, ember-text, grain, beat and skeleton utilities.

## Preview build (web/src/preview, last-save-preview.pages.dev)
- PreviewIndex: hero, lifecycle chips and tile grid.
- PreviewDock: floating stepper, persona select and sound toggle.
- HostRun: terminal replay with a checklist.

## Game client (game/client/src/ui + render)
- `signin.ts`: sign-in overlay, practice entry, and the denied card (wrong host, no licence).
- `hud.ts`:
  - scoreboard, timer pill, host pill, ping
  - profile/XP card, dash button
  - results screen
  - connection lost/reconnecting banner, notices
- `styles.css`: 125 lines of HUD tokens.
- `render/*` (Pixi): arena, ship labels, fx and textures. Palette only; gameplay visuals stay.

## Film (demo/film)
- Motion scenes: `scenes/{Open, Title, Why, Escrow, Close}.tsx`.
- Footage label: `Label` in `Film.tsx`.
- Tokens: `theme.ts`.
- The re-film captures the re-skinned UI, so footage beats follow automatically.

## Out of scope for the re-skin
Contracts, relayer, enclave programs, host CLI output, explorer pages.
