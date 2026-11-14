// Every chain value S04, S05 and S12 draw on screen. Run values come from film/run-facts.json (scripts/facts.mjs reads
// them from the run's proof files); only the contract config the product defines stays here.
import { rn, rs, shortHash } from "../../../film/run";

export interface Fact { v: string; src: string }
const run = (key: Parameters<typeof rs>[0], src: string): Fact => ({ v: rs(key), src });

/** Instance config shown on the licence card: price and the locked share come from the run's config. */
export const CONFIG = { price: rs("price"), fundPct: rn("fundPct"), studioPct: 100 - rn("fundPct"), royaltyPct: 10 } as const;
/** The locked share per licence (the buyer's pot_share). */
export const LOCKED_SHARE = rs("lockedShare");

export const FACTS = {
  /** Instance account. */
  instance: run("instance", "run proof contract"),
  /** S04: licence number minted by the store take's BUY. */
  licenceNo: run("licenceNo", "run proof buy phase"),
  /** S04: buy_licence tx hash (x-buy flash command line). */
  buyTx: run("buyTx", "run proof buy phase"),
  /** S05: sha256 of the encrypted server build committed at launch (cartridge front face). */
  buildSha: run("buildSha", "verify pins"),
  /** S05: release.wasm sha256 pinned in the escrow (second lock tag). */
  releaseWasm: run("releaseWasm", "verify pins"),
  /** S05: access keys on the instance (x-keys flash). */
  accessKeys: run("accessKeys", "run proof preflight"),
  /** S12: sha256 of the released build as recorded on chain (both plinth tags). */
  releasedSha: run("releasedSha", "verify pins"),
  /** S12: Walrus blob id of the released build. */
  walrusBlob: run("walrusBlob", "launch proof walrus step"),
  /** S12: Internet Archive item id of the released build. */
  archiveItem: run("archiveItem", "extra proof"),
  /** S12 first frame: keep-alive pool total shown at the end of S11. */
  poolTotal: run("poolTotal", "run proof claim phase"),
};

/** Short hash form `abcd1234…wxyz`. */
export const short = (f: Fact, head = 8, tail = 4) => shortHash(f.v, head, tail);

/** Who signed the `store` take's buy: "demo" = the in-app judge-demo signer (S04 says so on the buy beat), "wallet" = a
 * real external wallet (no label; the take shows the wallet approval itself). */
export const STORE_SIGNER: "wallet" | "demo" = "demo";
