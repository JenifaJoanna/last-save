// S09 The kill + S10 Release: every beat frame, take cut and on-screen string in one place.
// Beat frames are scene-relative and come from the scribe_v3 word times (vo/timings/V08.json, V09.json).
import V08 from "../../../../vo/timings/V08.json";
import V09 from "../../../../vo/timings/V09.json";
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

/** Studio terminal takes are replayed by demo/capture/term.html: an 1800x980 window centred in 1920x1080. We show its
 * top 420 px (status bar + 10 rows), where every line of these short takes prints. */
export const TERM_CROP = { x: 60 / 1920, y: 50 / 1080, w: 1800 / 1920, h: 420 / 1080 };

/** Placeholder drawings used only while the t-kill / t-404 takes are missing (the take replaces them, lines and all).
 * t-kill lines are scripts/ops/kill-official.sh's own output. The CDN URL is the judge instance's studio copy: TBD
 * until proof/judge-v2.json lands. */
export const KILL_LINES: { t: string; c: "gold" | "text" | "dead" | "muted" }[] = [
  { t: "$ studio shutdown --server emberrift-arena", c: "gold" },
  { t: "Stopping the official Ember Rift server…", c: "text" },
  { t: "✕ official server deleted (emberrift-arena)", c: "dead" },
  { t: "No announcement. No end-of-service call.", c: "muted" },
];
export const GONE_LINES: { t: string; c: "gold" | "text" | "dead" | "muted" }[] = [
  { t: "$ curl -I https://kiln-cdn-TBD.pages.dev/ember-rift-TBD.bin", c: "gold" },
  { t: "HTTP/2 530", c: "dead" },
];
/** Where "HTTP/2 530" sits in the t-404 take, as a row index of TERM rows (row 0 = first line under the bar). The
 * "gone" label hangs to the right of that row. TBD: check against the real take. */
export const GONE_ROW = 1;

/** The probes take: segments cut in at `at` (scene frame; clamped to the power-on), playing from `from` s. A label marks
 * every real time jump. `from` values fit the preview capture (17.5 s: alive probe 0–2 s, enclave checking 2–5 s,
 * 1/3 at 5.5 s, 2/3 at 8.5 s, 3/3 + DEAD at 12.5 s). TBD for the v2 take (1–2 min, probes ≥ 20 s apart): reset `from`
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

/** The released server key. TBD: placeholder = the 14 Nov v1 run's released key (x-release v1 take, plate
 * status-released.png); replace with the v2 judge instance's key from proof/judge-v2.json. S11 splits it into four
 * 16-char rows (g5 draws the same string). */
export const KEY_TBD = "fb0ac47f464bb2c8d5cb1b162c35185bd9c965b9278e8bf95c136c642717e490";
export const KEY_GROUPS = [0, 1, 2, 3].map((i) => KEY_TBD.slice(i * 16, i * 16 + 16));
/** End pose of S10 = S11's first frame (S11.tsx): one 64-char line, Plex Mono 500 36 px gold, centred on (960, 540),
 * with the cyan "// Server key · decoded on-chain" eyebrow at content top 360 and nothing else on the gold screen. */
export const KEY_POSE = { cx: 960, cy: 540, size: 36, eyebrowTop: 360, color: "#ffc94a" } as const;

/** x-release (OutLayer on_execution_response receipt): the Result block (key, status). TBD for the v2 take: v1 shows
 * it at 10 s, x 380–1540, y 780–1010. */
export const XREL = { from: 10.0, crop: { x: 380 / 1920, y: 780 / 1080, w: 1160 / 1920, h: 230 / 1080 } };

/** Take in-points (seconds) for the opening of S09. match continues S08 exactly: S08 plays the take from
 * MATCH_FROM − 32/30 s (4 − 1.067) for 240 f and ends at scale 1.02 about the arena (980, 560). TBD for the v2
 * takes: KILL so the delete line prints near "stop"; GONE so `HTTP/2 530` prints on "disappears"; LOST so the
 * CONNECTION LOST overlay is already up when the terminal window closes. */
export const TAKE_FROM = { match: 4 - 32 / 30 + 8, kill: 0, gone: 0, lost: 0 } as const;
export const ARENA = { x: 980, y: 560, scale: 1.02 } as const;

/** The release take (/status DEAD → Release → RELEASED). S10 opens on the frame the screen turns gold (preview: 6.6 s;
 * it scrolls to the escrow card at ~8 s).
 * TBD for the v2 take. */
export const RELEASE_FROM = 6.6;
/** Where the take shows the decoded key after it scrolls (content px, preview). TBD for the v2 take. */
export const TAKE_KEY = { x: 1369, y: 546, size: 13 };
/** Brief/PLAN: the status bar flips red at the collapse. Set true to step it instead with the contract (probing amber
 * while the probes take plays, red when the contract marks it dead), which matches what the take shows. */
export const CHROME_FOLLOWS_CONTRACT = true;
