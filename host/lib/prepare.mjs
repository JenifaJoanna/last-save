// Verifies everything the chain commits to before anything is run: released key, artifact hash, build hash, snapshot hash.
import { sha256 } from "@noble/hashes/sha2";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { decryptBundle } from "server-bundle/crypto";
import { unpackTarGz } from "server-bundle/tar";
import { Refusal } from "./refusal.mjs";

const hex = (b) => Buffer.from(sha256(b)).toString("hex");
const HEX64 = /^[0-9a-f]{64}$/i;

export function readReleasedKey(info) {
  const k = info?.released_key ?? info?.release?.released_key ?? info?.release?.key ?? null;
  return typeof k === "string" && HEX64.test(k) ? k.toLowerCase() : null;
}

export async function defaultFetchBytes(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 64 * 1024 * 1024) throw new Error("artifact is larger than 64 MiB");
  return Buffer.from(await res.arrayBuffer());
}

/**
 * chain: { info(), releaseInfo(), snapshot() } over the licence contract views (get_info, release_info, get_snapshot).
 * Returns { buildHash, dir, restore } or throws Refusal.
 */
export async function prepare({ chain, fetchBytes = defaultFetchBytes, workDir, extraMirrors = [], log = () => {} }) {
  const info = await chain.info();
  const key = readReleasedKey(info);
  if (!key) throw new Refusal("not_released", `The licence has not released the server key yet (status: ${info?.status ?? "unknown"}). Nothing to host.`);
  const rel = await chain.releaseInfo();
  const commitment = String(rel?.key_commitment ?? "").toLowerCase();
  if (hex(Buffer.from(key, "hex")) !== commitment) throw new Refusal("key_mismatch", "The released key does not match the on-chain key commitment. Refusing.");
  log(`released key matches the on-chain commitment (${commitment.slice(0, 12)}...)`);

  const urls = [...(rel.artifact_urls ?? []), ...extraMirrors];
  if (!urls.length) throw new Refusal("no_mirrors", "The contract lists no artifact mirrors. Add one with --mirror <url>.");
  let encrypted = null, tampered = 0;
  const errors = [];
  for (const url of urls) {
    try {
      const bytes = await fetchBytes(url);
      if (hex(bytes) === String(rel.artifact_sha256).toLowerCase()) { encrypted = bytes; log(`artifact verified from ${new URL(url).host} (${bytes.length} bytes)`); break; }
      tampered++; errors.push(`${url}: sha256 mismatch`);
    } catch (e) { errors.push(`${url}: ${e.message}`); }
  }
  if (!encrypted) {
    throw new Refusal(tampered ? "artifact_tampered" : "artifact_unavailable",
      tampered ? `Every reachable mirror served bytes that do not match the on-chain artifact sha256 (tampered or corrupted). Refusing.\n  ${errors.join("\n  ")}`
        : `No mirror could be downloaded.\n  ${errors.join("\n  ")}`);
  }

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
  return { buildHash, dir, restore };
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
