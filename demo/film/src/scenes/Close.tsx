// Close: the line, the platforms it runs on, the tracks, where to verify it.
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, chakra, inter, mono, s } from "../theme";
import { Mark } from "./Title";

export function Close() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f, fps, config: { damping: 200 } });
  const b = spring({ frame: f - s(1.2), fps, config: { damping: 200 } });
  const c = spring({ frame: f - s(2.2), fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center", fontFamily: inter, color: C.text }}>
      <AbsoluteFill style={{ opacity: 0.22 }}>
        <Img src={staticFile("ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.08 - 0.04 * a})` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,6,13,0.55), rgba(7,6,13,0.92))" }} />
      <div style={{ display: "grid", justifyItems: "center", gap: 28, transform: `translateY(${(1 - a) * 20}px)`, opacity: a }}>
        <Mark size={120} />
        <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: -1.5, textAlign: "center", lineHeight: 1.12 }}>
          We killed our server.<br />
          <span style={{ background: "linear-gradient(90deg,#ffd27a,#ff7a1a 55%,#ff4d6d)", WebkitBackgroundClip: "text", color: "transparent" }}>You still have the game.</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 210, display: "flex", gap: 70, alignItems: "center", opacity: b }}>
        <Img src={staticFile("brand/near-logo.svg")} style={{ height: 44, filter: "brightness(0) invert(1)" }} />
        <Img src={staticFile("brand/outlayer-logo.png")} style={{ height: 44, mixBlendMode: "screen" }} />
      </div>
      <div style={{ position: "absolute", bottom: 120, fontFamily: chakra, fontSize: 22, letterSpacing: 5, color: C.muted, opacity: c }}>NFTS THAT DO SOMETHING · GAMES WITH REAL ECONOMIES</div>
      <div style={{ position: "absolute", bottom: 64, fontFamily: mono, fontSize: 22, color: C.text, opacity: interpolate(f, [s(2.6), s(3.4)], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        last-save.pages.dev · github.com/JenifaJoanna/last-save
      </div>
    </AbsoluteFill>
  );
}
