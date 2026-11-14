// The full 16:9 film: scenes S01–S17 laid end to end from timeline.ts, the eleven_v4 narration, SFX cues and the score.
// Each scene is also its own composition, so a scene can be previewed and rendered alone.
import { AbsoluteFill, Audio, getStaticFiles, interpolate, Sequence, staticFile } from "remotion";
import { T } from "../ds/tokens";
import { SCENE_COMPONENTS } from "../scenes/v1";
import { MUSIC, SFX } from "./cues";
import { f, PLACED, scene, TOTAL_FRAMES } from "./timeline";

const has = (p: string) => getStaticFiles().some((x) => x.name === p);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Measured VO lengths in seconds (scribe_v3 last word end + tail), from vo/timings. */
export const VO_LEN: Record<string, number> = {
  V01: 4.8, V02: 3.68, V03: 11.68, V04: 10.88, V05: 15.76, V06: 8.88, V07: 9.52, V08: 14.88,
  V09: 4.08, V10: 7.76, V11: 4.56, V12: 10.0, V13: 7.12, V14: 6.8, V15: 6.58, V16: 2.88,
};

/** VO windows in absolute frames, used to duck the music under speech. */
const VO_WINDOWS = PLACED.filter((s) => s.vo).map((s) => [s.from + f(s.voAt ?? 0), s.from + f(s.voAt ?? 0) + f(VO_LEN[s.vo!] ?? 5)] as const);

export function Film() {
  return (
    <AbsoluteFill style={{ background: T.void }}>
      {PLACED.map((s) => {
        const C = SCENE_COMPONENTS[s.id];
        return <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={`${s.id} ${s.name}`}><C /></Sequence>;
      })}
      {PLACED.filter((s) => s.vo && has(`vo/v4/${s.vo}.mp3`)).map((s) => (
        <Sequence key={`vo-${s.vo}`} from={s.from + f(s.voAt ?? 0)} name={`vo ${s.vo}`}><Audio src={staticFile(`vo/v4/${s.vo}.mp3`)} /></Sequence>
      ))}
      {SFX.filter((c) => has(`sfx/v1/${c.file}`)).map((c) => (
        <Sequence key={`${c.file}-${c.at}`} from={(c.scene ? scene(c.scene).from : 0) + f(c.at)} durationInFrames={c.dur ? f(c.dur) : undefined} name={`sfx ${c.file}`}>
          <Audio src={staticFile(`sfx/v1/${c.file}`)} volume={c.volume ?? 0.7} />
        </Sequence>
      ))}
      {has(MUSIC.file) && (
        <Audio src={staticFile(MUSIC.file)} volume={(fr) => {
          const speaking = Math.max(0, ...VO_WINDOWS.map(([a, b]) => interpolate(fr, [a - 9, a, b, b + 12], [0, 1, 1, 0], clamp)));
          const fade = interpolate(fr, [0, f(1.5), TOTAL_FRAMES - f(2.5), TOTAL_FRAMES], [0, 1, 1, 0], clamp);
          return MUSIC.gain * fade * (1 - (1 - MUSIC.duckUnderVo) * speaking);
        }} />
      )}
    </AbsoluteFill>
  );
}
