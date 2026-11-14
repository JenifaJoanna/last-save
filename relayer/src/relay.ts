// The relay itself: validate the user's signed delegate, wrap it in a transaction the relayer account signs, send it.
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import bs58 from "bs58";
import { z } from "zod";
import { Writer } from "../client/borsh";
import { DelegateDecodeError, decodeSignedDelegate, fromBase64 } from "../client/delegate";
import { checkAccessKey, checkExpiry, checkStatic, parseList, MAX_GAS, type Policy, RateLimiter, RelayError } from "./policy";
import { DEFAULT_RPCS, rpc, RpcAnswer, type RpcDeps } from "./rpc";

export interface Env {
  /** Comma list of licence instances the relayer will pay for. */
  ALLOWED_RECEIVERS: string;
  RELAYER_ACCOUNT: string;
  /** Secret: relayer access key, "ed25519:<base58>". */
  RELAYER_KEY: string;
  RPC_URLS?: string;
  RATE_LIMIT_PER_MIN?: string;
  GLOBAL_LIMIT_PER_MIN?: string;
  MAX_GAS_TGAS?: string;
}

export const bodySchema = z.object({ signed_delegate: z.string().min(40).max(12_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict();

const ACTION_DELEGATE = 8;
const nonces = new Map<string, bigint>(); // per-isolate cache so concurrent relays do not reuse a nonce
let senderLimit: RateLimiter | undefined;
let globalLimit: RateLimiter | undefined;

export function resetState() { nonces.clear(); senderLimit = undefined; globalLimit = undefined; }

export function policyFrom(env: Env): Policy {
  const cap = env.MAX_GAS_TGAS ? BigInt(env.MAX_GAS_TGAS) * 10n ** 12n : MAX_GAS;
  return { allowedReceivers: parseList(env.ALLOWED_RECEIVERS), maxGas: cap < MAX_GAS ? cap : MAX_GAS, expiryMargin: 4n };
}

export const depsFor = (env: Env): RpcDeps => ({
  urls: (env.RPC_URLS ?? DEFAULT_RPCS).split(",").map((s) => s.trim()).filter(Boolean),
  fetch: (...a) => fetch(...a),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
});

function buildRelayTx(env: Env, relayerPk: Uint8Array, seed: Uint8Array, receiver: string, nonce: bigint, blockHash: string, signedDelegate: Uint8Array) {
  const tx = new Writer()
    .str(env.RELAYER_ACCOUNT).u8(0).bytes(relayerPk).uint(nonce, 8).str(receiver).bytes(bs58.decode(blockHash))
    .uint(1n, 4).u8(ACTION_DELEGATE).bytes(signedDelegate)
    .done();
  const digest = sha256(tx);
  const signed = new Writer().bytes(tx).u8(0).bytes(ed25519.sign(digest, seed)).done();
  return { hash: bs58.encode(digest), base64: btoa(String.fromCharCode(...signed)) };
}

export async function relayDelegate(raw: unknown, env: Env, deps: RpcDeps = depsFor(env), now = Date.now()): Promise<{ hash: string }> {
  if (!env.RELAYER_ACCOUNT || !env.RELAYER_KEY || !env.ALLOWED_RECEIVERS) {
    throw new RelayError("NOT_CONFIGURED", "relayer is not configured", 503);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) throw new RelayError("BAD_REQUEST", "expected { signed_delegate: <base64> }");

  let signed;
  try { signed = decodeSignedDelegate(fromBase64(parsed.data.signed_delegate)); }
  catch (e) {
    if (e instanceof DelegateDecodeError) throw new RelayError(e.code, e.message, e.code === "ACTION_NOT_ALLOWED" ? 403 : 400);
    throw new RelayError("BAD_BORSH", "not valid base64");
  }
  const policy = policyFrom(env);
  checkStatic(signed, policy);

  senderLimit ??= new RateLimiter(Number(env.RATE_LIMIT_PER_MIN ?? 20));
  globalLimit ??= new RateLimiter(Number(env.GLOBAL_LIMIT_PER_MIN ?? 120));
  senderLimit.check(signed.delegate.senderId, now);
  globalLimit.check("*", now);

  const d = signed.delegate;
  let head: bigint;
  let key: Parameters<typeof checkAccessKey>[1];
  try {
    const block = await rpc<{ header: { height: number } }>(deps, "block", { finality: "optimistic" });
    head = BigInt(block.header.height);
    checkExpiry(signed, head, policy);
    key = await rpc(deps, "query", { request_type: "view_access_key", finality: "optimistic", account_id: d.senderId, public_key: d.publicKey });
  } catch (e) {
    if (e instanceof RpcAnswer) throw new RelayError("KEY_NOT_FOUND", `sender ${d.senderId} has no such access key`);
    throw e;
  }
  checkAccessKey(signed, key, head);

  const seed = bs58.decode(env.RELAYER_KEY.replace(/^ed25519:/, "")).slice(0, 32);
  const relayerPk = ed25519.getPublicKey(seed);
  const relayerPkStr = `ed25519:${bs58.encode(relayerPk)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const ak = await rpc<{ nonce: number; block_hash: string }>(deps, "query", {
      request_type: "view_access_key", finality: "optimistic", account_id: env.RELAYER_ACCOUNT, public_key: relayerPkStr,
    });
    const nonce = [BigInt(ak.nonce), nonces.get(relayerPkStr) ?? 0n].reduce((a, b) => (a > b ? a : b)) + 1n;
    nonces.set(relayerPkStr, nonce);
    const tx = buildRelayTx(env, relayerPk, seed, d.senderId, nonce, ak.block_hash, fromBase64(parsed.data.signed_delegate));
    try {
      await rpc(deps, "send_tx", { signed_tx_base64: tx.base64, wait_until: "INCLUDED" });
      return { hash: tx.hash };
    } catch (e) {
      if (!(e instanceof RpcAnswer)) throw e;
      if (e.kind === "TIMEOUT_ERROR") return { hash: tx.hash }; // accepted, not yet included: the caller can poll the hash
      if (/InvalidNonce/.test(e.message)) continue; // lost a race with another relay: refetch and retry
      throw new RelayError("RELAY_REJECTED", `network rejected the transaction: ${e.message}`, 502);
    }
  }
  throw new RelayError("NONCE_CONTENTION", "could not obtain a relayer nonce, retry", 503);
}
