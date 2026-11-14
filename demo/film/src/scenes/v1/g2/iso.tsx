// FrameC's isometric floor (frames/c/iso.tsx) with a variable orbit: Floor takes `spin`, and Billboards read it from
// context so tags keep facing the camera while it orbits (S12). Box, OnFloor, Grid and Tag are reused from frames/c.
import { createContext, type ReactNode, useContext } from "react";
import { HALF, SPIN, TILT } from "../../../frames/c/iso";

const P3 = { position: "absolute" as const, transformStyle: "preserve-3d" as const };
const SpinCtx = createContext(SPIN);
export interface Cam { tx: number; ty: number; s: number; spin?: number }

/** The floor: centres camera target (tx, ty) on screen, scaled by s, orbited by `spin` degrees (FrameC uses -45). */
export function Floor({ tx, ty, s, spin = SPIN, children }: Cam & { children: ReactNode }) {
  return (
    <SpinCtx.Provider value={spin}>
      <div style={{ ...P3, left: 960 - HALF, top: 560 - HALF, width: HALF * 2, height: HALF * 2, transformOrigin: "50% 50%",
        transform: `scale(${s}) rotateX(${TILT}deg) rotateZ(${spin}deg) translate(${-tx}px, ${-ty}px)` }}>
        {children}
      </div>
    </SpinCtx.Provider>
  );
}

/** A camera-facing plane anchored at floor point (x, y, z). */
export function Billboard({ x, y, z, children }: { x: number; y: number; z: number; children: ReactNode }) {
  const spin = useContext(SpinCtx);
  return (
    <div style={{ ...P3, left: HALF + x, top: HALF + y, width: 0, height: 0, transformOrigin: "0 0",
      transform: `translateZ(${z}px) rotateZ(${-spin}deg) rotateX(${-TILT}deg)` }}>
      {children}
    </div>
  );
}

/** Screen position (px) of floor point (x, y, z) under camera `cam`, for the perspective-7000 / origin 50% 45% stage. */
export function project(x: number, y: number, z: number, cam: Cam): { x: number; y: number; k: number } {
  const th = ((cam.spin ?? SPIN) * Math.PI) / 180;
  const ph = (TILT * Math.PI) / 180;
  const px = x - cam.tx, py = y - cam.ty;
  const rx = px * Math.cos(th) - py * Math.sin(th);
  const ry = px * Math.sin(th) + py * Math.cos(th);
  const Y = ry * Math.cos(ph) - z * Math.sin(ph);
  const Z = ry * Math.sin(ph) + z * Math.cos(ph);
  const X = rx * cam.s, Ys = Y * cam.s;
  const k = 7000 / (7000 - Z);
  return { x: 960 + X * k, y: 486 + (74 + Ys) * k, k: k * cam.s };
}
