// S11 parts: a mini LS-0001 device playing one holder's take (FrameB device look at small scale), the relayer toast
// that lifts off the glass, and the keep-alive pool panel the scene ends on.
import { Sequence } from "remotion";
import { Terminal } from "../../../ds/crt";
import { Eyebrow, Label, Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { Slot } from "../../../film/Slot";
import { CHOOSE_CROP, POOL, TAKE_FROM } from "./facts";
import { printIn, Tag } from "./kit";

export const DW = 780;
export const DH = 440;
const K = 0.9;

export interface Holder { slot: string; who: string; kind: "refund" | "pledge"; x: number; y: number; z: number; ry: number }
export const HOLDERS: Holder[] = [
  { slot: "refund", who: "yuna", kind: "refund", x: 500, y: 316, z: -120, ry: 9 },
  { slot: "refund2", who: "dario", kind: "refund", x: 520, y: 806, z: -240, ry: 7 },
  { slot: "pledge", who: "mira", kind: "pledge", x: 1420, y: 316, z: -200, ry: -8 },
  { slot: "pledge2", who: "kofi", kind: "pledge", x: 1400, y: 806, z: -90, ry: -10 },
];
export const tint = (h: Holder) => (h.kind === "refund" ? T.cyan : T.gold);

/** One device. `f` is the scene frame, `land` the frame its key row arrives (the take prints in from there). */
export function MiniDevice({ h, f, land, appear, dim, float }: { h: Holder; f: number; land: number; appear: number; dim: number; float: number }) {
  const col = tint(h);
  const reveal = printIn(f, land);
  return (
    <div style={{ position: "absolute", left: h.x - DW / 2, top: h.y - DH / 2 + float, width: DW, height: DH, transformStyle: "preserve-3d",
      transform: `translateZ(${h.z - (1 - appear) * 700}px) rotateY(${h.ry}deg) rotateX(3deg)`, opacity: appear * (1 - 0.6 * dim),
      filter: dim > 0.01 ? `blur(${(2.6 * dim).toFixed(2)}px)` : undefined }}>
      <Tag color={col} size={20} style={{ position: "absolute", left: 6, top: -54 }}>{h.kind === "refund" ? "Refund" : "Pledge"} · {h.who}</Tag>
      <Terminal width={DW} height={DH} k={K} title="Licence status" mode="released" hints={false}
        style={{ boxShadow: `inset -3px -3px 0 ${col}66, inset 0 1px 0 rgba(255,255,255,0.07), 0 0 90px ${col}24, 0 60px 120px -40px rgba(0,0,0,0.95)` }}>
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

/** The app's transaction toast (web/src/lib/toast.tsx + wallet.tsx gasless body) drawn at 1.5×. */
export function RelayerToast({ lift }: { lift: number }) {
  return (
    <div style={{ width: 600, display: "flex", gap: 18, padding: 26, borderRadius: 22, background: "rgba(31,25,56,0.96)", border: `1px solid ${T.line2}`,
      boxShadow: `0 ${20 + 50 * lift}px ${50 + 70 * lift}px -20px rgba(0,0,0,0.95), 0 0 ${60 * lift}px rgba(69,227,148,0.16)` }}>
      <CheckIcon size={32} />
      <div>
        <Mono size={24} weight={600} style={{ lineHeight: 1.3 }}>Refund sent</Mono>
        <Mono size={22} color={T.muted} style={{ marginTop: 6, lineHeight: 1.35 }}>Gas paid by the relayer: <span style={{ color: T.alive, fontWeight: 600 }}>you paid 0 Ⓝ.</span></Mono>
        <Mono size={21} color={T.ember} style={{ marginTop: 12 }}>View on explorer ↗</Mono>
      </div>
    </div>
  );
}

/** The pool total the scene lands on (Money card wording: "Runway: n epochs at the x Ⓝ epoch cap (… each)"). */
export function PoolPanel({ f, at }: { f: number; at: number }) {
  const p = (i: number) => printIn(f, at + i * 2);
  const lit = Math.floor(Math.min(1, Math.max(0, (f - at - 8) / 16)) * POOL.runwayEpochs + 1e-6);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 420 }}>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(0)) * 100}% 0)` }}><Eyebrow size={24}>Where the money is</Eyebrow></div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(1)) * 100}% 0)`, marginTop: 18 }}><Label size={34} track={0.14}>Keep-alive pool</Label></div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(2)) * 100}% 0)`, display: "flex", alignItems: "baseline", gap: 24, marginTop: 6 }}>
        <Mono size={190} weight={600} color={T.gold} style={{ lineHeight: 1.05, textShadow: "0 0 40px rgba(255,201,74,0.35)" }}>{POOL.total}</Mono>
        <Mono size={92} color={T.muted} style={{ lineHeight: 1 }}>Ⓝ</Mono>
      </div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(3)) * 100}% 0)`, display: "flex", gap: 8, width: 1000, marginTop: 26 }}>
        {Array.from({ length: POOL.runwayEpochs }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 18, background: i < lit ? T.cyan : "rgba(79,216,208,0.16)", boxShadow: i < lit ? "0 0 14px rgba(79,216,208,0.5)" : undefined }} />
        ))}
      </div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(4)) * 100}% 0)`, marginTop: 20 }}>
        <Mono size={28} color={T.muted}>Runway: <span style={{ color: T.text }}>{POOL.runwayEpochs} epochs</span> at the {POOL.epochCap} Ⓝ epoch cap ({POOL.epochLen} each).</Mono>
      </div>
    </div>
  );
}
