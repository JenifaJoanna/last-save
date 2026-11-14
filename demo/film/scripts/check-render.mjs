#!/usr/bin/env node
// Rendered-file checks (headless, file-based; nothing is played or shown). Exit 1 on any failure.
//  1. dead air: no run of empty frames longer than 10 frames — an empty or black hold, not a transition. Empty = dark
//     (mean luma YAVG < 28 on the limited 16–235 scale; the void is ~24) AND flat (edge density < 0.2: mean of an
//     edgedetect pass; void + grain measures ~0.0005, a lone red line 0.3, a dimmed dark arena with sprites 1.6). The
//     film's palette is dark, so darkness alone is not emptiness;
//  2. --ocr: OCR (tesseract) of a frame every 0.5 s finds no "TBD", "MISSING" (a run value scripts/facts.mjs could not read), "placeholder", "Take pending" or any identity
//     term (the repo's shared list, scripts/lib/identity-terms.mjs) anywhere on screen.
// Usage: node scripts/check-render.mjs <video.mp4> [--ocr] [--max-dark 10]
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ON_CAMERA_TERMS, TERMS } from "../../../scripts/lib/identity-terms.mjs";

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

// 1. dead air (one decode: luma and edge density per frame, into two metadata files)
const meta = mkdtempSync(join(tmpdir(), "check-render-meta-"));
let luma = []; let edges = [];
try {
  const fl = join(meta, "luma.txt"); const fe = join(meta, "edges.txt");
  execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-loglevel", "error", "-i", file, "-an", "-filter_complex",
    `[0:v]split[a][b];[a]signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${fl}[a1];` +
    `[b]edgedetect=low=0.08:high=0.25,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${fe}[b1]`,
    "-map", "[a1]", "-f", "null", "-", "-map", "[b1]", "-f", "null", "-"], { stdio: "ignore" });
  const read = (f) => [...readFileSync(f, "utf8").matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  luma = read(fl); edges = read(fe);
} finally { rmSync(meta, { recursive: true, force: true }); }
const yavg = luma;
const empty = luma.map((y, i) => y < 28 && (edges[i] ?? 0) < 0.2);
let run = 0;
empty.forEach((e, i) => {
  run = e ? run + 1 : 0;
  const endsHere = run > 0 && (i === empty.length - 1 || !empty[i + 1]);
  if (endsHere && run > maxDark) fails.push(`dead air: ${run} empty frames ending at ${(i / fps).toFixed(2)} s (frame ${i})`);
});
process.stdout.write(`check-render: ${yavg.length} frames scanned for dead air (max ${maxDark} empty in a row)\n`);

// 2. OCR sweep
if (ocr) {
  const dir = mkdtempSync(join(tmpdir(), "check-render-"));
  try {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", "fps=2", "-q:v", "2", join(dir, "f%05d.jpg")]);
    const frames = readdirSync(dir).filter((n) => n.endsWith(".jpg")).sort();
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ids = [...TERMS, ...ON_CAMERA_TERMS].map((t) => t.toLowerCase());
    const bad = new RegExp(`\\bTBD\\b|\\bMISSING\\b|placeholder|take pending|${ids.map(esc).join("|")}`, "i");
    const queue = [...frames]; const hits = [];
    const worker = () => new Promise((done) => {
      const next = () => {
        const n = queue.shift(); if (!n) return done();
        let out = ""; const p = spawn("tesseract", [join(dir, n), "-", "--psm", "11"], { stdio: ["ignore", "pipe", "ignore"] });
        p.stdout.on("data", (b) => { out += b; });
        p.on("close", () => { const m = out.match(bad); if (m) hits.push([n, ids.includes(m[0].toLowerCase()) ? "identity term" : m[0]]); next(); });
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
