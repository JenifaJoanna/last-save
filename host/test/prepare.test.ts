import { randomBytes, createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { encryptBundle } from "server-bundle/crypto";
import { packTarGz } from "server-bundle/tar";
import { claimableEpochs } from "../lib/claims.mjs";
import { prepare } from "../lib/prepare.mjs";
import { Refusal } from "../lib/refusal.mjs";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function world(over: { released?: boolean; snapshotBlob?: string; snapshotHash?: string | null } = {}) {
  const key = randomBytes(32);
  const plain = packTarGz([
    { path: "wrangler.toml", data: Buffer.from('name = "ember-rift-host"\n') },
    { path: "worker/index.js", data: Buffer.from("export default {};\n") },
    { path: "assets/index.html", data: Buffer.from("<title>Ember Rift</title>") },
  ]);
  const artifact = encryptBundle(plain, key);
  const snapBlob = over.snapshotBlob ?? '{"at_ms":1,"game":"ember-rift","players":{},"seq":4}';
  const snapshot = over.snapshotHash === null ? null : { seq: 4, hash: over.snapshotHash ?? sha(snapBlob), blob_base64: Buffer.from(snapBlob).toString("base64"), at_ms: 1 };
  const chain = {
    info: async () => ({ status: over.released === false ? "Alive" : "Dead", released_key: over.released === false ? null : key.toString("hex") }),
    releaseInfo: async () => ({ artifact_urls: ["https://mirror.one/a.bin", "https://mirror.two/a.bin"], artifact_sha256: sha(artifact), build_hash: sha(plain), key_commitment: sha(key), status: "Dead" }),
    snapshot: async () => snapshot,
  };
  return { key, plain, artifact, chain, buildHash: sha(plain) };
}
const workDir = () => { const d = mkdtempSync(join(tmpdir(), "lastsave-host-")); dirs.push(d); return d; };
const serve = (bytes: Buffer) => async () => bytes;
const refused = async (p: Promise<unknown>) => { try { await p; } catch (e) { expect(e).toBeInstanceOf(Refusal); return e as Refusal; } throw new Error("expected a refusal"); };

describe("host prepare", () => {
  it("verifies, decrypts and unpacks a good release into .host/<build_hash>", async () => {
    const w = world(), wd = workDir();
    const r = await prepare({ chain: w.chain, fetchBytes: serve(w.artifact), workDir: wd });
    expect(r.buildHash).toBe(w.buildHash);
    expect(r.dir).toBe(join(wd, w.buildHash));
    expect(readFileSync(join(r.dir, "worker/index.js"), "utf8")).toBe("export default {};\n");
    expect(existsSync(join(r.dir, "assets/index.html"))).toBe(true);
    expect(r.restore).toMatchObject({ seq: 4 });
  });

  it("refuses when the key has not been released", async () => {
    const w = world({ released: false });
    expect((await refused(prepare({ chain: w.chain, fetchBytes: serve(w.artifact), workDir: workDir() }))).code).toBe("not_released");
  });

  it("refuses a tampered artifact and writes nothing", async () => {
    const w = world(), wd = workDir();
    const bad = Buffer.from(w.artifact); bad[60] ^= 1;
    const e = await refused(prepare({ chain: w.chain, fetchBytes: serve(bad), workDir: wd }));
    expect(e.code).toBe("artifact_tampered");
    expect(e.message).toMatch(/tampered/);
    expect(existsSync(join(wd, w.buildHash))).toBe(false);
  });

  it("falls back to a second mirror when the first is tampered", async () => {
    const w = world();
    const bad = Buffer.from(w.artifact); bad[70] ^= 1;
    const logs: string[] = [];
    const r = await prepare({ chain: w.chain, workDir: workDir(), log: (s: string) => logs.push(s),
      fetchBytes: async (u: string) => (u.includes("mirror.one") ? bad : w.artifact) });
    expect(r.buildHash).toBe(w.buildHash);
    expect(logs.join("\n")).toContain("mirror.two");
  });

  it("refuses an unreachable set of mirrors", async () => {
    const w = world();
    const e = await refused(prepare({ chain: w.chain, workDir: workDir(), fetchBytes: async () => { throw new Error("HTTP 404"); } }));
    expect(e.code).toBe("artifact_unavailable");
  });

  it("refuses a released key that does not match the commitment", async () => {
    const w = world();
    const chain = { ...w.chain, info: async () => ({ status: "Dead", released_key: randomBytes(32).toString("hex") }) };
    expect((await refused(prepare({ chain, fetchBytes: serve(w.artifact), workDir: workDir() }))).code).toBe("key_mismatch");
  });

  it("refuses when the artifact was encrypted under a different key than the committed one", async () => {
    const w = world();
    const other = encryptBundle(w.plain, randomBytes(32));
    const chain = { ...w.chain, releaseInfo: async () => ({ ...(await w.chain.releaseInfo()), artifact_sha256: sha(other) }) };
    const e = await refused(prepare({ chain, fetchBytes: serve(other), workDir: workDir() }));
    expect(e.code).toBe("decrypt_failed");
    expect(e.message).toMatch(/wrong key/);
  });

  it("refuses a bundle whose hash differs from the committed build_hash", async () => {
    const w = world();
    const chain = { ...w.chain, releaseInfo: async () => ({ ...(await w.chain.releaseInfo()), build_hash: "0".repeat(64) }) };
    expect((await refused(prepare({ chain, fetchBytes: serve(w.artifact), workDir: workDir() }))).code).toBe("build_mismatch");
  });

  it("refuses a snapshot whose blob does not hash to the recorded hash", async () => {
    const w = world({ snapshotHash: "ab".repeat(32) });
    const e = await refused(prepare({ chain: w.chain, fetchBytes: serve(w.artifact), workDir: workDir() }));
    expect(e.code).toBe("snapshot_mismatch");
  });

  it("refuses a snapshot that differs from the hash listed in get_info", async () => {
    const w = world();
    const chain = { ...w.chain, info: async () => ({ ...(await w.chain.info()), snapshot: { hash: "cd".repeat(32) } }) };
    expect((await refused(prepare({ chain, fetchBytes: serve(w.artifact), workDir: workDir() }))).code).toBe("snapshot_mismatch");
  });

  it("starts fresh when no snapshot was ever posted", async () => {
    const w = world({ snapshotHash: null });
    expect((await prepare({ chain: w.chain, fetchBytes: serve(w.artifact), workDir: workDir() })).restore).toBeNull();
  });
});

describe("claims", () => {
  it("lists completed epochs not yet claimed by this host", () => {
    const claims = [{ host_id: "lastsave-fanhost.testnet", epoch: 0 }, { host_id: "other.testnet", epoch: 1 }];
    expect(claimableEpochs({ info: { current_epoch: 3 }, claims, account: "lastsave-fanhost.testnet" })).toEqual([1, 2]);
    expect(claimableEpochs({ info: { current_epoch: null }, claims, account: "x" })).toEqual([]);
    expect(claimableEpochs({ info: { current_epoch: 0 }, claims: [], account: "x" })).toEqual([]);
  });
});
