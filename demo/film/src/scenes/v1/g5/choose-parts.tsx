// S11 parts: a mini LS-0001 device playing one holder's take (FrameB device look at small scale), the relayer toast
// that lifts off the glass, and the keep-alive pool panel the scene ends on.
import { Sequence } from "remotion";
import { Terminal } from "../../../ds/crt";
import { Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import { Slot } from "../../../film/Slot";
import { CHOOSE_CROP, KEY_SPLIT, KEY_TOAST, TAKE_FROM } from "./facts";
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
export function MiniDevice({ h, f, land, appear, dim, float, focus = 0 }: { h: Holder; f: number; land: number; appear: number; dim: number; float: number; focus?: number }) {
  const col = tint(h);
  const reveal = printIn(f, land);
  return (
    <div style={{ position: "absolute", left: h.x - DW / 2, top: h.y - DH / 2 + float, width: DW, height: DH, transformStyle: "preserve-3d",
      transform: `translateZ(${h.z - (1 - appear) * 700}px) rotateY(${h.ry}deg) rotateX(3deg)`, opacity: appear * (1 - 0.6 * dim),
      filter: dim > 0.01 ? `blur(${(2.6 * dim).toFixed(2)}px)` : undefined }}>
      <Tag color={col} size={20 + 18 * focus} style={{ position: "absolute", left: 6, top: -54 - 26 * focus }}>{h.kind === "refund" ? "Refund" : "Pledge"} · {h.who}</Tag>
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

/** The app's gasless toast lifted off the glass as film type: the body line at 56 px is the beat; the title is texture. */
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

/** S11's last beat: the keep-alive pool rising as a post-shutdown sale lands, and the 90/10 split as one 56 px line.
 * `f` scene frame; `at` print-in start; `rise` 0..1 drives the count from KEY_SPLIT.before to .after (stepped). */
export function PoolPanel({ f, at, rise }: { f: number; at: number; rise: number }) {
  const p = (i: number) => printIn(f, at + i * 2);
  const b = Number(KEY_SPLIT.before), a = Number(KEY_SPLIT.after);
  const v = rise >= 1 ? KEY_SPLIT.after : (b + (a - b) * stepped(rise, 5)).toFixed(3);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(0)) * 100}% 0)`, display: "flex", alignItems: "baseline", gap: 26 }}>
        <Mono size={170} weight={600} color={T.gold} style={{ lineHeight: 1.05, textShadow: "0 0 40px rgba(255,201,74,0.35)" }}>{v}</Mono>
        <Mono size={84} color={T.muted} style={{ lineHeight: 1 }}>Ⓝ</Mono>
        <Label size={56} track={0.1} color={T.text}>keep-alive pool</Label>
      </div>
      <div style={{ clipPath: `inset(0 0 ${(1 - p(2)) * 100}% 0)` }}>
        <Mono size={56} color={T.text}>{KEY_SPLIT.line}</Mono>
      </div>
    </div>
  );
}
