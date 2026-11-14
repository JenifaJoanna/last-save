// Shared pieces for S09/S10: frame helpers, the app's dial-up box, CRT open/collapse windows, the terminal take panel
// (with a drawn stand-in until the take lands), the dead sun and the bracket corners. All frame-driven.
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Slot } from "../../../film/Slot";
import { Label, Mono } from "../../../ds/type";
import { EASE_OUT, stepped, T } from "../../../ds/tokens";

export const out = Easing.bezier(...EASE_OUT);
const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Clamped interpolate with optional easing. */
export const lin = (f: number, a: number, b: number, x = 0, y = 1, easing?: (t: number) => number) => interpolate(f, [a, b], [x, y], { ...cl, easing });
/** The terminal's print-in: steps(5) over 400 ms (12 f), from `at`. */
export const printIn = (f: number, at: number) => stepped(lin(f, at, at + 12), 5);
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
export const noise = hash;

/** A footage slot whose take starts playing (at `from` s) on scene frame `at`, not at the scene start. */
export function SlotAt({ at, ...p }: { at: number } & Parameters<typeof Slot>[0]) {
  return <Sequence from={at} layout="none"><Slot {...p} /></Sequence>;
}

/** The app's Dialup box (web/src/components/terminal/effects.tsx), 720 ms from `at`, drawn `s`× for the film. */
export function DialBox({ at, path, s = 2, x = 960, y = 540 }: { at: number; path: string; s?: number; x?: number; y?: number }) {
  const f = useCurrentFrame();
  const t = ((f - at) / 30) * 1000;
  if (t < 0 || t > 760) return null;
  const cmd = `$ ls-0001 open ${path}`;
  const typedCmd = cmd.slice(0, Math.floor(Math.min(1, t / 260) * cmd.length));
  const pct = Math.max(0, Math.min(100, Math.floor(((t - 420) / 280) * 8) * 12.5));
  const bar = "#".repeat(Math.round(pct / 10)).padEnd(10, "─");
  const fs = 12.5 * s;
  return (
    <div style={{ position: "absolute", left: x - 224 * s, top: y - 70 * s, width: 448 * s, boxSizing: "border-box", border: `1px solid ${T.line2}`,
      background: "rgba(25,20,46,0.94)", padding: 16 * s, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
      <Mono size={fs} color={T.gold} style={{ lineHeight: `${24 * s}px` }}>{typedCmd}{t < 260 && <span>█</span>}</Mono>
      <Mono size={fs} color={T.muted} style={{ lineHeight: `${24 * s}px`, opacity: t > 300 ? 1 : 0 }}>{"> resolving NEAR testnet ...... "}<span style={{ color: T.alive }}>ok</span></Mono>
      <Mono size={fs} color={T.muted} style={{ lineHeight: `${24 * s}px`, opacity: t > 380 ? 1 : 0 }}>{"> link 1200 baud ............. "}<span style={{ color: T.alive }}>ok</span></Mono>
      <Mono size={fs} color={T.muted} style={{ lineHeight: `${24 * s}px`, opacity: t > 420 ? 1 : 0 }}>{"> receiving ["}<span style={{ color: T.gold }}>{bar}</span>{`] ${pct} %`}</Mono>
    </div>
  );
}

/** A window that opens vertically (6 f, ease-out) at `open` and collapses like a CRT powering off at `close`
 * (scaleY → 0.006 over `dur` f, ease-in cubic, white bloom), leaving a fading line. */
export function CrtWindow({ open, close, dur = 8, x, y, w, h, tilt = 0, children, style }: {
  open: number; close: number; dur?: number; x: number; y: number; w: number; h: number; tilt?: number; children: ReactNode; style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  if (f < open || f > close + dur + 5) return null;
  const sy = f < close ? lin(f, open, open + 6, 0.02, 1, out) : lin(f, close, close + dur, 1, 0.006, Easing.in(Easing.cubic));
  const bloom = lin(f, close + dur * 0.75, close + dur, 0, 1) * lin(f, close + dur + 1, close + dur + 5, 1, 0);
  const lineOnly = f >= close + dur;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, perspective: 1600 }}>
      {!lineOnly && (
        <div style={{ position: "absolute", inset: 0, transform: `rotateX(${tilt}deg) scaleY(${sy})`, transformOrigin: "50% 50%", overflow: "hidden",
          filter: bloom > 0 ? `brightness(${1 + bloom * 1.4})` : undefined, ...style }}>
          {children}
        </div>
      )}
      {bloom > 0 && (
        <div style={{ position: "absolute", left: -40, right: -40, top: h / 2 - 2, height: 4, borderRadius: 2, background: "#fff4ee", opacity: bloom,
          boxShadow: "0 0 24px rgba(255,236,228,0.9), 0 0 60px rgba(255,201,74,0.35)" }} />
      )}
    </div>
  );
}

/** The app's SunEmblem in its dead state (as style frame A): a red banded sun the flatline runs through. */
export function DeadSun({ x, y, r, p }: { x: number; y: number; r: number; p: number }) {
  const bands = [62, 70, 77, 83, 88];
  return (
    <>
      <div style={{ position: "absolute", left: x - r * 1.4, top: y - r * 1.4, width: r * 2.8, height: r * 2.8, borderRadius: "50%", opacity: p * 0.45,
        background: "radial-gradient(circle, rgba(255,77,94,0.32), transparent 62%)" }} />
      <svg width={r * 2.6} height={r * 2.2} viewBox="0 0 240 200" style={{ position: "absolute", left: x - r * 1.3, top: y - r * 1.1, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
        <defs>
          <linearGradient id="g4sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a7a" /><stop offset="1" stopColor="#8f1d2c" /></linearGradient>
          <mask id="g4sunm"><rect width="240" height="200" fill="#fff" />{bands.map((b, i) => <rect key={b} x="0" y={b * 2 - 20} width="240" height={2 + i * 1.6} fill="#000" />)}</mask>
        </defs>
        <circle cx="120" cy="100" r="74" fill="url(#g4sun)" mask="url(#g4sunm)" />
      </svg>
    </>
  );
}

/** The app's .bracket corners (two L marks, top-left and bottom-right). */
export function Bracket({ color = T.ember, size = 18, wgt = 3 }: { color?: string; size?: number; wgt?: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: -wgt, top: -wgt, width: size, height: size, borderLeft: `${wgt}px solid ${color}`, borderTop: `${wgt}px solid ${color}` }} />
      <div style={{ position: "absolute", right: -wgt, bottom: -wgt, width: size, height: size, borderRight: `${wgt}px solid ${color}`, borderBottom: `${wgt}px solid ${color}` }} />
    </>
  );
}

/** A real time jump in the take, in small faint text (top-right of the region it labels). */
export function JumpLabel({ text, p }: { text: string; p: number }) {
  return <Label size={18} color={T.faint} style={{ position: "absolute", right: 28, top: 22, opacity: p, background: "rgba(10,8,20,0.72)", padding: "4px 10px", borderRadius: 3 }}>{text}</Label>;
}
