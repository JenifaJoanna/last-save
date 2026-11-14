// Run: node --test web/src/lib/eip6963.test.ts
// The payout binding refuses a signature that does not recover to the address it names.
import assert from "node:assert/strict";
import { test } from "node:test";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { payoutMessage, recoverSigner } from "./eip6963.ts";

const hex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");
const enc = (s: string) => new TextEncoder().encode(s);

function sign191(priv: Uint8Array, message: string): string {
  const m = enc(message);
  const digest = keccak_256(new Uint8Array([...enc(`\x19Ethereum Signed Message:\n${m.length}`), ...m]));
  const s = secp256k1.sign(digest, priv);
  return `0x${hex(s.toCompactRawBytes())}${(27 + (s.recovery ?? 0)).toString(16)}`;
}
const addressOf = (priv: Uint8Array) => `0x${hex(keccak_256(secp256k1.getPublicKey(priv, false).slice(1)).slice(-20))}`;

test("recovers the signing address from a personal_sign signature", () => {
  const priv = secp256k1.utils.randomPrivateKey();
  const addr = addressOf(priv);
  const msg = payoutMessage("fan.testnet", "v2dev.lastsave-factory.testnet", addr, "2026-11-14T18:00:00.000Z");
  assert.equal(recoverSigner(msg, sign191(priv, msg)), addr);
});

test("a signature over a different message or by a different key does not recover to the address", () => {
  const a = secp256k1.utils.randomPrivateKey();
  const b = secp256k1.utils.randomPrivateKey();
  const addr = addressOf(a);
  const msg = payoutMessage("fan.testnet", "v2dev.lastsave-factory.testnet", addr, "2026-11-14T18:00:00.000Z");
  assert.notEqual(recoverSigner(msg, sign191(b, msg)), addr);
  assert.notEqual(recoverSigner(`${msg} `, sign191(a, msg)), addr);
});

test("the message binds the address, the host account and the licence contract", () => {
  const msg = payoutMessage("fan.testnet", "v2dev.lastsave-factory.testnet", "0xABCDEF0000000000000000000000000000000001", "t");
  assert.match(msg, /0xabcdef0000000000000000000000000000000001/);
  assert.match(msg, /Host account: fan\.testnet/);
  assert.match(msg, /Licence contract: v2dev\.lastsave-factory\.testnet/);
});
