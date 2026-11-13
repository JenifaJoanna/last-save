#!/usr/bin/env node
// Encrypts the server key K for OutLayer's keystore so that only a TEE worker
// can open it, sealed to the seed `wasm_hash:{release_hash}:{owner}`.
// ECIES v1: X25519 ECDH -> HKDF-SHA256(info "outlayer-keystore-v1") -> ChaCha20-Poly1305,
// wire format [0x01 | ephemeral_pub(32) | nonce(12) | ciphertext+tag].
//
// usage: node scripts/spike/encrypt-escrow.mjs --owner <contract> --hash <release sha256> --key-file <path>
//   key file holds K as 64 hex chars (created with --generate if missing). Prints JSON
//   { encrypted_secrets_base64, key_commitment, pubkey } and never prints K.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { chacha20poly1305 } from "@noble/ciphers/chacha";

export const SECRET_NAME = "LASTSAVE_SERVER_KEY";
const API = process.env.OUTLAYER_API ?? "https://testnet-api.outlayer.ai";
const hex = (b) => Buffer.from(b).toString("hex");

export async function fetchKeystorePubkey({ owner, releaseHash, profile = "escrow" }) {
  const res = await fetch(`${API}/secrets/pubkey`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accessor: { type: "WasmHash", hash: releaseHash.toLowerCase() },
      owner,
      profile,
      secrets_json: JSON.stringify({ [SECRET_NAME]: "0".repeat(64) }),
    }),
  });
  if (!res.ok) throw new Error(`pubkey ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!/^[0-9a-f]{64}$/.test(body.pubkey ?? "")) throw new Error("unexpected pubkey shape");
  return body.pubkey;
}

export function eciesEncrypt(pubkeyHex, plaintext) {
  const eph = x25519.utils.randomPrivateKey();
  const ephPub = x25519.getPublicKey(eph);
  const shared = x25519.getSharedSecret(eph, Buffer.from(pubkeyHex, "hex"));
  const key = hkdf(sha256, shared, undefined, new TextEncoder().encode("outlayer-keystore-v1"), 32);
  const nonce = randomBytes(12);
  const ct = chacha20poly1305(key, nonce).encrypt(plaintext);
  return Buffer.concat([Buffer.from([0x01]), ephPub, nonce, ct]).toString("base64");
}

export async function sealServerKey({ owner, releaseHash, keyHex }) {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error("K must be 64 lowercase hex chars");
  const pubkey = await fetchKeystorePubkey({ owner, releaseHash });
  const plaintext = new TextEncoder().encode(JSON.stringify({ [SECRET_NAME]: keyHex }));
  return {
    encrypted_secrets_base64: eciesEncrypt(pubkey, plaintext),
    key_commitment: hex(sha256(Buffer.from(keyHex, "hex"))),
    pubkey,
  };
}

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const owner = arg("owner");
  const releaseHash = arg("hash");
  const keyFile = arg("key-file");
  if (!owner || !releaseHash || !keyFile) {
    process.stderr.write("usage: --owner <account> --hash <sha256> --key-file <path> [--generate]\n");
    process.exit(2);
  }
  if (!existsSync(keyFile)) {
    if (!process.argv.includes("--generate")) throw new Error(`no key file at ${keyFile}`);
    writeFileSync(keyFile, hex(randomBytes(32)), { mode: 0o600 });
  }
  const keyHex = readFileSync(keyFile, "utf8").trim();
  const out = await sealServerKey({ owner, releaseHash, keyHex });
  process.stdout.write(JSON.stringify(out) + "\n");
}
