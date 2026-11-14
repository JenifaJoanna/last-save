// Camera-facing tags, floor print and the licence contract block of the machine world (after frames/c/Tags.tsx),
// timed by explicit frames so each lands on its VO word. Every print is the terminal's steps(5) 400 ms (12 f).
import type { ReactNode } from "react";
import { interpolate } from "remotion";
import { FONT, stepped, T } from "../../../ds/tokens";
import { decode } from "../../../ds/type";
import { Box, OnFloor, Tag } from "../../../frames/c/iso";
import { ENC, Padlock } from "../../../frames/c/parts";
import { Billboard } from "./iso";
import { CL } from "./motion";

/** steps(5) print-in over 12 frames starting at `a`. */
export const pr = (f: number, a: number, len = 12) => stepped(interpolate(f, [a, a + len], [0, 1], CL), 5);
const slide = (p: number) => ({ opacity: p, transform: `translateX(${(1 - p) * -14}px)` });

/** SERVER BUILD → ENCRYPTING (decode) → ENCRYPTED with padlock. */
export function StatusTag({ f, x, y, z, encAt, doneAt, hideAt }: { f: number; x: number; y: number; z: number; encAt: number; doneAt: number; hideAt: number }) {
  const enc = f >= encAt, done = f >= doneAt;
  const label = !enc ? "Server build" : done ? "Encrypted" : decode("ENCRYPTING", interpolate(f, [encAt, doneAt - 2], [0, 1], CL), f);
  const op = Math.min(pr(f, 2), 1 - pr(f, hideAt, 8));
  if (op <= 0) return null;
  return (
    <Billboard x={x} y={y} z={z}>
      <Tag label={label} color={done ? T.gold : enc ? T.amber : T.text} accent={done ? "rgba(255,201,74,0.6)" : T.line2} lift={60} opacity={op}
        sub={!enc ? "Ember Rift · before launch" : undefined} icon={done ? <Padlock size={22} color={T.gold} /> : undefined} />
    </Billboard>
  );
}

export function PlinthTag({ f, x, y, z, at, label, sub, gold, fade = 1 }: { f: number; x: number; y: number; z: number; at: number; label: string; sub: ReactNode; gold?: boolean; fade?: number }) {
  const p = pr(f, at) * fade;
  if (p <= 0) return null;
  return (
    <Billboard x={x} y={y} z={z}>
      <div style={{ transform: `translateX(${(1 - p) * -14}px)` }}>
        <Tag label={label} sub={sub} lift={58} opacity={p} color={gold ? T.gold : T.text} accent={gold ? "rgba(255,201,74,0.7)" : "rgba(255,201,74,0.5)"} />
      </div>
    </Billboard>
  );
}

export function Tick({ size = 34, color = T.alive }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="square" style={{ marginLeft: 10, flexShrink: 0 }}><path d="M4.5 12.5l5 5L19.5 7" /></svg>;
}

/** "sigstore · build record logged ✓" typed onto the floor like a receipt strip. */
export function LogStrip({ f, at, x, y }: { f: number; at: number; x: number; y: number }) {
  const text = "sigstore · build record logged";
  const p = interpolate(f, [at, at + 22], [0, 1], CL);
  if (p <= 0) return null;
  const n = Math.floor(p * text.length);
  return (
    <OnFloor x={x} y={y} w={620} d={58} z={2}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", borderLeft: `3px solid ${T.alive}`,
        background: "linear-gradient(90deg, rgba(69,227,148,0.12), transparent)", fontFamily: FONT.mono, fontSize: 27, color: T.text, whiteSpace: "pre" }}>
        <span style={{ color: T.alive }}>{">"}</span>{text.slice(0, n)}{p >= 1 ? <svg width={36} height={60} viewBox="0 0 24 24" preserveAspectRatio="none" fill="none" stroke={T.alive} strokeWidth={3.2} style={{ marginLeft: 14, flexShrink: 0 }}><path d="M3.5 12.5l6 6L20.5 5" /></svg> : <span style={{ color: T.gold }}>█</span>}
      </div>
    </OnFloor>
  );
}

export function EnclaveTag({ f, at }: { f: number; at: number }) {
  const a = pr(f, at);
  if (a <= 0) return null;
  return (
    <Billboard x={ENC.x - ENC.s / 2} y={ENC.y - ENC.s / 2} z={ENC.s}>
      <div style={{ transform: `translateX(${(1 - a) * -14}px)` }}><Tag label="OutLayer enclave" sub="Intel TDX" side="left" lift={40} opacity={a} accent="rgba(79,216,208,0.6)" color={T.cyan} /></div>
    </Billboard>
  );
}

