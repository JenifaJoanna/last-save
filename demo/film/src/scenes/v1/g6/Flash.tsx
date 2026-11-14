// Explorer flash (PLAN §5): a ~1-s window that opens with the dial-up box (no URL bar), tipped slightly forward, then
// closes with a CRT collapse at half speed. Plays the `x-base` take when it exists; until then it prints the Basescan
// facts of payout #0 in the terminal palette (proof/v2-e2e.md: tx, block 58635246, success, payer, recipient, value).
import { Easing, interpolate } from "remotion";
import { Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import { Slot, slotSource } from "../../../film/Slot";
import { PAYOUT } from "./facts";
import { C, printP, stepIn } from "./kit";

const W = 1240;
const H = 480;

/** `at`: frame the window starts opening. Open 6 f, hold, collapse 14 f from at+32. */
export function BaseFlash({ f, at }: { f: number; at: number }) {
  const t = f - at;
  if (t < 0 || t > 50) return null;
  const open = stepped(interpolate(t, [0, 6], [0.02, 1], C), 5);
  const collapse = interpolate(t, [32, 46], [1, 0.006], { ...C, easing: Easing.in(Easing.cubic) });
  const sy = t < 32 ? open : collapse;
  const bloom = interpolate(t, [38, 46, 50], [0, 1, 0], C);
  const bar = stepped(interpolate(t, [2, 10], [0, 1], C), 8);
  const take = slotSource("x-base").kind === "raw";
  const rows: [string, string, string?][] = [
    ["Tx hash", PAYOUT.tx],
    ["Status", "✓ Success", T.alive],
    ["Block", PAYOUT.block],
    ["From", `${PAYOUT.payer}  (the licence contract)`],
    ["To", PAYOUT.to],
    ["Value", PAYOUT.value, T.gold],
  ];
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1800, pointerEvents: "none" }}>
      {bloom > 0 && <div style={{ position: "absolute", left: 960 - 760, top: 540 - 70, width: 1520, height: 140, borderRadius: "50%", opacity: bloom * 0.6,
        background: "radial-gradient(closest-side, rgba(255,241,196,0.9), rgba(255,201,74,0.2) 60%, transparent)" }} />}
      <div style={{ position: "absolute", left: 960 - W / 2, top: 540 - H / 2, width: W, height: H, transform: `rotateX(5deg) scaleY(${sy})`,
        background: T.ink2, border: `1px solid ${T.line2}`, boxShadow: "0 40px 90px -20px rgba(0,0,0,0.9)",
        filter: t >= 32 ? `brightness(${1 + (1 - collapse) * 1.4})` : undefined, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: `${bar * 100}%`, background: T.gold }} />
        {take ? <Slot slot="x-base" tag={false} /> : (
          <div style={{ padding: "34px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", ...stepIn(printP(t, 5)) }}>
              <Label size={20} color={T.cyan} track={0.18}>{"// Base Sepolia · transaction"}</Label>
              <Label size={16} color={T.faint}>sepolia.basescan.org</Label>
            </div>
            <div style={{ marginTop: 22 }}>
              {rows.map(([k, v, c], i) => (
                <div key={k} style={{ display: "flex", ...stepIn(printP(t, 7 + i * 2)) }}>
                  <Mono size={22} color={T.faint} style={{ width: 150, lineHeight: "54px" }}>{k}</Mono>
                  <Mono size={22} color={c ?? T.text} weight={c ? 600 : 400} style={{ lineHeight: "54px" }}>{v}</Mono>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ position: "absolute", left: -1, top: -1, width: 20, height: 20, borderLeft: `3px solid ${T.ember}`, borderTop: `3px solid ${T.ember}` }} />
        <div style={{ position: "absolute", right: -1, bottom: -1, width: 20, height: 20, borderRight: `3px solid ${T.ember}`, borderBottom: `3px solid ${T.ember}` }} />
      </div>
    </div>
  );
}
