// Style frame B, "The terminal in space": LS-0001 is a physical device floating in the void at a 3/4 angle, Ember Rift's
// arena far behind like a planet. Footage plays on its screen; objects lift OFF the screen toward the camera and carry into
// the next shot. Beat: BUY (~0:29). The BUY keycap presses (f28), the screen loads, and the licence lifts off the store's
// price panel as a physical card (f40-88) that settles facing camera (it becomes the pool bar in the next shot).
// As the card lifts, focus racks from the screen to the card. Hero pose ~f105, transition pose ~f43.
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Keycap, Terminal } from "../ds/crt";
import { EASE_OUT, stepped, T } from "../ds/tokens";
import { CARD_H, CARD_W, LicenceCard } from "./b/Licence";
import { Embers, Nebula } from "./b/Space";

const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(...EASE_OUT);
const smooth = Easing.inOut(Easing.sin);

// Device geometry (px, device-local). Terminal k=1.15; content area 1377.6 x 636 matches the store plate's crop exactly.
const K = 1.15;
const DW = 1400;
const DH = 737;
const PLATE = 1377.6 / 1876; // plate scale: crop x 22..1898, y 102..968 of the 1920x1080 screenshot
const toContent = (x: number, y: number) => ({ x: (x - 22) * PLATE, y: (y - 102) * PLATE });
const CONTENT_ORIGIN = { x: 11.2, y: 48 }; // bezel border + padding (+ screen border), plus the 36.8 px status bar
const PANEL = { ...toContent(1035, 278), w: 500 * PLATE, h: 317 * PLATE }; // the store's licence-price panel
const S0 = PANEL.w / CARD_W;

const DEVICE = { x: 700, y: 488, z: -460, ry: 16, rx: 5 }; // device centre in frame px and its 3/4 rotation

export function FrameB() {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, 120], [0, 150], { ...c, easing: smooth });
  const orbit = interpolate(f, [0, 120], [2.5, -2.5], { ...c, easing: smooth });
  const float = Math.sin(f / 34) * 4;
  const press = f < 28 ? 0 : f < 30 ? (f - 28) / 2 : f < 33 ? 1 : interpolate(f, [33, 36], [1, 0], c);
  const load = interpolate(f, [31, 42], [0, 1], c);
  const p = interpolate(f, [40, 96], [0, 1], { ...c, easing: out });
  const appear = stepped(interpolate(f, [40, 46], [0, 1], c), 5);
  const settle = interpolate(f, [86, 120], [0, 1], c);
  const titleSwap = f >= 36;

  // The card prints onto the panel top-to-bottom (stepped, opaque, so no double exposure), then, in device-local space, starting flat on the price panel (scaled to its footprint), lifts along the screen
  // normal toward the camera, slides right/down into open space, and turns to face the camera.
  const cx = PANEL.x + CONTENT_ORIGIN.x + (CARD_W * S0) / 2;
  const cy = PANEL.y + CONTENT_ORIGIN.y + (CARD_H * S0) / 2;
  const lift = 500 * p;
  const dx = 300 * p + Math.sin(f / 26) * 3 * settle;
  const dy = 150 * p + Math.sin(f / 21) * 5 * settle;
  const scale = S0 + (1 - S0) * p;
  const cardT = `translate3d(${cx - CARD_W / 2 + dx}px, ${cy - CARD_H / 2 + dy}px, ${lift}px) rotateY(${-DEVICE.ry * p + Math.sin(f / 30) * 0.8 * settle}deg) rotateX(${-DEVICE.rx * p + 2 * p}deg) rotateZ(${-1.5 * p}deg) scale(${scale})`;

  // Shadow and warm spill of the card on the screen (content coords), softer and further as it lifts.
  const sh = { x: PANEL.x + 46 * p, y: PANEL.y + 56 * p, blur: 6 + 46 * p, a: appear * 0.62 * (1 - 0.5 * p) };

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      <Nebula />
      <Embers count={18} seed={5} />
      <AbsoluteFill style={{ perspective: 2400, perspectiveOrigin: "50% 48%" }}>
        <AbsoluteFill style={{ transformStyle: "preserve-3d", transform: `translateZ(${push}px) rotateY(${orbit}deg)` }}>
          <div style={{ position: "absolute", left: DEVICE.x - DW / 2, top: DEVICE.y - DH / 2 + float, width: DW, height: DH + 70, transformStyle: "preserve-3d",
            transform: `translateZ(${DEVICE.z}px) rotateY(${DEVICE.ry}deg) rotateX(${DEVICE.rx}deg)` }}>
            <div style={{ filter: `blur(${(1.8 * p).toFixed(2)}px)` }}>
            <Terminal width={DW} height={DH} k={K} title={titleSwap ? "Licence #2" : "Store"} decodeP={titleSwap ? interpolate(f, [36, 50], [0, 1], c) : 1}
              style={{ boxShadow: `inset -3px -3px 0 rgba(255,138,76,0.32), inset 0 1px 0 rgba(255,255,255,0.07), 0 60px 120px -40px rgba(0,0,0,0.95), 0 0 160px rgba(155,79,224,0.14)` }}>
              <Img src={staticFile("plates/store.png")} style={{ position: "absolute", left: -22 * PLATE, top: -102 * PLATE, width: 1920 * PLATE, height: 1080 * PLATE, maxWidth: "none" }} />
              <div style={{ position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, background: T.ink, opacity: 0.55 * appear * p }} />
              <div style={{ position: "absolute", left: sh.x, top: sh.y, width: PANEL.w, height: PANEL.h, borderRadius: 8, background: `rgba(0,0,0,${sh.a})`, filter: `blur(${sh.blur}px)` }} />
              <div style={{ position: "absolute", left: sh.x - 60, top: sh.y - 40, width: PANEL.w + 120, height: PANEL.h + 80, borderRadius: "50%",
                background: `radial-gradient(closest-side, rgba(255,201,74,${0.16 * appear}), transparent)` }} />
              {load > 0 && load < 1 && <div style={{ position: "absolute", left: 0, top: 0, height: 3, width: `${stepped(load, 8) * 100}%`, background: T.gold, opacity: 1 - load * 0.6 }} />}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg, rgba(255,255,255,0.05) 0%, transparent 32%, transparent 70%, rgba(255,138,76,0.05) 100%)" }} />
            </Terminal>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: DH + 20, display: "flex", justifyContent: "center", gap: 14, filter: `blur(${(1.5 * p).toFixed(2)}px)` }}>
              {["Summary", "Back", "◂ Prev", "Next ▸"].map((l) => <Keycap key={l} k={1.05}>{l}</Keycap>)}
              <Keycap k={1.05} primary press={press} style={{ boxShadow: `0 ${4.2 - 3.15 * press}px 0 #8f3311, 0 ${5.25 - 3.15 * press}px 0 #05040a, 0 0 ${28 + 30 * press}px rgba(255,107,43,${0.35 + 0.3 * press})` }}>Buy · 0.25 Ⓝ</Keycap>
            </div>
            {appear > 0 && (
              <div style={{ position: "absolute", left: 0, top: 0, width: CARD_W, height: CARD_H, transformOrigin: "50% 50%", transformStyle: "preserve-3d", transform: cardT,
                clipPath: appear < 1 ? `inset(0 0 ${(1 - appear) * 100}% 0)` : undefined }}>
                <LicenceCard fill={stepped(interpolate(f, [62, 90], [0, 1], c), 4)} gloss={interpolate(f, [44, 110], [0, 1], c)} glow={p} />
              </div>
            )}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
      <Embers count={10} seed={11} />
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}
