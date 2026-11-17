#!/usr/bin/env node
// Studio launch of a Last Save licence instance, step by step, recorded in local/<contract>/launch.json (gitignored)
// and proof/launch-<contract>.json (tx hashes only, tracked).
//   node scripts/launch/launch.mjs <step...>   steps: bundle mirrors deploy escrow attest snapkey official lock
// v2 (factory, NEP-591 global contract):   publish factory (once)  |  bundle mirrors instance escrow attest snapkey official verify (per NAME)
// v2 artifact pipeline (replaces bundle): cibuild walrus cdn mirrors instance escrow attest verify. cibuild tags build-<NAME> (plain git),
//   waits for the CI release, verifies Sigstore provenance over public endpoints, encrypts that tarball. walrus: testnet blob; cdn: Pages kiln-cdn-<NAME>.
//   NAME=ember-rift node scripts/launch/launch.mjs instance ...   -> CONTRACT = <NAME>.<FACTORY>, born locked (no deploy/lock steps)
// Env: CONTRACT (lastsave-licence.testnet) STUDIO (lastsave-studio.testnet) OFFICIAL_BASE (emberrift) LIVENESS=demo|prod
//   v2: NAME FACTORY (lastsave-factory.testnet) OPS_N (1.5) FACTORY_N (2.5) PUBLISH=yes (publish) FACTORY_LOCK=yes START_NONCE
//   --dry-run or DRY=1: prints every tx the steps would send and the NEAR needed; sends nothing.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import nearApi from "near-api-js";
import { accountState, call, deploy, ensureKey, rpc, sendActions, view, NEAR } from "../lib/near.mjs";
import { keyCommitment, sealServerKey } from "../lib/escrow.mjs";
import * as v2 from "./factory-steps.mjs";
import * as artifact from "./artifact-steps.mjs";

const FACTORY = process.env.FACTORY ?? v2.FACTORY_DEFAULT;
const NAME = process.env.NAME;
const CONTRACT = process.env.CONTRACT ?? (NAME ? v2.instanceAccount(NAME, FACTORY) : "lastsave-licence.testnet");
const BORN_LOCKED = CONTRACT.endsWith(`.${FACTORY}`);
const DRY = process.argv.includes("--dry-run") || process.env.DRY === "1";
const STUDIO = process.env.STUDIO ?? "lastsave-studio.testnet";
// Factory instances get their own official server name, so v2 never revives v1's deliberately dead emberrift.pages.dev.
const OFFICIAL_BASE = process.env.OFFICIAL_BASE ?? (NAME ? `emberrift-${NAME}` : "emberrift");
const OFFICIAL_URL = process.env.OFFICIAL_URL ?? `https://${OFFICIAL_BASE}.pages.dev`;
const PLATFORM_URL = process.env.PLATFORM_URL ?? "https://last-save.pages.dev";
const RAW = "https://raw.githubusercontent.com/JenifaJoanna/last-save/main";
const LOCAL = `local/${CONTRACT}`;
const STATE = `${LOCAL}/launch.json`;
const PROOF = `proof/launch-${CONTRACT.split(".")[0]}.json`;
mkdirSync(LOCAL, { recursive: true, mode: 0o700 });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const proof = existsSync(PROOF) ? JSON.parse(readFileSync(PROOF, "utf8")) : { contract: CONTRACT, steps: [] };
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
const GLOBAL_PROOF = "proof/launch-factory.json";
const recordGlobal = (step, data) => {
  const g = existsSync(GLOBAL_PROOF) ? JSON.parse(readFileSync(GLOBAL_PROOF, "utf8")) : { factory: FACTORY, steps: [] };
  g.steps.push({ step, at: new Date().toISOString(), ...data });
  writeFileSync(GLOBAL_PROOF, JSON.stringify(g, null, 2) + "\n");
  process.stdout.write(`${step}: ${JSON.stringify(data)}\n`);
};
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

// TITLE / GAME_ID / MEDIA launch another studio's game through the same pipeline (default: Ember Rift).
const baseConfig = () => v2.baseConfig({ state, studio: STUDIO, platformUrl: PLATFORM_URL, officialUrl: OFFICIAL_URL, liveness: LIVENESS, prod: process.env.LIVENESS === "prod",
  ...(process.env.TITLE && { title: process.env.TITLE }), ...(process.env.GAME_ID && { gameId: process.env.GAME_ID }), ...(process.env.MEDIA && { media: process.env.MEDIA }) });
const ctx = {
  studio: STUDIO, factory: FACTORY, contract: CONTRACT, name: NAME, state, save, record, recordGlobal, config: baseConfig,
  licenceWasm: process.env.LICENCE_WASM ?? v2.LICENCE_WASM, factoryWasm: process.env.FACTORY_WASM ?? v2.FACTORY_WASM,
  local: LOCAL, keyFile, out: (s) => process.stdout.write(`${s}\n`), keyCommitment: () => keyCommitment(keyHex()),
  factoryN: NEAR(process.env.FACTORY_N ?? "2.5"), opsN: NEAR(process.env.OPS_N ?? "1.5"), minDeposit: v2.MIN_DEPOSIT_ESTIMATE, minEstimated: true,
};

