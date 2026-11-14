// Pure helpers for `pnpm verify`: hashes, address derivation, artifact decryption, bookkeeping sanity, manifest parsing.
// No network, no keys, no clock. Everything here is covered by pure.test.mjs.
import { createHash } from "node:crypto";
import { gcm } from "@noble/ciphers/aes";
import bs58 from "bs58";
import { derivePoint, evmAddress } from "../chainsig/derive.mjs";

export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const isHex64 = (s) => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
export const short = (s, n = 8) => (String(s).length > 2 * n + 1 ? `${String(s).slice(0, n)}…${String(s).slice(-4)}` : String(s));

/** NEAR code hashes are base58 of the 32-byte sha256; our config hashes are hex. Returns lowercase hex or null. */
export function normHash(s) {
  if (typeof s !== "string") return null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase();
  try {
    const b = bs58.decode(s);
    return b.length === 32 ? Buffer.from(b).toString("hex") : null;
  } catch { return null; }
}
export const sameHash = (a, b) => { const x = normHash(a), y = normHash(b); return x !== null && x === y; };
export const hexToB58 = (hex) => bs58.encode(Buffer.from(hex, "hex"));

/** Artifact format (INTERFACES 4.1): "LSV1" || nonce(12) || AES-256-GCM(K, nonce, plaintext, aad="LSV1") ciphertext||tag. */
const MAGIC = Buffer.from("LSV1");
export function decryptArtifact(file, keyHex) {
  if (!isHex64(keyHex)) throw new Error("key is not 64 lowercase hex characters");
  if (file.length < 4 + 12 + 16 || !Buffer.from(file.subarray(0, 4)).equals(MAGIC)) throw new Error("not a Last Save artifact (missing LSV1 header)");
  try {
    return Buffer.from(gcm(Buffer.from(keyHex, "hex"), file.subarray(4, 16), MAGIC).decrypt(file.subarray(16)));
  } catch { throw new Error("AES-GCM authentication failed (wrong key or modified artifact)"); }
}
/** Test-vector helper, same format as server-bundle/lib/crypto.mjs. */
export function encryptArtifact(plain, keyHex, nonce) {
  return Buffer.concat([MAGIC, nonce, gcm(Buffer.from(keyHex, "hex"), nonce, MAGIC).encrypt(plain)]);
}

/** After release: sha256(K) = commitment, and K decrypts the artifact to the on-chain build_hash. Never throws. */
export function checkReleasedKey({ keyHex, commitment, artifact, buildHash }) {
  const out = { keyOk: false, decrypted: false, buildOk: false, plainSha: null, plainBytes: 0, error: null };
  if (!isHex64(keyHex)) { out.error = "released key is not 64 hex characters"; return out; }
  out.keyOk = sha256Hex(Buffer.from(keyHex, "hex")) === commitment;
  if (!artifact) return out;
  try {
    const plain = decryptArtifact(artifact, keyHex);
    out.decrypted = true;
    out.plainBytes = plain.length;
    out.plainSha = sha256Hex(plain);
    out.buildOk = out.plainSha === buildHash;
  } catch (e) { out.error = e.message; }
  return out;
}

/** Re-derives the Base Sepolia payer from public inputs. rootKey is the signer's "secp256k1:<b58>" public key. */
export const deriveAddress = (rootKey, predecessor, path) => evmAddress(derivePoint(rootKey, predecessor, path).point);
export const sameAddress = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

const big = (v) => { try { return BigInt(String(v ?? "0")); } catch { return null; } };
export const fmtNear = (y) => `${(Number(BigInt(y) / 10n ** 20n) / 1e4).toFixed(4)} N`;

