// S11 Choose (8.7 s, V10 at 0.3 s). Opens on S10's end pose (the decoded key centred on a gold ScreenFrame). The key
// splits into two rows that fly into two LS-0001 devices floating in space, each playing a real pledge take (mira #3,
// kofi #4). Three key lines lift off the glass as film type, one at a time, each held ≥ 45 f while the devices go to
// texture: mira's relayer toast through "without paying gas", the money card's Refunded row on "take their share back"
// (the refund takes were not recorded; the panel carries the refunds), kofi's "You pledged to the hosts" on "keep the
// game alive". "New players fund it too" brings the post-shutdown store take forward (texture) under the pool panel and
// the store's 90/10 legend; the camera pushes in (S12 enters the glass).
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";
import { Camera, ScreenFrame } from "../../ds/screen";
import { Eyebrow, Mono } from "../../ds/type";
import { T } from "../../ds/tokens";
import { Slot } from "../../film/Slot";
import { InstanceChip, JUDGE_CHIP } from "../../film/Instance";
import { Embers, Nebula } from "../../frames/b/Space";
import { DH, DW, GLASS, HOLDERS, MiniDevice, PledgedLine, PoolPanel, RefundedLine, RelayerToast } from "./g5/choose-parts";
import { CHOOSE_POINTS, DEMO_SIGNER, LAYOUT, PLEDGES_DEMO_SIGNED, POSTBUY, POSTBUY_TAKE, RELEASED_KEY, V2DEV_CHIP } from "./g5/facts";
import { c, inOut, out, ramp, Tag, word } from "./g5/kit";

const W = (s: number) => word("S11", s);
const NEW = W(6.42); // "New players fund it too"
const TOO = W(7.32);
const POOL_AT = TOO - 3; // the store take gives way to the empty status screen under the panel
const PANEL_AT = 203; // pool panel prints (film type, screen space); its 56 px line first
const FLY = 24; // key rows fly 24 f, 3 f stagger
const KEY_SIZE = 36;
const CH = KEY_SIZE * 0.6; // Plex Mono advance
/** Key-line windows: rise 10 f, hold ≥ 45 f, sink 7 f. Toast lifts as pledge.mp4's toast appears (take 10.9 s at f32). */
const LIFTS = { toast: [32, 88], refunded: [88, 143], pledged: [143, 198] } as const;
const DOWN = 7;
const CAP_AT = 30; // demo-signer caption from the devices landing (frame px top below)
const CAP_Y = 900;

/** Camera over the device field: x shift (px) and scale, leaning toward the device each key line rises from. */
function cam(f: number) {
  const x = interpolate(f, [0, 86, 100, 141, 155, NEW - 8, NEW + 14], [0, 0, 110, 110, -110, -110, 0], { ...c, easing: inOut });
  const s = interpolate(f, [0, 30, NEW - 8, NEW + 14], [0.93, 0.96, 0.99, 0.9], { ...c, easing: inOut });
  return { x, s };
}
/** Approximate screen position of a point on a device's glass (fractions of the crop), perspective 2400 + camera. */
function glassPoint(i: number, f: number, px: number, py: number) {
  const h = HOLDERS[i];
  const { x, s } = cam(f);
  const k = (2400 / (2400 - h.z)) * s;
  const lx = h.x - DW / 2 + GLASS.x + px * GLASS.w, ly = h.y - DH / 2 + GLASS.y + py * GLASS.h;
  return { x: 960 + (lx - 960) * k + x, y: 540 + (ly - 540) * k, k };
}

