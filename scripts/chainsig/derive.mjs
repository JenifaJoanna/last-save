#!/usr/bin/env node
// Re-derives the Base Sepolia address controlled by a NEAR account through the MPC signer, from public inputs only:
//   node scripts/chainsig/derive.mjs --contract <account id> --path lastsave/host-payouts [--signer v1.signer-prod.testnet]
//
// The MPC signer holds one root secp256k1 key (secret-shared across its nodes). For a caller `predecessor` and a `path`:
//   epsilon = sha3_256( "near-mpc-recovery v0.1.0 epsilon derivation:" + predecessor + "," + path )   (a 256-bit number, reduced mod n)
//   derived = root_public_key + epsilon * G
//   address = last 20 bytes of keccak256( x || y of derived )                                          (EIP-55 checksummed)
// Nobody holds the derived private key; the signer produces a signature for it only when `predecessor` (the contract) asks.
//
// Three independent answers are compared and the script exits 1 if they differ:
//   A. this file's from-scratch derivation (noble curves)
//   B. the signer contract's own `derived_public_key` view
//   C. the chainsig.js library, when installed (npm i chainsig.js in a scratch dir and pass --chainsig-dir <dir>)
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256, sha3_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import bs58 from "bs58";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { view } from "../lib/near.mjs";

export const SIGNER_DEFAULT = "v1.signer-prod.testnet";
export const TWEAK_PREFIX = "near-mpc-recovery v0.1.0 epsilon derivation:";
const N = secp256k1.CURVE.n;

/** "secp256k1:<base58 of 64 bytes x||y>" -> Point */
export function parseNearKey(s) {
  if (!s.startsWith("secp256k1:")) throw new Error(`not a secp256k1 key: ${s.slice(0, 12)}`);
  const xy = bs58.decode(s.slice("secp256k1:".length));
  if (xy.length !== 64) throw new Error("expected a 64-byte uncompressed key");
  return secp256k1.ProjectivePoint.fromHex(bytesToHex(Uint8Array.from([4, ...xy])));
}

export const toNearKey = (point) => `secp256k1:${bs58.encode(point.toRawBytes(false).slice(1))}`;

export function epsilon(predecessor, path) {
  const digest = sha3_256(utf8ToBytes(`${TWEAK_PREFIX}${predecessor},${path}`));
  return BigInt(`0x${bytesToHex(digest)}`) % N;
}

export function derivePoint(rootKey, predecessor, path) {
  const eps = epsilon(predecessor, path);
  return { eps, point: parseNearKey(rootKey).add(secp256k1.ProjectivePoint.BASE.multiply(eps)) };
}

export function evmAddress(point) {
  const addr = bytesToHex(keccak_256(point.toRawBytes(false).slice(1)).slice(12));
  const hash = bytesToHex(keccak_256(utf8ToBytes(addr)));
  return `0x${[...addr].map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c)).join("")}`;
}

/** Fetches the root key and derives. Exported for scripts that need the address. */
export async function deriveFromChain({ contract, path, signer = SIGNER_DEFAULT }) {
  const root = await view(signer, "public_key", {}, "final");
  const { eps, point } = derivePoint(root, contract, path);
  return { signer, root, epsilon: eps, derivedKey: toNearKey(point), derivedHex: `04${bytesToHex(point.toRawBytes(false).slice(1))}`, address: evmAddress(point) };
}

async function viaChainsigJs(dir, root, contract, path) {
  const req = createRequire(join(dir, "package.json"));
  const { utils } = await import(pathToFileURL(req.resolve("chainsig.js")).href);
  const { najToUncompressedPubKeySEC1, deriveChildPublicKey } = utils.cryptography;
  const child = deriveChildPublicKey(najToUncompressedPubKeySEC1(root), contract, path);
  return evmAddress(secp256k1.ProjectivePoint.fromHex(child));
}

async function main() {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const contract = arg("contract");
  const path = arg("path");
  if (!contract || !path) {
    process.stderr.write("usage: derive.mjs --contract <account id> --path <path> [--signer <signer account>] [--chainsig-dir <dir with chainsig.js installed>]\n");
    process.exit(2);
  }
  const d = await deriveFromChain({ contract, path, signer: arg("signer") });
  const out = (k, v) => process.stdout.write(`${k.padEnd(22)}${v}\n`);
  out("signer contract", d.signer);
  out("predecessor (caller)", contract);
  out("path", path);
  out("tweak string", `${TWEAK_PREFIX}${contract},${path}`);
  out("signer root pubkey", d.root);
  out("epsilon (tweak)", `0x${d.epsilon.toString(16).padStart(64, "0")}`);
  out("derived pubkey", d.derivedKey);
  out("derived pubkey (hex)", d.derivedHex);
  out("Base Sepolia address", d.address);

  const checks = [["A from-scratch derivation", d.address]];
  const onchain = await view(d.signer, "derived_public_key", { path, predecessor: contract }, "final").catch((e) => `error: ${String(e.message).slice(0, 80)}`);
  const onchainOk = typeof onchain === "string" && onchain.startsWith("secp256k1:");
  checks.push(["B signer contract view", onchainOk ? evmAddress(parseNearKey(onchain)) : onchain]);
  const dir = arg("chainsig-dir");
  if (dir) checks.push(["C chainsig.js", await viaChainsigJs(dir, d.root, contract, path).catch((e) => `error: ${String(e.message).slice(0, 80)}`)]);
  let ok = true;
  for (const [name, addr] of checks) {
    const same = addr === d.address;
    ok &&= same;
    out(`check ${name.slice(0, 1)}`, `${addr}  ${same ? "MATCH" : "MISMATCH"} (${name.slice(2)})`);
  }
  if (!dir) out("check C", "chainsig.js not run (pass --chainsig-dir)");
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
