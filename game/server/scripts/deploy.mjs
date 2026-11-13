#!/usr/bin/env node
// Deploys one Ember Rift server: a Worker `<base>-arena` (Durable Object, no public URL) and a Pages project `<base>`
// (the public face, forwarding to the Worker through a service binding).
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/deploy.mjs <base> [--dry-run]
// Optional environment: HOST_ID, BUILD_HASH, LICENCE_CONTRACT, RPC_URLS, STUDIO_ACCOUNT (plain vars);
// SNAPSHOT_SIGNER, RESTORE_SNAPSHOT (uploaded as Worker secrets). Nothing is read from files and no value is printed.
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

if (!base || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(base)) die("usage: deploy.mjs <project-base-name> [--dry-run]  (lowercase letters, digits, dashes)");
if (!dry) for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) if (!process.env[k]) die(`${k} is not set in the environment`);

const worker = `${base}-arena`;
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const run = (a, opts = {}) => {
  out(`> wrangler ${a.filter((x) => !String(x).startsWith("--var=")).join(" ")}`);
  if (dry) return { status: 0, stdout: "" };
  const r = spawnSync(process.execPath, [wrangler, ...a], { cwd: opts.cwd ?? root, input: opts.input, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], env: process.env });
  if (opts.ignoreFailure) return r;
  if (r.status !== 0) die(`wrangler ${a[0]} failed (exit ${r.status})`);
  return r;
};

run(["--version"]);
spawnSync(process.execPath, [join(root, "scripts", "prepare-assets.mjs")], { cwd: root, stdio: "inherit" });

const vars = ["HOST_ID", "BUILD_HASH", "LICENCE_CONTRACT", "RPC_URLS", "STUDIO_ACCOUNT"].filter((k) => process.env[k]).flatMap((k) => ["--var", `${k}:${process.env[k]}`]);
run(["deploy", "--name", worker, ...vars]);
for (const secret of ["SNAPSHOT_SIGNER", "RESTORE_SNAPSHOT"]) {
  if (process.env[secret]) run(["secret", "put", secret, "--name", worker], { input: process.env[secret] });
}

const build = join(root, ".pages-build");
rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
cpSync(join(root, ".assets"), build, { recursive: true });
cpSync(join(root, "pages", "_worker.js"), join(build, "_worker.js"));
writeFileSync(join(build, "wrangler.toml"), readFileSync(join(root, "pages", "wrangler.toml"), "utf8")
  .replace('name = "lastsave-public"', `name = "${base}"`).replace('service = "lastsave-arena"', `service = "${worker}"`));

run(["pages", "project", "create", base, "--production-branch", "main"], { ignoreFailure: true });
run(["pages", "deploy", ".", "--project-name", base, "--branch", "main", "--commit-dirty=true"], { cwd: build });
out(`public URL: https://${base}.pages.dev`);
