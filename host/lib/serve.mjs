// Starts the unpacked server: locally behind a cloudflared quick tunnel, or deployed to Cloudflare (Worker + Pages).
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Refusal } from "./refusal.mjs";

const hostRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wranglerJs = () => {
  const p = join(hostRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(p)) throw new Refusal("no_wrangler", "wrangler is not installed. Run `pnpm install` from the repository root.");
  return p;
};

export function hostVars({ account, buildHash, contract, rpcUrls }) {
  return { HOST_ID: account, BUILD_HASH: buildHash, LICENCE_CONTRACT: contract, ...(rpcUrls ? { RPC_URLS: rpcUrls } : {}) };
}

/** .dev.vars holds the restore snapshot (too large for a --var argument); owner-only, inside the untracked .host/ folder. */
function writeDevVars(dir, restore) {
  const f = join(dir, ".dev.vars");
  if (!restore) { rmSync(f, { force: true }); return; }
  writeFileSync(f, `RESTORE_SNAPSHOT='${JSON.stringify(restore)}'\n`, { mode: 0o600 });
  chmodSync(f, 0o600);
}

const freePort = () => new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});

async function waitHealth(url, expect, ms, what) {
  const end = Date.now() + ms;
  let last = "no answer";
  while (Date.now() < end) {
    try {
      const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      const text = await r.text();
      const h = (() => { try { return JSON.parse(text); } catch { return null; } })();
      if (r.status === 503 && h?.code) throw new Refusal(h.code, `The server refused to start: ${h.error}`);
      if (h?.ok && h.host_id === expect.host && h.build_hash === expect.build) return h;
      last = `unexpected /health answer (HTTP ${r.status}): ${text.slice(0, 160).replace(/\s+/g, " ")}`;
    } catch (e) { if (e instanceof Refusal) throw e; last = e.message; }
    await sleep(700);
  }
  throw new Refusal("not_healthy", `${what} did not become healthy: ${last}`);
}

/** wrangler dev + cloudflared. Returns { endpoint, stop }. */
export async function serveLocal({ dir, vars, restore, port, log }) {
  writeDevVars(dir, restore);
  const p = port ?? (await freePort());
  const args = [wranglerJs(), "dev", "--port", String(p), "--ip", "127.0.0.1", ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])];
  const children = [];
  const stop = () => { for (const c of children) { try { c.kill("SIGTERM"); } catch { /* gone */ } } };
  let wlog = "";
  const w = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(w);
  w.stdout.on("data", (d) => (wlog += d)); w.stderr.on("data", (d) => (wlog += d));
  const local = `http://127.0.0.1:${p}`;
  try {
    await waitHealth(local, { host: vars.HOST_ID, build: vars.BUILD_HASH }, 120_000, "the local server");
  } catch (e) { stop(); if (e instanceof Refusal) throw e; throw new Refusal("not_healthy", `${e.message}\n${wlog.slice(-800)}`); }
  log(`local server healthy on ${local}`);

  // An empty --config keeps a quick tunnel from inheriting the machine's own ~/.cloudflared/config.yml (named-tunnel ingress and credentials).
  const cfg = join(dir, "cloudflared-quick.yml");
  writeFileSync(cfg, "# intentionally empty: quick tunnel only\n");
  const t = spawn("cloudflared", ["tunnel", "--config", cfg, "--no-autoupdate", "--url", local], { stdio: ["ignore", "pipe", "pipe"] });
  children.push(t);
  const url = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Refusal("no_tunnel", "cloudflared did not print a trycloudflare.com URL within 60 s.")), 60_000);
    const onData = (d) => { buf += d; const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) { clearTimeout(timer); resolve(m[0]); } };
    t.stdout.on("data", onData); t.stderr.on("data", onData);
    t.on("error", (e) => { clearTimeout(timer); reject(new Refusal("no_tunnel", `cannot start cloudflared: ${e.message}`)); });
    t.on("exit", () => { clearTimeout(timer); reject(new Refusal("no_tunnel", "cloudflared exited before printing a URL.")); });
  }).catch((e) => { stop(); throw e; });
  log(`tunnel up: ${url}, waiting for it to answer`);
  try { await waitHealth(url, { host: vars.HOST_ID, build: vars.BUILD_HASH }, 90_000, "the tunnel"); } catch (e) { stop(); throw e; }
  return { endpoint: url, stop };
}

/** Worker `<name>-arena` + Pages project `<name>` (public face). Needs CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID. */
export async function serveDeploy({ dir, name, vars, restore, log }) {
  for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) if (!process.env[k]) throw new Refusal("no_cloudflare", `${k} is not set in the environment.`);
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(name)) throw new Refusal("bad_name", "The deploy name must be lowercase letters, digits and dashes.");
  const run = (cwd, a, input) => {
    log(`wrangler ${a[0]} ${a[1] && !a[1].startsWith("-") ? a[1] : ""}`.trim());
    const r = spawnSync(process.execPath, [wranglerJs(), ...a], { cwd, input, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], env: process.env });
    return r;
  };
  const worker = `${name}-arena`;
  const dep = run(dir, ["deploy", "--name", worker, ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])]);
  if (dep.status !== 0) throw new Refusal("deploy_failed", `wrangler deploy failed (exit ${dep.status}).`);
  if (restore) {
    const s = run(dir, ["secret", "put", "RESTORE_SNAPSHOT", "--name", worker], JSON.stringify(restore));
    if (s.status !== 0) throw new Refusal("deploy_failed", "could not upload the restore snapshot secret.");
  }
  const pages = join(dir, ".pages-build");
  rmSync(pages, { recursive: true, force: true });
  mkdirSync(pages, { recursive: true });
  cpSync(join(dir, "assets"), pages, { recursive: true });
  cpSync(join(dir, "pages", "_worker.js"), join(pages, "_worker.js"));
  writeFileSync(join(pages, "wrangler.toml"), readFileSync(join(dir, "pages", "wrangler.toml"), "utf8")
    .replace('name = "lastsave-public"', `name = "${name}"`).replace('service = "lastsave-arena"', `service = "${worker}"`));
  run(dir, ["pages", "project", "create", name, "--production-branch", "main"]);
  const pd = run(pages, ["pages", "deploy", ".", "--project-name", name, "--branch", "main", "--commit-dirty=true"]);
  if (pd.status !== 0) throw new Refusal("deploy_failed", `wrangler pages deploy failed (exit ${pd.status}).`);
  const endpoint = `https://${name}.pages.dev`;
  await waitHealth(endpoint, { host: vars.HOST_ID, build: vars.BUILD_HASH }, 120_000, "the deployed server");
  return { endpoint, stop: () => {} };
}
