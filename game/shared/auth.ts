// NEP-413 login, hello proof and session receipts (docs/INTERFACES.md 4.2-4.3).
// Isomorphic: Cloudflare Worker, browser and Node. Only erasable TypeScript, so Node can import it directly.
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import bs58 from "bs58";
import type { Login, Receipt, HelloProof } from "./protocol";

export const APP_ID = "ember-rift";
export const NEP413_TAG = 2147484061; // 2^31 + 413
export const MAX_LOGIN_TTL_MS = 24 * 3600 * 1000;
export const HELLO_SKEW_MS = 60_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function fromHex(h: string): Uint8Array {
  if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error("bad hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function encodePublicKey(pk: Uint8Array): string { return `ed25519:${bs58.encode(pk)}`; }
export function decodePublicKey(s: string): Uint8Array {
  if (!s.startsWith("ed25519:")) throw new Error("not an ed25519 key");
  const b = bs58.decode(s.slice(8));
  if (b.length !== 32) throw new Error("bad public key length");
  return b;
}
/** Accepts "ed25519:<b58>" of a 32-byte seed or a 64-byte NEAR secret key (seed || public). Returns the 32-byte seed. */
export function decodeSecretKey(s: string): Uint8Array {
  const raw = s.startsWith("ed25519:") ? s.slice(8) : s;
  const b = bs58.decode(raw);
  if (b.length !== 32 && b.length !== 64) throw new Error("bad secret key length");
  return b.slice(0, 32);
}
export function publicKeyOf(secret: string): string { return encodePublicKey(ed25519.getPublicKey(decodeSecretKey(secret))); }
export function generateSessionKey(): { secret: string; public: string } {
  const seed = ed25519.utils.randomPrivateKey();
  return { secret: `ed25519:${bs58.encode(seed)}`, public: encodePublicKey(ed25519.getPublicKey(seed)) };
}

// ---- borsh pieces for the NEP-413 payload ----
function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const borshString = (s: string): Uint8Array => { const e = enc.encode(s); return concat(u32le(e.length), e); };

/** sha256(borsh(2^31+413) || borsh({message, nonce[32], recipient, callback_url: None})) */
export function nep413Hash(message: string, nonce: Uint8Array, recipient: string): Uint8Array {
  if (nonce.length !== 32) throw new Error("nonce must be 32 bytes");
  return sha256(concat(u32le(NEP413_TAG), borshString(message), nonce, borshString(recipient), new Uint8Array([0])));
}

export interface LoginMessage { app: string; host: string; session_pubkey: string; exp_ms: number }

export function buildLoginMessage(p: { host: string; sessionPubkey: string; expMs: number }): string {
  return JSON.stringify({ app: APP_ID, host: p.host, session_pubkey: p.sessionPubkey, exp_ms: p.expMs });
}

/** Parses and shape-checks a login message; returns null if it is not a valid Ember Rift login message. */
export function parseLoginMessage(message: string): LoginMessage | null {
  try {
    const m = JSON.parse(message);
    if (!m || typeof m !== "object") return null;
    if (m.app !== APP_ID || typeof m.host !== "string" || typeof m.session_pubkey !== "string") return null;
    if (typeof m.exp_ms !== "number" || !Number.isFinite(m.exp_ms)) return null;
    decodePublicKey(m.session_pubkey);
    return { app: m.app, host: m.host, session_pubkey: m.session_pubkey, exp_ms: m.exp_ms };
  } catch { return null; }
}

/** Signs a NEP-413 login with an account (wallet or local) key. Pass `nonce` only for test vectors. */
export function signLogin(p: { accountId: string; secretKey: string; message: string; recipient: string; nonce?: Uint8Array }): Login {
  const nonce = p.nonce ?? crypto.getRandomValues(new Uint8Array(32));
  const seed = decodeSecretKey(p.secretKey);
  const sig = ed25519.sign(nep413Hash(p.message, nonce, p.recipient), seed);
  return { account_id: p.accountId, public_key: encodePublicKey(ed25519.getPublicKey(seed)), signature: toBase64(sig),
    message: p.message, nonce: toBase64(nonce), recipient: p.recipient };
}

/** True iff the login's signature verifies under login.public_key. Does NOT check chain state, host or expiry. */
export function verifyLoginSignature(login: Login): boolean {
  try {
    const nonce = fromBase64(login.nonce);
    const sig = fromBase64(login.signature);
    if (nonce.length !== 32 || sig.length !== 64) return false;
    return ed25519.verify(sig, nep413Hash(login.message, nonce, login.recipient), decodePublicKey(login.public_key));
  } catch { return false; }
}

// ---- hello proof (replay protection for joining) ----
export const helloMessage = (host: string, tsMs: number, accountId: string): string => `lastsave-hello:v1|${host}|${tsMs}|${accountId}`;

export function signHello(p: { host: string; accountId: string; sessionSecret: string; tsMs?: number }): HelloProof {
  const ts = p.tsMs ?? Date.now();
  const sig = ed25519.sign(enc.encode(helloMessage(p.host, ts, p.accountId)), decodeSecretKey(p.sessionSecret));
  return { ts_ms: ts, signature: toBase64(sig) };
}

export function verifyHello(p: { host: string; accountId: string; sessionPubkey: string; proof: HelloProof }): boolean {
  try {
    const sig = fromBase64(p.proof.signature);
    if (sig.length !== 64) return false;
    return ed25519.verify(sig, enc.encode(helloMessage(p.host, p.proof.ts_ms, p.accountId)), decodePublicKey(p.sessionPubkey));
  } catch { return false; }
}

// ---- session receipts ----
export function receiptMessage(r: { host: string; epoch: number | null; nonce: string; ts_ms: number; account_id: string }): string {
  return `lastsave-receipt:v1|${r.host}|${r.epoch === null ? "-" : r.epoch}|${r.nonce}|${r.ts_ms}|${r.account_id}`;
}

export function signReceipt(p: { host: string; epoch: number | null; nonce: string; tsMs: number; accountId: string; sessionSecret: string }): Receipt {
  const body = { host: p.host, epoch: p.epoch, nonce: p.nonce, ts_ms: p.tsMs, account_id: p.accountId };
  const sig = ed25519.sign(enc.encode(receiptMessage(body)), decodeSecretKey(p.sessionSecret));
  return { ...body, signature: toBase64(sig) };
}

export function verifyReceipt(r: Receipt, sessionPubkey: string): boolean {
  try {
    const sig = fromBase64(r.signature);
    if (sig.length !== 64) return false;
    return ed25519.verify(sig, enc.encode(receiptMessage(r)), decodePublicKey(sessionPubkey));
  } catch { return false; }
}

export const utf8 = { encode: (s: string) => enc.encode(s), decode: (b: Uint8Array) => dec.decode(b) };
