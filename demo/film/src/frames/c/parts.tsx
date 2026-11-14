// Objects of the "machine" world: the server build cartridge, its plinths, floor tracks, the enclave cube and the key.
import { FONT, T } from "../../ds/tokens";
import { decode } from "../../ds/type";
import { Box, OnFloor } from "./iso";

export const BLOCK = { w: 210, d: 210, h: 84 };
export const PAD_H = 22;
const HASH = "sha256 7ee9918d…fe04";

export function Padlock({ size = 64, color = T.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="1.5" fill={color} fillOpacity={0.12} />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="M12 14.5v3" />
    </svg>
  );
}

export function KeyGlyph({ size = 120 }: { size?: number }) {
  return (
    <svg width={size * 0.5} height={size} viewBox="0 0 24 48" fill="none" style={{ filter: `drop-shadow(0 0 14px ${T.gold}) drop-shadow(0 0 4px ${T.gold})` }}>
      <circle cx="12" cy="9" r="7" stroke={T.gold} strokeWidth="3.2" />
      <path d="M12 16v28M12 34h6M12 40h4.5" stroke={T.gold} strokeWidth="3.2" strokeLinecap="square" />
    </svg>
  );
}

/** The cartridge: sunset-banded label on top, mono hash on the front face. `enc` 0..1 = encryption progress. */
export function BuildBlock({ x, y, z, enc, frame, opacity = 1 }: { x: number; y: number; z: number; enc: number; frame: number; opacity?: number }) {
  const stamp = enc > 0.55 ? Math.min(1, (enc - 0.55) / 0.3) : 0;
  const stampScale = 1.7 - 0.7 * Math.floor(stamp * 4) / 4; // stepped stamp-down, like the terminal's steps()
  const hash = enc <= 0 ? HASH : decode(HASH, 1 - Math.min(1, enc * 1.6), frame);
  return (
    <Box x={x} y={y} z={z} {...BLOCK} opacity={opacity} edgeColor="rgba(196,182,255,0.30)"
      top={{ fill: T.panel, children: (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 70, background: `linear-gradient(180deg, ${T.gold} 0 18%, transparent 18% 27%, ${T.ember} 27% 45%, transparent 45% 54%, ${T.magenta} 54% 72%, transparent 72% 81%, ${T.violet} 81% 100%)`, opacity: 1 - 0.35 * stamp }} />
          <div style={{ position: "absolute", left: 18, bottom: 18, fontFamily: FONT.label, fontWeight: 700, fontSize: 20, letterSpacing: "0.14em", color: T.text }}>SERVER BUILD</div>
          <div style={{ position: "absolute", left: 18, bottom: 46, fontFamily: FONT.label, fontWeight: 600, fontSize: 13, letterSpacing: "0.18em", color: T.faint }}>EMBER RIFT</div>
          {stamp > 0 && (
            <div style={{ position: "absolute", right: 16, top: 74, width: 58, height: 58, display: "grid", placeItems: "center", background: "rgba(10,8,20,0.85)",
              border: `2px solid ${T.gold}`, borderRadius: 6, transform: `scale(${stampScale})`, opacity: Math.min(1, stamp * 3), boxShadow: `0 0 18px rgba(255,201,74,0.45)` }}>
              <Padlock size={38} color={T.gold} />
            </div>
          )}
        </div>
      ) }}
      front={{ fill: "#221b3f", children: (
        <div style={{ position: "absolute", left: 14, top: 0, bottom: 0, display: "flex", alignItems: "center", fontFamily: FONT.mono, fontSize: 15, color: enc > 0 ? T.gold : T.muted, whiteSpace: "pre" }}>{hash}</div>
      ) }}
      left={{ fill: "#191431" }}
    />
  );
}

export function Plinth({ x, y, lit }: { x: number; y: number; lit: number }) {
  const w = 270;
  return (
    <Box x={x} y={y} w={w} d={w} h={PAD_H} edgeColor={`rgba(255,201,74,${0.18 + 0.5 * lit})`}
      top={{ fill: T.ink2, children: <div style={{ position: "absolute", inset: 10, border: `1px dashed rgba(196,182,255,${0.18 + 0.2 * lit})`, borderRadius: 3 }} /> }}
      front={{ fill: "#1a1530" }} left={{ fill: "#15112a" }} />
  );
}

/** A floor track from (x0,y0) to (x1,y1) along one floor axis; `p` 0..1 lights it ember→gold behind the moving copy. */
export function Track({ x0, y0, x1, y1, p }: { x0: number; y0: number; x1: number; y1: number; p: number }) {
  const horiz = y0 === y1;
  const len = Math.abs(horiz ? x1 - x0 : y1 - y0);
  const w = horiz ? len : 10;
  const d = horiz ? 10 : len;
  const fill = `linear-gradient(${horiz ? 90 : 180}deg, ${T.ember}, ${T.gold} ${p * 100}%, rgba(196,182,255,0.14) ${p * 100}%)`;
  return (
    <OnFloor x={(x0 + x1) / 2} y={(y0 + y1) / 2} w={w} d={d} z={2}>
      <div style={{ position: "absolute", inset: 0, background: fill, borderRadius: 5, boxShadow: p > 0 ? `0 0 16px rgba(255,107,43,${0.35 * Math.min(1, p * 2)})` : undefined }} />
    </OnFloor>
  );
}

export const ENC = { x: 300, y: 300, s: 280 };

/** The OutLayer enclave: a translucent cyan cube; `glow` 0..1 when the key enters. */
export function Enclave({ glow }: { glow: number }) {
  const glass = `rgba(79,216,208,${0.07 + 0.08 * glow})`;
  const ec = `rgba(79,216,208,${0.55 + 0.35 * glow})`;
  return (
    <Box x={ENC.x} y={ENC.y} w={ENC.s} d={ENC.s} h={ENC.s} all edgeColor={ec}
      top={{ fill: glass, children: <div style={{ position: "absolute", inset: 40, border: `2px solid rgba(79,216,208,${0.25 + 0.6 * glow})`, borderRadius: "50%", boxShadow: `0 0 ${30 * glow}px rgba(79,216,208,0.8)` }} /> }}
      front={{ fill: glass }} left={{ fill: glass }} back={{ fill: "rgba(79,216,208,0.04)" }} right={{ fill: "rgba(79,216,208,0.04)" }} />
  );
}
