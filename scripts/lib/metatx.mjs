// Node helper for NEP-366 meta-transactions. Thin wrapper over relayer/client/delegate.ts (one implementation,
// byte-compatible with @near-js/transactions: see relayer/test). Needs Node >= 22.18 (native TypeScript import).
//
//   const b64 = await signDelegate({ senderId, keyPair, receiverId, actions: [{ methodName, args, gas }], blockHeightTtl: 200 });
//   const { hash } = await relay("https://<relayer>.pages.dev", b64);
import { rpc } from "./near.mjs";
import {
  publicKeyFromSecret, relay as relayCall, signDelegate as signDelegateRaw, signerFromSecret,
} from "../../relayer/client/delegate.ts";

export { relayCall as relay };

/**
 * keyPair: a near-api-js KeyPair, or a secret key string "ed25519:...".
 * actions: [{ methodName, args (object or Uint8Array), gas? (bigint, default 100 Tgas) }]. Deposits are always 0.
 * blockHeightTtl: blocks the delegate stays valid (default 300, about 5 minutes).
 * Reads the live access-key nonce and block height over RPC unless `nonce` / `maxBlockHeight` are passed.
 */
export async function signDelegate({ senderId, keyPair, receiverId, actions, blockHeightTtl = 300, nonce, maxBlockHeight }) {
  const secret = typeof keyPair === "string" ? keyPair : keyPair.toString();
  const publicKey = publicKeyFromSecret(secret);
  if (nonce === undefined || maxBlockHeight === undefined) {
    const [ak, block] = await Promise.all([
      rpc("query", { request_type: "view_access_key", finality: "optimistic", account_id: senderId, public_key: publicKey }),
      rpc("block", { finality: "optimistic" }),
    ]);
    nonce ??= BigInt(ak.nonce) + 1n;
    maxBlockHeight ??= BigInt(block.header.height) + BigInt(blockHeightTtl);
  }
  return signDelegateRaw(
    { senderId, receiverId, publicKey, nonce: BigInt(nonce), maxBlockHeight: BigInt(maxBlockHeight), actions },
    signerFromSecret(secret),
  );
}
