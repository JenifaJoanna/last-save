// S09 The kill + S10 Release: every beat frame, take cut and on-screen string in one place.
// Beat frames are scene-relative and come from the scribe_v3 word times (vo/timings/V08.json, V09.json).
import V08 from "../../../../vo/timings/V08.json";
import V09 from "../../../../vo/timings/V09.json";
import { rs } from "../../../film/run";
import { voFrame } from "../../../film/timeline";

const wordAt = (words: { w: string; s: number }[], w: string, n = 0) => words.filter((x) => x.w.toLowerCase().replace(/[^a-z']/g, "") === w)[n].s;
/** Frame of a V08 word inside S09 (n = which occurrence). */
const k = (w: string, n = 0) => voFrame("S09") + Math.round(wordAt(V08.words, w, n) * 30);
const r = (w: string, n = 0) => voFrame("S10") + Math.round(wordAt(V09.words, w, n) * 30);

/** S09 beats (f18 is the VO start). */
export const K = {
  goes: k("goes"), dark: k("dark"), stop: k("stop"), disappears: k("disappears"), word: k("word"), alive: k("alive"),
  only: k("only"), served: k("served"), checks: k("checks"), fail: k("fail"), three: k("three"), times: k("times"),
  contract: k("contract"), marks: k("marks"), dead: k("dead"), voEnd: voFrame("S09") + Math.round(V08.lastWordEnd * 30),
} as const;

/** S10 beats (f12 is the VO start). */
export const R = { enclave: r("enclave"), confirms: r("confirms"), gone: r("gone"), releases: r("releases"), server: r("server") } as const;

/** Flatline height inside the ScreenFrame content area (px from the content top). The dead sun sits on it. */
export const FL = 400;

/** Studio terminal takes (raw/t-kill.mp4, raw/t-404.mp4: 3840×2160, term.html replay). Window x 62–1858 on the 1920
 * basis; text from x 252, rows 33 px apart from y 151. We show the bar and the first ~6 rows. */
export const TERM_CROP = { x: 62 / 1920, y: 52 / 1080, w: 1796 / 1920, h: 290 / 1080 };
/** Take rows (1920 basis): left x and row centre y of row i. */
export const TERM_ROW = (i: number) => ({ x: 252, y: 151 + 33 * i });

/** Cut sheet, from the .casts. Scene frames → take seconds. Only idle prompt time is dropped, plus one labelled jump
 * inside t-kill: the wrangler delete runs 2.9 s (1.65 → 4.54 s); we keep 1.0 s of it and label the rest. */
export const KILL_CUTS = [
  { at: K.dark - 1, from: 0.85 }, //  command prints 1.04 s (f62), "Stopping…" 1.65 s (f80)
  { at: K.stop - 14, from: 4.2, label: "+2.2 s" }, // "✕ official server deleted" 4.54 s → f100, on "servers stop"
] as const;
export const GONE_CUT = { at: K.disappears - 10, from: 0.7 }; // curl + "HTTP/2 530" print at 1.01/1.05 s → f151
/** The two lines lifted out of the takes (their own text), ≥ 56 px, each held ≥ 45 f. */
export const LIFT = { deleted: "✕ official server deleted", status: "HTTP/2 530", tag: "gone", deletedRow: 2, statusRow: 1 };
/** lost (raw/lost.mp4, 4.1 s): after the kill, a new sign-in to the official server; the client's own overlay. */
export const LOST = { from: 0, overlay: "Connection lost — reconnecting", sub: "the server is not responding", lead: "Rejoin after the shutdown" };

/** The probes take: segments cut in at `at` (scene frame; clamped to the power-on), playing from `from` s. A label marks
 * every real time jump. `from` values fit the preview capture (17.5 s: alive probe 0–2 s, enclave checking 2–5 s,
 * 1/3 at 5.5 s, 2/3 at 8.5 s, 3/3 + DEAD at 12.5 s). TUNE for the v2 take (1–2 min, probes ≥ 20 s apart): reset `from`
 * and the jump labels to the take's real gaps. */
export const PROBE_CUTS: { at: number; from: number; label?: string }[] = [
  { at: 0, from: 0.6 },
  { at: K.served + 2, from: 2.3, label: "+20 s" },
  { at: K.fail - 3, from: 5.6, label: "+20 s" },
  { at: K.three - 2, from: 8.6, label: "+20 s" },
  { at: K.times - 2, from: 12.4, label: "+20 s" },
];

/** Discord alert: scripts/alerts/discord-feed.mjs embed for the death event; its dry run prints the fallback line. */
export const ALERT = {
  title: "Ember Rift: server DEAD",
  cmd: "$ node scripts/alerts/discord-feed.mjs --dry-run",
  line: "would post: DEAD · THE STUDIO WENT DARK",
};

/** The released server key (the run's released_key, read back from the instance). S11 splits it into four 16-char rows
 * (g5 draws the same string). */
export const RELEASED_KEY = rs("releasedKey");
export const KEY_GROUPS = [0, 1, 2, 3].map((i) => RELEASED_KEY.slice(i * 16, i * 16 + 16));
/** End pose of S10 = S11's first frame (S11.tsx): one 64-char line, Plex Mono 500 36 px gold, centred on (960, 540),
 * with the cyan "// Server key · decoded on-chain" eyebrow at content top 360 and nothing else on the gold screen. */
export const KEY_POSE = { cx: 960, cy: 540, size: 36, eyebrowTop: 360, color: "#ffc94a" } as const;

/** x-release (OutLayer on_execution_response receipt): the Result block (key, status). TUNE for the v2 take: v1 shows
 * it at 10 s, x 380–1540, y 780–1010. */
export const XREL = { from: 10.0, crop: { x: 380 / 1920, y: 780 / 1080, w: 1160 / 1920, h: 230 / 1080 } };

/** The release take (/status DEAD → Release → RELEASED). S10 opens on the frame the screen turns gold (preview: 6.6 s;
 * it scrolls to the escrow card at ~8 s).
 * TUNE for the v2 take. */
export const RELEASE_FROM = 6.6;
/** Where the take shows the decoded key after it scrolls (content px, preview). TUNE for the v2 take. */
export const TAKE_KEY = { x: 1369, y: 546, size: 13 };
/** Brief/PLAN: the status bar flips red at the collapse. Set true to step it instead with the contract (probing amber
 * while the probes take plays, red when the contract marks it dead), which matches what the take shows. */
export const CHROME_FOLLOWS_CONTRACT = true;
