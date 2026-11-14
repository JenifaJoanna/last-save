// Isometric world helpers for style frame C: one floor plane in CSS 3D, extruded boxes built from faces, camera-facing
// billboards for tags, and floor-printed strips. Floor coords: x runs up-right on screen, y down-right, z up; (0,0) is
// the floor centre. Visible box faces from this camera: top, +y (front-right) and -x (front-left).
import type { CSSProperties, ReactNode } from "react";
import { FONT, T } from "../../ds/tokens";

export const TILT = 58;
export const SPIN = -45;
export const HALF = 1500; // floor half-size in px
const P3: CSSProperties = { position: "absolute", transformStyle: "preserve-3d" };

/** The floor: centres camera target (tx, ty) on screen, scaled by s. Children use floor coords via Box/Billboard/OnFloor. */
export function Floor({ tx, ty, s, children }: { tx: number; ty: number; s: number; children: ReactNode }) {
  return (
    <div style={{ ...P3, left: 960 - HALF, top: 560 - HALF, width: HALF * 2, height: HALF * 2, transformOrigin: "50% 50%",
      transform: `scale(${s}) rotateX(${TILT}deg) rotateZ(${SPIN}deg) translate(${-tx}px, ${-ty}px)` }}>
      {children}
    </div>
  );
}

/** Thin grid printed on the floor, fading out with distance from the camera target. */
export function Grid({ tx, ty }: { tx: number; ty: number }) {
  const at = `${HALF + tx}px ${HALF + ty}px`;
  const mask = `radial-gradient(circle at ${at}, black 0, black 700px, transparent 1350px)`;
  return (
    <div style={{ position: "absolute", inset: 0, WebkitMaskImage: mask, maskImage: mask,
      backgroundImage: `linear-gradient(90deg, rgba(196,182,255,0.16) 0 2px, transparent 2px 100%), linear-gradient(180deg, rgba(196,182,255,0.16) 0 2px, transparent 2px 100%),
        linear-gradient(90deg, rgba(196,182,255,0.07) 0 1px, transparent 1px 100%), linear-gradient(180deg, rgba(196,182,255,0.07) 0 1px, transparent 1px 100%)`,
      backgroundSize: "400px 400px, 400px 400px, 100px 100px, 100px 100px", backgroundPosition: `${HALF % 400}px ${HALF % 400}px` }} />
  );
}

/** Anything lying flat on the floor at (x, y) centre, w x d, lifted z (avoid z-fighting with the grid: z >= 1). */
export function OnFloor({ x, y, w, d, z = 1, rot = 0, children, style }: { x: number; y: number; w: number; d: number; z?: number; rot?: number; children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...P3, left: HALF + x - w / 2, top: HALF + y - d / 2, width: w, height: d, transform: `translateZ(${z}px) rotateZ(${rot}deg)`, ...style }}>{children}</div>;
}

type Face = { fill: string; children?: ReactNode; style?: CSSProperties };
const edge = (c: string) => ({ boxShadow: `inset 0 0 0 1.5px ${c}` });

/** Extruded box centred at (x, y), base at z. `all` draws the hidden faces too (for translucent boxes). */
export function Box({ x, y, z = 0, w, d, h, top, front, left, back, right, edgeColor = T.line2, all, opacity = 1 }: {
  x: number; y: number; z?: number; w: number; d: number; h: number; top: Face; front: Face; left: Face; back?: Face; right?: Face;
  edgeColor?: string; all?: boolean; opacity?: number;
}) {
  const face = (f: Face, s: CSSProperties) => (
    <div style={{ position: "absolute", background: f.fill, ...edge(edgeColor), overflow: "hidden", opacity, ...s, ...f.style }}>{f.children}</div>
  );
  return (
    <div style={{ ...P3, left: HALF + x - w / 2, top: HALF + y - d / 2, width: w, height: d, transform: `translateZ(${z}px)` }}>
      {all && back && face(back, { left: 0, top: 0, width: w, height: h, transformOrigin: "50% 0", transform: "rotateX(90deg)" })}
      {all && right && face(right, { left: w - h, top: 0, width: h, height: d, transformOrigin: "100% 0", transform: "rotateY(90deg)" })}
      {face(left, { left: 0, top: 0, width: h, height: d, transformOrigin: "0 0", transform: "rotateY(-90deg)" })}
      {face(front, { left: 0, top: d - h, width: w, height: h, transformOrigin: "50% 100%", transform: "rotateX(-90deg)" })}
      {face(top, { left: 0, top: 0, width: w, height: d, transform: `translateZ(${h}px)` })}
    </div>
  );
}

/** A camera-facing plane anchored at floor point (x, y, z). Children are placed in screen-space px around the anchor. */
export function Billboard({ x, y, z, children }: { x: number; y: number; z: number; children: ReactNode }) {
  return (
    <div style={{ ...P3, left: HALF + x, top: HALF + y, width: 0, height: 0, transformOrigin: "0 0",
      transform: `translateZ(${z}px) rotateZ(${-SPIN}deg) rotateX(${-TILT}deg)` }}>
      {children}
    </div>
  );
}

/** Qloo-style stacked tag on a stem: label (Chakra) + optional mono line, sitting `lift` px above its anchor. */
export function Tag({ label, sub, lift = 70, color = T.text, accent = T.line2, opacity = 1, side = "center", icon }: {
  label: string; sub?: ReactNode; lift?: number; color?: string; accent?: string; opacity?: number; side?: "center" | "left" | "right"; icon?: ReactNode;
}) {
  const tx = side === "center" ? "-50%" : side === "left" ? "calc(-100% + 14px)" : "-14px";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <div style={{ position: "absolute", left: -1, top: -lift, width: 2, height: lift, background: `linear-gradient(180deg, ${accent}, transparent)` }} />
      <div style={{ position: "absolute", left: 0, top: -lift, transform: `translate(${tx}, -100%)`, background: "rgba(18,14,34,0.94)", border: `1px solid ${accent}`,
        borderRadius: 4, padding: "10px 16px", whiteSpace: "nowrap", boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.label, fontWeight: 700, fontSize: 21, letterSpacing: "0.16em", textTransform: "uppercase", color }}>{icon}{label}</div>
        {sub && <div style={{ fontFamily: FONT.mono, fontSize: 16, color: T.muted, marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}
