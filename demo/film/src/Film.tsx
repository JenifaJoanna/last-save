// Assembles the 16:9 film: motion scenes, real footage per beat with time-jump labels, VO, SFX, two music beds.
import { AbsoluteFill, Audio, getStaticFiles, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Close } from "./scenes/Close";
import { Escrow } from "./scenes/Escrow";
import { Open } from "./scenes/Open";
import { Title } from "./scenes/Title";
import { Why } from "./scenes/Why";
import { C, chakra, inter, s } from "./theme";
import { BEATS, startOf, TOTAL } from "./timeline";

const has = (p: string) => getStaticFiles().some((f) => f.name === p);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function Label({ text, dur }: { text: string; dur: number }) {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, s(0.25), s(Math.max(0.6, dur - 0.25)), s(dur)], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: "50%", bottom: 46, opacity: a, transform: `translate(-50%, ${(1 - a) * 8}px)`, whiteSpace: "nowrap", fontFamily: chakra, fontSize: 28, letterSpacing: 1.5,
      color: C.text, background: "rgba(7,6,13,0.82)", border: "1px solid rgba(255,122,26,0.45)", borderRadius: 14, padding: "12px 22px", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>{text}</div>
  );
}

export function Footage({ file }: { file: string }) {
  const path = `footage/${file}`;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {has(path) ? <OffthreadVideo src={staticFile(path)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: inter, fontSize: 32, color: C.faint }}>footage pending: {file}</AbsoluteFill>}
    </AbsoluteFill>
  );
}

const SCENES = { open: Open, title: Title, escrow: Escrow, close: Close, why: Why };

export function Film() {
  const killAt = startOf("kill") + 1.2;
  const returnAt = startOf("release") + 13.4;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {BEATS.map((b) => (
        <Sequence key={b.id} from={s(b.start)} durationInFrames={s(b.dur)} name={b.id}>
          {b.kind === "scene" ? (() => { const S = SCENES[b.id]; return <S />; })() : (
            <>
              <Footage file={`${b.id}.mp4`} />
              {b.caption && <Sequence from={0} durationInFrames={s(b.dur)}><Label text={b.caption} dur={b.dur} /></Sequence>}
              {b.labels.map((l) => <Sequence key={l.at} from={s(l.at)} durationInFrames={s(l.dur)}><Label text={l.text} dur={l.dur} /></Sequence>)}
            </>
          )}
        </Sequence>
      ))}
      {BEATS.map((b) => b.vo && has(`vo/${b.vo}.mp3`) && (
        <Sequence key={`vo-${b.id}`} from={s(b.start + (b.voAt ?? 0.4))} name={`vo ${b.vo}`}><Audio src={staticFile(`vo/${b.vo}.mp3`)} volume={1} /></Sequence>
      ))}
      {BEATS.flatMap((b) => (b.sfx ?? []).map((x) => has(`sfx/${x.file}.mp3`) && (
        <Sequence key={`sfx-${b.id}-${x.file}-${x.at}`} from={s(b.start + x.at)} name={`sfx ${x.file}`}><Audio src={staticFile(`sfx/${x.file}.mp3`)} volume={x.volume ?? 0.8} /></Sequence>
      )))}
      {has("music/bed.mp3") && (
        <Sequence from={0} durationInFrames={s(killAt + 1)} name="music bed">
          <Audio src={staticFile("music/bed.mp3")} volume={(f) => interpolate(f, [0, s(2), s(killAt - 1.5), s(killAt)], [0, 0.2, 0.2, 0], clamp)} />
        </Sequence>
      )}
      {has("music/return.mp3") && (
        <Sequence from={s(returnAt)} durationInFrames={s(TOTAL - returnAt)} name="music return">
          <Audio src={staticFile("music/return.mp3")} volume={(f) => interpolate(f, [0, s(2.5), s(TOTAL - returnAt - 3), s(TOTAL - returnAt)], [0, 0.18, 0.18, 0], clamp)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}
