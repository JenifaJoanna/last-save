// S14 Back in (8.4 s, V13 at 0.6 s). Opens frozen on S13's last pose (the register_host line lifted) and dials up into
// the community host; the dial-up box opens like a CRT into the full-frame game client (`back`: sign in with NEAR →
// licence checked → the match). "Same players" lifts the scoreboard, "Same progress" lifts the level / Emberwing card.
// A channel roll to `bounce` (a non-holder refused, ~1.2 s) on "per real player session", another to the Hosts page
// `epoch` take; on "signed by the players themselves" the epoch result lifts off the glass and its paid amount keeps
// rising toward the camera, where S15 takes it to the Base payout row.
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../ds/screen";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { Slot } from "../../film/Slot";
import { EpochChip, HudLift } from "./g5/back-parts";
import { CONTENT_CROP, EPOCH_FOCUS, HUD_BOARD, HUD_ME, TAKE_FROM } from "./g5/facts";
import { HostTerminal } from "./g5/host-term";
import { c, DialUp, inOut, out, ramp, roll, RollBand, word } from "./g5/kit";

const W = (s: number) => word("S14", s);
const S13_LAST = scene("S13").frames - 1;
const OPEN = 27; // the dial-up box opens into the game (CRT open, 8 f)
const MATCH = W(0.54) + 10; // cut from sign-in to the running match
const PLAYERS = MATCH; // "Same players" lift
const PROGRESS = W(1.82) - 6; // "Same progress" lift
const DROP = W(2.88) - 4; // lifts sink back on "The host"
const BOUNCE = W(3.74) - 12; // roll to the refusal ("per real player session")
const EPOCH = BOUNCE + 38; // roll to the Hosts page
const CHIP = W(6.36) - 12; // epoch result lifts; lands on "themselves"
const PAID = W(6.36) - 2;
const END = scene("S14").frames;

export function S14() {
  const f = useCurrentFrame();
  const crt = ramp(f, OPEN, OPEN + 8);
  const boxGone = interpolate(f, [OPEN + 2, OPEN + 8], [1, 0], c);
  const players = ramp(f, PLAYERS, PLAYERS + 10) * (1 - ramp(f, DROP, DROP + 8, inOut));
  const progress = ramp(f, PROGRESS, PROGRESS + 10) * (1 - ramp(f, DROP + 2, DROP + 10, inOut));
  const dimGame = Math.max(players, progress) * 0.55;
  const r1 = roll(f, BOUNCE);
  const r2 = roll(f, EPOCH);
  const bouncePush = interpolate(f, [BOUNCE, EPOCH], [1, 1.12], { ...c, easing: out });
  const epochPush = interpolate(f, [EPOCH + 8, CHIP], [1, EPOCH_FOCUS.scale], { ...c, easing: inOut });
  const chipUp = ramp(f, CHIP, CHIP + 12);
  const rise = ramp(f, PAID + 6, END, out);
  const rack = Math.max(chipUp * 0.7, 0);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {/* S13's last pose, frozen, falling back as the dial-up box opens over it */}
      {crt < 1 && (
        <AbsoluteFill style={{ opacity: interpolate(f, [0, 14], [1, 0.28], c), filter: `blur(${interpolate(f, [0, 14], [0, 3], c)}px)` }}>
          <Freeze frame={S13_LAST}><HostTerminal at={S13_LAST} /></Freeze>
        </AbsoluteFill>
      )}

      {/* the community host game client, full frame, opening out of a 1-px line like a CRT */}
      {f >= OPEN && f < BOUNCE + 10 && (
        <AbsoluteFill style={{ clipPath: `inset(${(1 - crt) * 49.8}% 0 ${(1 - crt) * 49.8}% 0)`, transform: `translateY(${r1.outY}px)` }}>
          <AbsoluteFill style={{ filter: dimGame > 0.01 ? `brightness(${1 - dimGame})` : undefined, transform: `scale(${interpolate(f, [OPEN, BOUNCE], [1, 1.03], c)})` }}>
            {f < MATCH ? (
              <Sequence from={OPEN} layout="none"><Slot slot="back" from={TAKE_FROM.backSignin} /></Sequence>
            ) : (
              <Sequence from={MATCH} layout="none"><Slot slot="back" from={TAKE_FROM.backMatch} /></Sequence>
            )}
          </AbsoluteFill>
          <HudLift crop={HUD_BOARD} seqFrom={MATCH} takeFrom={TAKE_FROM.backMatch} lift={players} to={{ x: 150, y: 190 }} scale={1.9} tag="Same players" />
          <HudLift crop={HUD_ME} seqFrom={MATCH} takeFrom={TAKE_FROM.backMatch} lift={progress} to={{ x: 150, y: 640 }} scale={1.9} tag="Same progress" />
        </AbsoluteFill>
      )}
      {crt > 0 && crt < 1 && <div style={{ position: "absolute", left: 0, right: 0, top: 539, height: 2, background: T.text, opacity: 1 - crt, boxShadow: "0 0 24px rgba(239,229,208,0.8)" }} />}
      {boxGone > 0 && f >= 1 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: boxGone }}>
          <DialUp f={f * 1.15} cmd="open community host · lastsave-fanhost" width={1000} style={{ transform: `scale(${1 + crt * 0.6})` }} />
        </AbsoluteFill>
      )}

      {/* a non-holder tries to join: refused */}
      {f >= BOUNCE && f < EPOCH + 10 && (
        <AbsoluteFill style={{ transform: `translateY(${f < EPOCH ? r1.inY : r2.outY}px)` }}>
          <Camera scale={bouncePush}>
            <Sequence from={BOUNCE} layout="none"><Slot slot="bounce" from={TAKE_FROM.bounce} /></Sequence>
          </Camera>
        </AbsoluteFill>
      )}
      {r1.band && <RollBand y={r1.inY} />}

      {/* the Hosts page: the epoch claim, then the result lifts off the glass */}
      {f >= EPOCH && (
        <AbsoluteFill style={{ transform: `translateY(${r2.inY}px)`, filter: rack > 0.01 ? `blur(${(2.4 * rack).toFixed(2)}px) brightness(${1 - 0.45 * rack})` : undefined }}>
          <Camera scale={epochPush} fx={EPOCH_FOCUS.fx} fy={EPOCH_FOCUS.fy}>
            <ScreenFrame title="Community hosts" mode="released" titleAt={EPOCH}>
              <Sequence from={EPOCH} layout="none"><Slot slot="epoch" from={TAKE_FROM.epoch} crop={CONTENT_CROP} /></Sequence>
            </ScreenFrame>
          </Camera>
        </AbsoluteFill>
      )}
      {r2.band && <RollBand y={r2.inY} />}
      {chipUp > 0.001 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `translateY(${interpolate(chipUp, [0, 1], [120, 20]) - 30 * rise}px) scale(${interpolate(chipUp, [0, 1], [0.7, 1]) + 0.16 * rise})`, opacity: Math.min(1, chipUp * 2.5) }}>
            <EpochChip f={f} lift={chipUp} paidAt={PAID} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
