// S07 cut sheet and key lines for the `t-factory` terminal take (raw/t-factory.mp4 + .cast, 14 Nov 21:19: the real
// `pnpm -s studio:launch tidebreak` → create_instance on lastsave-factory.testnet for studio #2, Saltglass Games).
// Take (mp4 s; the replay caps idle gaps at 3 s, the cast's real result gap is 8.0 s): command row 0 at 0.93,
// "Saltglass Games launches Tidebreak through lastsave-factory.testnet" row 1 at 3.47, the result block rows 2-8 at
// 6.47 all at once (create_instance · deposit 0.6729 NEAR · one transaction / tx URL / account Alive / code: the global
// licence contract 4Awokn… / access keys: 0 · born locked / Base payout address), held to the end (10.7 s).
// Cuts only remove or hold idle caret time, so every line prints exactly as recorded.
import { rs } from "../../../film/run";
import { beat } from "./motion";
import type { Cut } from "./TermTake";

/** V07 word starts (vo/timings/V07.json): studio 0.38, launches 6.12, single 6.84, born 8.18. */
export const S07_BEATS = {
  account: beat("S07", 6.84) - 2, // f212: the result block prints and the account line lifts on "single transaction"
  flash: beat("S07", 6.84) + 14,
  keys: beat("S07", 8.18) - 2, // f252: "access keys: 0 · born locked" lifts on "born"
};

const RESULT_AT = 6.467; // take s: the result block prints
const LAUNCH_AT = 3.467; // take s: the "… launches Tidebreak …" row prints
const LAUNCH_CUE = beat("S07", 6.12) - 4; // f189: that row prints on "launches"

export const FACTORY = {
  slot: "t-factory",
  /** Take second at S07 f0 (S06's roll lands on it: its first frames are the empty prompt). */
  from: 0,
  /** f0: the command types at f28 ("Any studio can do the same"); f60: hold the idle prompt; f120: play so row 1
   * prints on "launches"; then cut the idle wait so the result block prints on "single transaction" (f212). */
  cuts: [
    { at: 0, from: 0 },
    { at: 60, from: 2.0, hold: true },
    { at: 120, from: LAUNCH_AT - (LAUNCH_CUE - 120) / 30 },
    { at: beat("S07", 6.84) - 9, from: RESULT_AT - 7 / 30 },
  ] as Cut[],
  /** Result rows (row index on the take's grid) the key lines lift from. */
  rows: { account: 4, keys: 7 },
  /** The account exactly as the take prints it (run facts: studio2Account), then the take's status word. */
  account: { text: rs("studio2Account"), status: "Alive" },
} as const;

/** "access keys: 0 · born locked", as the take prints it (cream, then green). */
export const KEYS_LINE = { head: "access keys: 0", tail: " · born locked" } as const;

/** Key-line slots in frame px (lower third; they hold over the pull-out into S08). */
export const S07_SLOTS = { account: { x: 112, y: 812 }, keys: { x: 112, y: 916 }, size: 56 } as const;
