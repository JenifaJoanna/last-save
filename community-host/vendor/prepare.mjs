// GENERATED from host/lib/prepare.mjs by scripts/sync-community-host.mjs. Do not edit; change the source and re-run the script.
// Verifies everything the chain commits to before anything is run: released key, artifact hash, build hash, snapshot hash.
import { sha256 } from "@noble/hashes/sha2";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { decryptBundle } from "./crypto.mjs";
import { unpackTarGz } from "./tar.mjs";
import { fetchFromMirrors, defaultFetchBytes } from "./mirrors.mjs";
import { describeProvenance, ProvenanceError } from "./provenance.mjs";
import { Refusal } from "./refusal.mjs";

const hex = (b) => Buffer.from(sha256(b)).toString("hex");
const HEX64 = /^[0-9a-f]{64}$/i;

export function readReleasedKey(info) {
  const k = info?.released_key ?? info?.release?.released_key ?? info?.release?.key ?? null;
  return typeof k === "string" && HEX64.test(k) ? k.toLowerCase() : null;
}

export { defaultFetchBytes } from "./mirrors.mjs";

/**
 * Step 1 of a host start: get a copy of the encrypted artifact whose sha256 matches the chain (mirrors in order, one log line each),
 * then check build provenance when a `provenance({ digest })` verifier is supplied. Needs no key, so it also backs `--verify-only`.
 * Provenance that cannot be fetched warns (the on-chain hash still gates); a bundle that is invalid or names another digest refuses.
 */
export async function fetchVerifiedArtifact({ rel, fetchBytes = defaultFetchBytes, extraMirrors = [], provenance = null, log = () => {} }) {
  const urls = [...(rel.artifact_urls ?? []), ...extraMirrors];
  if (!urls.length) throw new Refusal("no_mirrors", "The contract lists no artifact mirrors. Add one with --mirror <url>.");
  const got = await fetchFromMirrors({ urls, sha256: rel.artifact_sha256, fetchBytes, log });
  if (!got.bytes) {
    const detail = got.tried.map((t) => `${t.url}: ${t.outcome}${t.error ? ` (${t.error})` : ""}`).join("\n  ");
    throw new Refusal(got.tampered ? "artifact_tampered" : "artifact_unavailable",
      got.tampered ? `Every reachable mirror served bytes that do not match the on-chain artifact sha256 (tampered or corrupted). Refusing.\n  ${detail}`
        : `No mirror could be downloaded.\n  ${detail}`);
  }
  let proof = null;
  if (provenance) {
    try {
      proof = await provenance({ digest: String(rel.build_hash).toLowerCase() });
      log(`provenance ✓ ${describeProvenance(proof)}`);
    } catch (e) {
      if (!(e instanceof ProvenanceError)) throw e;
      if (e.code === "unreachable" || e.code === "not_found") log(`WARNING: provenance not checked (${e.code}): ${e.message}. The on-chain hash still gates this build.`);
      else throw new Refusal(`provenance_${e.code}`, `Build provenance check failed: ${e.message}. Refusing.`);
    }
  }
  return { encrypted: got.bytes, mirror: got.url, label: got.label, tried: got.tried, provenance: proof };
}

/** chain: { info(), releaseInfo(), snapshot() } over the licence contract views (get_info, release_info, get_snapshot).
 * Returns { buildHash, dir, restore, provenance } or throws Refusal. */
export async function prepare({ chain, fetchBytes = defaultFetchBytes, workDir, extraMirrors = [], provenance = null, log = () => {} }) {
  const info = await chain.info();
  const key = readReleasedKey(info);
  if (!key) throw new Refusal("not_released", `The licence has not released the server key yet (status: ${info?.status ?? "unknown"}). Nothing to host.`);
  const rel = await chain.releaseInfo();
  const commitment = String(rel?.key_commitment ?? "").toLowerCase();
  if (hex(Buffer.from(key, "hex")) !== commitment) throw new Refusal("key_mismatch", "The released key does not match the on-chain key commitment. Refusing.");
  log(`released key matches the on-chain commitment (${commitment.slice(0, 12)}...)`);

  const { encrypted, provenance: proof } = await fetchVerifiedArtifact({ rel, fetchBytes, extraMirrors, provenance, log });

  let plain;
  try { plain = decryptBundle(encrypted, Buffer.from(key, "hex")); } catch (e) { throw new Refusal("decrypt_failed", `${e.message}. Refusing.`); }
  const buildHash = hex(plain);
  if (buildHash !== String(rel.build_hash).toLowerCase()) throw new Refusal("build_mismatch", `Decrypted bundle hashes to ${buildHash.slice(0, 12)}..., the chain commits to ${String(rel.build_hash).slice(0, 12)}.... Refusing.`);
  log(`decrypted, build_hash ${buildHash.slice(0, 12)}... matches`);

  let files;
  try { files = unpackTarGz(plain); } catch (e) { throw new Refusal("bad_bundle", `The bundle cannot be unpacked safely: ${e.message}`); }
  const names = new Set(files.map((f) => f.path));
  for (const need of ["wrangler.toml", "worker/index.js"]) if (!names.has(need)) throw new Refusal("bad_bundle", `The bundle has no ${need}.`);

  const restore = await readSnapshot(chain, info);
  const dir = join(workDir, buildHash);
  rmSync(dir, { recursive: true, force: true });
  for (const f of files) {
    const target = join(dir, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.data);
  }
  log(`unpacked ${files.length} files to ${relative(process.cwd(), dir) || "."}`);
  return { buildHash, dir, restore, provenance: proof };
}

async function readSnapshot(chain, info) {
  const snap = await chain.snapshot();
  if (!snap) return null;
  let blob;
  try { blob = Buffer.from(String(snap.blob_base64), "base64"); } catch { blob = Buffer.alloc(0); }
  if (hex(blob) !== String(snap.hash).toLowerCase()) throw new Refusal("snapshot_mismatch", "The on-chain progress snapshot does not hash to its recorded hash. Refusing to start.");
  const listed = info?.snapshot?.hash ?? info?.snapshot_hash ?? null;
  if (listed && String(listed).toLowerCase() !== String(snap.hash).toLowerCase()) throw new Refusal("snapshot_mismatch", "The snapshot differs from the hash listed in get_info. Refusing to start.");
  return { seq: Number(snap.seq), hash: String(snap.hash).toLowerCase(), blob_base64: String(snap.blob_base64) };
}
