// Small motion helpers shared by S04, S05 and S12: clamped interpolation, the app's eases and VO word beats.
import { Easing, interpolate } from "remotion";
import { EASE_OUT, FPS } from "../../../ds/tokens";
import { scene, type SceneId, voFrame } from "../../../film/timeline";

export const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(...EASE_OUT);
export const easeInOut = Easing.inOut(Easing.cubic);
/** Clamped 0..1 progress between frames a and b, optionally eased. */
export const prog = (f: number, a: number, b: number, ease?: (t: number) => number) => interpolate(f, [a, b], [0, 1], ease ? { ...CL, easing: ease } : CL);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Scene-relative frame of a VO word that starts `s` seconds into the scene's line (vo/timings/Vxx.json). */
export const beat = (id: SceneId, s: number) => voFrame(id) + Math.round(s * FPS);
/** Absolute film frame for a scene-relative frame: keeps drift and embers continuous across scene seams. */
export const abs = (id: SceneId, f: number) => scene(id).from + f;

/** Piecewise keyframes [frame, value][], eased in-out between keys, clamped at the ends. */
export function keys(f: number, k: [number, number][], ease: (t: number) => number = easeInOut): number {
  if (f <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (f <= k[i][0]) return lerp(k[i - 1][1], k[i][1], ease((f - k[i - 1][0]) / Math.max(1, k[i][0] - k[i - 1][0])));
  }
  return k[k.length - 1][1];
}
