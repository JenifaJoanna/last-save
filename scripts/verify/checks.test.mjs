// Checks against fixtures (no network): mirror classification, payout receipts, and the not-applicable paths.
import assert from "node:assert/strict";
import test from "node:test";
import { CHECKS as artifactChecks, classifyMirrors } from "./checks-artifact.mjs";
import { checkPayout } from "./checks-evm.mjs";
import { CHECKS as proofChecks } from "./checks-proof.mjs";
import { makeContext } from "./context.mjs";
import { resolveInstance } from "./instances.mjs";

const dl = (label, sha256, extra = {}) => ({ url: `https://${label}.test/f`, label, sha256, bytes: sha256 ? Buffer.from("x") : undefined, ...extra });

test("mirror classification: served, tampered, 404, unreachable, HTML shell", () => {
  const html = { ...dl("pages", "other"), bytes: Buffer.from("<!doctype html><html>") };
  const c = classifyMirrors([dl("a", "want"), dl("b", "evil"), dl("c", null, { status: 404 }), dl("d", null, { status: 0 }), html], "want");
  assert.deepEqual([c.served.length, c.tampered.length, c.gone.length, c.errored.length], [1, 1, 2, 1]);
});

const FROM = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A", DEAD = "0x000000000000000000000000000000000000dead";
const RAW = "0x02f87483014a3407830f4240847735940082520894000000000000000000000000000000000000dead88112210f47de9811580c001a093df9123455d67df05a139b595c8fffef842eacf927576fd57e3733501694718a033bed8115e1b7966e2b3192a63e6b9be2de580e6bbdc68efabcc1d91597505c0";
const payout = { id: 0, host_id: "h.testnet", status: "Signed", to: DEAD, value_wei: "1234567890123456789", signed_tx: RAW, signed_txs: [RAW], tx_hash: "0xabc", tx_hashes: ["0xabc"] };

test("payout check: mined, not yet broadcast, wrong sender, reverted", async () => {
  const mined = await checkPayout(payout, FROM, async () => ({ status: "0x1", blockNumber: "0x10" }));
  assert.equal(mined.state, "mined"); assert.match(mined.link, /sepolia\.basescan\.org\/tx\/0xabc/);
  assert.equal((await checkPayout(payout, FROM, async () => null)).state, "signed");
  assert.equal((await checkPayout(payout, DEAD, async () => null)).state, "bad");
  assert.equal((await checkPayout({ ...payout, value_wei: "1" }, FROM, async () => null)).state, "bad");
  assert.equal((await checkPayout(payout, FROM, async () => ({ status: "0x0", blockNumber: "0x10" }))).state, "reverted");
  assert.equal((await checkPayout({ ...payout, signed_tx: null, signed_txs: [] }, FROM, async () => null)).state, "unsigned");
});

const info = { status: "Alive", release: { released: false }, config: { artifact: { urls: ["https://a.test/x"], sha256: "s", build_hash: "b" }, key_commitment: "k" } };
const ctxFor = (name, deps = {}) => makeContext(resolveInstance(name), {}, { view: async () => info, ...deps });

test("not-applicable paths say why instead of passing", async () => {
  const get = (id) => [...artifactChecks, ...proofChecks].find((c) => c.id === id);
  const v1 = ctxFor("lastsave-licence.testnet");
  assert.equal((await get("provenance").run(v1)).status, "na");
  assert.equal((await get("artifact.walrus").run(v1)).status, "na");
  assert.equal((await get("release.key").run(v1)).status, "na");
  assert.match((await get("release.key").run(v1)).reason, /not released/);
});

test("provenance: not_found is n/a, a digest mismatch fails, unreachable warns, a verified bundle passes", async () => {
  const run = (err, ok) => proofChecks.find((c) => c.id === "provenance").run(ctxFor("ember-rift", { provenanceLib: {
    verifyProvenance: async () => { if (err) throw Object.assign(new Error("x"), { code: err }); return ok; }, describeProvenance: () => "built by workflow w at commit abc1234" } }));
  assert.equal((await run("not_found")).status, "na");
  assert.equal((await run("digest_mismatch")).status, "fail");
  assert.equal((await run("invalid")).status, "fail");
  assert.equal((await run("unreachable")).status, "warn");
  const good = await run(null, { rekorIndex: 5 });
  assert.equal(good.status, "pass"); assert.match(good.reason, /Rekor|logIndex=5/);
});
