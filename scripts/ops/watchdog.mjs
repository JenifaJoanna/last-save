#!/usr/bin/env node
// Watches the standby stores the root opens on (STANDBY, same list as the web build's VITE_STANDBY). The root itself
// already opens on the first alive one (web/src/lib/standby.ts); this adds the afterlife for a store judges killed: its
// release is triggered (zero deposit, paid from that store's own ops budget), and a warning is logged when one or no
// alive standby is left, so a new one can be launched (scripts/ops/launch-pool.sh).
// Judges' own copies: keeps COPIES (3) sbx copies free or being prepared. A launch runs from a git worktree at origin/main
// (LAUNCHER, default local/launcher), one at a time, then that worktree commits and pushes the copy's encrypted build (the
// GitHub mirror), launch record and identity targets. Funds come only from this project's studio, topped up from the
// testnet faucet into a new tagged lastsave-pool-* account when it runs low.
//   STANDBY=live,live-2,live-3 node scripts/ops/watchdog.mjs [--once]      log: local/watchdog.log
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { accountState, call, view } from "../lib/near.mjs";

const FACTORY = process.env.FACTORY ?? "lastsave-factory.testnet";
const STUDIO = process.env.STUDIO ?? "lastsave-studio.testnet";
const LIST = (process.env.STANDBY ?? "live,live-2,live-3").split(",").map((n) => `${n.trim()}.${FACTORY}`);
const EVERY_MS = Number(process.env.EVERY_MS ?? 300_000);
mkdirSync("local", { recursive: true, mode: 0o700 });
const log = (o) => { const line = JSON.stringify({ at: new Date().toISOString(), ...o }); appendFileSync("local/watchdog.log", line + "\n"); process.stdout.write(line + "\n"); };

const COPIES = Number(process.env.COPIES ?? 3);
const LAUNCHER = process.env.LAUNCHER ?? "local/launcher";
let launching = null;
const git = (...a) => execFileSync("git", ["-C", LAUNCHER, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

async function copyState() {
  const list = (await view(FACTORY, "instances")).map((r) => r.account_id).filter((a) => /^sbx-\d+\./.test(a));
  let free = 0, preparing = 0, maxN = 0;
  for (const a of list) {
    maxN = Math.max(maxN, Number(a.match(/^sbx-(\d+)/)[1]));
    const i = await view(a, "get_info").catch(() => null);
    if (i?.status === "Alive" && i.totals.supply === 0) { if (i.escrowed && i.escrow_verified) free++; else preparing++; }
  }
  return { free, preparing, next: `sbx-${maxN + 1}` };
}

/** Studio balance in NEAR; below 1.2 it tries the faucet once into a new tagged account and sends 9.5 to the studio. */
async function funded() {
  const bal = Number(BigInt((await accountState(STUDIO))?.amount ?? 0) / 10n ** 21n) / 1000;
  if (bal >= 1.2) return true;
  const id = `lastsave-pool-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.testnet`;
  try {
    const out = execFileSync("near", ["create-account", id, "--useFaucet", "--networkId", "testnet"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (!/Saving key/.test(out)) throw new Error("faucet did not create the account");
    execFileSync("near", ["send", id, STUDIO, "9.5", "--networkId", "testnet"], { stdio: "ignore" });
    log({ funds: "topped up from the faucet", via: id, studio_before: bal });
    return true;
  } catch (e) { log({ funds: "low", studio: bal, faucet: String(e.stderr ?? e.message).match(/Rate limit[^\n]*/)?.[0] ?? String(e.message).slice(0, 120) }); return false; }
}

/** After a launch: commit and push the copy's encrypted build, launch record and identity targets from the launcher. */
function publish(name) {
  const t = JSON.parse(readFileSync(`${LAUNCHER}/deploy/targets.json`, "utf8"));
  for (const u of [`https://emberrift-${name}.pages.dev`, `https://emberrift-${name}.pages.dev/health`, `https://kiln-cdn-${name}.pages.dev`]) if (!t.pages.includes(u)) t.pages.push(u);
  if (!t.workers.includes(`emberrift-${name}-arena`)) t.workers.push(`emberrift-${name}-arena`);
  writeFileSync(`${LAUNCHER}/deploy/targets.json`, JSON.stringify(t, null, 2) + "\n");
  const art = git("status", "--porcelain", "--", "artifacts").split("\n").filter((l) => l.startsWith("?? ")).map((l) => l.slice(3));
  git("add", "--", ...art, `proof/launch-${name}.json`, "deploy/targets.json");
  git("commit", "-q", "-m", `Copy ${name} launched for judges (watchdog): encrypted build for the GitHub mirror, launch record, identity targets\n\nClaude-Session: https://claude.ai/code/session_01KF8iuJD12RAgsWPYA2aG88`);
  for (let i = 0; i < 3; i++) { try { git("fetch", "-q", "origin"); git("rebase", "-q", "origin/main"); git("push", "-q", "origin", "HEAD:main"); return git("rev-parse", "--short", "HEAD"); } catch { /* main moved: retry */ } }
  throw new Error("push failed three times");
}

async function maintainCopies() {
  if (launching) { log({ copies: "launch running", name: launching.name, minutes: Math.round((Date.now() - launching.at) / 60000) }); return; }
  const c = await copyState();
  if (c.free + c.preparing >= COPIES) { log({ copies: c }); return; }
  if (!(await funded())) return;
  git("fetch", "-q", "origin"); git("checkout", "-q", "--detach", "origin/main");
  const out = openSync(`local/launch-${c.next}.out`, "a");
  const child = spawn("bash", ["scripts/ops/launch-pool.sh"], { cwd: LAUNCHER, env: { ...process.env, NAMES: `${c.next}:demo` }, stdio: ["ignore", out, out] });
  launching = { name: c.next, at: Date.now() };
  log({ copies: c, action: "launch", name: c.next });
  child.on("exit", (code) => {
    const name = launching?.name; launching = null;
    let sha = null;
    try { if (code === 0 && /done/.test(readFileSync(`local/launch-${name}.out`, "utf8"))) sha = publish(name); } catch (e) { log({ copy: name, publish: String(e.message).slice(0, 200) }); }
    log({ copy: name, launched: code === 0, pushed: sha });
  });
}

async function tick() {
  let alive = 0;
  for (const c of LIST) {
    const i = await view(c, "get_info").catch(() => null);
    if (!i) { log({ store: c, state: "missing" }); continue; }
    if (i.status === "Alive") { alive++; continue; }
    const released = !!i.released_key, flying = !!i.release?.in_flight;
    if (!released && !flying) {
      const r = await call(STUDIO, c, "release", {}, { gas: 300, deposit: "0" }).catch((e) => ({ failure: String(e).slice(0, 200) }));
      log({ store: c, state: "dead", action: "release", tx: r.hash ?? null, failure: r.failure ? JSON.stringify(r.failure).slice(0, 200) : null });
    } else log({ store: c, state: released ? "dead, released" : "dead, release running" });
  }
  log({ alive, warning: alive <= 1 ? `only ${alive} alive standby store left: launch another (scripts/ops/launch-pool.sh)` : null });
  await maintainCopies().catch((e) => log({ copies: "error", error: String(e.message ?? e).slice(0, 200) }));
}

do { await tick().catch((e) => log({ error: String(e).slice(0, 200) })); } while (!process.argv.includes("--once") && await new Promise((r) => setTimeout(r, EVERY_MS)) === undefined);
