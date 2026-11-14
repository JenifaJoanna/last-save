// Explorer flash (PLAN §5): a ~1-s window opens with the dial-up box (no URL bar), tilted slightly forward on z, shows
// the explorer take, then closes with a CRT collapse (scaleY → 0.006, ease-in cubic, then the line pinches out).
import { Easing, interpolate, Sequence } from "remotion";
import { Slot } from "../../../film/Slot";
import { T } from "../../../ds/tokens";
import { DialupBox } from "./Dialup";
import { CL, easeOut } from "./motion";

export interface Rect { x: number; y: number; w: number; h: number }
type Crop = { x: number; y: number; w: number; h: number };

/** `at`: scene frame the flash opens; `dur` frames (default 30). `rect` window in frame px. `crop` frames the take's key region. */
export function Flash({ f, at, dur = 30, slot, plate, path, crop, rect = { x: 260, y: 130, w: 1400, h: 788 }, tilt = 1, from = 0, dial = 13 }: {
  f: number; at: number; dur?: number; slot: string; plate?: string; path: string; crop?: Crop; rect?: Rect; tilt?: number; from?: number; dial?: number;
}) {
  const t = f - at;
  if (t < 0 || t >= dur) return null;
  const close = dur - 8;
  const sx = interpolate(t, [0, 2, close + 5, dur - 1], [0.35, 1, 1, 0.02], { ...CL, easing: easeOut });
  const sy = t < close ? interpolate(t, [1, 5], [0.008, 1], { ...CL, easing: easeOut }) : interpolate(t, [close, close + 5], [1, 0.006], { ...CL, easing: Easing.in(Easing.cubic) });
  const bloom = Math.max(interpolate(t, [0, 1, 3], [0.5, 0.3, 0], CL), interpolate(t, [close + 3, close + 5, dur], [0, 1, 0.4], CL));
  const dialing = t < dial; // dial-up box compressed into `dial` frames (13 = 1.8× speed), then the take
  const lift = interpolate(t, [0, 8], [0, 1], { ...CL, easing: easeOut });
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2200, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, transformStyle: "preserve-3d",
        transform: `translateZ(${40 * lift}px) rotateX(${4 * tilt}deg) rotateY(${-5 * tilt}deg) scale(${sx}, ${sy})` }}>
        <div style={{ position: "absolute", inset: -24, background: "rgba(0,0,0,0.55)", filter: "blur(30px)", transform: "translate(18px, 30px)", opacity: sy }} />
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: T.ink, border: `1px solid ${T.line2}`, borderRadius: 6 }}>
          <Sequence from={at + dial} layout="none">{!dialing && <Slot slot={slot} plate={plate} crop={crop} from={from} />}</Sequence>
          {dialing && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: T.ink }}>
              <DialupBox path={path} t={Math.max(0, t - 1)} k={Math.min(1.9, rect.w / 560)} speed={(1.8 * 13) / dial} />
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 10%, rgba(255,240,228,0.6) 42%, #fff4ee 50%, rgba(255,240,228,0.6) 58%, transparent 90%)",
            opacity: bloom, mixBlendMode: "screen" }} />
        </div>
        <div style={{ position: "absolute", left: -4, top: -4, width: 22, height: 22, borderLeft: `3px solid ${T.ember}`, borderTop: `3px solid ${T.ember}` }} />
        <div style={{ position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRight: `3px solid ${T.ember}`, borderBottom: `3px solid ${T.ember}` }} />
      </div>
    </div>
  );
}
