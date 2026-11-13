// Canonical progress snapshot (docs/INTERFACES.md 4.5): sorted keys, no spaces, sha256 over the UTF-8 text.
import { sha256 } from "@noble/hashes/sha2";
import { fromBase64, toBase64, toHex, utf8 } from "../../shared/auth";
import { restoreSchema, snapshotBlobSchema } from "./schemas";

export interface PlayerRow { kos: number; level: number; matches: number; shards: number; skin: string; xp: number }
export interface Snapshot { at_ms: number; game: "ember-rift"; players: Record<string, PlayerRow>; seq: number }

export const MAX_BLOB_BYTES = 16_384;

function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export const canonicalJson = (v: unknown): string => canon(v);
export const sha256Hex = (b: Uint8Array | string): string => toHex(sha256(typeof b === "string" ? utf8.encode(b) : b));

export interface BuiltSnapshot { json: string; hash: string; blobBase64: string; truncated: boolean }

/** Builds the canonical text. If it exceeds the on-chain blob limit, the lowest-xp players are dropped. */
export function buildSnapshot(snap: Snapshot): BuiltSnapshot {
  let players = { ...snap.players };
  let json = canon({ ...snap, players });
  let truncated = false;
  if (utf8.encode(json).length > MAX_BLOB_BYTES) {
    truncated = true;
    const ranked = Object.entries(players).sort((a, b) => b[1].xp - a[1].xp || a[0].localeCompare(b[0]));
    while (ranked.length && utf8.encode(json).length > MAX_BLOB_BYTES) {
      ranked.pop();
      players = Object.fromEntries(ranked);
      json = canon({ ...snap, players });
    }
  }
  const bytes = utf8.encode(json);
  return { json, hash: sha256Hex(bytes), blobBase64: toBase64(bytes), truncated };
}

export type RestoreResult =
  | { ok: true; snapshot: Snapshot; hash: string }
  | { ok: false; code: "snapshot_mismatch" | "snapshot_invalid"; error: string };

/** Verifies RESTORE_SNAPSHOT: sha256(blob) must equal the supplied hash, and the blob must be a valid canonical snapshot. */
export function verifyRestore(raw: string): RestoreResult {
  let parsed;
  try { parsed = restoreSchema.parse(JSON.parse(raw)); } catch {
    return { ok: false, code: "snapshot_invalid", error: "RESTORE_SNAPSHOT is not a valid {seq, hash, blob_base64} object" };
  }
  let bytes: Uint8Array;
  try { bytes = fromBase64(parsed.blob_base64); } catch {
    return { ok: false, code: "snapshot_invalid", error: "snapshot blob is not base64" };
  }
  if (sha256Hex(bytes) !== parsed.hash) {
    return { ok: false, code: "snapshot_mismatch", error: "snapshot hash does not match its contents; refusing to start" };
  }
  try {
    const snapshot = snapshotBlobSchema.parse(JSON.parse(utf8.decode(bytes))) as Snapshot;
    if (canon(snapshot) !== utf8.decode(bytes)) throw new Error("not canonical");
    return { ok: true, snapshot, hash: parsed.hash };
  } catch {
    return { ok: false, code: "snapshot_invalid", error: "snapshot is not canonical Ember Rift progress JSON" };
  }
}
