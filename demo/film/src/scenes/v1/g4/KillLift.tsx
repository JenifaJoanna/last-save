// S09 lifts: the two terminal lines that carry the kill, lifted out of their take rows to 64 px under the window,
// and the label over the lost take (a new sign-in after the shutdown, not the match in progress dropping).
import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { LIFT, LOST, TERM_CROP, TERM_ROW } from "./facts";
import { Bracket, lin, out, printIn } from "./kit";
import { S9 } from "./t09";

export const WIN = { x: 120, y: 150, w: 1680, h: Math.round((1680 * TERM_CROP.h * 1080) / (TERM_CROP.w * 1920)) };
const ws = WIN.w / (TERM_CROP.w * 1920); // take px (1920 basis) → screen px
const rowAt = (i: number) => { const r = TERM_ROW(i); return { x: WIN.x + (r.x - TERM_CROP.x * 1920) * ws, y: WIN.y + (r.y - TERM_CROP.y * 1080) * ws }; };
const SIZE = 64;
const TAKE_SIZE = 26 * ws; // the take's own text size on screen
const PANEL = { x: 240, y: 488, w: 1440, h: 250 };
const LX = PANEL.x + 64;

/** One line rising from its row in the take (left edge, row centre) to (LX, toY) while it grows to 64 px. */
function LiftLine({ at, row, toY, children }: { at: number; row: number; toY: number; children: ReactNode }) {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = lin(f, at, at + 12, 0, 1, out);
  const from = rowAt(row);
  const sc = TAKE_SIZE / SIZE + (1 - TAKE_SIZE / SIZE) * p;
  const o = printIn(f, at) * (1 - printIn(f, S9.liftOut));
  return (
    <div style={{ position: "absolute", left: from.x + (LX - from.x) * p, top: from.y + (toY - from.y) * p, opacity: o, display: "flex", alignItems: "center", gap: 28,
      transform: `translateY(-50%) scale(${sc})`, transformOrigin: "0 50%" }}>
      {children}
    </div>
  );
}

export function KillLines() {
  const f = useCurrentFrame();
  if (f < S9.lift1 || f > S9.liftOut + 12) return null;
  const bg = lin(f, S9.lift1, S9.lift1 + 8, 0, 0.92) * (1 - printIn(f, S9.liftOut));
  return (
    <>
      <div style={{ position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, background: `rgba(18,14,34,${bg})`,
        border: `1px solid rgba(196,182,255,${0.26 * bg})`, boxShadow: `0 30px 90px rgba(0,0,0,${0.6 * bg})` }}>
        {bg > 0.05 && <Bracket color={T.dead} />}
      </div>
      <LiftLine at={S9.lift1} row={LIFT.deletedRow} toY={PANEL.y + 74}>
        <Mono size={SIZE} weight={500} color={T.dead} style={{ lineHeight: 1.2 }}>{LIFT.deleted}</Mono>
      </LiftLine>
      <LiftLine at={S9.lift2} row={LIFT.statusRow} toY={PANEL.y + 176}>
        <Mono size={SIZE} weight={500} color={T.text} style={{ lineHeight: 1.2 }}>{LIFT.status}</Mono>
        <Mono size={SIZE} color={T.faint} style={{ lineHeight: 1.2 }}>·</Mono>
        <div style={{ border: `3px solid ${T.dead}`, padding: "2px 22px" }}><Label size={56} weight={700} color={T.dead}>{LIFT.tag}</Label></div>
      </LiftLine>
    </>
  );
}

/** Over the lost take: what this is (a rejoin after the shutdown) and the client's own overlay text, lifted to 56 px. */
export function RejoinLabel() {
  const f = useCurrentFrame();
  if (f < S9.rejoin) return null;
  const a = printIn(f, S9.rejoin), b = printIn(f, S9.rejoin + 6), c = printIn(f, S9.rejoin + 12);
  return (
    <div style={{ position: "absolute", left: 960 - 740, top: 400, width: 1480, height: 300, boxSizing: "border-box", padding: "40px 56px",
      background: `rgba(18,14,34,${0.9 * a})`, border: `1px solid rgba(196,182,255,${0.26 * a})`, boxShadow: `0 30px 90px rgba(0,0,0,${0.6 * a})`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <Bracket color={T.ember} />
      <Label size={56} track={0.08} color={T.text} style={{ opacity: a }}>{LOST.lead}</Label>
      <Label size={56} track={0.08} color={T.gold} style={{ opacity: b, transform: `translateX(${(1 - b) * -14}px)` }}>→ {LOST.overlay}</Label>
      <Mono size={30} color={T.muted} style={{ opacity: c, lineHeight: 1.3 }}>{LOST.sub}</Mono>
    </div>
  );
}
