#!/usr/bin/env node
// Records the narration with ElevenLabs eleven_v4 through Text to Dialogue (with timestamps), one request per line, with
// previous_text/future_text from the neighbouring lines for prosodic continuity (context stitching), then checks each
// file with Scribe and writes word timings. Usage: node scripts/vo.mjs [ids...]   (default: all lines)
// Env: ELEVENLABS_API_KEY in .env.local. Writes public/vo/v4/<id>.mp3 and vo/timings/<id>.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const l of readFileSync(join(root, ".env.local"), "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, ""); }
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY missing (run the vault inject into demo/film/.env.local)");
const NAR = JSON.parse(readFileSync(join(root, "vo", "narration-v3.json"), "utf8"));
const VOICE = "TWutjvRaJqAX89preB4e";
const MODEL = process.env.VO_MODEL ?? "eleven_v4";
const STT = (process.env.STT_MODELS ?? "scribe_v3,scribe_v2").split(",");
mkdirSync(join(root, "public", "vo", "v4"), { recursive: true });
mkdirSync(join(root, "vo", "timings"), { recursive: true });

const want = process.argv.slice(2);
const lines = NAR.lines;
const clip = (s, n, fromEnd) => (s.length <= n ? s : fromEnd ? s.slice(s.length - n) : s.slice(0, n));

async function speak(i) {
  const l = lines[i];
  const body = {
    inputs: [{ text: `${l.tag} ${l.speak ?? l.text}`, voice_id: VOICE }], // `speak` only changes punctuation, never words
    model_id: MODEL,
    settings: { ...NAR.settings, previous_text: i > 0 ? clip(lines[i - 1].text, 100, true) : null, future_text: i < lines.length - 1 ? clip(lines[i + 1].text, 100, false) : null },
    seed: Number(process.env.VO_SEED ?? 1400) + i,
  };
  const r = await fetch("https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_192", {
    method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${l.id}: ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
  const file = join(root, "public", "vo", "v4", `${l.id}.mp3`);
  writeFileSync(file, Buffer.from(j.audio_base64, "base64"));
  return { file, alignment: j.alignment };
}

async function scribe(file) {
  for (const model of STT) {
    const fd = new FormData();
    fd.append("model_id", model);
    fd.append("timestamps_granularity", "word");
    fd.append("tag_audio_events", "false");
    fd.append("file", new Blob([readFileSync(file)], { type: "audio/mpeg" }), "line.mp3");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: fd });
    const j = await r.json();
    if (r.ok) return { model, text: j.text, words: (j.words ?? []).filter((w) => w.type === "word").map((w) => ({ w: w.text, s: w.start, e: w.end })) };
    process.stderr.write(`scribe ${model}: ${r.status} ${JSON.stringify(j).slice(0, 200)}\n`);
  }
  return null;
}

// Spelling-only differences between the script and Scribe's transcript are not delivery errors.
const norm = (s) => s.toLowerCase().replace(/licen[cs]e/g, "licence").replace(/lastsave/g, "last save").replace(/40%/g, "forty percent").replace(/end-of-life/g, "end of life")
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (want.length && !want.includes(l.id)) continue;
  const { file } = await speak(i);
  const stt = await scribe(file);
  const match = stt ? norm(stt.text) === norm(l.text) : false;
  const dur = stt?.words?.length ? stt.words[stt.words.length - 1].e : null;
  writeFileSync(join(root, "vo", "timings", `${l.id}.json`), JSON.stringify({ id: l.id, tts: MODEL, stt: stt?.model, text: l.text, heard: stt?.text, match, lastWordEnd: dur, words: stt?.words ?? [] }, null, 1));
  process.stdout.write(`${l.id} ${MODEL} → ${stt?.model ?? "no-stt"} match=${match} lastWordEnd=${dur}\n${match ? "" : `  heard: ${stt?.text}\n`}`);
}
