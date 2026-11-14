// S14 parts: a HUD region of the `back` take lifted off the glass (a pixel crop of the playing take, scaled up, with a
// Chakra tag), and the epoch result chip whose paid amount lifts toward the camera at the end of the scene.
import { interpolate, Sequence } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import { Slot } from "../../../film/Slot";
import { KEY_DENIED, KEY_HOST } from "./facts";
import { LiftPlate, printIn, Tag } from "./kit";

type Crop = { x: number; y: number; w: number; h: number };

/** `lift` 0..1 moves the crop from its place in the take (px of the 1920×1080 frame) to `to` at `scale`. The crop plays the
 * same take segment as the full-frame layer (same Sequence start and `from`). */
export function HudLift({ crop, seqFrom, takeFrom, lift, to, scale, tag, caption }: {
  crop: Crop; seqFrom: number; takeFrom: number; lift: number; to: { x: number; y: number }; scale: number; tag: string; caption?: string;
}) {
  if (lift <= 0.001) return null;
  const w = crop.w * 1920;
  const h = crop.h * 1080;
  const x = interpolate(lift, [0, 1], [crop.x * 1920, to.x]);
  const y = interpolate(lift, [0, 1], [crop.y * 1080, to.y]);
  const s = interpolate(lift, [0, 1], [1, scale]);
  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      <div style={{ position: "absolute", left: 0, top: -100, clipPath: `inset(0 0 ${(1 - stepped(Math.max(0, (lift - 0.4) / 0.6), 5)) * 100}% 0)` }}>
        <Tag color={T.gold} size={56}>{tag}</Tag>
      </div>
      <div style={{ transformOrigin: "0 0", transform: `scale(${s})` }}>
        <LiftPlate lift={lift} edge={T.gold} style={{ width: w, height: h, overflow: "hidden", padding: 0 }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <Sequence from={seqFrom} layout="none"><Slot slot="back" from={takeFrom} crop={crop} tag={false} /></Sequence>
          </div>
        </LiftPlate>
      </div>
      {caption && <Mono size={30} color={T.muted} style={{ position: "absolute", left: 0, top: h * s + 14, opacity: lift }}>{caption}</Mono>}
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

/** The host card's totals as epoch.mp4 shows them ("8 sessions paid · 0.08 Ⓝ earned", values g5/facts KEY_HOST):
 * the sessions line first, the earned amount prints at `paidAt`. */
export function EpochChip({ f, lift, paidAt }: { f: number; lift: number; paidAt: number }) {
  const row2 = printIn(f, paidAt);
  return (
    <LiftPlate lift={lift} edge={T.alive} style={{ padding: "26px 44px 30px" }}>
      <Label size={24} color={T.cyan} track={0.18} style={{ opacity: 0.45 }}>{`// Your host · ${KEY_HOST.who}`}</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
        <Check size={60} />
        <Mono size={56} color={T.text}>{KEY_HOST.sessions} sessions paid ·</Mono>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 18, clipPath: `inset(0 0 ${(1 - row2) * 100}% 0)` }}>
        <Mono size={96} weight={600} color={T.alive} style={{ lineHeight: 1.05, textShadow: "0 0 34px rgba(69,227,148,0.35)" }}>{KEY_HOST.earned} Ⓝ</Mono>
        <Mono size={56} color={T.text}>earned</Mono>
      </div>
    </LiftPlate>
  );
}

/** bounce.mp4's refusal headline at film size. */
export function DeniedLine({ lift }: { lift: number }) {
  return (
    <LiftPlate lift={lift} edge={T.dead} style={{ padding: "18px 44px 20px" }}>
      <Mono size={60} weight={600} color={T.dead}>{KEY_DENIED.line}</Mono>
    </LiftPlate>
  );
}
