import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBundle, encryptBundle, parseKey, sha256Hex } from "../lib/crypto.mjs";
import { packTarGz, unpackTarGz } from "../lib/tar.mjs";

const files = [
  { path: "worker/index.js", data: Buffer.from("export default {};\n") },
  { path: "assets/index.html", data: Buffer.from("<!doctype html><title>Ember Rift</title>") },
  { path: "wrangler.toml", data: Buffer.from('name = "x"\n') },
];

describe("tar bundle", () => {
  it("round trips and is deterministic regardless of input order", () => {
    const a = packTarGz(files), b = packTarGz([...files].reverse());
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    expect(unpackTarGz(a).map((e) => [e.path, e.data.toString()])).toEqual(
      [...files].sort((x, y) => (x.path < y.path ? -1 : 1)).map((e) => [e.path, e.data.toString()]));
  });
  it("refuses to pack or unpack unsafe paths", () => {
    expect(() => packTarGz([{ path: "../evil", data: Buffer.from("x") }])).toThrow(/unsafe/);
    expect(() => packTarGz([{ path: "/abs", data: Buffer.from("x") }])).toThrow(/unsafe/);
  });
});

describe("artifact encryption (LSV1)", () => {
  const key = randomBytes(32);
  const plain = packTarGz(files);
  it("round trips and carries the LSV1 header and a 12-byte nonce", () => {
    const enc = encryptBundle(plain, key);
    expect(enc.subarray(0, 4).toString()).toBe("LSV1");
    expect(enc.length).toBe(4 + 12 + plain.length + 16);
    expect(decryptBundle(enc, key).equals(plain)).toBe(true);
  });
  it("refuses a flipped ciphertext byte, a flipped tag byte, a wrong key and a wrong header", () => {
    const enc = encryptBundle(plain, key);
    const flip = (i: number) => { const c = Buffer.from(enc); c[i] ^= 1; return c; };
    expect(() => decryptBundle(flip(40), key)).toThrow(/modified/);
    expect(() => decryptBundle(flip(enc.length - 1), key)).toThrow(/modified/);
    expect(() => decryptBundle(flip(6), key)).toThrow(/modified/);
    expect(() => decryptBundle(enc, randomBytes(32))).toThrow(/wrong key/);
    expect(() => decryptBundle(flip(1), key)).toThrow(/LSV1/);
    expect(() => decryptBundle(Buffer.from("tiny"), key)).toThrow(/LSV1/);
  });
  it("binds the header as associated data", () => {
    const enc = encryptBundle(plain, key);
    expect(() => decryptBundle(Buffer.concat([Buffer.from("LSV2"), enc.subarray(4)]), key)).toThrow();
  });
  it("parses hex keys and rejects bad ones", () => {
    expect(parseKey(key.toString("hex") + "\n").equals(key)).toBe(true);
    expect(parseKey(key).equals(key)).toBe(true);
    expect(() => parseKey("short")).toThrow(/32 bytes/);
  });
});
