// Local infrastructure for demo:fresh: a static file server for the artifact and wasm mirrors, cloudflared quick tunnels,
// and the official game server run as a local `wrangler dev`.
import { spawn } from "node:child_process";
import { chmodSync, cpSync, createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import { createServer as netServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getJson, log, sleep } from "./util.mjs";

export const root = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

export const freePort = () => new Promise((res) => {
  const s = netServer();
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
});

/** Serves one directory read-only on 127.0.0.1 (hash-named artifact and wasm files). */
export async function serveDir(dir) {
  const server = httpServer((req, res) => {
    const name = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
    const file = join(dir, name);
    if (!name || name.includes("..") || !file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": statSync(file).size });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { port: server.address().port, stop: () => server.close() };
}

/** A fresh quick-tunnel hostname takes a while to resolve and connect: wait until any HTTP answer other than 530 comes back. */
async function tunnelReady(url) {
  const end = Date.now() + 120_000;
  while (Date.now() < end) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(6000) }); if (r.status !== 530) return; } catch { /* not resolvable yet */ }
    await sleep(2000);
  }
  throw new Error(`${url} did not become reachable within 120 s`);
}

/** cloudflared quick tunnel to a local port. An empty --config keeps it from loading a named-tunnel config on this machine. */
export function quickTunnel(port, scratch) {
  mkdirSync(scratch, { recursive: true });
  const cfg = join(scratch, `cloudflared-quick-${port}.yml`);
  writeFileSync(cfg, "# intentionally empty: quick tunnel only\n");
  const proc = spawn("cloudflared", ["tunnel", "--config", cfg, "--no-autoupdate", "--url", `http://127.0.0.1:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
  const stop = () => { try { proc.kill("SIGTERM"); } catch { /* gone */ } };
  return new Promise((resolveUrl, reject) => {
    let buf = "";
    const timer = setTimeout(() => { stop(); reject(new Error("cloudflared did not print a trycloudflare.com URL within 60 s")); }, 60_000);
    let found = false;
    const onData = (d) => {
      buf += d;
      const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !found) { found = true; clearTimeout(timer); tunnelReady(m[0]).then(() => resolveUrl({ url: m[0], stop, proc }), (e) => { stop(); reject(e); }); }
    };
    proc.stdout.on("data", onData); proc.stderr.on("data", onData);
    proc.on("error", (e) => { clearTimeout(timer); reject(new Error(`cannot start cloudflared: ${e.message}`)); });
    proc.on("exit", () => { clearTimeout(timer); reject(new Error("cloudflared exited before printing a URL")); });
  });
}

/** Waits until `url`/health answers ok for the given host id. */
export async function waitHealthy(url, hostId, ms) {
  const end = Date.now() + ms;
  let last = "no answer";
  while (Date.now() < end) {
    try {
      const h = await getJson(`${url}/health`, 5000);
      if (h.body?.ok && h.body.host_id === hostId) return h.body;
      last = `HTTP ${h.status} ${h.text.slice(0, 80)}`;
    } catch (e) { last = e.message; }
    await sleep(1500);
  }
  throw new Error(`${url} did not become healthy: ${last}`);
}

/**
 * The official server as a local wrangler dev on `port`. `vars` are plain Worker vars; `signer` (the studio function-call key)
 * goes into an owner-only .dev.vars. Assets are a copy of the built game client.
 */
export async function startOfficial({ scratch, port, vars, signer, clientDist }) {
  const dir = join(scratch, "official");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const assets = join(dir, ".assets");
  if (existsSync(join(clientDist, "index.html"))) cpSync(clientDist, assets, { recursive: true });
  else cpSync(join(root, "game", "server", "placeholder"), assets, { recursive: true });
  writeFileSync(join(dir, "wrangler.toml"), [
    'name = "lastsave-arena-demo"', `main = ${JSON.stringify(join(root, "game", "server", "src", "index.ts"))}`, 'compatibility_date = "2025-09-01"', "workers_dev = false",
    "[assets]", `directory = ${JSON.stringify(assets)}`, 'binding = "ASSETS"',
    "[[durable_objects.bindings]]", 'name = "ARENA"', 'class_name = "Arena"',
    "[[migrations]]", 'tag = "v1"', 'new_sqlite_classes = ["Arena"]', "",
  ].join("\n"));
  if (signer) { const f = join(dir, ".dev.vars"); writeFileSync(f, `SNAPSHOT_SIGNER=${signer}\n`, { mode: 0o600 }); chmodSync(f, 0o600); }
  const wrangler = join(root, "game", "server", "node_modules", "wrangler", "bin", "wrangler.js");
  const args = [wrangler, "dev", "--port", String(port), "--ip", "127.0.0.1", ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])];
  let tail = "";
  const proc = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  for (const s of [proc.stdout, proc.stderr]) s.on("data", (d) => { tail = (tail + d).slice(-600); });
  // wrangler spawns its own children (cli, workerd): kill the whole process group so the port really goes quiet
  const stop = () => { try { process.kill(-proc.pid, "SIGTERM"); } catch { /* gone */ } };
  try { await waitHealthy(`http://127.0.0.1:${port}`, vars.HOST_ID, 120_000); } catch (e) { stop(); throw new Error(`${e.message}; wrangler said: ${tail.replace(/\s+/g, " ")}`); }
  log(`  local official server healthy on port ${port}`);
  return { proc, stop };
}

export const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
