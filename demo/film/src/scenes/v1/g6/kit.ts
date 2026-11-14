// Group 6 (S15–S17) helpers: clamps, the app's ease-out, the terminal print-in (steps(5) 400 ms = 12 f) and VO word
// frames. Word times are from vo/timings/V14.json, V15.json and V16.json (scribe_v3, seconds from the VO start).
import { Easing, interpolate } from "remotion";
import { EASE_OUT, stepped } from "../../../ds/tokens";
import { type SceneId, voFrame } from "../../../film/timeline";

export const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const out = Easing.bezier(...EASE_OUT);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Scene-relative frame where a VO word starts. */
export const word = (id: SceneId, s: number) => voFrame(id) + Math.round(s * 30);

/** Print-in progress (0..1, stepped 5) of a line that starts at frame `at`: 400 ms = 12 f. */
export const printP = (f: number, at: number, dur = 12) => stepped(interpolate(f, [at, at + dur], [0, 1], C), 5);
/** The app's .step-in: slides in from -14 px while fading, stepped. */
export const stepIn = (p: number) => ({ opacity: p, transform: `translateX(${(1 - p) * -14}px)` });
