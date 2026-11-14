// X-cut cold open (5.4 s, replaces S01 in the X cut only). X autoplays muted, so the first 5 s carry the problem and
// the hook as type, while V01 states the problem aloud underneath (voAt 0.3 s):
//  A f0–89   S09's end state, full-bleed: the red flatline with its sweep, "WE KILLED / OUR SERVER." prints in stepped
//            (5 steps, 12 f), one slow push. On "the game" (V01 2.70 s + 0.3) the line kicks once — a single beat.
//  B f90–161 the community host's match (`back`, same take cut as S14's backMatch) full-bleed and alive, "YOU STILL /
//            HAVE THE GAME." prints over a low void band; hard cut into S02's CRT-on boot.
// Every word on screen is the film's own claim, shown later with its proof (S09 kill, S13–S14 the fan host).
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { CrtLayers } from "../ds/crt";
import { Display, Label } from "../ds/type";
import { EASE_OUT, Easing, stepped, T } from "../ds/tokens";
import { TAKE_FROM } from "../scenes/v1/g5/facts";
import { Slot, slotSource } from "./Slot";
import { XOPEN } from "./xcut";

export { XOPEN };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LINE_Y = 690;

/** Stepped left-to-right print (the app's steps(5) title reveal), starting at frame `at`. */
function Print({ at, children }: { at: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const p = stepped((f - at) / 12, 5);
  return <div style={{ clipPath: `inset(-20% ${(1 - p) * 100}% -20% -2%)` }}>{children}</div>;
}

/** The dead line: flat, with the sweep glint; at `beat` it kicks once (a single heartbeat) before the cut. */
function DeadLine({ beat }: { beat: number }) {
  const f = useCurrentFrame();
  const sweep = ((f * 14) % 2600) - 360;
  const k = f - beat;
  const amp = k < 0 ? 0 : k < 2 ? 1 : k < 4 ? -0.55 : k < 6 ? 0.25 : 0;
  const x0 = 1240; const pts = `0,0 ${x0},0 ${x0 + 30},${-120 * amp} ${x0 + 62},${90 * amp} ${x0 + 92},0 1920,0`;
  return (
    <svg width={1920} height={300} viewBox="0 -150 1920 300" style={{ position: "absolute", left: 0, top: LINE_Y - 150 }}>
      <defs><filter id="xo-glow" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="6" /></filter></defs>
      <polyline points={pts} fill="none" stroke={T.dead} strokeWidth={10} opacity={0.55} filter="url(#xo-glow)" />
      <polyline points={pts} fill="none" stroke={T.dead} strokeWidth={4} strokeLinejoin="round" />
      {amp === 0 && <rect x={sweep} y={-3} width={360} height={6} rx={3} fill="url(#xo-sweep)" />}
      <defs><linearGradient id="xo-sweep"><stop offset="0" stopColor="#ffb4ba" stopOpacity="0" /><stop offset="0.5" stopColor="#ffb4ba" stopOpacity="0.85" /><stop offset="1" stopColor="#ffb4ba" stopOpacity="0" /></linearGradient></defs>
    </svg>
  );
}

function ShotA() {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, XOPEN.cut], [1, 1.045], { ...clamp, easing: Easing.bezier(...EASE_OUT) });
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 45% at 50% 64%, rgba(255,77,94,0.10), transparent 70%)" }} />
        <div style={{ position: "absolute", left: 160, top: 300 }}>
          <Print at={4}><Display size={156} tone="dead">{"We killed\nour server."}</Display></Print>
        </div>
        <DeadLine beat={XOPEN.beat} />
        <Label size={30} color={T.dead} track={0.2} style={{ position: "absolute", left: 164, top: LINE_Y + 46, opacity: interpolate(f, [16, 22], [0, 0.9], clamp) }}>
          Ember Rift · official server · dead
        </Label>
      </AbsoluteFill>
      <CrtLayers />
    </AbsoluteFill>
  );
}

function ShotB() {
  const f = useCurrentFrame();
  const raw = slotSource("back").kind === "raw";
  const push = interpolate(f, [0, 72], [1.3, 1.38], clamp); // tight on the arena: the action, not the empty rim
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 42%" }}>
        <Slot slot={raw ? "back" : "match"} from={raw ? TAKE_FROM.backMatch : 10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,8,20,0) 38%, rgba(10,8,20,0.78) 62%, rgba(10,8,20,0.94) 100%)" }} />
      <div style={{ position: "absolute", left: 160, top: 640 }}>
        <Print at={2}><Display size={140} tone="sunset">{"You still\nhave the game."}</Display></Print>
      </div>
      <Label size={30} color={T.gold} track={0.2} style={{ position: "absolute", left: 164, top: 600, opacity: interpolate(f, [10, 16], [0, 0.95], clamp) }}>
        Ember Rift · community host · same progress
      </Label>
      <CrtLayers />
    </AbsoluteFill>
  );
}

export function XOpen() {
  const f = useCurrentFrame();
  // 4-frame stepped roll between the shots: the dead screen slides up one screen height, B rides in under it.
  const roll = f < XOPEN.cut - 4 ? 0 : stepped((f - (XOPEN.cut - 4)) / 4, 4);
  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {f < XOPEN.cut && <AbsoluteFill style={{ transform: `translateY(${-roll * 1080}px)` }}><ShotA /></AbsoluteFill>}
      {f >= XOPEN.cut - 4 && (
        <AbsoluteFill style={{ transform: `translateY(${(1 - roll) * 1080}px)` }}>
          <SequenceAt at={XOPEN.cut - 4}><ShotB /></SequenceAt>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function SequenceAt({ at, children }: { at: number; children: ReactNode }) {
  return <Sequence from={at} layout="none">{children}</Sequence>;
}
