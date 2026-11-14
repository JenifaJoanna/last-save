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

/** TBD. The instance `pnpm verify` names in the S16 stand-in (the judge instance the t-verify take will run against). */
export const VERIFY_INSTANCE = "ember-rift.lastsave-factory.testnet";

/** Seam with S14's last frame, measured on its render at f251: the lifted "Host paid 0.04 Ⓝ" amount's centre and
 * on-screen font size (EpochChip Mono 96 px at its 1.16 lift scale), and the box hidden in the frozen S14 layer while
 * the amount flies to the Base row. Re-measure if S14's chip moves. */
export const S14_SEAM = { frame: 251, amount: { x: 1006, y: 592, px: 111 }, hole: { x: 770, y: 528, w: 475, h: 130 } } as const;
