#!/usr/bin/env node
// Resets an UNLOCKED dev licence instance so the same account can be launched again:
// lists every storage key, deploys the cleaner contract, removes the keys in batches, verifies the state is empty,
// and archives the old launch state. Refuses if the account has no full-access key (a locked instance cannot be reset).
//   CONTRACT=lastsave-licence.testnet RESET=yes node scripts/launch/reset-dev.mjs
import { existsSync, readFileSync, renameSync } from "node:fs";
import { call, deploy, rpc } from "../lib/near.mjs";

const CONTRACT = process.env.CONTRACT ?? "lastsave-licence.testnet";
const out = (s) => process.stdout.write(`${s}\n`);
if (process.env.RESET !== "yes") throw new Error("refusing without RESET=yes (wipes the contract state)");

const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: CONTRACT })).keys;
if (!keys.some((k) => k.access_key.permission === "FullAccess")) throw new Error(`${CONTRACT} has no full-access key: it is locked and cannot be reset`);

const state = await rpc("query", { request_type: "view_state", finality: "final", account_id: CONTRACT, prefix_base64: "" });
const all = state.values.map((v) => v.key);
out(`state keys: ${all.length}`);

const cleaner = readFileSync("contracts/cleaner/target/near/lastsave_cleaner.wasm");
const d = await deploy(CONTRACT, cleaner);
out(`cleaner deployed: ${d.url}`);

for (let i = 0; i < all.length; i += 400) {
  const r = await call(CONTRACT, CONTRACT, "clean", { keys: all.slice(i, i + 400) }, { gas: 300 });
  out(`cleaned ${r.value} keys: ${r.url}${r.failure ? ` FAILURE ${JSON.stringify(r.failure)}` : ""}`);
}
const left = (await rpc("query", { request_type: "view_state", finality: "final", account_id: CONTRACT, prefix_base64: "" })).values.length;
out(`state keys left: ${left}`);
if (left !== 0) process.exitCode = 1;

const dir = `local/${CONTRACT}`;
const stamp = new Date().toISOString().replace(/[:.]/g, "");
for (const f of ["launch.json", "K.hex"]) if (existsSync(`${dir}/${f}`)) renameSync(`${dir}/${f}`, `${dir}/${f}.${stamp}.old`);
const proof = `proof/launch-${CONTRACT.split(".")[0]}.json`;
if (existsSync(proof)) renameSync(proof, proof.replace(".json", `-dev-${stamp}.json`));
out(`archived old launch state and proof (${stamp})`);
