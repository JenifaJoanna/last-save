// Lifted film type (legibility pass): the one line that matters leaves the glass as a crisp panel in frame coords,
// ≥ 56 px, while everything behind it becomes texture (facts.ts TEXTURE). Rise 6 f ease-out with stepped opacity
// (the terminal's steps(5)), hold still, then step out.
import type { ReactNode } from "react";
import { interpolate } from "remotion";
import { stepped, T } from "../../../ds/tokens";
import { C, out } from "./kit";

/** 0..1 visibility: rises over `dur` frames from `at`, steps out over `dur` frames from `outAt`. */
export const liftShow = (f: number, at: number, outAt: number, dur = 6) =>
  interpolate(f, [at, at + dur], [0, 1], { ...C, easing: out }) * (1 - interpolate(f, [outAt, outAt + dur], [0, 1], C));

/** Filter + opacity for the layer behind a lift, at strength t (0..1). `scale` divides the blur when the layer is scaled. */
export const texture = (t: number, opacity = 0.4, blur = 3, scale = 1) =>
  t > 0.001 ? { opacity: 1 - (1 - opacity) * t, filter: `blur(${((blur * t) / scale).toFixed(2)}px)` } : {};

export function LiftCard({ x, y, show, edge = T.gold, glow = "rgba(255,201,74,0.22)", children }: {
  x: number; y: number; show: number; edge?: string; glow?: string; children: ReactNode;
}) {
  if (show <= 0.001) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: stepped(show, 5), whiteSpace: "nowrap",
      transform: `translate(-50%, -50%) translateY(${(1 - show) * 24}px) scale(${0.92 + 0.08 * show})`,
      background: T.ink2, border: `1px solid ${T.line2}`, borderLeft: `4px solid ${edge}`, padding: "20px 40px 22px 36px",
      boxShadow: `0 34px 70px -14px rgba(0,0,0,0.9), 0 0 44px ${glow}` }}>
      {children}
    </div>
  );
}
