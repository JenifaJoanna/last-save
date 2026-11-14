// S13 A fan hosts (11.1 s, V12 at 0.3 s). Opens on S12's end: the Walrus copy rising toward the camera. It drops into
// the fan's LS-0001 as a download line (dial-up box, receive bar steps(8)); the box opens into the Hosts page take
// ("A fan clicks one button"), then a channel roll to ScreenFrame "TERMINAL" for the `pnpm host` run ("or runs one
// command"). Each checked line lifts 1.4× as "archived copy", "hash", "build record" and "progress" land; the scene ends
// on the register_host line lifted, which S14 dials into.
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { ScreenFrame } from "../../ds/screen";
import { Label, Mono } from "../../ds/type";
import { T } from "../../ds/tokens";
import { Slot } from "../../film/Slot";
import { Embers, Nebula } from "../../frames/b/Space";
import { CONTENT_CROP, TAKE_FROM } from "./g5/facts";
import { HostTerminal, TERM_AT } from "./g5/host-term";
import { c, DialUp, inOut, out, ramp, roll, RollBand } from "./g5/kit";

const BOX_AT = 6; // dial-up box opens
const OPEN_AT = 34; // box opens into the Hosts page
const ROLL_AT = TERM_AT - 10;

/** The Walrus copy as S12 hands it over: a gold encrypted-build block rising toward the camera. */
function WalrusCopy() {
  return (
    <div style={{ width: 620, padding: "26px 32px", background: "linear-gradient(165deg, #2a2248 0%, #19142e 100%)", border: `2px solid ${T.gold}`, borderRadius: 10,
      boxShadow: "0 0 60px rgba(255,201,74,0.35), 0 40px 80px -30px rgba(0,0,0,0.9)" }}>
      <Label size={26} color={T.gold}>Walrus copy</Label>
      <Mono size={22} color={T.muted} style={{ marginTop: 8 }}>Ember Rift · encrypted server build</Mono>
      <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
        {Array.from({ length: 12 }, (_, i) => <div key={i} style={{ flex: 1, height: 10, background: T.gold, opacity: 0.35 + (i % 3) * 0.2 }} />)}
      </div>
    </div>
  );
}

export function S13() {
  const f = useCurrentFrame();
  const fly = ramp(f, 0, 18, inOut); // leaves S12's held pose gently (ease-in-out, no frame-1 jump)
  const copyOut = interpolate(f, [8, 14], [1, 0], c);
  const open = ramp(f, OPEN_AT, OPEN_AT + 14, inOut);
  const r = roll(f, ROLL_AT);
  const space = 1 - ramp(f, OPEN_AT, OPEN_AT + 10);
  const drift = interpolate(f, [OPEN_AT, ROLL_AT], [1, 1.03], c);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {space > 0 && <AbsoluteFill style={{ opacity: space }}><Nebula /><Embers count={14} seed={41} /></AbsoluteFill>}

      {/* the download box: the copy lands in it as a typed fetch line, the receive bar fills */}
      {f >= BOX_AT && open < 1 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - open }}>
          <DialUp f={f - BOX_AT} cmd="fetch walrus copy · encrypted server build" width={1040} style={{ transform: `scale(${1 + open * 0.8})` }} />
        </AbsoluteFill>
      )}
      {copyOut > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `translateY(${interpolate(fly, [0, 1], [-30, -14])}px) scale(${interpolate(fly, [0, 1], [1.2, 0.3])})`, opacity: copyOut }}>
            <WalrusCopy />
          </div>
        </AbsoluteFill>
      )}

      {/* "A fan clicks one button": the Hosts page take, opened out of the box */}
      {open > 0 && f < ROLL_AT + 10 && (
        <AbsoluteFill style={{ transform: `translateY(${r.outY}px) scale(${(0.55 + 0.45 * out(open)) * drift})`, opacity: Math.min(1, open * 1.6) }}>
          <ScreenFrame title="Community hosts" mode="released" titleAt={OPEN_AT}>
            <Sequence from={OPEN_AT} layout="none"><Slot slot="hostbtn" from={TAKE_FROM.hostbtn} crop={CONTENT_CROP} /></Sequence>
          </ScreenFrame>
        </AbsoluteFill>
      )}

      {/* "or runs one command": channel roll to the terminal run */}
      {f >= ROLL_AT && (
        <AbsoluteFill style={{ transform: `translateY(${r.inY}px)` }}>
          <HostTerminal />
        </AbsoluteFill>
      )}
      {r.band && <RollBand y={r.inY} />}
    </AbsoluteFill>
  );
}
