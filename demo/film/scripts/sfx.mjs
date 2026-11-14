#!/usr/bin/env node
// Builds public/sfx/v1/: action-specific effects generated with ElevenLabs eleven_text_to_sound_v3 (E) plus copies from
// the owner's Drive SFX library (D, local copies). Writes sfx-provenance.json. Usage: node scripts/sfx.mjs [names...]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const l of readFileSync(join(root, ".env.local"), "utf8").split("\n")) { const m = l.match(/^(\w+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, ""); }
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = "eleven_text_to_sound_v3";
const out = join(root, "public", "sfx", "v1");
mkdirSync(out, { recursive: true });

const STREHL = join(homedir(), "Documents/video-library/references/strehl-demo/public-demo/sfx");
const FINE = join(homedir(), "Documents/products/fine-print/film/public/sfx");
const D = {
  "typing.mp3": join(STREHL, "keyboard-typing-5997.mp3"), "key.mp3": join(STREHL, "keyboard-press.mp3"),
  "tick.wav": join(FINE, "tick.wav"), "cash.mp3": join(STREHL, "cash-ting.mp3"), "digits.mp3": join(STREHL, "display-digits-3.mp3"),
  "win.mp3": join(STREHL, "quick-win.mp3"), "glitch.mp3": join(STREHL, "glitch-sound-effect.mp3"), "stamp.wav": join(FINE, "stamp.wav"),
};
const E = {
  "crt-on.mp3": [1.5, "Old CRT monitor powering on: a soft static thump, then a rising high-pitched tube whine that settles. Close, dry."],
  "dialup.mp3": [0.8, "Very short retro 1200-baud modem handshake chirp, quiet and clean: two tones and a brief static burst."],
  "thunk2.mp3": [1.2, "Two soft heavy metal cartridges set down on a metal plinth one after the other, dull thunks, small room."],
  "vault.mp3": [1.2, "A vault lock engaging: a deep mechanical clunk and a short metallic latch."],
  "deny-a.mp3": [0.5, "Retro computer terminal access-denied buzz: a short, low square-wave buzz."],
  "deny-b.mp3": [0.5, "Short descending two-note error beep from an old computer terminal."],
  "dash.mp3": [0.6, "Arcade hover-ship dash: a quick airy synth zip with a soft thump."],
  "shard.mp3": [0.5, "Bright crystal shard pickup chime in an arcade game, short."],
  "hit.mp3": [0.5, "Arcade impact hit: a short crunchy punch with a bass thump."],
  "crt-off.mp3": [1.2, "CRT television switching off: a sharp electrical pop followed by a falling high-pitched whine."],
  "probe-fail.mp3": [0.5, "A low, muted error blip from a computer terminal, soft."],
  "flatline.mp3": [4.0, "Hospital ECG monitor flatline: one continuous steady electronic tone, clean, no beeps."],
  "alert.mp3": [0.6, "A muted chat-app notification ping, soft, single."],
  "decode.mp3": [1.6, "Rapid digital data chatter that resolves into one bright, clear chime."],
  "unlock.mp3": [2.5, "Warm resonant unlock swell: a soft low swell blooming into a gentle golden shimmer."],
  "refund.mp3": [0.8, "Coin-return clink: a few coins dropping into a metal tray."],
  "pledge.mp3": [0.8, "A single heavy coin dropped into a glass jar."],
  "lobby.mp3": [1.0, "Rising digital lobby chime: three ascending soft synth notes, a game reconnecting."],
  "bounce.mp3": [0.5, "A soft denied thud, like a muffled door closing."],
  "coins.mp3": [1.2, "Coins counted one by one onto a wooden table, quick."],
  "radio.mp3": [0.8, "A short radio transmission burst: a squelch and a clean data chirp."],
  "impact.mp3": [3.0, "A deep, soft cinematic impact with a subtle high shimmer tail."],
};

const want = process.argv.slice(2);
const prov = existsSync(join(out, "sfx-provenance.json")) ? JSON.parse(readFileSync(join(out, "sfx-provenance.json"), "utf8")) : {};
for (const [name, src] of Object.entries(D)) {
  if (want.length && !want.includes(name)) continue;
  if (!existsSync(src)) { process.stderr.write(`missing Drive copy ${src}\n`); continue; }
  copyFileSync(src, join(out, name));
  prov[name] = { source: "Drive SFX library (local copy)", file: src.replace(homedir(), "~") };
}
for (const [name, [dur, text]] of Object.entries(E)) {
  if (want.length && !want.includes(name)) continue;
  const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192", {
    method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: dur, prompt_influence: 0.6, model_id: MODEL, loop: false }),
  });
  if (!r.ok) { process.stderr.write(`${name}: ${r.status} ${(await r.text()).slice(0, 300)}\n`); continue; }
  writeFileSync(join(out, name), Buffer.from(await r.arrayBuffer()));
  prov[name] = { source: `ElevenLabs ${MODEL}`, prompt: text, duration_seconds: dur };
  process.stdout.write(`${name}\n`);
}
writeFileSync(join(out, "sfx-provenance.json"), JSON.stringify(prov, null, 1));
