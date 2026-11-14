// LS-0001 as a device: a copy of ds/screen.tsx ScreenFrame (same chrome at 1x, so S16's last frame matches) with the
// page's void background and header row as a fading `backdrop`, so the device can float in Ember Rift's space (S17).
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CrtLayers, Keycap, type Mode, StatusBar } from "../../../ds/crt";
import { Label } from "../../../ds/type";
import { T } from "../../../ds/tokens";

const LED: Record<Mode, string> = { online: T.alive, probing: T.amber, dead: T.dead, released: T.gold };

export function DeviceFrame({ title, mode = "released", primary, backdrop = 1, children }: { title: string; mode?: Mode; primary?: string; backdrop?: number; children?: ReactNode }) {
  const fr = useCurrentFrame();
  const blink = Math.floor(fr / 36) % 2 === 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: T.void, opacity: backdrop }} />
      <div style={{ position: "absolute", left: 12, top: 12, right: 12, height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", opacity: backdrop }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: LED[mode], opacity: blink ? 1 : 0.35 }} />
          <Label size={13} color={T.text}>LS-0001</Label>
          <Label size={11} color={T.faint}>Last Save · transmission terminal</Label>
        </div>
        <Label size={11} color={T.gold} style={{ border: "1px solid rgba(255,201,74,0.7)", borderRadius: 5, padding: "9px 12px" }}>Sound: On</Label>
      </div>
      <div style={{ position: "absolute", left: 12, top: 60, right: 12, bottom: 64, borderRadius: 20, background: T.bezel, padding: 8, border: "1px solid rgba(0,0,0,0.6)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), inset -3px -3px 0 rgba(255,138,76,${0.32 * (1 - backdrop)}), 0 18px 50px -20px rgba(0,0,0,0.9), 0 60px 160px -40px rgba(0,0,0,${0.95 * (1 - backdrop)}), 0 0 220px rgba(155,79,224,${0.16 * (1 - backdrop)})` }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 14, overflow: "hidden", background: T.ink, border: "1px solid rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
          <StatusBar title={title} mode={mode} />
          <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
            {children}
            <CrtLayers />
            <AbsoluteFill style={{ background: "linear-gradient(118deg, rgba(255,255,255,0.05) 0%, transparent 32%, transparent 70%, rgba(255,138,76,0.05) 100%)", opacity: 1 - backdrop }} />
          </div>
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
        {primary && <Keycap primary>{primary}</Keycap>}
      </div>
    </AbsoluteFill>
  );
}
