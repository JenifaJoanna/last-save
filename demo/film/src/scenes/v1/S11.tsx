// S11 Choose (8.7 s, V10 at 0.3 s). Opens on S10's end pose (the decoded key centred on a gold ScreenFrame). The key
// splits into four rows that fly into four LS-0001 devices floating in space, each playing one holder's take: refunds
// (cyan) left, pledges (gold) right. "without paying gas" lifts the relayer toast off yuna's glass; "take their share
// back" racks focus to the refunds, "keep the game alive" to the pledges; "New players fund it too" brings the
// post-shutdown store take forward, then the keep-alive pool total prints and the camera pushes in (S12 enters the glass).
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../ds/screen";
import { Eyebrow, Mono } from "../../ds/type";
import { T } from "../../ds/tokens";
import { Slot } from "../../film/Slot";
import { Embers, Nebula } from "../../frames/b/Space";
import { HOLDERS, MiniDevice, PoolPanel, RelayerToast } from "./g5/choose-parts";
import { LAYOUT, POSTBUY_CROP, RELEASED_KEY, TAKE_FROM } from "./g5/facts";
import { c, inOut, out, ramp, word } from "./g5/kit";

const W = (s: number) => word("S11", s);
const GAS = W(2.26); // "gas"
const SHARE = W(3.18); // "take their share back"
const ALIVE = W(4.92); // "keep the game alive"
const NEW = W(6.42); // "New players fund it too"
const TOO = W(7.32);
const POOL_AT = TOO - 3; // the store take gives way to the empty status screen under the panel
const TOAST_AT = W(1.62) - 14; // toast lifts before "without paying gas", holds to "take their share back"
const PANEL_AT = NEW + 4; // pool panel prints (film type, screen space)
const FLY = 24; // key rows fly 24 f, 3 f stagger
const KEY_SIZE = 36;
const CH = KEY_SIZE * 0.6; // Plex Mono advance

/** Camera over the device field: x shift (px) and scale, keyed to the focus beats. */
function cam(f: number) {
  const x = interpolate(f, [0, SHARE - 4, SHARE + 18, ALIVE - 4, ALIVE + 18, NEW - 8, NEW + 14], [0, 0, 300, 300, -300, -300, 0], { ...c, easing: inOut });
  const s = interpolate(f, [0, 30, SHARE - 4, SHARE + 18, ALIVE + 18, NEW - 8, NEW + 14], [0.93, 0.96, 0.98, 1.07, 1.07, 1.07, 0.9], { ...c, easing: inOut });
  return { x, s };
}
/** Approximate on-screen centre of a device's glass (perspective 2400 about the frame centre, camera applied). */
function screenPos(i: number, f: number) {
  const h = HOLDERS[i];
  const { x, s } = cam(f);
  const k = 2400 / (2400 - h.z);
  return { x: 960 + (h.x - 960) * k * s + x, y: 540 + (h.y + 12 - 540) * k * s, k: k * s };
}

