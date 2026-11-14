// S13 A fan hosts (9.6 s, V12 at 0.3 s; V12 locked 15 Nov). Opens on S12's end: the public copy of the encrypted build
// rising toward the camera. It drops into the fan's LS-0001 as a download line (dial-up box, receive bar steps(8)); the
// box opens into the terminal running the real `pnpm host` on v2dev ("A fan runs one command"). The lines the take
// prints lift one at a time as film type: the github-raw copy's sha256 on "public copy … hash", the released-key
// commitment on "from day one", "restoring progress snapshot #2" on "progress", then register_host, which S14 dials
// into.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Label, Mono } from "../../ds/type";
import { T } from "../../ds/tokens";
import { Embers, Nebula } from "../../frames/b/Space";
import { HostTerminal, TERM_AT } from "./g5/host-term";
import { c, DialUp, inOut, out, ramp } from "./g5/kit";

const BOX_AT = 6; // dial-up box opens
const OPEN_AT = TERM_AT; // the box opens straight into the terminal

/** The public copy as S12 hands it over: a gold encrypted-build block rising toward the camera. */
function PublicCopy() {
  return (
    <div style={{ width: 620, padding: "26px 32px", background: "linear-gradient(165deg, #2a2248 0%, #19142e 100%)", border: `2px solid ${T.gold}`, borderRadius: 10,
      boxShadow: "0 0 60px rgba(255,201,74,0.35), 0 40px 80px -30px rgba(0,0,0,0.9)" }}>
      <Label size={26} color={T.gold}>Public copy</Label>
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
  const space = 1 - ramp(f, OPEN_AT, OPEN_AT + 10);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {space > 0 && <AbsoluteFill style={{ opacity: space }}><Nebula /><Embers count={14} seed={41} /></AbsoluteFill>}

      {/* the download box: the copy lands in it as a typed fetch line, the receive bar fills */}
      {f >= BOX_AT && open < 1 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - open }}>
          <DialUp f={f - BOX_AT} cmd="fetch public copy · encrypted server build" width={1040} style={{ transform: `scale(${1 + open * 0.8})` }} />
        </AbsoluteFill>
      )}
      {copyOut > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `translateY(${interpolate(fly, [0, 1], [-30, -14])}px) scale(${interpolate(fly, [0, 1], [1.2, 0.3])})`, opacity: copyOut }}>
            <PublicCopy />
          </div>
        </AbsoluteFill>
      )}

      {/* "A fan runs one command": the box opens straight into the terminal run */}
      {open > 0 && (
        <AbsoluteFill style={{ transform: `scale(${0.55 + 0.45 * out(open)})`, opacity: Math.min(1, open * 1.6) }}>
          <HostTerminal />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
