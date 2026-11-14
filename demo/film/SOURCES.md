# Film sources and provenance (14 Nov)

On-screen quotes and the EU press release: see `demo/SOURCES.md` (verified verbatim). Product footage: the v2 judge run
on `ember-rift.lastsave-factory.testnet` (takes listed in FOOTAGE.md). Placeholders are never in the final film.

## Audio (all ElevenLabs, model ids verified by calling them on 14 Nov; this key cannot list /v1/models)
| Asset | Model id | Endpoint | Details |
|---|---|---|---|
| Narration V01–V16, `public/vo/v4/` | `eleven_v4` | POST /v1/text-to-dialogue/with-timestamps | voice "Evan - Calm, Grounded & Reflective" (TWutjvRaJqAX89preB4e); stability 0.5, similarity 0.8; previous_text/future_text from the neighbouring lines (context stitching); one audio tag per line; words exactly as approved (vo/narration-v3.json) |
| Word timings, `vo/timings/` | `scribe_v3` | POST /v1/speech-to-text | word-level timestamps; every line's transcript matches the script (spelling variants only) |
| Score, `public/music/v1/c1-act1.mp3`, `c1-act2.mp3` | `music_v2_5` | POST /v1/music (chunk composition plan) | instrumental, warm retro synth at 84 BPM, D minor → D major; act 1 101.6 s, act 2 62.4 s; runners-up c2 (minimal electronic, 90 BPM) and c3 (dark synthwave, 80 BPM) kept |
| SFX marked E in `public/sfx/v1/sfx-provenance.json` | `eleven_text_to_sound_v3` | POST /v1/sound-generation | one prompt per action, listed in the provenance file |
| SFX marked D | — | — | copies from the owner's Drive SFX library (typing, key, tick, cash, digits, win, glitch, stamp) |

Script: `scripts/vo.mjs` (narration and Scribe check), `scripts/music.mjs` (score), `scripts/sfx.mjs` (effects).

## Fonts and images
Archivo, Chakra Petch and IBM Plex Mono (SIL OFL, Google Fonts; latin woff2 in `public/fonts/`). Ember Rift key art:
see `demo/SOURCES.md`. NEAR and OutLayer marks: `public/brand/` (official files, as on the site).
