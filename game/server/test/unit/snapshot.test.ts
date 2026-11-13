import { describe, expect, it } from "vitest";
import { fromBase64, toBase64, utf8 } from "../../../shared/auth";
import { buildSnapshot, canonicalJson, sha256Hex, verifyRestore, type Snapshot } from "../../src/snapshot";

const player = { kos: 3, level: 2, matches: 4, shards: 21, skin: "standard", xp: 240 };
const snap: Snapshot = { at_ms: 1_800_000_000_000, game: "ember-rift", seq: 7, players: { "lastsave-yuna.testnet": player, "lastsave-mira.testnet": { ...player, xp: 410, level: 3, skin: "emberwing" } } };

describe("canonical snapshot", () => {
  it("sorts keys, uses no spaces and matches the INTERFACES shape", () => {
    const b = buildSnapshot(snap);
    expect(b.json).toBe('{"at_ms":1800000000000,"game":"ember-rift","players":{"lastsave-mira.testnet":{"kos":3,"level":3,"matches":4,"shards":21,"skin":"emberwing","xp":410},'
      + '"lastsave-yuna.testnet":{"kos":3,"level":2,"matches":4,"shards":21,"skin":"standard","xp":240}},"seq":7}');
    expect(b.hash).toBe(sha256Hex(utf8.encode(b.json)));
    expect(utf8.decode(fromBase64(b.blobBase64))).toBe(b.json);
  });
  it("is independent of insertion order", () => {
    const flipped = { ...snap, players: Object.fromEntries(Object.entries(snap.players).reverse()) };
    expect(buildSnapshot(flipped).hash).toBe(buildSnapshot(snap).hash);
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
  it("drops the lowest-xp pilots when over the 16 KiB chain limit", () => {
    const players: Snapshot["players"] = {};
    for (let i = 0; i < 400; i++) players[`pilot-${String(i).padStart(4, "0")}.testnet`] = { ...player, xp: i };
    const b = buildSnapshot({ ...snap, players });
    expect(b.truncated).toBe(true);
    expect(utf8.encode(b.json).length).toBeLessThanOrEqual(16_384);
    expect(b.json).toContain("pilot-0399.testnet");
    expect(b.json).not.toContain("pilot-0000.testnet");
  });
});

describe("restore", () => {
  const good = () => { const b = buildSnapshot(snap); return { seq: 7, hash: b.hash, blob_base64: b.blobBase64 }; };
  it("accepts a snapshot whose hash matches", () => {
    const r = verifyRestore(JSON.stringify(good()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.players["lastsave-mira.testnet"].xp).toBe(410);
  });
  it("refuses a hash mismatch with snapshot_mismatch", () => {
    const g = good();
    const r = verifyRestore(JSON.stringify({ ...g, hash: "0".repeat(64) }));
    expect(r).toMatchObject({ ok: false, code: "snapshot_mismatch" });
  });
  it("refuses tampered contents under the original hash", () => {
    const g = good();
    const tampered = toBase64(utf8.encode(utf8.decode(fromBase64(g.blob_base64)).replace('"xp":410', '"xp":999999')));
    expect(verifyRestore(JSON.stringify({ ...g, blob_base64: tampered }))).toMatchObject({ ok: false, code: "snapshot_mismatch" });
  });
  it("refuses junk and non-canonical snapshots", () => {
    expect(verifyRestore("not json")).toMatchObject({ ok: false, code: "snapshot_invalid" });
    const loose = utf8.encode(JSON.stringify(snap, null, 1));
    expect(verifyRestore(JSON.stringify({ seq: 7, hash: sha256Hex(loose), blob_base64: toBase64(loose) }))).toMatchObject({ ok: false, code: "snapshot_invalid" });
  });
});
