// Shared motion helpers for S11, S13 and S14 (scene group g5): word-anchored frames, eased ramps, stepped print-in,
// the dial-up box, the vertical channel roll and the lifted chip (an object that leaves the glass toward the camera).
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { EASE_OUT, stepped, T } from "../../../ds/tokens";
import { voFrame, type SceneId } from "../../../film/timeline";

export const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const out = Easing.bezier(...EASE_OUT);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Scene-relative frame of a narration word that starts `s` seconds into the scene's VO line. */
export const word = (id: SceneId, s: number) => voFrame(id) + Math.round(s * 30);
/** Eased 0..1 between frames a and b. */
export const ramp = (f: number, a: number, b: number, ease = out) => interpolate(f, [a, b], [0, 1], { ...c, easing: ease });
/** The app's print-in: steps(5) over 400 ms (12 f), starting at `start`. */
export const printIn = (f: number, start: number) => stepped(interpolate(f, [start, start + 12], [0, 1], c), 5);
/** A frame-hash for deterministic small motion. */
export const hash = (n: number) => { const x = Math.sin(n * 91.345 + 7.13) * 43758.5453; return x - Math.floor(x); };

/** Dial-up box: a small LS-0001 window that powers on (line → open), types a command, then fills a receive bar steps(8).
 * `f` is relative to the box's start. Total ≈ 22 f (720 ms) + 11 f load bar. */
export function DialUp({ f, cmd, width = 980, style }: { f: number; cmd: string; width?: number; style?: CSSProperties }) {
  const open = ramp(f, 0, 6);
  const typedN = Math.floor(interpolate(f, [5, 18], [0, cmd.length], c));
  const load = stepped(interpolate(f, [20, 31], [0, 1], c), 8);
  return (
    <div style={{ width, borderRadius: 14, background: T.bezel, padding: 8, border: "1px solid rgba(0,0,0,0.6)", boxSizing: "border-box",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 90px -30px rgba(0,0,0,0.95)", transform: `scaleY(${0.02 + 0.98 * open})`, ...style }}>
      <div style={{ borderRadius: 8, background: T.ink, overflow: "hidden" }}>
        <div style={{ height: 30, background: T.gold, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
          <Label size={13} color={T.statusInk}>LS-0001 · Dial-up</Label>
          <Label size={13} color={T.statusInk}>{load >= 1 ? "Connected" : "Connecting"}</Label>
        </div>
        <div style={{ padding: "22px 26px 24px" }}>
          <Mono size={28} color={T.text}><span style={{ color: T.gold }}>$ </span>{cmd.slice(0, typedN)}<span style={{ color: T.gold, opacity: Math.floor(f / 8) % 2 ? 0.2 : 1 }}>█</span></Mono>
          <div style={{ marginTop: 16, height: 10, background: "rgba(196,182,255,0.12)" }}>
            <div style={{ height: "100%", width: `${load * 100}%`, background: T.gold, boxShadow: "0 0 14px rgba(255,201,74,0.6)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Vertical channel roll (S06→07 grammar): returns the y offset (px) of the outgoing and incoming layers and the roll band
 * position, for a 10-frame roll that starts at `start`. Linear with stepped(5). */
export function roll(f: number, start: number, h = 1080) {
  const p = stepped(interpolate(f, [start, start + 10], [0, 1], c), 5);
  return { outY: -p * h, inY: (1 - p) * h, p, band: f >= start && f < start + 10 };
}
export function RollBand({ y }: { y: number }) {
  return <div style={{ position: "absolute", left: 0, right: 0, top: y - 3, height: 6, background: "rgba(239,229,208,0.35)", boxShadow: "0 0 18px rgba(239,229,208,0.4)" }} />;
}

/** A chip that has lifted off the screen: opaque ink plate, coloured edge, soft drop shadow growing with `lift` (0..1). */
export function LiftPlate({ children, lift, edge = T.alive, style }: { children: ReactNode; lift: number; edge?: string; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", background: T.ink, border: `1px solid ${T.line2}`, borderLeft: `4px solid ${edge}`, borderRadius: 6,
      boxShadow: `0 ${10 + 40 * lift}px ${30 + 60 * lift}px -${10 + 10 * lift}px rgba(0,0,0,${0.55 + 0.35 * lift}), 0 0 ${40 * lift}px ${edge}33`, ...style }}>
      {children}
    </div>
  );
}

/** Small Chakra tag (e.g. "Same progress") with a square marker, used above lifted crops. */
export function Tag({ children, color = T.gold, size = 22, style }: { children: ReactNode; color?: string; size?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "rgba(18,14,34,0.92)", border: `1px solid ${color}aa`, ...style }}>
      <span style={{ width: 10, height: 10, background: color }} />
      <Label size={size} color={color}>{children}</Label>
    </div>
  );
}
