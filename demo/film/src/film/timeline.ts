// The film's single timeline (30 fps). Scene lengths are set by the eleven_v4 narration (vo/timings/*.json, measured
// with scribe_v3) plus the beats without VO. Change a length here and every later scene moves with it.
import { FPS } from "../ds/tokens";

export type SceneId = "S01" | "S02" | "S03" | "S04" | "S05" | "S06" | "S07" | "S08" | "S09" | "S10" | "S11" | "S12" | "S13" | "S14" | "S15" | "S16" | "S17";
export interface SceneSpec { id: SceneId; name: string; dur: number; vo?: string; voAt?: number }

/** dur and voAt in seconds; voAt is relative to the scene start. VO lengths (s): V01 4.80, V02 3.68, V03 11.68,
 * V04 10.88, V05 15.76, V06 8.88, V07 9.52, V08 14.88, V09 4.08, V10 7.76, V11 4.56, V12 10.0, V13 7.12, V14 6.80,
 * V15 6.58, V16 2.88. */
export const SCENES: SceneSpec[] = [
  { id: "S01", name: "Open", dur: 9.0, vo: "V01", voAt: 3.6 },
  { id: "S02", name: "Title", dur: 6.8, vo: "V02", voAt: 2.6 },
  { id: "S03", name: "Why", dur: 12.6, vo: "V03", voAt: 0.4 },
  { id: "S04", name: "Buy", dur: 12.6, vo: "V04", voAt: 0.8 },
  { id: "S05", name: "Promise", dur: 16.8, vo: "V05", voAt: 0.4 },
  { id: "S06", name: "Try to kill it", dur: 9.8, vo: "V06", voAt: 0.3 },
  { id: "S07", name: "Any studio", dur: 10.4, vo: "V07", voAt: 0.3 },
  { id: "S08", name: "Live match", dur: 8.0 },
  { id: "S09", name: "The kill", dur: 17.2, vo: "V08", voAt: 0.6 },
  { id: "S10", name: "Release", dur: 5.4, vo: "V09", voAt: 0.4 },
  { id: "S11", name: "Choose", dur: 8.7, vo: "V10", voAt: 0.3 },
  { id: "S12", name: "Preserved", dur: 5.2, vo: "V11", voAt: 0.2 },
  { id: "S13", name: "A fan hosts", dur: 11.1, vo: "V12", voAt: 0.3 },
  { id: "S14", name: "Back in", dur: 8.4, vo: "V13", voAt: 0.6 },
  { id: "S15", name: "Paid on Base", dur: 7.6, vo: "V14", voAt: 0.3 },
  { id: "S16", name: "Verify", dur: 7.6, vo: "V15", voAt: 0.3 },
  { id: "S17", name: "Close", dur: 8.8, vo: "V16", voAt: 2.2 },
];

export const f = (sec: number) => Math.round(sec * FPS);
export interface Placed extends SceneSpec { from: number; frames: number; fadeIn?: number }
export const PLACED: Placed[] = (() => {
  let at = 0;
  return SCENES.map((s) => { const p = { ...s, from: at, frames: f(s.dur) }; at += p.frames; return p; });
})();
export const TOTAL_FRAMES = PLACED.reduce((n, s) => n + s.frames, 0);
export const scene = (id: SceneId) => PLACED.find((s) => s.id === id)!;
/** Frame, relative to a scene's start, where its VO line starts. */
export const voFrame = (id: SceneId) => f(scene(id).voAt ?? 0);
