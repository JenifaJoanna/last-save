// npm test   (node --test). Refusal paths and the happy path of the build step, with the chain and the mirrors injected.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MAX_VAR_BYTES, buildCommunityHost } from "../lib/build.mjs";
import { chainFor } from "../lib/chain.mjs";
import { DEFAULT_INSTANCE, readVars, resolveConfig } from "../lib/config.mjs";
import { encryptBundle } from "../vendor/crypto.mjs";
import { ProvenanceError } from "../vendor/provenance.mjs";
import { Refusal } from "../vendor/refusal.mjs";
import { packTarGz } from "../vendor/tar.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const plain = packTarGz([
  { path: "wrangler.toml", data: Buffer.from('name = "x"\n') },
  { path: "worker/index.js", data: Buffer.from("export default {};\n") },
  { path: "assets/index.html", data: Buffer.from("<title>Ember Rift</title>") },
]);

function world(over = {}) {
  const key = randomBytes(32);
  const artifact = encryptBundle(plain, key);
  const blob = '{"at_ms":1,"game":"ember-rift","players":{},"seq":4}';
  const snap = { seq: 4, hash: sha(blob), blob_base64: Buffer.from(over.blob ?? blob).toString("base64"), at_ms: 1 };
  const chain = {
    info: async () => ({ status: over.released === false ? "Alive" : "Dead", released_key: over.released === false ? null : key.toString("hex") }),
    releaseInfo: async () => ({ artifact_urls: ["https://kiln-cdn-x.pages.dev/a.bin", "https://aggregator.walrus-testnet.walrus.space/v1/blobs/b"], artifact_sha256: sha(artifact),
      build_hash: over.buildHash ?? sha(plain), key_commitment: sha(key) }),
    snapshot: async () => snap,
  };
  const fetchBytes = async (u) => { if (u.includes("kiln-cdn")) throw new Error("HTTP 404"); return over.artifact ?? artifact; };
  return { chain, fetchBytes, artifact };
}
const dir = () => mkdtempSync(join(tmpdir(), "community-host-"));
const run = (root, w, extra = {}) => buildCommunityHost({ root, env: { HOST_ID: "fan.testnet" }, chain: w.chain, fetchBytes: w.fetchBytes, provenance: null, log: () => {}, ...extra });
const refusal = async (p) => { try { await p; } catch (e) { assert.ok(e instanceof Refusal, `expected a Refusal, got ${e}`); return e; } assert.fail("expected a refusal"); };

test("happy path: studio 404 falls back to walrus, unpacks, and prepares the deploy variables with the snapshot", async () => {
  const root = dir(), lines = [];
  const out = await run(root, world(), { log: (s) => lines.push(s) });
  assert.equal(out.buildHash, sha(plain));
  assert.equal(readFileSync(join(root, "bundle/worker/index.js"), "utf8"), "export default {};\n");
  const vars = JSON.parse(readFileSync(join(root, ".build/vars.json"), "utf8"));
  assert.equal(vars.HOST_ID, "fan.testnet");
  assert.equal(vars.BUILD_HASH, sha(plain));
  assert.equal(JSON.parse(vars.RESTORE_SNAPSHOT).seq, 4);
  assert.ok(lines.some((l) => /studio copy .* 404 \(gone\)/.test(l)) && lines.some((l) => /^walrus .* sha256 matches on-chain/.test(l)));
  rmSync(root, { recursive: true, force: true });
});

test("refuses an instance that has not released its key, and writes no bundle", async () => {
  const root = dir();
  const e = await refusal(run(root, world({ released: false })));
  assert.equal(e.code, "not_released");
  assert.equal(existsSync(join(root, "bundle")), false);
  assert.equal(existsSync(join(root, ".build/vars.json")), false);
  rmSync(root, { recursive: true, force: true });
});

test("refuses an artifact whose sha256 differs from the chain (tampered mirror)", async () => {
  const root = dir(), w = world();
  const bad = Buffer.from(w.artifact); bad[70] ^= 1;
  const e = await refusal(run(root, world({ artifact: bad })));
  assert.equal(e.code, "artifact_tampered");
  assert.equal(existsSync(join(root, "bundle")), false);
  rmSync(root, { recursive: true, force: true });
});

