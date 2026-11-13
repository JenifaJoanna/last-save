// Deterministic ustar writer and a path-safe reader, so the same inputs always give the same bundle bytes (and build_hash).
import { gunzipSync, gzipSync } from "node:zlib";

const BLOCK = 512;
const enc = new TextEncoder();
const dec = new TextDecoder();

function octal(n, width) { return n.toString(8).padStart(width - 1, "0") + "\0"; }

function header(path, size, mode) {
  const bytes = enc.encode(path);
  if (bytes.length > 100) {
    // ustar prefix/name split at a slash so that name <= 100 and prefix <= 155
    throw new Error(`path too long for the bundle format: ${path}`);
  }
  const h = new Uint8Array(BLOCK);
  const put = (off, s) => h.set(enc.encode(s), off);
  h.set(bytes, 0);
  put(100, octal(mode, 8)); put(108, octal(0, 8)); put(116, octal(0, 8));
  put(124, octal(size, 12)); put(136, octal(0, 12));
  put(148, "        "); put(156, "0"); put(257, "ustar\0"); put(263, "00");
  let sum = 0;
  for (const b of h) sum += b;
  put(148, sum.toString(8).padStart(6, "0") + "\0 ");
  return h;
}

/** entries: [{ path, data: Uint8Array|Buffer, mode?: number }]. Sorted by path, mtime 0, uid/gid 0. Returns a Buffer (.tar.gz). */
export function packTarGz(entries) {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts = [];
  for (const e of sorted) {
    if (!/^[A-Za-z0-9._@+-]+(\/[A-Za-z0-9._@+-]+)*$/.test(e.path) || e.path.split("/").includes("..")) throw new Error(`unsafe path: ${e.path}`);
    parts.push(header(e.path, e.data.length, e.mode ?? 0o644), e.data);
    const pad = (BLOCK - (e.data.length % BLOCK)) % BLOCK;
    if (pad) parts.push(new Uint8Array(pad));
  }
  parts.push(new Uint8Array(BLOCK * 2));
  return gzipSync(Buffer.concat(parts), { level: 9 });
}

/** Reads a .tar.gz produced by packTarGz. Refuses anything but regular files with safe relative paths. */
export function unpackTarGz(buf) {
  const tar = gunzipSync(buf);
  const out = [];
  let off = 0;
  while (off + BLOCK <= tar.length) {
    const h = tar.subarray(off, off + BLOCK);
    if (h.every((b) => b === 0)) break;
    const field = (a, n) => dec.decode(h.subarray(a, a + n)).replace(/\0.*$/, "");
    const path = field(0, 100);
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1) || "0";
    const safe = /^[A-Za-z0-9._@+-]+(\/[A-Za-z0-9._@+-]+)*$/.test(path) && !path.split("/").includes("..");
    if (!safe) throw new Error(`bundle contains an unsafe path: ${JSON.stringify(path)}`);
    if (type !== "0") throw new Error(`bundle contains a non-file entry: ${path}`);
    off += BLOCK;
    if (off + size > tar.length) throw new Error("bundle is truncated");
    out.push({ path, data: Buffer.from(tar.subarray(off, off + size)), mode: parseInt(field(100, 8).trim() || "644", 8) });
    off += Math.ceil(size / BLOCK) * BLOCK;
  }
  return out;
}
