// S16 Verify (7.6 s, V15 at 0.3 s). A vertical roll (10 f, stepped) from S15's tx line lands on the terminal; `pnpm
// verify` is typed and run; on "Run verify" the command line lifts off the glass as 64 px film type (held 1.5 s, the
// terminal turns to texture); the rows print and scroll (real labels, real order, v2 dev marks); the summary line that
// ends the run prints at f188 and lifts at f190 (64/56 px), held through S16's end into S17's pull-back.
// The `t-verify` take replaces the drawn terminal (g6/VerifyTerm) when it exists; the lifted lines stay (facts.ts).
import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CONTENT, Camera, ScreenFrame } from "../../ds/screen";
import { Mono } from "../../ds/type";
import { stepped, T } from "../../ds/tokens";
import { Slot, slotSource } from "../../film/Slot";
import { LIFT, TEXTURE, VERIFY_SUMMARY } from "./g6/facts";
import { C, inOut, word } from "./g6/kit";
import { LiftCard, liftShow, texture } from "./g6/Lift";
import { PendingTag } from "./g6/PendingTag";
import { CMD, LAST_AT, VerifyTerm } from "./g6/VerifyTerm";
import { S15_END, S15Content } from "./S15";

const ROLL = 10;
const RUN = word("S16", 3.42); // "Run" f112
const CMD_LIFT = { at: RUN - 8, out: RUN + 43 }; // settles f110, held to f155
export const SUM_AT = LAST_AT + 2; // summary lifts f190, settles f196 (before "chain." f197)
export const S16_CAM = { s: 1.2, fx: 756, fy: 512 };
/** Camera at frame f (S17 starts from s16Cam(227)). */
export function s16Cam(f: number) {
  const p = interpolate(f, [6, 40], [0, 1], { ...C, easing: inOut });
  const drift = interpolate(f, [40, 227], [0, 0.03], C);
  return { s: S15_END.s + (S16_CAM.s + drift - S15_END.s) * p, fx: S15_END.fx + (S16_CAM.fx - S15_END.fx) * p, fy: S15_END.fy + (S16_CAM.fy - S15_END.fy) * p };
}

/** Strength of the texture behind S16's lifted lines at frame f (S17 continues it from f = 227 + its frame). */
export const s16Texture = (f: number) => Math.max(liftShow(f, CMD_LIFT.at, CMD_LIFT.out), liftShow(f, SUM_AT, 9999));

/** The summary line that ends `pnpm verify`, lifted (frame coords). `show` 0..1. Shared with S17's first frames. */
export function SummaryLift({ show }: { show: number }) {
  return (
    <LiftCard x={LIFT.summary.x} y={LIFT.summary.y} show={show} edge={T.alive} glow="rgba(69,227,148,0.2)">
      <Mono size={LIFT.summary.size} weight={600} color={T.alive} style={{ lineHeight: 1.15 }}>{VERIFY_SUMMARY.head}</Mono>
      <Mono size={Math.round(LIFT.summary.size * 0.875)} color={T.text} style={{ lineHeight: 1.25, marginTop: 6 }}>{VERIFY_SUMMARY.counts}</Mono>
    </LiftCard>
  );
}

/** The terminal content at frame f: the take when it exists, else the drawn stand-in. */
export function VerifyContent({ f }: { f: number }) {
  if (slotSource("t-verify").kind === "raw") {
    // term.html window: 1800×980 centred, 8 px bezel + 40 px bar; keep the player area, bottom-aligned (the table ends there)
    return <Slot slot="t-verify" crop={{ x: 0.0354, y: 0.183, w: 0.929, h: 0.7635 }} />;
  }
  return (
    <AbsoluteFill>
      <VerifyTerm f={f} />
      <PendingTag slot="t-verify" />
    </AbsoluteFill>
  );
}

function Cmd(): ReactNode {
  return <Mono size={LIFT.cmd.size} color={T.text} style={{ lineHeight: 1.15 }}><span style={{ color: T.gold, fontWeight: 600 }}>$ </span>{CMD}</Mono>;
}

export function S16() {
  const f = useCurrentFrame();
  const cam = s16Cam(f);
  const roll = stepped(interpolate(f, [0, ROLL], [0, 1], C), 5);
  const H = CONTENT.h;
  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <AbsoluteFill style={texture(s16Texture(f), TEXTURE.opacity, TEXTURE.blur)}>
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
        </Camera>
      </AbsoluteFill>
      <LiftCard x={LIFT.cmd.x} y={LIFT.cmd.y} show={liftShow(f, CMD_LIFT.at, CMD_LIFT.out)}><Cmd /></LiftCard>
      <SummaryLift show={liftShow(f, SUM_AT, 9999)} />
    </AbsoluteFill>
  );
}
