// Assembles the 16:9 film from the beat sheet: scenes, real footage, VO, captions, music bed.
import { AbsoluteFill, Audio, getStaticFiles, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Close } from "./scenes/Close";
import { Escrow } from "./scenes/Escrow";
import { Open } from "./scenes/Open";
import { Title } from "./scenes/Title";
import { Why } from "./scenes/Why";
import { C, chakra, inter, s } from "./theme";
import { BEATS, TOTAL } from "./timeline";

const has = (p: string) => getStaticFiles().some((f) => f.name === p);

export function Chip({ text }: { text: string }) {
  const f = useCurrentFrame();
  const a = interpolate(f, [s(0.3), s(0.8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 48, bottom: 44, opacity: a, transform: `translateY(${(1 - a) * 10}px)`, fontFamily: chakra, fontSize: 24, letterSpacing: 2,
      color: C.text, background: "rgba(7,6,13,0.78)", border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 20px", backdropFilter: "blur(8px)" }}>{text}</div>
  );
}

export function Footage({ file, from = 0, mute, caption }: { file: string; from?: number; mute?: boolean; caption?: string }) {
  const path = `footage/${file}`;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {has(path) ? <OffthreadVideo src={staticFile(path)} startFrom={s(from)} muted={mute ?? true} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: inter, fontSize: 32, color: C.faint }}>footage pending: {file}</AbsoluteFill>}
      {caption && <Chip text={caption} />}
    </AbsoluteFill>
  );
}

const SCENES = { open: Open, title: Title, escrow: Escrow, close: Close, why: Why };

export function Film() {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {BEATS.map((b) => (
        <Sequence key={b.id} from={s(b.start)} durationInFrames={s(b.dur)} name={b.id}>
          {b.kind === "scene" ? (() => { const S = SCENES[b.id]; return <S />; })() : <Footage file={b.file} from={b.from} mute={b.mute} caption={b.caption} />}
          {b.vo && has(`vo/${b.vo}.mp3`) && <Sequence from={s(0.4)}><Audio src={staticFile(`vo/${b.vo}.mp3`)} volume={1} /></Sequence>}
        </Sequence>
      ))}
      {has("music/bed.mp3") && <Audio src={staticFile("music/bed.mp3")} volume={(f) => interpolate(f, [0, s(2), s(68), s(70.5), s(82), s(86), s(TOTAL - 3), s(TOTAL)], [0, 0.22, 0.22, 0, 0, 0.18, 0.18, 0], { extrapolateRight: "clamp" })} />}
    </AbsoluteFill>
  );
}
