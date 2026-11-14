// Base Sepolia helpers for the chain-signatures tooling: JSON-RPC with failover, a small RLP reader, raw-tx parsing
// (legacy EIP-155 and EIP-1559) with sender recovery, and unit formatting. No wallet or key handling here.
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export const CHAIN_ID = 84532;
export const RPCS = (process.env.BASE_SEPOLIA_RPCS ?? "https://sepolia.base.org,https://base-sepolia-rpc.publicnode.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
export const basescanTx = (hash) => `https://sepolia.basescan.org/tx/${hash}`;
export const basescanAddress = (a) => `https://sepolia.basescan.org/address/${a}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** JSON-RPC with failover across RPCS and backoff on 429/5xx/network errors. A JSON-RPC error is an answer: thrown with .evm. */
export async function evmRpc(method, params = []) {
  let last;
  for (const url of RPCS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        if (res.status === 429 || res.status >= 500) throw new Error(`${url} ${res.status}`);
        const body = await res.json();
        if (body.error) throw Object.assign(new Error(body.error.message), { evm: body.error });
        return body.result;
      } catch (e) {
        if (e.evm) throw e;
        last = e;
        await sleep(400 * 2 ** attempt);
      }
    }
  }
  throw last;
}

export const hexInt = (h) => BigInt(h ?? "0x0");
export const fmtEth = (wei) => {
  const s = BigInt(wei).toString().padStart(19, "0");
  return `${s.slice(0, -18)}.${s.slice(-18)}`.replace(/0+$/, "").replace(/\.$/, ".0");
};

// ---- RLP ----
function readItem(buf, pos) {
  const b = buf[pos];
  if (b < 0x80) return { start: pos, end: pos + 1, value: buf.slice(pos, pos + 1) };
  const lenOf = (n) => { let x = 0; for (let i = 0; i < n; i++) x = x * 256 + buf[pos + 1 + i]; return x; };
  if (b <= 0xb7) return { start: pos, end: pos + 1 + (b - 0x80), value: buf.slice(pos + 1, pos + 1 + (b - 0x80)) };
  if (b <= 0xbf) { const n = b - 0xb7; const l = lenOf(n); return { start: pos, end: pos + 1 + n + l, value: buf.slice(pos + 1 + n, pos + 1 + n + l) }; }
  const [n, l] = b <= 0xf7 ? [0, b - 0xc0] : [b - 0xf7, lenOf(b - 0xf7)];
  const bodyStart = pos + 1 + (b <= 0xf7 ? 0 : n);
  const items = [];
  for (let p = bodyStart; p < bodyStart + l;) { const it = readItem(buf, p); items.push(it); p = it.end; }
  return { start: pos, end: bodyStart + l, list: items };
}
function rlpListOf(encodedItems) {
  const body = Uint8Array.from(encodedItems.flatMap((e) => [...e]));
  if (body.length <= 55) return Uint8Array.from([0xc0 + body.length, ...body]);
  const len = []; for (let n = body.length; n > 0; n = Math.floor(n / 256)) len.unshift(n % 256);
  return Uint8Array.from([0xf7 + len.length, ...len, ...body]);
}
function rlpUint(n) {
  const b = n === 0n ? [] : hexToBytes(n.toString(16).padStart(Math.ceil(n.toString(16).length / 2) * 2, "0"));
  return b.length === 1 && b[0] < 0x80 ? Uint8Array.from(b) : Uint8Array.from([0x80 + b.length, ...b]);
}
const num = (it) => BigInt(`0x${bytesToHex(it.value) || "0"}`);
const evmAddress = (pub) => `0x${bytesToHex(keccak_256(pub.slice(1)).slice(12))}`;

/** Parses a raw signed tx (0x-hex). Returns { type, chainId, nonce, to, value, gasLimit, maxFeePerGas, from, hash }. Throws on anything unexpected. */
export function parseRawTx(rawHex) {
  const raw = hexToBytes(rawHex.replace(/^0x/, ""));
  const type = raw[0] >= 0xc0 ? 0 : raw[0];
  if (type !== 0 && type !== 2) throw new Error(`unsupported transaction type ${type}`);
  const root = readItem(raw, type === 0 ? 0 : 1);
  const f = root.list;
  const enc = (it) => raw.slice(it.start, it.end);
  let chainId, nonce, to, value, gasLimit, maxFee, signed, v, r, s;
  if (type === 2) {
    [chainId, nonce] = [num(f[0]), num(f[1])]; maxFee = num(f[3]); gasLimit = num(f[4]);
    to = f[5].value.length ? `0x${bytesToHex(f[5].value)}` : null; value = num(f[6]);
    [v, r, s] = [num(f[9]), f[10].value, f[11].value];
    signed = keccak_256(Uint8Array.from([2, ...rlpListOf(f.slice(0, 9).map(enc))]));
  } else {
    nonce = num(f[0]); maxFee = num(f[1]); gasLimit = num(f[2]);
    to = f[3].value.length ? `0x${bytesToHex(f[3].value)}` : null; value = num(f[4]);
    [v, r, s] = [num(f[6]), f[7].value, f[8].value];
    chainId = v >= 35n ? (v - 35n) / 2n : null;
    const base = f.slice(0, 6).map(enc);
    signed = keccak_256(rlpListOf(chainId === null ? base : [...base, rlpUint(chainId), rlpUint(0n), rlpUint(0n)]));
  }
  const recovery = type === 2 ? Number(v) : Number(v >= 35n ? (v - 35n) % 2n : v - 27n);
  const sig = new secp256k1.Signature(BigInt(`0x${bytesToHex(r)}`), BigInt(`0x${bytesToHex(s)}`)).addRecoveryBit(recovery);
  const from = evmAddress(sig.recoverPublicKey(signed).toRawBytes(false));
  return { type, chainId, nonce, to, value, gasLimit, maxFeePerGas: maxFee, from, hash: `0x${bytesToHex(keccak_256(raw))}` };
}
