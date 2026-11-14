// S07 cut sheet and key lines for the `t-factory` terminal take (the real `create_instance` on lastsave-factory.testnet
// for studio #2 "Tidebreak") and the `x-factory` explorer flash. TUNE WHEN THE TAKES LAND: `from` = take second shown
// at S07 f0; `account.y` = top of the new-account line in take px (26 px rows ≈ 35 px); `account.text` must be the
// exact account the take prints (create_instance makes `<name>.lastsave-factory.testnet`; the text is the second studio's launch proof).
import { beat } from "./motion";
import { rs } from "../../../film/run";

export const FACTORY = {
  slot: "t-factory",
  from: 0.8,
  account: { text: rs("studio2Account"), y: 250 },
} as const;

/** "0 access keys": the x-factory explorer's access-key count for the new instance (FOOTAGE x-factory row). */
export const KEYS_LINE = { zero: "0", rest: " access keys" } as const;

/** V07 word starts (vo/timings/V07.json): single 6.84, born 8.18, no 8.72. Lines land 2 f early. */
export const S07_BEATS = {
  account: beat("S07", 6.84) - 2,
  flash: beat("S07", 6.84) + 14,
  keys: beat("S07", 8.18) - 2,
};

/** Key-line slots in frame px (lower third, clear of the explorer's centre; they hold over the pull-out into S08). */
export const S07_SLOTS = { account: { x: 112, y: 812 }, keys: { x: 112, y: 916 }, size: 56 } as const;
