// Why a studio opts in: the verified EU Commission headline (16 Jun 2026), set as a sourced card.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, chakra, inter, mono, s } from "../theme";

export function Why() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f, fps, config: { damping: 200 } });
  const out = interpolate(f, [s(3.3), s(4)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center", opacity: out }}>
      <AbsoluteFill style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(20,48,107,0.35), transparent)" }} />
      <div style={{ width: 1180, borderRadius: 28, border: `1px solid ${C.line}`, background: "linear-gradient(180deg,#151227,#0f0d1a)", padding: "54px 64px",
        transform: `translateY(${(1 - a) * 30}px) scale(${0.97 + 0.03 * a})`, opacity: a, boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }}>
        <div style={{ fontFamily: chakra, fontSize: 20, letterSpacing: 5, color: C.muted }}>EUROPEAN CITIZENS' INITIATIVE · 16 JUNE 2026</div>
        <div style={{ fontFamily: inter, fontSize: 56, fontWeight: 600, color: C.text, lineHeight: 1.12, marginTop: 22, letterSpacing: -1 }}>
          European Commission replies to ‘Stop Destroying Videogames’ initiative
        </div>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.faint, marginTop: 26 }}>citizens-initiative.europa.eu</div>
      </div>
    </AbsoluteFill>
  );
}
