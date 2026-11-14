// node --test scripts/launch/artifact-steps.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { artifactMirrors, cdnProject, cdnUrl, downloadRelease, parseSha256File } from "./artifact-steps.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const res = (status, body = "") => ({ ok: status < 400, status, arrayBuffer: async () => Buffer.from(body), text: async () => String(body) });

test("mirror order: studio copy, walrus, github raw", () => {
  const urls = artifactMirrors({ cdn: { url: "https://kiln-cdn-x.pages.dev/a.bin" }, walrus: { url: "https://aggregator.walrus-testnet.walrus.space/v1/blobs/abc" }, file: "a.bin", platformUrl: "https://p.pages.dev" });
  assert.deepEqual(urls, ["https://kiln-cdn-x.pages.dev/a.bin", "https://aggregator.walrus-testnet.walrus.space/v1/blobs/abc", "https://raw.githubusercontent.com/JenifaJoanna/last-save/main/artifacts/a.bin"]);
  assert.equal(artifactMirrors({ file: "a.bin", platformUrl: "https://p.pages.dev" }).at(-1), "https://p.pages.dev/mirror/a.bin");
});

test("cdn project names are Pages-safe", () => {
  assert.equal(cdnProject("ember_rift"), "kiln-cdn-ember-rift");
  assert.equal(cdnUrl("v2walrus", "f.bin"), "https://kiln-cdn-v2walrus.pages.dev/f.bin");
});

test("sha256 file parsing", () => {
  const h = "a".repeat(64);
  assert.equal(parseSha256File(`${h}  server-bundle.tar.gz\n`), h);
  assert.throws(() => parseSha256File(`${h}  other.tar.gz\n`));
  assert.throws(() => parseSha256File("nope"));
});

test("downloadRelease polls through 404 and cross-checks the published sha256", async () => {
  const body = "bundle-bytes";
  let tarCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("server-bundle.tar.gz")) return ++tarCalls < 2 ? res(404) : res(200, body);
    return res(200, `${sha(body)}  server-bundle.tar.gz\n`);
  };
  const out = await downloadRelease({ tag: "build-x", fetchImpl, pollMs: 1 });
  assert.equal(out.digest, sha(body));
  assert.equal(tarCalls, 2);
});

test("downloadRelease refuses bytes that differ from the published sha256", async () => {
  const fetchImpl = async (url) => (url.endsWith("server-bundle.tar.gz") ? res(200, "tampered") : res(200, `${sha("original")}  server-bundle.tar.gz\n`));
  await assert.rejects(downloadRelease({ tag: "build-x", fetchImpl, pollMs: 1 }), /release lists/);
});

test("downloadRelease gives up after the wait budget", async () => {
  await assert.rejects(downloadRelease({ tag: "build-x", fetchImpl: async () => res(404), pollMs: 1, waitMs: 5 }), /HTTP 404/);
});
