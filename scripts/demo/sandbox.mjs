// Runs contracts/sandbox-tests/tests/demo.rs (a narrated lifecycle on a local near-workspaces sandbox) and prints each step.
// Pre-flight: disk-check, and it waits while another cargo / rustc / neard is running (RAM on this machine is tight; --force skips the wait).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SANDBOX = join(ROOT, "contracts/sandbox-tests");
const out = (s) => process.stdout.write(`${s}\n`);
const WASM = {
  "licence (published code)": ["contracts/licence/target/near/lastsave_licence.opt.wasm", "./scripts/build-wasm.sh licence   # then wasm-opt -Oz, as for publish-global"],
  "mock OutLayer": ["contracts/mock-outlayer/target/wasm32-unknown-unknown/release/mock_outlayer.wasm", "(cd contracts/mock-outlayer && cargo build --target wasm32-unknown-unknown --release)"],
  "mock MPC signer": ["contracts/mock-signer/target/wasm32-unknown-unknown/release/mock_signer.wasm", "(cd contracts/mock-signer && cargo build --target wasm32-unknown-unknown --release)"],
};
const cleanPath = () => (process.env.PATH ?? "").split(":").filter((p) => p && !p.includes("/Documents/agents/bin")).join(":");
const busy = () => {
  const ps = spawnSync("ps", ["-axo", "pid=,comm="], { encoding: "utf8" }).stdout.split("\n");
  return ps.filter((l) => /\/(cargo|rustc|neard|near-sandbox)\s*$/.test(l.trim()) && !l.trim().startsWith(`${process.pid} `)).length;
};

export async function runSandbox(args) {
  const missing = Object.entries(WASM).filter(([, [f]]) => !existsSync(join(ROOT, f)));
  if (missing.length) {
    out("demo:fresh (sandbox) needs these built first (not built automatically: they are heavy):");
    for (const [name, [f, cmd]] of missing) out(`  ${name}: ${f}\n    ${cmd}`);
    return 3;
  }
  const disk = join(homedir(), ".agents/bin/disk-check");
  if (existsSync(disk)) {
    const r = spawnSync(disk, [], { encoding: "utf8" });
    out(`disk-check: ${(r.stdout || r.stderr).trim().split("\n").pop()}`);
    if (r.status !== 0) return 4;
  }
  if (!args.includes("--force")) {
    for (let waited = 0; busy() > 0; waited += 10) {
      if (waited >= 600) { out("another cargo/rustc/neard has been running for 10 minutes; re-run later or pass --force"); return 75; }
      if (waited === 0) out("another cargo/rustc/neard is running; waiting for it to finish (RAM is tight; --force skips this)...");
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  out("LAST SAVE demo:fresh (local sandbox): real licence wasm, mock OutLayer, mock MPC signer. No funds, no keys, no testnet.\n");
  const started = Date.now();
  const steps = [];
  const child = spawn("cargo", ["test", "--test", "demo", "--", "--nocapture", "--test-threads=1"], { cwd: SANDBOX, env: { ...process.env, PATH: cleanPath() }, stdio: ["ignore", "pipe", "pipe"] });
  const show = (raw) => {
    const line = raw.includes("STEP ") ? raw.slice(raw.indexOf("STEP ")) : raw; // libtest prefixes the first line with "test <name> ... "
    if (/^STEP /.test(line)) steps.push(line);
    if (/^(STEP |\s{9}\S|DEMO OK|test result|test .*(ok|FAILED)$)/.test(line) || /panicked|assert|error(\[|:)/.test(line)) out(line);
  };
  for (const stream of [child.stdout, child.stderr]) {
    let buf = "";
    stream.on("data", (d) => { buf += d; const lines = buf.split("\n"); buf = lines.pop(); lines.forEach(show); });
  }
  const code = await new Promise((r) => child.on("close", r));
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  out(code === 0 ? `\nDEMO PASSED: ${steps.length} steps in ${secs} s (includes compile time on a cold target dir)` : `\nDEMO FAILED (exit ${code}) after ${steps.length} step(s); run: cd contracts/sandbox-tests && cargo test --test demo -- --nocapture`);
  mkdirSync(join(ROOT, "local"), { recursive: true });
  writeFileSync(join(ROOT, "local/demo-sandbox.json"), JSON.stringify({ at: new Date().toISOString(), passed: code === 0, steps, seconds: Number(secs) }, null, 2));
  return code === 0 ? 0 : 1;
}
