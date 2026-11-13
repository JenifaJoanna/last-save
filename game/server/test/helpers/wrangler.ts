// Starts `wrangler dev` (local workerd) for integration tests.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pkgDir = new URL("../..", import.meta.url).pathname;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => { const p = (s.address() as { port: number }).port; s.close(() => resolve(p)); });
  });
}

function killGroup(c: ChildProcess) { try { process.kill(-c.pid!, "SIGTERM"); } catch { /* already gone */ } }

export interface Dev { url: string; wsUrl: string; stop(): Promise<void>; log(): string; persist: string }

export async function startDev(vars: Record<string, string>, opts: { persist?: string } = {}): Promise<Dev> {
  const port = await freePort();
  const inspector = await freePort();
  const persist = opts.persist ?? mkdtempSync(join(tmpdir(), "lastsave-arena-"));
  const args = [join(pkgDir, "node_modules/wrangler/bin/wrangler.js"), "dev", "--port", String(port), "--inspector-port", String(inspector), "--persist-to", persist, "--ip", "127.0.0.1"];
  for (const [k, v] of Object.entries(vars)) args.push("--var", `${k}:${v}`);
  let out = "";
  const child: ChildProcess = spawn(process.execPath, args, { cwd: pkgDir, detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1", NO_COLOR: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d) => (out += d));
  child.stderr?.on("data", (d) => (out += d));
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited early:\n${out.slice(-2000)}`);
    try { const r = await fetch(`${url}/health`); if (r.status < 600) break; } catch { /* not up yet */ }
    if (Date.now() > deadline) { killGroup(child); throw new Error(`wrangler dev did not start:\n${out.slice(-2000)}`); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return {
    url, wsUrl: `ws://127.0.0.1:${port}/ws`, persist, log: () => out,
    async stop() {
      killGroup(child);
      await new Promise((r) => { child.once("exit", r); setTimeout(r, 4000); });
      if (!opts.persist) rmSync(persist, { recursive: true, force: true });
    },
  };
}
