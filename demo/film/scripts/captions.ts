// Caption files (.srt) for the full film and the X cut, from the eleven_v4 narration's scribe_v3 word timings placed on
// each cut's own timeline (src/film/timeline.ts, src/film/xcut.ts). X autoplays muted; upload the .srt with the video.
// Cues: ≤ 2 lines of ≤ 42 chars, broken after sentence or clause punctuation, shown from the first word's start to
// the last word's end + 0.25 s (never overlapping the next cue).
// Run: node scripts/captions.mjs   (bundles this file with esbuild, then writes out/captions/*.srt)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLACED, type Placed } from "../src/film/timeline";
import { X_PLACED } from "../src/film/xcut";

type Word = { w: string; s: number; e: number };
const root = process.cwd();
const SCRIPT: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(join(root, "vo", "narration-v3.json"), "utf8")).lines as { id: string; text: string }[]).map((l) => [l.id, l.text]));
// Scribe writes what it hears ("license", "LastSave", "40%"); captions show the script's words, so each heard word is
// matched to the script tokens it covers and takes their spelling and punctuation, keeping the heard timing.
const SPOKEN: Record<string, string> = { "40%": "fortypercent" };
const norm = (s: string) => (SPOKEN[s] ?? s).toLowerCase().replace(/licen[cs]e/g, "licence").replace(/[^a-z0-9]/g, "");
function words(vo: string): Word[] {
  const heard: Word[] = JSON.parse(readFileSync(join(root, "vo", "timings", `${vo}.json`), "utf8")).words;
  const toks = SCRIPT[vo].split(/\s+/);
  let j = 0;
  return heard.map((w) => {
    const target = norm(w.w); const parts: string[] = []; let acc = "";
    while (j < toks.length && (acc.length < target.length || norm(toks[j]) === "")) { parts.push(toks[j]); acc += norm(toks[j++]); }
    if (acc !== target) throw new Error(`captions: ${vo}: heard "${w.w}" does not match script "${parts.join(" ")}"`);
    return { ...w, w: parts.join(" ") };
  });
}

function cues(scenes: Placed[]) {
  const out: { a: number; b: number; lines: string[] }[] = [];
  for (const s of scenes) {
    if (!s.vo) continue;
    const t0 = s.from / 30 + (s.voAt ?? 0);
    let cur: Word[] = [];
    const flush = () => {
      if (!cur.length) return;
      const text = cur.map((w) => w.w).join(" ");
      const lines: string[] = [];
      for (const w of text.split(" ")) { const l = lines[lines.length - 1]; if (l !== undefined && (l + " " + w).length <= 42) lines[lines.length - 1] = `${l} ${w}`; else lines.push(w); }
      out.push({ a: t0 + cur[0].s, b: t0 + cur[cur.length - 1].e + 0.25, lines });
      cur = [];
    };
    for (const w of words(s.vo)) {
      const len = [...cur, w].map((x) => x.w).join(" ").length;
      if (len > 84) flush();
      cur.push(w);
      if (/[.?!]$/.test(w.w) || (/[,;:—]$/.test(w.w) && len > 30)) flush();
    }
    flush();
  }
  for (let i = 0; i < out.length - 1; i++) out[i].b = Math.min(out[i].b, out[i + 1].a - 0.04);
  return out;
}

const ts = (t: number) => {
  const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
const srt = (c: ReturnType<typeof cues>) => c.map((x, i) => `${i + 1}\n${ts(x.a)} --> ${ts(x.b)}\n${x.lines.join("\n")}\n`).join("\n");

mkdirSync(join(root, "out", "captions"), { recursive: true });
for (const [name, scenes] of [["last-save", PLACED], ["last-save-x", X_PLACED]] as const) {
  const c = cues(scenes);
  writeFileSync(join(root, "out", "captions", `${name}.srt`), srt(c));
  process.stdout.write(`captions: out/captions/${name}.srt (${c.length} cues)\n`);
}
