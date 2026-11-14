// S09 part 1: the live match full-frame; on "goes dark" the studio's terminal dials up over it (t-kill, then t-404
// with HTTP/2 530 labelled "gone"); the window collapses onto CONNECTION LOST; then the whole game client powers off
// like a CRT into a white line that reddens and drops onto the flatline (style frame A, at full-frame scale).
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { slotSource } from "../../../film/Slot";
import { Label, Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { ARENA, FL, GONE_LINES, GONE_ROW, KILL_LINES, TAKE_FROM } from "./facts";
import { Bracket, CrtWindow, DialBox, lin, out, printIn, SlotAt, TermTake } from "./kit";
import { S9 } from "./t09";

const WIN = { x: 120, y: 344, w: 1680, h: 392 }; // term take top band (1800×420) at 0.933
const s = WIN.w / 1800;

/** Stand-in for the game client's CONNECTION LOST overlay, drawn only while the `lost` take is missing. */
function LostStandIn({ at }: { at: number }) {
  const f = useCurrentFrame();
  if (slotSource("lost").kind === "raw" || f < at) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: `rgba(10,8,20,${0.55 * printIn(f, at)})` }}>
      <div style={{ opacity: printIn(f, at), textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Label size={64} weight={700} color={T.text} track={0.14}>Connection lost</Label>
        <Mono size={24} color={T.muted}>official server unreachable · reconnecting…</Mono>
      </div>
    </AbsoluteFill>
  );
}

/** S08's LS-0001 chip under the game's own server chip, carried over; it flips to Offline when the servers stop. */
function ServerChip() {
  const f = useCurrentFrame();
  const off = f >= S9.chipOff;
  const c = off ? T.dead : T.alive;
  const blink = Math.floor(f / 36) % 2 === 0;
  const p = off ? printIn(f, S9.chipOff) : 1;
  return (
    <div style={{ position: "absolute", right: 18, top: 64, display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
      background: "rgba(18,14,34,0.88)", border: `1px solid ${T.line2}`, borderLeft: `3px solid ${c}`, borderRadius: 4 }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: c, opacity: blink ? 1 : 0.4, boxShadow: `0 0 8px ${c}` }} />
      <Label size={18} color={T.text}>Official server · <span style={{ color: c, opacity: 0.4 + 0.6 * p }}>{off ? "Offline" : "Online"}</span></Label>
    </div>
  );
}

export function KillOpen() {
  const f = useCurrentFrame();
  // the game client: match (continuing S08), then the take recorded through the kill once the window covers the cut
  const lost = f >= S9.goneAt;
  const push = lost ? lin(f, S9.winClose, S9.collapse, 1.04, 1.09, out) : lin(f, 0, S9.goneAt, ARENA.scale, 1.04);
  const dim = f < S9.winClose + 8 ? lin(f, S9.dial, S9.win, 1, 0.42) : lin(f, S9.winClose + 4, S9.winClose + 12, 0.42, 1);
  // CRT power-off of the whole client: scaleY 1 → 0.006 (10 f, ease-in cubic) with a white bloom
  const sy = lin(f, S9.collapse, S9.collapse + 10, 1, 0.006, Easing.in(Easing.cubic));
  const flash = lin(f, S9.collapse + 4, S9.collapse + 10, 0, 1);
  const gone = f >= S9.collapse + 10;
  // the line: white, full width; reddens and narrows to the screen width; drops onto the flatline (content y FL)
  const red = lin(f, S9.redden, S9.redden + 10, 0, 1);
  const inset = lin(f, S9.redden, S9.redden + 10, 0, 21, out);
  const lineY = lin(f, S9.drop, S9.drop + 16, 540, 102 + FL, out);
  const lineOn = f >= S9.collapse + 6 && f < S9.drop + 18;
  const bloomW = lin(f, S9.collapse + 6, S9.redden + 6, 1, 0);
  const tagP = printIn(f, S9.goneTag);
  const rowY = (10 + 40 + 18 + 34 * GONE_ROW + 17) * s;

  return (
    <AbsoluteFill>
      {!gone && (
        <AbsoluteFill style={{ transform: `scaleY(${sy})`, transformOrigin: "50% 50%", filter: `brightness(${dim * (1 + flash * 1.6)}) saturate(${1 + flash})` }}>
          <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `${ARENA.x}px ${ARENA.y}px` }}>
            {lost ? <SlotAt at={S9.goneAt} slot="lost" plate="kill-lost.png" from={TAKE_FROM.lost} /> : <SlotAt at={0} slot="match" plate="match.png" from={TAKE_FROM.match} />}
            {lost && <LostStandIn at={S9.winClose + 13} />}
          </AbsoluteFill>
          <ServerChip />
          <AbsoluteFill style={{ opacity: flash, background: "linear-gradient(180deg, transparent 10%, rgba(255,236,228,0.55) 40%, #fff4ee 50%, rgba(255,236,228,0.55) 60%, transparent 90%)", mixBlendMode: "screen" }} />
        </AbsoluteFill>
      )}
      {lineOn && (
        <>
          <div style={{ position: "absolute", left: -200, right: -200, top: lineY - 70, height: 140, opacity: bloomW * 0.6, borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(255,236,228,0.85), rgba(255,77,94,0.2) 60%, transparent)" }} />
          <div style={{ position: "absolute", left: inset, right: inset, top: lineY - 2, height: 4, borderRadius: 2,
            background: `rgb(255, ${Math.round(255 - red * 178)}, ${Math.round(255 - red * 161)})`,
            boxShadow: `0 0 ${10 + 22 * (1 - red)}px rgba(255,77,94,0.9), 0 0 60px rgba(255,77,94,${0.35 * red})` }} />
        </>
      )}
      <DialBox at={S9.dial} path="studio-ops" s={1.9} />
      <CrtWindow open={S9.win} close={S9.winClose} x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.75)", borderRadius: 14 }}>
        {f < S9.goneAt
          ? <TermTake slot="t-kill" from={TAKE_FROM.kill} lines={KILL_LINES} at={S9.killAt} startAt={S9.win} gap={12} title="Studio ops" w={WIN.w} />
          : <TermTake slot="t-404" from={TAKE_FROM.gone} lines={GONE_LINES} at={S9.goneAt} gap={9} title="Studio download" w={WIN.w} />}
        {f >= S9.goneTag && (
          <div style={{ position: "absolute", left: 250 * s + 36, top: rowY - 20, height: 40, display: "flex", alignItems: "center", gap: 12, opacity: tagP,
            transform: `translateX(${(1 - tagP) * -14}px)` }}>
            <Mono size={26} color={T.dead}>◂</Mono>
            <div style={{ position: "relative", border: `2px solid ${T.dead}`, padding: "2px 14px" }}>
              <Label size={22} weight={700} color={T.dead}>gone</Label>
            </div>
          </div>
        )}
        <div style={{ position: "absolute", inset: 3 }}><Bracket color={T.ember} /></div>
      </CrtWindow>
    </AbsoluteFill>
  );
}
