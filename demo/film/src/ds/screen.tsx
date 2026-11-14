// The whole LS-0001 page as the app draws it at 1920×1080 (web/src/components/terminal/Terminal.tsx at 1x): header row,
// bezel, status bar, content, hint bar, keycap bar. Real takes are full-page captures of the same layout, so a motion
// scene drawn in ScreenFrame and a take cut together with identical chrome. Content rect: CONTENT (x 21–1899, y 102–970).
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CrtLayers, Keycap, type Mode, StatusBar } from "./crt";
import { Label } from "./type";
import { T } from "./tokens";

export const CONTENT = { x: 21, y: 102, w: 1878, h: 868 } as const;
const LED: Record<Mode, string> = { online: T.alive, probing: T.amber, dead: T.dead, released: T.gold };

export interface Keys { primary?: string; pressed?: string | null }

/** `titleAt`: frame (scene-relative) when the status title last changed, so it decodes 25 ms per char from there. */
export function ScreenFrame({ title, mode = "online", titleAt = -999, keys, hints = ["S summary", "Esc back", "←/→ prev/next", "Enter run", "M sound"], roll, children }: {
  title: string; mode?: Mode; titleAt?: number; keys?: Keys; hints?: string[]; roll?: number; children?: ReactNode;
}) {
  const fr = useCurrentFrame();
  const decodeP = Math.min(1, Math.max(0, (fr - titleAt) / Math.max(1, title.length * 0.75)));
  const blink = Math.floor(fr / 36) % 2 === 0; // LED 2400 ms steps(2)
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <div style={{ position: "absolute", left: 12, top: 12, right: 12, height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: LED[mode], opacity: blink ? 1 : 0.35 }} />
          <Label size={13} color={T.text}>LS-0001</Label>
          <Label size={11} color={T.faint}>Last Save · transmission terminal</Label>
        </div>
        <Label size={11} color={T.gold} style={{ border: `1px solid rgba(255,201,74,0.7)`, borderRadius: 5, padding: "9px 12px" }}>Sound: On</Label>
      </div>
      <div style={{ position: "absolute", left: 12, top: 60, right: 12, bottom: 64, borderRadius: 20, background: T.bezel, padding: 8, border: "1px solid rgba(0,0,0,0.6)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 50px -20px rgba(0,0,0,0.9)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: T.ink, border: "1px solid rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
          <StatusBar title={title} mode={mode} decodeP={decodeP} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            {children}
            <CrtLayers roll={roll} />
          </div>
          <div style={{ height: 36, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 20, padding: "0 20px", flexShrink: 0 }}>
            {hints.map((h) => {
              const [k, ...rest] = h.split(" ");
              return <Label key={h} size={11} color={T.faint} track={0.12}><span style={{ color: T.gold, fontWeight: 700 }}>{k}</span> {rest.join(" ")}</Label>;
            })}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", gap: 12 }}>
        {["Summary", "Back", "◂ Prev", "Next ▸"].map((k) => <Keycap key={k} press={keys?.pressed === k ? 1 : 0}>{k}</Keycap>)}
        {keys?.primary && <Keycap primary press={keys.pressed === keys.primary ? 1 : 0}>{keys.primary}</Keycap>}
      </div>
    </AbsoluteFill>
  );
}

/** Camera over a full 1920×1080 frame: scale about a focus point (px). Use to push into the content for legibility. */
export function Camera({ scale = 1, fx = 960, fy = 540, x = 0, y = 0, children }: { scale?: number; fx?: number; fy?: number; x?: number; y?: number; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: `${fx}px ${fy}px` }}>{children}</AbsoluteFill>
  );
}
