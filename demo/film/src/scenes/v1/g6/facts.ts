// Every number S15–S17 draw, in one place. Run values come from film/run-facts.json (scripts/facts.mjs reads them from
// the run's proof files); the judge-run takes (`epoch`, `base`, `x-base`, `t-verify`) must show the same values.
import { rn, rs } from "../../../film/run";

/** Base Sepolia payout #0 of the run (run proof, evm-payout phase; payer from the launch proof's instance step).
 * `near` equals the amount S14 lifts (g5/facts.ts CLAIM.paid); scripts/facts.mjs checks that. */
export const PAYOUT = {
  instance: rs("instance"),
  payer: rs("payoutPayer"),
  to: rs("payoutTo"),
  toShort: rs("payoutToShort"),
  value: rs("payoutValue"),
  near: rs("payoutNear"),
  epoch: rn("payoutEpoch"),
  sessions: rn("payoutSessions"),
  nonce: rn("payoutNonce"),
  tx: rs("basePayoutTx"),
  block: rs("basePayoutBlock"),
} as const;

/** The instance the S16 terminal shows (the verify JSON's instance id). */
export const VERIFY_INSTANCE = rs("verifyInstance");

/** Seam with S14's last frame, measured on its render at f251: the lifted "Host paid 0.04 Ⓝ" amount's centre and
 * on-screen font size (EpochChip Mono 96 px at its 1.16 lift scale), the box hidden in the frozen S14 layer while the
 * amount flies to the Base row, and the chip's box (with its glow) that collapses away. Re-measure if S14's chip moves. */
export const S14_SEAM = { frame: 251, amount: { x: 940, y: 613, px: 111 }, hole: { x: 700, y: 545, w: 480, h: 135 },
  chip: { x: 205, y: 335, w: 1510, h: 390 }, rack: { blur: 3, brightness: 0.45 },
  fix: { scale: 1.005, ox: 956, oy: 527 } } as const; // measured: the frozen chip renders 0.5 % small; scaled back

/** The Basescan result line for the payout tx (x-base): Basescan prints "Status:" then "Success"; the run proof's
 * receipt assertion must have passed for the value to exist. */
export const BASESCAN_STATUS = { label: "Status:", value: rs("baseStatus") } as const;

/** The summary line that ends `pnpm verify` (scripts/verify/render.mjs format), computed from the verify JSON's counts. */
export const VERIFY_SUMMARY = { head: rs("verifyHead"), counts: rs("verifySummary") } as const;

/** Lifted film type (legibility pass): centre (frame px, 1920×1080) and font size of each key line, ≥ 56 px. Retune
 * these numbers only when the takes land. */
export const LIFT = {
  signed: { x: 960, y: 250, size: 72 }, // S15 "Signed by MPC"
  status: { x: 960, y: 455, size: 68 }, // S15 Basescan "Status: Success" (inside the flash window)
  cmd: { x: 1330, y: 190, size: 64 }, // S16 "$ pnpm verify"
  summary: { x: 960, y: 540, size: 64 }, // S16 → S17 summary line (head 64 px, counts 56 px)
} as const;
/** Texture for everything behind a lifted line: opacity and blur (px) at full strength. */
export const TEXTURE = { opacity: 0.4, blur: 3 } as const;
