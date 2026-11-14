#!/usr/bin/env node
// The TESTNET mode of `pnpm demo:fresh --testnet` (the default `pnpm demo:fresh` is the local sandbox: scripts/demo/fresh.mjs).
// Proves the whole thing on a brand-new testnet instance:
//   creates a fresh funded sub-account, runs the studio launch (bundle, deploy, escrow, attest, snapkey), serves the official
//   game server from a local `wrangler dev` behind a cloudflared quick tunnel, then runs every e2e phase against it.
// It never locks the account. Every transaction hash is printed and written to proof/run-<UTC timestamp>.json.
//   node scripts/e2e/demo-fresh.mjs [--parent <account>] [--account <id>] [--fund 3.4] [--players existing|new]
//        [--cleanup] [--keep-running] [--matches 2] [--from <phase>] [--to <phase>] [--dry-run]
// Env: FUNDER (account id) + FUNDER_KEY (its ed25519 secret key, held in memory only) fund the run instead of the local key
//      store; STUDIO (default lastsave-studio.testnet); LICENCE_WASM; RELEASE_WASM / PROBE_WASM.
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import nearApi from "near-api-js";
import { accountState, call, connection, createSubAccount, deleteAccount, deploy, ensureKey, explorerTx, NEAR, NETWORK, rpc, sendActions, view } from "../lib/near.mjs";
import { PHASES, buildCtx, runPhases, shutdown } from "./e2e-testnet.mjs";
import { freePort, quickTunnel, readJson, root, serveDir, startOfficial, waitHealthy } from "./demo-local.mjs";
import { balance, fmtN, log, sanitizePath, sha256Hex } from "./util.mjs";

sanitizePath();
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const out = (s) => process.stdout.write(`${s}\n`);
const die = (s, code = 1) => { process.stderr.write(`${s}\n`); process.exit(code); };

const FUNDER = process.env.FUNDER, FUNDER_KEY = process.env.FUNDER_KEY;
if (FUNDER && FUNDER_KEY) connection({ [FUNDER]: FUNDER_KEY }); // in-memory only; never written or printed
const PARENT = opt("parent", FUNDER ?? "lastsave-licence.testnet");
const STUDIO = process.env.STUDIO ?? "lastsave-studio.testnet";
const FUND = opt("fund", "3.4");
const PLAYER_MODE = opt("players", "existing");
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12).toLowerCase(); // yyyymmddhhmm
const ACCOUNT = opt("account", `run-${stamp}.${PARENT}`);
const scratch = join(root, "local", "demo", ACCOUNT);
const stateFile = join(root, "local", ACCOUNT, "launch.json");
const PLATFORM_URL = process.env.PLATFORM_URL ?? "https://last-save.pages.dev";
const kinds = ["release", "probe"];
const wasmPath = (k) => process.env[`${k.toUpperCase()}_WASM`] ?? join(root, "outlayer", "dist", `lastsave-${k}.wasm`);
const licenceWasm = process.env.LICENCE_WASM ?? join(root, "contracts", "licence", "target", "near", "lastsave_licence.opt.wasm");
const spendable = (s) => (s ? BigInt(s.amount) - BigInt(s.storage_usage) * 10n ** 19n : 0n);
const cleanupTasks = [];

function launch(steps) {
  const r = spawnSync(process.execPath, ["scripts/launch/launch.mjs", ...steps], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, CONTRACT: ACCOUNT, STUDIO, OFFICIAL_BASE: "unused-local-official", LIVENESS: "demo", PLATFORM_URL },
  });
  out(r.stdout.trimEnd());
  if (r.status !== 0) throw new Error(`launch.mjs ${steps.join(" ")} failed`);
}
const patchState = (fn) => { const s = readJson(stateFile); fn(s); writeFileSync(stateFile, JSON.stringify(s, null, 2) + "\n", { mode: 0o600 }); return s; };

async function plan() {
  const parentState = await accountState(PARENT);
  const problems = [];
  if (!parentState) problems.push(`${PARENT} does not exist`);
  else if (spendable(parentState) < NEAR(FUND) + NEAR("0.1")) problems.push(`${PARENT} can spare only ${fmtN(spendable(parentState))}; the run needs ${FUND} N (contract storage) plus gas`);
  try { await ensureKey(PARENT); } catch (e) { problems.push(`no usable key for ${PARENT}: ${e.message}`); }
  for (const f of [licenceWasm, wasmPath("release"), wasmPath("probe")]) if (!existsSync(f)) problems.push(`missing file ${f.replace(root, ".")}`);
  if (spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status !== 0) problems.push("cloudflared is not installed");
  return { parentSpendable: spendable(parentState), problems };
}

async function createAccount(id, fund) {
  if (id.endsWith(`.${PARENT}`)) return createSubAccount(PARENT, id, fund);
  const kp = nearApi.KeyPair.fromRandom("ed25519"); // top-level testnet id: the registrar creates it, the parent pays
  await connection().store.keyStores[1].setKey(NETWORK, id, kp);
  const r = await call(PARENT, "testnet", "create_account", { new_account_id: id, new_public_key: kp.getPublicKey().toString() }, { gas: 60, deposit: fund });
  if (r.failure) throw new Error(`create_account ${id} failed: ${JSON.stringify(r.failure).slice(0, 200)}`);
  return r;
}

