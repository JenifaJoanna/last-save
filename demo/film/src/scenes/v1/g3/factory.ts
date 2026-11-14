// S07 cut sheet for the `t-factory` terminal take (the real `create_instance` on lastsave-factory.testnet for studio
// #2 "Tidebreak"). TUNE WHEN THE TAKE LANDS: `from` = take second shown at S07 f0; `tx` = take second when the tx line
// has printed and that line's top in take px (26 px rows ≈ 35 px). The line text itself always comes from the take.
import { beat } from "./motion";

export const FACTORY = {
  slot: "t-factory",
  from: 0.8,
  tx: { takeAt: 7.9, y: 285 },
  /** Lifted tx row parks here (take px): below the command's output, in the terminal's empty lower rows. */
  parkY: 760,
} as const;

/** V07 word starts (vo/timings/V07.json): single 6.84, born 8.18, no 8.72. */
export const S07_BEATS = {
  tx: beat("S07", 6.84) - 2,
  flash: beat("S07", 8.18) - 6,
  keys: beat("S07", 8.72),
};
