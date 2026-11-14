// X cut (≤ 2:20, X's free upload limit): opens on the 5.4-s cold open XO (src/film/XOpen.tsx: the hook as type, V01
// underneath) in place of S01, drops S06 Try to kill it, S07 Any studio and S12 Preserved, trims the live match to 6 s,
// and crossfades 10 frames at the two seams those removals create. Score (candidate 3): act 1 composed at X length
// (c3-act1x, 75.8 s: a 5.4-s cold-open section under XO, so "Title" lands on S02) and cut on "dead"; act 2 enters
// under the release and resolves on the last frame (c3-act2x, 56.9 s).
import { S09_DEAD, type ScoreAct } from "./cues";
import { f, type Placed, SCENES } from "./timeline";

/** The cold open (src/film/XOpen.tsx): length, V01 start, the line's single kick and the cut to shot B (frames). */
export const XOPEN = { dur: 5.4, voAt: 0.3, beat: 84, cut: 90 } as const;
const DROP = new Set(["S01", "S06", "S07", "S12"]);
const COLD_OPEN: Placed = { id: "XO", name: "Cold open", dur: XOPEN.dur, vo: "V01", voAt: XOPEN.voAt, from: 0, frames: f(XOPEN.dur) };
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
// act 1 cuts 0.16 s after "dead" (S09_DEAD, from V08's word timings); the release VO starts 0.4 s into S10.
export const X_SCORE: ScoreAct[] = [
  { file: "music/v1/c3-act1x.mp3", from: 0, to: sec("S09") + S09_DEAD + 0.16, fadeIn: 0.6, fadeOut: 0.1 },
  { file: "music/v1/c3-act2x.mp3", from: sec("S10") + 0.37, to: X_TOTAL / 30, fadeIn: 0.6, fadeOut: 2.0 },
];
