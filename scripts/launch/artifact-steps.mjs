// v2 artifact pipeline for a licence instance: cibuild (attested CI build -> encrypted artifact), walrus (content-addressed copy),
// cdn (the studio's own copy on Cloudflare Pages), and the mirror list that ends up on the contract. launch.mjs owns the state/record
// plumbing and passes it in as `ctx`; the helpers here are unit-tested in artifact-steps.test.mjs with injected fetch.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_REPO, RELEASE_ASSET, describeProvenance, releaseUrl, tagForName, verifyProvenance } from "../../host/lib/provenance.mjs";
import { WALRUS_TESTNET, walrusStore, walrusVerify } from "../../host/lib/walrus.mjs";

export const RAW = `https://raw.githubusercontent.com/${DEFAULT_REPO}/main`;
const sha256Hex = (b) => createHash("sha256").update(b).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", ...opts });

export const cdnProject = (name) => `kiln-cdn-${String(name).replace(/_/g, "-")}`;
export const cdnUrl = (name, file) => `https://${cdnProject(name)}.pages.dev/${file}`;

/** The artifact mirror list the contract is born with: the studio's copy first, then Walrus, then GitHub raw (the platform Pages mirror is the v1 fallback). */
export function artifactMirrors({ cdn, walrus, file, platformUrl, raw = RAW }) {
  const urls = [cdn?.url, walrus?.url, `${raw}/artifacts/${file}`];
  const filtered = urls.filter(Boolean);
  if (!cdn && !walrus) filtered.push(`${platformUrl}/mirror/${file}`);
  return filtered;
}

/** Parses `<hex>  <name>` as written by sha256sum. */
export function parseSha256File(text, asset = RELEASE_ASSET) {
  const m = /^([0-9a-f]{64})\s+\*?(\S+)\s*$/m.exec(String(text));
  if (!m || m[2] !== asset) throw new Error(`malformed sha256 file for ${asset}`);
  return m[1];
}

async function getBytes(fetchImpl, url) {
  const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { status: res.status });
  return Buffer.from(await res.arrayBuffer());
}

/** Waits for the release asset of tag build-<name>, then returns { tarball, digest, tag } after cross-checking the published sha256. */
export async function downloadRelease({ repo = DEFAULT_REPO, tag, fetchImpl = fetch, waitMs = 20 * 60_000, pollMs = 20_000, onWait = () => {} }) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const tarball = await getBytes(fetchImpl, releaseUrl(repo, tag, RELEASE_ASSET));
      const published = parseSha256File((await getBytes(fetchImpl, releaseUrl(repo, tag, `${RELEASE_ASSET}.sha256`))).toString("utf8"));
      const digest = sha256Hex(tarball);
      if (digest !== published) throw new Error(`downloaded tarball hashes to ${digest}, release lists ${published}`);
      return { tarball, digest, tag };
    } catch (e) {
      if (e.status !== 404 || Date.now() > deadline) throw e;
      onWait();
      await sleep(pollMs);
    }
  }
}

