# Film sources and provenance (14 Nov)

On-screen quotes and the EU press release: see `demo/SOURCES.md` (verified verbatim). Product footage: the v2 judge run
on `ember-rift.lastsave-factory.testnet` (takes listed in FOOTAGE.md). Placeholders are never in the final film.

## Audio (all ElevenLabs, model ids verified by calling them on 14 Nov; this key cannot list /v1/models)
| Asset | Model id | Endpoint | Details |
|---|---|---|---|
| Narration V01–V16, `public/vo/v4/` | `eleven_v4` | POST /v1/text-to-dialogue/with-timestamps | voice "Evan - Calm, Grounded & Reflective" (TWutjvRaJqAX89preB4e); stability 0.5, similarity 0.8; previous_text/future_text from the neighbouring lines (context stitching); one audio tag per line; words exactly as approved (vo/narration-v3.json); V08 re-recorded 14 Nov 23:0x IST with the approved correction ("so when they report it down": the judge instance died by holder report quorum), same voice, settings and seed 1407, scribe_v3 match; V11 and V12 re-recorded 15 Nov ~00:05 IST with approved new lines (V11 "already stored for good … waiting for its key"; V12 "A fan runs one command. It fetches a public copy, checks it against the hash from day one …"), plus the approved "clicks one button or" variant of V12 in vo/variants/ (used only if a real one-click deploy take lands), same settings, scribe_v3 match |
| Word timings, `vo/timings/` | `scribe_v3` | POST /v1/speech-to-text | word-level timestamps; every line's transcript matches the script (spelling variants only) |
| Score (picked 14 Nov: candidate 3), `public/music/v1/c3-act1.mp3`, `c3-act2.mp3` (full film and vertical), `c3-act1x.mp3`, `c3-act2x.mp3` (X cut) | `music_v2_5` | POST /v1/music (chunk composition plan, seed 10) | instrumental, dark synthwave at 80 BPM, E minor → E major; act 1 101.6 s, act 2 62.4 s; X acts 75.8 s (5.4-s cold open) and 56.9 s; scribe_v3 hears no words in the X acts; runners-up c1 (warm retro synth, 84 BPM, used in v1) and c2 (minimal electronic, 90 BPM) kept |
| SFX marked E in `public/sfx/v1/sfx-provenance.json` | `eleven_text_to_sound_v3` | POST /v1/sound-generation | one prompt per action, listed in the provenance file |
| SFX marked D | — | — | copies from the owner's Drive SFX library (typing, key, tick, cash, digits, win, glitch, stamp) |
| EU card backdrops `public/plates/eu/{law,ask,refund}` | GPT Image (OpenAI image generation) via the Codex CLI on the ChatGPT subscription login (no API key) | 15 Nov 2026, 02:35–02:41 IST | law: parliament hemicycle as concentric dotted arcs (ember, violet); ask: overlapping illegible draft-text sheets with redlines and a clause tree (gold, violet); refund: institutional-quarter skyline in ember line art under a faint twelve-point night sky | AI-generated texture, no official emblem; used at low opacity behind S03's cards |

Script: `scripts/vo.mjs` (narration and Scribe check), `scripts/music.mjs` (score), `scripts/sfx.mjs` (effects).

## Fonts and images
Archivo, Chakra Petch and IBM Plex Mono (SIL OFL, Google Fonts; latin woff2 in `public/fonts/`). Ember Rift key art:
see `demo/SOURCES.md`. NEAR and OutLayer marks: `public/brand/` (official files, as on the site).
