// Assembles a cut from placed scenes: scene video, the eleven_v4 narration, SFX cues and the two-act score, with the
// music ducked under speech. The full film and the X cut share this code; only the edit list and score differ.
import { AbsoluteFill, Audio, Freeze, getStaticFiles, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";
import { T } from "../ds/tokens";
import { SCENE_COMPONENTS } from "../scenes/v1";
import { MUSIC, SCORE, SFX, type ScoreAct } from "./cues";
import { f, PLACED, type Placed } from "./timeline";
import { X_PLACED, X_SCORE } from "./xcut";

const has = (p: string) => getStaticFiles().some((x) => x.name === p);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Measured VO lengths in seconds (scribe_v3 last word end + tail), from vo/timings. */
export const VO_LEN: Record<string, number> = {
  V01: 4.8, V02: 3.68, V03: 11.68, V04: 10.88, V05: 15.76, V06: 8.88, V07: 9.52, V08: 14.88,
  V09: 4.08, V10: 7.76, V11: 4.56, V12: 10.0, V13: 7.12, V14: 6.8, V15: 6.58, V16: 2.88,
};

function FadeIn({ frames, children }: { frames: number; children: ReactNode }) {
  const fr = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: frames ? interpolate(fr, [0, frames], [0, 1], clamp) : 1 }}>{children}</AbsoluteFill>;
}

/** Seams where two owners' poses differ: the next scene fades in over the previous scene's frozen last frame. */
const CROSS: Record<string, number> = { S06: 10 };
function FrozenTail({ last, show, children }: { last: number; show: number; children: ReactNode }) {
  const fr = useCurrentFrame();
  return fr >= last && fr < last + show ? <AbsoluteFill><Freeze frame={last}>{children}</Freeze></AbsoluteFill> : null;
}

export function Assembly({ scenes, score }: { scenes: Placed[]; score: ScoreAct[] }) {
  const at = (id: string) => scenes.find((s) => s.id === id);
  const end = Math.max(...scenes.map((s) => s.from + s.frames));
  const voWindows = scenes.filter((s) => s.vo).map((s) => [s.from + f(s.voAt ?? 0), s.from + f(s.voAt ?? 0) + f(VO_LEN[s.vo!] ?? 5)] as const);
  return (
    <AbsoluteFill style={{ background: T.void }}>
      {scenes.map((s) => {
        const C = SCENE_COMPONENTS[s.id];
        const i = scenes.indexOf(s); const prev = scenes[i - 1]; const cross = prev && prev.from + prev.frames === s.from ? CROSS[s.id] ?? 0 : 0;
        const P = prev ? SCENE_COMPONENTS[prev.id] : null;
        return (
          <Sequence key={s.id} from={cross && P ? s.from - (prev.frames - 1) : s.from} durationInFrames={cross && P ? prev.frames - 1 + s.frames : s.frames} name={`${s.id} ${s.name}`}>
            {cross && P ? (
              <>
                <FrozenTail last={prev.frames - 1} show={cross}><P /></FrozenTail>
                <Sequence from={prev.frames - 1}><FadeIn frames={cross}><C /></FadeIn></Sequence>
              </>
            ) : <FadeIn frames={s.fadeIn ?? 0}><C /></FadeIn>}
          </Sequence>
        );
      })}
      {scenes.filter((s) => s.vo && has(`vo/v4/${s.vo}.mp3`)).map((s) => (
        <Sequence key={`vo-${s.vo}`} from={s.from + f(s.voAt ?? 0)} name={`vo ${s.vo}`}><Audio src={staticFile(`vo/v4/${s.vo}.mp3`)} /></Sequence>
      ))}
      {SFX.filter((c) => at(c.scene) && f(c.at) < at(c.scene)!.frames && has(`sfx/v1/${c.file}`)).map((c) => (
        <Sequence key={`${c.scene}-${c.file}-${c.at}`} from={at(c.scene)!.from + f(c.at)} durationInFrames={c.dur ? f(c.dur) : undefined} name={`sfx ${c.file}`}>
          <Audio src={staticFile(`sfx/v1/${c.file}`)} playbackRate={c.rate ?? 1}
            volume={(fr) => (c.volume ?? 0.7) * (c.dur ? interpolate(fr, [f(c.dur) - (c.fadeOut ? f(c.fadeOut) : 8), f(c.dur)], [1, 0], clamp) : 1)} />
        </Sequence>
      ))}
      {score.filter((m) => has(m.file)).map((m) => {
        const a = f(m.from); const len = f(m.to) - a;
        return (
          <Sequence key={m.file} from={a} durationInFrames={len} name={`score ${m.file.split("/").pop()}`}>
            <Audio src={staticFile(m.file)} volume={(fr) => {
              const abs = a + fr;
              const speaking = Math.max(0, ...voWindows.map(([s0, s1]) => interpolate(abs, [s0 - 9, s0, s1, s1 + 12], [0, 1, 1, 0], clamp)));
              const env = interpolate(fr, [0, Math.max(1, f(m.fadeIn)), len - Math.max(1, f(m.fadeOut)), len], [0, 1, 1, 0], clamp);
              const close = interpolate(abs, [end - f(4), end - f(3)], [1, MUSIC.closeBoost], clamp);
              return MUSIC.gain * env * close * (1 - (1 - MUSIC.duckUnderVo) * speaking);
            }} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export const Film = () => <Assembly scenes={PLACED} score={SCORE} />;
export const XCut = () => <Assembly scenes={X_PLACED} score={X_SCORE} />;