const tagPushed = (tag) => sh("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]).trim() !== "";

/** Tags HEAD and pushes the tag with plain git, only when HEAD is already on origin/main (so CI builds exactly what is public). */
export function pushBuildTag(tag) {
  sh("git", ["fetch", "-q", "origin", "main"]);
  const head = sh("git", ["rev-parse", "HEAD"]).trim();
  try { sh("git", ["merge-base", "--is-ancestor", head, "origin/main"]); } catch { throw new Error(`HEAD ${head.slice(0, 8)} is not on origin/main: push it before tagging ${tag}`); }
  sh("git", ["tag", tag, head]);
  sh("git", ["push", "-q", "origin", `refs/tags/${tag}`]);
  return head;
}

const wranglerJs = () => join("game", "server", "node_modules", "wrangler", "bin", "wrangler.js");
const wrangler = (args, opts = {}) => execFileSync(process.execPath, [wranglerJs(), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, ...opts });

export const steps = {
  /** Replaces `bundle`: the plaintext tarball comes from the tag-triggered CI build and must carry a verified provenance attestation. */
  async cibuild(c) {
    if (!c.name) throw new Error("cibuild needs NAME (the tag is build-<NAME>)");
    const repo = process.env.REPO ?? DEFAULT_REPO, tag = tagForName(c.name);
    if (!tagPushed(tag)) c.out(`tag ${tag} pushed at ${pushBuildTag(tag).slice(0, 8)}`);
    let waited = 0;
    const rel = await downloadRelease({ repo, tag, onWait: () => { if (waited++ % 3 === 0) c.out(`waiting for the ${tag} release (${waited * 20}s)…`); } });
    const proof = await verifyProvenance({ digest: rel.digest, repo, tag });
    c.out(describeProvenance(proof));

    mkdirSync("server-bundle/dist", { recursive: true });
    writeFileSync("server-bundle/dist/server-bundle.tar.gz", rel.tarball);
    if (!existsSync(c.keyFile)) writeFileSync(c.keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
    sh("pnpm", ["--filter", "server-bundle", "encrypt", "--key-file", `../${c.keyFile}`]);
    const meta = JSON.parse(readFileSync("server-bundle/dist/artifact.json", "utf8"));
    if (meta.build_hash !== rel.digest) throw new Error("build_hash differs from the attested digest");
    c.state.artifact = { ...meta, file: `ember-rift-${meta.sha256.slice(0, 16)}.bin` };
    c.state.provenance = { repo, tag, workflow: proof.workflow, commit: proof.commit, run_id: proof.runId, run_url: proof.runUrl, rekor_index: proof.rekorIndex, integrated_time: proof.integratedTime, source: proof.source };
    c.state.key_commitment = c.keyCommitment();
    c.save();
    c.record("cibuild", { build_hash: meta.build_hash, attested_digest: rel.digest, artifact_sha256: meta.sha256, size: meta.size, key_commitment: c.state.key_commitment,
      workflow: proof.workflow, commit: proof.commit, run_id: proof.runId, rekor_log_index: proof.rekorIndex, rekor_integrated_time: proof.integratedTime });
  },

  /** Walrus testnet copy of the encrypted artifact (53 epochs, permanent), read back and hashed. */
  async walrus(c) {
    const a = c.state.artifact;
    if (!a) throw new Error("no artifact in state: run cibuild first");
    const bytes = readFileSync("server-bundle/dist/artifact.bin");
    if (sha256Hex(bytes) !== a.sha256) throw new Error("server-bundle/dist/artifact.bin is not the artifact in launch state: rerun cibuild");
    const put = await walrusStore(bytes, { ...WALRUS_TESTNET });
    const back = await walrusVerify(put.blobId, a.sha256, WALRUS_TESTNET);
    c.state.walrus = { blob_id: put.blobId, url: put.url, end_epoch: put.endEpoch, created: put.created };
    c.save();
    c.record("walrus", { blob_id: put.blobId, url: put.url, end_epoch: put.endEpoch, newly_created: put.created, readback_sha256: back.sha256, readback_ok: back.sha256 === a.sha256, bytes: back.size });
  },

  /** The studio's own copy: a Pages project kiln-cdn-<name> serving the artifact file. Pages only, no Worker. */
  async cdn(c) {
    const a = c.state.artifact;
    if (!a) throw new Error("no artifact in state: run cibuild first");
    for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) if (!process.env[k]) throw new Error(`${k} is not set (set -a; . ./.env.local)`);
    const project = cdnProject(c.name), dir = join(c.local, "cdn");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    copyFileSync("server-bundle/dist/artifact.bin", join(dir, a.file));
    writeFileSync(join(dir, "_headers"), `/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=300\n  Content-Type: application/octet-stream\n`);
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Kiln artifacts</title><p>Encrypted build artifacts.</p>\n");
    try { wrangler(["pages", "project", "create", project, "--production-branch", "main"]); } catch { /* already exists */ }
    try { wrangler(["pages", "deploy", dir, "--project-name", project, "--branch", "main", "--commit-dirty=true"]); }
    catch (e) { throw new Error(`pages deploy failed: ${String(e.stderr ?? e.message).replace(/[0-9a-f]{32}/g, "<id>").slice(-300)}`); }
    const url = cdnUrl(c.name, a.file);
    let status = 0;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(url).catch(() => null);
      status = res?.status ?? 0;
      if (res?.ok && sha256Hex(Buffer.from(await res.arrayBuffer())) === a.sha256) {
        c.state.cdn = { project, url };
        c.save();
        return c.record("cdn", { project, url, status, sha256_ok: true });
      }
      await sleep(5000);
    }
    throw new Error(`${url} did not serve the artifact (last status ${status})`);
  },
};
