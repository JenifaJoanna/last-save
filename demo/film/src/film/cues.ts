// Sound cue sheet (absolute film seconds unless `scene` is given, then relative to that scene's start).
// SFX files live in public/sfx/v1/ (src column in PLAN.md §6: D = Drive library copy, E = eleven_text_to_sound_v3).
// Music: public/music/v1/score.mp3 (music_v2_5, composed to this timeline). Owned by the film session.
import type { SceneId } from "./timeline";

export interface Cue { file: string; at: number; scene?: SceneId; volume?: number; dur?: number }

export const SFX: Cue[] = [];

/** Music volume envelope keys (absolute seconds → linear gain). The score hard-stops at the flatline. */
export const MUSIC = { file: "music/v1/score.mp3", gain: 0.22, duckUnderVo: 0.45 };
