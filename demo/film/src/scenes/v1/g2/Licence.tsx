// The licence card (copied from frames/b/Licence.tsx and extended for S04/S05): string licence number (TBD until the
// judge run), the royalty line that prints on "royalty", the 10-segment split bar whose 4 gold segments light on
// "forty percent", and a band dissolve + detachable key-art thumbnail for the S04→S05 seam.
import { Img, staticFile } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { FONT, T } from "../../../ds/tokens";
import { CONFIG } from "./facts";

export const CARD_W = 620;
export const CARD_H = 432;
export const ART_H = 178;

function Bracket({ corner }: { corner: "tl" | "br" }) {
  const s = { position: "absolute" as const, width: 22, height: 22 };
  const b = `3px solid ${T.ember}`;
  return corner === "tl"
    ? <div style={{ ...s, left: -2, top: -2, borderLeft: b, borderTop: b, borderTopLeftRadius: 8 }} />
    : <div style={{ ...s, right: -2, bottom: -2, borderRight: b, borderBottom: b, borderBottomRightRadius: 8 }} />;
}

/** The key art with its title, as on the card's top band. Used alone as the flying thumbnail in S05. */
export function KeyArt({ width = CARD_W, height = ART_H, title = true }: { width?: number; height?: number; title?: boolean }) {
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden" }}>
      <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(18,14,34,0) 40%, rgba(24,18,45,0.92) 100%)" }} />
      {title && <div style={{ position: "absolute", left: 24, bottom: 12, fontFamily: FONT.display, fontStretch: "125%", fontWeight: 900, fontSize: 40, lineHeight: "40px",
        color: T.text, textTransform: "uppercase", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>Ember Rift</div>}
    </div>
  );
}

/** fill 0..1 lights the 4 gold segments (stepped); royalty 0..1 prints the royalty line; dissolve 0..1 shreds the card along
 * horizontal bands; art 0..1 is the key-art band's opacity (0 once the thumbnail has left the card). */
export function LicenceCard({ number, fill = 0, royalty = 0, gloss = 0.5, glow = 1, dissolve = 0, art = 1 }: {
  number: string; fill?: number; royalty?: number; gloss?: number; glow?: number; dissolve?: number; art?: number;
}) {
  const lit = Math.floor(Math.min(1, Math.max(0, fill)) * 4 + 1e-6);
  const band = Math.round(16 * (1 - Math.min(1, dissolve)));
  const mask = dissolve > 0 ? `repeating-linear-gradient(180deg, #000 0 ${band}px, transparent ${band}px 16px)` : undefined;
  const r = Math.min(1, Math.max(0, royalty));
  return (
    <div style={{ position: "relative", width: CARD_W, height: CARD_H, transformStyle: "preserve-3d", WebkitMaskImage: mask, maskImage: mask }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "#0b0817", transform: "translateZ(-7px)", border: "1px solid rgba(0,0,0,0.8)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${T.line2}`,
        background: "linear-gradient(165deg, #251d42 0%, #18122d 55%, #120e22 100%)",
        boxShadow: `0 0 ${46 * glow}px rgba(255,201,74,${0.22 * glow}), inset 0 1px 0 rgba(255,255,255,0.07)` }}>
        <div style={{ position: "relative", height: ART_H, background: T.ink }}>
          <div style={{ opacity: art }}><KeyArt /></div>
          <Label size={13} color={T.text} style={{ position: "absolute", right: 16, top: 14, padding: "6px 10px", border: `1px solid ${T.line2}`, background: "rgba(18,14,34,0.72)", opacity: art }}>NEAR testnet</Label>
          {art < 1 && <div style={{ position: "absolute", left: 18, right: 18, top: 14, bottom: 14, border: `1px dashed rgba(255,201,74,${0.5 * (1 - art)})`, borderRadius: 4 }} />}
        </div>
        {/* Key lines (licence number, the locked share) are 40 px on the card: ≥ 56 px at the held scale (≥ 1.42). */}
        <div style={{ padding: "14px 26px 0" }}>
          <Label size={40} color={T.text} track={0.1}>Licence #{number}</Label>
          <Mono size={15} color={T.faint} style={{ marginTop: 2 }}>NFT licence · Ember Rift · Kiln Interactive</Mono>
          <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const gold = i >= 10 - CONFIG.fundPct / 10;
              const on = gold && i - (10 - CONFIG.fundPct / 10) < lit;
              return <div key={i} style={{ flex: 1, height: 14, background: gold ? (on ? T.gold : "rgba(255,201,74,0.16)") : "rgba(196,182,255,0.2)",
                boxShadow: on ? "0 0 12px rgba(255,201,74,0.55)" : undefined }} />;
            })}
          </div>
          <Mono size={15} color={T.muted} style={{ marginTop: 6 }}>{CONFIG.studioPct}% to the studio</Mono>
          <Mono size={40} color={lit > 0 ? T.text : T.faint} weight={600} style={{ lineHeight: 1.2, marginTop: 2 }}>
            <span style={{ color: lit > 0 ? T.gold : T.faint }}>{CONFIG.fundPct} %</span> locked for you
          </Mono>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.line}`, opacity: r > 0 ? Math.max(0.2, Math.floor(r * 5) / 5) : 0,
            transform: `translateX(${(1 - Math.floor(r * 5) / 5) * -14}px)` }}>
            <Mono size={16} color={T.text}><span style={{ color: T.gold }}>{CONFIG.royaltyPct} %</span> resale royalty to the studio <span style={{ color: T.faint }}>(NEP-199)</span></Mono>
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "screen",
          background: `linear-gradient(105deg, transparent ${gloss * 120 - 40}%, rgba(255,235,200,0.10) ${gloss * 120 - 25}%, transparent ${gloss * 120 - 10}%)` }} />
      </div>
      <Bracket corner="tl" />
      <Bracket corner="br" />
    </div>
  );
}
