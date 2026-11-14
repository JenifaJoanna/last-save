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
import { CARD_H } from "./g2/Licence";
import { KeyChip } from "./g2/KeyChip";
import { abs, beat, CL, easeOut, lerp, prog } from "./g2/motion";
import { DevicePull, Embers, Nebula, Page } from "./g2/World";

// Take offsets (seconds into raw/store.mp4 and raw/library.mp4, dario's buy). store.mp4: BUY click ≈ 2.8 s, ~3.4 s
// pending, toast 6.3 s, "You own licence #2" 6.5 s. Part A plays 2.25 s → the click lands on f38 ("licence" f36); at f46
// (pressed, "Working…") it cuts to part B at 6.45 s: toast already rising, "You own licence #2" from f48, held through
// "NFT on NEAR" (f64–96) to f80. library.mp4 from 0.5 s (hover on licence #2).
// x-buy.mp4 (NEAR RPC EXPERIMENTAL_tx_status | jq): the JSON lands at 4.27 s (x-buy.cast), so the flash plays from 4.4 s.
export const STORE_FROM = 2.25;
export const STORE_B_FROM = 6.45;
export const XBUY_FROM = 4.4;
export const LIB_FROM = 0.5;

const STORE = DIALUP_FRAMES; // 22: store take in, 380 ms load bar
const BUY = 38;              // BUY click in the take
const STORE_CUT = 46;        // match cut across the pending state
const LIB = 80;              // library take
const XBUY = 100;            // x-buy flash, 28 f
const PRINT = 128;           // card prints on the library's licence panel
const PULL = 130;            // pull back to the device, 24 f
const LIFT = 132;            // card lift, 45 f
const W = { royalty: beat("S04", 3.84), forty: beat("S04", 6.12), locked: beat("S04", 7.78) };
const PANEL = { x: 448, y: 278, w: 1024, h: 278 }; // library licence panel, page px (plates/library.png)
const S0 = PANEL.h / CARD_H;
const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };
export const S04_LIB_FRAMES = { LIB, LIB_FROM, CONTENT_CROP };

function StandInToast({ f }: { f: number }) {
  const p = stepped(prog(f, STORE_CUT + 10, STORE_CUT + 16), 5); // fallback only: the real take has its own toast
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
  const dim = prog(f, PULL + 24, PULL + 64);
  const appear = stepped(prog(f, PRINT, PRINT + 6), 5);
  const lift = prog(f, LIFT, LIFT + 45, easeOut);
  const arc = Math.sin(Math.PI * lift);
  const sHeld = lerp(HELD.s0, HELD.s1, prog(f, LIFT + 45, 377));
  const held = heldPose(g, sHeld);
  const settle = prog(f, LIFT + 30, LIFT + 60);
  const pose = {
    x: lerp(PANEL.x + 310 * S0, held.x, lift), // card footprint: the left of the licence panel
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
          {f < STORE_CUT && <Sequence from={STORE} layout="none"><Slot slot="store" plate="store.png" from={STORE_FROM} /></Sequence>}
          {f >= STORE_CUT && f < LIB && <Sequence from={STORE_CUT} layout="none"><Slot slot="store" plate="store.png" from={STORE_B_FROM} /></Sequence>}
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
      <Flash f={f} at={XBUY} dur={28} dial={6} slot="x-buy" path={`rpc.testnet.near.org tx ${short(FACTS.buyTx)}`} from={XBUY_FROM} crop={{ x: 0.11, y: 0.33, w: 0.5, h: 0.5 }} />
      {/* Key line lifted from the x-buy result ("method": "buy_licence", "status": "SuccessValue"), held 46 f, then it rides
          to the top of frame above the lifting card and fades before the card settles. */}
      <KeyChip f={f} on={XBUY + 6} fly={XBUY + 26} from={{ x: 288, y: 890 }} to={{ x: 960, y: 176 }} label={`NEAR testnet · tx ${short(FACTS.buyTx)}`} accent={T.alive}>
        buy_licence <span style={{ color: T.alive }}>SuccessValue</span>
      </KeyChip>
      {pull > 0 && <Embers g={g + 400} count={10} seed={11} opacity={pull} />}
      {appear > 0 && (
        <CardInSpace pose={pose} clipBottom={1 - appear} fill={prog(f, W.forty - 3, W.forty + 9)} royalty={prog(f, W.royalty - 3, W.royalty + 9)}
          gloss={prog(f, LIFT, LIFT + 70)} glow={lift * (1 + 0.6 * interpolate(f, [W.locked - 2, W.locked + 4, W.locked + 24], [0, 1, 0], CL))} />
      )}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: pull, background: "radial-gradient(120% 100% at 50% 50%, transparent 62%, rgba(5,4,10,0.55) 100%)" }} />
    </AbsoluteFill>
  );
}
