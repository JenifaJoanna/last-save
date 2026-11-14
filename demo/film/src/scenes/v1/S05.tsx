// S05 Promise (16.8 s, V05 at 0.4 s). From S04's held licence card, the key-art thumbnail slides into the server build
// cartridge's slot while the card dissolves along its bands and the camera passes through the device glass into the
// isometric machine (FrameC world). Beats: "encrypted" scramble + padlock, "two places" split to STUDIO CDN / WALRUS,
// "logged" sigstore ribbon, "enclave" key drop (OutLayer, Intel TDX), "only this contract" / "running this exact
// program" lock tags, "not us": camera rises to the LICENCE CONTRACT block, "0 access keys", 1-s `x-keys` flash.
// End pose: the contract block glowing (S06 pulls back out into the screen).
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Slot } from "../../film/Slot";
import { scene } from "../../film/timeline";
import { Void } from "../../ds/crt";
import { T } from "../../ds/tokens";
import { Grid, OnFloor } from "../../frames/c/iso";
import { ENC, Enclave, KeyGlyph, PAD_H, Plinth, Track } from "../../frames/c/parts";
import { Cartridge, CART } from "./g2/Cartridge";
import { FACTS, short } from "./g2/facts";
import { Flash } from "./g2/Flash";
import { CardInSpace, HELD, heldPose } from "./g2/heldCard";
import { Billboard, type Cam, Floor, project } from "./g2/iso";
import { KeyArt } from "./g2/Licence";
import { CONTRACT, ContractBlock, EnclaveTag, LockTags, LogStrip, PlinthTag, StatusTag } from "./g2/MachineTags";
import { abs, beat, CL, easeInOut, keys, lerp, prog } from "./g2/motion";
import { DevicePull, Embers, Nebula, Page } from "./g2/World";
import { S04_LIB_FRAMES } from "./S04";

const ORIGIN = { x: -560, y: -560 }, CDN = { x: 60, y: -560 }, WAL = { x: -560, y: 60 };
const W = {
  encrypted: beat("S05", 1.08), two: beat("S05", 2.48), logged: beat("S05", 3.54), key: beat("S05", 6.0), enclave: beat("S05", 6.82),
  only: beat("S05", 7.52), running: beat("S05", 8.88), take: beat("S05", 12.8), notStudio: beat("S05", 13.8), notUs: beat("S05", 15.04),
};
const GLIDE = W.two - 3;  // copies glide 36 f
const XKEYS = W.notUs + 4; // flash 30 f
const LIB_SEQ = S04_LIB_FRAMES.LIB - scene("S04").frames; // continues S04's library take
const SCREEN_C = { x: 645, y: 495 }; // the pulled device's screen centre (S04 end pose)

function shadowAt(x: number, y: number) {
  return <OnFloor x={x} y={y} w={CART.w + 40} d={CART.d + 40} z={3}><div style={{ position: "absolute", inset: 0, borderRadius: 30, background: "rgba(0,0,0,0.55)", filter: "blur(18px)" }} /></OnFloor>;
}

