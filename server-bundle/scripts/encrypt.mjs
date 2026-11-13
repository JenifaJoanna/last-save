#!/usr/bin/env node
// pnpm --filter server-bundle encrypt --key-file <path> [--in dist/server-bundle.tar.gz] [--out dist/artifact.bin]
// Writes the encrypted artifact and artifact.json { sha256, build_hash, size }. The key is read from the file and never printed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptBundle, parseKey, sha256Hex } from "../lib/crypto.mjs";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const keyFile = opt("key-file");
if (!keyFile) { process.stderr.write("usage: encrypt --key-file <path> [--in <bundle.tar.gz>] [--out <artifact.bin>]\n"); process.exit(2); }
const input = resolve(opt("in", join(here, "dist", "server-bundle.tar.gz")));
const output = resolve(opt("out", join(here, "dist", "artifact.bin")));

let key;
try { key = parseKey(readFileSync(resolve(keyFile.replace(/^~(?=\/)/, process.env.HOME ?? "~")))); } catch (e) { process.stderr.write(`cannot use key file: ${e.message}\n`); process.exit(1); }
const plain = readFileSync(input);
const file = encryptBundle(plain, key);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, file);
const meta = { sha256: sha256Hex(file), build_hash: sha256Hex(plain), size: file.length };
writeFileSync(join(dirname(output), "artifact.json"), JSON.stringify(meta, null, 1));
process.stdout.write(`artifact: ${output.split("/").pop()} (${meta.size} bytes)\nsha256: ${meta.sha256}\nbuild_hash: ${meta.build_hash}\n`);
