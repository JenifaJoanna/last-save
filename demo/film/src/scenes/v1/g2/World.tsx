// The B world shared by S04 (pull back, lift) and S05 (first 24 f, through the glass): Ember Rift's nebula and embers
// driven by the absolute film frame (continuous across the S04→S05 seam), the LS-0001 page (src/ds/screen.tsx
// ScreenFrame, copied with a transparent page so it can float in space) and the 3D pull from full frame to FrameB's
// 3/4 device pose.
import type { ReactNode } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { CrtLayers, Keycap, type Mode, StatusBar } from "../../../ds/crt";
import { Label } from "../../../ds/type";
import { T } from "../../../ds/tokens";

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const LED: Record<Mode, string> = { online: T.alive, probing: T.amber, dead: T.dead, released: T.gold };

/** Arena far behind like a planet (frames/b/Space Nebula), drifting on the absolute frame `g`. */
export function Nebula({ g, opacity = 1 }: { g: number; opacity?: number }) {
  const width = 1700, h = (width * 816) / 1456, d = Math.sin(g / 420);
  return (
    <AbsoluteFill style={{ opacity, background: `radial-gradient(55% 60% at 78% 80%, rgba(155,79,224,0.26), transparent 70%),
      radial-gradient(35% 40% at 70% 92%, rgba(232,64,126,0.18), transparent 70%), radial-gradient(30% 30% at 12% 18%, rgba(255,107,43,0.06), transparent 70%), ${T.void}` }}>
      <div style={{ position: "absolute", left: 1460 - width / 2, top: 790 - h / 2, width, height: h, transform: `translate(${d * -14}px, ${d * -6}px) rotate(${-4 + d * 1.2}deg)`,
        WebkitMaskImage: "radial-gradient(48% 50% at 50% 52%, #000 30%, transparent 72%)", maskImage: "radial-gradient(48% 50% at 50% 52%, #000 30%, transparent 72%)" }}>
        <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(9px) brightness(0.62) saturate(1.15)", opacity: 0.78 }} />
      </div>
    </AbsoluteFill>
  );
}

/** Rising embers (frames/b/Space Embers) on the absolute frame `g`. */
export function Embers({ g, count = 18, seed = 5, opacity = 1 }: { g: number; count?: number; seed?: number; opacity?: number }) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const near = hash(i + seed * 17), size = 1.5 + near * 4, speed = 0.25 + near * 0.9;
        const x = hash(i * 3.1 + seed) * 1920 + Math.sin((g + i * 20) / 38) * (6 + near * 10);
        const y = (((hash(i * 7.7 + seed) * 1240 - g * speed) % 1240) + 1240) % 1240 - 80;
        const flick = 0.45 + 0.55 * Math.abs(Math.sin((g + i * 13) / (9 + near * 7)));
        const col = near > 0.6 ? T.gold : near > 0.3 ? T.ember2 : T.magenta;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size, background: col,
          opacity: (0.25 + near * 0.6) * flick, boxShadow: `0 0 ${size * 3}px ${col}`, filter: near < 0.25 ? "blur(1.2px)" : undefined }} />;
      })}
    </AbsoluteFill>
  );
}

/** ScreenFrame (src/ds/screen.tsx) with a transparent page: header row fades with `header`. Content rect x 21, y 102. */
export function Page({ title, mode = "online", titleAt = -999, header = 1, primary, pressed, children, overlay }: {
  title: string; mode?: Mode; titleAt?: number; header?: number; primary?: string; pressed?: boolean; children?: ReactNode; overlay?: ReactNode;
}) {
  const fr = useCurrentFrame();
  const decodeP = Math.min(1, Math.max(0, (fr - titleAt) / Math.max(1, title.length * 0.75)));
  const blink = Math.floor(fr / 36) % 2 === 0;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 12, top: 12, right: 12, height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", opacity: header }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: LED[mode], opacity: blink ? 1 : 0.35 }} />
          <Label size={13} color={T.text}>LS-0001</Label>
          <Label size={11} color={T.faint}>Last Save · transmission terminal</Label>
        </div>
        <Label size={11} color={T.gold} style={{ border: "1px solid rgba(255,201,74,0.7)", borderRadius: 5, padding: "9px 12px" }}>Sound: On</Label>
      </div>
      <div style={{ position: "absolute", left: 12, top: 60, right: 12, bottom: 64, borderRadius: 20, background: T.bezel, padding: 8, border: "1px solid rgba(0,0,0,0.6)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset -3px -3px 0 rgba(255,138,76,0.18), 0 18px 50px -20px rgba(0,0,0,0.9), 0 0 160px rgba(155,79,224,0.10)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: T.ink, border: "1px solid rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
          <StatusBar title={title} mode={mode} decodeP={decodeP} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>{children}<CrtLayers /></div>
          <div style={{ height: 36, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 20, padding: "0 20px", flexShrink: 0 }}>
            {["S summary", "Esc back", "←/→ prev/next", "Enter run", "M sound"].map((h) => {
              const [k, ...rest] = h.split(" ");
              return <Label key={h} size={11} color={T.faint} track={0.12}><span style={{ color: T.gold, fontWeight: 700 }}>{k}</span> {rest.join(" ")}</Label>;
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", gap: 12 }}>
        {["Summary", "Back", "◂ Prev", "Next ▸"].map((k) => <Keycap key={k}>{k}</Keycap>)}
        {primary && <Keycap primary press={pressed ? 1 : 0}>{primary}</Keycap>}
      </div>
      {overlay}
    </AbsoluteFill>
  );
}

/** FrameB's 3/4 device pose as a pull from full frame: p 0 = the page fills the frame (identical to ScreenFrame),
 * p 1 = device left of centre, rotateY 16°, rotateX 5°. `dim` 0..1 darkens and defocuses it behind the card. */
export const PULLED = { x: -250, y: -46, s: 0.62, ry: 16, rx: 5 };
export function DevicePull({ p, dim = 0, g, children }: { p: number; dim?: number; g: number; children: ReactNode }) {
  const float = Math.sin(g / 34) * 4 * p;
  return (
    <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 48%" }}>
      <AbsoluteFill style={{ transformOrigin: "960px 540px", filter: dim > 0 ? `brightness(${1 - 0.6 * dim}) blur(${(2.2 * dim).toFixed(2)}px)` : undefined,
        transform: `translate(${PULLED.x * p}px, ${PULLED.y * p + float}px) scale(${1 - (1 - PULLED.s) * p}) rotateY(${PULLED.ry * p}deg) rotateX(${PULLED.rx * p}deg)` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
