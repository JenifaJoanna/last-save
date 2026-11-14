// S10 pieces: the x-release flash (OutLayer execution receipt, ~1 s, dial-up in, CRT collapse out at half speed) and
// the server key lifting off the escrow card, decoding from random hex at 18 ms per char into the centred end pose.
import { useCurrentFrame } from "remotion";
import { slotSource } from "../../../film/Slot";
import { Display, Eyebrow, Label, Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { KEY_POSE, RELEASED_KEY, R, TAKE_KEY, XREL } from "./facts";
import { CrtWindow, DialBox, lin, noise, out, printIn, SlotAt } from "./kit";

export const S10T = {
  dial: R.confirms - 24, //  dial-up box for the receipt
  flash: R.confirms - 2, //  receipt window open on "confirms" (1 s)
  flashOut: R.confirms + 28, // CRT collapse at half speed (20 f)
  lift: R.releases - 3, //   key lifts and decodes; RELEASED prints
  decode: R.releases + 1,
  settle: 146, //            RELEASED and the take print out, leaving S11's first pose (key + eyebrow)
};

/** OutLayer receipt stand-in (only while x-release is missing): the Result block of the on_execution_response receipt. */
function ReceiptStandIn() {
  const row = (k: string, v: string, c: string) => (
    <Mono size={24} color={T.muted} style={{ lineHeight: "36px" }}>{"  "}<span style={{ color: T.cyan }}>"{k}"</span>: <span style={{ color: c }}>{v}</span>,</Mono>
  );
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink2, padding: "18px 30px", boxSizing: "border-box" }}>
      <Label size={18} color={T.faint}>Result · on_execution_response · OutLayer</Label>
      <div style={{ marginTop: 10 }}>
        {row("key", `"${RELEASED_KEY.slice(0, 40)}…"`, T.ember2)}
        {row("mode", '"release"', T.ember2)}
        {row("ok", "true", T.alive)}
        {row("status", '"Dead"', T.ember2)}
      </div>
      <Label size={14} color={T.faint} style={{ position: "absolute", right: 14, bottom: 10, background: "rgba(10,8,20,0.7)", padding: "3px 8px", borderRadius: 3 }}>placeholder · x-release</Label>
    </div>
  );
}

export function ReceiptFlash() {
  const W = { w: 1500, h: 297 };
  return (
    <>
      <DialBox at={S10T.dial} path="outlayer receipt" s={1.9} />
      <CrtWindow open={S10T.flash} close={S10T.flashOut} dur={20} x={(1920 - W.w) / 2} y={540 - W.h / 2 - 20} w={W.w} h={W.h} tilt={6}
        style={{ border: `1px solid ${T.line2}`, boxShadow: "0 40px 120px rgba(0,0,0,0.75)" }}>
        {slotSource("x-release").kind === "none" ? <ReceiptStandIn /> : <SlotAt at={S10T.flash} slot="x-release" from={XREL.from} crop={XREL.crop} />}
      </CrtWindow>
    </>
  );
}

const HEX = "0123456789abcdef";
/** Release decode: chars resolve left to right at 18 ms each; unresolved chars are hex noise that changes every 2 f. */
function decodeHex(text: string, at: number, f: number) {
  const n = Math.floor(Math.max(0, ((f - at) / 30) * 1000) / 18);
  return Array.from(text, (c, i) => (c === " " || i < n ? c : HEX[Math.floor(noise(i * 17 + Math.floor(f / 2) * 3) * 16)])).join("");
}

/** The key's lift from the escrow card (content px of the take's key) to the centred end pose, with RELEASED above. */
export function KeyLift() {
  const f = useCurrentFrame();
  if (f < S10T.lift) return null;
  const line = RELEASED_KEY;
  const p = lin(f, S10T.lift, S10T.lift + 16, 0, 1, out);
  const from = { x: TAKE_KEY.x, y: TAKE_KEY.y, s: TAKE_KEY.size / KEY_POSE.size }; // the take's key (escrow card)
  const to = { x: KEY_POSE.cx - 21, y: KEY_POSE.cy - 102 };
  const x = from.x + (to.x - from.x) * p, y = from.y + (to.y - from.y) * p, sc = from.s + (1 - from.s) * p;
  const tp = printIn(f, S10T.lift + 2) * (1 - printIn(f, S10T.settle));
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 118, display: "flex", justifyContent: "center", opacity: tp, transform: `translateY(${(1 - tp) * -10}px)` }}>
        <Display size={150} tone="gold">Released</Display>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: KEY_POSE.eyebrowTop, display: "flex", justifyContent: "center", opacity: printIn(f, S10T.decode + 4) }}>
        <Eyebrow size={22} color={T.cyan}>Server key · decoded on-chain</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${sc})`, transformOrigin: "50% 50%" }}>
        <Mono size={KEY_POSE.size} weight={500} color={KEY_POSE.color} style={{ textShadow: "0 0 18px rgba(255,201,74,0.45)" }}>{decodeHex(line, S10T.decode, f)}</Mono>
      </div>
    </>
  );
}
