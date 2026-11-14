// S15 Paid on Base (7.6 s, V14 at 0.3 s). Opens on S14's last frame (frozen: the epoch chip "Host paid 0.04 Ⓝ" over the
// blurred Hosts page); the page scrolls on to the Base card, the chip folds away and its amount flies (ease-out 18 f)
// onto the Base payout row of /app/hosts; Sign → "MPC signing…" → "Signed by MPC", which lifts off the glass as 72 px
// film type on "signs" (held 1.5 s; the card behind turns to texture) while the signed transmission prints → Relay; on
// "no one holds that key" the Basescan window lifts "Status: Success" (held 1.5 s); end pose: the readout's tx line.
// The `base` take replaces the drawn card (g6/BaseCard) when public/footage has it; camera keys then need a retune.
import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../ds/screen";
import { Label } from "../../ds/type";
import { FONT, stepped, T } from "../../ds/tokens";
import { Slot, slotSource } from "../../film/Slot";
import { AMOUNT, B15, BaseCard, READOUT, ROW_Y } from "./g6/BaseCard";
import { LIFT, PAYOUT, S14_SEAM, TEXTURE } from "./g6/facts";
import { BaseFlash, flashTexture } from "./g6/Flash";
import { LiftCard, liftShow, texture } from "./g6/Lift";
import { PendingTag } from "./g6/PendingTag";
import { C, inOut, out, word } from "./g6/kit";
import { S14 } from "./S14";

const OX = 22; // content origin in the frame (ScreenFrame CONTENT)
const OY = 102;
const FLASH_AT = word("S15", 5.5) - 6; // opens f168, just before "no one"; "Status: Success" lifts at f170
const SIGNED = { at: word("S15", 3.88) - 9, out: word("S15", 3.88) + 42 }; // settles f122 ("signs" f125), held to f167

type Cam = { s: number; fx: number; fy: number };
const ROW: Cam = { s: 1.55, fx: 940, fy: OY + ROW_Y + 60 };
const READ: Cam = { s: 1.75, fx: 700, fy: OY + READOUT.y + 60 };
/** End pose, shared with S16's first frame: the tx line of the readout. */
export const S15_END: Cam = { s: 1.8, fx: 664, fy: OY + READOUT.y + 20 * 6 + 26 };

const mix = (a: Cam, b: Cam, p: number): Cam => ({ s: a.s + (b.s - a.s) * p, fx: a.fx + (b.fx - a.fx) * p, fy: a.fy + (b.fy - a.fy) * p });

export function s15Cam(f: number): Cam {
  const drift = interpolate(f, [0, 120], [0, 0.04], C);
  const a = { ...ROW, s: ROW.s + drift };
  const toRead = interpolate(f, [B15.signed - 6, B15.signed + 22], [0, 1], { ...C, easing: out });
  const b = mix(a, { ...READ, s: READ.s + interpolate(f, [B15.signed, 200], [0, 0.03], C) }, toRead);
  const toTx = interpolate(f, [FLASH_AT + 30, FLASH_AT + 48], [0, 1], { ...C, easing: inOut });
  return mix(b, S15_END, toTx);
}

/** The screen content at frame f (also drawn by S16 under its roll). */
export function S15Content({ f }: { f: number }) {
  // Only a real take replaces the drawn card: the preview capture shows the row already relayed, so it cannot carry
  // the Sign → Signed by MPC → Relay beats. Camera keys and the lift need a retune once the take lands.
  if (slotSource("base").kind === "raw") return <Slot slot="base" crop={{ x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 }} />;
  return (
    <AbsoluteFill style={{ background: T.ink }}>
      <BaseCard f={f} />
      <PendingTag slot="base" />
    </AbsoluteFill>
  );
}

