// S06 cut sheet and key lines for the `attack` take (raw/attack.mp4, 1920x1080 @1x, 47.4 s: /attack on the
// production build while ember-rift is ONLINE; five real hostile txs, each refused by the contract). The refusal
// strings are the contract's actual results on the fresh instance (coordinator, 14 Nov 21:30; checked in the take).
// Beats: "release it early" → 1, "fake a shutdown" → 2, "drain the pool" → 3, "refuses every attempt" → 4 + 5.
// Each beat is one take segment, cut between attacks (never sped up), so the beat's last "> REFUSED" line prints on
// the word; that refusal lifts off the glass as 56 px film type into a stacked list.
// Measured on raw/attack.mp4 (red-pixel scan at 10 fps + frame crops): red lines first show at 9.9 s (#1, y 546),
// 19.2 s (#2, y 714), 27.1 s (#3, y 726), 36.0 s (#4), 45.0 s (#5, y 702; #4 then at y 582); y = line centre.
// `ref` = print time + 0.4 s (step-in done); `logY` = line top (centre - 12) at the beat's `ref`.
import { beat } from "./motion";

export interface Refusal { n: number; method: string; text: string; logY: number }
export interface Hit { cue: number; word: string; ref: number; rows: Refusal[] }

/** The five attacks: the method the take's "$ attacker → …" line calls, and the contract's refusal, verbatim. */
export const REFUSALS: Refusal[] = [
  { n: 1, method: "release", text: "The game is still alive", logY: 534 },
  { n: 2, method: "report_down", text: "No such licence", logY: 702 },
  { n: 3, method: "claim_epoch", text: "Key is not released yet", logY: 714 },
  { n: 4, method: "set_payout_evm", text: "Register as a host first", logY: 570 },
  { n: 5, method: "sign_evm_payout", text: "No such payout", logY: 690 },
];

/** V06 word starts (vo/timings/V06.json): release 3.10, fake 4.32, drain 5.40, refuses 7.26. Beats land 2 f early. */
export const HITS: Hit[] = [
  { word: "release it early", cue: beat("S06", 3.1) - 2, ref: 10.3, rows: [REFUSALS[0]] },
  { word: "fake a shutdown", cue: beat("S06", 4.32) - 2, ref: 19.6, rows: [REFUSALS[1]] },
  { word: "drain the pool", cue: beat("S06", 5.4) - 2, ref: 27.5, rows: [REFUSALS[2]] },
  { word: "refuses every attempt", cue: beat("S06", 7.26) - 2, ref: 45.4, rows: [REFUSALS[3], REFUSALS[4]] },
];

/** Length (s) of the take on disk; segment cuts are clamped inside it (the last beat's segment ends at the take's end). */
export const TAKE_LEN = 47.37;
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
