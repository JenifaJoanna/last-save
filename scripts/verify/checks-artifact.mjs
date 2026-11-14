// Pins, mirrors and the released key. A hash match is what counts: where a file came from never makes it trusted.
import { checkReleasedKey, isHex64, short } from "./pure.mjs";
import { bad, na, ok, warn } from "./checks-chain.mjs";

const looksLikeHtml = (b) => /^\s*<(!doctype|html)/i.test(b.subarray(0, 64).toString("latin1"));

/** Splits downloads by what happened: served the wanted bytes, served other bytes (tampered), 404/410, or unreachable. */
export function classifyMirrors(downloads, wantSha) {
  const out = { served: [], tampered: [], gone: [], errored: [] };
  for (const d of downloads) {
    if (d.bytes && d.sha256 !== wantSha && looksLikeHtml(d.bytes)) out.gone.push(d); // a Pages site answering 200 with its SPA shell: the file is not there
    else if (d.bytes) (d.sha256 === wantSha ? out.served : out.tampered).push(d);
    else if (d.status === 404 || d.status === 410) out.gone.push(d);
    else out.errored.push(d);
  }
  return out;
}
const mark = (d, c) => `${d.label} ${c.served.includes(d) ? "✓" : c.tampered.includes(d) ? "✗ WRONG BYTES" : c.gone.includes(d) ? `✗ ${d.bytes ? "serves the site HTML, not the file" : d.status}` : `? ${d.error}`}`;

/** Verdict for one set of mirrors that should all serve `wantSha`. */
function mirrorVerdict(what, downloads, wantSha) {
  const c = classifyMirrors(downloads, wantSha);
  const detail = downloads.map((d) => mark(d, c)).join(" · ");
  const mirrors = downloads.map((d) => ({ url: d.url, label: d.label, ok: c.served.includes(d), status: d.status, error: d.error ?? null }));
  const lead = `${what}: ${c.served.length}/${downloads.length} mirrors serve sha256 ${short(wantSha)}`;
  if (c.tampered.length) return bad(`${lead}, but ${c.tampered.length} serve different bytes (${detail})`, { mirrors });
  if (c.served.length > 0 && c.gone.length + c.errored.length > 0) return warn(`${lead} (${detail}); the pinned hash makes a missing mirror harmless, but the list on chain has a dead entry`, { mirrors });
  if (c.served.length === 0) return (c.errored.length === downloads.length ? warn : bad)(`${lead} (${detail})`, { mirrors });
  return ok(`${lead} (${detail})`, { mirrors });
}

async function programsPinned(ctx) {
  const cfg = (await ctx.info()).config;
  const local = ctx.localArtifacts();
  if (local.size === 0) return na("artifacts/ is not present in this checkout");
  const rows = ["release", "probe"].map((k) => ({ k, sha: cfg[k].sha256, file: local.get(cfg[k].sha256) }));
  const missing = rows.filter((r) => !r.file);
  return missing.length
    ? bad(`${missing.map((r) => `${r.k}.wasm ${short(r.sha)}`).join(", ")} on chain matches no file in artifacts/`)
    : ok(`release.wasm ${short(rows[0].sha)} and probe.wasm ${short(rows[1].sha)} on chain = sha256 of artifacts/ files`, { files: rows.map((r) => r.file) });
}

async function keyCommitmentPresent(ctx) {
  const a = (await ctx.info()).config;
  const problems = [["key_commitment", a.key_commitment], ["artifact.sha256", a.artifact.sha256], ["artifact.build_hash", a.artifact.build_hash]].filter(([, v]) => !isHex64(v)).map(([k]) => k);
  return problems.length ? bad(`${problems.join(", ")} missing or malformed`) : ok(`key commitment ${short(a.key_commitment)}, artifact ${short(a.artifact.sha256)} (${a.artifact.size.toLocaleString("en")} B), build hash ${short(a.artifact.build_hash)} are set on chain`);
}

