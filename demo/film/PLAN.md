# Last Save film plan (v1, 14 Nov, IST). Built from this file; changes go through the coordinator.

## 1. Story, audience, aha, close
Story: a publisher switches its servers off, and the game you paid for goes with it. Last Save is a licence that
outlives its publisher. Every sale locks 40 % for the players, and the server build is encrypted and escrowed with an
enclave that only the licence contract can open. On camera we kill the official server. Probes fail three times, the
contract declares the studio gone, and the enclave releases the server. Each holder takes a refund or pledges it, a
fan hosts the archived build with one command, and the same players are back with the same progress. The host is
paid per player-signed session, on NEAR or on Base through Chain Signatures, and every claim can be checked with
one command.
Audience: NEAR hackathon judges (people, plus AI screeners who run the repo).
30-second aha (1:20–1:50): the screen goes red, the flatline falls silent, then it turns gold and the key decodes.
Closing line on screen: "We killed our server. You still have the game." VO: "Last Save. Built on NEAR."

## 2. Direction (style frames in out/frames; the owner picks)
Recommended: **one world, all three constructions**. (A) The camera lives inside the LS-0001 CRT for real footage and
chain beats: the real app is the terminal, so every take plays full-frame inside the bezel. (B) At chapter seams the
camera pulls out of the glass to the device floating in Ember Rift's space, and objects lift off the screen to carry
into the next shot. (C) Mechanism beats (promise, preserved) push through the screen into the isometric machine, where
the server build is one object we follow. If the owner picks one direction only: A makes every seam a dial-up or CRT
transition; B keeps footage on the device more often; C stays limited to the two mechanism beats.

## 3. Narration (verbatim; eleven_v4 via Text to Dialogue, one voice; start/end are targets until Scribe timings land)
| # | Start–end | Line | Lands on |
|---|---|---|---|
| V01 | 0:04.0–0:09.0 | When a publisher turns off its servers, the game you paid for goes with it. | "goes with it" → quotes grey out |
| V02 | 0:12.6–0:15.6 | Last Save is a licence that outlives its publisher. | "outlives" → title bands sweep |
| V03 | 0:16.4–0:27.2 | In June, Europe chose not to make it law, and asked the industry for an end-of-life code instead. Last Save is that promise, enforced by code, with a refund already locked in. | "law" card 1, "code instead" card 2, "refund" card 3 |
| V04 | 0:29.6–0:39.8 | Each licence is an NFT on NEAR. The studio earns a royalty on every resale, and forty percent of every sale is locked, by contract, for the day the studio leaves. | "forty percent" → gold segments fill |
| V05 | 0:40.4–0:55.6 | So the server build is encrypted, stored in two places and logged publicly before launch. Its key sits in an enclave that only this contract, running this exact program, can open. No single party can take it back. Not the studio, and not us. | "encrypted" scramble, "two places" split, "logged" ribbon, "enclave" key drop, "not us" 0 keys |
| V06 | 0:56.2–1:05.8 | And you don't have to trust us on that. Anyone can try to release it early, fake a shutdown or drain the pool, and the contract refuses every attempt. | "refuses" → 4th refusal |
| V07 | 1:06.2–1:15.8 | Any studio can do the same. The licence code lives on NEAR as one global contract, and a new game launches in a single transaction, born with no keys. | "single transaction" tx, "no keys" 0 |
| — | 1:16.0–1:26.0 | (no VO: the live match, game SFX and music lift) | |
| V08 | 1:27.0–1:42.0 | Then the studio goes dark. Its servers stop, and its download link disappears with them. The studio's word can't keep a game alive here, only players actually being served can, so when the checks fail three times, the contract marks it dead. | "dark" kill cmd, "disappears" 404, "three times" 3/3, "dead" flatline |
| — | 1:42.0–1:44.0 | (silence: flatline tone fades to nothing) | |
| V09 | 1:44.6–1:48.3 | The enclave confirms the studio is gone, and releases the server. | "releases" → gold |
| V10 | 1:50.4–1:57.1 | Every holder decides, without paying gas: take their share back, or keep the game alive. New players fund it too. | "share back" refund, "alive" pledge, "too" post-death buy |
| V11 | 1:58.3–2:03.0 | Now the build is public for good, on Walrus and on the Internet Archive. | "Walrus", "Internet Archive" flashes |
| V12 | 2:03.8–2:13.8 | A fan clicks one button or runs one command. It fetches the archived copy, checks it against the hash and the build record from day one, and restores everyone's progress. | "hash" ✓, "build record" ✓, "progress" restored |
| V13 | 2:15.6–2:22.4 | Same players. Same progress. The host is paid per real player session — signed by the players themselves. | "themselves" → 4 sessions verified |
| V14 | 2:23.3–2:30.0 | Hosts can even be paid on Base. NEAR's MPC network signs for the contract, so no one holds that key. | "signs" → Signed by MPC |
| V15 | 2:30.8–2:37.1 | Every claim in this film is one command away. Run verify, and it checks each one against the chain. | "verify" → ✓ rows |
| V16 | 2:40.0–2:42.0 | Last Save. Built on NEAR. | end card |
Wording note: V02, V13 and V16 follow the approved v3 story; demo/narration.json still holds the older v2 text.
narration.json is updated to v3 before recording.

