#!/usr/bin/env node
// Writes MATCH_HITS in src/scenes/v1/g3/match.ts from the client's own capture log, public/footage/raw/match.events.json
// ([{ t: seconds from the saved mp4's first frame, kind: "hit"|"kill"|"shard"|"dash" }, optional { kind: "trim", s }]).
// Keeps hits and kills that S08 actually shows (from MATCH_FROM, for the 6.9 s the take plays after the cut-in) and
// drops any hit within 10 frames of the previous one, so punch-ins never stack. Prints the result; --dry leaves the file.
// Usage: node scripts/hits.mjs [--dry]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const log = join(root, "public", "footage", "raw", "match.events.json");
const src = join(root, "src", "scenes", "v1", "g3", "match.ts");
if (!existsSync(log)) { process.stderr.write("hits: no public/footage/raw/match.events.json yet\n"); process.exit(1); }

const events = JSON.parse(readFileSync(log, "utf8"));
if (!Array.isArray(events)) { process.stderr.write("hits: match.events.json must be an array\n"); process.exit(1); }
const trim = events.filter((e) => e.kind === "trim").reduce((n, e) => n + Number(e.s || 0), 0);
const code = readFileSync(src, "utf8");
const from = Number(code.match(/export const MATCH_FROM = ([\d.]+)/)?.[1]);
const cut = Number(code.match(/export const MATCH_CUT = (\d+)/)?.[1]);
if (!Number.isFinite(from) || !Number.isFinite(cut)) { process.stderr.write("hits: MATCH_FROM / MATCH_CUT not found in g3/match.ts\n"); process.exit(1); }
const until = from + (240 - cut) / 30; // S08 is 240 frames; the take plays from the cut-in to the end

const hits = [];
for (const e of events.filter((x) => (x.kind === "hit" || x.kind === "kill") && Number.isFinite(Number(x.t)))
  .map((x) => ({ ...x, t: Number(x.t) - trim })).sort((a, b) => a.t - b.t)) {
  if (e.t < from || e.t > until - 0.3) continue;
  if (hits.length && e.t - hits[hits.length - 1] < 10 / 30) continue;
  hits.push(Math.round(e.t * 100) / 100);
}
process.stdout.write(`hits: ${hits.length} hits in take ${from.toFixed(2)}–${until.toFixed(2)} s (trim ${trim} s): [${hits.join(", ")}]\n`);
if (!hits.length) process.stdout.write("hits: none in S08's window: move MATCH_FROM to the busiest stretch of the take\n");
if (process.argv.includes("--dry")) process.exit(0);
const next = code.replace(/export const MATCH_HITS: number\[\] = \[[^\]]*\];/, `export const MATCH_HITS: number[] = [${hits.join(", ")}];`);
if (next === code && !code.includes(`[${hits.join(", ")}]`)) { process.stderr.write("hits: MATCH_HITS line not found\n"); process.exit(1); }
writeFileSync(src, next);
process.stdout.write("hits: g3/match.ts updated (S08 punch-ins and cues.ts hit SFX follow it)\n");