const steps = {
  publish: () => v2.steps.publish(ctx),
  factory: () => v2.steps.factory(ctx),
  instance: () => v2.steps.instance(ctx),
  verify: () => v2.steps.verify(ctx),
  cibuild: () => artifact.steps.cibuild(ctx),
  walrus: () => artifact.steps.walrus(ctx),
  cdn: () => artifact.steps.cdn(ctx),
  /** Build the client + server bundle, encrypt it with K (generated once per instance). */
  bundle() {
    if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
    const env = { ...process.env, VITE_LICENCE_CONTRACT: CONTRACT, VITE_PLATFORM_URL: PLATFORM_URL };
    sh("npx", ["vite", "build", "--logLevel", "warn"], { cwd: "game/client", env });
    sh("pnpm", ["--filter", "server-bundle", "build"], { env });
    sh("pnpm", ["--filter", "server-bundle", "encrypt", "--key-file", `../${keyFile}`], { env });
    const meta = JSON.parse(readFileSync("server-bundle/dist/artifact.json", "utf8"));
    state.artifact = { ...meta, file: `ember-rift-${meta.sha256.slice(0, 16)}.bin` };
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
    // v2 artifact pipeline: studio CDN copy, Walrus aggregator, GitHub raw. Without them: GitHub raw + the platform's Pages mirror (v1).
    state.artifact.urls = state.cdn || state.walrus ? artifact.artifactMirrors({ cdn: state.cdn, walrus: state.walrus, file: a.file, platformUrl: PLATFORM_URL })
      : [`${RAW}/artifacts/${a.file}`, `${PLATFORM_URL}/mirror/${a.file}`];
    save();
    record("mirrors", { release: state.release, probe: state.probe, artifact_urls: state.artifact.urls, note: "commit+push artifacts/ (the GitHub raw copy) before the host fetches it; redeploy web only for new wasm" });
  },
  async deploy() {
    if (BORN_LOCKED) throw new Error(`${CONTRACT} is a factory instance: use the instance step, not deploy`);
    const wasm = readFileSync(process.env.LICENCE_WASM ?? "contracts/licence/target/near/lastsave_licence.opt.wasm");
    const config = baseConfig();
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
    if (BORN_LOCKED) return record("lock", { note: "factory instances are born locked: no access keys exist", keys_left: 0 });
    if (process.env.LOCK !== "yes") throw new Error("refusing to lock without LOCK=yes (irreversible)");
    await ensureKey(CONTRACT);
    const keys = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: CONTRACT })).keys;
    const actions = keys.map((k) => nearApi.transactions.deleteKey(nearApi.utils.PublicKey.from(k.public_key)));
    const r = await sendActions(CONTRACT, CONTRACT, actions);
    const left = (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: CONTRACT })).keys.length;
    record("lock", { hash: r.hash, url: r.url, keys_deleted: keys.length, keys_left: left });
  },
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (DRY) {
  try { ctx.minDeposit = BigInt(await view(FACTORY, "min_deposit", { config: v2.instanceConfig(baseConfig(), { address: "0x" + "0".repeat(40) }) })); ctx.minEstimated = false; } catch { /* factory or launch state not there yet: estimate */ }
  let total = 0n;
  for (const name of wanted) {
    if (!steps[name]) throw new Error(`unknown step ${name}`);
    for (const t of v2.plan(name, ctx)) { total += t.need; const { need, ...show } = t; process.stdout.write(`${name}: ${JSON.stringify(show)}\n`); }
    if (name === "instance" && NAME) process.stdout.write(`instance: derived payer address ${(await v2.deriveInstanceAddress({ account: CONTRACT }).catch((e) => ({ address: String(e.message) }))).address}\n`);
  }
  process.stdout.write(`DRY RUN, nothing sent. Studio needs up to ${v2.nearStr(total)} for: ${wanted.join(" ") || "(no steps)"}\n`);
  process.exit(0);
}
for (const name of wanted) {
  if (!steps[name]) throw new Error(`unknown step ${name}`);
  try { await steps[name](); } catch (e) { (["publish", "factory"].includes(name) ? recordGlobal : record)(name, { error: String(e?.message ?? e).replace(/(?:\/Users|\/home)\/[^\s"\\]+/g, "<local path>").slice(0, 500) }); process.exitCode = 1; break; }
}
if (!wanted.length) process.stdout.write(`state: ${JSON.stringify({ CONTRACT, has: Object.keys(state), acct: !!(await accountState(CONTRACT)) })}\n`);
