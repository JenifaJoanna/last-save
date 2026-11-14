// S09 part 2, inside the dead ScreenFrame's content area (1878×868): the red flatline; the /status take opening out of
// it (CRT power-on) and pushing toward the proof-of-life card in real-time segments; on "checks fail three times" the
// probe log lifts over the dimmed take; on "the contract" the page folds back into the flatline.
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { FL, PROBE_CUTS } from "./facts";
import { Bracket, JumpLabel, lin, out, printIn, SlotAt } from "./kit";
import { S9 } from "./t09";

const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };
const FOCUS = { x: 515, y: 868 }; // proof-of-life card ("Is the studio still serving players?") in content px; at 1.94× its
// probe lines read at ~25 px and the hero card above stays out of frame

/** The red flatline with a slow travelling glow. */
export function Flatline({ from }: { from: number }) {
  const f = useCurrentFrame();
  const sweep = (((f - from) * 9) % 2600) - 360;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: FL - 2, height: 4 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 2, background: T.dead, boxShadow: "0 0 10px rgba(255,77,94,0.9), 0 0 60px rgba(255,77,94,0.35)" }} />
      <div style={{ position: "absolute", left: sweep, width: 360, top: -1, height: 6, borderRadius: 3, background: "linear-gradient(90deg, transparent, rgba(255,180,186,0.85), transparent)" }} />
    </div>
  );
}

export const LOG = [
  { text: "> PROBE 1/3 .......... ", res: "FAILED", tail: "  unreachable" },
  { text: "> PROBE 2/3 .......... ", res: "FAILED", tail: "  unreachable" },
  { text: "> PROBE 3/3 .......... ", res: "FAILED", tail: "  unreachable" },
  { text: "> STUDIO DECLARED GONE  ", res: "DEAD", tail: "" },
];
export const LOG_POS = { x: 180, y: FL + 50, lh: 48 };

/** The lifted probe log (30 px mono), with an ink backing panel while the take is behind it. */
export function ProbeLog() {
  const f = useCurrentFrame();
  if (f < S9.lift) return null;
  const at = [...S9.probe, S9.declared];
  const panel = lin(f, S9.lift, S9.lift + 8, 0, 0.94) * lin(f, S9.fold + 8, S9.declared, 1, 0);
  return (
    <>
      <div style={{ position: "absolute", left: LOG_POS.x - 36, top: LOG_POS.y - 26, width: 900, height: LOG_POS.lh * 4 + 50, background: `rgba(18,14,34,${panel})`,
        border: `1px solid rgba(196,182,255,${0.24 * panel / 0.94})`, boxShadow: `0 30px 90px rgba(0,0,0,${0.6 * panel})` }}>
        {panel > 0.05 && <Bracket color={T.dead} />}
      </div>
      {LOG.map((l, i) => f >= at[i] && (
        <div key={l.text} style={{ position: "absolute", left: LOG_POS.x, top: LOG_POS.y + i * LOG_POS.lh, opacity: printIn(f, at[i]), transform: `translateX(${(1 - printIn(f, at[i])) * -14}px)` }}>
          <Mono size={30} color={T.muted} style={{ lineHeight: `${LOG_POS.lh}px` }}>{l.text}<span style={{ color: T.dead, fontWeight: 600 }}>{l.res}</span>{l.tail}</Mono>
        </div>
      ))}
    </>
  );
}

/** The /status take in the content area: opens out of the flatline, pushes in, dims under the log, folds back. */
export function StatusTake() {
  const f = useCurrentFrame();
  if (f < S9.powerOn || f >= S9.fold + 8) return null;
  const sy = f < S9.fold ? lin(f, S9.powerOn, S9.powerOn + 8, 0.006, 1, out) : lin(f, S9.fold, S9.fold + 8, 1, 0.006, Easing.in(Easing.cubic));
  const bright = f < S9.powerOn + 8 ? lin(f, S9.powerOn, S9.powerOn + 8, 2.2, 1) : lin(f, S9.fold + 3, S9.fold + 8, 1, 2);
  const push = lin(f, S9.powerOn, S9.fold, 1.94, 2.02);
  const dim = lin(f, S9.lift, S9.lift + 10, 1, 0.38);
  const cuts = PROBE_CUTS.map((c, i) => ({ ...c, at: Math.max(c.at, S9.powerOn), end: PROBE_CUTS[i + 1]?.at ?? 9999 }));
  const cur = cuts.filter((c) => f >= c.at).pop()!;
  return (
    <>
      <AbsoluteFill style={{ transform: `scaleY(${sy})`, transformOrigin: `50% ${FL}px`, filter: `brightness(${bright * dim})` }}>
        <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `${FOCUS.x}px ${FOCUS.y}px` }}>
          {cuts.map((c) => f >= c.at && f < c.end && <SlotAt key={c.at} at={c.at} slot="probes" plate="status-dead.png" from={c.from} crop={CONTENT_CROP} tag={c === cur} />)}
        </AbsoluteFill>
      </AbsoluteFill>
      {cur.label && f < S9.fold && <JumpLabel text={cur.label} p={printIn(f, cur.at) * lin(f, Math.min(cur.end, S9.fold) - 4, Math.min(cur.end, S9.fold), 1, 0)} />}
    </>
  );
}
