// Shared pieces for S01–S03: the in-glass camera over ScreenFrame, the gold block caret, stepped print-in and timing helpers.
// Content coordinates are the ScreenFrame content rect (W × H); the camera scales the whole page about the screen centre.
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import { Camera, CONTENT, type Keys, ScreenFrame } from "../../../ds/screen";
import type { Mode } from "../../../ds/crt";
import { EASE_OUT, stepped, T } from "../../../ds/tokens";

export const W = CONTENT.w;
export const H = CONTENT.h;
/** Camera focus: the centre of the content rect in frame pixels. */
export const FX = CONTENT.x + W / 2;
export const FY = CONTENT.y + H / 2;
/** Scale at which the content rect fills the 1920×1080 frame with no chrome in view. */
export const IN_GLASS = 1.26;
/** S01 drifts +2.5 % inside the glass; S02 continues from here. */
export const S01_END_SCALE = 1.285;
/** Terminal body size and block caret, in content px, shared by S01 and S02 so the caret is identical at the seam. */
export const MONO = 27;
export const CW = MONO * 0.6;
export const CARET_H = Math.round(MONO * 1.18);
export const CARET_CENTER = { x: W / 2 - CW / 2, y: H / 2 - CARET_H / 2 };
/** The HOME screen's chrome (hint bar and primary keycap as in the app's home page). */
export const HOME_HINTS = ["1-6 choose", "↑↓ navigate", "Enter open", "M sound"];
export const HOME_KEYS: Keys = { primary: "Open 1" };

export const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(...EASE_OUT);
export const ramp = (f: number, a: number, b: number, ease?: (t: number) => number) => interpolate(f, [a, b], [0, 1], { ...cl, easing: ease });
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** The app's print-in: steps(5) over 400 ms (12 f), 14 px slide from the left, 55 ms (1.65 f) stagger per index. */
export function printIn(f: number, at: number, i = 0): CSSProperties {
  const p = stepped(ramp(f, at + i * 1.65, at + i * 1.65 + 12), 5);
  return { opacity: p, transform: `translateX(${(1 - p) * -14}px)` };
}
/** The app's caret blink: 1 s steps(2), dimming to 0.35 rather than off. */
export const blink = (f: number, since: number) => (Math.floor(Math.max(0, f - since) / 15) % 2 === 0 ? 1 : 0.35);

/** The LS-0001 page under a camera. scale ≥ IN_GLASS keeps the status bar and keycaps out of frame. */
export function Glass({ scale, title = "HOME", mode = "online", titleAt = -999, hints = HOME_HINTS, keys = HOME_KEYS, children }: {
  scale: number; title?: string; mode?: Mode; titleAt?: number; hints?: string[]; keys?: Keys; children?: ReactNode;
}) {
  return (
    <Camera scale={scale} fx={FX} fy={FY}>
      <ScreenFrame title={title} mode={mode} titleAt={titleAt} hints={hints} keys={keys}>{children}</ScreenFrame>
    </Camera>
  );
}

/** The gold block caret (█) drawn as a box so its size never depends on font fallback. */
export function GoldCaret({ x, y, w = CW, h = CARET_H, opacity = 1, color = T.gold, glow = 0.35 }: { x: number; y: number; w?: number; h?: number; opacity?: number; color?: string; glow?: number }) {
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: color, opacity, boxShadow: `0 0 ${Math.max(6, h * 0.3)}px rgba(255,201,74,${glow})` }} />;
}
