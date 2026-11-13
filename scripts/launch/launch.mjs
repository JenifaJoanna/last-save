#!/usr/bin/env node
// Studio launch of a Last Save licence instance, step by step, recorded in local/<contract>/launch.json (gitignored)
// and proof/launch-<contract>.json (tx hashes only, tracked).
//   node scripts/launch/launch.mjs <step...>   steps: bundle mirrors deploy escrow attest snapkey official lock
// Env: CONTRACT (lastsave-licence.testnet) STUDIO (lastsave-studio.testnet) OFFICIAL_BASE (emberrift) LIVENESS=demo|prod
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import nearApi from "near-api-js";
import { accountState, call, deploy, ensureKey, rpc, sendActions, view, NEAR } from "../lib/near.mjs";
import { keyCommitment, sealServerKey } from "../lib/escrow.mjs";

const CONTRACT = process.env.CONTRACT ?? "lastsave-licence.testnet";
const STUDIO = process.env.STUDIO ?? "lastsave-studio.testnet";
const OFFICIAL_BASE = process.env.OFFICIAL_BASE ?? "emberrift";
const OFFICIAL_URL = `https://${OFFICIAL_BASE}.pages.dev`;
const PLATFORM_URL = process.env.PLATFORM_URL ?? "https://last-save.pages.dev";
const RAW = "https://raw.githubusercontent.com/JenifaJoanna/last-save/main";
const LOCAL = `local/${CONTRACT}`;
const STATE = `${LOCAL}/launch.json`;
const PROOF = `proof/launch-${CONTRACT.split(".")[0]}.json`;
mkdirSync(LOCAL, { recursive: true, mode: 0o700 });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const proof = existsSync(PROOF) ? JSON.parse(readFileSync(PROOF, "utf8")) : { contract: CONTRACT, steps: [] };
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
const record = (step, data) => {
  proof.steps.push({ step, at: new Date().toISOString(), ...data });
  writeFileSync(PROOF, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(`${step}: ${JSON.stringify(data)}\n`);
};
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", ...opts });
const keyFile = `${LOCAL}/K.hex`;
const keyHex = () => readFileSync(keyFile, "utf8").trim();

const LIVENESS = process.env.LIVENESS === "prod"
  ? { probe_interval_ms: 6 * 3600_000, fail_threshold: 4, receipt_window_ms: 72 * 3600_000, report_window_ms: 72 * 3600_000, quorum_bps: 5000 }
  : { probe_interval_ms: 20_000, fail_threshold: 3, receipt_window_ms: 180_000, report_window_ms: 120_000, quorum_bps: 5000 };

const steps = {
  /** Build the client + server bundle, encrypt it with K (generated once per instance). */
  bundle() {
    if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
    const env = { ...process.env, VITE_LICENCE_CONTRACT: CONTRACT, VITE_PLATFORM_URL: PLATFORM_URL };
    sh("npx", ["vite", "build", "--logLevel", "warn"], { cwd: "game/client", env });
    sh("pnpm", ["--filter", "server-bundle", "build"], { env });
    sh("pnpm", ["--filter", "server-bundle", "encrypt", "--key-file", `../${keyFile}`], { env });
    const meta = JSON.parse(readFileSync("server-bundle/dist/artifact.json", "utf8"));
    state.artifact = { ...meta, file: `ember-rift-${meta.build_hash.slice(0, 16)}.bin` };
    state.key_commitment = keyCommitment(keyHex());
    save();
    record("bundle", { build_hash: meta.build_hash, artifact_sha256: meta.sha256, size: meta.size, key_commitment: state.key_commitment });
  },
  /** Hash-named copies of the artifact and both wasm modules: GitHub raw (main) + the platform's Pages site. */
  mirrors() {
    mkdirSync("artifacts", { recursive: true });
    // the platform mirror is web/dist/mirror, copied from artifacts/ at web build time
    const a = state.artifact;
    copyFileSync("server-bundle/dist/artifact.bin", `artifacts/${a.file}`);

    for (const kind of ["release", "probe"]) {
      const src = process.env[`${kind.toUpperCase()}_WASM`] ?? `outlayer/dist/lastsave-${kind}.wasm`;
      const h = sha(readFileSync(src));
      const name = `lastsave-${kind}-${h.slice(0, 16)}.wasm`;
      copyFileSync(src, `artifacts/${name}`);

      state[kind] = { sha256: h, urls: [`${RAW}/artifacts/${name}`, `${PLATFORM_URL}/mirror/${name}`] };
    }
    state.artifact.urls = [`${RAW}/artifacts/${a.file}`, `${PLATFORM_URL}/mirror/${a.file}`];
    save();
    record("mirrors", { release: state.release, probe: state.probe, artifact_urls: state.artifact.urls, note: "commit+push artifacts/ and redeploy web before attest" });
  },
  async deploy() {
    const wasm = readFileSync(process.env.LICENCE_WASM ?? "contracts/licence/target/near/lastsave_licence.opt.wasm");
    const config = {
      studio: STUDIO, outlayer: "outlayer.testnet", title: "Ember Rift", game_id: "ember-rift", media: `${PLATFORM_URL}/art/ember-rift-key-960.jpg`,
      price: NEAR("0.25").toString(), fund_bps: 4000, royalty_bps: 1000,
      release: state.release, probe: state.probe, key_commitment: state.key_commitment,
      artifact: { urls: state.artifact.urls, sha256: state.artifact.sha256, build_hash: state.artifact.build_hash, size: state.artifact.size },
      official_endpoint: OFFICIAL_URL, liveness: LIVENESS,
      pool: { epoch_ms: process.env.LIVENESS === "prod" ? 7 * 86400_000 : 120_000, pay_per_session: NEAR("0.01").toString(), epoch_cap: NEAR("0.05").toString() },
    };
    const r = await deploy(CONTRACT, wasm, { method: "new", args: { config }, gas: 100 });
    state.code_sha256 = sha(wasm);
    save();
    record("deploy", { ...r, code_sha256: state.code_sha256, wasm_bytes: wasm.length, liveness: LIVENESS });
  },
  async escrow() {
    const sealed = await sealServerKey({ owner: CONTRACT, releaseHash: state.release.sha256, keyHex: keyHex() });
    if (sealed.key_commitment !== state.key_commitment) throw new Error("commitment mismatch");
    const access = { Logic: { operator: "And", conditions: [{ Predecessor: { condition: { Whitelist: { accounts: [CONTRACT] } } } }, { WasmHash: { hash: state.release.sha256 } }] } };
    const cost = await view("outlayer.testnet", "estimate_storage_cost", { accessor: { WasmHash: { hash: state.release.sha256 } }, profile: "escrow", owner: CONTRACT,
      encrypted_secrets_base64: sealed.encrypted_secrets_base64, access, vault_id: null });
    const r = await call(STUDIO, CONTRACT, "escrow_key", { encrypted_secrets_base64: sealed.encrypted_secrets_base64 }, { gas: 150, deposit: BigInt(cost) + NEAR("0.001") });
    record("escrow", { hash: r.hash, url: r.url, failure: r.failure, storage_cost: cost, escrowed: (await view(CONTRACT, "get_info")).escrowed });
  },
  async attest() {
    const r = await call(STUDIO, CONTRACT, "attest", {}, { gas: 300, deposit: "0.03" });
    const info = await view(CONTRACT, "get_info");
    record("attest", { hash: r.hash, url: r.url, failure: r.failure, escrow_verified: info.escrow_verified, logs: r.logs.filter((l) => !l.includes("EVENT_JSON")).slice(-2) });
  },
  /** Function-call key on the studio account, allowed only post_snapshot on the licence contract: the official server's key. */
  async snapkey() {
    const kp = nearApi.KeyPair.fromRandom("ed25519");
    const action = nearApi.transactions.addKey(kp.getPublicKey(), nearApi.transactions.functionCallAccessKey(CONTRACT, ["post_snapshot"], NEAR("0.5")));
    const r = await sendActions(STUDIO, STUDIO, [action]);
    writeFileSync(`${LOCAL}/snapshot-signer.key`, kp.toString(), { mode: 0o600 });
    record("snapkey", { hash: r.hash, url: r.url, public_key: kp.getPublicKey().toString(), methods: ["post_snapshot"] });
  },
  official() {
    const env = { ...process.env, HOST_ID: "official", BUILD_HASH: state.artifact.build_hash, LICENCE_CONTRACT: CONTRACT, STUDIO_ACCOUNT: STUDIO,
      SNAPSHOT_SIGNER: readFileSync(`${LOCAL}/snapshot-signer.key`, "utf8").trim(), VITE_LICENCE_CONTRACT: CONTRACT, VITE_PLATFORM_URL: PLATFORM_URL };
    sh("npx", ["vite", "build", "--logLevel", "warn"], { cwd: "game/client", env });
    const out = spawnSync(process.execPath, ["scripts/deploy.mjs", OFFICIAL_BASE], { cwd: "game/server", env, encoding: "utf8" });
    if (out.status !== 0) throw new Error(`official deploy failed: ${out.stderr?.slice(-400)}`);
    record("official", { url: OFFICIAL_URL, worker: `${OFFICIAL_BASE}-arena`, build_hash: state.artifact.build_hash });
  },
  /** Irreversible: deletes every full-access key on the contract account. Requires LOCK=yes. */
  async lock() {
    if (process.env.LOCK !== "yes") throw new Error("refusing to lock without LOCK=yes (irreversible)");
    await ensureKey(CONTRACT);
    const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: CONTRACT })).keys;
    const actions = keys.map((k) => nearApi.transactions.deleteKey(nearApi.utils.PublicKey.from(k.public_key)));
    const r = await sendActions(CONTRACT, CONTRACT, actions);
    const left = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: CONTRACT })).keys.length;
    record("lock", { hash: r.hash, url: r.url, keys_deleted: keys.length, keys_left: left });
  },
};

for (const name of process.argv.slice(2)) {
  if (!steps[name]) throw new Error(`unknown step ${name}`);
  try { await steps[name](); } catch (e) { record(name, { error: String(e?.message ?? e).slice(0, 500) }); process.exitCode = 1; break; }
}
if (!process.argv[2]) process.stdout.write(`state: ${JSON.stringify({ CONTRACT, has: Object.keys(state), acct: !!(await accountState(CONTRACT)) })}\n`);
