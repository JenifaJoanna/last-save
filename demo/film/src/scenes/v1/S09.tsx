// S09 The kill (17.2 s, V08 from 0.6 s). The live match → the studio's terminal deletes the official server and its
// download answers HTTP/2 530 ("gone"), lifted to 64 px → a new sign-in after the shutdown gets CONNECTION LOST → that
// client powers off like a CRT into the red flatline → the reports take opens out of it: the counted probe failure and
// the not-counted runs, holder report 1/2 on "report", 2/2 (quorum, GONE DARK) on "down" → it folds into the flatline →
// GONE DARK + dead sun + three hard flicker dips + the alert card on "dead" → stillness to the end.
// Schedule and sound frames: g4/t09.ts; beats and take cuts: g4/facts.ts.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ScreenFrame } from "../../ds/screen";
import { T } from "../../ds/tokens";
import { Hero } from "./g4/Hero";
import { KillOpen } from "./g4/KillOpen";
import { Flatline, ProbeLog, StatusTake } from "./g4/Probes";
import { S9 } from "./g4/t09";
import { CHROME_FOLLOWS_CONTRACT } from "./g4/facts";

function Dead() {
  const f = useCurrentFrame();
  const lineOn = (f >= S9.drop + 12 && f < S9.powerOn + 4) || f >= S9.fold + 6;
  const dip = S9.flicker.some((d) => f >= d && f < d + 2);
  return (
    <AbsoluteFill>
      <StatusTake />
      <Hero />
      {lineOn && <Flatline from={S9.drop + 12} />}
      <ProbeLog />
      {dip && <AbsoluteFill style={{ background: T.void, opacity: 0.88 }} />}
    </AbsoluteFill>
  );
}

export function S09() {
  const f = useCurrentFrame();
  const screen = f >= S9.collapse;
  return (
    <AbsoluteFill style={{ background: T.void }}>
      {screen && (
        <ScreenFrame title="Licence status" mode={CHROME_FOLLOWS_CONTRACT && f < S9.deadFlip ? "probing" : "dead"} titleAt={S9.collapse + 4}>
          <Dead />
        </ScreenFrame>
      )}
      {f < S9.drop + 14 && <KillOpen />}
    </AbsoluteFill>
  );
}
