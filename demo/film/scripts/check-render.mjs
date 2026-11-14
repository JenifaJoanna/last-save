#!/usr/bin/env node
// Rendered-file checks (headless, file-based; nothing is played or shown). Exit 1 on any failure.
//  1. dead air: no run of near-black frames (mean luma YAVG < 28 on the limited 16–235 scale, where the void is ~24)
//     longer than 10 frames — an empty or black hold, not a transition;
//  2. --ocr: OCR (tesseract) of a frame every 0.5 s finds no "TBD", "placeholder" or "Take pending" anywhere on screen.
// Usage: node scripts/check-render.mjs <video.mp4> [--ocr] [--max-dark 10]
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const ocr = args.includes("--ocr");
const maxDark = Number(args[args.indexOf("--max-dark") + 1]) || 10;
if (!file) { process.stderr.write("usage: node scripts/check-render.mjs <video.mp4> [--ocr] [--max-dark 10]\n"); process.exit(2); }

const fails = [];
const fps = (() => {
  const r = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", file]).toString().trim();
  const [n, d] = r.split("/").map(Number); return n / (d || 1);
})();

// 1. dead air
const stats = execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an", "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"],
  { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }).toString();
const yavg = [...stats.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
let run = 0;
yavg.forEach((y, i) => {
  run = y < 28 ? run + 1 : 0;
  const endsHere = run > 0 && (i === yavg.length - 1 || yavg[i + 1] >= 28);
  if (endsHere && run > maxDark) fails.push(`dead air: ${run} near-black frames ending at ${(i / fps).toFixed(2)} s (frame ${i})`);
});
process.stdout.write(`check-render: ${yavg.length} frames scanned for dead air (max ${maxDark} near-black in a row)\n`);

// 2. OCR sweep
if (ocr) {
  const dir = mkdtempSync(join(tmpdir(), "check-render-"));
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "fps=2", "-q:v", "2", join(dir, "f%05d.jpg")]);
    const frames = readdirSync(dir).filter((n) => n.endsWith(".jpg")).sort();
    const bad = /\bTBD\b|placeholder|take pending/i;
    const queue = [...frames]; const hits = [];
    const worker = () => new Promise((done) => {
      const next = () => {
        const n = queue.shift(); if (!n) return done();
        let out = ""; const p = spawn("tesseract", [join(dir, n), "-", "--psm", "11"], { stdio: ["ignore", "pipe", "ignore"] });
        p.stdout.on("data", (b) => { out += b; });
        p.on("close", () => { const m = out.match(bad); if (m) hits.push([n, m[0]]); next(); });
      };
      next();
    });
    await Promise.all([1, 2, 3, 4].map(worker));
    for (const [n, w] of hits.sort()) fails.push(`on screen: "${w}" at ~${((Number(n.slice(1, 6)) - 1) / 2).toFixed(1)} s`);
    process.stdout.write(`check-render: ${frames.length} frames OCR'd (every 0.5 s)\n`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (fails.length) { process.stdout.write(`check-render: FAIL (${fails.length})\n${fails.map((f) => `  - ${f}`).join("\n")}\n`); process.exit(1); }
process.stdout.write("check-render: ok\n");
