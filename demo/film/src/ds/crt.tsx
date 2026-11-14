// The LS-0001 terminal as film objects: the bezel, the CRT screen layers (scanlines, grain, vignette, roll), the
// status bar and keycaps. Measurements follow web/src/components/terminal (bezel radius 20, screen radius 14, status 32 px
// at 1x; everything here scales with `k`).
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { decode, Label } from "./type";
import { FONT, T } from "./tokens";

export type Mode = "online" | "probing" | "dead" | "released";
const BAR: Record<Mode, string> = { online: T.ember, probing: T.amber, dead: T.dead, released: T.gold };
const MODE_TEXT: Record<Mode, string> = { online: "Online", probing: "Probing", dead: "Dead", released: "Released" };
const MODE_INK: Record<Mode, string> = { online: "#0d3b22", probing: "#4a2a00", dead: "#4a0610", released: "#3d2a00" };

/** Scanlines, film grain (seeded per frame, stepped like the app's steps(8)), vignette, optional rolling bar. */
export function CrtLayers({ k = 1, roll, grain = 0.07, radius = 0 }: { k?: number; roll?: number; grain?: number; radius?: number }) {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 3) % 8;
  return (
    <>
      <AbsoluteFill style={{ pointerEvents: "none", background: `repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0 ${k}px, transparent ${k}px ${3 * k}px)`, mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: grain, mixBlendMode: "screen" }}>
        <svg width="100%" height="100%"><filter id={`g${seed}`}><feTurbulence type="fractalNoise" baseFrequency={0.85 / k} numOctaves={2} seed={seed} stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter={`url(#g${seed})`} /></svg>
      </AbsoluteFill>
      {roll !== undefined && (
        <div style={{ position: "absolute", left: 0, right: 0, height: "22%", top: `${-24 + roll * 128}%`, pointerEvents: "none",
          background: "linear-gradient(180deg, transparent, rgba(239,229,208,0.035) 45%, rgba(239,229,208,0.06) 50%, transparent)" }} />
      )}
      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 ${120 * k}px rgba(0,0,0,0.55)`, borderRadius: radius }} />
    </>
  );
}

/** The ember status bar: left id, centred decoding title, right clock · mode. `decodeP` drives the title decode (1 = resolved). */
export function StatusBar({ title, mode = "online", k = 1, decodeP = 1, clock = "14:40" }: { title: string; mode?: Mode; k?: number; decodeP?: number; clock?: string }) {
  const f = useCurrentFrame();
  return (
    <div style={{ height: 32 * k, background: BAR[mode], color: T.statusInk, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: `0 ${20 * k}px`, flexShrink: 0 }}>
      <Label size={11 * k} color={T.statusInk}>LS-0001 · Terminal</Label>
      <Label size={12 * k} color={T.statusInk}>{decode(title.toUpperCase(), decodeP, f)}</Label>
      <Label size={11 * k} color={T.statusInk} style={{ justifySelf: "end" }}>{clock} · <span style={{ color: MODE_INK[mode] }}>{MODE_TEXT[mode]}</span></Label>
    </div>
  );
}

/** Bezel + CRT screen. Children render inside the screen, under the CRT layers. Size in px of the outer bezel. */
export function Terminal({ width, height, k = 1, title, mode = "online", decodeP = 1, children, style, hints = true }: {
  width: number; height: number; k?: number; title: string; mode?: Mode; decodeP?: number; children?: ReactNode; style?: CSSProperties; hints?: boolean;
}) {
  return (
    <div style={{ width, height, borderRadius: 20 * k, background: T.bezel, padding: 8 * k, border: "1px solid rgba(0,0,0,0.6)", boxSizing: "border-box",
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 ${18 * k}px ${50 * k}px ${-20 * k}px rgba(0,0,0,0.9)`, ...style }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14 * k, overflow: "hidden", background: T.ink, border: "1px solid rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
        <StatusBar title={title} mode={mode} k={k} decodeP={decodeP} />
        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          {children}
          <CrtLayers k={k} />
        </div>
        {hints && (
          <div style={{ height: 36 * k, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 20 * k, padding: `0 ${20 * k}px`, flexShrink: 0 }}>
            {["S summary", "Esc back", "←/→ prev/next", "Enter run", "M sound"].map((h) => {
              const [key, ...rest] = h.split(" ");
              return <Label key={h} size={11 * k} color={T.faint} track={0.12}><span style={{ color: T.gold, fontWeight: 700 }}>{key}</span> {rest.join(" ")}</Label>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** A keycap (.keycap / .keycap-primary). `press` 0..1 sinks it 3 px * k like the app's 60 ms press. */
export function Keycap({ children, primary, k = 1, press = 0, style }: { children: ReactNode; primary?: boolean; k?: number; press?: number; style?: CSSProperties }) {
  const edge = primary ? "#8f3311" : "#5e5578";
  const d = 3 * k * press;
  return (
    <div style={{ background: primary ? T.ember : T.key, color: primary ? T.statusInk : T.keyInk, fontFamily: FONT.label, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.12em", fontSize: 12 * k, height: 36 * k, padding: `0 ${18 * k}px`, borderRadius: 5 * k, display: "inline-flex", alignItems: "center",
      transform: `translateY(${d}px)`, boxShadow: `0 ${4 * k - d}px 0 ${edge}, 0 ${5 * k - d}px 0 #05040a`, whiteSpace: "nowrap", ...style }}>
      {children}
    </div>
  );
}

/** The void the terminal lives in: app background with an Ember Rift nebula glow (violet/magenta) low and to one side. */
export function Void({ glowX = 70, glowY = 85, intensity = 1 }: { glowX?: number; glowY?: number; intensity?: number }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(60% 55% at ${glowX}% ${glowY}%, rgba(155,79,224,${0.22 * intensity}), transparent 70%),
      radial-gradient(40% 35% at ${glowX - 8}% ${glowY + 6}%, rgba(232,64,126,${0.16 * intensity}), transparent 70%), ${T.void}` }} />
  );
}
