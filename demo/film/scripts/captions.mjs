#!/usr/bin/env node
// Bundles scripts/captions.ts (it imports the film's TypeScript timelines) with the project's esbuild and runs it.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = join(root, "node_modules", ".pnpm");
const dir = readdirSync(pnpm).filter((n) => /^esbuild@\d/.test(n)).sort().pop();
if (!dir) { process.stderr.write("captions: esbuild not found under node_modules/.pnpm (run pnpm install)\n"); process.exit(2); }
// the bundle lives inside the project so its bare "remotion" import resolves from node_modules
const tmp = join(root, "node_modules", ".cache", "captions");
mkdirSync(tmp, { recursive: true });
try {
  const out = join(tmp, "captions.mjs");
  execFileSync(join(pnpm, dir, "node_modules", "esbuild", "bin", "esbuild"),
    [join(root, "scripts", "captions.ts"), "--bundle", "--platform=node", "--format=esm", "--log-level=warning", `--outfile=${out}`, "--external:remotion"]);
  execFileSync(process.execPath, [out], { cwd: root, stdio: "inherit" });
} finally { rmSync(tmp, { recursive: true, force: true }); }
