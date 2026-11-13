#!/usr/bin/env node
// Runs the day-one spike against testnet, step by step, appending every tx to
// proof/spike-run.json. Steps: create deploy escrow attest refuse-alive fail retry kill release cleanup
//   node scripts/spike/run-spike.mjs <step...>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { accountState, call, createSubAccount, deleteAccount, deploy, explorerAccount, view } from "../lib/near.mjs";
import { sealServerKey } from "./encrypt-escrow.mjs";

const SPIKE = process.env.SPIKE_ACCOUNT ?? "spike.lastsave-licence.testnet";
const PARENT = "lastsave-licence.testnet";
const STUDIO = "lastsave-studio.testnet";
const CALLER = "lastsave-mira.testnet"; // a random player triggers attest/release: anyone may
const KEY_FILE = process.env.SPIKE_KEY_FILE;
const RELEASE_SHA = process.env.RELEASE_COMMIT;
const RELEASE_HASH = createHash("sha256").update(readFileSync("outlayer/dist/lastsave-release.wasm")).digest("hex");
const RELEASE_URL = `https://raw.githubusercontent.com/JenifaJoanna/last-save/${RELEASE_SHA}/outlayer/dist/lastsave-release.wasm`;
const LOG = "proof/spike-run.json";
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : { account: SPIKE, steps: [] };
const record = (step, data) => {
  log.steps.push({ step, at: new Date().toISOString(), ...data });
  writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
  process.stdout.write(`${step}: ${JSON.stringify(data)}\n`);
};
const keyHex = () => readFileSync(KEY_FILE, "utf8").trim();
const state = () => view(SPIKE, "get_state");
const settle = async (ms) => new Promise((r) => setTimeout(r, ms));
const brief = (s) => ({ status: s.status, escrowed: s.escrowed, in_flight: s.in_flight, attempts: s.attempts,
  attested_sha256: s.attested_sha256, released: !!s.released_key, last_error: s.last_error });

const steps = {
  async create() {
    if (await accountState(SPIKE)) return record("create", { skipped: "exists" });
    record("create", await createSubAccount(PARENT, SPIKE, "2.3"));
  },
  async deploy() {
    const { key_commitment } = await sealServerKey({ owner: SPIKE, releaseHash: RELEASE_HASH, keyHex: keyHex() });
    const wasm = readFileSync("spike/contract/target/near/lastsave_spike.wasm");
    const r = await deploy(SPIKE, wasm, { method: "new", args: { studio: STUDIO, outlayer: "outlayer.testnet",
      release_url: RELEASE_URL, release_hash: RELEASE_HASH, key_commitment } });
    record("deploy", { ...r, release_url: RELEASE_URL, release_hash: RELEASE_HASH, key_commitment });
  },
  async escrow() {
    const sealed = await sealServerKey({ owner: SPIKE, releaseHash: RELEASE_HASH, keyHex: keyHex() });
    const access = await view(SPIKE, "escrow_access");
    const cost = await view("outlayer.testnet", "estimate_storage_cost", { accessor: { WasmHash: { hash: RELEASE_HASH } },
      profile: "escrow", owner: SPIKE, encrypted_secrets_base64: sealed.encrypted_secrets_base64, access, vault_id: null });
    const r = await call(STUDIO, SPIKE, "escrow_key", { encrypted_secrets_base64: sealed.encrypted_secrets_base64 },
      { gas: 150, deposit: BigInt(cost) });
    const exists = await view("outlayer.testnet", "secrets_exist", { accessor: { WasmHash: { hash: RELEASE_HASH } }, profile: "escrow", owner: SPIKE }).catch((e) => `view failed: ${e.message}`);
    record("escrow", { ...r, storage_cost: cost, access, secrets_exist: exists, state: brief(await state()) });
  },
  async attest() {
    const r = await call(CALLER, SPIKE, "attest", {}, { gas: 300, deposit: "0.02" });
    record("attest", { ...r, state: brief(await state()) });
  },
  async "refuse-alive"() {
    const r = await call(CALLER, SPIKE, "release_unchecked", {}, { gas: 300, deposit: "0.02" });
    record("refuse-alive", { ...r, state: brief(await state()) });
  },
  async fail() {
    const r = await call(CALLER, SPIKE, "attest_starved", {}, { gas: 300, deposit: "0.02" });
    record("fail", { ...r, state: brief(await state()) });
  },
  async retry() {
    const r = await call(CALLER, SPIKE, "attest", {}, { gas: 300, deposit: "0.02" });
    record("retry", { ...r, state: brief(await state()) });
  },
  async kill() {
    const r = await call(STUDIO, SPIKE, "kill", {}, { gas: 30 });
    await settle(4000); // let final finality catch up before the enclave reads status
    record("kill", { ...r, state: brief(await state()) });
  },
  async release() {
    const r = await call(CALLER, SPIKE, "release", {}, { gas: 300, deposit: "0.02" });
    const s = await state();
    const matches = s.released_key === keyHex();
    record("release", { ...r, released_key_matches_local_K: matches, state: brief(s) });
  },
  async cleanup() {
    const r = await deleteAccount(SPIKE, PARENT);
    record("cleanup", { ...r, note: "spike account deleted, balance returned", explorer: explorerAccount(SPIKE) });
  },
};

if (!KEY_FILE || !RELEASE_SHA) throw new Error("set SPIKE_KEY_FILE and RELEASE_COMMIT");
for (const name of process.argv.slice(2)) {
  if (!steps[name]) throw new Error(`unknown step ${name}`);
  try { await steps[name](); } catch (e) { record(name, { error: String(e?.message ?? e).slice(0, 600) }); process.exitCode = 1; break; }
}
