// S09 part 3 (style frame A's hero, inside the ScreenFrame content area): on "marks it dead" GONE DARK prints in red
// bands, the dead sun rises on the flatline, and the alert card slides in (the `discord` take, or its dry-run line).
import { useCurrentFrame } from "remotion";
import { Slot, slotSource } from "../../../film/Slot";
import { Display, Eyebrow, Label, Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { ALERT, FL } from "./facts";
import { DeadSun, lin, out, printIn } from "./kit";
import { S9 } from "./t09";

const CARD = { x: 1150, y: FL + 160, w: 640, h: 210 };

function AlertCard() {
  const f = useCurrentFrame();
  if (f < S9.alert) return null;
  const p = lin(f, S9.alert, S9.alert + 14, 0, 1, out);
  const hasTake = slotSource("discord").kind !== "none";
  return (
    <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, transform: `translateX(${(1 - p) * 140}px)`, opacity: printIn(f, S9.alert),
      background: T.ink2, border: `1px solid ${T.line2}`, borderLeft: `5px solid ${T.dead}`, boxShadow: "0 30px 90px rgba(0,0,0,0.6)", boxSizing: "border-box", padding: "20px 26px", overflow: "hidden" }}>
      <Eyebrow size={18} color={T.faint}>Alert · Last Save #status</Eyebrow>
      <Label size={30} weight={700} track={0.08} color={T.dead} style={{ marginTop: 12, textTransform: "none" }}>{ALERT.title}</Label>
      {hasTake ? (
        <div style={{ position: "relative", marginTop: 12, height: 74 }}><Slot slot="discord" /></div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <Mono size={18} color={T.faint} style={{ lineHeight: "28px" }}>{ALERT.cmd}</Mono>
          <Mono size={22} color={T.text} style={{ lineHeight: "32px" }}>{ALERT.line}</Mono>
        </div>
      )}
    </div>
  );
}

export function Hero() {
  const f = useCurrentFrame();
  if (f < S9.eyebrow) return null;
  const tp = printIn(f, S9.title);
  return (
    <>
      <div style={{ position: "absolute", left: 186, top: 58, opacity: printIn(f, S9.eyebrow) }}>
        <Eyebrow size={24} color={T.dead}>Players decide · Ember Rift official server</Eyebrow>
      </div>
      {f >= S9.title && (
        <div style={{ position: "absolute", left: 180, top: 110, opacity: tp, transform: `translateX(${(1 - tp) * -14}px)` }}>
          <Display size={176} tone="dead">Gone dark</Display>
        </div>
      )}
      {f >= S9.sun && <DeadSun x={1560} y={FL} r={110} p={printIn(f, S9.sun)} />}
      <AlertCard />
    </>
  );
}
