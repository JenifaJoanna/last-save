// Seals the server key K for OutLayer's keystore (ECIES v1, proven in proof/spike.md).
// Seed `wasm_hash:{release_sha256}:{contract}` is derived by the keystore from accessor + owner.
import { randomBytes } from "node:crypto";
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { chacha20poly1305 } from "@noble/ciphers/chacha";

export const SECRET_NAME = "LASTSAVE_SERVER_KEY";
export const PROFILE = "escrow";
const API = process.env.OUTLAYER_API ?? "https://testnet-api.outlayer.ai";

export async function keystorePubkey(owner, releaseHash) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}/secrets/pubkey`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessor: { type: "WasmHash", hash: releaseHash.toLowerCase() }, owner, profile: PROFILE,
        secrets_json: JSON.stringify({ [SECRET_NAME]: "0".repeat(64) }) }),
    }).catch(() => null);
    if (res?.ok) {
      const body = await res.json();
      if (/^[0-9a-f]{64}$/.test(body.pubkey ?? "")) return body.pubkey;
      throw new Error("unexpected pubkey shape from OutLayer");
    }
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
  }
  throw new Error("OutLayer /secrets/pubkey unreachable");
}

export function eciesEncrypt(pubkeyHex, plaintext) {
  const eph = x25519.utils.randomPrivateKey();
  const shared = x25519.getSharedSecret(eph, Buffer.from(pubkeyHex, "hex"));
  const key = hkdf(sha256, shared, undefined, new TextEncoder().encode("outlayer-keystore-v1"), 32);
  const nonce = randomBytes(12);
  return Buffer.concat([Buffer.from([0x01]), x25519.getPublicKey(eph), nonce, chacha20poly1305(key, nonce).encrypt(plaintext)]).toString("base64");
}

export const keyCommitment = (keyHex) => Buffer.from(sha256(Buffer.from(keyHex, "hex"))).toString("hex");

export async function sealServerKey({ owner, releaseHash, keyHex }) {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error("K must be 64 lowercase hex chars");
  const pubkey = await keystorePubkey(owner, releaseHash);
  return { encrypted_secrets_base64: eciesEncrypt(pubkey, new TextEncoder().encode(JSON.stringify({ [SECRET_NAME]: keyHex }))), key_commitment: keyCommitment(keyHex) };
}