test("refuses a bundle whose hash differs from the committed build_hash", async () => {
  const root = dir();
  assert.equal((await refusal(run(root, world({ buildHash: "0".repeat(64) })))).code, "build_mismatch");
  assert.equal(existsSync(join(root, "bundle")), false);
  rmSync(root, { recursive: true, force: true });
});

test("provenance: digest mismatch refuses, unreachable only warns", async () => {
  const root = dir(), lines = [];
  const e = await refusal(run(root, world(), { provenance: async () => { throw new ProvenanceError("digest_mismatch", "attested another digest"); } }));
  assert.equal(e.code, "provenance_digest_mismatch");
  await run(root, world(), { provenance: async () => { throw new ProvenanceError("unreachable", "HTTP 403"); }, log: (s) => lines.push(s) });
  assert.ok(lines.some((l) => l.startsWith("WARNING: provenance not checked (unreachable)")));
  rmSync(root, { recursive: true, force: true });
});

test("refuses a snapshot too large for a Worker variable instead of dropping progress", async () => {
  const root = dir();
  const big = JSON.stringify({ at_ms: 1, game: "ember-rift", players: {}, seq: 4, pad: "x".repeat(MAX_VAR_BYTES) });
  const w = world();
  w.chain.snapshot = async () => ({ seq: 4, hash: sha(big), blob_base64: Buffer.from(big).toString("base64"), at_ms: 1 });
  assert.equal((await refusal(run(root, w))).code, "snapshot_too_large");
  rmSync(root, { recursive: true, force: true });
});

test("config: build variable beats wrangler.toml beats the default; bad ids are refused", async () => {
  const toml = '[vars]\nLICENCE_CONTRACT = "a-game.lastsave-factory.testnet"\nHOST_ID = "me.testnet"\n';
  assert.deepEqual(readVars(toml), { LICENCE_CONTRACT: "a-game.lastsave-factory.testnet", HOST_ID: "me.testnet" });
  assert.equal(resolveConfig({ env: {}, toml }).instance, "a-game.lastsave-factory.testnet");
  assert.equal(resolveConfig({ env: { LICENCE_CONTRACT: "b.lastsave-factory.testnet" }, toml }).tag, "build-b");
  assert.equal(resolveConfig({ env: {}, toml: "" }).instance, DEFAULT_INSTANCE);
  assert.throws(() => resolveConfig({ env: { LICENCE_CONTRACT: "Not An Account!" } }), /not a NEAR account id/);
  assert.throws(() => resolveConfig({ env: { RPC_URLS: "http://insecure" } }), /https/);
  const root = dir();
  assert.equal((await refusal(buildCommunityHost({ root, env: { LICENCE_CONTRACT: "x y" }, chain: {}, log: () => {} }))).code, "bad_config");
  rmSync(root, { recursive: true, force: true });
});

test("chain: an account that is not a licence instance is a refusal, not a stack trace", async () => {
  const f = async () => ({ status: 200, json: async () => ({ result: { error: "wasm execution failed: MethodNotFound" } }) });
  const e = await refusal(chainFor("nope.testnet", ["https://rpc.example"], f).info());
  assert.equal(e.code, "no_instance");
  const g = async () => ({ status: 200, json: async () => ({ error: { cause: { name: "UNKNOWN_ACCOUNT" } } }) });
  assert.equal((await refusal(chainFor("nope.testnet", ["https://rpc.example"], g).info())).code, "no_instance");
});

test("a refused build removes any bundle left by an earlier build", async () => {
  const root = dir();
  await run(root, world());
  assert.ok(existsSync(join(root, "bundle/worker/index.js")));
  await refusal(run(root, world({ released: false })));
  assert.equal(existsSync(join(root, "bundle")), false);
  rmSync(root, { recursive: true, force: true });
});

test("vendor/ is in sync with host/ and server-bundle/ (repository checkout only)", async (t) => {
  const sync = join(import.meta.dirname, "../../scripts/sync-community-host.mjs");
  if (!existsSync(sync)) return t.skip("not inside the Last Save repository");
  const { expected } = await import(sync);
  const cwd = process.cwd();
  process.chdir(join(import.meta.dirname, "../.."));
  try { for (const [path, text] of expected()) assert.equal(readFileSync(path, "utf8"), text, `${path} is stale: run node scripts/sync-community-host.mjs`); } finally { process.chdir(cwd); }
});
