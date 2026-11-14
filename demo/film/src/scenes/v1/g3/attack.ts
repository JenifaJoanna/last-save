// S06 cut sheet for the `attack` take (/attack, full 1920x1080 page). The judge-run take (shot while ONLINE) runs all
// five attacks, each refused by the contract (coordinator, 14 Nov):
//   1 release          "The game is still alive"            4 set_payout_evm   "Register as a host first"
//   2 report_down      "Only the licence holder can report"  5 sign_evm_payout  "No such payout"
//   3 claim_epoch      "Register as a host first"
// Beats: "release it early" → 1, "fake a shutdown" → 2, "drain the pool" → 3, "refuses every attempt" → 4 and 5
// together. Each beat is one take segment cut so its last "> REFUSED" line prints on the word; its red line(s) lift
// 1.3x as a frozen crop of the take itself, so the text on screen is always the contract's own (nothing is redrawn).
// `ref` = take second when the beat's last red line has fully printed; `y` = top of each red line at `ref` (take px;
// 12 px Plex, 24 px rows; the log autoscrolls). TUNE `ref` / `y` WHEN THE JUDGE TAKE LANDS (raw/attack.mp4).
// Preview values (preview/attack.mp4, v2dev, attacks 1-3 only) measured 14 Nov 15:45: red at 8.1 s (y 544),
// 15.4 s (688), 23.4 s (724); line top = red - 7; +0.6 s for the step-in. Beat 4+5 values are estimates.
import { beat } from "./motion";

export interface Row { n: number; title: string; y: number }
export interface Hit { cue: number; word: string; ref: number; rows: Row[] }

/** Titles are the app's own (web/src/pages/Attack.tsx ATTACKS). */
export const ATTACKS = ["Release the key early", "Fake a death report", "Drain the hosting pool", "Redirect a host's payout", "Double-pay a host"];
export const TOTAL_ATTACKS = ATTACKS.length;
const row = (n: number, y: number): Row => ({ n, title: ATTACKS[n - 1], y });

/** V06 word starts (vo/timings/V06.json): release 3.10, fake 4.32, drain 5.40, refuses 7.26. Beats land 2 f early. */
export const HITS: Hit[] = [
  { word: "release it early", cue: beat("S06", 3.1) - 2, ref: 8.7, rows: [row(1, 537)] },
  { word: "fake a shutdown", cue: beat("S06", 4.32) - 2, ref: 16.0, rows: [row(2, 681)] },
  { word: "drain the pool", cue: beat("S06", 5.4) - 2, ref: 24.1, rows: [row(3, 717)] },
  { word: "refuses every attempt", cue: beat("S06", 7.26) - 2, ref: 40.0, rows: [row(4, 573), row(5, 693)] },
];

/** Length (s) of the take on disk. A beat whose `ref` is past it (the preview has attacks 1-3 only) shows labels only. */
export const TAKE_LEN = 26.1;

/** The log panel's text column in take px (Attack.tsx: right grid column, p-4); the crop fits the longest result. */
export const LOG = { x: 946, w: 440, row: 24 } as const;
/** Lead before each refusal (frames): "$ attacker → …", "sent … tx" and "waiting for the contract…" on screen. */
export const LEAD = 24;

/** Where lifted lines park (take px): the empty left column under the attack menu; a second row stacks below. */
export const TRAY = { x: 384, y: 790, pitch: 66 } as const;
export const LIFT = 1.3;

/** Camera over the screen while the attacks run: 1.5x frames take x 320-1600, y 240-960 (menu + log + tray). */
export const PUSH = { scale: 1.5, fx: 960, fy: 720 } as const;
