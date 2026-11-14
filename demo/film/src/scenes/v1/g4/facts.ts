// S09 The kill + S10 Release: every beat frame, take cut and on-screen string in one place.
// Beat frames are scene-relative and come from the scribe_v3 word times (vo/timings/V08.json, V09.json).
import V08 from "../../../../vo/timings/V08.json";
import V09 from "../../../../vo/timings/V09.json";
import { rs, ra } from "../../../film/run";
import { voFrame } from "../../../film/timeline";

const wordAt = (words: { w: string; s: number }[], w: string, n = 0) => words.filter((x) => x.w.toLowerCase().replace(/[^a-z']/g, "") === w)[n].s;
/** Frame of a V08 word inside S09 (n = which occurrence). */
const k = (w: string, n = 0) => voFrame("S09") + Math.round(wordAt(V08.words, w, n) * 30);
const r = (w: string, n = 0) => voFrame("S10") + Math.round(wordAt(V09.words, w, n) * 30);

/** S09 beats (f18 is the VO start). */
export const K = {
  goes: k("goes"), dark: k("dark"), stop: k("stop"), disappears: k("disappears"), word: k("word"), alive: k("alive"),
  only: k("only"), served: k("served"), they: k("they"), report: k("report"), down: k("down"),
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

/** The death path is holder reports (raw/reports.mp4, 1920×1080, 23.5 s, /status as a holder). Measured off the take:
 * 1/2 holder report at 10.43 s (then the "Report recorded" relayer toast), 2/2 and GONE DARK in the same frame at
 * 19.07 s (the page's own flicker runs to 19.63 s). Cuts fall only in the idle time between those events, each labelled;
 * nothing is sped up. `at` is the scene frame (clamped to the power-on), `from` the take second. */
export const REPORT_CUTS: { at: number; from: number; label?: string }[] = [
  { at: 0, from: 0.5 }, //                                           ALIVE, proof-of-life rows (1/3 failed, not counted)
  { at: K.report - 28, from: 9.5, label: "+7.7 s" }, //               1/2 lands at 10.43 s → on "report"
  { at: K.down - 7, from: 18.84, label: "+8.2 s" }, //                2/2 + GONE DARK at 19.07 s → on "down"
];
/** The lifted log: the take's own rows (proof-of-life card) and its report counter, in order. */
export const LOG_LINES = [
  { text: "> PROBE 1/3 ....... ", res: "FAILED", tail: "  unreachable", c: "dead" },
  { text: "> PROBE ......... ", res: "NOT COUNTED", tail: "  enclave timeout ×2", c: "amber" },
  { text: "> HOLDER REPORT 1/2 ...... ", res: "RECORDED", tail: "", c: "gold" },
  { text: "> HOLDER REPORT 2/2 ...... ", res: "QUORUM", tail: "", c: "gold" },
  { text: "> STUDIO DECLARED GONE  ", res: "DEAD", tail: "", c: "dead" },
] as const;

/** The death alert scripts/alerts/discord-feed.mjs really posted to #status for ember-rift at ~22:45 IST. Only its title
 * is shown: the posted card's description used the feed's old "three probes failed" wording, which is false for
 * ember-rift (holders reported it down), so the film draws the title line and claims nothing else about the post. */
export const ALERT = {
  title: "Ember Rift: server DEAD",
  line: "posted · DEAD · THE STUDIO WENT DARK",
};

/** The released server key (the run's released_key, read back from the instance). S11 splits it into four 16-char rows
 * (g5 draws the same string). */
export const RELEASED_KEY = ra("releasedKey");
export const KEY_GROUPS = [0, 1, 2, 3].map((i) => RELEASED_KEY.slice(i * 16, i * 16 + 16));
/** End pose of S10 = S11's first frame (S11.tsx): one 64-char line, Plex Mono 500 36 px gold, centred on (960, 540),
 * with the cyan "// Server key · decoded on-chain" eyebrow at content top 360 and nothing else on the gold screen. */
export const KEY_POSE = { cx: 960, cy: 540, size: 36, eyebrowTop: 360, color: "#ffc94a" } as const;

/** S10 shows the dev instance v2dev's real, already-completed release (run-facts-after.json); the release moment itself
 * is not replayed. x-release (raw/x-release.mp4 + .cast, 3840×2160): chain-view get_info on v2dev via public RPC; the
 * JSON (contract, status Dead, cause probes, released_key, released_at_ms) prints at 1.26 s, rows x 252–1500, y 330–495
 * on the 1920 basis. */
export const XREL = { from: 1.4, crop: { x: 230 / 1920, y: 300 / 1080, w: 1300 / 1920, h: 230 / 1080 } };
/** release (raw/release.mp4, 1920×1080, 10.7 s): v2dev /status already RELEASED, static. */
export const RELEASE_FROM = 0.5;
/** The take's key as it wraps in the escrow card: rows at 44 + 20 chars, left x 1230, row centres y 929 / 949 (1920
 * basis), ~13.5 px. The lift keeps that wrap at 56 px, then the rows join into S11's one 36 px line. */
export const TAKE_KEY = { x: 1230, y: [929, 949], size: 13.5, wrap: 44 } as const;
/** Brief/PLAN: the status bar flips red at the collapse. Set true to step it instead with the contract (probing amber
 * while the probes take plays, red when the contract marks it dead), which matches what the take shows. */
export const CHROME_FOLLOWS_CONTRACT = true;
