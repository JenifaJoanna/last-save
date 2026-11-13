// Minimal NEAR transaction builder/signer (borsh) for one function-call action. Runs in Workers (no Node APIs).
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import bs58 from "bs58";
import { decodeSecretKey, toBase64 } from "../../shared/auth";

class Writer {
  private parts: number[] = [];
  u8(n: number) { this.parts.push(n & 0xff); return this; }
  uint(n: bigint, bytes: number) { for (let i = 0; i < bytes; i++) this.parts.push(Number((n >> BigInt(8 * i)) & 0xffn)); return this; }
  bytes(b: Uint8Array) { for (const x of b) this.parts.push(x); return this; }
  vec(b: Uint8Array) { this.uint(BigInt(b.length), 4); return this.bytes(b); }
  str(s: string) { return this.vec(new TextEncoder().encode(s)); }
  done() { return Uint8Array.from(this.parts); }
}

export interface FunctionCallTx {
  signerId: string;
  signerSecret: string; // ed25519:<b58>
  receiverId: string;
  nonce: bigint;
  blockHash: string; // base58
  method: string;
  args: unknown;
  gas: bigint;
  deposit: bigint;
}

export function buildSignedTx(t: FunctionCallTx): { hash: string; base64: string } {
  const seed = decodeSecretKey(t.signerSecret);
  const pub = ed25519.getPublicKey(seed);
  const tx = new Writer()
    .str(t.signerId).u8(0).bytes(pub).uint(t.nonce, 8).str(t.receiverId).bytes(bs58.decode(t.blockHash))
    .uint(1n, 4) // one action
    .u8(2) // FunctionCall
    .str(t.method).vec(new TextEncoder().encode(JSON.stringify(t.args))).uint(t.gas, 8).uint(t.deposit, 16)
    .done();
  const digest = sha256(tx);
  const sig = ed25519.sign(digest, seed);
  const signed = new Writer().bytes(tx).u8(0).bytes(sig).done();
  return { hash: bs58.encode(digest), base64: toBase64(signed) };
}