function Lock({ text, p }: { text: string; p: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...slide(p), background: "rgba(18,14,34,0.95)", border: "1px solid rgba(79,216,208,0.6)", borderRadius: 4,
      padding: "10px 16px", fontFamily: FONT.mono, fontSize: 21, color: T.text, whiteSpace: "nowrap", boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}>
      <Padlock size={22} color={T.cyan} /><span style={{ color: T.cyan }}>only</span>{text}
    </div>
  );
}

/** The two locks on the enclave: the contract account, then the release program's hash. */
export function LockTags({ f, a, b, account, wasm }: { f: number; a: number; b: number; account: string; wasm: string }) {
  const pa = pr(f, a), pb = pr(f, b);
  if (pa <= 0) return null;
  return (
    <Billboard x={ENC.x + 60} y={ENC.y + ENC.s / 2 + 170} z={0}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <Lock text={account} p={pa} />
        {pb > 0 && <Lock text={`release.wasm ${wasm}`} p={pb} />}
      </div>
    </Billboard>
  );
}

export const CONTRACT = { x: ENC.x, y: ENC.y, z: ENC.s + 250, w: 250, d: 250, h: 60 };

/** The licence contract floating above the enclave, joined by a beam that lights with the first lock. */
export function ContractBlock({ f, beamAt, keysAt, glow, account, keys }: { f: number; beamAt: number; keysAt: number; glow: number; account: string; keys: string }) {
  const beam = pr(f, beamAt, 10);
  const k = pr(f, keysAt);
  const edge = `rgba(255,201,74,${0.35 + 0.6 * glow})`;
  return (
    <>
      <Box x={ENC.x} y={ENC.y} z={ENC.s} w={8} d={8} h={CONTRACT.z - ENC.s} all edgeColor={`rgba(79,216,208,${0.2 + 0.6 * beam})`} opacity={0.3 + 0.7 * beam}
        top={{ fill: T.cyan }} front={{ fill: `rgba(79,216,208,${0.15 + 0.5 * beam})` }} left={{ fill: `rgba(79,216,208,${0.12 + 0.4 * beam})` }}
        back={{ fill: "rgba(79,216,208,0.1)" }} right={{ fill: "rgba(79,216,208,0.1)" }} />
      <Box x={CONTRACT.x} y={CONTRACT.y} z={CONTRACT.z} w={CONTRACT.w} d={CONTRACT.d} h={CONTRACT.h} edgeColor={edge}
        top={{ fill: T.panel, style: { boxShadow: `inset 0 0 0 2px ${edge}, 0 0 ${70 * glow}px rgba(255,201,74,${0.5 * glow})` }, children: (
          <div style={{ position: "absolute", inset: 18, border: `1px dashed rgba(255,201,74,${0.3 + 0.5 * glow})`, borderRadius: 4, display: "grid", placeItems: "center" }}>
            <div style={{ fontFamily: FONT.label, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", color: T.gold, textAlign: "center", lineHeight: "28px" }}>LICENCE<br />CONTRACT</div>
          </div>
        ) }}
        front={{ fill: "#241c3e" }} left={{ fill: "#1a1530" }} />
      <Billboard x={CONTRACT.x - CONTRACT.w / 2} y={CONTRACT.y - CONTRACT.d / 2} z={CONTRACT.z + CONTRACT.h}>
        <div style={{ position: "absolute", left: -1, top: -54, width: 2, height: 54, background: `linear-gradient(180deg, rgba(255,201,74,0.7), transparent)` }} />
        <div style={{ position: "absolute", left: 0, top: -54, transform: "translate(calc(-100% + 14px), -100%)", background: "rgba(18,14,34,0.95)", border: "1px solid rgba(255,201,74,0.7)",
          borderRadius: 4, padding: "12px 18px", whiteSpace: "nowrap", boxShadow: "0 10px 30px rgba(0,0,0,0.45)" }}>
          <div style={{ fontFamily: FONT.label, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", textTransform: "uppercase", color: T.gold }}>Licence contract</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 18, color: T.muted, marginTop: 4 }}>{account}</div>
          {k > 0 && <div style={{ ...slide(k), marginTop: 10, fontFamily: FONT.mono, fontSize: 34, fontWeight: 600, color: T.text }}>
            <span style={{ color: T.gold }}>{keys}</span> access keys
          </div>}
        </div>
      </Billboard>
    </>
  );
}
