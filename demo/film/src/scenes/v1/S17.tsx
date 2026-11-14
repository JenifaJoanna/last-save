// S17 Close (8.8 s, V16 "Last Save. Built on NEAR." at 2.2 s). From S16's last pose the camera pulls all the way back
// through the bezel (60 f, ease-in-out) to LS-0001 floating in Ember Rift's space (frames/b world), with a slow orbit
// that settles at f180. The display line prints beside it; the mark lock-up settles on "Last Save", the label row
// prints and the NEAR mark brightens on "NEAR", then the repo and live URLs. Hold to the last frame with a slow drift.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Embers, Nebula } from "../../frames/b/Space";
import { T } from "../../ds/tokens";
import { DeviceFrame } from "./g6/Device";
import { C, inOut } from "./g6/kit";
import { Lockup } from "./g6/Lockup";
import { TEXTURE } from "./g6/facts";
import { liftShow, texture } from "./g6/Lift";
import { s16Cam, SUM_AT, SummaryLift, VerifyContent } from "./S16";

const SUM_OUT = 30; // the lifted verify summary (from S16) holds through the first second of the pull-back

const PULL = 60;
const SETTLE = 180;
const END = { s: 0.43, x: -440, y: -66 }; // device page scale and its centre offset from the frame centre

export function S17() {
  const f = useCurrentFrame();
  const c0 = s16Cam(227);
  const p = interpolate(f, [0, PULL], [0, 1], { ...C, easing: inOut });
  // scale moves in log space (constant perceived speed); translation follows the scale so the focus glides out
  const s = c0.s * Math.pow(END.s / c0.s, p);
  const q = (c0.s - s) / (c0.s - END.s);
  const t0 = { x: c0.s * (960 - c0.fx), y: c0.s * (540 - c0.fy) };
  const tx = t0.x + (END.x - t0.x) * q;
  const ty = t0.y + (END.y - t0.y) * q;
  const ry = interpolate(f, [0, PULL, SETTLE], [0, 20, 13], { ...C, easing: inOut }) + Math.sin(f / 50) * 0.6 * interpolate(f, [SETTLE - 30, SETTLE], [0, 1], C);
  const rx = interpolate(f, [0, PULL, SETTLE], [0, 6, 4], { ...C, easing: inOut });
  const float = Math.sin(f / 34) * 5 * interpolate(f, [PULL - 20, PULL + 20], [0, 1], C);
  const backdrop = interpolate(f, [6, 34], [1, 0], C);
  const drift = interpolate(f, [SETTLE - 40, 263], [1, 1.025], C);
  const space = 1 - backdrop;
  const sum = liftShow(227 + f, SUM_AT, 227 + SUM_OUT);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${drift})` }}>
        <AbsoluteFill style={{ opacity: space }}>
          <Nebula x={600} y={760} width={1800} />
          <AbsoluteFill style={{ clipPath: "inset(0 50% 20% 0)" }}><Embers count={16} seed={7} /></AbsoluteFill>
        </AbsoluteFill>
        <AbsoluteFill style={{ perspective: 2400 }}>
          <AbsoluteFill style={{ transformStyle: "preserve-3d", transformOrigin: "960px 540px",
            transform: `translate(${tx}px, ${ty + float}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${s})` }}>
            <AbsoluteFill style={texture(sum, TEXTURE.opacity, TEXTURE.blur, s)}>
              <DeviceFrame title="Terminal" mode="released" primary="Run" backdrop={backdrop}>
                <VerifyContent f={227 + f} />
              </DeviceFrame>
            </AbsoluteFill>
          </AbsoluteFill>
        </AbsoluteFill>
        <Lockup f={f} />
      </AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: "none", opacity: space, background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.55) 100%)" }} />
      <SummaryLift show={sum} />
    </AbsoluteFill>
  );
}
