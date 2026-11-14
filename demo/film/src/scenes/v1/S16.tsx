// S16 Verify (7.6 s, V15 at 0.3 s). A vertical roll (10 f, stepped) from S15's tx line lands on the terminal; `pnpm
// verify` is typed and run; on "Run verify" the command line lifts off the glass; the ✓ rows print and scroll (real row
// labels, real order) and the last ✓ row lands before "chain." End pose: the last ✓ row highlighted, slow push, ready
// for S17's pull-back. The `t-verify` take replaces the drawn terminal (g6/VerifyTerm) when it exists.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CONTENT, Camera, ScreenFrame } from "../../ds/screen";
import { FONT, stepped, T } from "../../ds/tokens";
import { Slot, slotSource } from "../../film/Slot";
import { C, inOut, out, word } from "./g6/kit";
import { PendingTag } from "./g6/PendingTag";
import { CMD, LH, PAD, scrollAt, VerifyTerm } from "./g6/VerifyTerm";
import { S15_END, S15Content } from "./S15";

const OX = 22;
const OY = 102;
const ROLL = 10;
const RUN = word("S16", 3.42); // "Run" f112
const LIFT_UP = RUN - 6;
const LIFT_DOWN = word("S16", 4.88) - 8; // settles as "checks" starts
export const S16_CAM = { s: 1.2, fx: 756, fy: 512 };
/** Camera at frame f (S17 starts from s16Cam(227)). */
export function s16Cam(f: number) {
  const p = interpolate(f, [6, 40], [0, 1], { ...C, easing: inOut });
  const drift = interpolate(f, [40, 227], [0, 0.03], C);
  return { s: S15_END.s + (S16_CAM.s + drift - S15_END.s) * p, fx: S15_END.fx + (S16_CAM.fx - S15_END.fx) * p, fy: S15_END.fy + (S16_CAM.fy - S15_END.fy) * p };
}

/** The terminal content at frame f: the take when it exists, else the drawn stand-in. */
export function VerifyContent({ f }: { f: number }) {
  if (slotSource("t-verify").kind === "raw") {
    // term.html window: 1800×980 centred, 8 px bezel + 40 px bar; keep the player area, bottom-aligned (the table ends there)
    return <Slot slot="t-verify" crop={{ x: 0.0354, y: 0.183, w: 0.929, h: 0.7635 }} />;
  }
  return (
    <AbsoluteFill>
      <VerifyTerm f={f} cmdDim={liftAt(f) > 0.05 ? 1 : 0} />
      <PendingTag slot="t-verify" />
    </AbsoluteFill>
  );
}

const liftAt = (f: number) =>
  interpolate(f, [LIFT_UP, LIFT_UP + 12], [0, 1], { ...C, easing: out }) * (1 - interpolate(f, [LIFT_DOWN, LIFT_DOWN + 12], [0, 1], { ...C, easing: out }));

export function S16() {
  const f = useCurrentFrame();
  const cam = s16Cam(f);
  const roll = stepped(interpolate(f, [0, ROLL], [0, 1], C), 5);
  const H = CONTENT.h;
  const lift = slotSource("t-verify").kind === "raw" ? 0 : liftAt(f);
  // the command row's frame position (it scrolls with the terminal)
  const cmdX = OX + PAD.x;
  const cmdY = OY + PAD.y - scrollAt(f);
  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <Camera scale={cam.s} fx={cam.fx} fy={cam.fy} x={960 - cam.fx} y={540 - cam.fy}>
        <ScreenFrame title={f < 5 ? "Community hosts" : "Terminal"} titleAt={5} mode="released" keys={{ primary: "Run" }}>
          {f < ROLL ? (
            <AbsoluteFill style={{ transform: `translateY(${-roll * H}px)` }}>
              <AbsoluteFill><S15Content f={227} /></AbsoluteFill>
              <AbsoluteFill style={{ top: H }}><VerifyContent f={0} /></AbsoluteFill>
              <div style={{ position: "absolute", left: 0, right: 0, top: H - 3, height: 6, background: "rgba(239,229,208,0.55)", boxShadow: "0 0 18px rgba(239,229,208,0.5)" }} />
            </AbsoluteFill>
          ) : <VerifyContent f={f} />}
        </ScreenFrame>
        {lift > 0 && (
          <div style={{ position: "absolute", left: cmdX - 14, top: cmdY - 6, transformOrigin: "0% 50%",
            transform: `translate(${lift * 910}px, ${lift * 60}px) scale(${1 + lift * 0.6})`,
            background: T.ink2, border: `1px solid ${T.line2}`, borderLeft: `3px solid ${T.gold}`, padding: "6px 22px 6px 14px",
            boxShadow: `0 ${24 * lift}px ${40 * lift}px rgba(0,0,0,${0.7 * lift}), 0 0 ${30 * lift}px rgba(255,201,74,${0.25 * lift})` }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 26, lineHeight: `${LH}px`, whiteSpace: "pre", color: T.text }}>
              <span style={{ color: T.gold, fontWeight: 600 }}>$ </span>{CMD}
            </div>
          </div>
        )}
      </Camera>
    </AbsoluteFill>
  );
}
