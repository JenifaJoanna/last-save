// S15 Paid on Base (7.6 s, V14 at 0.3 s). Opens on S14's last frame (frozen: the epoch chip "Host paid 0.04 Ⓝ" over the
// blurred Hosts page: the host's total, "8 sessions paid · 0.08 Ⓝ earned"); the page scrolls on to the Base section
// and the chip folds away whole (no number changes in flight); "Epoch 11 · 4 sessions · 0.04 Ⓝ" lifts from the row as
// one epoch of those earnings; the payout row of /app/hosts is shown completed (the 14 Nov payout, already signed and relayed). On "signs"
// "Signed by MPC" lifts off the glass as 72 px film type (held 1.5 s; the card behind turns to texture); on "no one"
// the x-base window (the receipt, status 0x1) lifts "Status: Success" (held 1.5 s); end pose: the readout's tx line.
// The `base` take replaces the drawn card (g6/BaseCard) when public/footage has it; camera keys then need a retune.
import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../ds/screen";
import { Label, Mono } from "../../ds/type";
import { stepped, T } from "../../ds/tokens";
import { Slot, slotSource } from "../../film/Slot";
import { B15, BaseCard, READOUT, ROW_Y } from "./g6/BaseCard";
import { BASE_TAKE, LIFT, PAYOUT, S14_SEAM, TEXTURE } from "./g6/facts";
import { BaseFlash, flashTexture } from "./g6/Flash";
import { LiftCard, liftShow, texture } from "./g6/Lift";
import { PendingTag } from "./g6/PendingTag";
import { C, inOut, out, word } from "./g6/kit";
import { S14 } from "./S14";

const OX = 22; // content origin in the frame (ScreenFrame CONTENT)
const OY = 102;
const FLASH_AT = word("S15", 5.5) - 6; // opens f168, just before "no one"; "Status: Success" lifts at f170
const EPOCH = { at: 18, out: 70 }; // bridge line settles f24, held to f70 (46 f), during "Hosts can even be paid on Base"
const SIGNED = { at: word("S15", 3.88) - 9, out: word("S15", 3.88) + 42 }; // settles f122 ("signs" f125), held to f167

type Cam = { s: number; fx: number; fy: number };
const hasTake = () => slotSource("base").kind === "raw";
/** Camera keys: on the take's EPOCH 11 row (facts BASE_TAKE), or on the drawn card's row, readout and tx line. */
const keys = (): { row: Cam; read: Cam; end: Cam } => hasTake() ? BASE_TAKE.cam : {
  row: { s: 1.55, fx: 940, fy: OY + ROW_Y + 60 }, read: { s: 1.75, fx: 700, fy: OY + READOUT.y + 60 },
  end: { s: 1.8, fx: 664, fy: OY + READOUT.y + 20 * 6 + 26 } };
/** End pose, shared with S16's first frame. */
export const s15End = (): Cam => keys().end;

const mix = (a: Cam, b: Cam, p: number): Cam => ({ s: a.s + (b.s - a.s) * p, fx: a.fx + (b.fx - a.fx) * p, fy: a.fy + (b.fy - a.fy) * p });

export function s15Cam(f: number): Cam {
  const k = keys();
  const drift = interpolate(f, [0, 120], [0, 0.04], C);
  const a = { ...k.row, s: k.row.s + drift };
  const toRead = interpolate(f, [SIGNED.at - 6, SIGNED.at + 22], [0, 1], { ...C, easing: out });
  const b = mix(a, { ...k.read, s: k.read.s + interpolate(f, [SIGNED.at, 200], [0, 0.03], C) }, toRead);
  const toEnd = interpolate(f, [FLASH_AT + 30, FLASH_AT + 48], [0, 1], { ...C, easing: inOut });
  return mix(b, k.end, toEnd);
}

/** The screen content at frame f (also drawn by S16 under its roll). */
export function S15Content({ f }: { f: number }) {
  if (hasTake()) {
    // the take is the real completed row; each frame seeks its own time (held on its last frame)
    return <Freeze frame={0}><Slot slot="base" from={Math.min(BASE_TAKE.end, f / 30)} crop={{ x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 }} /></Freeze>;
  }
  return (
    <AbsoluteFill style={{ background: T.ink }}>
      <BaseCard f={f} />
      <PendingTag slot="base" />
    </AbsoluteFill>
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
  const signed = liftShow(f, SIGNED.at, SIGNED.out);
  // bridge: this row is ONE epoch of the host's earnings S14 ended on; it lifts from the row once the page has scrolled in
  const epoch = liftShow(f, EPOCH.at, EPOCH.out);
  const row = hasTake() ? BASE_TAKE.row : { x: OX + 300, y: OY + ROW_Y + 40 };
  const eRise = interpolate(f, [EPOCH.at, EPOCH.at + 6], [0, 1], { ...C, easing: out });
  const eFrom = { x: 960 + cam.s * (row.x - cam.fx), y: 540 + cam.s * (row.y - cam.fy) };
  // "Signed by MPC" rises from the row's own chip (take or drawn) to its hold position
  const chip = hasTake() ? BASE_TAKE.chip : { x: OX + 660, y: OY + ROW_Y + 26 };
  const rise = interpolate(f, [SIGNED.at, SIGNED.at + 6], [0, 1], { ...C, easing: out });
  const from = { x: 960 + cam.s * (chip.x - cam.fx), y: 540 + cam.s * (chip.y - cam.fy) };
  const tex = Math.max(epoch, signed, flashTexture(f, FLASH_AT));
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
        </AbsoluteFill>
      )}
      <LiftCard x={eFrom.x + (LIFT.epoch.x - eFrom.x) * eRise} y={eFrom.y + (LIFT.epoch.y - eFrom.y) * eRise} show={epoch}>
        <Mono size={LIFT.epoch.size} color={T.text} style={{ lineHeight: 1.1 }}>
          Epoch {PAYOUT.epoch} · {PAYOUT.sessions} sessions · <span style={{ color: T.alive, fontWeight: 600 }}>{PAYOUT.near} Ⓝ</span>
        </Mono>
      </LiftCard>
      <LiftCard x={from.x + (LIFT.signed.x - from.x) * rise} y={from.y + (LIFT.signed.y - from.y) * rise} show={signed} edge={T.cyan} glow="rgba(79,216,208,0.25)">
        <Label size={LIFT.signed.size} color={T.cyan} track={0.14} style={{ lineHeight: 1.1 }}>Signed by MPC</Label>
      </LiftCard>
      <BaseFlash f={f} at={FLASH_AT} />
    </AbsoluteFill>
  );
}
