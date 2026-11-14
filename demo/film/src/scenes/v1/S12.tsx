// S12 Preserved (5.2 s, V11 at 0.2 s). Opens on S11's exact last frame (the keep-alive pool total, pushed in) and the
// camera passes through the glass into the machine world. The released cartridge, now gold and unlocked, sits on two
// plinths, WALRUS and INTERNET ARCHIVE, each tagged with the released build's sha256 = the on-chain value (TBD until the
// judge run); the camera orbits ~18°. `x-walrus2` flashes on "Walrus", `x-archive` on "Internet Archive". End: the Walrus
// copy rises toward the camera and resolves into S13's first frame (its Walrus copy card).
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Void } from "../../ds/crt";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { Grid, OnFloor } from "../../frames/c/iso";
import { PAD_H, Plinth } from "../../frames/c/parts";
import { Cartridge, CART } from "./g2/Cartridge";
import { FACTS, short } from "./g2/facts";
import { Flash } from "./g2/Flash";
import { type Cam, Floor, project } from "./g2/iso";
import { PlinthTag, Tick } from "./g2/MachineTags";
import { beat, CL, easeInOut, keys, lerp, prog } from "./g2/motion";
import { S11 } from "./S11";
import { S13 } from "./S13";

const WAL = { x: -260, y: -260 }, IA = { x: 260, y: 260 };
const W = { publicW: beat("S12", 0.86), walrus: beat("S12", 2.26), internet: beat("S12", 3.54) };
const RISE = 128;     // the Walrus copy lifts toward the camera
const HANDOFF = 146;  // dissolve into S13's first frame (155 = S13 f0 exactly)

function Shadow({ x, y }: { x: number; y: number }) {
  return <OnFloor x={x} y={y} w={CART.w + 40} d={CART.d + 40} z={PAD_H + 1}><div style={{ position: "absolute", inset: 0, borderRadius: 30, background: "rgba(0,0,0,0.5)", filter: "blur(16px)" }} /></OnFloor>;
}

export function S12() {
  const f = useCurrentFrame();
  const last = scene("S12").frames - 1;
  const thru = prog(f, 0, 24, easeInOut);
  const rise = prog(f, RISE, last, easeInOut);
  const cam: Cam = {
    tx: lerp(0, WAL.x, rise), ty: lerp(0, WAL.y, rise),
    s: keys(f, [[0, 1.12], [24, 1.02], [RISE, 1.08], [last, 1.7]]),
    spin: keys(f, [[0, -45], [last, -27]]),
  };
  const ws = lerp(1.15, 1, thru);
  const lift = 300 * rise;
  // Track the rising Walrus copy so it ends centred, slightly above centre (S13 opens on it there).
  const copy = project(WAL.x, WAL.y, PAD_H + lift + CART.h / 2, cam);
  const dx = (960 - copy.x) * rise, dy = (470 - copy.y) * rise;
  const hash = `sha256 ${short(FACTS.releasedSha)}`;
  const sub = <span style={{ display: "inline-flex", alignItems: "center", color: T.gold }}>{hash}<span style={{ color: T.muted }}>&nbsp;= on chain</span><Tick size={20} /></span>;
  const tagFade = 1 - prog(f, RISE, RISE + 10);
  const hand = prog(f, HANDOFF, last);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: prog(f, 6, 22) }}>
        <Void glowX={50} glowY={80} />
        <AbsoluteFill style={{ perspective: 7000, perspectiveOrigin: "50% 45%", transform: `translate(${dx}px, ${dy}px) scale(${ws})` }}>
          <Floor {...cam}>
            <Grid tx={cam.tx} ty={cam.ty} />
            <Plinth x={WAL.x} y={WAL.y} lit={1} />
            <Plinth x={IA.x} y={IA.y} lit={1} />
            <Shadow x={IA.x} y={IA.y} />
            <Cartridge x={IA.x} y={IA.y} z={PAD_H} gold={1} frame={f} hash={hash} />
            <OnFloor x={WAL.x} y={WAL.y} w={CART.w + 40 + lift * 0.3} d={CART.d + 40 + lift * 0.3} z={PAD_H + 1}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 30, background: `rgba(0,0,0,${0.5 * (1 - rise * 0.7)})`, filter: `blur(${16 + 30 * rise}px)` }} />
            </OnFloor>
            <Cartridge x={WAL.x} y={WAL.y} z={PAD_H + lift} gold={1} frame={f} hash={hash} />
            <PlinthTag f={f} x={WAL.x} y={WAL.y} z={PAD_H + CART.h} at={W.publicW - 4} label="Walrus" sub={sub} gold fade={tagFade} />
            <PlinthTag f={f} x={IA.x} y={IA.y} z={PAD_H + CART.h} at={W.publicW + 4} label="Internet Archive" sub={sub} gold fade={tagFade} />
          </Floor>
        </AbsoluteFill>
      </AbsoluteFill>
      {f < 24 && (
        // Seam: S11's exact last frame, then the camera passes through the glass (ease-in) into the machine.
        <AbsoluteFill style={{ opacity: 1 - prog(f, 8, 22), transform: `scale(${lerp(1, 3, prog(f, 0, 24, (t) => t * t * t))})`, transformOrigin: "960px 540px" }}>
          <Sequence from={-(scene("S11").frames - 1)} layout="none"><Freeze frame={scene("S11").frames - 1}><S11 /></Freeze></Sequence>
        </AbsoluteFill>
      )}
      <Flash f={f} at={W.walrus - 4} dur={26} slot="x-walrus2" path={`walruscan.com/testnet/blob/${short(FACTS.walrusBlob)}`} rect={{ x: 70, y: 120, w: 1040, h: 585 }} tilt={1} />
      <Flash f={f} at={W.internet - 4} dur={26} slot="x-archive" path={`archive.org/details/${short(FACTS.archiveItem)}`} rect={{ x: 810, y: 120, w: 1040, h: 585 }} tilt={-1} />
      {hand > 0 && (
        <AbsoluteFill style={{ opacity: interpolate(hand, [0, 1], [0, 1], CL) }}>
          <Freeze frame={0}><S13 /></Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
