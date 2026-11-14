#!/usr/bin/env node
// Composes the score with ElevenLabs Eleven Music (model music_v2_5, instrumental) from composition plans timed to the
// film: act 1 runs from 0:00 to the flatline (it is cut hard there), act 2 enters on the release and resolves on the
// end card. Usage: node scripts/music.mjs <candidate 1|2|3> [act1|act2]. Writes public/music/v1/<cand>-<act>.mp3.
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const l of readFileSync(join(root, ".env.local"), "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, ""); }
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = "music_v2_5";

const CANDIDATES = {
  1: { styles: ["warm retro synth underscore", "84 BPM", "analog pads", "soft arpeggiator", "tape hiss", "instrumental", "cinematic product film", "leaves space for narration"], key: "D minor to D major" },
  2: { styles: ["minimal electronic", "90 BPM", "Rhodes electric piano", "sub bass pulse", "light glitch percussion", "instrumental", "product film underscore", "leaves space for narration"], key: "A minor to A major" },
  3: { styles: ["dark synthwave", "80 BPM", "slow pulse", "gated pads", "warm analog bass", "instrumental", "cinematic", "leaves space for narration"], key: "E minor to E major" },
};
const NEG = ["vocals", "singing", "choir", "spoken word", "rap", "aggressive drops", "dubstep", "orchestral hits", "whoosh"];

const ACTS = {
  act1: (c) => [
    { section_name: "Cold open", duration_ms: 9000, positive_local_styles: ["sparse", "single sustained pad", "faint tape hiss", "no drums", `in ${c.key.split(" to ")[0]}`], negative_local_styles: ["drums", "melody"] },
    { section_name: "Title", duration_ms: 7000, positive_local_styles: ["gentle swell", "arpeggio enters", "hopeful"], negative_local_styles: ["drums"] },
    { section_name: "Explain", duration_ms: 62000, positive_local_styles: ["steady groove", "soft kick and rim", "arpeggio", "understated", "even dynamics under speech"], negative_local_styles: ["lead melody", "big fills"] },
    { section_name: "Live match", duration_ms: 8000, positive_local_styles: ["energy lift", "fuller drums", "bright synth lead motif", "playful"], negative_local_styles: [] },
    { section_name: "Studio goes dark", duration_ms: 15500, positive_local_styles: ["thinning out", "drums drop away", "detuned low pad", "uneasy pulse", "tension"], negative_local_styles: ["bright lead", "drums"] },
  ],
  act2: (c) => [
    { section_name: "Release", duration_ms: 6000, positive_local_styles: ["warm bloom", `${c.key.split(" to ")[1]} chord`, "soft chime", "relief"], negative_local_styles: ["drums"] },
    { section_name: "Afterlife", duration_ms: 42000, positive_local_styles: ["hopeful", "steady groove returns", "soft drums", "arpeggio", "even dynamics under speech", `in ${c.key.split(" to ")[1]}`], negative_local_styles: ["minor key", "tension"] },
    { section_name: "Resolve", duration_ms: 14400, positive_local_styles: ["resolving", "final chord", "long sustain", "gentle tail"], negative_local_styles: ["drums", "abrupt ending"] },
  ],
};

const cand = process.argv[2] ?? "1";
const acts = process.argv[3] ? [process.argv[3]] : ["act1", "act2"];
const c = CANDIDATES[cand];
mkdirSync(join(root, "public", "music", "v1"), { recursive: true });
for (const act of acts) {
  // music_v2_5 takes a chunk plan: { chunks: [{ text, duration_ms, positive_styles, negative_styles, context_adherence }] }.
  const chunks = ACTS[act](c).map((s) => ({ text: `[${s.section_name}]`, duration_ms: s.duration_ms, positive_styles: [...c.styles, ...s.positive_local_styles],
    negative_styles: [...NEG, ...s.negative_local_styles], context_adherence: "high", conditioning_ref: null, condition_strength: null }));
  const body = { model_id: MODEL, composition_plan: { chunks }, seed: 7 + Number(cand) };
  const r = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", { method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { process.stderr.write(`${cand}-${act}: ${r.status} ${(await r.text()).slice(0, 500)}\n`); process.exitCode = 1; continue; }
  const file = join(root, "public", "music", "v1", `c${cand}-${act}.mp3`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  process.stdout.write(`${file}\n`);
}
