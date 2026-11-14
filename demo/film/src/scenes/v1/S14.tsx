// S14 Back in (8.4 s, V13 at 0.6 s). Opens frozen on S13's last pose (the register_host line lifted) and dials up into
// the community host; the dial-up box opens like a CRT into the full-frame game client (`back`: sign in with NEAR →
// licence checked → the match). "Same players" lifts the scoreboard, "Same progress" lifts the level / Emberwing card.
// A channel roll to `bounce` (ines, no licence, refused; ~1.3 s) on "per real player session", where "ACCESS DENIED · NO
// LICENCE" lifts; another to the Hosts page `epoch` take (v2dev); on "signed by the players themselves" the host card's
// totals ("8 sessions paid · 0.08 Ⓝ earned") lift off the glass and the amount keeps rising toward the camera (S15 seam).
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../ds/screen";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { Slot } from "../../film/Slot";
import { DeniedLine, EpochChip, HudLift } from "./g5/back-parts";
import { BACK_PLATE, BACK_SOURCE, SIGNIN_TAKE, WALLET_CUT_LABEL, BOUNCE_PLATE, CONTENT_CROP, EPOCH_FOCUS, HUD_BOARD, HUD_ME, KEY_DENIED, TAKE_FROM } from "./g5/facts";
import { HostTerminal } from "./g5/host-term";
import { c, DialUp, inOut, out, ramp, roll, RollBand, Tag, word } from "./g5/kit";

const W = (s: number) => word("S14", s);
const S13_LAST = scene("S13").frames - 1;
const OPEN = 27; // the dial-up box opens into the game (CRT open, 8 f)
const MATCH = W(0.54) + 10; // cut from sign-in to the running match
const PLAYERS = MATCH; // "Same players" lift
const PROGRESS = W(1.82) - 6; // "Same progress" lift
const DROP = W(2.88) - 4; // lifts sink back on "The host"
const BOUNCE = W(3.74) - 18; // roll to the refusal ("per real player session")
const DENIED = [BOUNCE + 10, 186] as const; // "ACCESS DENIED · NO LICENCE" lifts above the frame, holds ≥ 45 f
const EPOCH = BOUNCE + 48; // roll to the Hosts page (bounce on screen ≈ 1.3 s)
const CHIP = W(6.36) - 18; // host totals lift on "signed by the players", land before "themselves", hold ≥ 45 f
const PAID = CHIP; // the earned amount prints with the chip
const RISE = W(6.36) - 2; // on "themselves" the amount keeps rising toward the camera
const END = scene("S14").frames;
const SIGNIN_CUT = OPEN + Math.round((SIGNIN_TAKE.cut - SIGNIN_TAKE.from) * 30); // fallback take: its own cut

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
  const rise = ramp(f, RISE, END, out);
  const rack = chipUp;
  const dUp = ramp(f, DENIED[0], DENIED[0] + 10);
  const dDown = ramp(f, DENIED[1], DENIED[1] + 7, inOut);
  const denied = dUp * (1 - dDown);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {/* S13's last pose, frozen, falling back as the dial-up box opens over it */}
      {crt < 1 && (
        <AbsoluteFill style={{ opacity: interpolate(f, [0, 14], [1, 0.55], c), filter: `blur(${interpolate(f, [0, 14], [0, 3], c)}px)` }}>
          <Freeze frame={S13_LAST}><HostTerminal at={S13_LAST} /></Freeze>
        </AbsoluteFill>
      )}

      {/* the community host game client, full frame, opening out of a 1-px line like a CRT */}
      {f >= OPEN && f < BOUNCE + 10 && (
        <AbsoluteFill style={{ clipPath: `inset(${(1 - crt) * 49.8}% 0 ${(1 - crt) * 49.8}% 0)`, transform: `translateY(${r1.outY}px)` }}>
          <AbsoluteFill style={{ filter: dimGame > 0.01 ? `brightness(${1 - dimGame})` : undefined, transform: `scale(${interpolate(f, [OPEN, BOUNCE], [1, 1.03], c)})` }}>
            {BACK_SOURCE === "signin" ? (
              <Sequence from={OPEN} layout="none"><Slot slot="signin" plate={BACK_PLATE} from={SIGNIN_TAKE.from} /></Sequence>
            ) : f < MATCH ? (
              <Sequence from={OPEN} layout="none"><Slot slot="back" plate={BACK_PLATE} from={TAKE_FROM.backSignin} /></Sequence>
            ) : (
              <Sequence from={MATCH} layout="none"><Slot slot="back" plate={BACK_PLATE} from={TAKE_FROM.backMatch} /></Sequence>
            )}
          </AbsoluteFill>
          {BACK_SOURCE === "back" && <>
          <HudLift crop={HUD_BOARD} seqFrom={MATCH} takeFrom={TAKE_FROM.backMatch} lift={players} to={{ x: 150, y: 190 }} scale={1.9} tag="Same players" />
          <HudLift crop={HUD_ME} seqFrom={MATCH} takeFrom={TAKE_FROM.backMatch} lift={progress} to={{ x: 150, y: 640 }} scale={1.9} tag="Same progress" />
          </>}
          {BACK_SOURCE === "signin" && f >= SIGNIN_CUT && <Tag color={T.cyan} size={26} style={{ position: "absolute", right: 64, top: 986 }}>{WALLET_CUT_LABEL}</Tag>}
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
            <AbsoluteFill style={{ filter: dUp > 0.01 ? `blur(${(3 * dUp).toFixed(2)}px) brightness(${1 - 0.55 * dUp})` : undefined }}>
              <Sequence from={BOUNCE} layout="none"><Slot slot="bounce" plate={BOUNCE_PLATE} from={TAKE_FROM.bounce} /></Sequence>
            </AbsoluteFill>
          </Camera>
        </AbsoluteFill>
      )}
      {r1.band && <RollBand y={r1.inY} />}

      {/* the Hosts page: the epoch claim, then the result lifts off the glass */}
      {f >= EPOCH && (
        <AbsoluteFill style={{ transform: `translateY(${r2.inY}px)`, filter: rack > 0.01 ? `blur(${(3 * rack).toFixed(2)}px) brightness(${1 - 0.55 * rack})` : undefined }}>
          <Camera scale={epochPush} fx={EPOCH_FOCUS.fx} fy={EPOCH_FOCUS.fy}>
            <ScreenFrame title="Community hosts" mode="released" titleAt={EPOCH}>
              <Sequence from={EPOCH} layout="none"><Slot slot="epoch" from={TAKE_FROM.epoch} crop={CONTENT_CROP} /></Sequence>
            </ScreenFrame>
          </Camera>
        </AbsoluteFill>
      )}
      {r2.band && <RollBand y={r2.inY} />}
      {denied > 0.001 && (
        <div style={{ position: "absolute", left: interpolate(dUp, [0, 1], [KEY_DENIED.from.x, KEY_DENIED.to.x]), top: interpolate(dUp, [0, 1], [KEY_DENIED.from.y, KEY_DENIED.to.y]) - 16 * dDown,
          transform: `translate(-50%, -50%) scale(${interpolate(dUp, [0, 1], [0.5, 1])})`, opacity: Math.min(1, dUp * 3) * Math.max(0, 1 - 2 * dDown) }}>
          <DeniedLine lift={denied} />
        </div>
      )}
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
