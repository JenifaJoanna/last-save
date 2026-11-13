#!/usr/bin/env node
// Cuts each beat from the raw takes per edl.json into public/footage/<beat>.mp4 (1920x1080, 30 fps, H.264, no audio)
// and writes src/edl.generated.json with each beat's duration and the times of its on-screen labels.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const raw = join(root, "public", "footage", "raw");
const outDir = join(root, "public", "footage");
const edl = JSON.parse(readFileSync(join(root, "edl.json"), "utf8"));
mkdirSync(outDir, { recursive: true });
const result = {};

for (const [beat, segs] of Object.entries(edl.beats)) {
  const inputs = segs.flatMap((s) => ["-ss", String(s.in), "-to", String(s.out), "-i", join(raw, s.src)]);
  const chains = segs.map((_, i) => `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x07060d,fps=30,setsar=1,format=yuv420p[v${i}]`);
  const filter = `${chains.join(";")};${segs.map((_, i) => `[v${i}]`).join("")}concat=n=${segs.length}:v=1:a=0[out]`;
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", join(outDir, `${beat}.mp4`)]);
  let t = 0;
  const labels = [];
  for (const s of segs) {
    if (s.label) labels.push({ at: Math.round(t * 100) / 100, dur: Math.round((s.out - s.in) * 100) / 100, text: s.label });
    t += s.out - s.in;
  }
  result[beat] = { dur: Math.round(t * 100) / 100, labels };
  process.stdout.write(`${beat}: ${t.toFixed(2)} s, ${segs.length} segments\n`);
}
writeFileSync(join(root, "src", "edl.generated.json"), JSON.stringify(result, null, 1) + "\n");
