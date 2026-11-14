// Global contracts (NEP-591) for scripts. near-api-js 5.1.1 pins @near-js/transactions 1.3.3, which has no
// DeployGlobalContract / UseGlobalContract actions, so the transaction is borsh-encoded and signed here
// (layout from nearcore near-primitives: Action tags DeployGlobalContract = 9, UseGlobalContract = 10;
// GlobalContractDeployMode CodeHash = 0 / AccountId = 1; GlobalContractIdentifier CodeHash(32 bytes) = 0 /
// AccountId = 1). Reuses scripts/lib/near.mjs for keys, RPC failover and polling; does not edit it.
import { createHash } from "node:crypto";
import nearApi from "near-api-js";
import { NETWORK, connection, ensureKey, explorerTx, rpc } from "./near.mjs";

const { utils } = nearApi;

/** Burnt (not locked) when publishing: 10 NEAR per 100 KB = 1e20 yocto per byte (docs.near.org global contracts). */
export const GLOBAL_YOCTO_PER_BYTE = 10n ** 20n;
export const TAG = { DeployGlobalContract: 9, UseGlobalContract: 10 };
export const MODE = { hash: 0, account: 1 };

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest();
export const hashB58 = (bytes) => utils.serialize.base_encode(sha256(bytes));
export const globalDeployCost = (byteLen) => BigInt(byteLen) * GLOBAL_YOCTO_PER_BYTE;

class W {
  constructor() { this.parts = []; }
  u8(n) { this.parts.push(Buffer.from([n])); return this; }
  u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); this.parts.push(b); return this; }
  u64(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); this.parts.push(b); return this; }
  raw(buf) { this.parts.push(Buffer.from(buf)); return this; }
  bytes(buf) { return this.u32(buf.length).raw(buf); }
  str(s) { return this.bytes(Buffer.from(s, "utf8")); }
  done() { return Buffer.concat(this.parts); }
}

/** `mode`: "hash" (immutable, identified by sha256 of the code) or "account" (updatable by the publisher). */
export function deployGlobalAction(code, mode = "hash") {
  if (!(mode in MODE)) throw new Error(`mode must be hash or account, got ${mode}`);
  return new W().u8(TAG.DeployGlobalContract).bytes(code).u8(MODE[mode]).done();
}

/** Identifier is a 32-byte code hash (Buffer) or an account id string. */
export function useGlobalAction(identifier) {
  const w = new W().u8(TAG.UseGlobalContract);
  return (typeof identifier === "string" ? w.u8(1).str(identifier) : w.u8(0).raw(identifier)).done();
}

/** Signs and submits one transaction made of pre-encoded actions; returns { hash, url, outcome, failure }. */
export async function sendRawActions(signerId, receiverId, encodedActions) {
  await ensureKey(signerId);
  const { mem } = connection();
  const kp = await mem.getKey(NETWORK, signerId);
  const pk = kp.getPublicKey();
  const ak = await rpc("query", { request_type: "view_access_key", finality: "final", account_id: signerId, public_key: pk.toString() });
  const block = await rpc("block", { finality: "final" });
  const tx = new W()
    .str(signerId).u8(0).raw(pk.data).u64(BigInt(ak.nonce) + 1n).str(receiverId)
    .raw(utils.serialize.base_decode(block.header.hash)).u32(encodedActions.length);
  for (const a of encodedActions) tx.raw(a);
  const txBytes = tx.done();
  const { signature } = kp.sign(sha256(txBytes));
  const signed = new W().raw(txBytes).u8(0).raw(signature).done();
  const hash = utils.serialize.base_encode(sha256(txBytes));
  await rpc("send_tx", { signed_tx_base64: signed.toString("base64"), wait_until: "INCLUDED" }).catch((e) => {
    if (!/TIMEOUT|timeout|already/.test(String(e.message))) throw e;
  });
  let outcome;
  for (let i = 0; i < 60 && !outcome; i++) {
    try {
      const r = await rpc("tx", { tx_hash: hash, sender_account_id: signerId, wait_until: "FINAL" });
      if (r?.final_execution_status === "FINAL" || r?.status?.SuccessValue !== undefined || r?.status?.Failure) outcome = r;
    } catch (e) {
      if (!/TIMEOUT|PENDING|UNKNOWN_TRANSACTION|timeout|429|fetch failed/.test(String(e.message))) throw e;
    }
    if (!outcome) await new Promise((res) => setTimeout(res, 3000));
  }
  if (!outcome) throw new Error(`tx ${hash} not final after polling (${explorerTx(hash)})`);
  const failure = [outcome.status, ...outcome.receipts_outcome.map((r) => r.outcome.status)].find((st) => st?.Failure);
  return { hash, url: explorerTx(hash), outcome, failure: failure?.Failure ?? null };
}

/** True if the chain already has global code with this sha256 (RPC view_global_contract_code). */
export async function globalCodeExists(hashBase58) {
  try {
    await rpc("query", { request_type: "view_global_contract_code", finality: "final", code_hash: hashBase58 });
    return true;
  } catch (e) {
    if (/NO_GLOBAL_CONTRACT_CODE|never been observed|UNKNOWN|not found/i.test(String(e?.message ?? e))) return false;
    throw e;
  }
}
