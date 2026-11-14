import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { encryptBundle } from "server-bundle/crypto";
import { packTarGz } from "server-bundle/tar";
import { fetchFromMirrors, mirrorLabel } from "../lib/mirrors.mjs";
import { fetchVerifiedArtifact, prepare } from "../lib/prepare.mjs";
import { ProvenanceError, describeProvenance, readStatement, verifyProvenance } from "../lib/provenance.mjs";
import { Refusal } from "../lib/refusal.mjs";
import { parseStoreResponse, walrusStore, walrusVerify } from "../lib/walrus.mjs";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const REPO = "JenifaJoanna/last-save";
const WF = ".github/workflows/release-build.yml";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const STUDIO = "https://kiln-cdn-x.pages.dev/a.bin";
const WALRUS = "https://aggregator.walrus-testnet.walrus.space/v1/blobs/blob1";
const RAW = "https://raw.githubusercontent.com/JenifaJoanna/last-save/main/artifacts/a.bin";

function bundleFor(digest: string, over: { workflow?: string; commit?: string; predicateType?: string; logIndex?: string | null } = {}) {
  const statement = { _type: "https://in-toto.io/Statement/v1", subject: [{ name: "server-bundle.tar.gz", digest: { sha256: digest } }],
    predicateType: over.predicateType ?? "https://slsa.dev/provenance/v1",
    predicate: { buildDefinition: { externalParameters: { workflow: { ref: "refs/tags/build-x", repository: `https://github.com/${REPO}`, path: over.workflow ?? WF } },
      resolvedDependencies: [{ uri: "git+https://github.com/x", digest: { gitCommit: over.commit ?? COMMIT } }] },
      runDetails: { metadata: { invocationId: `https://github.com/${REPO}/actions/runs/9876543210/attempts/1` } } } };
  return { mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    verificationMaterial: { tlogEntries: over.logIndex === null ? [] : [{ logIndex: over.logIndex ?? "1234567", integratedTime: "1794650000" }] },
    dsseEnvelope: { payloadType: "application/vnd.in-toto+json", payload: Buffer.from(JSON.stringify(statement)).toString("base64"), signatures: [{ sig: "AA==" }] } };
}
const okSigner = { identity: { subjectAlternativeName: `https://github.com/${REPO}/${WF}@refs/tags/build-x` } };
const jsonRes = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: status < 400, status, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }, json: async () => body });
const apiFetch = (digest: string, over = {}) => async () => jsonRes(200, { attestations: [{ bundle: bundleFor(digest, over) }] });

describe("mirror fallback", () => {
  const good = Buffer.from("encrypted-bytes");
  const lines: string[] = [];
  it("labels the mirrors", () => {
    expect([STUDIO, WALRUS, RAW].map(mirrorLabel)).toEqual(["studio copy", "walrus", "github raw"]);
  });
  it("studio 404 -> walrus verified, stops there and prints one line each", async () => {
    lines.length = 0;
    const seen: string[] = [];
    const r = await fetchFromMirrors({ urls: [STUDIO, WALRUS, RAW], sha256: sha(good), log: (s: string) => lines.push(s),
      fetchBytes: async (u: string) => { seen.push(u); if (u === STUDIO) throw new Error("HTTP 404"); return good; } });
    expect(r.label).toBe("walrus");
    expect(seen).toEqual([STUDIO, WALRUS]);
    expect(lines[0]).toMatch(/^studio copy kiln-cdn-x\.pages\.dev … 404 \(gone\)$/);
    expect(lines[1]).toMatch(/^walrus aggregator\.walrus-testnet\.walrus\.space … 200, sha256 matches on-chain ✓/);
  });
  it("skips a mirror that serves the wrong bytes and reports tampering when none matches", async () => {
    const r = await fetchFromMirrors({ urls: [STUDIO, WALRUS], sha256: sha(good), fetchBytes: async () => Buffer.from("evil") });
    expect(r.bytes).toBeNull();
    expect(r.tampered).toBe(true);
    const r2 = await fetchFromMirrors({ urls: [STUDIO, WALRUS, RAW], sha256: sha(good), fetchBytes: async (u: string) => (u === STUDIO ? Buffer.from("evil") : good) });
    expect(r2.label).toBe("walrus");
  });
  it("network errors fall through too", async () => {
    const r = await fetchFromMirrors({ urls: [STUDIO, RAW], sha256: sha(good), fetchBytes: async (u: string) => { if (u === STUDIO) throw new Error("ECONNRESET"); return good; } });
    expect(r.label).toBe("github raw");
    expect(r.tried[0].outcome).toBe("error");
  });
});

