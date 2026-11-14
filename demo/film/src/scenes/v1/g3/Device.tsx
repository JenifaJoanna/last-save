// LS-0001 as a device in space (frame B construction), built from the same chrome as ScreenFrame so the pull-out is
// continuous: at p = 0 the bezel, screen, hint bar and keycaps sit exactly where ScreenFrame draws them (the app at 1x);
// at p = 1 the device floats at the frame-B 3/4 pose over Ember Rift's arena-planet. Children render in the screen.
import type { ReactNode } from "react";
import { AbsoluteFill, Freeze, Sequence, useCurrentFrame } from "remotion";
import { CrtLayers, Keycap, type Mode, StatusBar } from "../../../ds/crt";
import { Label } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { Embers, Nebula } from "../../../frames/b/Space";
import { lerp } from "./motion";

/** Frame-B pose at p = 1: scale, centre shift (px) and 3/4 rotation. */
export const POSE = { s: 0.68, dx: -150, dy: -40, ry: 16, rx: 5 } as const;

export function deviceTransform(p: number, float = 0) {
  return `translate(${POSE.dx * p}px, ${POSE.dy * p + float * p}px) scale(${lerp(1, POSE.s, p)}) rotateY(${POSE.ry * p}deg) rotateX(${POSE.rx * p}deg)`;
}

/** The bezel + screen + keycaps at their ScreenFrame positions (1920 x 1080 local space). `chrome` fades the bezel. */
export function DeviceFace({ title, mode = "online", children, chrome = 1, glow = 0 }: { title: string; mode?: Mode; children?: ReactNode; chrome?: number; glow?: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: 12, top: 60, right: 12, bottom: 64, borderRadius: 20, background: T.bezel, padding: 8, border: "1px solid rgba(0,0,0,0.6)", opacity: chrome,
        boxShadow: `inset -3px -3px 0 rgba(255,138,76,${0.32 * glow}), inset 0 1px 0 rgba(255,255,255,0.06), 0 60px 120px -40px rgba(0,0,0,${0.95 * glow}), 0 0 160px rgba(155,79,224,${0.14 * glow})` }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: T.ink, border: "1px solid rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
          <StatusBar title={title} mode={mode} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            {children}
            <CrtLayers />
            <div style={{ position: "absolute", inset: 0, opacity: glow, background: "linear-gradient(118deg, rgba(255,255,255,0.05) 0%, transparent 32%, transparent 70%, rgba(255,138,76,0.05) 100%)" }} />
          </div>
          <div style={{ height: 36, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 20, padding: "0 20px", flexShrink: 0 }}>
            {["S summary", "Esc back", "←/→ prev/next", "Enter run", "M sound"].map((h) => {
              const [k, ...rest] = h.split(" ");
              return <Label key={h} size={11} color={T.faint} track={0.12}><span style={{ color: T.gold, fontWeight: 700 }}>{k}</span> {rest.join(" ")}</Label>;
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", gap: 12, opacity: chrome }}>
        {["Summary", "Back", "◂ Prev", "Next ▸"].map((k) => <Keycap key={k}>{k}</Keycap>)}
      </div>
    </>
  );
}

/** The page header row of the web app (outside the device): fades out as the camera leaves the page. */
export function PageHeader({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 12, top: 12, right: 12, height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: T.alive }} />
        <Label size={13} color={T.text}>LS-0001</Label>
        <Label size={11} color={T.faint}>Last Save · transmission terminal</Label>
      </div>
      <Label size={11} color={T.gold} style={{ border: "1px solid rgba(255,201,74,0.7)", borderRadius: 5, padding: "9px 12px" }}>Sound: On</Label>
    </div>
  );
}

/** Embers on the film's absolute clock (`at` = the scene's first film frame), so they run on across scene seams. */
export function AbsEmbers({ at, count, seed }: { at: number; count: number; seed: number }) {
  return <Sequence from={-at} layout="none"><Embers count={count} seed={seed} /></Sequence>;
}

/** Space behind the device: void at p = 0 (the page), the frame-B nebula and embers by p = 1. The nebula is held at
 * its frame-B pose and drifts on the absolute clock. */
export function SpaceBack({ p, at }: { p: number; at: number }) {
  const f = useCurrentFrame() + at;
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <AbsoluteFill style={{ opacity: p, transform: `translate(${Math.sin(f / 90) * 10}px, ${Math.cos(f / 110) * 6}px)` }}><Freeze frame={60}><Nebula /></Freeze></AbsoluteFill>
      <AbsoluteFill style={{ opacity: p }}><AbsEmbers at={at} count={18} seed={5} /></AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Full device shot: space, the device at pose p, front embers and the lens vignette. */
export function DeviceShot({ p, at, title, mode, children, chrome = 1, over }: { p: number; at: number; title: string; mode?: Mode; children?: ReactNode; chrome?: number; over?: ReactNode }) {
  const f = useCurrentFrame() + at;
  const float = Math.sin(f / 34) * 4;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <SpaceBack p={p} at={at} />
      <PageHeader opacity={1 - p * 3} />
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 48%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d", transformOrigin: "960px 540px", transform: deviceTransform(p, float) }}>
          <DeviceFace title={title} mode={mode} glow={p} chrome={chrome}>{children}</DeviceFace>
          {over}
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: p }}><AbsEmbers at={at} count={10} seed={11} /></AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: "none", opacity: p, background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}
