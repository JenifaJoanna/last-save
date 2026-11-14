// S12 Preserved (6.9 s, V11 at 0.2 s): "The build is already stored for good, on Walrus and on the Internet Archive,
// waiting for its key." Judge instance ember-rift: its ENCRYPTED build, stored, key still sealed (not a released build).
// Opens on S11's exact last frame and passes through the glass into the machine. Two encrypted cartridges (padlocked,
// scrambled art, the artifact's sha256 on the front) sit on WALRUS and INTERNET ARCHIVE plinths; the sha256 = on-chain
// key line lifts on "stored". `x-walrus2` (until it lands: the ember-rift `x-walrus` take) flashes on "Walrus",
// `x-archive` on "Internet Archive". "waiting for its key": the camera turns to the OutLayer enclave, key sealed inside,
// and the padlocks pulse. End: the Walrus copy rises toward the camera and resolves into S13's first frame.
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Void } from "../../ds/crt";
import { T } from "../../ds/tokens";
import { rs, shortHash } from "../../film/run";
import { slotSource } from "../../film/Slot";
import { scene } from "../../film/timeline";
import { Grid, OnFloor, Tag } from "../../frames/c/iso";
import { ENC, Enclave, KeyGlyph, PAD_H, Padlock, Plinth } from "../../frames/c/parts";
import { Cartridge, CART } from "./g2/Cartridge";
import { Flash } from "./g2/Flash";
import { Billboard, type Cam, Floor, project } from "./g2/iso";
import { PlinthTag, pr, Tick } from "./g2/MachineTags";
import { beat, CL, easeInOut, keys, lerp, prog } from "./g2/motion";
import { KeyReleasedLine, StoredShaLine } from "./g2/StoredLine";
import { RELEASED_KEY_PROOF, S12_KEY } from "./g2/facts";
import { voFrame } from "../../film/timeline";
import V11P from "../../../vo/variants/V11-keypublic.json";
import { S11 } from "./S11";
import { S13 } from "./S13";

const TEX = 0.45; // plinth tags and flashes are texture; the sha256 band is the key line
const WAL = { x: -340, y: -340 }, IA = { x: -20, y: -20 }; // enclave (frames/c ENC) sits at (300, 300), right of them
// S12_KEY "sealed": the committed V11 ("…waiting for its key"). "public": V11-keypublic ("…and now its key is public"),
// word starts read from vo/variants/V11-keypublic.json; `waiting` is then "now" (the turn to the enclave) and `key`
// is "public" (the Walrus copy rises after it).
const PUBLIC = S12_KEY === "public";
const pw = (w: string) => voFrame("S12") + Math.round(V11P.words.find((x) => x.w.replace(/[^a-z]/gi, "").toLowerCase() === w)!.s * 30);
const W = PUBLIC
  ? { stored: pw("stored"), walrus: pw("walrus"), internet: pw("internet"), waiting: pw("now"), keyWord: pw("key"), key: pw("public") }
  : { stored: beat("S12", 1.36), walrus: beat("S12", 2.74), internet: beat("S12", 3.88), waiting: beat("S12", 5.2), keyWord: beat("S12", 5.92), key: beat("S12", 5.92) };
const RISE = W.key + 2;          // the Walrus copy lifts toward the camera after "key" (public: after "public")
const RELEASED_KEY = rs("releasedKey").startsWith("MISSING") ? RELEASED_KEY_PROOF : rs("releasedKey");
const LAST = scene("S12").frames - 1;
const HANDOFF = LAST - 10;       // dissolve into S13's first frame (LAST = S13 f0 exactly)
const SHA = shortHash(rs("buildSha"));
const BLOB = shortHash(rs("walrusBlob"));
const ITEM = shortHash(rs("archiveItem"));
const WALRUS_SLOT = slotSource("x-walrus2").kind === "raw" ? "x-walrus2" : "x-walrus";

function Shadow({ x, y }: { x: number; y: number }) {
  return <OnFloor x={x} y={y} w={CART.w + 40} d={CART.d + 40} z={PAD_H + 1}><div style={{ position: "absolute", inset: 0, borderRadius: 30, background: "rgba(0,0,0,0.5)", filter: "blur(16px)" }} /></OnFloor>;
}

