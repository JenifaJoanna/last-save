// S16 Verify (7.6 s, V15 at 0.3 s). A vertical roll (10 f, stepped) from S15's tx line lands on the terminal. With the
// t-verify take (`pnpm -s verify --all`, three instances): the command appears at f110 and lifts as 64 px film type on
// "Run verify" (held 1.5 s, the terminal turns to texture); the take's idle wait is cut, so the output dumps at f151 on
// "checks"; then the verdict across all instances lifts (58 px, f160) and holds through S17's pull-back.
// Without the take, the drawn terminal (g6/VerifyTerm) stands in with the same lifts.
import type { ReactNode } from "react";
import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { CONTENT, Camera, ScreenFrame } from "../../ds/screen";
import { Mono } from "../../ds/type";
import { stepped, T } from "../../ds/tokens";
import { Slot, slotSource } from "../../film/Slot";
import { LIFT, TAKES, TEXTURE, VERIFY_CMD, VERIFY_LIFT } from "./g6/facts";
import { C, inOut, word } from "./g6/kit";
import { LiftCard, liftShow, texture } from "./g6/Lift";
import { PendingTag } from "./g6/PendingTag";
import { LAST_AT, VerifyTerm } from "./g6/VerifyTerm";
import { s15End, S15Content } from "./S15";

const ROLL = 10;
const RUN = word("S16", 3.42); // "Run" f112
const CMD_AT = RUN - 2; // the take's command line appears at f110
const CMD_LIFT = { at: RUN - 8, out: RUN + 41 }; // settles f110, held to f153
const DUMP_CUT = 150; // the take jumps over its idle wait here; its output dumps 1 f later
const hasTake = () => slotSource("t-verify").kind === "raw";
/** Frame the final key line starts to lift: after the take's dump, or after the drawn table's last row. */
export const sumAt = () => (hasTake() ? 160 : LAST_AT + 2);
/** Seconds into the t-verify take shown at S16 frame f (S17 passes 227 + its frame). */
const takeTime = (f: number) => {
  const v = TAKES.verify;
  if (f < CMD_AT) return v.idle;
  if (f < DUMP_CUT) return v.cmdAt + (f - CMD_AT) / 30;
  return Math.min(v.end, v.dumpFrom + (f - DUMP_CUT) / 30);
};
export const S16_CAM = { s: 1.2, fx: 756, fy: 512 };
/** Camera at frame f (S17 starts from s16Cam(227)). */
export function s16Cam(f: number) {
  const p = interpolate(f, [6, 40], [0, 1], { ...C, easing: inOut });
  const drift = interpolate(f, [40, 227], [0, 0.03], C);
  return { s: s15End().s + (S16_CAM.s + drift - s15End().s) * p, fx: s15End().fx + (S16_CAM.fx - s15End().fx) * p, fy: s15End().fy + (S16_CAM.fy - s15End().fy) * p };
}

/** Strength of the texture behind S16's lifted lines at frame f (S17 continues it from f = 227 + its frame). */
export const s16Texture = (f: number) => Math.max(liftShow(f, CMD_LIFT.at, CMD_LIFT.out), liftShow(f, sumAt(), 9999));

/** The verdict across every instance plus the summed counts, lifted (frame coords). Shared with S17's first frames. */
export function SummaryLift({ show }: { show: number }) {
  return (
    <LiftCard x={LIFT.summary.x} y={LIFT.summary.y} show={show} edge={T.alive} glow="rgba(69,227,148,0.2)">
      <Mono size={LIFT.summary.size} weight={600} color={T.alive} style={{ lineHeight: 1.15 }}>{VERIFY_LIFT.head}</Mono>
      <Mono size={LIFT.summary.size} color={T.text} style={{ lineHeight: 1.25, marginTop: 6 }}>{VERIFY_LIFT.counts}</Mono>
    </LiftCard>
  );
}

/** The terminal content at frame f: the take when it exists, else the drawn stand-in. */
export function VerifyContent({ f }: { f: number }) {
  if (hasTake()) {
    // each frame seeks the take's own time (frozen), so its idle wait can be cut; the crop follows the dump to the end screen
    const crop = f < DUMP_CUT ? TAKES.verify.cropTop : TAKES.verify.cropEnd;
    return <Freeze frame={0}><Slot slot="t-verify" from={takeTime(f)} crop={crop} /></Freeze>;
  }
  return (
    <AbsoluteFill>
      <VerifyTerm f={f} />
      <PendingTag slot="t-verify" />
    </AbsoluteFill>
  );
}

function Cmd(): ReactNode {
  return <Mono size={LIFT.cmd.size} color={T.text} style={{ lineHeight: 1.15 }}><span style={{ color: T.gold, fontWeight: 600 }}>$ </span>{VERIFY_CMD}</Mono>;
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
      <SummaryLift show={liftShow(f, sumAt(), 9999)} />
    </AbsoluteFill>
  );
}
