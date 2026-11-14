// A key line lifted off the glass as film type (coordinator legibility rule, 14 Nov): it starts at the take's own
// line (its position and size on screen), lifts and scales up over 9 f (ease-out) to its slot, then holds still on
// an ink plate. Rendered at frame level (outside any camera), so its size on screen is exactly what it's drawn at.
import type { ReactNode } from "react";
import { stepped, T } from "../../../ds/tokens";
import { Mono } from "../../../ds/type";
import { easeOut, lerp, prog } from "./motion";

export interface Pt { x: number; y: number }

/** `at` = land frame (lift starts); `from` = where the take shows the line (frame px) and its scale relative to `size`;
 * `out` = frame it steps out (optional). `accent` = plate edge. */
export function KeyLine({ f, at, from, fromScale, to, size = 56, accent = T.dead, out, children }: {
  f: number; at: number; from: Pt; fromScale: number; to: Pt; size?: number; accent?: string; out?: number; children: ReactNode;
}) {
  if (f < at) return null;
  const p = prog(f, at, at + 9, easeOut);
  const gone = out === undefined ? 0 : stepped(prog(f, out, out + 4), 2);
  if (gone >= 1) return null;
  const k = lerp(fromScale, 1, p);
  const pad = { x: 0.32 * size, y: 0.16 * size };
  return (
    <div style={{ position: "absolute", left: lerp(from.x, to.x, p) - pad.x * k, top: lerp(from.y, to.y, p) - pad.y * k, opacity: (1 - gone) * stepped(prog(f, at, at + 3), 3),
      transform: `scale(${k})`, transformOrigin: "0 0" }}>
      <div style={{ padding: `${pad.y}px ${pad.x}px`, background: "rgba(10,8,20,0.86)", borderLeft: `${Math.round(size / 10)}px solid ${accent}`,
        boxShadow: `0 ${20 * p}px ${44 * p}px rgba(0,0,0,${0.7 * p}), 0 0 ${36 * p}px ${accent}33` }}>
        <Mono size={size} style={{ lineHeight: 1.2 }}>{children}</Mono>
      </div>
    </div>
  );
}
