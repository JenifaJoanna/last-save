#!/usr/bin/env node
// Publishes the licence wasm as an immutable global contract (NEP-591, by code hash).
//   node scripts/launch/publish-global.mjs [--wasm <path>] [--publisher <account>] [--mode hash|account]
//                                          [--dry-run | --publish]
// Default is --dry-run: prints the size, code hash, burn cost and the publisher's balance, sends nothing.
// --publish sends one DeployGlobalContract transaction. The cost is BURNT (10 NEAR per 100 KB) and the code
// is immutable by hash, so a re-publish burns the same amount again: check the dry run first.
// The factory is then created with `new(owner, licence_code_hash)` using the printed base58 hash.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NEAR, accountState, explorerAccount } from "../lib/near.mjs";
import { deployGlobalAction, globalCodeExists, globalDeployCost, hashB58, sendRawActions, sha256 } from "../lib/near-global.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const publish = args.includes("--publish") && !args.includes("--dry-run");
const wasmPath = resolve(opt("--wasm", join(ROOT, "contracts/licence/target/near/lastsave_licence.opt.wasm")));
const publisher = opt("--publisher", "lastsave-studio.testnet");
const mode = opt("--mode", "hash");
const yocto = (n) => `${(Number(n / 10n ** 20n) / 1e4).toFixed(4)} NEAR`;

if (!existsSync(wasmPath)) throw new Error(`no wasm at ${wasmPath}: run ./scripts/build-wasm.sh licence and wasm-opt first`);
const code = readFileSync(wasmPath);
const hash = hashB58(code);
const cost = globalDeployCost(code.length);
const state = await accountState(publisher);
const balance = state ? BigInt(state.amount) : 0n;
const exists = await globalCodeExists(hash);
const enough = balance >= cost + NEAR("0.5");

console.log(JSON.stringify({
  mode: publish ? "PUBLISH" : "DRY RUN (nothing is sent)",
  wasm: wasmPath, size_bytes: code.length, sha256_hex: sha256(code).toString("hex"), code_hash_base58: hash,
  deploy_mode: mode === "hash" ? "by code hash (immutable)" : "by account id (updatable by the publisher)",
  burn_cost: yocto(cost), publisher, publisher_url: explorerAccount(publisher),
  publisher_balance: yocto(balance), enough_funds: enough, already_published: exists,
}, null, 1));

if (!publish) process.exit(0);
if (exists) { console.log("already published: nothing to do"); process.exit(0); }
if (!enough) throw new Error(`publisher has ${yocto(balance)}, needs ${yocto(cost)} plus 0.5 NEAR for gas`);
const r = await sendRawActions(publisher, publisher, [deployGlobalAction(code, mode)]);
if (r.failure) throw new Error(`publish failed: ${JSON.stringify(r.failure)} (${r.url})`);
console.log(JSON.stringify({ published: true, tx: r.url, code_hash_base58: hash, now_available: await globalCodeExists(hash) }, null, 1));
