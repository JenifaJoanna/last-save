// S15 Paid on Base (7.6 s, V14 at 0.3 s). Opens on S14's last frame (frozen: the epoch chip "Host paid 0.04 Ⓝ" over the
// blurred Hosts page); the chip dissolves while its amount flies (ease-out 18 f) onto the Base payout row of /app/hosts; Sign → "MPC signing…" → "Signed by MPC" (lifts on "signs") with the signed transmission printing in →
// Relay; on "no one holds that key" a 1-s Basescan flash; end pose: the readout's tx line, highlighted, camera on it.
// The `base` take replaces the drawn card (g6/BaseCard) when public/footage has it; camera keys then need a retune.
import { AbsoluteFill, Freeze, interpolate, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../ds/screen";
import { FONT, stepped, T } from "../../ds/tokens";
import { Slot, slotSource } from "../../film/Slot";
import { AMOUNT, B15, BaseCard, READOUT, ROW_Y } from "./g6/BaseCard";
import { PAYOUT, S14_SEAM } from "./g6/facts";
import { BaseFlash } from "./g6/Flash";
import { PendingTag } from "./g6/PendingTag";
import { C, inOut, out, word } from "./g6/kit";
import { S14 } from "./S14";

const OX = 22; // content origin in the frame (ScreenFrame CONTENT)
const OY = 102;
const FLASH_AT = word("S15", 5.5) - 6; // opens just before "no one"

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
function AmountFlight({ f, cam }: { f: number; cam: Cam }) {
  if (f >= B15.land) return null;
  const p = interpolate(f, [0, B15.land], [0, 1], { ...C, easing: out });
  const to = { x: 960 + cam.s * (OX + AMOUNT.x - cam.fx), y: 540 + cam.s * (OY + AMOUNT.y - cam.fy), px: 14 * cam.s };
  const a = S14_SEAM.amount;
  const px = a.px * Math.pow(to.px / a.px, p);
  return (
    <div style={{ position: "absolute", left: a.x + (to.x - a.x) * p, top: a.y + (to.y - a.y) * p, transform: "translate(-50%, -50%)",
      fontFamily: FONT.mono, fontWeight: 600, fontSize: px, lineHeight: 1.05, whiteSpace: "pre", color: T.alive,
      textShadow: `0 0 ${(34 * px) / a.px}px rgba(69,227,148,0.35)` }}>{PAYOUT.near} Ⓝ</div>
  );
}

export function S15() {
  const f = useCurrentFrame();
  const cam = s15Cam(f);
  // S14 ends with its page racked out (blur 1.68 px, brightness 0.685); the Base row racks back in as the amount lands
  const rack = 1 - interpolate(f, [0, B15.land], [0, 1], { ...C, easing: out });
  const s14 = 1 - stepped(interpolate(f, [1, 10], [0, 1], C), 5); // the chip and page dissolve in terminal steps
  const h = S14_SEAM.hole;
  const hole = `polygon(evenodd, 0 0, 1920px 0, 1920px 1080px, 0 1080px, 0 0, ${h.x}px ${h.y}px, ${h.x + h.w}px ${h.y}px, ${h.x + h.w}px ${h.y + h.h}px, ${h.x}px ${h.y + h.h}px, ${h.x}px ${h.y}px)`;
  const flashDim = interpolate(f, [FLASH_AT, FLASH_AT + 4, FLASH_AT + 40, FLASH_AT + 48], [0, 0.55, 0.55, 0], C);
  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: rack > 0.01 ? `blur(${(1.68 * rack).toFixed(2)}px) brightness(${1 - 0.315 * rack})` : undefined }}>
        <Camera scale={cam.s} fx={cam.fx} fy={cam.fy} x={960 - cam.fx} y={540 - cam.fy}>
          <ScreenFrame title="Community hosts" mode="released" keys={{ primary: "Claim" }}>
            <S15Content f={f} />
          </ScreenFrame>
        </Camera>
      </AbsoluteFill>
      {s14 > 0 && (
        <AbsoluteFill style={{ opacity: s14, clipPath: hole }}>
          <Freeze frame={S14_SEAM.frame}><S14 /></Freeze>
        </AbsoluteFill>
      )}
      <AmountFlight f={f} cam={cam} />
      {flashDim > 0 && <AbsoluteFill style={{ background: `rgba(10,8,20,${flashDim})` }} />}
      <BaseFlash f={f} at={FLASH_AT} />
    </AbsoluteFill>
  );
}
