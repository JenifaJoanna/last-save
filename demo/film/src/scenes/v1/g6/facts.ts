// Every number S15–S17 draw, in one place. ALL VALUES HERE ARE TBD: dev-run placeholders (v2 dev instance, sources
// below). The judge-run takes (`epoch`, `base`, `x-base`, `t-verify`) set the real ones; swap them here only.

/** TBD. Base Sepolia payout #0 on the v2 dev instance (proof/v2-e2e.md §Base Sepolia payout; `pnpm verify` chainsig
 * rows). Replace with the judge run's payout. `near` must equal the amount S14 lifts (g5/facts.ts CLAIM.paid). */
export const PAYOUT = {
  instance: "v2dev.lastsave-factory.testnet",
  payer: "0xFe8A6a6a417E3CCC4D73191C62361207dfe01AEA",
  to: "0xfc2c2fe195675cc0f3852eb2813d6877d54026a3",
  toShort: "0xfc2c…4026a3",
  value: "0.00004 ETH",
  near: "0.04",
  epoch: 11,
  sessions: 4,
  nonce: 0,
  tx: "0x7351064ac55d55fb81d42419451667fcca35d49e18286385e26b4eb78d52e8eb",
  block: "58635246",
} as const;

/** TBD (dev run). The instance the S16 stand-in shows: the v2 dev run whose real output it replays (rows and summary). */
export const VERIFY_INSTANCE = "v2dev.lastsave-factory.testnet";

/** Seam with S14's last frame, measured on its render at f251: the lifted "Host paid 0.04 Ⓝ" amount's centre and
 * on-screen font size (EpochChip Mono 96 px at its 1.16 lift scale), the box hidden in the frozen S14 layer while the
 * amount flies to the Base row, and the chip's box (with its glow) that collapses away. Re-measure if S14's chip moves. */
export const S14_SEAM = { frame: 251, amount: { x: 940, y: 613, px: 111 }, hole: { x: 700, y: 545, w: 480, h: 135 },
  chip: { x: 205, y: 335, w: 1510, h: 390 }, rack: { blur: 3, brightness: 0.45 },
  fix: { scale: 1.005, ox: 956, oy: 527 } } as const; // measured: the frozen chip renders 0.5 % small; scaled back

/** TBD (dev run). The Basescan result line for the payout tx (x-base): Basescan prints "Status:" then "Success"; the
 * receipt's status is 1 (proof/v2-e2e.md: block 58635246, success). */
export const BASESCAN_STATUS = { label: "Status:", value: "Success" } as const;

/** TBD (dev run). The summary line that ends `pnpm verify` on the v2 dev instance (run 14 Nov, scripts/verify/render.mjs
 * format): "ALL CHECKS THAT RAN HELD  ·  18 ✓   0 ✗   1 !   4 n/a   ·  2.6 s". The judge run's line replaces it. */
export const VERIFY_SUMMARY = { head: "ALL CHECKS THAT RAN HELD", counts: "18 ✓   0 ✗   1 !   4 n/a   ·  2.6 s" } as const;

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
