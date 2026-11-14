// S13's terminal: the fan's `pnpm host` run inside ScreenFrame "TERMINAL", with each checked line lifted 1.4× into a
// free band below the log as its narration word lands. With a real take (footage/raw/t-host.mp4, a term.html replay) the
// lifts are pixel crops of the take's rows; otherwise the log is drawn from the host CLI's own line formats
// (host/lib/mirrors.mjs, prepare.mjs, provenance.mjs) with every run-specific value elided as "…".
// S14 freezes this component on S13's last frame for its first pose.
import type { ReactNode } from "react";
import { interpolate, Sequence, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../../ds/screen";
import { Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { Slot, slotSource } from "../../../film/Slot";
import { RUN_INSTANCE } from "../../../film/run";
import { HOST_CMD, HOST_ROWS, KEY_PROVENANCE, KEY_WALRUS, LAYOUT, TAKE_FROM, TERM_CROP, TERM_ROW } from "./facts";
import { c, LiftPlate, out, printIn, ramp, word } from "./kit";

const W = (s: number) => word("S13", s);
export const TERM_AT = 70; // the terminal is on screen from here (after the roll)
const TYPE_END = TERM_AT + 24;
const SIZE = 25;
const LH = 44;
const TOP = 40;
const LEFT = 120;
const LIFT_Y = LAYOUT.s13LiftY; // content-space centre of the lift band

type Kind = "walrus" | "hash" | "provenance" | "snapshot" | "register";
interface Line { at: number; body: ReactNode; text: string; lift?: Kind; liftAt?: number }
const ok = (s: string) => <span style={{ color: T.alive }}>{s}</span>;
const HOST_LINE = `Last Save host for lastsave-fanhost.testnet on ${RUN_INSTANCE}`;
const LINES: Line[] = [
  { at: TYPE_END + 4, text: HOST_LINE, body: HOST_LINE },
  { at: TYPE_END + 10, text: "  released key matches the on-chain commitment (…)", body: "  released key matches the on-chain commitment (…)" },
  { at: W(3.42), text: "  studio copy … 530 (gone)", body: <>{"  studio copy … "}<span style={{ color: T.dead }}>530 (gone)</span></> },
  { at: W(4.06) - 6, text: "  walrus … 200, sha256 matches on-chain ✓", body: <>{"  walrus … "}{ok("200, sha256 matches on-chain ✓")}</>, lift: "walrus", liftAt: W(4.06) - 2 },
  { at: W(5.2) - 8, text: "  provenance ✓ built by workflow .github/workflows/release-build.yml … logged … (Rekor #…)", body: <>{"  provenance "}{ok("✓")}{" built by workflow .github/workflows/release-build.yml … logged … (Rekor #…)"}</>, lift: "provenance", liftAt: W(6.62) - 2 },
  { at: W(5.6), text: "  decrypted, build_hash … matches", body: <>{"  decrypted, build_hash … "}{ok("matches")}</>, lift: "hash", liftAt: W(5.96) - 2 },
  { at: W(8.28) - 4, text: "  progress snapshot restored", body: <>{"  progress snapshot "}{ok("restored")}</>, lift: "snapshot", liftAt: W(9.36) - 2 },
  { at: W(8.28) + 8, text: "Serving at https://…", body: "Serving at https://…" },
  { at: W(9.36) + 14, text: "register_host: tx …  ✓", body: <>{"register_host: tx …  "}{ok("✓")}</>, lift: "register", liftAt: W(9.36) + 20 },
];
// Only the register line still lifts as a pixel/mono chip (S14's seam); the key beats lift as film type (KEYS).
const LIFTS = LINES.map((l, i) => ({ ...l, row: i + 1 })).filter((l) => l.lift === "register");
interface Key { row: number; take: number; at: number; until: number; lines: string[] }
const KEYS: Key[] = [
  { row: 4, take: HOST_ROWS.walrus, at: W(4.06) - 4, until: W(6.62) - 6, lines: KEY_WALRUS }, // "archived copy" → "hash"
  { row: 5, take: HOST_ROWS.provenance, at: W(6.62) - 2, until: W(9.36) - 6, lines: KEY_PROVENANCE }, // "build record"
];
const keyOn = (f: number) => KEYS.some((k) => f >= k.at && f < k.until + 8);
const ticked = (t: string) => t.split("✓").flatMap((part, i) => (i ? [<span key={i} style={{ color: T.alive }}>✓</span>, part] : [part]));

/** A key line lifted off the glass as 56 px film type (frame px, outside the CRT layers). Rises from its row in 10 f,
 * holds still, sinks in 8 f. */
function KeyLift({ k, f, take }: { k: Key; f: number; take: boolean }) {
  const up = ramp(f, k.at, k.at + 10);
  const down = ramp(f, k.until, k.until + 8);
  if (up <= 0 || down >= 1) return null;
  const fromY = take ? (TERM_ROW.top + (k.take + 0.5) * TERM_ROW.h) * BOX_H : TOP + k.row * LH + LH / 2;
  const y = 102 + interpolate(up, [0, 1], [fromY, LIFT_Y]) + down * 24;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: 1 - down,
      transform: `translateY(-50%) scale(${interpolate(up, [0, 1], [SIZE / 56, 1])})` }}>
      <LiftPlate lift={up} style={{ padding: "18px 40px 20px" }}>
        {k.lines.map((t, i) => <Mono key={i} size={56} color={T.text} style={{ lineHeight: 1.3, color: i > 0 && k.row === 4 ? T.alive : T.text }}>{ticked(t)}</Mono>)}
      </LiftPlate>
    </div>
  );
}