## 4. Shot list (30 fps; total 4980 f = 2:46; footage slots in FOOTAGE.md)
| Scene | Frames | On screen | Camera | Carries out → in | Type / colour | Kind |
|---|---|---|---|---|---|---|
| S01 Open | 0–270 | Three sourced quotes type on in the terminal (mono 34 px, cream), source lines in faint; at "goes with it" they grey out and a gold caret is left | locked inside the screen, +2 % push | caret █ → power-on dot | Plex Mono; cream → faint | MG |
| S02 Title | 270–480 | CRT power-on → Ember Rift key art slow drift → boot log prints 6 lines → LAST SAVE display (sunset bands) + "A game licence that outlives its publisher" | pull back from the glass to the full bezel at f420 | display title → status bar text | Archivo 220 px sunset | MG + art |
| S03 Why | 480–870 | Three EC quotes, one at a time, in bracket boxes; source "European Commission, IP/26/1369, 16 June 2026"; each scrolls up (teleprompter) as the next prints | inside the screen, slow push | "refund" highlight → dial-up box | Chakra labels, Plex body, gold highlight | MG |
| S04 Buy | 870–1200 | dial-up → `store` take (BUY, sign) → `library` → `x-buy` flash 1 s; the licence card lifts off the glass (frame B) | inside → pull out to the device at 3/4 → licence lifts toward camera | licence key-art thumbnail → server cartridge | take + lift card | footage + B |
| S05 Promise | 1200–1680 | Machine: the server build cartridge encrypts (glyph scramble + padlock), splits to STUDIO CDN and WALRUS plinths, Sigstore ribbon prints, the key drops into the OutLayer enclave, two lock tags, then the contract block shows "0 access keys" and `x-keys` flashes 1 s | push through the screen into the isometric world, track the cartridge left → right, rise to the enclave | contract block → screen glow | sunset faces, cyan enclave, gold key | MG (C) + flash |
| S06 Try to kill | 1680–1980 | `attack` take: 4 attempts each refused (red line), `x-attack` flash | pull back out of the machine into the screen | 4th red line → channel roll | dead red on ink | footage |
| S07 Any studio | 1980–2280 | `t-factory` terminal, then `x-factory` flash: same code hash, 0 keys | vertical roll channel change | key art in the device glass → arena | Plex terminal palette | footage |
| S08 Match | 2280–2580 | `match` take: 4 players, hits, levels, Emberwing, "Official server" chip | pull out to the device, push into the arena (key art → game), then full-frame | the match window → kill | game art | footage |
| S09 Kill | 2580–3120 | `t-kill` window opens over the match → `t-404` → `lost` CONNECTION LOST → CRT collapse to a line (frame A) → line becomes the red flatline → `probes` 1/3 2/3 3/3 print → GONE DARK + dead sun → `discord` alert slides in; 3060–3120 silence and hold | inside the screen; status bar flips red at the collapse | flatline → gold decode string | dead tone (red bands) | footage + MG |
| S10 Release | 3120–3300 | hard cut to gold: `release` take, key decodes char by char, `x-release` flash, status RELEASED | inside, push on the key | decoded key → 4 choice rows | gold tone | footage |
| S11 Choose | 3300–3540 | `refund`, `refund2`, `pledge`, `pledge2`, `postbuy`: 4 holders in a 2×2 grid of mini screens, then the pool total | device grid (four terminals), pull to one | pool total → released cartridge | refund cyan, pledge gold | footage (B grid) |
| S12 Preserved | 3540–3705 | Machine again: the cartridge, now gold and unlocked, sits on WALRUS and INTERNET ARCHIVE plinths with the same hash as the chain; `x-archive` and `x-walrus2` flash | push into the machine, orbit 20° | Walrus copy → the fan's terminal | gold, mono hashes | MG (C) + flash |
| S13 Fan hosts | 3705–4050 | `hostbtn` (one click) then `t-host` lines with ✓ marks lifted to 1.4× as they land | inside the screen; split 50/50 at f3830 | host URL line → game client | terminal palette, alive green ✓ | footage |
| S14 Back in | 4050–4290 | `back` sign-in → same level/skin → match resumes; `bounce`; `epoch` 4 sessions verified, host paid | dial-up into the community host, full-frame game | the paid amount → Base row | game art, alive green | footage |
| S15 Base | 4290–4515 | `base` Sign → Signed by MPC → Relay; `x-base` Basescan flash | inside the screen; push on the signed readout | Basescan tx line → terminal | readout prints | footage |
| S16 Verify | 4515–4740 | `t-verify` ✓ table scrolls; card "real vs rehearsed" from the README | inside, slow scroll | last ✓ → pull-back | terminal palette | footage |
| S17 Close | 4740–4980 | pull all the way out to LS-0001 in space over Ember Rift; display "We killed our server. You still have the game."; NEAR, NEP-171/199/297, OutLayer, Chain Signatures, global contracts, NEP-366, Walrus, Sigstore; repo + live URL | long pull-back + slow orbit, settles at f4890 | — | sunset display, label row | MG (B) |

