// Style frame C, "The machine": one persistent isometric world. The camera tracks the server build as a single object:
// it encrypts on its launch pad, splits into two copies that glide to the studio CDN and Walrus, the build record prints
// on the floor, and the key drops into the OutLayer enclave with its two locks. Beat: the promise is code (~0:39-0:53).
// Transition pose ~f55 (copies mid-glide), hero pose ~f105 (copies landed, key entering the enclave).
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Void } from "../ds/crt";
import { Billboard, Floor, Grid, OnFloor } from "./c/iso";
import { BLOCK, BuildBlock, ENC, Enclave, KeyGlyph, PAD_H, Plinth, Track } from "./c/parts";
import { Box } from "./c/iso";
import { BlockStatus, EnclaveTags, LogStrip, PlinthTag } from "./c/Tags";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const io = Easing.inOut(Easing.cubic);
const glideEase = Easing.bezier(0.33, 0, 0.2, 1);
const ORIGIN = { x: -560, y: -560 };
const CDN = { x: 60, y: -560 };
const WAL = { x: -560, y: 60 };

function Shadow({ x, y, a }: { x: number; y: number; a: number }) {
  return (
    <OnFloor x={x} y={y} w={BLOCK.w + 40} d={BLOCK.d + 40} z={3}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 30, background: `rgba(0,0,0,${0.55 * a})`, filter: "blur(18px)" }} />
    </OnFloor>
  );
}

export function FrameC() {
  const f = useCurrentFrame();
  const enc = interpolate(f, [18, 36], [0, 1], c);
  const glide = interpolate(f, [40, 78], [0, 1], { ...c, easing: glideEase });
  const hop = Math.sin(Math.PI * glide) * 18;
  const split = f >= 40 && glide > 0.01;
  const ax = interpolate(glide, [0, 1], [ORIGIN.x, CDN.x]);
  const by = interpolate(glide, [0, 1], [ORIGIN.y, WAL.y]);
  const padFade = interpolate(f, [72, 92], [1, 0], c);
  const ghost = interpolate(f, [40, 44, 64], [0, 0.9, 0], c);
  const keyZ = interpolate(f, [72, 98, 106, 118], [820, 420, 300, 175], { ...c, easing: Easing.out(Easing.quad) });
  const glow = interpolate(f, [100, 107, 120], [0, 1, 0.6], c);
  // Camera: tracks the build from its pad toward the enclave, with a gentle push-in.
  const cam = interpolate(f, [8, 112], [0, 1], { ...c, easing: io });
  const tx = interpolate(cam, [0, 1], [ORIGIN.x + 60, 20]);
  const ty = interpolate(cam, [0, 1], [ORIGIN.y + 60, 20]);
  const s = interpolate(f, [0, 120], [1.0, 1.08]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Void glowX={72} glowY={78} />
      <AbsoluteFill style={{ perspective: 7000, perspectiveOrigin: "50% 45%" }}>
        <Floor tx={tx} ty={ty} s={s}>
          <Grid tx={tx} ty={ty} />
          <LogStrip f={f} x={-170} y={-380} />
          <Track x0={ORIGIN.x + 135} y0={ORIGIN.y} x1={CDN.x - 135} y1={CDN.y} p={split ? glide : 0} />
          <Track x0={WAL.x} y0={ORIGIN.y + 135} x1={WAL.x} y1={WAL.y - 135} p={split ? glide : 0} />
          {padFade > 0 && <div style={{ opacity: padFade, transformStyle: "preserve-3d", position: "absolute", inset: 0 }}><Plinth x={ORIGIN.x} y={ORIGIN.y} lit={0} /></div>}
          <Plinth x={CDN.x} y={CDN.y} lit={interpolate(f, [74, 84], [0, 1], c)} />
          <Plinth x={WAL.x} y={WAL.y} lit={interpolate(f, [74, 84], [0, 1], c)} />
          {!split ? (
            <>
              <Shadow x={ORIGIN.x} y={ORIGIN.y} a={1} />
              <BuildBlock x={ORIGIN.x} y={ORIGIN.y} z={PAD_H} enc={enc} frame={f} />
            </>
          ) : (
            <>
              <Shadow x={ax} y={ORIGIN.y} a={1} /><Shadow x={WAL.x} y={by} a={1} />
              {ghost > 0 && <Box x={ORIGIN.x} y={ORIGIN.y} z={PAD_H} {...BLOCK} opacity={ghost} edgeColor="rgba(255,201,74,0.9)" top={{ fill: "rgba(255,201,74,0.08)" }} front={{ fill: "rgba(255,201,74,0.05)" }} left={{ fill: "rgba(255,201,74,0.04)" }} />}
              <BuildBlock x={ax} y={ORIGIN.y} z={PAD_H + hop} enc={1} frame={f} />
              <BuildBlock x={WAL.x} y={by} z={PAD_H + hop} enc={1} frame={f + 7} />
            </>
          )}
          <BlockStatus f={f} x={ORIGIN.x} y={ORIGIN.y} />
          <PlinthTag f={f} x={CDN.x} y={CDN.y} at={80} label="Studio CDN" sub="encrypted copy 1" />
          <PlinthTag f={f} x={WAL.x} y={WAL.y} at={84} label="Walrus" sub="encrypted copy 2" />
          <Enclave glow={glow} />
          {f >= 72 && (
            <Billboard x={ENC.x} y={ENC.y} z={keyZ}>
              <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)" }}><KeyGlyph size={130} /></div>
            </Billboard>
          )}
          <EnclaveTags f={f} />
        </Floor>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