function Lift({ f, win, from, scale0, children }: { f: number; win: readonly [number, number]; from: { x: number; y: number }; scale0: number; children: (l: number) => ReactNode }) {
  const up = ramp(f, win[0], win[0] + 10);
  const down = ramp(f, win[1], win[1] + DOWN, inOut);
  const l = up * (1 - down);
  if (l <= 0.001) return null;
  const x = interpolate(up, [0, 1], [from.x, LAYOUT.toast.x]);
  const y = interpolate(up, [0, 1], [from.y, LAYOUT.toast.y]) + down * 20;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${interpolate(up, [0, 1], [scale0, 1])})`, opacity: Math.min(1, up * 3) * Math.max(0, 1 - 2 * down) }}>
      {children(l)}
    </div>
  );
}

export function S11() {
  const f = useCurrentFrame();
  const { x: camX, s: camS } = cam(f);
  const frameOut = ramp(f, 2, 22);
  const lands = HOLDERS.map((_, i) => 3 + FLY + 3 * i);
  const keyUp = Object.values(LIFTS).reduce((m, w) => Math.max(m, ramp(f, w[0], w[0] + 10) * (1 - ramp(f, w[1], w[1] + DOWN))), 0);
  const giveWay = ramp(f, NEW - 8, NEW + 12, inOut);
  const shop = ramp(f, NEW - 6, NEW + 16);
  const push = interpolate(f, [POOL_AT, 261], [1, 1.07], { ...c, easing: out });
  const panelUp = ramp(f, PANEL_AT - 4, PANEL_AT + 6);
  const rise = ramp(f, W(6.98) - 2, TOO + 6, inOut);
  const half = Math.ceil(RELEASED_KEY.length / 2);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <Nebula />
      <Embers count={16} seed={21} />
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 50%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: `translateX(${camX}px) scale(${camS})`, transformOrigin: "960px 540px", opacity: 1 - giveWay }}>
          {HOLDERS.map((h, i) => (
            <div key={h.slot} style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `translate3d(${giveWay * (i ? 460 : -460)}px, 0, ${-giveWay * 300}px)` }}>
              <MiniDevice h={h} f={f} land={lands[i]} appear={ramp(f, 4 + 3 * i, 22 + 3 * i)} dim={keyUp} float={Math.sin((f + i * 23) / 33) * 4} />
            </div>
          ))}
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
        const seg = RELEASED_KEY.slice(i * half, i * half + half);
        const p = ramp(f, 3 + 3 * i, 3 + FLY + 3 * i);
        if (f > lands[i] + 8 || !seg) return null;
        const sx = 960 - (RELEASED_KEY.length * CH) / 2 + (i * half + seg.length / 2) * CH;
        const end = glassPoint(i, lands[i], 0.5, 0.5);
        const fade = interpolate(f, [lands[i] - 2, lands[i] + 8], [1, 0], c);
        return (
          <div key={h.slot} style={{ position: "absolute", left: interpolate(p, [0, 1], [sx, end.x]), top: interpolate(p, [0, 1], [540, end.y]),
            transform: `translate(-50%, -50%) scale(${interpolate(p, [0, 1], [1, 1.1 * end.k])})`, opacity: fade }}>
            <Mono size={KEY_SIZE} weight={500} color={T.gold} style={{ textShadow: "0 0 18px rgba(255,201,74,0.45)" }}>{seg}</Mono>
          </div>
        );
      })}

      <Lift f={f} win={LIFTS.toast} from={glassPoint(0, LIFTS.toast[0], CHOOSE_POINTS.toast.x, CHOOSE_POINTS.toast.y)} scale0={0.3}>{(l) => <RelayerToast lift={l} />}</Lift>
      <Lift f={f} win={LIFTS.refunded} from={glassPoint(0, LIFTS.refunded[0], CHOOSE_POINTS.refunded.x, CHOOSE_POINTS.refunded.y)} scale0={0.25}>{(l) => <RefundedLine lift={l} />}</Lift>
      <Lift f={f} win={LIFTS.pledged} from={glassPoint(1, LIFTS.pledged[0], CHOOSE_POINTS.title.x, CHOOSE_POINTS.title.y)} scale0={0.3}>{(l) => <PledgedLine lift={l} />}</Lift>

      {/* "New players fund it too": the post-shutdown store take comes forward as texture under the pool panel */}
      {shop > 0.001 && (
        <AbsoluteFill style={{ transform: `scale(${0.5 + 0.5 * shop})`, opacity: Math.min(1, shop * 2.2) }}>
          <Camera scale={push}>
            <ScreenFrame title={f >= POOL_AT ? "Licence status" : "Store"} mode="dead" titleAt={f >= POOL_AT ? POOL_AT : NEW - 6}>
              {f < POOL_AT && (
                <AbsoluteFill style={{ opacity: 1 - 0.6 * panelUp, filter: panelUp > 0.01 ? `blur(${(3 * panelUp).toFixed(2)}px)` : undefined }}>
                  <Sequence from={NEW - 6} layout="none"><Slot slot="postbuy" from={POSTBUY_TAKE.from} crop={POSTBUY_TAKE.crop} /></Sequence>
                </AbsoluteFill>
              )}
            </ScreenFrame>
          </Camera>
        </AbsoluteFill>
      )}
      {f >= PANEL_AT && <AbsoluteFill style={{ transform: `scale(${push})` }}><PoolPanel f={f} at={PANEL_AT} rise={rise} /></AbsoluteFill>}
      {/* back on the judge instance after S10's v2dev release: say so (hidden while a v2dev wallet buy shows its own chip) */}
      {f >= 24 && !(POSTBUY === "wallet-v2dev" && f >= NEW - 6) && <InstanceChip text={JUDGE_CHIP} />}
      {/* honest captions: demo-signed actions say so while they are on screen; a v2dev wallet buy carries its instance chip */}
      {(() => {
        const pledgeCap = PLEDGES_DEMO_SIGNED && f >= CAP_AT && f < NEW - 6;
        const buyDemo = POSTBUY === "demo-ember-rift" && f >= NEW - 6;
        const chip = POSTBUY === "wallet-v2dev" && f >= NEW - 6;
        const o = ramp(f, CAP_AT, CAP_AT + 6);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: CAP_Y, display: "flex", justifyContent: "center", opacity: o }}>
            {(pledgeCap || buyDemo) && <Mono size={30} color={T.muted} style={{ padding: "6px 18px", background: "rgba(10,8,20,0.72)" }}>{DEMO_SIGNER}</Mono>}
            {chip && <Tag color={T.cyan} size={28}>{V2DEV_CHIP}</Tag>}
          </div>
        );
      })()}
      <Embers count={8} seed={31} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.5) 100%)", opacity: 1 - shop }} />
    </AbsoluteFill>
  );
}
