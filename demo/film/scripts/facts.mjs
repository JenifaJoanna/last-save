#!/usr/bin/env node
// Writes src/film/run-facts.json from the run's proof files, so swapping in the judge run is one command.
//   node scripts/facts.mjs                       judge run (proof file names: scripts/facts-map.mjs CONFIG)
//   node scripts/facts.mjs --set after           v2dev's real afterlife (S10, S12-S16) -> src/film/run-facts-after.json
//   node scripts/facts.mjs --dev --verify <json> dev run (v2dev) for testing; the verify JSON is `pnpm -s verify --instance v2dev --json`
// Flags: --run <path> --launch <path> (repeatable) --verify <path> --live-verify --extra <path> --studio2 <path> --out <path>
// A value that cannot be read from a source is an error naming the key and source; it is written as null and the exit code is 1.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS, CONFIG, MAP, required } from "./facts-map.mjs";

const filmRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(filmRoot, "..", "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opts = (n) => argv.flatMap((a, i) => (a === `--${n}` ? [argv[i + 1]] : []));
const SET = opts("set")[0] ?? "judge";
if (!["judge", "after"].includes(SET)) { process.stderr.write("facts: --set is judge or after\n"); process.exit(2); }
const cfg = flag("dev") || SET === "after" ? CONFIG.dev : CONFIG.judge;

const abs = (p) => (p.startsWith("/") ? p : join(repo, p));
// a source outside the repo is recorded as external/<name>: fine for a dev test, refused by final-gate
const rel = (p) => (abs(p).startsWith(repo + "/") ? abs(p).slice(repo.length + 1) : `external/${abs(p).split("/").pop()}`);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const load = (p) => { const buf = readFileSync(abs(p)); return { path: rel(p), sha256: sha(buf), json: JSON.parse(buf) }; };
const die = (m) => { process.stderr.write(`facts: ${m}\n`); process.exit(2); };

let runFile;
try { runFile = load(opts("run")[0] ?? cfg.run); } catch (e) { die(`cannot read the run proof: ${e.message}`); }
const launchPaths = opts("launch").length ? opts("launch") : runFile.json.files?.launch ? [runFile.json.files.launch] : cfg.launch;
let verifyPath = opts("verify")[0] ?? runFile.json.files?.verify ?? cfg.verify;
if (!verifyPath && flag("live-verify")) {
  const out = execFileSync("pnpm", ["-s", "verify", "--json", "--instance", cfg.instance.split(".")[0]], { cwd: repo, encoding: "utf8", maxBuffer: 1 << 26 });
  verifyPath = join(filmRoot, "scripts", ".live-verify.json"); writeFileSync(verifyPath, out);
}
if (!verifyPath) die("no verify JSON: pass --verify <path> or --live-verify");
let files;
try {
  files = { run: runFile, launch: launchPaths.map(load), verify: load(verifyPath), studio2: load(opts("studio2")[0] ?? CONFIG.studio2) };
  const extra = opts("extra")[0] ?? (SET === "after" ? cfg.extra : null);
  if (extra) files.extra = load(extra);
  if (SET === "after" && !flag("no-verify-all") && existsSync(abs(cfg.verifyAll))) files.verifyAll = load(cfg.verifyAll);
} catch (e) { die(`cannot read a source: ${e.message}`); }

/** With proof/verify-all.json, S16 shows every instance: counts summed, a label's mark is its worst status. */
const RANK = { pass: 0, na: 1, warn: 2, fail: 3 };
function mergeAll(reports, base) {
  const byLabel = new Map();
  for (const r of reports) for (const c of r.results) { const w = byLabel.get(c.label); if (!w || RANK[c.status] > RANK[w.status]) byLabel.set(c.label, c); }
  const counts = { pass: 0, fail: 0, na: 0, warn: 0 };
  for (const r of reports) for (const k of Object.keys(counts)) counts[k] += r.counts[k] ?? 0;
  const ids = reports.map((r) => r.instance.id);
  return { ...base, instance: { ...base.instance, id: ids.join(" + ") }, results: [...byLabel.values()], counts, elapsed_ms: reports.reduce((n, r) => n + r.elapsed_ms, 0) };
}
if (files.verifyAll) { const all = files.verifyAll.json; if (!Array.isArray(all) || !all.length) die("verify-all.json must be the array `pnpm verify --all --json` prints"); files.verifyMerged = mergeAll(all, files.verify.json); }

const S = { run: files.run.json, launch: files.launch.map((l) => l.json), verify: files.verifyMerged ?? files.verify.json, studio2: files.studio2.json, extra: files.extra?.json ?? {}, buyer: cfg.buyer };
const values = {}, missing = [], unused = [], rows = [];
for (const row of MAP) {
  try {
    const v = row.get(S);
    if (v === undefined || v === null || v === "" || (typeof v === "object" && !Object.keys(v).length)) throw new Error("empty");
    values[row.key] = v;
    rows.push([row.key, typeof v === "object" ? JSON.stringify(v).slice(0, 48) + "…" : String(v), `${row.src}: ${row.at}`]);
  } catch (e) {
    values[row.key] = null;
    if (!required(row.key, SET)) { unused.push(row.key); rows.push([row.key, "(not used by this set)", `${row.src}: ${row.at}`]); continue; }
    missing.push(`${row.key} (${row.src}: ${row.at}): ${e.message}`);
    rows.push([row.key, "MISSING", `${row.src}: ${row.at}`]);
  }
}
for (const check of CHECKS) { try { const m = check(values, SET); if (m) missing.push(`inconsistent: ${m}`); } catch { /* a missing input is already reported above */ } }

const stripSrc = ({ path, sha256 }) => ({ path, sha256 });
const out = {
  instance: S.run.contract,
  source: { run: stripSrc(files.run), launch: stripSrc(files.launch[0]), ...(files.launch.length > 1 ? { launch_more: files.launch.slice(1).map(stripSrc) } : {}),
    verify: stripSrc(files.verify), studio2: stripSrc(files.studio2), ...(files.extra ? { extra: stripSrc(files.extra) } : {}), ...(files.verifyAll ? { verify_all: stripSrc(files.verifyAll) } : {}) },
  set: SET,
  generated_at: new Date().toISOString(),
  missing,
  unused,
  values,
};
writeFileSync(opts("out")[0] ?? join(filmRoot, "src", "film", SET === "after" ? "run-facts-after.json" : "run-facts.json"), JSON.stringify(out, null, 2) + "\n");

const w = [Math.max(...rows.map((r) => r[0].length)), Math.min(60, Math.max(...rows.map((r) => r[1].length)))];
for (const [k, v, s] of rows) process.stdout.write(`${k.padEnd(w[0])}  ${v.slice(0, 60).padEnd(w[1])}  ${s}\n`);
process.stdout.write(`\ninstance ${out.instance} · run ${out.source.run.path}\n`);
if (missing.length) { process.stdout.write(`facts: FAIL, ${missing.length} problem(s)\n${missing.map((m) => `  - ${m}`).join("\n")}\n`); process.exit(1); }
process.stdout.write("facts: ok\n");
