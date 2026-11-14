// S09 part 2, inside the ScreenFrame's content area (1878×868): the red flatline; the /status `reports` take opening
// out of it (CRT power-on); the camera reads the take's own events in the upper half while the lifted log prints
// below: the counted probe failure and the not-counted runs, then holder report 1/2 on "report" and 2/2 (quorum, the
// page flips GONE DARK) on "down"; on "the contract" the page folds back into the flatline.
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { FL, LOG_LINES, REPORT_CUTS } from "./facts";
import { Bracket, JumpLabel, lin, out, printIn, SlotAt } from "./kit";
import { S9 } from "./t09";

const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };
const inOut = Easing.inOut(Easing.cubic);
/** Camera keys at S9.cam frames: scale, a take point (1920 basis) and where it sits in the content area. While the take
 * plays, the lifted log sits in the top third, so every take event is framed below y 340. */
const CAM: { s: number; F: [number, number]; L: [number, number] }[] = [
  { s: 1, F: [960, 536], L: [939, 434] }, //       the whole page: ALIVE, heartbeat
  { s: 1.55, F: [528, 840], L: [520, 660] }, //    proof-of-life rows: 1/3 FAILED, NOT COUNTED ×2
  { s: 1.55, F: [528, 840], L: [520, 660] },
  { s: 1.55, F: [960, 668], L: [939, 640] }, //    players decide: 1/2 holder reports
  { s: 1.55, F: [960, 668], L: [939, 640] }, //    … 2/2
  { s: 1.15, F: [650, 400], L: [700, 520] }, //    the page flips GONE DARK
];
function camAt(f: number) {
  const k = S9.cam;
  let i = 0;
  while (i < k.length - 2 && f >= k[i + 1]) i++;
  const e = lin(f, k[i], k[i + 1], 0, 1, inOut);
  const a = CAM[i], b = CAM[i + 1], m = (x: number, y: number) => x + (y - x) * e;
  const s = m(a.s, b.s);
  const F = [m(a.F[0], b.F[0]) - 21, m(a.F[1], b.F[1]) - 102], L = [m(a.L[0], b.L[0]), m(a.L[1], b.L[1])];
  return { s, x: L[0] - F[0] * s, y: L[1] - F[1] * s };
}

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

export const LOG_POS = { x: 180, y: FL + 50, lh: 48, top: 82 }; // top: where the log sits while the take plays
const TONE = { dead: T.dead, amber: T.amber, gold: T.gold } as const;

/** The lifted log (30 px mono), with an ink backing panel while the take is behind it. */
export function ProbeLog() {
  const f = useCurrentFrame();
  if (f < S9.lift) return null;
  const at = S9.log;
  const panel = lin(f, S9.lift, S9.lift + 8, 0, 0.94) * lin(f, S9.fold + 14, at[4], 1, 0);
  const y0 = lin(f, S9.fold, S9.fold + 14, LOG_POS.top, LOG_POS.y, out); // a full-width band over the take, then it slides down
  // and narrows to its hero place as the page folds
  return (
    <>
      <div style={{ position: "absolute", left: lin(f, S9.fold, S9.fold + 14, 24, LOG_POS.x - 36), top: y0 - 26, width: lin(f, S9.fold, S9.fold + 14, 1830, 960), height: LOG_POS.lh * 5 + 50, background: `rgba(18,14,34,${panel})`,
        border: `1px solid rgba(196,182,255,${(0.24 * panel) / 0.94})`, boxShadow: `0 30px 90px rgba(0,0,0,${0.6 * panel})` }}>
        {panel > 0.05 && <Bracket color={T.dead} />}
      </div>
      {LOG_LINES.map((l, i) => f >= at[i] && (
        <div key={l.text} style={{ position: "absolute", left: LOG_POS.x, top: y0 + i * LOG_POS.lh, opacity: printIn(f, at[i]), transform: `translateX(${(1 - printIn(f, at[i])) * -14}px)` }}>
          <Mono size={30} color={T.muted} style={{ lineHeight: `${LOG_POS.lh}px` }}>{l.text}<span style={{ color: TONE[l.c], fontWeight: 600 }}>{l.res}</span>{l.tail}</Mono>
        </div>
      ))}
    </>
  );
}

/** The reports take in the content area: opens out of the flatline, the camera reads its events, it folds back. */
export function StatusTake() {
  const f = useCurrentFrame();
  if (f < S9.powerOn || f >= S9.fold + 8) return null;
  const sy = f < S9.fold ? lin(f, S9.powerOn, S9.powerOn + 8, 0.006, 1, out) : lin(f, S9.fold, S9.fold + 8, 1, 0.006, Easing.in(Easing.cubic));
  const bright = f < S9.powerOn + 8 ? lin(f, S9.powerOn, S9.powerOn + 8, 2.2, 1) : lin(f, S9.fold + 3, S9.fold + 8, 1, 2);
  const cam = camAt(f);
  const cuts = REPORT_CUTS.map((c, i) => ({ ...c, at: Math.max(c.at, S9.powerOn), end: REPORT_CUTS[i + 1]?.at ?? 9999 }));
  const cur = cuts.filter((c) => f >= c.at).pop()!;
  return (
    <>
      <AbsoluteFill style={{ transform: `scaleY(${sy})`, transformOrigin: `50% ${FL}px`, filter: `brightness(${bright})` }}>
        <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }}>
          {cuts.map((c) => f >= c.at && f < c.end && <SlotAt key={c.at} at={c.at} slot="reports" plate="status-dead.png" from={c.from} crop={CONTENT_CROP} tag={c === cur} />)}
        </AbsoluteFill>
      </AbsoluteFill>
      {cur.label && f < S9.fold && <JumpLabel text={cur.label} p={printIn(f, cur.at) * lin(f, Math.min(cur.end, S9.fold) - 4, Math.min(cur.end, S9.fold), 1, 0)} />}
    </>
  );
}
