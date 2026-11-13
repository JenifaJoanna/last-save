// Title: the key art pushes into the arena's burning core; the core becomes the Last Save mark; the line types in.
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, chakra, inter, s } from "../theme";

export function Mark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd27a" /><stop offset="0.55" stopColor="#ff7a1a" /><stop offset="1" stopColor="#ff4d6d" /></linearGradient>
      </defs>
      <rect x="3" y="3" width="34" height="34" rx="9" fill="#12101d" stroke="url(#g)" strokeWidth="2" />
      <path d="M8 23h7l2.5-6 4 11 3-8 2 3h5.5" fill="none" stroke="url(#g)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Title() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The core in the key art sits at ~68% x, ~42% y of the frame.
  const push = interpolate(f, [0, s(4.2)], [1.04, 2.9], { extrapolateRight: "clamp", easing: (t) => t * t * (3 - 2 * t) });
  const artFade = interpolate(f, [s(3.6), s(4.6)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash = interpolate(f, [s(3.9), s(4.3), s(5.0)], [0, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const mark = spring({ frame: f - s(4.1), fps, config: { damping: 14, stiffness: 120 } });
  const word = spring({ frame: f - s(4.9), fps, config: { damping: 200 } });
  const line = "We killed our server. You still have the game.";
  const typed = Math.max(0, Math.floor((f - s(6.0)) * 1.6));
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: artFade, transform: `scale(${push})`, transformOrigin: "68% 42%" }}>
        <Img src={staticFile("ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(40% 40% at 50% 50%, rgba(255,122,26,0.45), transparent)", opacity: flash * 1.2 }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 34 }}>
        <div style={{ transform: `scale(${mark})`, opacity: Math.min(1, mark * 1.4), filter: "drop-shadow(0 0 60px rgba(255,122,26,0.55))" }}>
          <Mark size={168} />
        </div>
        <div style={{ fontFamily: chakra, fontSize: 64, fontWeight: 600, letterSpacing: 10, color: C.text, opacity: word, transform: `translateY(${(1 - word) * 18}px)` }}>LAST SAVE</div>
        <div style={{ fontFamily: inter, fontSize: 40, fontWeight: 500, color: C.text, minHeight: 52, letterSpacing: -0.5 }}>
          <span>{line.slice(0, Math.min(22, typed))}</span>
          <span style={{ background: "linear-gradient(90deg,#ffd27a,#ff7a1a 55%,#ff4d6d)", WebkitBackgroundClip: "text", color: "transparent" }}>{line.slice(22, typed)}</span>
        </div>
        <div style={{ fontFamily: chakra, fontSize: 20, letterSpacing: 5, color: C.muted, opacity: interpolate(f, [s(8.4), s(9.2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          A GAME LICENCE ON NEAR · FIRST TITLE: EMBER RIFT
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
