// S06 Try to kill it (9.8 s, V06 at 0.3 s). Opens in S05's machine on the glowing licence contract block ("0 access
// keys"); the camera rises and pulls back until the floor is the CRT and the bezel frames it: ScreenFrame "Try to kill
// it", whose page title is the first readable line. A 1-s `x-attack` explorer flash, then the `attack` take is cut so
// each refusal prints on its word ("release", "fake", "drain"; 4 and 5 together on "refuses"). As each prints, the take
// drops to texture and the refusal lifts off the log as 56 px film type into a stacked list under "Refused n/5". All
// five hold together, then the screen content (take and list) rolls up one screen height (10 f, stepped) onto the
// `t-factory` terminal take that opens S07.
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Camera, CONTENT, ScreenFrame } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { FLASH_AT, HITS, LEAD, TEXTURE } from "./g3/attack";
import { AttackTake, RefusalList } from "./g3/AttackTake";
import { FACTORY } from "./g3/factory";
import { Flash } from "./g3/Flash";
import { Machine } from "./g3/Machine";
import { easeInOut, lerp, prog } from "./g3/motion";
import { TermTake } from "./g3/TermTake";

const ATTACK_HINTS = ["1-5 attack", "↑↓ choose", "Enter run", "S summary"];
const Z0 = 1.32; // at f0 the content rect fills the frame: the machine is all we see
const FY = CONTENT.y + CONTENT.h / 2;

export function S06() {
  const f = useCurrentFrame();
  const total = scene("S06").frames;
  const ROLL = total - 10;

  // Camera: pull back out of the machine (f0-22), a slow +3 % push on the page, eased back to 1.0 before the roll.
  const pull = prog(f, 0, 22, easeInOut);
  const scale = lerp(Z0, 1, pull) * (1 + 0.03 * prog(f, 22, 200) - 0.03 * prog(f, 236, ROLL - 2, easeInOut));
  const toScreen = (x: number, y: number) => ({ x: 960 + (x - 960) * scale, y: FY + (y - FY) * scale });

  const machine = f < 24 ? 1 - stepped(prog(f, 12, 22), 5) : 0;
  const texture = stepped(prog(f, HITS[0].cue - 4, HITS[0].cue + 2), 3);
  const roll = stepped(prog(f, ROLL - 1, total - 1), 5) * CONTENT.h;
  const rolling = f >= ROLL;
  const live = HITS.filter((h) => f >= h.cue - LEAD).length;
  const hit = HITS[Math.max(0, live - 1)];
  const n = hit.rows[hit.rows.length - 1].n;
  const pressed = f >= hit.cue - LEAD + 2 && f < hit.cue - LEAD + 5 ? `Attack ${n}` : null;

  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Camera scale={scale} fx={960} fy={FY}>
        <ScreenFrame title={rolling ? "Terminal" : "Try to kill it"} titleAt={rolling ? ROLL : 8} mode="online"
          hints={rolling ? undefined : ATTACK_HINTS} keys={rolling ? undefined : { primary: `Attack ${n}`, pressed }}>
          <AbsoluteFill style={{ transform: `translateY(${-roll}px)` }}>
            <AbsoluteFill style={{ opacity: lerp(1, TEXTURE.opacity, texture), filter: texture > 0 ? `blur(${TEXTURE.blur * texture}px)` : undefined }}>
              <AttackTake total={total} />
            </AbsoluteFill>
            {machine > 0 && <AbsoluteFill style={{ opacity: machine }}><Machine f={f} /></AbsoluteFill>}
          </AbsoluteFill>
          {f >= ROLL - 1 && (
            <AbsoluteFill style={{ transform: `translateY(${CONTENT.h - roll}px)` }}>
              <Sequence from={ROLL} layout="none"><TermTake slot={FACTORY.slot} from={Math.max(0, FACTORY.from - 10 / 30)} /></Sequence>
            </AbsoluteFill>
          )}
          {rolling && roll < CONTENT.h && (
            <div style={{ position: "absolute", left: 0, right: 0, top: CONTENT.h - roll - 3, height: 6, background: "rgba(239,229,208,0.55)", boxShadow: "0 0 18px rgba(239,229,208,0.35)" }} />
          )}
        </ScreenFrame>
      </Camera>
      {/* the list rides the roll with the screen content and is clipped to the CRT content rect */}
      <AbsoluteFill style={{ clipPath: `inset(${CONTENT.y}px ${1920 - CONTENT.x - CONTENT.w}px ${1080 - CONTENT.y - CONTENT.h}px ${CONTENT.x}px)` }}>
        <AbsoluteFill style={{ transform: `translateY(${-roll}px)` }}><RefusalList f={f} toScreen={toScreen} camScale={scale} /></AbsoluteFill>
      </AbsoluteFill>
      <Flash f={f} at={FLASH_AT} dur={30} slot="x-attack" path="testnet.nearblocks.io/txns/…" />
    </AbsoluteFill>
  );
}
