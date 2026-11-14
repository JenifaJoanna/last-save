// S11 parts: a mini LS-0001 device playing one holder's real take (FrameB device look at small scale), the key lines
// that lift off the glass as film type (the relayer toast, the Refunded row, the pledged card), and the pool panel.
import type { ReactNode } from "react";
import { Sequence } from "remotion";
import { Terminal } from "../../../ds/crt";
import { Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import { Slot } from "../../../film/Slot";
import { CHOOSE_CROP, KEY_PLEDGED, KEY_REFUNDED, KEY_SPLIT, KEY_TOAST, TAKE_FROM } from "./facts";
import { LiftPlate, printIn, Tag } from "./kit";

export const DW = 880;
export const DH = 520;
const K = 1;
/** Glass (content) size inside the bezel: padding 8, status bar 32, borders. */
export const GLASS = { x: 9, y: 41, w: DW - 18, h: DH - 50 };

export interface Holder { slot: string; who: string; x: number; y: number; z: number; ry: number }
export const HOLDERS: Holder[] = [
  { slot: "pledge", who: "mira", x: 500, y: 520, z: -110, ry: 8 },
  { slot: "pledge2", who: "kofi", x: 1420, y: 560, z: -170, ry: -8 },
];

/** One device. `f` is the scene frame, `land` the frame its key row arrives (the take prints in from there). */
export function MiniDevice({ h, f, land, appear, dim, float, focus = 0 }: { h: Holder; f: number; land: number; appear: number; dim: number; float: number; focus?: number }) {
  const reveal = printIn(f, land);
  return (
    <div style={{ position: "absolute", left: h.x - DW / 2, top: h.y - DH / 2 + float, width: DW, height: DH, transformStyle: "preserve-3d",
      transform: `translateZ(${h.z - (1 - appear) * 700}px) rotateY(${h.ry}deg) rotateX(3deg)`, opacity: appear * (1 - 0.6 * dim),
      filter: dim > 0.01 ? `blur(${(3 * dim).toFixed(2)}px)` : undefined }}>
      <Tag color={T.gold} size={22 + 16 * focus} style={{ position: "absolute", left: 6, top: -58 - 22 * focus }}>Pledge · {h.who}</Tag>
      <Terminal width={DW} height={DH} k={K} title="Licence status" mode="dead" hints={false}
        style={{ boxShadow: `inset -3px -3px 0 ${T.gold}66, inset 0 1px 0 rgba(255,255,255,0.07), 0 0 90px ${T.gold}24, 0 60px 120px -40px rgba(0,0,0,0.95)` }}>
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)` }}>
          <Sequence from={land} layout="none">
            <Slot slot={h.slot} from={TAKE_FROM[h.slot]} crop={CHOOSE_CROP[h.slot]} />
          </Sequence>
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg, rgba(255,255,255,0.05) 0%, transparent 32%, transparent 70%, rgba(255,138,76,0.04) 100%)" }} />
      </Terminal>
    </div>
  );
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={T.alive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** pledge.mp4's gasless toast lifted as film type: the body at 56 px is the beat; the title is texture. */
export function RelayerToast({ lift }: { lift: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "30px 44px 34px", borderRadius: 22, background: "rgba(31,25,56,0.97)", border: `1px solid ${T.line2}`,
      boxShadow: `0 ${20 + 50 * lift}px ${50 + 70 * lift}px -20px rgba(0,0,0,0.95), 0 0 ${60 * lift}px rgba(69,227,148,0.16)` }}>
      <CheckIcon size={64} />
      <div>
        <Mono size={30} weight={600} style={{ lineHeight: 1.2, opacity: 0.45 }}>{KEY_TOAST.title}</Mono>
        <Mono size={56} color={T.text} style={{ marginTop: 6, lineHeight: 1.25 }}>{KEY_TOAST.body}</Mono>
      </div>
    </div>
  );
}

function Plate({ lift, edge, children }: { lift: number; edge: string; children: ReactNode }) {
  return <LiftPlate lift={lift} edge={edge} style={{ display: "flex", alignItems: "center", gap: 30, padding: "22px 44px 24px" }}>{children}</LiftPlate>;
}
/** The money card's Refunded row (its muted swatch, label and figure) at film size. */
export function RefundedLine({ lift }: { lift: number }) {
  return (
    <Plate lift={lift} edge={T.muted}>
      <span style={{ width: 30, height: 30, background: T.muted }} />
      <Mono size={64} color={T.text}>{KEY_REFUNDED.label}</Mono>
      <Mono size={64} weight={600} color={T.text} style={{ marginLeft: 40 }}>{KEY_REFUNDED.value} Ⓝ</Mono>
    </Plate>
  );
}
/** The choice card after the pledge: its title and the licence's share. */
export function PledgedLine({ lift }: { lift: number }) {
  return (
    <Plate lift={lift} edge={T.gold}>
      <Label size={56} track={0.12} color={T.text}>{KEY_PLEDGED.title}</Label>
      <Mono size={72} weight={600} color={T.gold}>{KEY_PLEDGED.value} Ⓝ</Mono>
    </Plate>
  );
}

/** S11's last beat: the keep-alive pool and the store's 90/10 legend as one 56 px line; the split bar fills as the pool
 * rises. With no run total yet the number holds at the pool the takes show. `f` scene frame; `rise` 0..1. */
export function PoolPanel({ f, at, rise }: { f: number; at: number; rise: number }) {
  const p = (i: number) => printIn(f, at + i * 2);
  const b = Number(KEY_SPLIT.before);
  const a = KEY_SPLIT.after === null ? null : Number(KEY_SPLIT.after);
  const v = a === null ? KEY_SPLIT.before : rise >= 1 ? KEY_SPLIT.after! : (b + (a - b) * stepped(rise, 5)).toFixed(3);
  const lit = Math.floor(stepped(rise, 10) * 10 + 1e-6);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(1)) * 100}% 0)`, display: "flex", alignItems: "baseline", gap: 26 }}>
        <Mono size={170} weight={600} color={T.gold} style={{ lineHeight: 1.05, textShadow: "0 0 40px rgba(255,201,74,0.35)" }}>{v}</Mono>
        <Mono size={84} color={T.muted} style={{ lineHeight: 1 }}>Ⓝ</Mono>
        <Label size={56} track={0.1} color={T.text}>keep-alive pool</Label>
      </div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(2)) * 100}% 0)`, display: "flex", gap: 8, width: 1500 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const cyan = i === 9;
          const on = i < lit;
          return <div key={i} style={{ flex: 1, height: 22, background: cyan ? (on ? T.cyan : "rgba(79,216,208,0.18)") : on ? T.gold : "rgba(255,201,74,0.18)",
            boxShadow: on ? `0 0 14px ${cyan ? "rgba(79,216,208,0.5)" : "rgba(255,201,74,0.5)"}` : undefined }} />;
        })}
      </div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(0)) * 100}% 0)` }}>
        <Mono size={56} color={T.text}>{KEY_SPLIT.line}</Mono>
      </div>
    </div>
  );
}
