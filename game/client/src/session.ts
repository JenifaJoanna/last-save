// Session keys and signatures (INTERFACES §4.2–4.3 + hello proof). One wallet signature per
// session; the session key then signs hello proofs and receipts without prompts.
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";
import type { HelloProof, Login, Receipt } from "../../shared/protocol";

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

export interface Session { account_id: string; host: string; login: Login; secret: Uint8Array }

export function newSessionKey(): { secret: Uint8Array; pub: string } {
  const secret = ed25519.utils.randomPrivateKey();
  return { secret, pub: `ed25519:${bs58.encode(ed25519.getPublicKey(secret))}` };
}

export function loginMessage(host: string, sessionPub: string, expMs: number): string {
  return JSON.stringify({ app: "ember-rift", host, session_pubkey: sessionPub, exp_ms: expMs });
}

function u32(n: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
function bstr(s: string): Uint8Array { const e = enc.encode(s); const out = new Uint8Array(4 + e.length); out.set(u32(e.length)); out.set(e, 4); return out; }

export function nep413Hash(message: string, nonce: Uint8Array, recipient: string): Uint8Array {
  const parts = [u32(2147484061), bstr(message), nonce, bstr(recipient), new Uint8Array([0])];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return sha256(all);
}

/** Signs a login with a NEAR private key ("ed25519:<base58 of seed+pub>"), for testnet key sign-in and bots. */
export function signLoginWithKey(accountId: string, privateKey: string, message: string, recipient: string): Login {
  const raw = bs58.decode(privateKey.replace(/^ed25519:/, "").trim());
  if (raw.length !== 64 && raw.length !== 32) throw new Error("That does not look like an ed25519 private key");
  const seed = raw.slice(0, 32);
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const sig = ed25519.sign(nep413Hash(message, nonce, recipient), seed);
  return { account_id: accountId, public_key: `ed25519:${bs58.encode(ed25519.getPublicKey(seed))}`, signature: b64(sig), message,
    nonce: b64(nonce), recipient };
}

export function helloProof(s: Session): HelloProof {
  const ts = Date.now();
  const sig = ed25519.sign(enc.encode(`lastsave-hello:v1|${s.host}|${ts}|${s.account_id}`), s.secret);
  return { ts_ms: ts, signature: b64(sig) };
}

export function signReceipt(s: Session, req: { host: string; epoch: number | null; nonce: string; ts_ms: number }): Receipt {
  const msg = `lastsave-receipt:v1|${req.host}|${req.epoch ?? "-"}|${req.nonce}|${req.ts_ms}|${s.account_id}`;
  return { host: req.host, epoch: req.epoch, nonce: req.nonce, ts_ms: req.ts_ms, account_id: s.account_id, signature: b64(ed25519.sign(enc.encode(msg), s.secret)) };
}

const KEY = (host: string) => `ember-rift.session.${host}`;

export function saveSession(s: Session): void {
  try { sessionStorage.setItem(KEY(s.host), JSON.stringify({ account_id: s.account_id, host: s.host, login: s.login, secret: hex(s.secret) })); } catch { /* storage blocked */ }
}

export function loadSession(host: string): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY(host));
    if (!raw) return null;
    const j = JSON.parse(raw);
    const exp = JSON.parse(j.login.message).exp_ms as number;
    if (exp < Date.now() + 60_000) return null;
    return { account_id: j.account_id, host: j.host, login: j.login, secret: unhex(j.secret) };
  } catch { return null; }
}

export function clearSession(host: string): void { try { sessionStorage.removeItem(KEY(host)); } catch { /* ignore */ } }