/** S14's lifted amount, from its pose on S14's last frame to its slot in the Base row (frame coords). */
function AmountFlight({ f, cam, dy }: { f: number; cam: Cam; dy: number }) {
  if (f >= B15.land) return null;
  const p = interpolate(f, [0, B15.land], [0, 1], { ...C, easing: out });
  const to = { x: 960 + cam.s * (OX + AMOUNT.x - cam.fx), y: 540 + cam.s * (OY + AMOUNT.y - cam.fy) + dy, px: 14 * cam.s };
  const a = S14_SEAM.amount;
  const px = a.px * Math.pow(to.px / a.px, p);
  return (
    <div style={{ position: "absolute", left: a.x + (to.x - a.x) * p, top: a.y + (to.y - a.y) * p, transform: "translate(-50%, -50%)",
      fontFamily: FONT.mono, fontWeight: 600, fontSize: px, lineHeight: 1.05, whiteSpace: "pre", color: T.alive,
      textShadow: `0 0 ${(34 * px) / a.px}px rgba(69,227,148,0.35), 0 ${3 * p}px ${10 * p}px rgba(5,4,10,${0.9 * p})` }}>{PAYOUT.near} Ⓝ</div>
  );
}

export function S15() {
  const f = useCurrentFrame();
  const cam = s15Cam(f);
  // S14 ends with its page racked out (facts S14_SEAM.rack); the Base row racks back in as the amount lands
  const rack = 1 - interpolate(f, [0, B15.land], [0, 1], { ...C, easing: out });
  // S14's page scrolls up and away as the Base card scrolls in (same page, ease-out 16 f); its chip collapses
  // (stepped, 6 f) leaving only the amount, which flies on to the row
  const scroll = interpolate(f, [0, 16], [0, 1], { ...C, easing: out });
  const fold = 1 - stepped(interpolate(f, [1, 7], [0, 1], C), 5);
  const box = (r: { x: number; y: number; w: number; h: number }) => `${r.x}px ${r.y}px, ${r.x + r.w}px ${r.y}px, ${r.x + r.w}px ${r.y + r.h}px, ${r.x}px ${r.y + r.h}px, ${r.x}px ${r.y}px`;
  const ch = S14_SEAM.chip;
  const pageClip = `polygon(evenodd, 0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 0, ${box(ch)})`;
  const h = S14_SEAM.hole;
  const signed = liftShow(f, SIGNED.at, SIGNED.out);
  const tex = Math.max(signed, flashTexture(f, FLASH_AT));
  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateY(${(1 - scroll) * 1080}px)`, ...texture(tex, TEXTURE.opacity, TEXTURE.blur),
        ...(rack > 0.01 ? { filter: `blur(${(S14_SEAM.rack.blur * rack).toFixed(2)}px) brightness(${1 - (1 - S14_SEAM.rack.brightness) * rack})` } : {}) }}>
        <Camera scale={cam.s} fx={cam.fx} fy={cam.fy} x={960 - cam.fx} y={540 - cam.fy}>
          <ScreenFrame title="Community hosts" mode="released" keys={{ primary: "Claim" }}>
            <S15Content f={f} />
          </ScreenFrame>
        </Camera>
      </AbsoluteFill>
      {scroll < 1 && (
        <AbsoluteFill style={{ clipPath: pageClip, transform: `translateY(${-scroll * 1080}px)` }}>
          <Freeze frame={S14_SEAM.frame}><S14 /></Freeze>
        </AbsoluteFill>
      )}
      {fold > 0 && (
        <AbsoluteFill style={{ clipPath: `polygon(${box(ch)})`, transform: `scale(${S14_SEAM.fix.scale}) scaleY(${fold})`, transformOrigin: `${S14_SEAM.fix.ox}px ${S14_SEAM.fix.oy}px` }}>
          <Freeze frame={S14_SEAM.frame}><S14 /></Freeze>
          {/* the amount leaves its slot in the chip (the chip's own ink fills it); AmountFlight carries it on */}
          <div style={{ position: "absolute", left: h.x, top: h.y, width: h.w, height: h.h, background: T.ink }} />
        </AbsoluteFill>
      )}
      <AmountFlight f={f} cam={cam} dy={(1 - scroll) * 1080} />
      <LiftCard x={LIFT.signed.x} y={LIFT.signed.y} show={signed} edge={T.cyan} glow="rgba(79,216,208,0.25)">
        <Label size={LIFT.signed.size} color={T.cyan} track={0.14} style={{ lineHeight: 1.1 }}>Signed by MPC</Label>
      </LiftCard>
      <BaseFlash f={f} at={FLASH_AT} />
    </AbsoluteFill>
  );
}