export function S11() {
  const f = useCurrentFrame();
  const { x: camX, s: camS } = cam(f);
  const frameOut = ramp(f, 2, 22);
  const lands = HOLDERS.map((_, i) => 3 + FLY + 3 * i);
  const refundFocus = ramp(f, SHARE - 4, SHARE + 14) - ramp(f, ALIVE - 4, ALIVE + 14);
  const pledgeFocus = ramp(f, ALIVE - 4, ALIVE + 14);
  const toastUp = ramp(f, TOAST_AT, TOAST_AT + 16);
  const toastDown = ramp(f, SHARE + 2, SHARE + 14, inOut);
  const toast = toastUp * (1 - toastDown);
  const giveWay = ramp(f, NEW - 8, NEW + 12, inOut);
  const shop = ramp(f, NEW - 6, NEW + 16);
  const push = interpolate(f, [POOL_AT, 261], [1, 1.07], { ...c, easing: out });

  // the toast lifts from the lower right of yuna's glass to the frame centre, turning to face the camera
  const from = screenPos(0, TOAST_AT);
  const tx = interpolate(toast, [0, 1], [from.x + 150 * from.k, LAYOUT.toast.x]);
  const ty = interpolate(toast, [0, 1], [from.y + 120 * from.k, LAYOUT.toast.y]);
  const ts = interpolate(toast, [0, 1], [0.28, 1.0]);
  const panelUp = ramp(f, PANEL_AT - 4, PANEL_AT + 6);
  const rise = ramp(f, W(6.98) - 2, TOO + 6, inOut);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <Nebula />
      <Embers count={16} seed={21} />
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 50%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: `translateX(${camX}px) scale(${camS})`, transformOrigin: "960px 540px", opacity: 1 - giveWay }}>
          {HOLDERS.map((h, i) => {
            const appear = ramp(f, 4 + 3 * i, 22 + 3 * i);
            const dim = Math.max(h.kind === "refund" ? pledgeFocus : refundFocus, toast);
            const spread = giveWay * (h.x < 960 ? -420 : 420);
            return (
              <div key={h.slot} style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translate3d(${spread}px, ${giveWay * (h.y < 540 ? -160 : 160)}px, ${-giveWay * 300}px)` }}>
                <MiniDevice h={h} f={f} land={lands[i]} appear={appear} dim={dim} float={Math.sin((f + i * 23) / 33) * 4} focus={h.kind === "refund" ? refundFocus : pledgeFocus} />
              </div>
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* S10's end pose: the decoded key centred on the released ScreenFrame; the frame falls away into space */}
      {frameOut < 1 && (
        <AbsoluteFill style={{ transform: `scale(${1 - 0.4 * frameOut})`, opacity: 1 - frameOut, filter: `blur(${(4 * frameOut).toFixed(2)}px)` }}>
          <ScreenFrame title="Licence status" mode="released">
            <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center" }}>
              <Eyebrow size={22}>Server key · decoded on-chain</Eyebrow>
            </div>
          </ScreenFrame>
        </AbsoluteFill>
      )}
      {HOLDERS.map((h, i) => {
        const seg = RELEASED_KEY.slice(i * 16, i * 16 + 16);
        const p = ramp(f, 3 + 3 * i, 3 + FLY + 3 * i);
        if (f > lands[i] + 8) return null;
        const sx = 960 - (64 * CH) / 2 + (i * 16 + 8) * CH;
        const end = screenPos(i, lands[i]);
        const fade = interpolate(f, [lands[i] - 2, lands[i] + 8], [1, 0], c);
        return (
          <div key={h.slot} style={{ position: "absolute", left: interpolate(p, [0, 1], [sx, end.x]), top: interpolate(p, [0, 1], [540, end.y]),
            transform: `translate(-50%, -50%) scale(${interpolate(p, [0, 1], [1, 1.25 * end.k])})`, opacity: fade }}>
            <Mono size={KEY_SIZE} weight={500} color={h.kind === "refund" ? (p > 0.5 ? T.cyan : T.gold) : T.gold}
              style={{ textShadow: "0 0 18px rgba(255,201,74,0.45)" }}>{seg}</Mono>
          </div>
        );
      })}

      {toast > 0.001 && (
        <div style={{ position: "absolute", left: tx, top: ty, transform: `translate(-50%, -50%) scale(${ts}) rotateZ(${(1 - toast) * -3}deg)`, opacity: Math.min(1, toast * 3) }}>
          <RelayerToast lift={toast} />
        </div>
      )}

      {/* "New players fund it too": the post-shutdown store take comes forward, then the pool total prints */}
      {shop > 0.001 && (
        <AbsoluteFill style={{ transform: `scale(${0.5 + 0.5 * shop})`, opacity: Math.min(1, shop * 2.2) }}>
          <Camera scale={push}>
            <ScreenFrame title={f >= POOL_AT ? "Licence status" : "Store"} mode="released" titleAt={f >= POOL_AT ? POOL_AT : NEW - 6}>
              {f < POOL_AT && (
                <AbsoluteFill style={{ opacity: 1 - 0.6 * panelUp, filter: panelUp > 0.01 ? `blur(${(3 * panelUp).toFixed(2)}px)` : undefined }}>
                  <Sequence from={NEW - 6} layout="none"><Slot slot="postbuy" from={TAKE_FROM.postbuy} crop={POSTBUY_CROP} /></Sequence>
                </AbsoluteFill>
              )}
            </ScreenFrame>
          </Camera>
        </AbsoluteFill>
      )}
      {f >= PANEL_AT && <AbsoluteFill style={{ transform: `scale(${push})` }}><PoolPanel f={f} at={PANEL_AT} rise={rise} /></AbsoluteFill>}
      <Embers count={8} seed={31} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.5) 100%)", opacity: 1 - shop }} />
    </AbsoluteFill>
  );
}
