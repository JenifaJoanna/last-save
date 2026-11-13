// Server artifact format (docs/INTERFACES.md 4.1): "LSV1" || nonce(12) || AES-256-GCM(K, nonce, plaintext, aad="LSV1") ciphertext||tag.
import { gcm } from "@noble/ciphers/aes";
import { sha256 } from "@noble/hashes/sha2";
import { randomBytes } from "node:crypto";

const MAGIC = Buffer.from("LSV1");
export const sha256Hex = (b) => Buffer.from(sha256(b)).toString("hex");

export function parseKey(input) {
  const text = Buffer.isBuffer(input) ? input.toString("utf8").trim() : String(input).trim();
  if (/^[0-9a-fA-F]{64}$/.test(text)) return Buffer.from(text, "hex");
  if (Buffer.isBuffer(input) && input.length === 32) return input;
  throw new Error("key must be 32 bytes, given as 64 hex characters or a raw 32-byte file");
}

export function encryptBundle(plaintext, key, nonce = randomBytes(12)) {
  if (key.length !== 32) throw new Error("key must be 32 bytes");
  const ct = gcm(key, nonce, MAGIC).encrypt(plaintext);
  return Buffer.concat([MAGIC, nonce, ct]);
}

/** Throws a message naming the failure: not an artifact, or wrong key / modified bytes. */
export function decryptBundle(file, key) {
  if (key.length !== 32) throw new Error("key must be 32 bytes");
  if (file.length < 4 + 12 + 16 || !file.subarray(0, 4).equals(MAGIC)) throw new Error("not a Last Save server artifact (missing LSV1 header)");
  try {
    return Buffer.from(gcm(key, file.subarray(4, 16), MAGIC).decrypt(file.subarray(16)));
  } catch {
    throw new Error("decryption failed: wrong key or the artifact was modified");
  }
}
