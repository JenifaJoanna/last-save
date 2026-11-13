// Runs the fan-host CLI (host/bin/host.mjs --local: wrangler dev + cloudflared quick tunnel + register_host) as a child process.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Resolves once the host is serving and registered. Rejects on a refusal, an exit, or the timeout. */
export function startHost(ctx, { timeoutMs = 600_000 } = {}) {
  const args = [join(root, "host", "bin", "host.mjs"), "--local", "--account", ctx.fanhost, "--contract", ctx.contract];
  const proc = spawn(process.execPath, args, { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  const host = { proc, endpoint: null, registerUrl: null, registerHash: null, lines: [], stop: () => { try { proc.kill("SIGTERM"); } catch { /* gone */ } } };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { host.stop(); reject(new Error(`host did not become ready in ${timeoutMs / 1000} s: ${host.lines.slice(-4).join(" | ")}`)); }, timeoutMs);
    let buf = "";
    const onData = (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trimEnd();
        buf = buf.slice(i + 1);
        if (!line) continue;
        host.lines.push(line);
        log(`  host| ${line}`);
        const serving = line.match(/^Serving at (https:\/\/\S+)/);
        if (serving) host.endpoint = serving[1];
        const reg = line.match(/^register_host: (https:\/\/\S+)/);
        if (reg) { host.registerUrl = reg[1]; host.registerHash = reg[1].split("/").pop(); }
        if (/^REFUSED|FAILED/.test(line) || /host failed:/.test(line)) { clearTimeout(timer); host.stop(); reject(new Error(line)); }
        if (/^Hosting\.|^Claiming completed/.test(line) && host.endpoint) { clearTimeout(timer); resolve(host); }
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (code) => { clearTimeout(timer); host.exited = true; reject(new Error(`host exited with ${code} before it was ready: ${host.lines.slice(-3).join(" | ")}`)); });
  });
}
