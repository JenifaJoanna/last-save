// Explorer flash (PLAN §5), legibility pass: the window opens with the dial-up box (no URL bar), tipped slightly forward;
// the one line that matters, Basescan's "Status: Success", lifts as film type at facts LIFT.status and holds ≥ 1.5 s;
// the other fields are texture. Closes with a quick CRT collapse that ends before S15's last frame. Plays the `x-base`
// take as the window body when it exists (the lifted line stays, values from facts.ts).
import { Easing, interpolate } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import { Slot, slotSource } from "../../../film/Slot";
import { BASESCAN_STATUS, LIFT, PAYOUT, TEXTURE } from "./facts";
import { C, printP, stepIn } from "./kit";
import { LiftCard, liftShow } from "./Lift";

const W = 1240;
const H = 500;
const LEFT = 960 - W / 2;
const TOP = 540 - H / 2;
/** Window timing, relative to `at`: open 6 f, key line from t1, collapse t52–58 (6 f), bloom gone by t59. */
export const FLASH = { keyAt: 1, collapse: 52, end: 59 } as const;

/** Strength (0..1) of the flash's texture on the screen behind it. */
export const flashTexture = (f: number, at: number) => interpolate(f - at, [0, 4, FLASH.collapse, FLASH.collapse + 6], [0, 1, 1, 0], C);

export function BaseFlash({ f, at }: { f: number; at: number }) {
  const t = f - at;
  if (t < 0 || t >= FLASH.end) return null;
  const open = stepped(interpolate(t, [0, 6], [0.02, 1], C), 5);
  const collapse = interpolate(t, [FLASH.collapse, FLASH.collapse + 6], [1, 0.006], { ...C, easing: Easing.in(Easing.cubic) });
  const sy = t < FLASH.collapse ? open : collapse;
  const bloom = interpolate(t, [FLASH.collapse + 3, FLASH.collapse + 6, FLASH.end], [0, 1, 0], C);
  const bar = stepped(interpolate(t, [2, 10], [0, 1], C), 8);
  const key = liftShow(t, FLASH.keyAt, 999);
  const take = slotSource("x-base").kind === "raw";
  const rows: [string, string, string?][] = [
    ["Tx hash", PAYOUT.tx],
    ["Block", PAYOUT.block],
    ["From", `${PAYOUT.payer}  (the licence contract)`],
    ["To", PAYOUT.to],
    ["Value", PAYOUT.value],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1800, pointerEvents: "none" }}>
      {bloom > 0 && <div style={{ position: "absolute", left: 960 - 760, top: 540 - 70, width: 1520, height: 140, borderRadius: "50%", opacity: bloom * 0.6,
        background: "radial-gradient(closest-side, rgba(255,241,196,0.9), rgba(255,201,74,0.2) 60%, transparent)" }} />}
      <div style={{ position: "absolute", left: LEFT, top: TOP, width: W, height: H, transform: `rotateX(5deg) scaleY(${sy})`,
        background: T.ink2, border: `1px solid ${T.line2}`, boxShadow: "0 40px 90px -20px rgba(0,0,0,0.9)",
        filter: t >= FLASH.collapse ? `brightness(${1 + (1 - collapse) * 1.4})` : undefined, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: `${bar * 100}%`, background: T.gold }} />
        <div style={{ position: "absolute", inset: 0, opacity: 1 - (1 - TEXTURE.opacity) * key, filter: key > 0.01 ? `blur(${(TEXTURE.blur * key * 0.7).toFixed(2)}px)` : undefined }}>
          {take ? <Slot slot="x-base" tag={false} /> : (
            <div style={{ padding: "30px 40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", ...stepIn(printP(t, 4)) }}>
                <Label size={20} color={T.cyan} track={0.18}>{"// Base Sepolia · transaction"}</Label>
                <Label size={16} color={T.faint}>sepolia.basescan.org</Label>
              </div>
              <div style={{ marginTop: 170 }}>
                {rows.map(([k, v], i) => (
                  <div key={k} style={{ display: "flex", ...stepIn(printP(t, 5 + i * 2)) }}>
                    <Mono size={20} color={T.faint} style={{ width: 130, lineHeight: "44px" }}>{k}</Mono>
                    <Mono size={20} color={T.text} style={{ lineHeight: "44px" }}>{v}</Mono>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ position: "absolute", left: -LEFT, top: -TOP, width: 1920, height: 1080 }}>
          <LiftCard x={LIFT.status.x} y={LIFT.status.y} show={key} edge={T.alive} glow="rgba(69,227,148,0.22)">
            <Mono size={LIFT.status.size} color={T.muted} style={{ lineHeight: 1.1 }}>
              {BASESCAN_STATUS.label} <span style={{ color: T.alive, fontWeight: 600 }}>{BASESCAN_STATUS.value}</span>
            </Mono>
          </LiftCard>
        </div>
        <div style={{ position: "absolute", left: -1, top: -1, width: 20, height: 20, borderLeft: `3px solid ${T.ember}`, borderTop: `3px solid ${T.ember}` }} />
        <div style={{ position: "absolute", right: -1, bottom: -1, width: 20, height: 20, borderRight: `3px solid ${T.ember}`, borderBottom: `3px solid ${T.ember}` }} />
      </div>
    </div>
  );
}
