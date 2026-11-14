// "Try to kill it": POST /attack { attack, target } signs one of a fixed set of hostile calls as a public attacker
// account and relays it like any gas-free action. The contract refuses each one; the caller reads the refusal from
// the transaction. The attacker key never leaves the Worker; attacks are zero-deposit and rate-limited.
import { z } from "zod";
import { publicKeyFromSecret, signDelegate, signerFromSecret } from "../client/delegate";
import { RateLimiter, RelayError } from "./policy";
import { depsFor, policyFrom, relayDelegate, type Env } from "./relay";
import { rpc } from "./rpc";

export interface AttackEnv extends Env {
  ATTACKER_ACCOUNT?: string;
  /** Secret: the throwaway attacker account's key. */
  ATTACKER_KEY?: string;
}

/** Each attack is a real call a hostile party could make. The comment says which rule refuses it. */
export const ATTACKS: Record<string, { method: string; args: Record<string, unknown> }> = {
  "early-release": { method: "release", args: {} }, // "The game is still alive" while the studio serves players
  "fake-report": { method: "report_down", args: { token_id: "1" } }, // "Only the licence holder can report"
  "drain-pool": { method: "claim_epoch", args: { epoch: 0 } }, // "Register as a host first"
  "redirect-payout": { method: "set_payout_evm", args: { address: "0x000000000000000000000000000000000000dEaD" } }, // own host record only
  "double-sign": { method: "bump_evm_payout", args: { id: 0 } }, // no such payout, or too early to re-sign
};

const body = z.object({ attack: z.enum(Object.keys(ATTACKS) as [string, ...string[]]), target: z.string().min(2).max(64) }).strict();
let limiter: RateLimiter | undefined;

export async function runAttack(raw: unknown, env: AttackEnv, now = Date.now()): Promise<{ hash: string; method: string; args: Record<string, unknown>; attacker: string }> {
  if (!env.ATTACKER_ACCOUNT || !env.ATTACKER_KEY) throw new RelayError("NOT_CONFIGURED", "attack demo is not configured", 503);
  const p = body.safeParse(raw);
  if (!p.success) throw new RelayError("BAD_REQUEST", `expected { attack: ${Object.keys(ATTACKS).join("|")}, target }`);
  if (!policyFrom(env).allowedReceivers.has(p.data.target)) throw new RelayError("RECEIVER_NOT_ALLOWED", "unknown licence instance", 403);
  limiter ??= new RateLimiter(30);
  limiter.check("attacks", now);

  const a = ATTACKS[p.data.attack];
  const deps = depsFor(env);
  const publicKey = publicKeyFromSecret(env.ATTACKER_KEY);
  const [ak, head] = await Promise.all([
    rpc<{ nonce: number }>(deps, "query", { request_type: "view_access_key", finality: "optimistic", account_id: env.ATTACKER_ACCOUNT, public_key: publicKey }),
    rpc<{ header: { height: number } }>(deps, "block", { finality: "optimistic" }),
  ]);
  const signed = await signDelegate({
    senderId: env.ATTACKER_ACCOUNT, publicKey, receiverId: p.data.target,
    nonce: BigInt(ak.nonce) + 1n + BigInt(now % 1000), maxBlockHeight: BigInt(head.header.height) + 100n,
    actions: [{ methodName: a.method, args: a.args, gas: 100_000_000_000_000n }],
  }, signerFromSecret(env.ATTACKER_KEY));
  const { hash } = await relayDelegate({ signed_delegate: signed }, env, deps, now);
  return { hash, method: a.method, args: a.args, attacker: env.ATTACKER_ACCOUNT };
}
