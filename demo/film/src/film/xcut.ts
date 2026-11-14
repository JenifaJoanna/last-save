// X cut (≤ 2:20, X's free upload limit): opens on the 5.4-s cold open XO (src/film/XOpen.tsx: the hook as type, V01
// underneath) in place of S01, drops S06 Try to kill it, S07 Any studio and S12 Preserved, trims the live match to 6 s,
// and crossfades 10 frames at the two seams those removals create. Score: act 1 re-composed at X length (c1-act1x,
// 79.4 s, its 9-s cold-open section entered 3.6 s in so "Title" still lands on S02) and cut on "dead"; act 2 enters
// under the release and resolves on the last frame (c1-act2x).
import type { ScoreAct } from "./cues";
import { f, type Placed, SCENES } from "./timeline";

/** The cold open (src/film/XOpen.tsx): length, V01 start, the line's single kick and the cut to shot B (frames). */
export const XOPEN = { dur: 5.4, voAt: 0.3, beat: 84, cut: 90 } as const;
const DROP = new Set(["S01", "S06", "S07", "S12"]);
const COLD_OPEN: Placed = { id: "XO", name: "Cold open", dur: XOPEN.dur, vo: "V01", voAt: XOPEN.voAt, from: 0, frames: f(XOPEN.dur) };
/** Seconds of act 1's cold-open section skipped so its "Title" section still enters on S02 (S01 is 9.0 s). */
const SCORE_SKIP = 9.0 - XOPEN.dur;
const TRIM: Record<string, number> = { S08: 6.0 };
const XFADE: Record<string, number> = { S08: 10, S13: 10 };

export const X_PLACED: Placed[] = (() => {
  let at = COLD_OPEN.frames;
  return [COLD_OPEN, ...SCENES.filter((s) => !DROP.has(s.id)).map((s) => {
    const frames = f(TRIM[s.id] ?? s.dur);
    const fade = XFADE[s.id] ?? 0;
    const p: Placed = { ...s, dur: frames / 30, from: at - fade, frames, fadeIn: fade };
    at = p.from + frames;
    return p;
  })];
})();
export const X_TOTAL = X_PLACED[X_PLACED.length - 1].from + X_PLACED[X_PLACED.length - 1].frames;
const sec = (id: string) => X_PLACED.find((s) => s.id === id)!.from / 30;
// "dead" is 15.04 s into S09; the release VO starts 0.4 s into S10.
export const X_SCORE: ScoreAct[] = [
  { file: "music/v1/c1-act1x.mp3", from: 0, to: sec("S09") + 15.2, fadeIn: 0.6, fadeOut: 0.1, offset: SCORE_SKIP },
  { file: "music/v1/c1-act2x.mp3", from: sec("S10") + 0.37, to: X_TOTAL / 30, fadeIn: 0.6, fadeOut: 2.0 },
];
export type ScoreCandidate = "c1" | "c2" | "c3";
/** The X score with another candidate under it (for the final score pick). c2/c3 have no X-length re-compositions yet, so
 * they use their full-film acts: act 1's opening sections are the same plan, act 2 won't resolve on the last frame. */
export const xScore = (c: ScoreCandidate): ScoreAct[] =>
  c === "c1" ? X_SCORE : X_SCORE.map((m) => ({ ...m, file: m.file.replace("c1-act1x", `${c}-act1`).replace("c1-act2x", `${c}-act2`) }));
