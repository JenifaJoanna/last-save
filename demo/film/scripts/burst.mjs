#!/usr/bin/env node
// Turns a screenshot burst into a take: public/footage/raw/<slot>/frames.json ([{ file, t }], t = seconds from the first
// shot) → public/footage/raw/<slot>.mp4 at 30 fps, each shot held for its real capture interval (no interpolation, no
// speed-up; the last shot holds 1 s). Each change of shot dissolves over --blend frames (default 4, a tmix of the
// held frames: holds are untouched), so the page steps softly under the scene's continuous push instead of
// reading as a slideshow. Used for `hostbtn` when the persona browser can't screen-record.
// Usage: node scripts/burst.mjs <slot> [--blend 4]
import { execFileSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const slot = process.argv[2];
const blend = process.argv.includes("--blend") ? Number(process.argv[process.argv.indexOf("--blend") + 1]) : 4;
if (!Number.isInteger(blend) || blend < 1 || blend > 10) { process.stderr.write("burst: --blend must be 1–10 frames\n"); process.exit(2); }
if (!slot || !/^[a-z0-9-]+$/.test(slot)) { process.stderr.write("usage: node scripts/burst.mjs <slot>\n"); process.exit(2); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "footage", "raw", slot);
const list = join(dir, "frames.json");
if (!existsSync(list)) { process.stderr.write(`burst: no ${slot}/frames.json\n`); process.exit(1); }
const shots = JSON.parse(readFileSync(list, "utf8")).map((s) => ({ file: String(s.file), t: Number(s.t) })).sort((a, b) => a.t - b.t);
for (const s of shots) {
  if (!/^[\w.-]+\.(png|jpe?g)$/i.test(s.file) || !existsSync(join(dir, s.file)) || !Number.isFinite(s.t)) { process.stderr.write(`burst: bad entry ${JSON.stringify(s)}\n`); process.exit(1); }
}
// Exact frame sequence at 30 fps: output frame k shows the last shot taken at or before k/30 s (hard links, no copies),
// so every shot holds for its real interval and the last one for 1 s. (The concat demuxer drops the last duration.)
const seq = join(dir, ".seq");
rmSync(seq, { recursive: true, force: true });
mkdirSync(seq);
const total = Math.round((shots[shots.length - 1].t + 1) * 30);
for (let k = 0, i = 0; k < total; k++) {
  while (i + 1 < shots.length && shots[i + 1].t <= k / 30 + 1e-6) i++;
  linkSync(join(dir, shots[i].file), join(seq, `f${String(k).padStart(5, "0")}${extname(shots[i].file).toLowerCase()}`));
}
const ext = extname(shots[0].file).toLowerCase();
if (shots.some((x) => extname(x.file).toLowerCase() !== ext)) { process.stderr.write("burst: mixed image types\n"); process.exit(1); }
const out = join(root, "public", "footage", "raw", `${slot}.mp4`);
try {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "30", "-i", join(seq, `f%05d${ext}`),
    "-vf", `${blend > 1 ? `tmix=frames=${blend},` : ""}format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-r", "30", "-movflags", "+faststart", out]);
} finally { rmSync(seq, { recursive: true, force: true }); }
const span = shots[shots.length - 1].t + 1;
process.stdout.write(`burst: ${shots.length} shots over ${span.toFixed(1)} s → public/footage/raw/${slot}.mp4 (${(shots.length / span).toFixed(1)} shots/s, ${blend}-frame dissolves)\n`);
