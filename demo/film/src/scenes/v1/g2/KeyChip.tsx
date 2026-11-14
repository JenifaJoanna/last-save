// A proof key line lifted out of an explorer/terminal flash (S05): a tag-style chip in screen space whose key line is
// ≥ 56 px, held readable for ≥ 45 frames, that rides from the flash window to its anchor on the machine and then hands
// over to the machine's own (smaller) tag. Everything around it in the take stays texture.
import type { ReactNode } from "react";
import { interpolate } from "remotion";
import { FONT, stepped, T } from "../../../ds/tokens";
import { CL, easeOut, lerp } from "./motion";

export const KEY_PX = 60;   // key line size (≥ 56 px rendered: the chip is screen space, no camera scale)
export const KEY_HOLD = 46; // frames at full size (≥ 45)

/** `on`: frame the take appears (chip prints); `fly`: frame it leaves the window for the anchor; the chip shrinks and fades
 * from on + KEY_HOLD over 8 f. `from` / `to`: screen px of the chip's bottom-left (from) and bottom-centre stem point (to). */
export function KeyChip({ f, on, fly, from, to, label, accent, children }: {
  f: number; on: number; fly: number; from: { x: number; y: number }; to: { x: number; y: number }; label: string; accent: string; children: ReactNode;
}) {
  const end = on + KEY_HOLD;
  if (f < on || f >= end + 8) return null;
  const p = stepped(interpolate(f, [on, on + 6], [0, 1], CL), 5);
  const m = interpolate(f, [fly, fly + 12], [0, 1], { ...CL, easing: easeOut });
  const out = interpolate(f, [end, end + 8], [0, 1], CL);
  const x = lerp(from.x, to.x, m), y = lerp(from.y, to.y, m) - Math.sin(Math.PI * m) * 30;
  const anchor = lerp(0, 50, m); // translateX %: bottom-left in the window → centred on its stem at the anchor
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: p * (1 - out), transform: `translate(${-anchor}%, -100%) scale(${1 - 0.45 * out})`, transformOrigin: "50% 100%" }}>
      <div style={{ background: "rgba(18,14,34,0.96)", border: `1.5px solid ${accent}`, borderRadius: 4, padding: "14px 22px 12px", whiteSpace: "nowrap",
        boxShadow: `0 ${18 + 14 * Math.sin(Math.PI * m)}px 50px rgba(0,0,0,0.6), 0 0 30px ${accent}33` }}>
        <div style={{ fontFamily: FONT.label, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}>{label}</div>
        <div style={{ fontFamily: FONT.mono, fontWeight: 600, fontSize: KEY_PX, lineHeight: `${KEY_PX * 1.15}px`, color: T.text, marginTop: 2 }}>{children}</div>
      </div>
      <div style={{ position: "absolute", left: `${anchor}%`, bottom: -40 * m, width: 2, height: 40 * m, background: `linear-gradient(180deg, ${accent}, transparent)` }} />
    </div>
  );
}
