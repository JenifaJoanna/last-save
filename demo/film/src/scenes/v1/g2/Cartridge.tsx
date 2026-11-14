// The server build cartridge (after frames/c/parts.tsx BuildBlock): a key-art slot on its top face, which the licence
// thumbnail slides into (S05), scrambles and takes a padlock stamp when encrypted, and turns gold and unlocked once
// released (S12). The front face carries the build hash (from facts.ts).
import { FONT, T } from "../../../ds/tokens";
import { decode } from "../../../ds/type";
import { Box } from "../../../frames/c/iso";
import { Padlock } from "../../../frames/c/parts";
import { KeyArt } from "./Licence";

export const CART = { w: 240, d: 240, h: 88 };
export const SLOT = { x: 16, y: 50, w: 208, h: 100 }; // key-art slot on the top face (face px)

export function OpenLock({ size = 40, color = T.gold }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="1.5" fill={color} fillOpacity={0.18} />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" /><path d="M12 14.5v3" />
    </svg>
  );
}

const GL = "ABCDEF0123456789#%&*+=<>/\\";
function Scramble({ frame, p }: { frame: number; p: number }) {
  const rows = Array.from({ length: 4 }, (_, r) => Array.from({ length: 13 }, (_, i) => GL[Math.floor(Math.abs(Math.sin((i + r * 17) * 12.9898 + Math.floor(frame / 2) * 3.1)) * 43758.5453) % GL.length]).join(""));
  return (
    <div style={{ position: "absolute", inset: 0, background: `rgba(18,14,34,${0.82 * p})`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
      fontFamily: FONT.mono, fontSize: 19, lineHeight: "22px", color: T.gold, opacity: p, letterSpacing: "0.06em" }}>
      {rows.map((r, i) => <div key={i}>{r}</div>)}
    </div>
  );
}

/** enc 0..1 encryption; gold 0..1 released look; art 0..1 key art present in the slot; hash shown on the front. */
export function Cartridge({ x, y, z, enc = 0, gold = 0, art = 1, frame, hash, opacity = 1 }: {
  x: number; y: number; z: number; enc?: number; gold?: number; art?: number; frame: number; hash: string; opacity?: number;
}) {
  const stamp = gold > 0 ? 0 : enc > 0.55 ? Math.min(1, (enc - 0.55) / 0.3) : 0;
  const stampScale = 1.7 - (0.7 * Math.floor(stamp * 4)) / 4;
  const scr = gold > 0 ? 0 : Math.min(1, enc * 1.8);
  const text = enc <= 0 || gold >= 1 ? hash : decode(hash, 1 - Math.min(1, enc * 1.6), frame);
  const edge = gold > 0 ? `rgba(255,201,74,${0.3 + 0.6 * gold})` : "rgba(196,182,255,0.30)";
  const bands = `linear-gradient(180deg, ${T.gold} 0 18%, transparent 18% 27%, ${T.ember} 27% 45%, transparent 45% 54%, ${T.magenta} 54% 72%, transparent 72% 81%, ${T.violet} 81% 100%)`;
  const goldBands = `linear-gradient(180deg, #fff1c4 0 18%, transparent 18% 27%, ${T.gold} 27% 45%, transparent 45% 54%, #ffb02e 54% 72%, transparent 72% 81%, ${T.ember2} 81% 100%)`;
  return (
    <Box x={x} y={y} z={z} {...CART} opacity={opacity} edgeColor={edge}
      top={{ fill: gold > 0 ? "#2a2140" : T.panel, style: gold > 0 ? { boxShadow: `inset 0 0 0 2px ${edge}, 0 0 ${40 * gold}px rgba(255,201,74,${0.35 * gold})` } : undefined, children: (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 38, background: gold > 0.5 ? goldBands : bands, opacity: 1 - 0.3 * stamp }} />
          <div style={{ position: "absolute", left: SLOT.x, top: SLOT.y, width: SLOT.w, height: SLOT.h, background: T.void, border: `1.5px solid ${gold > 0 ? T.gold : T.line2}`, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ opacity: art }}><KeyArt width={SLOT.w} height={SLOT.h} title={false} /></div>
            {scr > 0 && <Scramble frame={frame} p={scr} />}
          </div>
          {stamp > 0 && (
            <div style={{ position: "absolute", left: SLOT.x + SLOT.w / 2 - 31, top: SLOT.y + SLOT.h / 2 - 31, width: 62, height: 62, display: "grid", placeItems: "center", background: "rgba(10,8,20,0.9)",
              border: `2px solid ${T.gold}`, borderRadius: 6, transform: `scale(${stampScale})`, opacity: Math.min(1, stamp * 3), boxShadow: "0 0 18px rgba(255,201,74,0.45)" }}>
              <Padlock size={40} color={T.gold} />
            </div>
          )}
          {gold > 0 && (
            <div style={{ position: "absolute", right: 14, top: SLOT.y + SLOT.h + 8, opacity: gold }}><OpenLock size={34} /></div>
          )}
          <div style={{ position: "absolute", left: 18, top: 160, fontFamily: FONT.label, fontWeight: 600, fontSize: 13, letterSpacing: "0.18em", color: gold > 0 ? T.gold : T.faint }}>EMBER RIFT</div>
          <div style={{ position: "absolute", left: 18, top: 180, fontFamily: FONT.label, fontWeight: 700, fontSize: 21, letterSpacing: "0.14em", color: T.text }}>SERVER BUILD</div>
        </div>
      ) }}
      front={{ fill: gold > 0 ? "#2e2442" : "#221b3f", children: (
        <div style={{ position: "absolute", left: 14, top: 0, bottom: 0, display: "flex", alignItems: "center", fontFamily: FONT.mono, fontSize: 16, color: enc > 0 || gold > 0 ? T.gold : T.muted, whiteSpace: "pre" }}>{text}</div>
      ) }}
      left={{ fill: gold > 0 ? "#241c38" : "#191431" }}
    />
  );
}