/** Take geometry: the term.html screen below its bar, fitted to the content height (868) and centred. */
const BOX_H = 868;
const BOX_W = Math.round(BOX_H * ((TERM_CROP.w * 1920) / (TERM_CROP.h * 1080)));
const BOX_X = Math.round((1878 - BOX_W) / 2);
function takeRowCrop(row: number) {
  const y = TERM_CROP.y + (TERM_ROW.top + row * TERM_ROW.h) * TERM_CROP.h;
  return { x: TERM_CROP.x, y, w: TERM_CROP.w, h: TERM_ROW.h * TERM_CROP.h };
}

function LiftedRow({ l, f, take }: { l: (typeof LIFTS)[number]; f: number; take: boolean }) {
  const next = LIFTS.find((x) => x.liftAt! > l.liftAt!);
  const up = ramp(f, l.liftAt!, l.liftAt! + 10);
  const down = next ? ramp(f, next.liftAt! - 2, next.liftAt! + 6) : 0;
  if (up <= 0 || down >= 1) return null;
  const fromY = take ? (TERM_ROW.top + (HOST_ROWS[l.lift!] + 0.5) * TERM_ROW.h) * BOX_H : TOP + l.row * LH + LH / 2;
  const y = interpolate(up, [0, 1], [fromY, LIFT_Y]) + down * 30;
  const s = interpolate(up, [0, 1], [1, 1.4]);
  const rowH = take ? TERM_ROW.h * BOX_H : LH;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: 1 - down, transform: `translateY(-50%) scale(${s})` }}>
      <LiftPlate lift={up} style={{ padding: take ? "4px 0" : "6px 22px", maxWidth: 1200 }}>
        {take ? (
          <div style={{ position: "relative", width: BOX_W * 0.9, height: rowH, overflow: "hidden" }}>
            <Sequence from={TERM_AT} layout="none"><Slot slot="t-host" from={TAKE_FROM["t-host"]} crop={takeRowCrop(HOST_ROWS[l.lift!])} tag={false} /></Sequence>
          </div>
        ) : <Mono size={SIZE} style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{l.body}</Mono>}
      </LiftPlate>
    </div>
  );
}

/** The terminal content (inside ScreenFrame). `f` = scene frame of S13. */
function Log({ f, take }: { f: number; take: boolean }) {
  const typed = Math.floor(interpolate(f, [TERM_AT + 2, TYPE_END], [0, HOST_CMD.length], c));
  const anyLift = LINES.some((l) => l.lift && f >= l.liftAt!);
  const tex = keyOn(f);
  if (take) {
    return (
      <div style={{ position: "absolute", left: BOX_X, top: 0, width: BOX_W, height: BOX_H, opacity: tex ? 0.4 : anyLift ? 0.5 : 1, filter: tex ? "blur(2px)" : undefined }}>
        <Sequence from={TERM_AT} layout="none"><Slot slot="t-host" from={TAKE_FROM["t-host"]} crop={TERM_CROP} /></Sequence>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: LEFT, top: TOP, opacity: tex ? 0.4 : 1, filter: tex ? "blur(2px)" : undefined }}>
      <Mono size={SIZE} style={{ lineHeight: `${LH}px` }}><span style={{ color: T.gold }}>$ </span>{HOST_CMD.slice(0, typed)}{f < TYPE_END + 4 && <span style={{ color: T.gold }}>█</span>}</Mono>
      {LINES.map((l, i) => {
        const p = printIn(f, l.at);
        if (p <= 0) return null;
        const landed = l.lift && f >= l.liftAt!;
        return (
          <div key={i} style={{ position: "relative", clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, opacity: anyLift && !landed ? 0.55 : 1 }}>
            {landed && <div style={{ position: "absolute", left: -26, top: 12, width: 6, height: LH - 24, background: T.alive, boxShadow: "0 0 10px rgba(69,227,148,0.6)" }} />}
            <Mono size={SIZE} color={T.text} style={{ lineHeight: `${LH}px` }}>{l.body}</Mono>
          </div>
        );
      })}
      {f >= LINES[LINES.length - 1].at + 12 && <Mono size={SIZE} color={T.gold} style={{ lineHeight: `${LH}px`, opacity: Math.floor(f / 15) % 2 ? 0.25 : 1 }}>█</Mono>}
    </div>
  );
}

/** ScreenFrame "TERMINAL" with the run and its lifts; pushes toward the final (register) lift in the last second. */
export function HostTerminal({ at }: { at?: number }) {
  const now = useCurrentFrame();
  const f = at ?? now;
  const take = slotSource("t-host").kind === "raw";
  const push = interpolate(f, [TERM_AT, 296], [1, 1.03], c) + 0.09 * ramp(f, 296, 333, out);
  return (
    <Camera scale={push} fx={960} fy={102 + LIFT_Y}>
      <ScreenFrame title="Terminal" mode="released" titleAt={TERM_AT - 4}>
        <Log f={f} take={take} />
        {LIFTS.map((l) => <LiftedRow key={l.lift} l={l} f={f} take={take} />)}
      </ScreenFrame>
      {KEYS.map((k) => <KeyLift key={k.row} k={k} f={f} take={take} />)}
    </Camera>
  );
}
