// S14 parts: a HUD region of the `back` take lifted off the glass (a pixel crop of the playing take, scaled up, with a
// Chakra tag), and the epoch result chip whose paid amount lifts toward the camera at the end of the scene.
import { interpolate, Sequence } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import { Slot } from "../../../film/Slot";
import { CLAIM } from "./facts";
import { LiftPlate, printIn, Tag } from "./kit";

type Crop = { x: number; y: number; w: number; h: number };

/** `lift` 0..1 moves the crop from its place in the take (px of the 1920×1080 frame) to `to` at `scale`. The crop plays the
 * same take segment as the full-frame layer (same Sequence start and `from`). */
export function HudLift({ crop, seqFrom, takeFrom, lift, to, scale, tag }: {
  crop: Crop; seqFrom: number; takeFrom: number; lift: number; to: { x: number; y: number }; scale: number; tag: string;
}) {
  if (lift <= 0.001) return null;
  const w = crop.w * 1920;
  const h = crop.h * 1080;
  const x = interpolate(lift, [0, 1], [crop.x * 1920, to.x]);
  const y = interpolate(lift, [0, 1], [crop.y * 1080, to.y]);
  const s = interpolate(lift, [0, 1], [1, scale]);
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <div style={{ position: "absolute", left: 0, top: -84, clipPath: `inset(0 0 ${(1 - stepped(Math.max(0, (lift - 0.4) / 0.6), 5)) * 100}% 0)` }}>
        <Tag color={T.gold} size={44}>{tag}</Tag>
      </div>
      <div style={{ transformOrigin: "0 0", transform: `scale(${s})` }}>
        <LiftPlate lift={lift} edge={T.gold} style={{ width: w, height: h, overflow: "hidden", padding: 0 }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <Sequence from={seqFrom} layout="none"><Slot slot="back" from={takeFrom} crop={crop} tag={false} /></Sequence>
          </div>
        </LiftPlate>
      </div>
    </div>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={T.alive} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

/** "4 player-signed sessions verified" then "Host paid 0.04 Ⓝ" (numbers: g5/facts CLAIM). `f` relative to the chip start. */
export function EpochChip({ f, lift, paidAt }: { f: number; lift: number; paidAt: number }) {
  const row2 = printIn(f, paidAt);
  return (
    <LiftPlate lift={lift} edge={T.alive} style={{ padding: "26px 44px 30px" }}>
      <Label size={24} color={T.cyan} track={0.18} style={{ opacity: 0.45 }}>{"// Epoch claimed · community host"}</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
        <Check size={60} />
        <Mono size={56} color={T.text}>{CLAIM.sessions} player-signed sessions verified</Mono>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 18, clipPath: `inset(0 0 ${(1 - row2) * 100}% 0)` }}>
        <Label size={56} color={T.text}>Host paid</Label>
        <Mono size={96} weight={600} color={T.alive} style={{ lineHeight: 1.05, textShadow: "0 0 34px rgba(69,227,148,0.35)" }}>{CLAIM.paid} Ⓝ</Mono>
      </div>
    </LiftPlate>
  );
}
