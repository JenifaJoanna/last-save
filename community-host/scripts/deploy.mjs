#!/usr/bin/env node
// npm run deploy   (Workers Builds deploy command)  |  node scripts/deploy.mjs --dry-run  (check only, nothing is published)
// Runs `wrangler deploy` with the variables the build step computed. Refuses to publish anywhere but Workers Builds
// (the clicker's own account) unless COMMUNITY_HOST_ALLOW_LOCAL=1, so this template is never deployed by mistake under another account.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry-run");
const die = (m) => { process.stderr.write(`${m}\n`); process.exit(3); };
const varsFile = join(root, ".build", "vars.json");
if (!existsSync(join(root, "bundle", "worker", "index.js")) || !existsSync(varsFile)) die("REFUSED (not_built): run `npm run build` first; there is no verified bundle to deploy.");
if (!dry && process.env.WORKERS_CI !== "1" && process.env.COMMUNITY_HOST_ALLOW_LOCAL !== "1") {
  die("REFUSED (not_workers_builds): this template deploys into the account of whoever runs it. Set COMMUNITY_HOST_ALLOW_LOCAL=1 only for your own account.");
}
const vars = JSON.parse(readFileSync(varsFile, "utf8"));
const args = ["wrangler", "deploy", ...(dry ? ["--dry-run", "--outdir", join(root, ".build", "dry-run")] : []),
  ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])];
const r = spawnSync("npx", ["--no-install", ...args], { cwd: root, stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
if (r.status === 0 && !dry) process.stdout.write(`\nDeployed. Register this host on chain from your NEAR account (${vars.HOST_ID}) with the URL above, see README.\n`);
process.exit(r.status ?? 1);
