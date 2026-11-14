// Every chain value S04, S05 and S12 draw on screen, in one place so the v2 judge run can be swapped in.
// `tbd: true` = not yet known: the judge instance ember-rift.lastsave-factory.testnet is not launched. Each TBD value
// renders as the literal text "TBD" until replaced with the run's real value (proof/judge-v2.json, the takes, the explorer).
// Contract config values (price, fund_bps, royalty) are the instance config from PLAN §7 / README, not run outputs.

export interface Fact { v: string; tbd: boolean; src: string }
const tbd = (src: string): Fact => ({ v: "TBD", tbd: true, src });

/** Instance config (known): price 0.25 Ⓝ, fund_bps 4000 (40 % locked), royalty 10 % (NEP-199). */
export const CONFIG = { price: "0.25", fundPct: 40, studioPct: 60, royaltyPct: 10 } as const;
/** 40 % of 0.25 Ⓝ: the locked share per licence, derived from the config. */
export const LOCKED_SHARE = "0.1";

export const FACTS = {
  /** Judge instance account (name fixed in README; launch pending). */
  instance: { v: "ember-rift.lastsave-factory.testnet", tbd: true, src: "README §contracts; launch pending" } as Fact,
  /** S04: licence number minted by the store take's BUY (yuna). */
  licenceNo: tbd("store take / buy_licence result"),
  /** S04: buy_licence tx hash (x-buy flash command line). */
  buyTx: tbd("x-buy explorer take"),
  /** S05: sha256 of the encrypted server build committed at launch (cartridge front face). */
  buildSha: tbd("instance view / proof/judge-v2.json"),
  /** S05: release.wasm sha256 pinned in the escrow (second lock tag). v1 value 9fafaf8e…4f472b7a until the v2 build is confirmed. */
  releaseWasm: tbd("README pnpm hash:release / escrow WasmHash"),
  /** S05: access keys on the instance (x-keys flash). Expected 0 by design; confirm on the judge instance. */
  accessKeys: { v: "0", tbd: true, src: "x-keys explorer take" } as Fact,
  /** S12: sha256 of the released build as recorded on chain (both plinth tags). */
  releasedSha: tbd("instance state after release / proof/judge-v2.json"),
  /** S12: Walrus blob id of the released build. */
  walrusBlob: tbd("x-walrus2 take"),
  /** S12: Internet Archive item id of the released build. */
  archiveItem: tbd("x-archive take / ia-upload.mjs output"),
  /** S12 first frame: keep-alive pool total shown at the end of S11. */
  poolTotal: tbd("S11 pool total / proof/judge-v2.json"),
};

/** Short hash form `abcd1234…wxyz`, or "TBD" while unknown. */
export const short = (f: Fact, head = 8, tail = 4) => (f.tbd && f.v === "TBD") || f.v.length <= head + tail + 1 ? f.v : `${f.v.slice(0, head)}…${f.v.slice(-tail)}`;

/** The list the handback reports. */
export const TBD_LIST = Object.entries(FACTS).filter(([, f]) => f.tbd).map(([k, f]) => `${k}: ${f.v} (${f.src})`);
