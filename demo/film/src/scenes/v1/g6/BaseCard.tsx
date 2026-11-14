// Motion-graphics stand-in for the `base` take: the bottom of /app/hosts, "Get paid on Base Sepolia" (web/src/pages/app/
// evm-payouts.tsx), drawn at 1x in ScreenFrame content coords so the real take drops in with the same framing. The payout
// row runs Booked → Sign → "MPC signing…" → "Signed by MPC" (the transmission readout prints in) → Relay → "On Base
// Sepolia". Values are payout #0 of the run (facts.ts PAYOUT). Shown only while public/footage has no `base`.
import type { CSSProperties } from "react";
import { interpolate } from "remotion";
import { Keycap } from "../../../ds/crt";
import { decode, Label } from "../../../ds/type";
import { FONT, T } from "../../../ds/tokens";
import { Icon } from "./icons";
import { PAYOUT } from "./facts";
import { C, out, printP, stepIn } from "./kit";

/** Beats (S15 frames). V14 at f9: "base" f59, "signs" f125, "no one" f174. The lifted lines are S15's overlays. */
export const B15 = { land: 18, signPress: 56, signed: 121, relayPress: 150, relayed: 156, txHi: 214 } as const;

/** Layout (content coords, px at 1x). The card sits in the app's max-w-6xl column. */
export const CARD = { x: 363, y: 36, w: 1152 } as const;
export const ROW_Y = 292; // payout row top (border)
export const READOUT = { x: 397, y: 372, line: 20 } as const; // readout text origin; eyebrow first, then 6 lines
export const AMOUNT = { x: 737, y: 357 }; // centre of "0.04 Ⓝ" in the row's second line, content coords (lift landing)

const CHIP: Record<string, [string, string, string]> = {
  Booked: ["rgba(255,201,74,0.4)", "rgba(255,201,74,0.1)", T.gold],
  Signing: ["rgba(255,107,43,0.4)", "rgba(255,107,43,0.1)", T.ember],
  Signed: ["rgba(79,216,208,0.4)", "rgba(79,216,208,0.1)", T.cyan],
};

function Chip({ kind, text, style }: { kind: keyof typeof CHIP; text: string; style?: CSSProperties }) {
  const [b, bg, c] = CHIP[kind];
  return <Label size={10} color={c} style={{ border: `1px solid ${b}`, background: bg, padding: "2px 6px", ...style }}>{text}</Label>;
}