## 5. Transitions (every seam; app motion values from docs/REFERENCE-MOTION.md)
| Seam | Start pose | Intermediate | End pose | Easing, duration |
|---|---|---|---|---|
| S01→02 | gold caret █ alone | caret expands to a 1-px horizontal line, then the line opens vertically (CRT power-on) | key art fills the screen | ease-out (0.23,1,0.32,1), 14 f |
| S02→03 | LAST SAVE title, full bezel | camera pushes into the screen; the title slides up and out (teleprompter) | first EC box printing | ease-out, 20 f |
| S03→04 | "refund" highlighted in gold | screen clears; dial-up box types `$ ls-0001 open /app/store` + receive bar steps(8) | store take | 720 ms dial-up (22 f), then a 380 ms load bar |
| S04 lift | store take full-frame | camera pulls back to the device at 3/4 (rotateY -16°); the licence card lifts on z and turns to face the camera | card centred, device dimmed | ease-out, pull 24 f, lift 45 f |
| S04→05 | licence card | the key-art thumbnail slides into a cartridge slot and the card dissolves along its bands; camera passes through the glass | cartridge on the isometric floor | ease-in-out, 24 f |
| S05→06 | contract block "0 keys" | camera rises and pulls back; the floor becomes the screen | `/attack` printing | ease-out, 20 f |
| S06→07, S16 | last red line | vertical roll (the screen content slides up one full height with a 6-px roll band) | terminal take | 10 f, linear with stepped(5) |
| S07→08 | explorer flash | pull out to the device; the screen's key art scales up past the bezel into the arena | match full-frame | ease-in-out, 30 f |
| S09 kill | match full-frame | terminal window opens (dial-up box) over the match → CRT collapse (scaleY 1→0.006, 10 f, ease-in cubic) + bloom → line stretches and turns red (10 f) → line drops to the flatline (16 f) | GONE DARK prints (steps(5), 400 ms) | as frame A |
| S09→10 | dead red screen, silence | hard cut on the VO word "enclave" | gold release take | cut |
| S10→11 | decoded key string | the string splits into 4 rows that fly to 4 mini terminals | 2×2 grid of takes | ease-out, 24 f, 3-f stagger |
| S11→12 | pool total | camera through the glass into the machine | gold cartridge on plinths | ease-in-out, 24 f |
| S12→13 | Walrus plinth | the copy rises and enters the terminal window as the download line | `t-host` running | ease-out, 18 f |
| S13→14 | host URL line | dial-up into the URL | community game sign-in | 22 f |
| S14→15 | "host paid" amount | the amount lifts and lands on the Base payout row | hosts page | ease-out, 18 f |
| S15→16 | Basescan line | vertical roll | `pnpm verify` | 10 f |
| S16→17 | last ✓ row | long pull-back through the bezel to the device in space | close lock-up | ease-in-out, 60 f |
Explorer flashes: a 1-s window opens with the dial-up box (no URL bar), slightly rotated forward on z (B), then closes with the CRT collapse at 0.5 speed.

