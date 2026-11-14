#!/usr/bin/env node
// Renders several stills from ONE bundle (a `npx remotion still` call rebundles every time, at high CPU).
// Usage: node scripts/stills.mjs <out-dir> <Comp:frame> [Comp:frame ...] [--scale 0.203125]
//   e.g. node scripts/stills.mjs /tmp/x S10:0 S10:60 S13:200 LastSaveX:30
// Writes <out-dir>/<Comp>-<frame>.png with the installed Chrome, headless.
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(createRequire(join(root, "package.json")).resolve("@remotion/cli/package.json"));
const { bundle } = req("@remotion/bundler");
const { getCompositions, renderStill } = req("@remotion/renderer");
const args = process.argv.slice(2);
const scale = args.includes("--scale") ? Number(args[args.indexOf("--scale") + 1]) : 1;
const [out, ...jobs] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--scale");
if (!out || !jobs.length) { process.stderr.write("usage: node scripts/stills.mjs <out-dir> <Comp:frame> ... [--scale s]\n"); process.exit(2); }
const browserExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(out, { recursive: true });
// every bundle copies public/ (footage included), so it is deleted when done: 63 stale bundles had filled 12 GB on 14 Nov
const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), publicDir: join(root, "public") });
try {
const comps = await getCompositions(serveUrl, { browserExecutable });
for (const j of jobs) {
  const [id, fr] = j.split(":"); const c = comps.find((x) => x.id === id);
  if (!c) { process.stderr.write(`stills: no composition ${id}\n`); continue; }
  const frame = Math.min(c.durationInFrames - 1, Number(fr));
  await renderStill({ serveUrl, composition: c, frame, scale, output: join(out, `${id}-${frame}.png`), browserExecutable, overwrite: true });
  process.stdout.write(`${id}-${frame}.png\n`);
}
} finally { rmSync(serveUrl, { recursive: true, force: true }); }
