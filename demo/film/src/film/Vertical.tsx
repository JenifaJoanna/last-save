// The 45 s vertical cut (1080×1920): kill → release → a fan hosts → back in. Each 16:9 scene plays in a centred band
// (scaled 0.84, cropped to the frame width around a per-scene focus), with word-timed captions from the scribe_v3
// timings below it, the LS-0001 strip above, and the same narration, SFX and score as the full film.
import { AbsoluteFill, Audio, getStaticFiles, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Display, Label, Mono } from "../ds/type";
import { T } from "../ds/tokens";
import { SCENE_COMPONENTS } from "../scenes/v1";
import V08 from "../../vo/timings/V08.json";
import V09 from "../../vo/timings/V09.json";
import V12 from "../../vo/timings/V12.json";
import V13 from "../../vo/timings/V13.json";
import { MUSIC, S09_DEAD, SFX } from "./cues";
import { f, scene, type SceneId } from "./timeline";

const has = (p: string) => getStaticFiles().some((x) => x.name === p);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type Words = { words: { w: string; s: number; e: number }[] };
const WORDS: Record<string, Words> = { V08, V09, V12, V13 };

const INTRO = 1.4; const OUTRO = 1.5; const BAND_Y = 440; const K = 0.84;
const PARTS: { id: SceneId; focus: number }[] = [{ id: "S09", focus: 760 }, { id: "S10", focus: 900 }, { id: "S13", focus: 960 }, { id: "S14", focus: 960 }];
const placed = (() => { let at = f(INTRO); return PARTS.map((p) => { const s = scene(p.id); const o = { ...p, ...s, at }; at += s.frames; return o; }); })();
export const VERTICAL_FRAMES = placed[placed.length - 1].at + placed[placed.length - 1].frames + f(OUTRO);

/** Two-line captions: the current phrase (≤ 26 chars per line) with the spoken word in gold. */
function Captions({ vo, voAt }: { vo: string; voAt: number }) {
  const t = useCurrentFrame() / 30 - voAt;
  const words = WORDS[vo]?.words ?? [];
  const lines: { w: string; s: number; e: number }[][] = [];
  for (const w of words) { const last = lines[lines.length - 1]; if (last && last.map((x) => x.w).join(" ").length + w.w.length < 26 && !/[.?!]$/.test(last[last.length - 1].w)) last.push(w); else lines.push([w]); }
  const i = lines.findIndex((l) => t >= l[0].s - 0.15 && t <= l[l.length - 1].e + 0.25);
  if (i < 0) return null;
  const show = [lines[i]];
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1430, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {show.map((l, li) => (
        <div key={li} style={{ fontFamily: "Chakra Petch", fontWeight: 700, fontSize: 64, lineHeight: 1.15, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.02em" }}>
          {l.map((w, wi) => <span key={wi} style={{ color: t >= w.s ? (t <= w.e + 0.05 ? T.gold : T.text) : T.faint }}>{w.w} </span>)}
        </div>
      ))}
    </div>
  );
}

export function Vertical() {
  const fr = useCurrentFrame();
  const kill = scene("S09").from; // the score's act-1 offset follows the full film
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Label size={26} color={T.text}>LS-0001 · Last Save</Label>
        <Mono size={24} color={T.faint}>a game licence that outlives its publisher</Mono>
      </div>
      {placed.map((p) => {
        const C = SCENE_COMPONENTS[p.id];
        return (
          <Sequence key={p.id} from={p.at} durationInFrames={p.frames} name={p.id}>
            <div style={{ position: "absolute", left: 0, top: BAND_Y, width: 1080, height: 1080 * K, overflow: "hidden" }}>
              <div style={{ position: "absolute", width: 1920, height: 1080, transform: `translateX(${540 - p.focus * K}px) scale(${K})`, transformOrigin: "0 0" }}><C /></div>
            </div>
            {p.vo && <Captions vo={p.vo} voAt={p.voAt ?? 0} />}
            {p.vo && has(`vo/v4/${p.vo}.mp3`) && <Sequence from={f(p.voAt ?? 0)}><Audio src={staticFile(`vo/v4/${p.vo}.mp3`)} /></Sequence>}
            {SFX.filter((c) => c.scene === p.id && has(`sfx/v1/${c.file}`)).map((c) => (
              <Sequence key={`${c.file}-${c.at}`} from={f(c.at)} durationInFrames={c.dur ? f(c.dur) : undefined}>
                <Audio src={staticFile(`sfx/v1/${c.file}`)} playbackRate={c.rate ?? 1} volume={c.volume ?? 0.7} />
              </Sequence>
            ))}
          </Sequence>
        );
      })}
      {has("music/v1/c3-act1.mp3") && (
        <Sequence from={placed[0].at} durationInFrames={f(S09_DEAD + 0.16)} name="score act 1 tail">
          <Audio src={staticFile("music/v1/c3-act1.mp3")} startFrom={kill} volume={MUSIC.gain * MUSIC.duckUnderVo} />
        </Sequence>
      )}
      {has("music/v1/c3-act2.mp3") && (
        <Sequence from={placed[1].at + f(0.37)} name="score act 2">
          <Audio src={staticFile("music/v1/c3-act2.mp3")} volume={(x) => MUSIC.gain * MUSIC.duckUnderVo * interpolate(x, [0, 18, VERTICAL_FRAMES - placed[1].at - 60, VERTICAL_FRAMES - placed[1].at - 12], [0, 1, 1, 0], clamp)} />
        </Sequence>
      )}
      <Sequence from={0} durationInFrames={f(INTRO)} name="hook">
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: interpolate(fr, [f(INTRO) - 6, f(INTRO)], [1, 0], clamp) }}>
          <Display size={92} tone="cream" style={{ textAlign: "center", transform: `translateY(${(1 - Math.min(1, fr / 8)) * 12}px)`, opacity: Math.min(1, fr / 6) }}>{"We killed\nour server."}</Display>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={VERTICAL_FRAMES - f(OUTRO)} name="end card">
        <AbsoluteFill style={{ background: T.void, alignItems: "center", justifyContent: "center", gap: 28, opacity: interpolate(fr - (VERTICAL_FRAMES - f(OUTRO)), [0, 8], [0, 1], clamp) }}>
          <Display size={78} style={{ textAlign: "center" }}>{"You still\nhave the game."}</Display>
          <Label size={26} color={T.muted}>last-save.pages.dev · built on NEAR</Label>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}
