#!/usr/bin/env node
// Builds the plaintext server bundle: pnpm --filter server-bundle build
// Output: dist/server-bundle.tar.gz and dist/build.json { build_hash, size, files }.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "../lib/crypto.mjs";
import { packTarGz } from "../lib/tar.mjs";

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(here, "..", "game", "server");
const out = (s) => process.stdout.write(`${s}\n`);
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  if (r.status !== 0) { process.stderr.write(`${cmd} ${args[0]} failed\n${r.stdout}\n${r.stderr}\n`); process.exit(1); }
};
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

run(process.execPath, [join(server, "scripts", "prepare-assets.mjs")], server);
const work = mkdtempSync(join(tmpdir(), "lastsave-bundle-"));
try {
  run(process.execPath, [join(server, "node_modules", "wrangler", "bin", "wrangler.js"), "deploy", "--dry-run", "--outdir", work], server);
  const entries = [{ path: "worker/index.js", data: readFileSync(join(work, "index.js")) }];
  for (const f of walk(join(server, ".assets"))) entries.push({ path: `assets/${relative(join(server, ".assets"), f).split("\\").join("/")}`, data: readFileSync(f) });
  entries.push({ path: "wrangler.toml", data: readFileSync(join(here, "template", "wrangler.toml")) });
  entries.push({ path: "README.md", data: readFileSync(join(here, "template", "README.md")) });
  entries.push({ path: "pages/_worker.js", data: readFileSync(join(server, "pages", "_worker.js")) });
  entries.push({ path: "pages/wrangler.toml", data: readFileSync(join(server, "pages", "wrangler.toml")) });
  const files = entries.map((e) => e.path).sort();
  entries.push({ path: "bundle.json", data: Buffer.from(JSON.stringify({ game: "ember-rift", files }, null, 1)) });

  const tgz = packTarGz(entries);
  mkdirSync(join(here, "dist"), { recursive: true });
  writeFileSync(join(here, "dist", "server-bundle.tar.gz"), tgz);
  const info = { build_hash: sha256Hex(tgz), size: tgz.length, files: files.length };
  writeFileSync(join(here, "dist", "build.json"), JSON.stringify(info, null, 1));
  out(`bundle: ${files.length} files, ${statSync(join(here, "dist", "server-bundle.tar.gz")).size} bytes`);
  out(`build_hash: ${info.build_hash}`);
} finally { rmSync(work, { recursive: true, force: true }); }
