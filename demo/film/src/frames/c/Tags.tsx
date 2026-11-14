// Camera-facing tags and printed floor copy for frame C, timed from the frame number.
import { interpolate } from "remotion";
import { FONT, stepped, T } from "../../ds/tokens";
import { decode } from "../../ds/type";
import { Billboard, OnFloor, Tag } from "./iso";
import { BLOCK, ENC, Padlock, PAD_H } from "./parts";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pr = (f: number, a: number, len = 10) => stepped(interpolate(f, [a, a + len], [0, 1], c), 5);

export function BlockStatus({ f, x, y }: { f: number; x: number; y: number }) {
  const enc = f >= 18;
  const done = f >= 34;
  const label = !enc ? "SERVER BUILD" : done ? "ENCRYPTED" : decode("ENCRYPTING", interpolate(f, [18, 30], [0, 1], c), f);
  const color = !enc ? T.text : done ? T.gold : T.amber;
  const op = interpolate(f, [2, 8, 42, 48], [0, 1, 1, 0], c);
  return (
    <Billboard x={x} y={y} z={PAD_H + BLOCK.h}>
      <Tag label={label} color={color} accent={done ? "rgba(255,201,74,0.6)" : T.line2} lift={64} opacity={op}
        sub={!enc ? "Ember Rift · before launch" : undefined} icon={done ? <Padlock size={22} color={T.gold} /> : undefined} />
    </Billboard>
  );
}

export function PlinthTag({ f, x, y, at, label, sub }: { f: number; x: number; y: number; at: number; label: string; sub: string }) {
  const p = pr(f, at);
  if (p <= 0) return null;
  return (
    <Billboard x={x} y={y} z={PAD_H + BLOCK.h}>
      <div style={{ transform: `translateX(${(1 - p) * -14}px)` }}><Tag label={label} sub={sub} lift={58} opacity={p} accent="rgba(255,201,74,0.5)" /></div>
    </Billboard>
  );
}

export function EnclaveTags({ f }: { f: number }) {
  const a = pr(f, 66);
  const b = pr(f, 92, 8);
  const d = pr(f, 98, 8);
  const lock = (text: string, p: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: p, transform: `translateX(${(1 - p) * -14}px)`, background: "rgba(18,14,34,0.94)",
      border: "1px solid rgba(79,216,208,0.55)", borderRadius: 4, padding: "8px 14px", fontFamily: FONT.mono, fontSize: 18, color: T.text, whiteSpace: "nowrap" }}>
      <Padlock size={20} color={T.cyan} /><span style={{ color: T.cyan }}>only</span>{text}
    </div>
  );
  return (
    <>
      {a > 0 && (
        <Billboard x={ENC.x - ENC.s / 2} y={ENC.y - ENC.s / 2} z={ENC.s}>
          <div style={{ transform: `translateX(${(1 - a) * -14}px)` }}><Tag label="OutLayer enclave" sub="Intel TDX" side="left" lift={40} opacity={a} accent="rgba(79,216,208,0.6)" color={T.cyan} /></div>
        </Billboard>
      )}
      {b > 0 && (
        <Billboard x={ENC.x - ENC.s / 2} y={ENC.y + ENC.s / 2} z={0}>
          <div style={{ position: "absolute", left: 0, top: 30, transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            {lock("lastsave-licence.testnet", b)}
            {d > 0 && lock("release.wasm 9fafaf8e…", d)}
          </div>
        </Billboard>
      )}
    </>
  );
}

/** "sigstore · build record logged" printed on the floor like a receipt strip, typed in. */
export function LogStrip({ f, x, y }: { f: number; x: number; y: number }) {
  const text = "sigstore · build record logged";
  const p = interpolate(f, [56, 80], [0, 1], c);
  if (p <= 0) return null;
  const n = Math.floor(p * text.length);
  return (
    <OnFloor x={x} y={y} w={540} d={56} z={2}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderLeft: `3px solid ${T.alive}`,
        background: "linear-gradient(90deg, rgba(69,227,148,0.10), transparent)", fontFamily: FONT.mono, fontSize: 26, color: T.text, whiteSpace: "pre" }}>
        <span style={{ color: T.alive }}>{">"}</span>{text.slice(0, n)}{p >= 1 ? <span style={{ color: T.alive, fontWeight: 600 }}> ok</span> : <span style={{ color: T.gold }}>█</span>}
      </div>
    </OnFloor>
  );
}
