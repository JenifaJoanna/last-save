// S04 Buy (12.6 s, V04 at 0.8 s). Dial-up over S03's cleared screen → `store` take (camera 1.3× on price, split bar, BUY
// and the toast corner) → `library` take → 1-s `x-buy` flash → the camera pulls back to the device at 3/4 while the
// licence card prints on the library's licence panel and lifts toward the camera. "royalty" prints the NEP-199 line,
// "forty percent" lights the 4 gold segments. End pose: card centred, device dimmed (S05 starts from it).
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Camera } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { decode, Label, Mono } from "../../ds/type";
import { Slot, slotSource } from "../../film/Slot";
import { DialupBox, DIALUP_FRAMES } from "./g2/Dialup";
import { scene } from "../../film/timeline";
import { S03 } from "./S03";
import { short, FACTS } from "./g2/facts";
import { Flash } from "./g2/Flash";
import { CardInSpace, HELD, heldPose } from "./g2/heldCard";
import { abs, beat, CL, easeOut, lerp, prog } from "./g2/motion";
import { DevicePull, Embers, Nebula, Page } from "./g2/World";

// Take offsets (seconds into each take): set when the v2 takes land so BUY lands on f44 and the library holds still.
export const STORE_FROM = 0;
export const LIB_FROM = 0;

const STORE = DIALUP_FRAMES; // 22: store take in, 380 ms load bar
const BUY = 44;              // BUY keycap + toast (test signer signs instantly)
const LIB = 74;              // library take
const XBUY = 96;             // x-buy flash, 28 f
const PRINT = 124;           // card prints on the library's licence panel
const PULL = 126;            // pull back to the device, 24 f
const LIFT = 128;            // card lift, 45 f
const W = { royalty: beat("S04", 3.84), forty: beat("S04", 6.12), locked: beat("S04", 7.78) };
const PANEL = { x: 448, y: 278, w: 1024, h: 278 }; // library licence panel, page px (plates/library.png)
const S0 = PANEL.h / 384;
const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };
export const S04_LIB_FRAMES = { LIB, LIB_FROM, CONTENT_CROP };

function StandInToast({ f }: { f: number }) {
  const p = stepped(prog(f, BUY + 2, BUY + 8), 5);
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 1524, top: 944, width: 380, padding: 16, boxSizing: "border-box", display: "flex", gap: 12, borderRadius: 16, background: "rgba(31,25,56,0.92)",
      border: `1px solid ${T.line2}`, boxShadow: "0 20px 50px rgba(0,0,0,0.6)", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={T.alive} strokeWidth={2.2}><circle cx="12" cy="12" r="9.5" /><path d="M8 12.5l2.8 2.8L16.2 9.6" /></svg>
      <div>
        <Mono size={15} weight={600} style={{ lineHeight: 1.4 }}>Licence bought</Mono>
        <Mono size={15} color={T.muted} style={{ lineHeight: 1.4 }}>Confirmed on NEAR testnet.</Mono>
        <Mono size={15} color={T.ember} style={{ lineHeight: 1.4, marginTop: 6 }}>View on explorer ↗</Mono>
      </div>
    </div>
  );
}

