// Sound cue sheet. `at` is seconds from the scene start (scene given) and is anchored to narration words where noted
// (scene voAt + the word's scribe_v3 start). Files in public/sfx/v1/ (provenance: public/sfx/v1/sfx-provenance.json).
// Score: Eleven Music music_v2_5, candidate 3 (dark synthwave, 80 BPM, E minor to E major), picked 14 Nov from the score
// pick page; runners-up c1/c2 kept in public/music/v1/. Gain and ducking unchanged (the pick was heard at this mix).
import { MATCH_CUT, MATCH_FROM, MATCH_HITS } from "../scenes/v1/g3/match";
import { FULL_DROP, scene, TOTAL_FRAMES, type SceneId } from "./timeline";
import V08 from "../../vo/timings/V08.json";
import V11 from "../../vo/timings/V11.json";
import V12 from "../../vo/timings/V12.json";
import { S9_SFX } from "../scenes/v1/g4/t09";

/** Seconds into S09 where a V08 word starts (V08 plays from 0.6 s); the kill's sounds and act 1's cut follow the words. */
const V08_AT = 0.6;
const w08 = (word: string) => V08_AT + (V08.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, "") === word)?.s ?? NaN);
/** Seconds into S12 where a V11 word starts (V11 plays from 0.2 s). */
const w11 = (word: string) => 0.2 + (V11.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, "") === word)?.s ?? NaN);
/** Seconds into S13 where a V12 word starts (V12 plays from 0.3 s). */
const w12 = (word: string) => 0.3 + (V12.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, "") === word)?.s ?? NaN);
/** "dead" in S09 (act 1 cuts 0.16 s after it, in every cut). */
export const S09_DEAD = w08("dead");

export interface Cue { file: string; at: number; scene: SceneId; volume?: number; dur?: number; rate?: number; fadeOut?: number }