export function S12() {
  const f = useCurrentFrame();
  const thru = prog(f, 0, 24, easeInOut);
  const rise = prog(f, RISE, LAST, easeInOut);
  const mid = { x: (WAL.x + IA.x) / 2, y: (WAL.y + IA.y) / 2 };
  const look = prog(f, W.waiting - 8, W.waiting + 16, easeInOut); // turn to the enclave on "waiting"
  const cam: Cam = {
    tx: lerp(lerp(mid.x, 60, look), WAL.x, rise), ty: lerp(lerp(mid.y, 60, look), WAL.y, rise),
    s: keys(f, [[0, 1.16], [24, 1.06], [W.waiting - 8, 1.12], [W.waiting + 16, 0.98], [RISE, 1.0], [LAST, 1.7]]),
    spin: keys(f, [[0, -45], [LAST, -35]]),
  };
  const ws = lerp(1.15, 1, thru);
  const lift = 300 * rise;
  const copy = project(WAL.x, WAL.y, PAD_H + lift + CART.h / 2, cam);
  const dx = (960 - copy.x) * rise, dy = (470 - copy.y) * rise;
  const sub = <span style={{ display: "inline-flex", alignItems: "center", color: T.gold }}>sha256 {SHA}<span style={{ color: T.muted }}>&nbsp;= on-chain</span><Tick size={20} /></span>;
  const tagFade = 1 - prog(f, W.waiting - 10, W.waiting);
  // "waiting for its key": the padlocks stamp again and the sealed key glows in the enclave.
  const seal = PUBLIC ? 0 : interpolate(f, [W.waiting - 2, W.waiting + 4, W.waiting + 30], [0, 1, 0.5], CL);
  const sealTag = pr(f, W.waiting) * (1 - prog(f, RISE, RISE + 8));
  // "public" mode: on "now" the enclave lights, on "key" the key rises out of it, on "public" it rings once.
  const open = PUBLIC ? prog(f, W.waiting - 2, W.waiting + 10) : 0;
  const keyUp = PUBLIC ? prog(f, W.keyWord - 4, W.keyWord + 14, easeInOut) : 0;
  const ring = PUBLIC ? interpolate(f, [W.key - 2, W.key + 4, W.key + 24], [0, 1, 0.3], CL) : 0;
  const hand = prog(f, HANDOFF, LAST);

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
            <Cartridge x={IA.x} y={IA.y} z={PAD_H} enc={1 - 0.3 * seal} frame={f} hash={`sha256 ${SHA}`} clearHash />
            <OnFloor x={WAL.x} y={WAL.y} w={CART.w + 40 + lift * 0.3} d={CART.d + 40 + lift * 0.3} z={PAD_H + 1}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 30, background: `rgba(0,0,0,${0.5 * (1 - rise * 0.7)})`, filter: `blur(${16 + 30 * rise}px)` }} />
            </OnFloor>
            <Cartridge x={WAL.x} y={WAL.y} z={PAD_H + lift} enc={1 - 0.3 * seal} frame={f + 7} hash={`sha256 ${SHA}`} clearHash />
            <Enclave glow={0.35 + 0.65 * Math.max(seal, open)} />
            <Billboard x={ENC.x} y={ENC.y} z={175 + 330 * keyUp}>
              <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(-50%, -50%) scale(${1 + 0.35 * keyUp})`, opacity: 0.55 + 0.45 * Math.max(seal, open) }}><KeyGlyph size={120} /></div>
              {ring > 0 && <div style={{ position: "absolute", left: -90 - 60 * ring, top: -90 - 60 * ring, width: 180 + 120 * ring, height: 180 + 120 * ring, borderRadius: "50%",
                border: `3px solid rgba(255,201,74,${0.8 * (1 - ring * 0.6)})`, boxShadow: `0 0 ${40 * ring}px rgba(255,201,74,0.5)` }} />}
            </Billboard>
            {sealTag > 0 && (
              <Billboard x={ENC.x - ENC.s / 2} y={ENC.y - ENC.s / 2} z={ENC.s}>
                <div style={{ transform: `translateX(${(1 - sealTag) * -14}px)` }}>
                  {PUBLIC
                    ? <Tag label="Key released on chain" sub="OutLayer · Intel TDX" side="left" lift={40} opacity={sealTag} accent="rgba(255,201,74,0.7)" color={T.gold} />
                    : <Tag label="Key sealed in the enclave" sub="OutLayer · Intel TDX · waiting" side="left" lift={40} opacity={sealTag} accent="rgba(79,216,208,0.6)" color={T.cyan}
                      icon={<Padlock size={22} color={T.cyan} />} />}
                </div>
              </Billboard>
            )}
            <PlinthTag f={f} x={WAL.x} y={WAL.y} z={PAD_H + CART.h} at={W.stored - 2} label="Walrus" sub={sub} gold fade={tagFade * TEX} />
            <PlinthTag f={f} x={IA.x} y={IA.y} z={PAD_H + CART.h} at={W.stored + 4} label="Internet Archive" sub={sub} gold fade={tagFade * TEX} />
          </Floor>
        </AbsoluteFill>
      </AbsoluteFill>
      {f < 24 && (
        // Seam: S11's exact last frame, then the camera passes through the glass (ease-in) into the machine.
        <AbsoluteFill style={{ opacity: 1 - prog(f, 8, 22), transform: `scale(${lerp(1, 3, prog(f, 0, 24, (t) => t * t * t))})`, transformOrigin: "960px 540px" }}>
          <Sequence from={-(scene("S11").frames - 1)} layout="none"><Freeze frame={scene("S11").frames - 1}><S11 /></Freeze></Sequence>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ filter: "blur(2px)" }}>
        <Flash f={f} at={W.walrus - 4} dur={26} dial={8} slot={WALRUS_SLOT} path={`walruscan.com/testnet/blob/${BLOB}`} from={1.0} crop={{ x: 0.04, y: 0.13, w: 0.56, h: 0.56 }} rect={{ x: 70, y: 110, w: 1040, h: 585 }} tilt={1} />
        <Flash f={f} at={W.internet - 4} dur={26} dial={8} slot="x-archive" path={`archive.org/details/${ITEM}`} from={1.0} rect={{ x: 810, y: 110, w: 1040, h: 585 }} tilt={-1} />
      </AbsoluteFill>
      <StoredShaLine f={f} at={W.stored - 2} out={W.waiting - 6} />
      {PUBLIC && <KeyReleasedLine f={f} at={W.waiting + 2} value={RELEASED_KEY} />}
      {hand > 0 && (
        <AbsoluteFill style={{ opacity: interpolate(hand, [0, 1], [0, 1], CL) }}>
          <Freeze frame={0}><S13 /></Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
