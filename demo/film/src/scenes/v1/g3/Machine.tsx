// S06 opening: the isometric machine (frame C) where S05 leaves us, the licence contract block glowing with
// "0 access keys". The camera rises and pulls back: the floor's tilt and spin flatten to 0, so the floor grid becomes
// the flat screen, and the world shrinks into the CRT content rect. Drawn inside ScreenFrame's content (1878 x 868).
import { AbsoluteFill } from "remotion";
import { Box, Grid, HALF } from "../../../frames/c/iso";
import { FONT, T } from "../../../ds/tokens";
import { Label } from "../../../ds/type";
import { easeInOut, lerp, prog } from "./motion";

const W = 1878;
const H = 868;
const BLOCK = { w: 300, d: 300, h: 110 };

function ContractTop({ glow }: { glow: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${T.panel2}, ${T.panel})`, boxShadow: `inset 0 0 ${40 * glow}px rgba(255,201,74,${0.35 * glow})` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, background: `linear-gradient(180deg, ${T.gold} 0 18%, transparent 18% 27%, ${T.ember} 27% 45%, transparent 45% 54%, ${T.magenta} 54% 72%, transparent 72% 81%, ${T.violet} 81% 100%)` }} />
      <div style={{ position: "absolute", left: 22, bottom: 52, fontFamily: FONT.label, fontWeight: 600, fontSize: 14, letterSpacing: "0.18em", color: T.faint, whiteSpace: "nowrap" }}>NEAR · ONE GLOBAL CONTRACT</div>
      <div style={{ position: "absolute", left: 22, bottom: 22, fontFamily: FONT.label, fontWeight: 700, fontSize: 21, letterSpacing: "0.12em", color: T.text, whiteSpace: "nowrap" }}>LICENCE CONTRACT</div>
    </div>
  );
}

/** `f` scene frame. Flattening runs f0-22; the caller fades the layer out once the floor is flat. */
export function Machine({ f }: { f: number }) {
  const p = prog(f, 0, 22, easeInOut);
  const tilt = lerp(58, 0, p);
  const spin = lerp(-45, 0, p);
  const s = lerp(1.0, 0.7, p);
  const rise = lerp(0, 240, p); // camera rises: the floor drops away under it
  const glow = 0.75 + 0.25 * Math.sin(f / 4);
  const tag = 1 - prog(f, 6, 14);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(60% 70% at 72% 80%, rgba(155,79,224,0.18), transparent 70%), ${T.void}`, overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: 7000, perspectiveOrigin: "50% 45%" }}>
        <div style={{ position: "absolute", left: W / 2 - HALF, top: H / 2 + 20 - HALF, width: HALF * 2, height: HALF * 2, transformStyle: "preserve-3d", transformOrigin: "50% 50%",
          transform: `translateZ(${-rise}px) scale(${s}) rotateX(${tilt}deg) rotateZ(${spin}deg)` }}>
          <Grid tx={0} ty={0} />
          <Box x={0} y={0} z={0} w={BLOCK.w + 70} d={BLOCK.d + 70} h={18} edgeColor={`rgba(255,201,74,${0.5 + 0.3 * glow})`}
            top={{ fill: T.ink2, children: <div style={{ position: "absolute", inset: 10, border: "1px dashed rgba(255,201,74,0.35)", borderRadius: 3 }} /> }}
            front={{ fill: "#1a1530" }} left={{ fill: "#15112a" }} />
          <Box x={0} y={0} z={18} {...BLOCK} edgeColor={`rgba(255,201,74,${0.55 + 0.35 * glow})`}
            top={{ fill: T.panel, children: <ContractTop glow={glow} /> }}
            front={{ fill: "#221b3f" }}
            left={{ fill: "#191431" }} />
        </div>
      </AbsoluteFill>
      {/* glow pooled under the block, then the "0 access keys" tag in screen space above it */}
      <div style={{ position: "absolute", left: W / 2 - 360, top: H / 2 - 200, width: 720, height: 480, borderRadius: "50%", pointerEvents: "none",
        background: `radial-gradient(closest-side, rgba(255,201,74,${0.16 * glow * (1 - p)}), transparent)` }} />
      {tag > 0 && (
        <div style={{ position: "absolute", left: 300 + 120 * p, top: 250 + 60 * p, opacity: tag, background: "rgba(18,14,34,0.94)", border: "1px solid rgba(255,201,74,0.6)",
          borderRadius: 4, padding: "12px 18px", boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}>
          <Label size={18} color={T.gold}>Licence contract</Label>
          <div style={{ fontFamily: FONT.mono, fontSize: 15, color: T.muted, marginTop: 6 }}>ember-rift.lastsave-factory.testnet</div>
          <div style={{ fontFamily: FONT.label, fontWeight: 700, fontSize: 30, color: T.text, marginTop: 6, letterSpacing: "0.04em" }}><span style={{ color: T.gold }}>0</span> access keys</div>
        </div>
      )}
    </AbsoluteFill>
  );
}

