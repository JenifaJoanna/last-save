#!/usr/bin/env node
// Deploys the relayer: a Worker `<base>-relayer` (no public URL) and a Pages project `<base>` forwarding to it
// through a service binding, so the public URL is https://<base>.pages.dev.
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... RELAYER_ACCOUNT=<id> RELAYER_KEY=ed25519:... \
//   ALLOWED_RECEIVERS=<id,id> node scripts/deploy.mjs <base> [--dry-run]
// Optional: RPC_URLS, RATE_LIMIT_PER_MIN, GLOBAL_LIMIT_PER_MIN, MAX_GAS_TGAS. Values are never printed.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const base = args.find((a) => !a.startsWith("--"));
const out = (s) => process.stdout.write(`${s}\n`);
const die = (s) => { process.stderr.write(`${s}\n`); process.exit(1); };

if (!base || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(base)) die("usage: deploy.mjs <project-base-name> [--dry-run]");
const need = ["RELAYER_ACCOUNT", "RELAYER_KEY", "ALLOWED_RECEIVERS", ...(dry ? [] : ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"])];
for (const k of need) if (!process.env[k]) die(`${k} is not set in the environment`);
// A malformed list (spaces, one joined entry) would silently stop gas-free relaying for every instance: refuse it.
const receivers = process.env.ALLOWED_RECEIVERS.split(",").map((x) => x.trim());
const badReceiver = receivers.find((r) => !/^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(testnet|near)$/.test(r));
if (badReceiver !== undefined) die(`ALLOWED_RECEIVERS has an invalid account id: "${badReceiver.slice(0, 80)}" (comma-separated, no spaces)`);
out(`allowed receivers: ${receivers.length}`);

const worker = `${base}-relayer`;
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const run = (a, opts = {}) => {
  out(`> wrangler ${a.filter((x) => !String(x).includes(":") || !/^[A-Z_]+:/.test(String(x))).join(" ")}`);
  if (dry) return { status: 0 };
  const r = spawnSync(process.execPath, [wrangler, ...a], { cwd: opts.cwd ?? root, input: opts.input, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], env: process.env });
  if (opts.ignoreFailure) return r;
  if (r.status !== 0) die(`wrangler ${a[0]} failed (exit ${r.status})`);
  return r;
};

const vars = ["RELAYER_ACCOUNT", "ALLOWED_RECEIVERS", "ATTACKER_ACCOUNT", "RPC_URLS", "RATE_LIMIT_PER_MIN", "GLOBAL_LIMIT_PER_MIN", "MAX_GAS_TGAS"]
  .filter((k) => process.env[k]).flatMap((k) => ["--var", `${k}:${process.env[k]}`]);
run(["deploy", "--name", worker, ...vars]);
run(["secret", "put", "RELAYER_KEY", "--name", worker], { input: process.env.RELAYER_KEY });
if (process.env.ATTACKER_KEY) run(["secret", "put", "ATTACKER_KEY", "--name", worker], { input: process.env.ATTACKER_KEY });

const build = join(root, ".pages-build");
rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
cpSync(join(root, "pages", "_worker.js"), join(build, "_worker.js"));
writeFileSync(join(build, "wrangler.toml"), readFileSync(join(root, "pages", "wrangler.toml"), "utf8")
  .replace('name = "lastsave-relay"', `name = "${base}"`).replace('service = "lastsave-relayer"', `service = "${worker}"`));

run(["pages", "project", "create", base, "--production-branch", "main"], { ignoreFailure: true });
run(["pages", "deploy", ".", "--project-name", base, "--branch", "main", "--commit-dirty=true"], { cwd: build });
out(`public URL: https://${base}.pages.dev  (check: curl https://${base}.pages.dev/health)`);
