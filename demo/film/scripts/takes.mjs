#!/usr/bin/env node
// Take intake: for every footage slot the scenes use, report whether its real take is in public/footage/raw/ and check
// it against FOOTAGE.md's spec (≥ 1920×1080, ≥ 30 fps, ≥ 2 s), plus the sidecars the film reads (match.events.json,
// <slot>.cast for terminal takes). With --sheets <dir>, writes a 1-s-step contact sheet per take there for review.
// Exit 1 when a present take fails the spec (missing takes are listed, and final-gate refuses them separately).
// Usage: node scripts/takes.mjs [--sheets <dir>]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = join(root, "public", "footage", "raw");
const args = process.argv.slice(2);
const sheets = args.includes("--sheets") ? args[args.indexOf("--sheets") + 1] : null;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const slots = new Set();
for (const p of walk(join(root, "src")).filter((p) => /\.(tsx?)$/.test(p))) {
  for (const m of readFileSync(p, "utf8").matchAll(/slot(?:=|: )"([a-z0-9-]+)"/g)) slots.add(m[1]);
}

const probe = (file) => {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", file]).toString();
  const j = JSON.parse(out); const s = j.streams[0]; const [n, d] = s.r_frame_rate.split("/").map(Number);
  return { w: s.width, h: s.height, fps: n / (d || 1), dur: Number(j.format.duration) };
};

const bad = []; let present = 0;
const rows = [...slots].sort().map((slot) => {
  const file = join(raw, `${slot}.mp4`);
  if (!existsSync(file)) return `  ${slot.padEnd(12)} missing`;
  present++;
  const p = probe(file); const issues = [];
  if (p.w < 1920 || p.h < 1080) issues.push(`${p.w}×${p.h} < 1920×1080`);
  if (p.fps < 29.9) issues.push(`${p.fps.toFixed(2)} fps < 30`);
  if (p.dur < 2) issues.push(`${p.dur.toFixed(1)} s < 2 s`);
  if (slot.startsWith("t-") && !existsSync(join(raw, `${slot}.cast`))) issues.push("no .cast (key line falls back to drawn text)");
  if (slot === "match" && !existsSync(join(raw, "match.events.json"))) issues.push("no match.events.json (MATCH_HITS stay placeholders)");
  if (issues.some((i) => !i.startsWith("no "))) bad.push(`${slot}: ${issues.join("; ")}`);
  if (sheets) {
    mkdirSync(sheets, { recursive: true });
    const cols = 4; const n = Math.max(1, Math.ceil(p.dur)); const rowsN = Math.ceil(n / cols);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", `fps=1,scale=480:-1,tile=${cols}x${rowsN}`, "-frames:v", "1", "-update", "1", join(sheets, `${slot}.png`)]);
  }
  return `  ${slot.padEnd(12)} ${`${p.w}×${p.h}`.padEnd(10)} ${p.fps.toFixed(1).padStart(5)} fps ${p.dur.toFixed(1).padStart(6)} s  ${issues.join("; ") || "ok"}`;
});

process.stdout.write(`takes: ${present}/${slots.size} slots have a real take\n${rows.join("\n")}\n`);
if (bad.length) { process.stdout.write(`takes: FAIL (${bad.length})\n${bad.map((b) => `  - ${b}`).join("\n")}\n`); process.exit(1); }
process.stdout.write("takes: every present take meets the spec\n");