/** `f` scene frame (S15). The amount S14 lifted flies in as S15's overlay and lands here at B15.land. */
export function BaseCard({ f }: { f: number }) {
  const signed = f >= B15.signed;
  const signing = f >= B15.signPress + 3 && !signed;
  const relayed = f >= B15.relayed;
  const kind = signed ? "Signed" : signing ? "Signing" : "Booked";
  const chipText = relayed ? "On Base Sepolia" : signed ? "Signed by MPC" : signing ? "MPC signing…" : "Booked";


  const amtGlow = interpolate(f, [0, B15.land, B15.land + 24], [1, 1, 0], C);

  const press = (at: number) => (f >= at && f < at + 2 ? 1 : f >= at + 2 && f < at + 4 ? 0.5 : 0);
  const valueDecode = interpolate(f, [B15.land - 2, B15.land + 9], [0, 1], C);
  const lines: [string, string][] = [
    ["type", "0x02 · EIP-1559 · chainId 84532 (Base Sepolia)"],
    ["nonce", String(PAYOUT.nonce)],
    ["to", PAYOUT.to],
    ["value", PAYOUT.value],
    ["signed by", "NEAR MPC network for the licence contract"],
    ["tx", PAYOUT.tx],
  ];
  const txHi = interpolate(f, [B15.txHi - 6, B15.txHi], [0, 1], C);

  return (
    <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, fontFamily: FONT.mono, color: T.text, background: "rgba(255,255,255,0.018)", border: `1px solid ${T.line}`, borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 20px 0" }}>
        <Icon name="radio" size={20} color={T.cyan} />
        <Label size={16} color={T.text}>Get paid on Base Sepolia</Label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, padding: "16px 20px 20px" }}>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: T.muted }}>
          <p style={{ margin: 0 }}>The licence contract controls one Base Sepolia address through NEAR Chain Signatures. NEAR's MPC network signs for the contract; no person or server holds the key.</p>
          <div style={{ position: "relative", marginTop: 12, padding: 12, border: `1px solid ${T.line2}`, borderRadius: 2 }}>
            <Label size={10} color={T.cyan} track={0.18}>{"// Contract's Base address"}</Label>
            <div style={{ marginTop: 4, fontSize: 13, color: T.text }}>{PAYOUT.payer}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: T.faint }}>derived from {PAYOUT.instance} + path lastsave/host-payouts on v1.signer-prod.testnet · chain 84532</div>
            <div style={{ position: "absolute", left: -2, top: -2, width: 12, height: 12, borderLeft: `2px solid ${T.ember}`, borderTop: `2px solid ${T.ember}` }} />
            <div style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRight: `2px solid ${T.ember}`, borderBottom: `2px solid ${T.ember}` }} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: T.muted }}>Your epochs pay out to <span style={{ color: T.text }}>{PAYOUT.toShort}</span> on Base Sepolia.</div>
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
            <Label size={13} weight={700}>Epoch {PAYOUT.epoch}</Label>
            <span style={{ color: T.muted }}>{PAYOUT.sessions} verified sessions</span>
            <Chip kind={relayed ? "Signed" : kind} text={chipText} />
          </div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.muted }}>
            <span style={{ color: T.text, fontWeight: 600 }}>{decode(PAYOUT.value, valueDecode, f)}</span>
            <Icon name="swap" size={14} />
            <span style={{ fontSize: 12 }}>{PAYOUT.toShort}</span>
            <span style={{ color: T.faint }}>· nonce {PAYOUT.nonce}</span>
            <span style={{ color: T.faint }}>·{" "}
              <span style={{ display: "inline-block", visibility: f < B15.land ? "hidden" : "visible", color: amtGlow > 0 ? T.alive : T.faint, fontWeight: amtGlow > 0 ? 600 : 400,
                textShadow: amtGlow > 0 ? `0 0 ${6 * amtGlow}px rgba(69,227,148,${0.7 * amtGlow})` : undefined }}>{PAYOUT.near} Ⓝ</span>
              {" "}moved to EVM-settled</span>
          </div>
          {signed && (
            <div style={{ marginTop: 12, borderLeft: "2px solid rgba(255,201,74,0.7)", background: "rgba(10,8,20,0.6)", padding: "8px 12px", fontSize: 11.5, lineHeight: "20px" }}>
              <div style={stepIn(printP(f, B15.signed + 2))}><Label size={10} color={T.gold}>{"// Signed transmission received"}</Label></div>
              {lines.map(([k, v], i) => {
                const hi = k === "tx" ? txHi : 0;
                return (
                  <div key={k} style={{ ...stepIn(printP(f, B15.signed + 5 + i * 2)), whiteSpace: "nowrap", position: "relative" }}>
                    {hi > 0 && <span style={{ position: "absolute", left: -6, right: -6, top: 0, bottom: 0, background: `rgba(255,201,74,${0.12 * hi})`, borderLeft: `2px solid rgba(255,201,74,${hi})` }} />}
                    <span style={{ position: "relative", color: T.faint }}>&gt; {k.padEnd(9, " ")}</span> <span style={{ position: "relative", color: hi > 0.5 ? T.gold : T.text }}>{v}</span>
                  </div>
                );
              })}
              <div style={{ ...stepIn(printP(f, B15.signed + 19)), display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                <Label size={10} color={T.gold}>Open on Basescan</Label><Icon name="link" size={12} color={T.gold} />
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!signed && <Keycap primary press={press(B15.signPress)} style={{ fontSize: 11, padding: "0 12px", gap: 8 }}><Icon name="fingerprint" size={16} />Sign</Keycap>}
          {signed && !relayed && <Keycap primary press={press(B15.relayPress)} style={{ fontSize: 11, padding: "0 12px", gap: 8 }}><Icon name="send" size={16} />Relay</Keycap>}
          {signed && <Label size={11} color={T.muted} style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}><Icon name="zap" size={16} />Bump fee</Label>}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${T.line}`, padding: "12px 20px", fontSize: 12, lineHeight: 1.6, color: T.faint }}>
        Demo rate: 0.00001 ETH per verified session. The NEAR it replaces moves into the contract's EVM-settled bucket, which no method can withdraw. On mainnet this would settle through NEAR Intents. Anyone can sign, relay or re-sign a stuck payout; a re-sign keeps the same nonce, so only one transfer can land.
      </div>
    </div>
  );
}
