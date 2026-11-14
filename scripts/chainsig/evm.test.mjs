// node --test scripts/chainsig/evm.test.mjs  (fixtures signed with viem and a throwaway key, both formats)
import assert from "node:assert/strict";
import test from "node:test";
import { fmtEth, parseRawTx } from "./evm.mjs";

const FROM = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A".toLowerCase();
const DEAD = "0x000000000000000000000000000000000000dead";
const EIP1559 = "0x02f87483014a3407830f4240847735940082520894000000000000000000000000000000000000dead88112210f47de9811580c001a093df9123455d67df05a139b595c8fffef842eacf927576fd57e3733501694718a033bed8115e1b7966e2b3192a63e6b9be2de580e6bbdc68efabcc1d91597505c0";
const LEGACY = "0xf86882012c8459682f0082520894000000000000000000000000000000000000dead05808302948ca0d936e7ce1434a016156f1491277e335c4eda6129912107763230414d15a4a99ea020cb48150a046532784fd81d5a0a22ebd677639922d203e0e7fbcd847921d3f6";

test("EIP-1559 tx: fields and recovered sender", () => {
  const t = parseRawTx(EIP1559);
  assert.equal(t.type, 2);
  assert.equal(t.chainId, 84532n);
  assert.equal(t.nonce, 7n);
  assert.equal(t.to, DEAD);
  assert.equal(t.value, 1234567890123456789n);
  assert.equal(t.maxFeePerGas, 2000000000n);
  assert.equal(t.from, FROM);
});

test("legacy EIP-155 tx: fields and recovered sender", () => {
  const t = parseRawTx(LEGACY);
  assert.equal(t.type, 0);
  assert.equal(t.chainId, 84532n);
  assert.equal(t.nonce, 300n);
  assert.equal(t.value, 5n);
  assert.equal(t.from, FROM);
});

test("a flipped signature byte recovers a different sender (never the contract's)", () => {
  const bad = `${EIP1559.slice(0, -4)}c1${EIP1559.slice(-2)}`;
  assert.notEqual(parseRawTx(bad).from, FROM);
});

test("fmtEth", () => {
  assert.equal(fmtEth(0n), "0.0");
  assert.equal(fmtEth(1234567890123456789n), "1.234567890123456789");
  assert.equal(fmtEth(10n ** 15n), "0.001");
});
