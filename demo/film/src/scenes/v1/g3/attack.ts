// S06 cut sheet and key lines for the `attack` take (/attack, full 1920x1080 page). The judge-run take (shot while
// ONLINE) runs five attacks, each refused by the contract; result texts per FOOTAGE.md / coordinator 14 Nov.
// Beats: "release it early" → 1, "fake a shutdown" → 2, "drain the pool" → 3, "refuses every attempt" → 4 + 5.
// Each beat is one take segment cut so its last "> REFUSED" line prints on the word; that refusal then lifts off the
// glass as film type (56 px Plex Mono) into a stacked list. TUNE `ref` / `logY` WHEN THE JUDGE TAKE LANDS
// (raw/attack.mp4): `ref` = take second the beat's last red line has printed; `logY` = that line's top in take px.
// Preview (preview/attack.mp4, v2dev, attacks 1-3) measured 14 Nov 15:45: red at 8.1 s (y 544), 15.4 s (688),
// 23.4 s (724); line top = red - 7; +0.6 s for the step-in. Beat 4+5 values are estimates.
import { beat } from "./motion";

export interface Refusal { n: number; method: string; text: string; logY: number }
export interface Hit { cue: number; word: string; ref: number; rows: Refusal[] }

/** The five attacks: the method the take's "$ attacker → …" line calls, and the contract's refusal, verbatim. */
export const REFUSALS: Refusal[] = [
  { n: 1, method: "release", text: "The game is still alive", logY: 537 },
  { n: 2, method: "report_down", text: "Only the licence holder can report", logY: 681 },
  { n: 3, method: "claim_epoch", text: "Register as a host first", logY: 717 },
  { n: 4, method: "set_payout_evm", text: "Register as a host first", logY: 573 },
  { n: 5, method: "sign_evm_payout", text: "No such payout", logY: 693 },
];

/** V06 word starts (vo/timings/V06.json): release 3.10, fake 4.32, drain 5.40, refuses 7.26. Beats land 2 f early. */
export const HITS: Hit[] = [
  { word: "release it early", cue: beat("S06", 3.1) - 2, ref: 8.7, rows: [REFUSALS[0]] },
  { word: "fake a shutdown", cue: beat("S06", 4.32) - 2, ref: 16.0, rows: [REFUSALS[1]] },
  { word: "drain the pool", cue: beat("S06", 5.4) - 2, ref: 24.1, rows: [REFUSALS[2]] },
  { word: "refuses every attempt", cue: beat("S06", 7.26) - 2, ref: 40.0, rows: [REFUSALS[3], REFUSALS[4]] },
];

/** Length (s) of the take on disk; segment cuts are clamped inside it (the preview is shorter than the judge take). */
export const TAKE_LEN = 26.1;
/** Lead before each refusal (frames): "$ attacker → …", "sent … tx" and "waiting for the contract…" on screen. */
export const LEAD = 24;
/** The take's log text column (take px) where each red line prints: the lift starts there at 12 px. */
export const LOG = { x: 946, size: 12 } as const;

/** The refusal list in frame px: header baseline block, then one 56 px row per refusal. Fits 50 chars (row 2). */
export const LIST = { x: 112, headerY: 168, y0: 300, pitch: 96, size: 56 } as const;
/** Take as texture while the list is up (coordinator rule: ≤45 % opacity and/or 2-4 px blur). */
export const TEXTURE = { opacity: 0.32, blur: 4 } as const;
/** x-attack explorer flash: before the refusals, over "…trust us on that. Anyone can try" (the list holds to the roll). */
export const FLASH_AT = 60;