/** Tracked buckets never negative, supply consistent, and the spendable balance (amount minus storage stake) covers them. */
export function sanityTotals(totals, account) {
  const problems = [];
  const buckets = {};
  for (const k of ["pot_locked", "pool", "evm_settled", "ops_budget"]) {
    if (totals?.[k] === undefined) continue; // v1 has no ops_budget / evm_settled
    const v = big(totals[k]);
    if (v === null || v < 0n) problems.push(`${k} = ${totals[k]}`); else buckets[k] = v;
  }
  for (const k of ["refunded", "pledged", "paid_out"]) if (totals?.[k] !== undefined && (big(totals[k]) ?? -1n) < 0n) problems.push(`${k} = ${totals[k]}`);
  if (totals && Number(totals.live_supply) > Number(totals.supply)) problems.push(`live_supply ${totals.live_supply} > supply ${totals.supply}`);
  const owed = Object.values(buckets).reduce((a, b) => a + b, 0n);
  const spendable = BigInt(account.amount) - BigInt(account.storage_usage) * 10n ** 19n;
  if (spendable < owed) problems.push(`spendable ${fmtNear(spendable)} < tracked buckets ${fmtNear(owed)}`);
  return { ok: problems.length === 0, problems, owed, spendable, buckets };
}

const B58_TX = "[1-9A-HJ-NP-Za-km-z]{43,44}";
/** Every transaction hash linked from a markdown manifest (near.rocks /tx/<hash> or nearblocks /txns/<hash>), with the row text. */
export function txsFromMarkdown(md) {
  const seen = new Map();
  for (const line of md.split("\n")) {
    const cells = line.split("|").map((c) => c.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim());
    const title = cells.length > 3 ? `${cells[1]} ${cells[2]}`.trim() : "";
    const label = line.replace(/\]\([^)]*\)/g, "]").replace(/[|\[\]]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    for (const m of line.matchAll(new RegExp(`/tx(?:ns)?/(${B58_TX})`, "g"))) if (!seen.has(m[1])) seen.set(m[1], { hash: m[1], label, title: title || label.slice(0, 60) });
  }
  return [...seen.values()];
}

/** Every transaction hash in a JSON manifest: `hash` / `*tx` fields, nearblocks URLs. Entries may say `expect: "failure"`. */
export function txsFromJson(json) {
  const seen = new Map();
  const add = (hash, label, expect) => { if (new RegExp(`^${B58_TX}$`).test(hash) && !seen.has(hash)) seen.set(hash, { hash, label: String(label ?? "").slice(0, 90), expect: expect ?? "success" }); };
  const walk = (node, label) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, label));
    if (!node || typeof node !== "object") return;
    const here = node.label ?? node.step ?? node.name ?? label;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string") {
        if (k === "hash" || /(^|_)tx$/.test(k) || k === "create_tx" || k === "deploy_tx") add(v.replace(/^.*\/tx(?:ns)?\//, ""), `${here} ${k === "hash" ? "" : k}`.trim(), node.expect ?? (node.failure ? "failure" : undefined));
        else if (k === "url") add(v.replace(/^.*\/tx(?:ns)?\//, ""), here, node.expect ?? (node.failure ? "failure" : undefined));
      } else walk(v, here);
    }
  };
  walk(json, "");
  return [...seen.values()];
}

/** One `tx` RPC result -> { final, ok, failure }. A failure in the tx or any receipt makes it not ok, except a refund receipt
 * bouncing off an account the same tx just deleted (AccountDoesNotExist), which is how DeleteAccount normally ends. */
export function classifyTx(result) {
  if (!result) return { final: false, ok: false, failure: "no result" };
  const isRefundBounce = (s) => s?.Failure?.ActionError?.kind?.AccountDoesNotExist !== undefined;
  const failed = (s) => s && typeof s === "object" && s.Failure && !isRefundBounce(s);
  const bad = [result.status, ...(result.receipts_outcome ?? []).map((r) => r.outcome?.status)].find(failed);
  return { final: result.final_execution_status === "FINAL" || result.final_execution_status === "EXECUTED" || result.status?.SuccessValue !== undefined, ok: !bad, failure: bad ? JSON.stringify(bad.Failure).slice(0, 120) : null };
}

export function mirrorLabel(url) {
  const host = new URL(url).host;
  if (host.startsWith("kiln-cdn-")) return "studio copy";
  if (host.includes("walrus")) return "walrus";
  if (host === "raw.githubusercontent.com") return "github raw";
  if (host === "last-save.pages.dev") return "platform mirror";
  return host;
}

export const summarize = (results) => results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), { pass: 0, fail: 0, na: 0, warn: 0 });