async function waitAccount(id) {
  for (let i = 0; i < 20; i++) { if (await accountState(id)) return; await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error(`${id} did not appear on chain`);
}

async function pickPlayers(price) {
  const base = ["lastsave-mira", "lastsave-kofi", "lastsave-yuna", "lastsave-dario"].map((n) => `${n}.testnet`);
  const host = "lastsave-fanhost.testnet", floor = price + NEAR("0.3");
  if (PLAYER_MODE === "existing") {
    const low = [];
    for (const id of [...base, host]) if ((await balance(id)) < floor) low.push(`${id} (${fmtN(await balance(id))})`);
    if (low.length) die(`these accounts are below ${fmtN(floor)} (price plus the 0.3 N floor): ${low.join(", ")}. Re-run with --players new to create funded accounts, or top them up.`);
    return { players: base, fanhost: host, created: [] };
  }
  const created = [];
  const mk = async (name) => { const id = `${name}-${stamp}.${PARENT}`; const c = await createAccount(id, "0.5"); await waitAccount(id); created.push(id); log(`created ${id}: ${c.url}`); return id; };
  const players = [];
  for (const n of ["mira", "kofi", "yuna", "dario"]) players.push(await mk(n));
  return { players, fanhost: await mk("host"), created };
}

async function main() {
  if (flag("cleanup-only")) { // delete an instance kept from an earlier run (its generated players, if any, were created under the same parent)
    const f = join(root, "local", ACCOUNT, "snapshot-signer.key");
    await cleanup([], existsSync(f) ? readFileSync(f, "utf8").trim() : null);
    return;
  }
  const { parentSpendable, problems } = await plan();
  out(`demo:fresh plan: instance ${ACCOUNT} (parent ${PARENT}, spendable ${fmtN(parentSpendable)}), fund ${FUND} N, studio ${STUDIO}, players ${PLAYER_MODE}, locking: never`);
  if (problems.length) { for (const p of problems) process.stderr.write(`blocker: ${p}\n`); if (!flag("dry-run")) die("stopping before any spend", 3); }
  if (flag("dry-run")) { out(problems.length ? "dry run: blockers listed above" : "dry run: ready"); return; }

  mkdirSync(scratch, { recursive: true, mode: 0o700 });
  // The launch pipeline rebuilds these two folders for this instance; keep the live instance's copies safe.
  const backups = ["server-bundle/dist", "game/client/dist"].filter((d) => existsSync(join(root, d))).map((d) => ({ d, b: join(scratch, "backup", d) }));
  for (const { d, b } of backups) cpSync(join(root, d), b, { recursive: true });
  cleanupTasks.push(() => { for (const { d, b } of backups) { rmSync(join(root, d), { recursive: true, force: true }); cpSync(b, join(root, d), { recursive: true }); } });

  const createdAccounts = [];
  const c = await createAccount(ACCOUNT, FUND);
  await waitAccount(ACCOUNT);
  log(`created ${ACCOUNT} with ${FUND} N: ${c.url}`);
  const setupTxs = [{ label: "create instance account", ...c }];

  launch(["bundle"]);
  let state = readJson(stateFile);
  mkdirSync(join(scratch, "mirror"), { recursive: true });
  const a = state.artifact;
  copyFileSync(join(root, "server-bundle", "dist", "artifact.bin"), join(scratch, "mirror", a.file));
  const programs = {};
  for (const k of kinds) {
    const buf = readFileSync(wasmPath(k)), h = sha256Hex(buf), name = `lastsave-${k}-${h.slice(0, 16)}.wasm`;
    writeFileSync(join(scratch, "mirror", name), buf);
    programs[k] = { sha256: h, name };
  }
  const files = await serveDir(join(scratch, "mirror"));
  const mirrorTunnel = await quickTunnel(files.port, scratch);
  cleanupTasks.push(() => { files.stop(); mirrorTunnel.stop(); });
  log(`mirror tunnel: ${mirrorTunnel.url}`);
  state = patchState((s) => {
    for (const k of kinds) s[k] = { sha256: programs[k].sha256, urls: [`${mirrorTunnel.url}/${programs[k].name}`] };
    s.artifact.urls = [`${mirrorTunnel.url}/${a.file}`];
  });

  const officialPort = await freePort();
  const officialTunnel = await quickTunnel(officialPort, scratch);
  cleanupTasks.push(() => officialTunnel.stop());
  log(`official server tunnel: ${officialTunnel.url}`);

  // Same configuration as the studio launch step, but with the tunnel as the official endpoint (launch.mjs hard-codes <base>.pages.dev).
  const config = {
    studio: STUDIO, outlayer: "outlayer.testnet", title: "Ember Rift", game_id: "ember-rift", media: `${PLATFORM_URL}/art/ember-rift-key-960.jpg`,
    price: NEAR("0.25").toString(), fund_bps: 4000, royalty_bps: 1000, release: state.release, probe: state.probe, key_commitment: state.key_commitment,
    artifact: { urls: state.artifact.urls, sha256: state.artifact.sha256, build_hash: state.artifact.build_hash, size: state.artifact.size },
    official_endpoint: officialTunnel.url,
    liveness: { probe_interval_ms: 20_000, fail_threshold: 3, receipt_window_ms: 180_000, report_window_ms: 120_000, quorum_bps: 5000 },
    pool: { epoch_ms: 120_000, pay_per_session: NEAR("0.01").toString(), epoch_cap: NEAR("0.05").toString() },
  };
  const d = await deploy(ACCOUNT, readFileSync(licenceWasm), { method: "new", args: { config }, gas: 100 });
  log(`deployed ${ACCOUNT}: ${d.url}`);
  setupTxs.push({ label: "deploy + new(config)", ...d });

  launch(["escrow", "attest", "snapkey"]);
  const info = await view(ACCOUNT, "get_info", {});
  if (!info.escrow_verified) throw new Error("attest did not verify the escrow; see the launch output above (OutLayer may need a retry: run launch.mjs attest again)");
  const signer = readFileSync(join(root, "local", ACCOUNT, "snapshot-signer.key"), "utf8").trim();
  const official = await startOfficial({
    scratch, port: officialPort, signer, clientDist: join(root, "game", "client", "dist"),
    vars: { HOST_ID: "official", BUILD_HASH: state.artifact.build_hash, LICENCE_CONTRACT: ACCOUNT, STUDIO_ACCOUNT: STUDIO, RPC_URLS: process.env.NEAR_RPCS ?? "https://test.rpc.fastnear.com,https://near-testnet.drpc.org" },
  });
  cleanupTasks.push(() => official.stop());
  await waitHealthy(officialTunnel.url, "official", 90_000);
  log("official server reachable through its tunnel");

  const who = await pickPlayers(BigInt(info.config.price));
  createdAccounts.push(...who.created);
  const ctx = buildCtx({
    contract: ACCOUNT, officialUrl: officialTunnel.url, officialWorker: "local wrangler dev", players: who.players, fanhost: who.fanhost,
    matches: Number(opt("matches", 2)),
    kill: async () => { official.stop(); officialTunnel.stop(); return "stopped the local wrangler dev and its tunnel"; },
  });
  ctx.report.phase("setup", "fresh instance created, launched and attested");
  for (const t of setupTxs) ctx.report.tx(t.label, { hash: t.hash, url: t.url ?? explorerTx(t.hash), failure: null });
  ctx.report.check("instance is Alive, escrowed and verified", info.status === "Alive" && info.escrowed && info.escrow_verified);
  ctx.report.check("account is not locked (full-access key kept)", (await nearRpcKeys(ACCOUNT)) > 0);
  ctx.report.end();

  const idx = (k, dflt) => (k === undefined ? dflt : PHASES.findIndex((p) => p.id === k || p.name === k));
  const summary = await runPhases(ctx, { from: idx(opt("from"), 0), to: idx(opt("to"), PHASES.length - 1) });
  shutdown(ctx);

  if (flag("cleanup")) await cleanup(createdAccounts, signer);
  else out(`instance kept: ${ACCOUNT} (delete it later with: node scripts/e2e/demo-fresh.mjs --account ${ACCOUNT} --cleanup-only)`);
  process.exitCode = summary.totals.failed > 0 ? 1 : 0;
}

async function nearRpcKeys(id) {
  return (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id })).keys.filter((k) => k.access_key.permission === "FullAccess").length;
}