export const SFX: Cue[] = [
  { scene: "XO", file: "flatline.mp3", at: 0.0, volume: 0.025, dur: 2.8, fadeOut: 1.2 }, // X cold open: the dead line under the hook
  { scene: "XO", file: "impact.mp3", at: 0.14, volume: 0.42 },             // "WE KILLED OUR SERVER." prints
  { scene: "XO", file: "glitch.mp3", at: 2.8, volume: 0.35 },              // the line kicks once, the roll
  { scene: "XO", file: "unlock.mp3", at: 3.0, volume: 0.4 },               // "the game": the match, alive
  { scene: "S01", file: "typing.mp3", at: 0.2, volume: 0.3, dur: 3.2 },
  { scene: "S02", file: "crt-on.mp3", at: 0.1, volume: 0.6 },
  { scene: "S04", file: "dialup.mp3", at: 0.0, volume: 0.45 },
  { scene: "S05", file: "digits.mp3", at: 1.48, volume: 0.45 },            // "encrypted"
  { scene: "S05", file: "thunk2.mp3", at: 3.4, volume: 0.6 },              // copies land after "two places"
  { scene: "S05", file: "vault.mp3", at: 7.6, volume: 0.6 },               // key into the enclave, after "enclave"
  { scene: "S06", file: "deny-a.mp3", at: 3.86, volume: 0.5 },             // "early"
  { scene: "S06", file: "deny-b.mp3", at: 4.94, volume: 0.5 },             // "shutdown"
  { scene: "S06", file: "deny-a.mp3", at: 5.7, volume: 0.42, rate: 0.9 },  // "drain"
  { scene: "S06", file: "deny-b.mp3", at: 7.56, volume: 0.5, rate: 0.85 }, // "refuses"
  { scene: "S07", file: "key.mp3", at: 6.84, volume: 0.5 },                // "single transaction"
  { scene: "S07", file: "win.mp3", at: 9.26, volume: 0.4 },                // "no keys"
  { scene: "S08", file: "dash.mp3", at: MATCH_CUT / 30 + 0.2, volume: 0.45 },  // into the arena
  // one hit per real hit in the take (g3/match.ts, from the builder's hit log), on the same frame as the punch-in
  ...MATCH_HITS.map((h): Cue => ({ scene: "S08", file: "hit.mp3", at: MATCH_CUT / 30 + h - MATCH_FROM, volume: 0.5 })),
  { scene: "S09", file: "key.mp3", at: 1.9, volume: 0.55 },                // "goes dark": the delete command
  { scene: "S09", file: "glitch.mp3", at: S9_SFX.status530 / 30, volume: 0.45 },  // "disappears": the studio copy answers 530
  { scene: "S09", file: "crt-off.mp3", at: S9_SFX.crtOff / 30, volume: 0.6 },     // the rejoined client powers off
  { scene: "S09", file: "stamp.wav", at: w08("report"), volume: 0.5 },                  // holder report 1/2 ("report")
  { scene: "S09", file: "stamp.wav", at: w08("down"), volume: 0.5, rate: 0.92 },       // report 2/2, quorum ("down")
  { scene: "S09", file: "flatline.mp3", at: S09_DEAD, volume: 0.035, dur: 2.2, fadeOut: 1.9 }, // "dead"; the tone fades to silence (source is -4.8 LUFS)
  { scene: "S09", file: "alert.mp3", at: S09_DEAD + 0.56, volume: 0.22 },
  { scene: "S10", file: "decode.mp3", at: 3.36, volume: 0.5 },             // "releases"
  { scene: "S10", file: "unlock.mp3", at: 4.0, volume: 0.45 },
  { scene: "S11", file: "refund.mp3", at: 4.1, volume: 0.5 },              // "share back"
  { scene: "S11", file: "pledge.mp3", at: 5.72, volume: 0.5 },             // "alive"
  { scene: "S11", file: "cash.mp3", at: 7.62, volume: 0.35 },              // "too": post-shutdown buy
  { scene: "S12", file: "stamp.wav", at: w11("walrus"), volume: 0.45 },    // "Walrus"
  { scene: "S12", file: "tick.wav", at: w11("internet"), volume: 0.5 },    // "Internet Archive"
  { scene: "S13", file: "key.mp3", at: w12("command"), volume: 0.45 },     // "runs one command"
  { scene: "S13", file: "tick.wav", at: w12("hash"), volume: 0.5 },        // "hash"
  { scene: "S13", file: "tick.wav", at: w12("day"), volume: 0.5, rate: 1.15 }, // "from day one"
  { scene: "S13", file: "win.mp3", at: w12("progress"), volume: 0.4 },     // "progress"
  { scene: "S14", file: "dialup.mp3", at: 0.0, volume: 0.35, rate: 1.1 },
  { scene: "S14", file: "lobby.mp3", at: 1.0, volume: 0.45 },              // "Same players"
  { scene: "S14", file: "coins.mp3", at: 6.96, volume: 0.45 },             // "themselves": host paid
  { scene: "S15", file: "radio.mp3", at: 4.18, volume: 0.45 },             // "signs"
  { scene: "S16", file: "key.mp3", at: 3.8, volume: 0.45 },                // "verify"
  { scene: "S16", file: "tick.wav", at: 6.58, volume: 0.45 },              // "chain"
  { scene: "S17", file: "impact.mp3", at: 2.2, volume: 0.55 },             // lock-up on "Last Save"
];

/** Score in two acts. Act 1 is cut hard on the word "dead" (S09); act 2 enters under "The enclave confirms" and its
 * last chunk resolves on the final frame. Times are absolute film seconds. */
/** `offset`: seconds into the music file where playback starts (default 0). */
export interface ScoreAct { file: string; from: number; to: number; fadeIn: number; fadeOut: number; offset?: number }
export const SCORE: ScoreAct[] = [
  { file: "music/v1/c3-act1.mp3", from: 0, to: scene("S09").from / 30 + S09_DEAD + 0.16, fadeIn: 1.2, fadeOut: 0.1 },
  // act 2 enters 0.37 s into S10; without S12 the full film's S10→S17 run is the X cut's, so it takes the X-length act 2
  { file: FULL_DROP.has("S12") ? "music/v1/c3-act2x.mp3" : "music/v1/c3-act2.mp3", from: scene("S10").from / 30 + 0.37, to: TOTAL_FRAMES / 30, fadeIn: 0.6, fadeOut: 2.0 },
];
export const MUSIC = { gain: 0.24, duckUnderVo: 0.42, closeBoost: 2.4 }; // closeBoost: the resolve under the end card, after the last line
