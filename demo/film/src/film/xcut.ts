// X cut (≤ 2:20, X's free upload limit): drops S06 Try to kill it, S07 Any studio and S12 Preserved, trims the live
// match to 6 s, and crossfades 10 frames at the two seams those removals create. Score: act 1 re-composed at X length
// (c1-act1x, 79.4 s) and cut on "dead"; act 2 enters under the release and resolves on the last frame (c1-act2x).
import type { ScoreAct } from "./cues";
import { f, type Placed, SCENES } from "./timeline";

const DROP = new Set(["S06", "S07", "S12"]);
const TRIM: Record<string, number> = { S08: 6.0 };
const XFADE: Record<string, number> = { S08: 10, S13: 10 };

export const X_PLACED: Placed[] = (() => {
  let at = 0;
  return SCENES.filter((s) => !DROP.has(s.id)).map((s) => {
    const frames = f(TRIM[s.id] ?? s.dur);
    const fade = XFADE[s.id] ?? 0;
    const p: Placed = { ...s, dur: frames / 30, from: at - fade, frames, fadeIn: fade };
    at = p.from + frames;
    return p;
  });
})();
export const X_TOTAL = X_PLACED[X_PLACED.length - 1].from + X_PLACED[X_PLACED.length - 1].frames;
const sec = (id: string) => X_PLACED.find((s) => s.id === id)!.from / 30;
// "dead" is 15.04 s into S09; the release VO starts 0.4 s into S10.
export const X_SCORE: ScoreAct[] = [
  { file: "music/v1/c1-act1x.mp3", from: 0, to: sec("S09") + 15.2, fadeIn: 1.2, fadeOut: 0.1 },
  { file: "music/v1/c1-act2x.mp3", from: sec("S10") + 0.37, to: X_TOTAL / 30, fadeIn: 0.6, fadeOut: 2.0 },
];
