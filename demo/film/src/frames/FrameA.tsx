// Style frame A, "Inside the screen": the camera lives inside the LS-0001 CRT. Footage plays in windows the terminal
// opens; when the studio dies, the match window collapses like a CRT powering off, its line becomes the red flatline,
// and the terminal prints DEAD. Beat: the kill (~1:20). Hero pose ~f105, transition pose ~f40.
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CrtLayers, StatusBar } from "../ds/crt";
import { Display, Eyebrow, Label, Mono, Stripes } from "../ds/type";
import { EASE_OUT, stepped, T } from "../ds/tokens";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(...EASE_OUT);
const K = 1.5; // terminal UI scale: the screen fills the frame, so chrome is drawn 1.5x for legibility at 1080p

const LOG = [
  { t: 58, text: "> PROBE 1/3 .......... ", res: "FAILED", tail: "  unreachable" },
  { t: 66, text: "> PROBE 2/3 .......... ", res: "FAILED", tail: "  unreachable" },
  { t: 74, text: "> PROBE 3/3 .......... ", res: "FAILED", tail: "  unreachable" },
  { t: 84, text: "> STUDIO DECLARED GONE  ", res: "DEAD", tail: "" },
];

/** The app's SunEmblem in its dead state: a red banded sun the flatline runs through. */
function DeadSun({ x, y, r, p }: { x: number; y: number; r: number; p: number }) {
  const bands = [62, 70, 77, 83, 88];
  return (
    <>
    <div style={{ position: "absolute", left: x - r * 1.6, top: y - r * 1.6, width: r * 3.2, height: r * 3.2, borderRadius: "50%", opacity: p * 0.5,
      background: "radial-gradient(circle, rgba(255,77,94,0.35), transparent 62%)" }} />
    <svg width={r * 2.6} height={r * 2.2} viewBox="0 0 240 200" style={{ position: "absolute", left: x - r * 1.3, top: y - r * 1.1, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      <defs>
        <linearGradient id="dsun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a7a" /><stop offset="1" stopColor="#8f1d2c" /></linearGradient>
        <mask id="dsunm"><rect width="240" height="200" fill="#fff" />{bands.map((b, i) => <rect key={b} x="0" y={b * 2 - 20} width="240" height={2 + i * 1.6} fill="#000" />)}</mask>
      </defs>
      <circle cx="120" cy="100" r="74" fill="url(#dsun)" mask="url(#dsunm)" />
    </svg>
    </>
  );
}

export function FrameA() {
  const f = useCurrentFrame();
  const dead = f >= 30;
  // Match window: plays, then collapses vertically (CRT power-off) between f30 and f40, leaving a bright line.
  const squash = interpolate(f, [30, 40], [1, 0.006], { ...c, easing: Easing.in(Easing.cubic) });
  const flash = interpolate(f, [34, 40, 52], [0, 1, 0.85], c);
  // The line stretches to the full screen width and cools from white to dead red, then settles low as the flatline.
  const lineW = interpolate(f, [40, 50], [1100, 1920], { ...c, easing: out });
  const lineY = interpolate(f, [46, 62], [430, 560], { ...c, easing: out });
  const red = interpolate(f, [40, 52], [0, 1], c);
  const typeIn = (d: number) => stepped(interpolate(f, [d, d + 12], [0, 1], c), 5);
  const push = interpolate(f, [0, 120], [1.0, 1.035]);

  return (
    <AbsoluteFill style={{ background: T.bezel, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      <div style={{ position: "absolute", inset: 14, borderRadius: 24, overflow: "hidden", background: T.ink, display: "flex", flexDirection: "column", border: "1px solid rgba(0,0,0,0.7)" }}>
        <StatusBar title={dead ? "The kill" : "Live match"} mode={dead ? "dead" : "online"} k={K} decodeP={interpolate(f, [30, 42], [0, 1], c)} clock="21:42" />
        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          <AbsoluteFill style={{ transform: `scale(${push})` }}>
            {/* the match window, bracket-framed like the app's .bracket cards */}
            {f >= 32 && f < 52 && (
              <div style={{ position: "absolute", left: 960 - 900, top: 430 - 90, width: 1800, height: 180, borderRadius: "50%", opacity: flash * 0.55,
                background: "radial-gradient(closest-side, rgba(255,236,228,0.9), rgba(255,77,94,0.25) 55%, transparent)" }} />
            )}
            {f < 41 && (
              <div style={{ position: "absolute", left: 410, top: 120, width: 1100, height: 620, transform: `scaleY(${squash})`, filter: `brightness(${1 + flash * 1.2}) saturate(${1 + flash})` }}>
                <Img src={staticFile("plates/kill-lost.png")} style={{ width: "100%", height: "100%", objectFit: "cover", border: `1px solid ${T.line2}` }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 8%, rgba(255,236,228,0.55) 38%, #fff4ee 50%, rgba(255,236,228,0.55) 62%, transparent 92%)", opacity: flash, mixBlendMode: "screen" }} />
                <div style={{ position: "absolute", left: -3, top: -3, width: 18, height: 18, borderLeft: `3px solid ${T.ember}`, borderTop: `3px solid ${T.ember}` }} />
                <div style={{ position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRight: `3px solid ${T.ember}`, borderBottom: `3px solid ${T.ember}` }} />
              </div>
            )}
            {f >= 60 && <DeadSun x={1480} y={562} r={150} p={stepped(interpolate(f, [60, 72], [0, 1], c), 5)} />}
            {f >= 38 && (
              <div style={{ position: "absolute", left: (1920 - lineW) / 2, top: lineY, width: lineW, height: 4, borderRadius: 2,
                background: `rgb(${255}, ${Math.round(255 - red * 178)}, ${Math.round(255 - red * 161)})`,
                boxShadow: `0 0 ${10 + 20 * (1 - red)}px rgba(255,77,94,0.9), 0 0 60px rgba(255,77,94,${0.35 * red})` }} />
            )}
            {f >= 52 && (
              <div style={{ position: "absolute", left: 200, top: 150 }}>
                <div style={{ opacity: typeIn(52) }}><Eyebrow size={24} color={T.dead}>Proof of life · Ember Rift official server</Eyebrow></div>
                <div style={{ marginTop: 26, transform: `translateX(${(1 - typeIn(54)) * -14}px)`, opacity: typeIn(54) }}>
                  <Display size={196} tone="dead">Gone dark</Display>
                </div>
              </div>
            )}
            <div style={{ position: "absolute", left: 206, top: 610 }}>
              {LOG.map((l) => f >= l.t && (
                <div key={l.text} style={{ opacity: typeIn(l.t), transform: `translateX(${(1 - typeIn(l.t)) * -14}px)` }}>
                  <Mono size={30} color={T.muted}>{l.text}<span style={{ color: T.dead, fontWeight: 600 }}>{l.res}</span>{l.tail}</Mono>
                </div>
              ))}
            </div>
            {f >= 90 && <div style={{ position: "absolute", left: 206, top: 820, opacity: typeIn(90) }}><Stripes width={420} height={30} /></div>}
            {f >= 92 && (
              <Label size={22} color={T.gold} style={{ position: "absolute", left: 206, top: 880, opacity: typeIn(92) }}>The studio went dark. The game did not.</Label>
            )}
          </AbsoluteFill>
          <CrtLayers k={K} roll={interpolate(f, [30, 66], [0, 1], c)} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
