// Sound cue sheet. `at` is seconds from the scene start (scene given) and is anchored to narration words where noted
// (scene voAt + the word's scribe_v3 start). Files in public/sfx/v1/ (provenance: public/sfx/v1/sfx-provenance.json).
// Score: Eleven Music music_v2_5, candidate 1 (warm retro synth, 84 BPM); runners-up c2/c3 kept in public/music/v1/.
import type { SceneId } from "./timeline";

export interface Cue { file: string; at: number; scene: SceneId; volume?: number; dur?: number; rate?: number }

export const SFX: Cue[] = [
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
  { scene: "S08", file: "dash.mp3", at: 1.5, volume: 0.5 },
  { scene: "S08", file: "shard.mp3", at: 3.2, volume: 0.45 },
  { scene: "S08", file: "hit.mp3", at: 5.0, volume: 0.5 },
  { scene: "S09", file: "key.mp3", at: 1.9, volume: 0.55 },                // "goes dark": the delete command
  { scene: "S09", file: "glitch.mp3", at: 5.04, volume: 0.45 },            // "disappears": studio copy gone
  { scene: "S09", file: "crt-off.mp3", at: 7.1, volume: 0.6 },             // CONNECTION LOST collapse
  { scene: "S09", file: "probe-fail.mp3", at: 12.88, volume: 0.5 },        // "three times"
  { scene: "S09", file: "probe-fail.mp3", at: 13.4, volume: 0.5, rate: 1.12 },
  { scene: "S09", file: "probe-fail.mp3", at: 13.92, volume: 0.5, rate: 1.25 },
  { scene: "S09", file: "flatline.mp3", at: 15.04, volume: 0.35, dur: 2.15 }, // "dead"; fades into the silence
  { scene: "S09", file: "alert.mp3", at: 15.6, volume: 0.4 },
  { scene: "S10", file: "decode.mp3", at: 3.36, volume: 0.5 },             // "releases"
  { scene: "S10", file: "unlock.mp3", at: 4.0, volume: 0.45 },
  { scene: "S11", file: "refund.mp3", at: 4.1, volume: 0.5 },              // "share back"
  { scene: "S11", file: "pledge.mp3", at: 5.72, volume: 0.5 },             // "alive"
  { scene: "S11", file: "cash.mp3", at: 7.62, volume: 0.35 },              // "too": post-shutdown buy
  { scene: "S12", file: "stamp.wav", at: 2.46, volume: 0.45 },             // "Walrus"
  { scene: "S12", file: "tick.wav", at: 4.08, volume: 0.5 },               // "Internet Archive"
  { scene: "S13", file: "key.mp3", at: 1.5, volume: 0.45 },                // "button"
  { scene: "S13", file: "tick.wav", at: 6.26, volume: 0.5 },               // "hash"
  { scene: "S13", file: "tick.wav", at: 7.16, volume: 0.5, rate: 1.15 },   // "build record"
  { scene: "S13", file: "win.mp3", at: 9.66, volume: 0.4 },                // "progress"
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
export const SCORE = [
  { file: "music/v1/c1-act1.mp3", from: 0, to: 101.2, fadeIn: 1.2, fadeOut: 0.1 },
  { file: "music/v1/c1-act2.mp3", from: 103.57, to: 166.0, fadeIn: 0.6, fadeOut: 2.0 },
];
export const MUSIC = { gain: 0.24, duckUnderVo: 0.42 };