## 6. Music and SFX
Music: Eleven Music `music_v2_5` (id to be confirmed against /v1/models before calling), instrumental, one 2:46
composition plan timed to the film. Candidates, each an auditioned 30-s sketch, with the runners-up kept on disk:
(1) warm retro-synth underscore at 84 BPM: analog pads, soft arpeggio, tape hiss, no drums until 0:40;
(2) minimal electronic at 90 BPM: Rhodes, sub pulse, light glitch percussion;
(3) dark synthwave at 80 BPM: slow pulse, gated pads, a hopeful major-key lift in the second half.
Leaning (1): it sits under speech, and its arpeggio can step with the terminal's stepped motion.
Shape: enter at 0:02, swell at the title (0:12), duck to −20 dB under VO, lift at the match (1:16–1:26), thin out on
"goes dark", **hard stop at 1:41.5** on the flatline, silence 1:42–1:44, return in a major key on "releases" (1:47),
swell at "Same players" (2:15), resolve on the end card (2:44), tail to 2:46.
SFX: action-specific, never a repeated whoosh. Source per cue: D = the owner's Drive SFX library copies, E = ElevenLabs
`eleven_text_to_sound_v3` (id confirmed before calling; loop=true only for beds).
| t | Action | Sound | Src |
|---|---|---|---|
| 0:00–0:08 | quotes type | keyboard-typing-5997 (low, 3 bursts) | D |
| 0:09.1 | CRT power-on | tube whine + static thump | E |
| 0:13–0:15 | boot lines | tick.wav, one per line, pitch-varied | D |
| 0:29.0 | dial-up | short 1200-baud modem chirp, 0.6 s | E |
| 0:32 | BUY keycap | keyboard-press | D |
| 0:35 | licence minted | cash-ting | D |
| 0:41 | encrypt scramble | display-digits-3 | D |
| 0:45 | copies land | two soft heavy metal thunks, panned L/R | E |
| 0:50 | key into enclave | vault lock engaging, deep clunk | E |
| 0:58–1:04 | 4 refusals | retro terminal deny buzz, 2 variants alternated | E |
| 1:09 | factory tx | keyboard-press + quick-win | D |
| 1:16–1:26 | match | hover-skiff dash, shard pickup, impact hit-stop (3 cues) | E |
| 1:27 | kill command | keyboard-press (Enter) | D |
| 1:30 | 404 | glitch-sound-effect | D |
| 1:32 | CRT collapse | CRT switching off: electrical pop + falling whine | E |
| 1:34–1:38 | probes FAILED | low error blip ×3, rising pitch | E |
| 1:40 | flatline | ECG flatline tone, 3 s, fades by 1:44 | E |
| 1:41 | Discord alert | muted notification ping | E |
| 1:44.6 | decode | data chatter resolving into a bright chime | E |
| 1:47 | RELEASED | warm resonant unlock swell | E |
| 1:51 / 1:53 | refund / pledge | coin return clink / coin into a jar | E |
| 1:59 | archived ✓ | stamp.wav | D |
| 2:06–2:12 | host ✓ rows | tick.wav pitch-varied; "restored" quick-win | D |
| 2:15 | reconnect | rising digital lobby chime | E |
| 2:20 | bounce | soft denied thud | E |
| 2:23 | host paid | coins counted (not cash-ting) | E |
| 2:26 | Signed by MPC | short radio transmission burst | E |
| 2:31–2:36 | verify ✓ rows | tick.wav soft rhythm | D |
| 2:41 | end lock-up | deep soft impact with shimmer | E |
Mix: VO on top; music ducked 10–12 dB under VO; master −14 LUFS integrated, true peak ≤ −1 dBTP.

## 7. Tokens and assets
Tokens: `src/ds/tokens.ts` mirrors web/src/styles.css (void #0a0814, ink #120e22, bezel #1b1630, text #efe5d0,
ember #ff6b2b, gold #ffc94a, magenta #e8407e, violet #9b4fe0, cyan #4fd8d0, alive #45e394, dead #ff4d5e). Faces:
Archivo (wdth 125, 800–900), Chakra Petch 500–700, IBM Plex Mono 400–600 (OFL, latin woff2 in public/fonts). Radii:
bezel 20, screen 14, card 6, keycap 5 (× scale k). Motion: decode 25 ms per char, print-in steps(5) 400 ms with a 55 ms
stagger, dial-up 720 ms, load bar steps(8) 380 ms, roll 2400 ms, keycap press 3 px in 60 ms, release decode 18 ms per char.
Assets: Ember Rift key art (web/public/art, ChatGPT image, prompt by Opus; SOURCES.md), NEAR and OutLayer marks
(public/brand), EC press release IP/26/1369 text (SOURCES.md), quotes (SOURCES.md), SFX per the table, VO and music
per AUDIO.md (updated with the v4 model ids).

## 8. Risks and build order
Risks: v2 takes land late (21:00–22:30), so every slot has a placeholder and the swap is a file drop; v4 pacing differs
from the estimates, so timeline.ts is driven by Scribe word times; CSS 3D cost on m2worker (8 GB), so scenes render as
segments; the bundled headless shell is broken locally, so local stills use installed Chrome; every on-screen number
is traced to the README, proof/ or a tx.
Order: (1) narration v3 → eleven_v4 dialogue → Scribe timings → timeline.ts; (2) one Opus sub-agent per scene group
(S01–03, S04–05, S06–08, S09–10, S11–13, S14–17), each a registered composition that renders alone; (3) music sketches
and SFX in parallel; (4) full-length v1 on m2worker by 20:30; (5) v2 with the real takes by 23:30; (6) X cut
(drop S06, S07 and S12, trim S08 to 6 s, ≈2:16) and the 45 s vertical (S09 → S10 → S13 → S14, captions) by 01:30.
