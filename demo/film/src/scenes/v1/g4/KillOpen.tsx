// S09 part 1: the live match (S08's last pose, then a pull back to the whole arena); on "goes dark" the studio's
// terminal dials up over it: t-kill ("✕ official server deleted" lifted on "servers stop"), t-404 ("HTTP/2 530 · gone"
// lifted on "disappears"). The match in progress keeps playing behind the window (deleting the Worker drops new
// connections only). The window closes on a hard cut to the lost take, a new sign-in after the shutdown, labelled as
// such; then that client powers off like a CRT into a line that reddens and drops onto the flatline (style frame A).
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { Label } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { scene } from "../../../film/timeline";
import { MATCH_CROP, MATCH_CUT, MATCH_FROM, playerAt } from "../g3/match";
import { FL, GONE_CUT, KILL_CUTS, LOST, TERM_CROP } from "./facts";
import { KillLines, RejoinLabel, WIN } from "./KillLift";
import { Bracket, CrtWindow, DialBox, lin, out, printIn, SlotAt } from "./kit";
import { S9 } from "./t09";

const inOut = Easing.inOut(Easing.cubic);
const S08_END = scene("S08").frames; // S09 f0 continues S08's take time and its 1.75× player crop
const MATCH_AT0 = MATCH_FROM + (S08_END - MATCH_CUT) / 30;
const START = (() => {
  const p = playerAt(MATCH_AT0), m = 8 / MATCH_CROP;
  return { x: Math.min(1920 - 960 / MATCH_CROP - m, Math.max(960 / MATCH_CROP + m, p.x)), y: Math.min(1080 - 540 / MATCH_CROP - m, Math.max(540 / MATCH_CROP + m, p.y)) };
})();

function MatchCam({ children }: { children: ReactNode }) {
  const f = useCurrentFrame();
  const e = lin(f, S9.pull[0], S9.pull[1], 0, 1, inOut);
  const s = MATCH_CROP + (1 - MATCH_CROP) * e, cx = START.x + (960 - START.x) * e, cy = START.y + (540 - START.y) * e;
  return <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})` }}>{children}</AbsoluteFill>;
}

export function KillOpen() {
  const f = useCurrentFrame();
  const lost = f >= S9.lost;
  const push = lin(f, S9.lost, S9.collapse, 1, 1.05);
  const dim = lost ? 1 : lin(f, S9.dial, S9.win, 1, 0.42);
  // CRT power-off of the lost client: scaleY 1 → 0.006 (10 f, ease-in cubic) with a white bloom
  const sy = lin(f, S9.collapse, S9.collapse + 10, 1, 0.006, Easing.in(Easing.cubic));
  const flash = lin(f, S9.collapse + 4, S9.collapse + 10, 0, 1);
  const gone = f >= S9.collapse + 10;
  // the line: white, full width; reddens and narrows to the screen width; drops onto the flatline (content y FL)
  const red = lin(f, S9.redden, S9.redden + 10, 0, 1);
  const inset = lin(f, S9.redden, S9.redden + 10, 0, 21, out);
  const lineY = lin(f, S9.drop, S9.drop + 12, 540, 102 + FL, out);
  const lineOn = f >= S9.collapse + 6 && f < S9.drop + 14;
  const bloomW = lin(f, S9.collapse + 6, S9.redden + 6, 1, 0);
  const k2 = KILL_CUTS[1];
  const jump = f >= k2.at && f < GONE_CUT.at ? printIn(f, k2.at) * lin(f, k2.at + 30, k2.at + 36, 1, 0) : 0;

  return (
    <AbsoluteFill>
      {!gone && (
        <AbsoluteFill style={{ transform: `scaleY(${sy})`, transformOrigin: "50% 50%", filter: `brightness(${dim * (1 + flash * 1.6)}) saturate(${1 + flash})` }}>
          {lost ? (
            <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "960px 400px" }}>
              <SlotAt at={S9.lost} slot="lost" plate="kill-lost.png" from={LOST.from} />
              <RejoinLabel />
            </AbsoluteFill>
          ) : (
            <MatchCam><SlotAt at={0} slot="match" plate="match.png" from={MATCH_AT0} /></MatchCam>
          )}
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
      <CrtWindow open={S9.win} close={S9.winClose} x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.75)", borderRadius: 14, background: T.ink }}>
        {f < KILL_CUTS[1].at && <SlotAt at={KILL_CUTS[0].at} slot="t-kill" from={KILL_CUTS[0].from} crop={TERM_CROP} tag={false} />}
        {f >= KILL_CUTS[1].at && f < GONE_CUT.at && <SlotAt at={KILL_CUTS[1].at} slot="t-kill" from={KILL_CUTS[1].from} crop={TERM_CROP} tag={false} />}
        {f >= GONE_CUT.at && <SlotAt at={GONE_CUT.at} slot="t-404" from={GONE_CUT.from} crop={TERM_CROP} tag={false} />}
        {jump > 0 && (
          <div style={{ position: "absolute", right: 28, top: 52, opacity: jump, background: "rgba(10,8,20,0.72)", padding: "4px 10px", borderRadius: 3 }}>
            <Label size={18} color={T.faint}>{k2.label}</Label>
          </div>
        )}
        <div style={{ position: "absolute", inset: 3 }}><Bracket color={T.ember} /></div>
      </CrtWindow>
      <KillLines />
    </AbsoluteFill>
  );
}
