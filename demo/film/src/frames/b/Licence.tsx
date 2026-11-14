// The licence as a physical card that lifts off the terminal screen (direction B). Drawn at 620x352 natural size so its
// type stays crisp when the camera is close; the parent scales it down to its on-screen footprint while it is still flat.
// Facts shown are the store's own (price split 60/40 from fund_bps 4000); the licence number is a placeholder until the
// judge-run take replaces it.
import { Img, staticFile } from "remotion";
import { Label, Mono } from "../../ds/type";
import { FONT, T } from "../../ds/tokens";

export const CARD_W = 620;
export const CARD_H = 352;

function Bracket({ corner }: { corner: "tl" | "br" }) {
  const s = { position: "absolute" as const, width: 22, height: 22 };
  const b = `3px solid ${T.ember}`;
  return corner === "tl"
    ? <div style={{ ...s, left: -2, top: -2, borderLeft: b, borderTop: b, borderTopLeftRadius: 8 }} />
    : <div style={{ ...s, right: -2, bottom: -2, borderRight: b, borderBottom: b, borderBottomRightRadius: 8 }} />;
}

/** `fill` 0..1 lights the four gold segments one by one (stepped); `gloss` 0..1 sweeps a highlight across the face. */
export function LicenceCard({ fill = 1, gloss = 0.5, glow = 1, number = 2 }: { fill?: number; gloss?: number; glow?: number; number?: number }) {
  const lit = Math.floor(Math.min(1, Math.max(0, fill)) * 4 + 1e-6);
  return (
    <div style={{ position: "relative", width: CARD_W, height: CARD_H, transformStyle: "preserve-3d" }}>
      {/* card body thickness: a darker plate a few px behind the face */}
      <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "#0b0817", transform: "translateZ(-7px)", border: "1px solid rgba(0,0,0,0.8)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${T.line2}`,
        background: "linear-gradient(165deg, #251d42 0%, #18122d 55%, #120e22 100%)",
        boxShadow: `0 0 ${46 * glow}px rgba(255,201,74,${0.22 * glow}), inset 0 1px 0 rgba(255,255,255,0.07)` }}>
        <div style={{ position: "relative", height: 178, overflow: "hidden" }}>
          <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(18,14,34,0) 40%, rgba(24,18,45,0.92) 100%)" }} />
          <div style={{ position: "absolute", left: 24, bottom: 12, fontFamily: FONT.display, fontStretch: "125%", fontWeight: 900, fontSize: 40, lineHeight: "40px",
            color: T.text, textTransform: "uppercase", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>Ember Rift</div>
          <Label size={13} color={T.text} style={{ position: "absolute", right: 16, top: 14, padding: "6px 10px", border: `1px solid ${T.line2}`, background: "rgba(18,14,34,0.72)" }}>NEAR testnet</Label>
        </div>
        <div style={{ padding: "18px 26px 0" }}>
          <Label size={24} color={T.text} track={0.14}>Licence #{number} · Ember Rift</Label>
          <Mono size={15} color={T.faint} style={{ marginTop: 4 }}>NFT licence · Kiln Interactive</Mono>
          <div style={{ display: "flex", gap: 5, marginTop: 18 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const gold = i >= 6;
              const on = gold && i - 6 < lit;
              return <div key={i} style={{ flex: 1, height: 13, background: gold ? (on ? T.gold : "rgba(255,201,74,0.16)") : "rgba(196,182,255,0.2)",
                boxShadow: on ? "0 0 12px rgba(255,201,74,0.55)" : undefined }} />;
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <Mono size={15} color={T.muted}>60% to the studio</Mono>
            <Mono size={15} color={T.gold} weight={500}>40% locked for you</Mono>
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
