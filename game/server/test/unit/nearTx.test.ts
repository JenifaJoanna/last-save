import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import bs58 from "bs58";
import { generateSessionKey, publicKeyOf, fromBase64 } from "../../../shared/auth";
import { buildSignedTx } from "../../src/nearTx";

const require = createRequire(import.meta.url);

describe("post_snapshot transaction encoding", () => {
  it("decodes with near-api-js and carries a valid signature", () => {
    const k = generateSessionKey();
    const blockHash = bs58.encode(new Uint8Array(32).fill(5));
    const args = { seq: 3, hash: "ab".repeat(32), blob_base64: "e30=" };
    const tx = buildSignedTx({ signerId: "lastsave-studio.testnet", signerSecret: k.secret, receiverId: "lastsave-licence.testnet", nonce: 42n,
      blockHash, method: "post_snapshot", args, gas: 100_000_000_000_000n, deposit: 0n });
    const near = require("near-api-js");
    const signed = near.transactions.SignedTransaction.decode(Buffer.from(fromBase64(tx.base64)));
    expect(signed.transaction.signerId).toBe("lastsave-studio.testnet");
    expect(signed.transaction.receiverId).toBe("lastsave-licence.testnet");
    expect(`ed25519:${bs58.encode(signed.transaction.publicKey.ed25519Key.data)}`).toBe(publicKeyOf(k.secret));
    expect(BigInt(signed.transaction.nonce)).toBe(42n);
    const fc = signed.transaction.actions[0].functionCall;
    expect(fc.methodName).toBe("post_snapshot");
    expect(JSON.parse(Buffer.from(fc.args).toString())).toEqual(args);
    expect(BigInt(fc.gas)).toBe(100_000_000_000_000n);
    expect(BigInt(fc.deposit)).toBe(0n);
    const digest = sha256(near.utils.serialize.serialize(near.transactions.SCHEMA.Transaction, signed.transaction));
    expect(bs58.encode(digest)).toBe(tx.hash);
    expect(ed25519.verify(Uint8Array.from(signed.signature.ed25519Signature.data), digest, ed25519.getPublicKey(bs58.decode(k.secret.slice(8)).slice(0, 32)))).toBe(true);
  });
});
