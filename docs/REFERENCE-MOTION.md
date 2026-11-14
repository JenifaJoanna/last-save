# Reference motion study → Last Save terminal

Reference: the CRT-terminal portfolio the owner picked (URL in the build brief, §12). Studied live on 14 Nov, 12:30–13:00 IST.
Methods:
- headless Chromium at 1440×900 and 390×844;
- `document.getAnimations()` and `getKeyframes()` timings;
- computed `transition-*` values in the rest, hover and pressed states;
- Web Audio calls logged by wrapping `OscillatorNode` and `AudioBufferSourceNode.start`;
- video frame captures at 20–25 fps, read with ffmpeg contact sheets.

Only timings, curves and behaviours are measured. No code, assets, logo, words or copy are taken. Our palette, fonts, copy and
sounds are our own.

**The main finding:** motion on the reference is stepped, not smooth. Entrances use `steps(5)` and `steps(8)`, and blinks use `steps(2)`.
Interaction feedback is instant or 60 ms. Hover has no transition: the selection jumps. It feels like a 1980s terminal, so we
keep that: stepped entrances, instant selection, short presses. Smooth easing (`--ease-out`) is used only where our story needs it.

The Check column holds ✓ or a stated reason, filled after the side-by-side pass (see the end of this file).

| # | Interaction | Trigger | What moves | Measured (duration · easing) | Last Save element | Check |
|---|---|---|---|---|---|---|
| 1 | Boot sequence | first visit in a session (a sessionStorage flag) | Chrome shows at 0.2 s on an empty screen with a "press a key or click to skip" hint; 7 log lines print one per step, each a whole line (≈2-frame reveal); hard cut to home | lines every ≈400 ms; cut at ≈3.8 s; no fade | Terminal boot: `LS-0001 TERMINAL`, checks (contract link, escrow, enclave, keys = 0) printed line by line; any key/click skips; once per session || ✓ lines every 400 ms, hard cut at ≈3.6 s (ref ≈3.8 s), once per session (`ls-boot`), any key or click skips and is swallowed |
| 2 | Screen change ("dial-up") | menu choice, Enter, NEXT/PREV | screen clears; centred box types `$ <cmd> get /<page>` char by char; then `> resolving … ok`, `> link 1200 baud … ok`, `> receiving [####──] n %` stepped bar; status-bar title shows `CONNECTING_` | typing ≈300 ms; whole interstitial ≈850 ms; then cut | Same pattern with our command (`$ ls-0001 open /afterlife`), our lines; ≈700 ms; skipped under reduced motion || ✓ ≈750 ms interstitial (ref ≈850 ms): typed command, two link lines, stepped receive bar; status bar shows CONNECTING_ |
| 3 | Content print-in | new screen | rows type in left→right with a block cursor `█`, top to bottom, staggered | first row at ≈0 ms after the cut, all settled ≈1.1 s; rows staggered ≈100 ms | `PrintIn`: cards/rows reveal with a stepped clip and a block cursor; 60 ms stagger || ✓ panels step in (400 ms, steps(5)) 55 ms apart, late-mounting panels included; the block cursor appears on lines that print, not on every panel (panels are larger than the reference's rows) |
| 4 | Status-bar title decode | screen change | title letters resolve from random glyphs to the word | ≈25 ms per char | Status bar `<screen>` decodes || ✓ decode, 25 ms per char |
| 5 | Menu row entrance | screen enter | each row slides in from x −14 px and fades in | 400 ms · `steps(5)` · stagger 55 ms | Summary menu rows, list rows || ✓ 400 ms · steps(5) · x −14 px · 55 ms stagger |
| 6 | Menu selection | hover, arrow keys, digit keys | selected row becomes a cream slab with dark text and fine horizontal lines; others go back | instant (transition 0 s) | Numbered menu rows (Summary, choices) || ✓ instant cream slab with print lines on hover, ↑↓ and digits |
| 7 | Keycap press | pointer down / key | keycap moves down; its 2-layer bottom shadow shrinks | 60 ms · `ease` · translateY 3 px, shadow 4/5 px → 1/2 px | Keycap bar buttons, all primary buttons || ✓ computed transition `transform, box-shadow 0.06s ease`; pressed translateY(3 px), shadow 4/5 → 1/2 px; keyboard presses flash the same state |
| 8 | Keycap hover | pointer over | no change (cursor: pointer only) | none | Same: no hover motion on keycaps || ✓ none |
| 9 | Text links and toggles | hover | no visual change; the affordance is a `▸` glyph and the pointer cursor | none | Links show `▸`; no hover animation || ✓ `▸` affordance, no hover motion |
| 10 | Load bar | screen enter | thin bar under the status bar grows 0→100 % and fades | 380 ms · `steps(8)` | Same, ember || ✓ 380 ms · steps(8), gold |
| 11 | CRT roll bar | screen enter | a soft horizontal band sweeps top −24 % → 104 % | 2400 ms · linear · fades in/out over 10 % | Same, once per screen || ✓ 2400 ms linear once per screen |
| 12 | CRT flicker | always | whole screen opacity dips to 0.94 for ≈1.5 % of a cycle | 11 000 ms loop · ease | Same; off under reduced motion || ✓ 11 000 ms loop, dip to 0.93 |
| 13 | Grain | always | noise texture jumps position | 3600 ms loop · `steps(8)` | Same, our own SVG noise || ✓ 3600 ms · steps(8), own SVG noise |
| 14 | Scanlines | always | static fine horizontal lines over the screen (no motion) | static | Same || ✓ static 1 px lines every 3 px |
| 15 | Status LED | always | dot blinks between opacity 1 and 0.35 | 2400 ms · `steps(2)` | `LS-0001` LED: green alive, amber probing, red dead, gold released || ✓ 2400 ms steps(2); colour follows state |
| 16 | "ON" indicator | always | `ON` text blinks | 1600 ms · `steps(2)` | `SOUND: ON` || ✓ 1600 ms steps(2) |
| 17 | Hero emblem | always | emblem rotates 8° and scales 1.12 and back | 3400 ms · ease-in-out loop | Our heartbeat emblem (sun + ECG) pulse || ✓ 3400 ms ease-in-out pulse (6°, 1.08); our own sun and heartbeat emblem |
| 18 | Live clock | always | `HH:MM · ONLINE` in the status bar | minute tick | `HH:MM · ONLINE / PROBING / DEAD / RELEASED` || ✓ local HH:MM, updates every 10 s; link state word |
| 19 | Sound: click / select | click, arrow, digit, Enter | 2 short noise buffers + a 440 Hz sine blip | ≈60–100 ms | Our own synthesized blip (Web Audio, own params) + existing SFX for story moments || ✓ own blip: 30 ms high-passed noise + 70 ms square chirp (540/620/880 Hz by action); measured on click and digit keys |
| 20 | Sound: hover | hover | none | — | none || ✓ none |
| 21 | Sound toggle | button `SOUND: ON/OFF` | label swaps, sound mutes | instant | Same, top right, key `M` || ✓ `SOUND: ON/OFF`, top right, key M, persists |
| 22 | Keyboard navigation | 1–6, ↑/↓, Enter, back | selection and navigation; hints shown in the footer hint bar | instant | 1–6, ↑↓, Enter, Esc = back, S = summary, ←/→ = prev/next || ✓ 1–6, ↑↓, Enter, Esc, S, ←/→, M; hint bar lists them per screen |
| 23 | Scroll | wheel / touch | nothing scrolls: screens fit the bezel (`overflow: hidden`); content is paged | — | Desktop: screens fit the bezel and long lists page; phone: the screen scrolls inside the bezel (our content is longer) || Differs by design: our screens carry more data than the reference's, so the screen scrolls inside the bezel (the bezel never scrolls). Wide desktop home fits without scrolling |
| 24 | Cursor | anywhere | system cursor; pointer on interactive elements | — | Same || ✓ system cursor, pointer on interactive |
| 25 | Narrow layout | ≤ 480 px | bezel full width; status bar keeps title and clock; keycaps fill the width in one row; hint bar hidden | — | Same || ✓ bezel full width, status bar keeps title and clock, keycaps fill one row, hint bar hidden; checked at 390 |
| 26 | Display type | titles | wide heavy caps; top part solid cream, lower part cut into sunset bands (gold, orange, magenta) by thin gaps | static | Our display face with our band ratios || ✓ Archivo expanded black; cream top, gold / ember / magenta / violet bands with cuts, repeated per line |
| 27 | Key facts box | boxes | thin border with bracketed corner marks in an accent colour | static | `Bracket` component for key facts || ✓ `Bracket` with ember corner marks |
| 28 | Reduced motion | `prefers-reduced-motion` | (reference: not verified) | — | We turn off flicker, grain motion, roll, dial-up typing and print-in; instant states || ✓ verified with emulation: boot skipped, roll hidden, flicker, grain, blinks, print-in and SVG line draws off |

## Our story moments (contract §12; no reference equivalent)
| Moment | Behaviour | Timing |
|---|---|---|
| Probe | Probe results print as terminal lines `PROBE 1/3 … FAILED unreachable` | line print as in #3 |
| Dead | Screen flickers (3 hard opacity dips), then a red flatline sweeps; LED → red | 600 ms flicker + 900 ms sweep |
| Release | The released key decodes char by char from random hex | 18 ms per char |
| Refund / pledge | Two big numbered choices (1 REFUND · 2 PLEDGE), selected like #6, keys 1/2 | instant |
| Base payout | Signed transmission readout: nonce, to, value, chainId 84532, r/s/v lines print in | as #3 |

## Side-by-side verification (14 Nov, 13:00 IST)
Same tools on both: headless Chromium at 1440×900 and 390×844, `getAnimations()`/`getKeyframes()`, computed transitions, wrapped Web Audio
calls, and video contact sheets (`boot.webm`, `nav.webm` for each side, kept locally, not committed).
- Boot: reference cuts to home at ≈3.8 s; ours ≈3.6 s with six lines at 400 ms.
- Screen change: reference ≈850 ms dial-up then print-in; ours ≈750 ms then print-in, status title decodes on both.
- Stepped timings match to the millisecond for rows 5, 10–16 (same durations and step counts measured on both).
- Keycap computed transitions match exactly (row 7).
- Note: in a headless tab the page reports `hidden`, so rAF and transitions do not advance between screenshots; our timing code uses timers,
  and transition end states were read from computed styles rather than frames.
