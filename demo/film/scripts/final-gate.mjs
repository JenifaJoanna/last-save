#!/usr/bin/env node
// Final-render gate: refuses (exit 1) while the film still contains anything that must not ship.
//  1. every footage slot used by a scene has a real take at public/footage/raw/<slot>.mp4 (a missing one would render
//     a preview capture or a drawn stand-in with a "placeholder" tag);
//  2. no scene source or facts file still holds the string TBD (it would render on screen);
//  2b. facts files carry no dev-run marker at all (TBD, dev-run, placeholder), even in comments. (v2dev is not a marker:
//      S10 and S12–S16 show its real afterlife, labelled; each facts set is checked against its own instance in 3b);
//  3. no "100%" claim about the post-shutdown sale (the contract sends 90 % to the pool, 10 % to the ops budget);
//  3b. src/film/run-facts.json (judge: ember-rift, judge-v2.json) and run-facts-after.json (v2dev, its run proof), both from scripts/facts.mjs,
//      list nothing missing, have no empty value, and every source file still matches its recorded sha256;
//  4. the narration files exist for every line the timeline places.
// Usage: node scripts/final-gate.mjs   (run before rendering a deliverable; prints every failure, not just the first)
import { createHash } from "node:crypto";
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
    // facts files hold every judge-run number: any dev-run marker, even in a comment, means a value not yet re-sourced
    else if (/facts\.ts$/.test(p) && /\bTBD\b|dev[- ]run|placeholder/i.test(line)) fails.push(`unverified fact: ${relative(root, p)}:${i + 1}`);
    if (/100\s?%[^)]*(pool|keep-alive)/i.test(line)) fails.push(`100% pool claim: ${relative(root, p)}:${i + 1}`);
  });
}

// 3b. the run facts the film prints (two sets) must come from proof/ files, unchanged since they were read:
//     run-facts.json = the judge instance (S01-S09, S11), run-facts-after.json = v2dev's real afterlife (S10, S12-S16)
const FACT_SETS = [
  { file: "run-facts.json", instance: "ember-rift.lastsave-factory.testnet", run: /judge-v2\.json$/, label: "judge facts" },
  { file: "run-facts-after.json", instance: "v2dev.lastsave-factory.testnet", run: /run-v2dev-[^/]*\.json$/, label: "after facts" },
];
for (const set of FACT_SETS) {
  const factsPath = join(root, "src", "film", set.file);
  if (!existsSync(factsPath)) { fails.push(`${set.label} missing: run node scripts/facts.mjs${set.file.includes("after") ? " --set after" : ""} (src/film/${set.file})`); continue; }
  const rf = JSON.parse(readFileSync(factsPath, "utf8"));
  if (rf.instance !== set.instance) fails.push(`${set.label} are for ${rf.instance}, not ${set.instance}`);
  if (!set.run.test(String(rf.source?.run?.path ?? ""))) fails.push(`${set.label} built from ${rf.source?.run?.path}, not ${set.run}`);
  for (const m of rf.missing ?? []) fails.push(`${set.label} missing: ${m}`);
  for (const [k, v] of Object.entries(rf.values ?? {})) {
    const empty = v === null || v === undefined || v === "" || (typeof v === "object" && !Object.keys(v).length);
    if (empty && !(rf.unused ?? []).includes(k) && !(rf.missing ?? []).some((m) => m.startsWith(`${k} `))) fails.push(`${set.label} empty: ${k}`);
  }
  for (const src of Object.values(rf.source ?? {}).flat()) {
    const file = join(root, "..", "..", src.path);
    if (src.path.startsWith("external/")) fails.push(`${set.label} source is outside the repo (proof/ only): ${src.path}`);
    else if (!existsSync(file)) fails.push(`${set.label} source gone: ${src.path}`);
    else if (createHash("sha256").update(readFileSync(file)).digest("hex") !== src.sha256) fails.push(`${set.label} source changed since facts.mjs ran: ${src.path}`);
  }
}

const timeline = readFileSync(join(root, "src", "film", "timeline.ts"), "utf8");
for (const m of timeline.matchAll(/vo: "(V\d+)"/g)) if (!existsSync(join(root, "public", "vo", "v4", `${m[1]}.mp3`))) fails.push(`narration missing: public/vo/v4/${m[1]}.mp3`);

process.stdout.write(`final-gate: ${slots.size} footage slots checked, ${sources.length} scene files scanned\n`);
if (fails.length) { process.stdout.write(`final-gate: FAIL (${fails.length})\n${fails.map((f) => `  - ${f}`).join("\n")}\n`); process.exit(1); }
process.stdout.write("final-gate: ok\n");
