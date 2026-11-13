// Cold open: three verified quotes typed on black, each with its source. Then they dim under the first line of VO.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, chakra, inter, mono, s } from "../theme";

const QUOTES = [
  { text: "they took my money, they host the game", src: "Steam Community · The Crew forum · Apr 2024" },
  { text: "No refunds, no actual heads-up at the time of purchase, and nothing you can do to keep it at all", src: "BBC News · Jun 2026" },
  { text: "skeleton of what you thought you paid for", src: "The Crew lawsuit, via Game Developer · Apr 2025" },
];

function Typed({ text, start, cps = 38 }: { text: string; start: number; cps?: number }) {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.floor(((f - start) / 30) * cps));
  const done = n >= text.length;
  const caret = !done || Math.floor(f / 15) % 2 === 0;
  return <span>{text.slice(0, n)}<span style={{ opacity: caret && f >= start ? 1 : 0, color: C.ember }}>▍</span></span>;
}

export function Open() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = [s(0.4), s(3.2), s(7.0)];
  const dim = interpolate(f, [s(9.6), s(11.2)], [1, 0.28], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: inter, justifyContent: "center", padding: "0 220px" }}>
      <AbsoluteFill style={{ background: "radial-gradient(60% 50% at 50% 60%, rgba(122,29,107,0.18), transparent)" }} />
      <div style={{ display: "grid", gap: 56, opacity: dim }}>
        {QUOTES.map((q, i) => {
          const appear = spring({ frame: f - starts[i], fps, config: { damping: 200 } });
          return (
            <div key={q.text} style={{ opacity: f >= starts[i] ? 1 : 0, transform: `translateY(${(1 - appear) * 14}px)` }}>
              <div style={{ fontSize: i === 1 ? 46 : 52, lineHeight: 1.25, color: C.text, fontWeight: 500, letterSpacing: -0.5 }}>
                “<Typed text={q.text} start={starts[i]} cps={i === 1 ? 44 : 34} />”
              </div>
              <div style={{ marginTop: 14, fontFamily: mono, fontSize: 20, color: C.muted, opacity: interpolate(f - starts[i], [s(1), s(1.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                — {q.src}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 220, bottom: 90, fontFamily: chakra, fontSize: 18, letterSpacing: 4, color: C.faint, opacity: interpolate(f, [s(10), s(11)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        WHAT PLAYERS SAY WHEN A GAME IS SWITCHED OFF
      </div>
    </AbsoluteFill>
  );
}
