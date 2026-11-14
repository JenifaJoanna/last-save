// Verifies a `hello`: NEP-413 login (bound to this licence contract as recipient, this host, a 32-byte single-use nonce
// and an expiry) + fresh session-key proof + chain state (docs/INTERFACES.md 4.2).
import { HELLO_SKEW_MS, MAX_LOGIN_TTL_MS, parseLoginMessage, verifyHello, verifyLoginSignature } from "../../shared/auth";
import type { DeniedCode, HelloProof, Login } from "../../shared/protocol";
import { RpcError, type Chain } from "./chain";

/** Single-use bookkeeping for NEP-413 login nonces. A nonce belongs to exactly one signed login; re-presenting that
 *  same login (a reconnect) needs a hello proof strictly newer than the last one accepted for it. */
export interface NonceBook {
  claimLoginNonce(c: { login: Login; helloTs: number; expMs: number; nowMs: number }): "ok" | "reused" | "replayed";
}

/** In-memory NonceBook for tests and tools; the Arena uses the SQLite-backed Store. */
export class MemoryNonceBook implements NonceBook {
  private seen = new Map<string, { fp: string; helloTs: number; expMs: number }>();
  claimLoginNonce(c: { login: Login; helloTs: number; expMs: number; nowMs: number }): "ok" | "reused" | "replayed" {
    for (const [k, v] of this.seen) if (v.expMs <= c.nowMs) this.seen.delete(k);
    const fp = `${c.login.account_id}|${c.login.signature}`;
    const hit = this.seen.get(c.login.nonce);
    if (hit && hit.fp !== fp) return "reused";
    if (hit && c.helloTs <= hit.helloTs) return "replayed";
    this.seen.set(c.login.nonce, { fp, helloTs: c.helloTs, expMs: c.expMs });
    return "ok";
  }
}

export type JoinCheck =
  | { ok: true; accountId: string; sessionPubkey: string; expMs: number }
  | { ok: false; code: DeniedCode; error: string };

const deny = (code: DeniedCode, error: string): JoinCheck => ({ ok: false, code, error });

export async function verifyJoin(
  p: { login: Login; proof: HelloProof; hostId: string; licenceContract: string; chain: Chain; nonces: NonceBook; nowMs: number },
): Promise<JoinCheck> {
  const { login, proof, hostId, licenceContract, chain, nonces, nowMs } = p;
  const msg = parseLoginMessage(login.message);
  if (!msg) return deny("bad_signature", "login message is not a valid Ember Rift login");
  if (!verifyLoginSignature(login)) return deny("bad_signature", "wallet signature does not verify");
  if (login.recipient !== licenceContract) return deny("bad_signature", "login was signed for a different licence contract");
  if (msg.host !== hostId) return deny("wrong_host", `login is for host "${msg.host}", this is "${hostId}"`);
  if (nowMs >= msg.exp_ms) return deny("expired", "login has expired, sign in again");
  if (msg.exp_ms > nowMs + MAX_LOGIN_TTL_MS) return deny("expired", "login lifetime exceeds 24 hours");
  if (!verifyHello({ host: hostId, accountId: login.account_id, sessionPubkey: msg.session_pubkey, proof })) {
    return deny("bad_signature", "hello proof was not signed by the session key");
  }
  if (Math.abs(nowMs - proof.ts_ms) > HELLO_SKEW_MS) return deny("replay", "hello proof is stale");
  // Only after both signatures verify, so nobody can burn another player's nonce with an unsigned message.
  const claim = nonces.claimLoginNonce({ login, helloTs: proof.ts_ms, expMs: msg.exp_ms, nowMs });
  if (claim === "reused") return deny("replay", "that login nonce was already used by another login");
  if (claim === "replayed") return deny("replay", "that hello proof was already used, sign a fresh one");
  try {
    if (!(await chain.hasAccessKey(login.account_id, login.public_key))) {
      return deny("no_access_key", "that key is not an access key of this account");
    }
    if (!(await chain.licenceOf(licenceContract, login.account_id))) return deny("no_licence", "this account does not hold an Ember Rift licence");
  } catch (e) {
    if (e instanceof RpcError) return deny("no_access_key", "the NEAR network is unreachable right now, try again in a moment");
    throw e;
  }
  return { ok: true, accountId: login.account_id, sessionPubkey: msg.session_pubkey, expMs: msg.exp_ms };
}
