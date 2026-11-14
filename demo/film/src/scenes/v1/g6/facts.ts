// Every number S15–S17 draw, in one place. Values come from film/run-facts-after.json (the afterlife instance's real run, read by
// scripts/facts.mjs --set after from its proof files); the takes (`epoch`, `base`, `x-base`, `t-verify`) must show the same values.
import { ra, ran } from "../../../film/run";

/** Base Sepolia payout #0 of the run (run proof, evm-payout phase; payer from the launch proof's instance step).
 * `near` equals the amount S14 lifts (g5/facts.ts CLAIM.paid); scripts/facts.mjs checks that. */
export const PAYOUT = {
  instance: ra("instance"),
  payer: ra("payoutPayer"),
  to: ra("payoutTo"),
  toShort: ra("payoutToShort"),
  value: ra("payoutValue"),
  near: ra("payoutNear"),
  epoch: ran("payoutEpoch"),
  sessions: ran("payoutSessions"),
  nonce: ran("payoutNonce"),
  tx: ra("basePayoutTx"),
  block: ra("basePayoutBlock"),
} as const;

/** The instance the S16 terminal shows (the verify JSON's instance id). */
export const VERIFY_INSTANCE = ra("verifyInstance");

/** Seam with S14's last frame, measured on its render at f251: the lifted "Host paid 0.04 Ⓝ" amount's centre and
 * on-screen font size (EpochChip Mono 96 px at its 1.16 lift scale), the box hidden in the frozen S14 layer while the
 * amount flies to the Base row, and the chip's box (with its glow) that collapses away. Re-measure if S14's chip moves. */
export const S14_SEAM = { frame: 251, amount: { x: 810, y: 611, px: 111 }, // the host's total "0.08 Ⓝ" (not flown)
  chip: { x: 520, y: 335, w: 878, h: 390 }, rack: { blur: 3, brightness: 0.45 }, // chip 531/345/856×368 plus its glow
  fix: { scale: 1.005, ox: 956, oy: 527 } } as const; // measured: the frozen chip renders 0.5 % small; scaled back

/** The Basescan result line for the payout tx (x-base): Basescan prints "Status:" then "Success"; the run proof's
 * receipt assertion must have passed for the value to exist. */
export const BASESCAN_STATUS = { label: "Status:", value: ra("baseStatus") } as const;

/** The summary line that ends `pnpm verify` (scripts/verify/render.mjs format), computed from the verify JSON's counts. */
export const VERIFY_SUMMARY = { head: ra("verifyHead"), counts: ra("verifySummary") } as const;

/** Lifted film type (legibility pass): centre (frame px, 1920×1080) and font size of each key line, ≥ 56 px. Retune
 * these numbers only when the takes land. */
export const LIFT = {
  epoch: { x: 960, y: 300, size: 60 }, // S15 bridge "Epoch 11 · 4 sessions · 0.04 Ⓝ"
  signed: { x: 960, y: 250, size: 72 }, // S15 "Signed by MPC"
  status: { x: 960, y: 455, size: 68 }, // S15 Basescan "Status: Success" (inside the flash window)
  cmd: { x: 1330, y: 190, size: 64 }, // S16 "$ pnpm verify"
  summary: { x: 960, y: 540, size: 58 }, // S16 → S17 verdict + summed counts, both 58 px
} as const;
/** Texture for everything behind a lifted line: opacity and blur (px) at full strength. */
export const TEXTURE = { opacity: 0.4, blur: 3 } as const;

/** The command the t-verify take runs (its .cast: `pnpm -s verify --all`, three instances in turn). */
export const VERIFY_CMD = "pnpm -s verify --all";
/** proof/verify-all.json holds 3 reports (ember-rift, v2dev, lastsave-licence), each "ALL CHECKS THAT RAN HELD". The
 * lifted line's counts are ra("verifySummary"), which must be the merged sum once facts.mjs reads verify-all. */
export const VERIFY_ALL = { instances: 3 } as const;
const failsIn = (s: string) => (/(\d+)\s*✗/.exec(s)?.[1] ?? "?");
/** S16's final key line: the run's verdict across every instance, then the summed counts. */
export const VERIFY_LIFT = {
  head: `${VERIFY_ALL.instances} instances · every check that ran held · ${failsIn(ra("verifySummary"))} ✗`,
  // counts only: the elapsed time is per run (verify-all.json and the take are separate runs), the counts match
  counts: ra("verifySummary").replace(/\s*·\s*[\d.]+\s*s\s*$/, ""),
} as const;

/** Take timing and framing (seconds into the take; crops are fractions of the 1920×1080 take frame, measured on the
 * 14 Nov renders: text column x 252–1665, rows from y 135). */
export const TAKES = {
  verify: { idle: 0.5, cmdAt: 0.86, dumpFrom: 3.8, end: 8.1,
    cropTop: { x: 230 / 1920, y: 110 / 1080, w: 1460 / 1920, h: 675 / 1080 }, // command at the top
    cropEnd: { x: 230 / 1920, y: 330 / 1080, w: 1460 / 1920, h: 675 / 1080 } }, // the dump's last screen (summary + prompt)
  xbase: { from: 1.25, crop: { x: 230 / 1920, y: 120 / 1080, w: 1460 / 1920, h: 589 / 1080 } }, // receipt JSON incl. "status": "0x1"
} as const;

/** The `base` take (raw/base.mp4, 1920×1080 at 1×, 6.8 s, v2dev's completed Base row), measured on its frame at 6 s.
 * Frame px of the take; its content rect starts at (21, 102) like ScreenFrame. Cameras are S15's keys for the take. */
export const BASE_TAKE = {
  end: 6.7, // seconds; the take is held on its last frame after this
  chip: { x: 718, y: 817 }, // "SIGNED BY MPC" chip centre in the EPOCH 11 row
  row: { x: 683, y: 830 }, // EPOCH 11 row centre (the bridge line lifts from here)
  cam: { row: { s: 1.55, fx: 690, fy: 680 }, read: { s: 1.75, fx: 650, fy: 661 }, end: { s: 1.8, fx: 640, fy: 668 } },
} as const;
/** The x-base receipt line `"status": "0x1"` in the take frame (lifted "Status: Success" rises from there). */
export const XBASE_STATUS_AT = { x: 390, y: 445 } as const;