describe("provenance", () => {
  const digest = sha("bundle");
  it("accepts a verified attestation and reads workflow, commit, run, Rekor", async () => {
    const p = await verifyProvenance({ digest, repo: REPO, fetchImpl: apiFetch(digest), verifyBundle: async () => okSigner });
    expect(p).toMatchObject({ workflow: WF, commit: COMMIT, runId: "9876543210", rekorIndex: 1234567, integratedTime: "2026-11-14T09:53:20.000Z" });
    expect(describeProvenance(p)).toBe(`built by workflow ${WF} at commit 0123456, logged 2026-11-14 09:53 UTC (Rekor #1234567)`);
  });
  it("refuses an attestation whose subject digest is not the on-chain build_hash", async () => {
    const other = sha("other");
    await expect(verifyProvenance({ digest, repo: REPO, fetchImpl: apiFetch(other), verifyBundle: async () => okSigner })).rejects.toMatchObject({ code: "digest_mismatch" });
    expect(() => readStatement(bundleFor(other), { repo: REPO, digest })).toThrow(/not the on-chain build_hash/);
  });
  it("refuses when sigstore verification fails", async () => {
    await expect(verifyProvenance({ digest, repo: REPO, fetchImpl: apiFetch(digest), verifyBundle: async () => { throw new Error("signature mismatch"); } })).rejects.toMatchObject({ code: "invalid" });
  });
  it("refuses a different workflow, a foreign signer identity, a missing commit, a non-SLSA statement and a missing log entry", async () => {
    const run = (over: object, signer = okSigner) => verifyProvenance({ digest, repo: REPO, fetchImpl: apiFetch(digest, over), verifyBundle: async () => signer });
    await expect(run({ workflow: ".github/workflows/other.yml" })).rejects.toMatchObject({ code: "invalid" });
    await expect(run({}, { identity: { subjectAlternativeName: "https://github.com/evil/repo/.github/workflows/release-build.yml@refs/tags/build-x" } })).rejects.toMatchObject({ code: "invalid" });
    await expect(run({ commit: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(run({ predicateType: "https://example.com/other" })).rejects.toMatchObject({ code: "invalid" });
    await expect(run({ logIndex: null })).rejects.toMatchObject({ code: "invalid" });
  });
  it("reports unreachable on a rate limit, falling back to the release's sigstore bundle first", async () => {
    const limited = async () => jsonRes(403, {}, { "x-ratelimit-reset": "1794650000" });
    await expect(verifyProvenance({ digest, repo: REPO, fetchImpl: limited, verifyBundle: async () => okSigner })).rejects.toMatchObject({ code: "unreachable" });
    const urls: string[] = [];
    const viaRelease = async (u: string) => { urls.push(u); return u.includes("api.github.com") ? jsonRes(403, {}) : jsonRes(200, bundleFor(digest)); };
    const p = await verifyProvenance({ digest, repo: REPO, tag: "build-x", fetchImpl: viaRelease, verifyBundle: async () => okSigner });
    expect(p.source).toBe("github release build-x");
    expect(urls[1]).toBe(`https://github.com/${REPO}/releases/download/build-x/server-bundle.tar.gz.sigstore.json`);
  });
  it("reports not_found when there is no attestation", async () => {
    await expect(verifyProvenance({ digest, repo: REPO, fetchImpl: async () => jsonRes(404, {}), verifyBundle: async () => okSigner })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("host artifact + provenance gate", () => {
  const plain = packTarGz([{ path: "wrangler.toml", data: Buffer.from("x") }, { path: "worker/index.js", data: Buffer.from("export default {};") }]);
  const key = randomBytes(32);
  const artifact = encryptBundle(plain, key);
  const rel = { artifact_urls: [STUDIO, WALRUS], artifact_sha256: sha(artifact), build_hash: sha(plain), key_commitment: sha(key) };
  const fetchBytes = async (u: string) => { if (u === STUDIO) throw new Error("HTTP 404"); return artifact; };

  it("falls back to walrus then prints the provenance line", async () => {
    const lines: string[] = [];
    const r = await fetchVerifiedArtifact({ rel, fetchBytes, log: (s: string) => lines.push(s), provenance: async ({ digest }: { digest: string }) => verifyProvenance({ digest, repo: REPO, fetchImpl: apiFetch(digest), verifyBundle: async () => okSigner }) });
    expect(r.label).toBe("walrus");
    expect(lines[0]).toBe("studio copy kiln-cdn-x.pages.dev … 404 (gone)");
    expect(lines[1]).toMatch(/^walrus aggregator\.walrus-testnet\.walrus\.space … 200, sha256 matches on-chain ✓/);
    expect(lines[2]).toMatch(/^provenance ✓ /);
    expect(lines[2]).toContain(`built by workflow ${WF} at commit 0123456`);
  });
  it("warns but continues when provenance is unreachable (the on-chain hash still gates)", async () => {
    const lines: string[] = [];
    const r = await fetchVerifiedArtifact({ rel, fetchBytes, log: (s: string) => lines.push(s), provenance: async () => { throw new ProvenanceError("unreachable", "GitHub attestations API: HTTP 403"); } });
    expect(r.provenance).toBeNull();
    expect(lines.at(-1)).toMatch(/^WARNING: provenance not checked \(unreachable\)/);
  });
  it("refuses when the attested digest is not the on-chain build_hash", async () => {
    await expect(fetchVerifiedArtifact({ rel, fetchBytes, provenance: async ({ digest }: { digest: string }) => verifyProvenance({ digest, repo: REPO, fetchImpl: apiFetch(sha("another build")), verifyBundle: async () => okSigner }) }))
      .rejects.toMatchObject({ code: "provenance_digest_mismatch" });
  });
  it("prepare stops on a failed provenance check before anything is unpacked", async () => {
    const work = mkdtempSync(join(tmpdir(), "ls-host-")); dirs.push(work);
    const chain = { info: async () => ({ status: "Dead", released_key: key.toString("hex") }), releaseInfo: async () => rel, snapshot: async () => null };
    const e = await prepare({ chain, fetchBytes, workDir: work, provenance: async () => { throw new ProvenanceError("invalid", "bad signature"); } }).catch((x) => x);
    expect(e).toBeInstanceOf(Refusal);
    expect(e.code).toBe("provenance_invalid");
  });
});

describe("walrus upload and verify (mocked fetch)", () => {
  const bytes = Buffer.from("ciphertext");
  const created = { newlyCreated: { blobObject: { blobId: "BLOB_ID", storage: { endEpoch: 99 } }, cost: 5 } };
  const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => Buffer.from(body as string) });

  it("PUTs to the publisher with epochs=53&permanent=true and parses newlyCreated / alreadyCertified", async () => {
    let call: { url: string; init: RequestInit } | null = null;
    const out = await walrusStore(bytes, { fetchImpl: (async (url: string, init: RequestInit) => { call = { url, init }; return res(200, created); }) as never });
    expect(call!.url).toBe("https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=53&permanent=true");
    expect(call!.init.method).toBe("PUT");
    expect(out).toMatchObject({ blobId: "BLOB_ID", endEpoch: 99, created: true, url: "https://aggregator.walrus-testnet.walrus.space/v1/blobs/BLOB_ID" });
    expect(parseStoreResponse({ alreadyCertified: { blobId: "B2", endEpoch: 7 } })).toMatchObject({ blobId: "B2", created: false });
    expect(() => parseStoreResponse({ error: "x" })).toThrow(/unexpected publisher response/);
  });
  it("retries a 5xx but not a 4xx, and refuses oversize input and bad epochs", async () => {
    let n = 0;
    const flaky = (async () => (++n < 2 ? res(503) : res(200, created))) as never;
    expect((await walrusStore(bytes, { fetchImpl: flaky, backoffMs: 1 })).blobId).toBe("BLOB_ID");
    n = 0;
    await expect(walrusStore(bytes, { fetchImpl: (async () => { n++; return res(400, "bad"); }) as never, backoffMs: 1 })).rejects.toThrow(/HTTP 400/);
    expect(n).toBe(1);
    await expect(walrusStore(Buffer.alloc(10 * 1024 * 1024 + 1), { fetchImpl: (async () => res(200, created)) as never })).rejects.toThrow(/10 MiB/);
    await expect(walrusStore(bytes, { epochs: 54, fetchImpl: (async () => res(200, created)) as never })).rejects.toThrow(/epochs/);
  });
  it("verifies the read-back sha256, retries an early 404, and rejects different bytes", async () => {
    let n = 0;
    const late = (async () => (++n < 3 ? res(404) : res(200, bytes.toString()))) as never;
    expect((await walrusVerify("B", sha(bytes), { fetchImpl: late, backoffMs: 1 })).ok).toBe(true);
    expect(n).toBe(3);
    await expect(walrusVerify("B", sha(bytes), { fetchImpl: (async () => res(200, "different")) as never, backoffMs: 1 })).rejects.toThrow(/hashes to/);
  });
});