async function artifactLocal(ctx) {
  const a = (await ctx.info()).config.artifact;
  const local = ctx.localArtifacts();
  if (local.size === 0) return na("artifacts/ is not present in this checkout");
  const f = local.get(a.sha256);
  return f ? ok(`encrypted artifact ${short(a.sha256)} = ${f}`) : na("encrypted artifact is not committed under artifacts/ (mirrors serve it)");
}

async function programMirrors(ctx) {
  const cfg = (await ctx.info()).config;
  const [rel, probe] = await Promise.all(["release", "probe"].map((k) => ctx.downloadAll(cfg[k].urls).then((d) => mirrorVerdict(`${k}.wasm`, d, cfg[k].sha256))));
  const worst = [rel, probe].find((v) => v.status === "fail") ?? [rel, probe].find((v) => v.status === "warn") ?? rel;
  return { status: worst.status, reason: `${rel.reason.split(" (")[0]}; ${probe.reason.split(" (")[0]}` };
}

async function artifactMirrorsCheck(ctx) {
  const a = (await ctx.info()).config.artifact;
  const downloads = await ctx.downloadAll(a.urls);
  return mirrorVerdict("encrypted artifact", downloads, a.sha256);
}

async function walrus(ctx) {
  const a = (await ctx.info()).config.artifact;
  const w = a.urls.filter((u) => new URL(u).host.includes("walrus"));
  if (!w.length) return na("no Walrus mirror in artifact.urls (this instance predates it)");
  const v = mirrorVerdict("walrus", await ctx.downloadAll(w), a.sha256);
  return v.status === "pass" ? ok(`${v.reason.split(" (")[0].replace("walrus: ", "")}: ${new URL(w[0]).host}`, v) : v;
}

const NOT_RELEASED = (i) => `not released yet (status ${i.status}); the key stays sealed in the enclave until the contract is Dead`;

async function releasedKey(ctx) {
  const i = await ctx.info();
  if (!i.release.released) return na(NOT_RELEASED(i));
  const r = checkReleasedKey({ keyHex: i.released_key, commitment: i.config.key_commitment });
  return r.keyOk ? ok(`sha256(released key ${short(i.released_key)}) = on-chain key_commitment`) : bad("sha256(released key) != key_commitment");
}

async function releasedArtifact(ctx) {
  const i = await ctx.info();
  if (!i.release.released) return na(NOT_RELEASED(i));
  const a = i.config.artifact;
  const good = (await ctx.downloadAll(a.urls)).find((d) => d.sha256 === a.sha256);
  if (!good) return warn("no mirror served the artifact, so it could not be decrypted here");
  const r = checkReleasedKey({ keyHex: i.released_key, commitment: i.config.key_commitment, artifact: good.bytes, buildHash: a.build_hash });
  if (r.error) return bad(r.error);
  return r.buildOk
    ? ok(`released key decrypts the artifact (AES-256-GCM) to ${r.plainBytes.toLocaleString("en")} B whose sha256 ${short(r.plainSha)} = on-chain build_hash`)
    : bad(`decrypted bundle sha256 ${short(r.plainSha)} != build_hash ${short(a.build_hash)}`);
}

export const CHECKS = [
  { id: "config.programs", group: "Pins", label: "release/probe wasm hashes = committed artifacts/ files", run: programsPinned },
  { id: "config.commitment", group: "Pins", label: "Key commitment, artifact hash and build hash are set", run: keyCommitmentPresent },
  { id: "config.artifact_file", group: "Pins", label: "Encrypted artifact = committed file", run: artifactLocal },
  { id: "programs.mirrors", group: "Artifacts", label: "Enclave programs download from every mirror", run: programMirrors },
  { id: "artifact.mirrors", group: "Artifacts", label: "Encrypted artifact: every mirror's sha256 = on-chain", run: artifactMirrorsCheck },
  { id: "artifact.walrus", group: "Artifacts", label: "Walrus mirror serves it", run: walrus },
  { id: "release.key", group: "Release", label: "Released key hashes to the commitment", run: releasedKey },
  { id: "release.artifact", group: "Release", label: "Released key decrypts the artifact to build_hash", run: releasedArtifact },
];
