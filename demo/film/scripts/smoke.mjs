#!/usr/bin/env node
// Render smoke test: bundles the film once and renders the first, middle and last frame of every scene composition
// (S01–S17, XO) plus frame 0 of the three cuts, locally and headless. Any runtime error (a missing word in a timings
// file, a bad take offset, a throw in a scene) fails it here, before anything is pushed or sent to m2worker.
// tsc cannot catch these: on 14 Nov a re-recorded V08 dropped words that S09 still anchored to, and the m2 render
// died at load. Usage: node scripts/smoke.mjs [--browser <chrome path>]
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(createRequire(join(root, "package.json")).resolve("@remotion/cli/package.json"));
const { bundle } = req("@remotion/bundler");
const { getCompositions, renderStill } = req("@remotion/renderer");
const args = process.argv.slice(2);
const browserExecutable = args.includes("--browser") ? args[args.indexOf("--browser") + 1]
  : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const out = mkdtempSync(join(tmpdir(), "film-smoke-"));
const fails = [];
let n = 0;
try {
  const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), publicDir: join(root, "public") });
  const comps = await getCompositions(serveUrl, { browserExecutable });
  const scenes = comps.filter((c) => /^(S\d\d|XO)$/.test(c.id));
  const cuts = comps.filter((c) => ["LastSave", "LastSaveX", "LastSaveVertical"].includes(c.id));
  const jobs = [
    ...scenes.flatMap((c) => [0, Math.floor(c.durationInFrames / 2), c.durationInFrames - 1].map((frame) => ({ c, frame }))),
    ...cuts.map((c) => ({ c, frame: 0 })),
  ];
  for (const { c, frame } of jobs) {
    try {
      await renderStill({ serveUrl, composition: c, frame, output: join(out, `${c.id}-${frame}.png`), browserExecutable, overwrite: true });
      n++;
    } catch (e) {
      fails.push(`${c.id} frame ${frame}: ${String(e?.message ?? e).split("\n")[0].slice(0, 200)}`);
    }
  }
  if (scenes.length < 18) fails.push(`only ${scenes.length} scene compositions found (expected S01–S17 and XO)`);
} catch (e) {
  fails.push(`bundle or composition load failed: ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ").slice(0, 400)}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
process.stdout.write(`smoke: ${n} stills rendered\n`);
if (fails.length) { process.stdout.write(`smoke: FAIL (${fails.length})\n${fails.map((f) => `  - ${f}`).join("\n")}\n`); process.exit(1); }
process.stdout.write("smoke: ok\n");
