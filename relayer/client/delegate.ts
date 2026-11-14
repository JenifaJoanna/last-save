// NEP-366 delegate actions: borsh encode/decode, NEP-461 hash, signing, and the relay call.
// Browser and Worker safe; written in erasable-only TypeScript so Node >= 22.18 can import it directly (scripts/lib/metatx.mjs). Only function-call actions are supported (all this app needs).
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import bs58 from "bs58";
import { Reader, Writer, fromBase64, toBase64 } from "./borsh.ts";

export { toBase64, fromBase64 };

/** NEP-461: 2^30 + 366, little-endian u32, prepended before hashing. */
export const DELEGATE_PREFIX = 1073742190;
const ACTION_FUNCTION_CALL = 2;

export interface FunctionCallAction {
  methodName: string;
  args: Uint8Array;
  gas: bigint;
  deposit: bigint;
}

export interface DelegateAction {
  senderId: string;
  receiverId: string;
  actions: FunctionCallAction[];
  nonce: bigint;
  maxBlockHeight: bigint;
  publicKey: string; // "ed25519:<base58>"
}

export interface SignedDelegate {
  delegate: DelegateAction;
  signature: Uint8Array; // 64 bytes, ed25519
}

export class DelegateDecodeError extends Error {
  code: "BAD_BORSH" | "ACTION_NOT_ALLOWED" | "UNSUPPORTED_KEY";
  constructor(code: "BAD_BORSH" | "ACTION_NOT_ALLOWED" | "UNSUPPORTED_KEY", message: string) {
    super(message);
    this.code = code;
  }
}

export const publicKeyBytes = (pk: string): Uint8Array => {
  if (!pk.startsWith("ed25519:")) throw new Error("only ed25519 keys are supported");
  const b = bs58.decode(pk.slice(8));
  if (b.length !== 32) throw new Error("bad ed25519 public key length");
  return b;
};

export function encodeDelegateAction(d: DelegateAction): Uint8Array {
  const w = new Writer().str(d.senderId).str(d.receiverId).uint(BigInt(d.actions.length), 4);
  for (const a of d.actions) {
    w.u8(ACTION_FUNCTION_CALL).str(a.methodName).vec(a.args).uint(a.gas, 8).uint(a.deposit, 16);
  }
  return w.uint(d.nonce, 8).uint(d.maxBlockHeight, 8).u8(0).bytes(publicKeyBytes(d.publicKey)).done();
}

/** sha256( u32le(2^30+366) || borsh(DelegateAction) ): the bytes the user key signs. */
export function delegateHash(d: DelegateAction): Uint8Array {
  const prefix = new Writer().uint(BigInt(DELEGATE_PREFIX), 4).done();
  return sha256(Uint8Array.from([...prefix, ...encodeDelegateAction(d)]));
}

export function encodeSignedDelegate(s: SignedDelegate): Uint8Array {
  return new Writer().bytes(encodeDelegateAction(s.delegate)).u8(0).bytes(s.signature).done();
}

export function decodeSignedDelegate(raw: Uint8Array): SignedDelegate {
  const r = new Reader(raw);
  try {
    const senderId = r.str(64);
    const receiverId = r.str(64);
    const n = r.u32();
    if (n < 1 || n > 16) throw new DelegateDecodeError("BAD_BORSH", "delegate has an unsupported number of actions");
    const actions: FunctionCallAction[] = [];
    for (let i = 0; i < n; i++) {
      const kind = r.u8();
      if (kind !== ACTION_FUNCTION_CALL) {
        throw new DelegateDecodeError("ACTION_NOT_ALLOWED", `action #${i} is type ${kind}; only FunctionCall is relayed`);
      }
      actions.push({ methodName: r.str(256), args: r.vec(8192), gas: r.uint(8), deposit: r.uint(16) });
    }
    const nonce = r.uint(8);
    const maxBlockHeight = r.uint(8);
    if (r.u8() !== 0) throw new DelegateDecodeError("UNSUPPORTED_KEY", "only ed25519 delegate keys are supported");
    const publicKey = `ed25519:${bs58.encode(r.bytes(32))}`;
    if (r.u8() !== 0) throw new DelegateDecodeError("UNSUPPORTED_KEY", "only ed25519 signatures are supported");
    const signature = r.bytes(64).slice();
    if (r.remaining !== 0) throw new DelegateDecodeError("BAD_BORSH", "trailing bytes after the signed delegate action");
    return { delegate: { senderId, receiverId, actions, nonce, maxBlockHeight, publicKey }, signature };
  } catch (e) {
    if (e instanceof DelegateDecodeError) throw e;
    throw new DelegateDecodeError("BAD_BORSH", e instanceof Error ? e.message : "malformed borsh");
  }
}

export function verifyDelegateSignature(s: SignedDelegate): boolean {
  try {
    return ed25519.verify(s.signature, delegateHash(s.delegate), publicKeyBytes(s.delegate.publicKey));
  } catch {
    return false;
  }
}

export type Signer = (hash: Uint8Array) => Uint8Array | Promise<Uint8Array>;

/** Signer from a NEAR secret key string ("ed25519:<base58 of the 64-byte or 32-byte secret>"). */
export function signerFromSecret(secret: string): Signer {
  const seed = bs58.decode(secret.replace(/^ed25519:/, "")).slice(0, 32);
  return (hash) => ed25519.sign(hash, seed);
}

export function publicKeyFromSecret(secret: string): string {
  const seed = bs58.decode(secret.replace(/^ed25519:/, "")).slice(0, 32);
  return `ed25519:${bs58.encode(ed25519.getPublicKey(seed))}`;
}

export interface BuildInput {
  senderId: string;
  publicKey: string;
  receiverId: string;
  nonce: bigint;
  maxBlockHeight: bigint;
  actions: { methodName: string; args: unknown; gas?: bigint }[];
}

/** Builds and signs a delegate. `args` objects are JSON-encoded. Returns base64(borsh(SignedDelegateAction)). */
export async function signDelegate(input: BuildInput, sign: Signer): Promise<string> {
  const enc = new TextEncoder();
  const delegate: DelegateAction = {
    senderId: input.senderId,
    receiverId: input.receiverId,
    nonce: input.nonce,
    maxBlockHeight: input.maxBlockHeight,
    publicKey: input.publicKey,
    actions: input.actions.map((a) => ({
      methodName: a.methodName,
      args: a.args instanceof Uint8Array ? a.args : enc.encode(JSON.stringify(a.args ?? {})),
      gas: a.gas ?? 100_000_000_000_000n,
      deposit: 0n,
    })),
  };
  const signature = await sign(delegateHash(delegate));
  return toBase64(encodeSignedDelegate({ delegate, signature }));
}

export interface RelayOk { hash: string }

/** POSTs a signed delegate to the relayer. `url` is the relayer base ("https://x.pages.dev") or its /relay endpoint. */
export async function relay(url: string, signedDelegate: string, fetchImpl: typeof fetch = fetch): Promise<RelayOk> {
  const base = url.replace(/\/+$/, "");
  const endpoint = base.endsWith("/relay") ? base : `${base}/relay`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signed_delegate: signedDelegate }),
  });
  const body = (await res.json().catch(() => ({ error: `relayer returned ${res.status}` }))) as { hash?: string; error?: string; code?: string };
  if (!res.ok || !body.hash) throw Object.assign(new Error(body.error ?? "relay failed"), { code: body.code });
  return { hash: body.hash };
}