export function S05() {
  const f = useCurrentFrame();
  const g = abs("S05", f);
  // Camera: cartridge → both plinths + ribbon → enclave → rise to the contract block.
  const base: Cam = {
    tx: keys(f, [[0, ORIGIN.x + 20], [72, ORIGIN.x + 20], [120, -260], [168, -240], [214, ENC.x - 30], [W.take, ENC.x - 10]]),
    ty: keys(f, [[0, ORIGIN.y + 20], [72, ORIGIN.y + 20], [120, -260], [168, -240], [214, ENC.y - 30], [W.take, ENC.y - 10]]),
    s: keys(f, [[0, 1.42], [24, 1.32], [72, 1.36], [120, 1.0], [168, 1.03], [214, 1.12], [W.take, 1.18], [W.notStudio + 10, 1.16], [504, 1.2]]),
  };
  const riseP = prog(f, W.take - 4, W.notStudio + 10, easeInOut);
  const top = project(CONTRACT.x, CONTRACT.y, CONTRACT.z + CONTRACT.h, base);
  const rise = riseP * (585 - top.y);
  // Through the glass: the old world scales into the device screen and fades; the machine settles from 1.12×.
  const thru = prog(f, 0, 24, easeInOut);
  const ws = lerp(1.12, 1, thru);
  const worldOp = prog(f, 6, 22);
  // Cartridge, encryption and the split.
  const enc = prog(f, W.encrypted - 4, W.encrypted + 14);
  const glide = prog(f, GLIDE, GLIDE + 36, easeInOut);
  const split = f >= GLIDE;
  const hop = Math.sin(Math.PI * glide) * 18;
  const keyZ = interpolate(f, [W.key - 4, W.enclave], [820, 170], { ...CL, easing: (t) => t * t });
  const encGlow = interpolate(f, [W.enclave - 2, W.enclave + 6, W.enclave + 40], [0, 1, 0.55], CL);
  const glow = interpolate(f, [W.notUs - 8, W.notUs + 4], [0.2, 1], CL) * (0.9 + 0.1 * Math.sin(f / 5));
  const hash = `sha256 ${short(FACTS.buildSha)}`;
  // The thumbnail's flight from the card's art band to the cartridge slot (screen space).
  const slotC = project(ORIGIN.x, ORIGIN.y - 20, PAD_H + CART.h, base);
  const tgt = { x: 960 + (slotC.x - 960) * ws, y: 540 + (slotC.y - 540) * ws, w: 208 * slotC.k * ws * 0.92 };
  const held = heldPose(g, HELD.s1);
  const art0 = { x: held.x, y: held.y + (-192 + 89) * held.s, w: 620 * held.s };
  const fly = prog(f, 2, 22, easeInOut);
  const thumb = { x: lerp(art0.x, tgt.x, fly), y: lerp(art0.y, tgt.y, fly) - Math.sin(Math.PI * fly) * 60, w: lerp(art0.w, tgt.w, fly) };
  const landed = prog(f, 19, 24);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: worldOp }}>
        <Void glowX={72} glowY={78} />
        <AbsoluteFill style={{ perspective: 7000, perspectiveOrigin: "50% 45%", transform: `translateY(${rise}px) scale(${ws})` }}>
          <Floor tx={base.tx} ty={base.ty} s={base.s}>
            <Grid tx={base.tx} ty={base.ty} />
            <LogStrip f={f} at={W.logged - 4} x={-310} y={-300} />
            <Track x0={ORIGIN.x + 135} y0={ORIGIN.y} x1={CDN.x - 135} y1={CDN.y} p={split ? glide : 0} />
            <Track x0={WAL.x} y0={ORIGIN.y + 135} x1={WAL.x} y1={WAL.y - 135} p={split ? glide : 0} />
            <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", opacity: 1 - prog(f, GLIDE + 30, GLIDE + 50) }}><Plinth x={ORIGIN.x} y={ORIGIN.y} lit={0} /></div>
            <Plinth x={CDN.x} y={CDN.y} lit={prog(f, GLIDE + 32, GLIDE + 42)} />
            <Plinth x={WAL.x} y={WAL.y} lit={prog(f, GLIDE + 32, GLIDE + 42)} />
            {!split ? (
              <>{shadowAt(ORIGIN.x, ORIGIN.y)}<Cartridge x={ORIGIN.x} y={ORIGIN.y} z={PAD_H} enc={enc} art={landed} frame={f} hash={hash} /></>
            ) : (
              <>
                {shadowAt(lerp(ORIGIN.x, CDN.x, glide), ORIGIN.y)}{shadowAt(WAL.x, lerp(ORIGIN.y, WAL.y, glide))}
                <Cartridge x={lerp(ORIGIN.x, CDN.x, glide)} y={ORIGIN.y} z={PAD_H + hop} enc={1} frame={f} hash={hash} />
                <Cartridge x={WAL.x} y={lerp(ORIGIN.y, WAL.y, glide)} z={PAD_H + hop} enc={1} frame={f + 7} hash={hash} />
              </>
            )}
            <StatusTag f={f} x={ORIGIN.x} y={ORIGIN.y} z={PAD_H + CART.h} encAt={W.encrypted - 4} doneAt={W.encrypted + 12} hideAt={GLIDE - 6} />
            <PlinthTag f={f} x={CDN.x} y={CDN.y} z={PAD_H + CART.h} at={GLIDE + 30} label="Studio CDN" sub="encrypted copy 1" fade={1 - riseP} />
            <PlinthTag f={f} x={WAL.x} y={WAL.y} z={PAD_H + CART.h} at={GLIDE + 34} label="Walrus" sub="encrypted copy 2" fade={1 - riseP} />
            <Enclave glow={encGlow} />
            {f >= W.key - 4 && (
              <Billboard x={ENC.x} y={ENC.y} z={keyZ}>
                <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)", opacity: prog(f, W.key - 4, W.key + 2) }}><KeyGlyph size={130} /></div>
              </Billboard>
            )}
            <EnclaveTag f={f} at={W.enclave - 3} />
            {f >= W.only - 4 && <ContractBlock f={f} beamAt={W.only - 4} keysAt={W.notUs - 4} glow={glow} account={FACTS.instance.v} keys={FACTS.accessKeys.v} />}
            <LockTags f={f} a={W.only - 4} b={W.running - 3} account={FACTS.instance.v} wasm={short(FACTS.releaseWasm)} />
          </Floor>
        </AbsoluteFill>
      </AbsoluteFill>
      {f < 24 && (
        <AbsoluteFill style={{ opacity: 1 - prog(f, 6, 20), transformOrigin: `${SCREEN_C.x}px ${SCREEN_C.y}px`, transform: `scale(${lerp(1, 3.2, prog(f, 0, 24, (t) => t * t * t))})` }}>
          <Nebula g={g} /><Embers g={g} count={18} seed={5} />
          <DevicePull p={1} dim={1} g={g}><Page title="Library" header={0}>
            <Sequence from={LIB_SEQ} layout="none"><Slot slot="library" plate="library.png" from={S04_LIB_FRAMES.LIB_FROM} crop={S04_LIB_FRAMES.CONTENT_CROP} tag={false} /></Sequence>
          </Page></DevicePull>
        </AbsoluteFill>
      )}
      {f < 24 && <AbsoluteFill style={{ opacity: 1 - prog(f, 10, 22) }}><Embers g={g + 400} count={10} seed={11} /></AbsoluteFill>}
      {f < 18 && <CardInSpace pose={held} fill={1} royalty={1} glow={1} art={0} dissolve={prog(f, 2, 16)} />}
      {f < 24 && (
        <div style={{ position: "absolute", left: thumb.x - thumb.w / 2, top: thumb.y - (thumb.w * 178) / 620 / 2, width: thumb.w, height: (thumb.w * 178) / 620, overflow: "hidden",
          borderRadius: 4, opacity: 1 - landed, boxShadow: `0 ${20 * (1 - fly)}px 50px rgba(0,0,0,0.5)` }}>
          <div style={{ transform: `scale(${thumb.w / 620})`, transformOrigin: "0 0" }}><KeyArt title={fly < 0.4} /></div>
        </div>
      )}
      <Flash f={f} at={XKEYS} dur={30} slot="x-keys" path={`near.rocks/account/${FACTS.instance.v}`} crop={{ x: 0.12, y: 0.06, w: 0.7, h: 0.7 }} rect={{ x: 140, y: 150, w: 1240, h: 698 }} />
    </AbsoluteFill>
  );
}
