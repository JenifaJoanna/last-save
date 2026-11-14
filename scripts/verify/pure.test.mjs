// node --test scripts/verify/   (offline: known-answer vectors taken from chain state and the committed artifacts)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyTx, decryptArtifact, deriveAddress, encryptArtifact, checkReleasedKey, hexToB58, normHash, sameAddress, sameHash, sanityTotals, sha256Hex, txsFromJson, txsFromMarkdown } from "./pure.mjs";

// v1.signer-prod.testnet public_key(): a PUBLIC key. Split only so the secret scanner's "secp256k1:<base58>" private-key pattern does not misfire on it.
const ROOT_KEY = `secp256k1:${"4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3"}`;
const V1_K = "fb0ac47f464bb2c8d5cb1b162c35185bd9c965b9278e8bf95c136c642717e490"; // released on lastsave-licence.testnet, public
const artifact = () => readFileSync(new URL("../../artifacts/ember-rift-ad3eb4f5560a8ae0.bin", import.meta.url));

test("hash compare accepts hex and base58 forms of the same sha256, rejects everything else", () => {
  const hex = "c884be5a4e263cdd1d85ae63722d457961e751d6cbbe8ae190953d7c254b16d2";
  assert.equal(hexToB58(hex), "EVjwSZr7k9dx6mejPys2LW8Ap2JJx2se2Q1PqMHP3eJM");
  assert.ok(sameHash(hex, "EVjwSZr7k9dx6mejPys2LW8Ap2JJx2se2Q1PqMHP3eJM"));
  assert.ok(sameHash(hex.toUpperCase(), hex));
  assert.ok(!sameHash(hex, "4AwoknekGdP3CMhHFpCJyDUCXnF6Rp79snrVr23i6rt1"));
  assert.equal(normHash("not a hash"), null);
  assert.equal(normHash("abcd"), null);
  assert.equal(normHash(undefined), null);
});

test("payer address re-derivation matches the live v2dev instance (known answer)", () => {
  const a = deriveAddress(ROOT_KEY, "v2dev.lastsave-factory.testnet", "lastsave/host-payouts");
  assert.ok(sameAddress(a, "0xfe8a6a6a417e3ccc4d73191c62361207dfe01aea"));
  assert.ok(!sameAddress(deriveAddress(ROOT_KEY, "other.lastsave-factory.testnet", "lastsave/host-payouts"), a));
  assert.ok(!sameAddress(deriveAddress(ROOT_KEY, "v2dev.lastsave-factory.testnet", "other/path"), a));
});

test("released v1 key decrypts the committed artifact to the on-chain build hash", () => {
  const r = checkReleasedKey({ keyHex: V1_K, commitment: "5bb6b0cf211414cdcf27e6f836a03b242cf13f1e8b372845ed2e3d8230c6678f", artifact: artifact(), buildHash: "b723c6d4854b1b8688a0a4a1191dda26d0492d6cf28a26cd1c88e7ac222bc967" });
  assert.deepEqual([r.keyOk, r.decrypted, r.buildOk], [true, true, true]);
});

test("decryption refuses a wrong key, a flipped byte, a missing header and a malformed key", () => {
  const f = artifact();
  assert.throws(() => decryptArtifact(f, "00".repeat(32)), /authentication failed/);
  const t = Buffer.from(f); t[100] ^= 1;
  assert.throws(() => decryptArtifact(t, V1_K), /authentication failed/);
  assert.throws(() => decryptArtifact(Buffer.from("nope".repeat(20)), V1_K), /missing LSV1/);
  assert.throws(() => decryptArtifact(f, "zz"), /64 lowercase hex/);
  const wrongBuild = checkReleasedKey({ keyHex: V1_K, commitment: "x", artifact: f, buildHash: "0".repeat(64) });
  assert.deepEqual([wrongBuild.keyOk, wrongBuild.decrypted, wrongBuild.buildOk], [false, true, false]);
});

test("encrypt/decrypt round trip in the documented LSV1 format", () => {
  const k = "11".repeat(32), plain = Buffer.from("server bundle");
  const enc = encryptArtifact(plain, k, Buffer.alloc(12, 7));
  assert.equal(enc.subarray(0, 4).toString(), "LSV1");
  assert.equal(enc.length, 4 + 12 + plain.length + 16);
  assert.deepEqual(decryptArtifact(enc, k), plain);
  assert.equal(sha256Hex(plain).length, 64);
});

test("totals sanity: negative buckets and an uncovered balance are caught", () => {
  const acct = { amount: (3n * 10n ** 24n).toString(), storage_usage: 1000 };
  const good = { pot_locked: "400000000000000000000000", pool: "0", evm_settled: "0", ops_budget: "1000000000000000000000000", supply: 4, live_supply: 4 };
  assert.ok(sanityTotals(good, acct).ok);
  assert.ok(!sanityTotals({ ...good, pool: "-1" }, acct).ok);
  assert.ok(!sanityTotals({ ...good, live_supply: 5 }, acct).ok);
  assert.match(sanityTotals({ ...good, ops_budget: (9n * 10n ** 24n).toString() }, acct).problems[0], /spendable/);
  assert.ok(sanityTotals({ pot_locked: "0", pool: "5", supply: 1, live_supply: 1 }, acct).ok); // v1 has no ops_budget / evm_settled
});

test("manifest parsing: markdown links and JSON fields, recorded refusals expected to fail", () => {
  const h1 = "33hTa6khdCc94xTwPPFAC1SC7PpSwEWTkeUFN25WLxUr", h2 = "4Ztpt7PFKdWUTawGrQ5aA53PXnNCVtvHt6Fk2eVpYvMH", h3 = "2dKyuwVqJT212Wcs9qjwy9nRCtxdDqMSxnST1LzHM5t2";
  const md = `| 02:26 | deploy | [33hT…](https://testnet.near.rocks/tx/${h1}) | x |\n| 02:27 | escrow | [4Ztp…](https://testnet.nearblocks.io/txns/${h2}) |\n[again](https://testnet.near.rocks/tx/${h1})`;
  assert.deepEqual(txsFromMarkdown(md).map((t) => t.hash), [h1, h2]);
  const json = { steps: [{ step: "deploy", hash: h1, url: `https://x/txns/${h1}` }], phases: [{ txs: [{ label: "choose again", hash: h3, failure: { ActionError: {} } }] }], note: "not a hash" };
  const got = txsFromJson(json);
  assert.deepEqual(got.map((t) => [t.hash, t.expect]), [[h1, "success"], [h3, "failure"]]);
});

test("tx classification: success, failure in a receipt, not final", () => {
  assert.deepEqual(classifyTx({ final_execution_status: "FINAL", status: { SuccessValue: "" }, receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }] }), { final: true, ok: true, failure: null });
  assert.equal(classifyTx({ final_execution_status: "FINAL", status: { SuccessValue: "" }, receipts_outcome: [{ outcome: { status: { Failure: { x: 1 } } } }] }).ok, false);
  const bounce = { final_execution_status: "FINAL", status: { SuccessValue: "" }, receipts_outcome: [{ outcome: { status: { Failure: { ActionError: { kind: { AccountDoesNotExist: { account_id: "x" } } } } } } }] };
  assert.equal(classifyTx(bounce).ok, true); // DeleteAccount: the refund receipt bounces off the deleted account
  assert.equal(classifyTx({ final_execution_status: "INCLUDED", status: "Started", receipts_outcome: [] }).final, false);
});
