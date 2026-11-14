#!/usr/bin/env node
// Final-render gate: refuses (exit 1) while the film still contains anything that must not ship.
//  1. every footage slot used by a scene has a real take at public/footage/raw/<slot>.mp4 (a missing one would render
//     a preview capture or a drawn stand-in with a "placeholder" tag);
//  2. no scene source or facts file still holds the string TBD (it would render on screen);
//  2b. facts files carry no dev-run marker at all (TBD, v2dev, dev-run, placeholder), even in comments, and no other
//      scene source names the dev instance (v2dev) outside a comment;
//  3. no "100%" claim about the post-shutdown sale (the contract sends 90 % to the pool, 10 % to the ops budget);
//  4. the narration files exist for every line the timeline places.
// Usage: node scripts/final-gate.mjs   (run before rendering a deliverable; prints every failure, not just the first)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sources = walk(join(root, "src", "scenes")).filter((p) => /\.(tsx?|json)$/.test(p));
const fails = [];

const slots = new Set();
for (const p of sources) for (const m of readFileSync(p, "utf8").matchAll(/slot(?:=|: )"([a-z0-9-]+)"/g)) slots.add(m[1]);
for (const s of [...slots].sort()) if (!existsSync(join(root, "public", "footage", "raw", `${s}.mp4`))) fails.push(`take missing: public/footage/raw/${s}.mp4`);

for (const p of sources) {
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (/\bTBD\b/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) fails.push(`TBD on screen: ${relative(root, p)}:${i + 1}`);
    else if (/v2dev/.test(line) && !/facts\.ts$/.test(p) && !/^\s*(\/\/|\*|\/\*)/.test(line)) fails.push(`dev instance on screen: ${relative(root, p)}:${i + 1}`);
    // facts files hold every judge-run number: any dev-run marker, even in a comment, means a value not yet re-sourced
    else if (/facts\.ts$/.test(p) && /\bTBD\b|v2dev|dev[- ]run|placeholder/i.test(line)) fails.push(`unverified fact: ${relative(root, p)}:${i + 1}`);
    if (/100\s?%[^)]*(pool|keep-alive)/i.test(line)) fails.push(`100% pool claim: ${relative(root, p)}:${i + 1}`);
  });
}

const timeline = readFileSync(join(root, "src", "film", "timeline.ts"), "utf8");
for (const m of timeline.matchAll(/vo: "(V\d+)"/g)) if (!existsSync(join(root, "public", "vo", "v4", `${m[1]}.mp3`))) fails.push(`narration missing: public/vo/v4/${m[1]}.mp3`);

process.stdout.write(`final-gate: ${slots.size} footage slots checked, ${sources.length} scene files scanned\n`);
if (fails.length) { process.stdout.write(`final-gate: FAIL (${fails.length})\n${fails.map((f) => `  - ${f}`).join("\n")}\n`); process.exit(1); }
process.stdout.write("final-gate: ok\n");
