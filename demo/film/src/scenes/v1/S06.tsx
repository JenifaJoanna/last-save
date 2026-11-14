// S06 Try to kill it (9.8 s, V06 at 0.3 s). Opens in S05's machine on the glowing licence contract block ("0 access
// keys"); the camera rises and pulls back until the floor is the CRT and the bezel frames it: ScreenFrame "Try to kill it".
// The camera pushes onto the attack menu and the attacker log, and the `attack` take is cut so each refusal prints on
// its word ("release", "fake", "drain"; 4 and 5 together on "refuses"); red lines lift 1.3x under the menu.
// A 1-s `x-attack` explorer flash, then the camera eases back to the full screen with the last red line held, and the
// screen content rolls up one screen height (10 f, stepped) onto the `t-factory` terminal take that opens S07.
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Camera, CONTENT, ScreenFrame } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { HITS, LEAD, PUSH } from "./g3/attack";
import { AttackTake } from "./g3/AttackTake";
import { FACTORY } from "./g3/factory";
import { Flash } from "./g3/Flash";
import { easeInOut, easeOut, lerp, prog } from "./g3/motion";
import { Machine } from "./g3/Machine";
import { TermTake } from "./g3/TermTake";

const ATTACK_HINTS = ["1-5 attack", "↑↓ choose", "Enter run", "S summary"];
const Z0 = 1.32; // at f0 the content rect fills the frame: the machine is all we see

export function S06() {
  const f = useCurrentFrame();
  const total = scene("S06").frames;
  const ROLL = total - 10;
  const FLASH = HITS[HITS.length - 1].cue + 12;

  // Camera: pull back out of the machine (f0-22), hold on the titled screen, push onto menu + log (40-70), drift,
  // then ease back to the full screen after the flash so S07 starts on the settled ScreenFrame.
  const pull = prog(f, 0, 22, easeInOut);
  const push = prog(f, 40, 70, easeOut) * (1 - prog(f, FLASH + 30, ROLL - 2, easeInOut));
  const drift = 1 + 0.025 * prog(f, 70, FLASH + 30);
  const scale = lerp(lerp(Z0, 1, pull), PUSH.scale * drift, push);
  const fy = lerp(536, PUSH.fy, push);

  const machine = f < 24 ? 1 - stepped(prog(f, 12, 22), 5) : 0;
  const roll = stepped(prog(f, ROLL - 1, total - 1), 5) * CONTENT.h;
  const rolling = f >= ROLL;
  const live = HITS.filter((h) => f >= h.cue - LEAD).length;
  const hit = HITS[Math.max(0, live - 1)];
  const n = hit.rows[hit.rows.length - 1].n;
  const pressed = f >= hit.cue - LEAD + 2 && f < hit.cue - LEAD + 5 ? `Attack ${n}` : null;

  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Camera scale={scale} fx={PUSH.fx} fy={fy}>
        <ScreenFrame title={rolling ? "Terminal" : "Try to kill it"} titleAt={rolling ? ROLL : 8} mode="online"
          hints={rolling ? undefined : ATTACK_HINTS} keys={rolling ? undefined : { primary: `Attack ${n}`, pressed }}>
          <AbsoluteFill style={{ transform: `translateY(${-roll}px)` }}>
            <AttackTake f={f} total={total} />
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
      <Flash f={f} at={FLASH} dur={30} slot="x-attack" path="testnet.nearblocks.io/txns/…" />
    </AbsoluteFill>
  );
}
