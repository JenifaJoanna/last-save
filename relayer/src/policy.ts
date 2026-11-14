// What the relayer is willing to pay for. Every rule here refuses by throwing RelayError; nothing is advisory.
import { type SignedDelegate, verifyDelegateSignature } from "../client/delegate";

export class RelayError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

/** Zero-deposit holder methods of the licence contract. register_host (0.01 N) and every other payable call are excluded on purpose. */
export const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  "choose", "report_down", "probe_official", "release", "claim_epoch",
  "sign_evm_payout", "bump_evm_payout", "set_payout_evm",
]);

export const MAX_GAS = 300_000_000_000_000n; // 300 Tgas, the protocol cap per transaction

export interface Policy {
  allowedReceivers: ReadonlySet<string>;
  maxGas: bigint;
  /** Blocks of slack required before max_block_height, so a delegate cannot expire in flight. */
  expiryMargin: bigint;
}

export const parseList = (s: string | undefined): Set<string> =>
  new Set((s ?? "").split(",").map((x) => x.trim()).filter(Boolean));

/** Static checks that need no chain access. Order: receiver, actions, then the signature (so no CPU is spent on junk). */
export function checkStatic(s: SignedDelegate, policy: Policy): void {
  const d = s.delegate;
  if (!policy.allowedReceivers.has(d.receiverId)) {
    throw new RelayError("RECEIVER_NOT_ALLOWED", `${d.receiverId} is not a relayed contract`, 403);
  }
  let gas = 0n;
  for (const a of d.actions) {
    if (!ALLOWED_METHODS.has(a.methodName)) {
      throw new RelayError("METHOD_NOT_ALLOWED", `method ${a.methodName} is not relayed`, 403);
    }
    if (a.deposit !== 0n) throw new RelayError("DEPOSIT_NOT_ZERO", "relayed calls must attach no deposit", 403);
    gas += a.gas;
  }
  if (gas > policy.maxGas) throw new RelayError("GAS_TOO_HIGH", "total gas exceeds the relay cap", 403);
  if (!verifyDelegateSignature(s)) throw new RelayError("BAD_SIGNATURE", "delegate signature does not verify");
}

export function checkExpiry(s: SignedDelegate, headHeight: bigint, policy: Policy): void {
  if (s.delegate.maxBlockHeight < headHeight + policy.expiryMargin) {
    throw new RelayError("EXPIRED", "delegate action has expired (max_block_height)");
  }
}

interface AccessKeyView {
  nonce: number;
  permission: "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[] } };
}

/** The sender's key must exist, its permission must cover the calls, and the delegate nonce must be fresh: else the relayer would pay for a failure. */
export function checkAccessKey(s: SignedDelegate, key: AccessKeyView, headHeight: bigint): void {
  const d = s.delegate;
  if (d.nonce <= BigInt(key.nonce)) throw new RelayError("NONCE_USED", "delegate nonce is not above the access key nonce");
  if (d.nonce > (headHeight + 100n) * 1_000_000n) throw new RelayError("NONCE_TOO_HIGH", "delegate nonce is too large");
  if (key.permission !== "FullAccess") {
    const p = key.permission.FunctionCall;
    if (p.receiver_id !== d.receiverId) throw new RelayError("KEY_PERMISSION", "access key is limited to another contract");
    for (const a of d.actions) {
      if (p.method_names.length && !p.method_names.includes(a.methodName)) {
        throw new RelayError("KEY_PERMISSION", `access key may not call ${a.methodName}`);
      }
    }
  }
}

/** Sliding one-minute window per key. State lives in the Worker isolate: it resets on cold start and is not shared between isolates. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private perMinute: number) {}
  check(key: string, now: number): void {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.perMinute) {
      this.hits.set(key, recent);
      throw new RelayError("RATE_LIMITED", "too many relayed calls, retry in a minute", 429);
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < 60_000)) this.hits.delete(k);
  }
}