export function S04() {
  const f = useCurrentFrame();
  const g = abs("S04", f);
  // Camera inside the page: 1× through the dial-up, 1.3× on the store's price / BUY / toast corner, 1.22× on the
  // library's licence panel, back to 1× behind the x-buy flash so the pull starts from the page at rest.
  const inStore = prog(f, STORE, STORE + 20, easeOut);
  const libBack = prog(f, XBUY + 4, PRINT - 2, easeOut);
  const cam = f < LIB
    ? { s: lerp(1, 1.3, inStore) + 0.02 * prog(f, 0, LIB), fx: 1182, fy: 700, k: inStore }
    : { s: lerp(1.22 + 0.02 * prog(f, LIB, XBUY), 1, libBack), fx: 960, fy: 520, k: 1 - libBack };
  const pull = prog(f, PULL, PULL + 24, easeOut);
  const dim = prog(f, 150, 190);
  const appear = stepped(prog(f, PRINT, PRINT + 6), 5);
  const lift = prog(f, LIFT, LIFT + 45, easeOut);
  const arc = Math.sin(Math.PI * lift);
  const sHeld = lerp(HELD.s0, HELD.s1, prog(f, LIFT + 45, 377));
  const held = heldPose(g, sHeld);
  const settle = prog(f, LIFT + 30, LIFT + 60);
  const pose = {
    x: lerp(PANEL.x + 310 * S0, held.x, lift),
    y: lerp(PANEL.y + PANEL.h / 2, held.y, lift),
    s: lerp(S0, sHeld, lift), z: 260 * arc, ry: 16 * pull * (1 - lift) - 8 * arc + held.ry * settle, rx: 5 * pull * (1 - lift) + 1.5 * lift,
  };
  const plateStore = slotSource("store", "store.png").kind !== "raw"; // stand-in toast until the real take (which has its own)
  const load = prog(f, STORE, STORE + 11);

  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {pull > 0 && <Nebula g={g} opacity={pull} />}
      {pull > 0 && <Embers g={g} count={18} seed={5} opacity={pull} />}
      {f < STORE && (
        // Seam: S03's exact last frame (ScreenFrame, WHY STUDIOS OPT IN, card 3 with "refund" in gold); the dial-up box types over it.
        <AbsoluteFill>
          <Freeze frame={scene("S03").frames - 1}><S03 /></Freeze>
          {f >= 1 && <div style={{ position: "absolute", left: 21, top: 102, width: 1878, height: 868, display: "grid", placeItems: "center" }}>
            <div style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.7)", background: T.ink }}><DialupBox path="/app/store" t={f + 1} k={1.7} /></div>
          </div>}
        </AbsoluteFill>
      )}
      {f >= STORE && <DevicePull p={pull} dim={dim} g={g}>
        <Camera scale={cam.s} fx={cam.fx} fy={cam.fy} x={(960 - cam.fx) * cam.k} y={(540 - cam.fy) * cam.k}>
          {/* Takes are full-page captures with the app's own chrome: they play full frame until the card prints, then the
              library take is cropped into the device's content rect (identical at p = 0) so the device can pull away. */}
          {f < LIB && <Sequence from={STORE} layout="none"><Slot slot="store" plate="store.png" from={STORE_FROM} /></Sequence>}
          {f >= LIB && f < PRINT && <Sequence from={LIB} layout="none"><Slot slot="library" plate="library.png" from={LIB_FROM} /></Sequence>}
          {f < LIB && plateStore && <StandInToast f={f} />}
          {f < STORE + 12 && ( // the status title decodes WHY STUDIOS OPT IN → STORE as the take arrives (25 ms/char)
            <div style={{ position: "absolute", left: 660, top: 70, width: 600, height: 32, background: T.ember, display: "grid", placeItems: "center" }}>
              <Label size={12} color={T.statusInk}>{decode("STORE", prog(f, STORE, STORE + 8), f)}</Label>
            </div>
          )}
          {load < 1 && <div style={{ position: "absolute", left: 21, top: 102, height: 3, width: 1878 * stepped(load, 8), background: T.gold, opacity: 1 - load * 0.6 }} />}
          {f >= PRINT && (
            <Page title="Library" titleAt={-999} header={1 - pull}>
              <Sequence from={LIB} layout="none"><Slot slot="library" plate="library.png" from={LIB_FROM} crop={CONTENT_CROP} tag={pull < 0.5} /></Sequence>
              <div style={{ position: "absolute", left: PANEL.x - 21, top: PANEL.y - 102, width: PANEL.w, height: PANEL.h, background: T.ink, opacity: 0.6 * appear * lift }} />
              <div style={{ position: "absolute", left: PANEL.x - 81, top: PANEL.y - 142, width: PANEL.w + 120, height: PANEL.h + 80, borderRadius: "50%",
                background: `radial-gradient(closest-side, rgba(255,201,74,${0.18 * appear * (1 - dim)}), transparent)` }} />
            </Page>
          )}
        </Camera>
      </DevicePull>}
      <Flash f={f} at={XBUY} dur={28} slot="x-buy" path={`near.rocks/tx/${short(FACTS.buyTx)}`} crop={{ x: 0.19, y: 0.04, w: 0.62, h: 0.62 }} />
      {pull > 0 && <Embers g={g + 400} count={10} seed={11} opacity={pull} />}
      {appear > 0 && (
        <CardInSpace pose={pose} clipBottom={1 - appear} fill={prog(f, W.forty - 3, W.forty + 9)} royalty={prog(f, W.royalty - 3, W.royalty + 9)}
          gloss={prog(f, LIFT, LIFT + 70)} glow={lift * (1 + 0.6 * interpolate(f, [W.locked - 2, W.locked + 4, W.locked + 24], [0, 1, 0], CL))} />
      )}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: pull, background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}