/** Returns the money: deletes the player accounts we created and the instance (beneficiary: the parent), and removes the snapshot key. */
async function cleanup(extra, signerSecret) {
  try {
    if (!signerSecret) throw new Error("no snapshot key on file");
    const pk = nearApi.KeyPair.fromString(signerSecret).getPublicKey();
    const r = await sendActions(STUDIO, STUDIO, [nearApi.transactions.deleteKey(pk)]);
    out(`removed the instance's snapshot key from ${STUDIO}: ${r.url}`);
  } catch (e) { out(`snapshot key not removed: ${String(e.message).slice(0, 120)}`); }
  for (const id of [...extra, ACCOUNT]) {
    try {
      const r = await deleteAccount(id, PARENT);
      out(`deleted ${id}, balance returned to ${PARENT}: ${r.url}`);
      rmSync(join(process.env.LASTSAVE_KEYS_DIR ?? join(homedir(), ".near-credentials"), NETWORK, `${id}.json`), { force: true });
    } catch (e) { out(`could not delete ${id}: ${String(e.message).slice(0, 160)}`); }
  }
}

try { await main(); }
catch (e) { process.stderr.write(`demo:fresh failed: ${String(e?.message ?? e)}\n`); process.exitCode = 1; }
finally { for (const t of cleanupTasks.reverse()) { try { t(); } catch { /* best effort */ } } process.exit(process.exitCode ?? 0); }
