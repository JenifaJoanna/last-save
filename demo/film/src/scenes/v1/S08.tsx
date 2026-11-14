// S08 Live match (8.0 s, no VO). Opens on S07's last pose: LS-0001 in space with Ember Rift's key art on its screen.
// The camera swings back square to the glass while the key art grows past the bezel (the bezel and keycaps fall away),
// then pushes through the arena's burning core into the game: the `match` take full-frame (the game client is its own
// page, not ScreenFrame) with a slow push and an LS-0001 status chip under the game's own server chip. Ends playing.
import { AbsoluteFill, Easing, Img, staticFile, useCurrentFrame } from "remotion";
import { CrtLayers } from "../../ds/crt";
import { CONTENT } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { Label } from "../../ds/type";
import { Slot } from "../../film/Slot";
import { scene } from "../../film/timeline";
import { DeviceShot } from "./g3/Device";
import { easeInOut, easeOut, lerp, prog } from "./g3/motion";

const MATCH_FROM = 4; // take seconds at the cut-in (TUNE: start where mira dashes through two rivals)
const BLEED = { x: -40, y: -40, w: 2000, h: 1160 }; // the key art's full-frame rect, a little past the frame edges
const ART = { w: 1456, h: 816, core: { x: 1000, y: 322 } }; // key art px; core = the arena's burning centre
const ARENA = { x: 960, y: 530 }; // the game arena's centre in the match take (preview client)
/** Our LS-0001 chip under the client's own top bar; drop it if the judge take's own server chip reads well. */
const SHOW_CHIP = true;

function KeyArtPlane({ g, z }: { g: number; z: number }) {
  const r = { x: lerp(CONTENT.x, BLEED.x, g), y: lerp(CONTENT.y, BLEED.y, g), w: lerp(CONTENT.w, BLEED.w, g), h: lerp(CONTENT.h, BLEED.h, g) };
  const k = Math.max(r.w / ART.w, r.h / ART.h);
  const core = { x: r.x + (r.w - ART.w * k) / 2 + ART.core.x * k, y: r.y + (r.h - ART.h * k) * 0.4 + ART.core.y * k };
  const e = prog(z, 0, 1);
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: `${core.x}px ${core.y}px`,
      transform: `translate(${(ARENA.x - core.x) * e}px, ${(ARENA.y - core.y) * e}px) scale(${lerp(1, 3.4, e)})` }}>
      <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden", borderRadius: lerp(2, 0, g),
        boxShadow: `0 0 ${60 * g}px rgba(255,107,43,${0.25 * g * (1 - g)})` }}>
        <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%", filter: `blur(${4 * e * e}px) brightness(${1 + 0.5 * e})` }} />
        {g < 1 && <AbsoluteFill style={{ opacity: 1 - g }}><CrtLayers /></AbsoluteFill>}
      </div>
    </div>
  );
}

function StatusChip({ f }: { f: number }) {
  const p = stepped(prog(f, 66, 78), 5);
  if (p <= 0) return null;
  const blink = Math.floor(f / 36) % 2 === 0;
  return (
    <div style={{ position: "absolute", right: 18, top: 64, display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", opacity: p, transform: `translateX(${(1 - p) * -14}px)`,
      background: "rgba(18,14,34,0.88)", border: `1px solid ${T.line2}`, borderLeft: `3px solid ${T.alive}`, borderRadius: 4 }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: T.alive, opacity: blink ? 1 : 0.4, boxShadow: `0 0 8px ${T.alive}` }} />
      <Label size={18} color={T.text}>Official server · <span style={{ color: T.alive }}>Online</span></Label>
    </div>
  );
}

export function S08() {
  const f = useCurrentFrame();
  const s = scene("S08");
  const p = 1 - prog(f, 0, 24, easeInOut); // device pose: frame B (1) → square to the glass (0)
  const g = prog(f, 2, 24, easeInOut); // key art grows from the screen rect past the bezel
  const z = prog(f, 14, 42, Easing.in(Easing.quad)); // push through the core
  const chrome = 1 - prog(f, 6, 20);
  const matchIn = prog(f, 32, 42);
  const flare = prog(f, 26, 38) * (1 - prog(f, 38, 52));
  const settle = prog(f, 32, 56, easeOut);
  const mScale = lerp(1.14, 1, settle);
  const drift = 1 + 0.02 * prog(f, 56, s.frames); // slow push pivoted high so the client's top bar stays whole
  return (
    <AbsoluteFill style={{ background: T.void }}>
      {matchIn < 1 && (
        <DeviceShot p={p} at={s.from} title="Live match" chrome={chrome} over={<KeyArtPlane g={g} z={z} />} />
      )}
      {matchIn > 0 && (
        <AbsoluteFill style={{ opacity: matchIn, transform: `scale(${drift})`, transformOrigin: "960px 200px" }}>
          <AbsoluteFill style={{ transform: `scale(${mScale})`, transformOrigin: `${ARENA.x}px ${ARENA.y}px` }}>
            <Slot slot="match" plate="match.png" from={MATCH_FROM - 32 / 30} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}
      {flare > 0 && (
        <AbsoluteFill style={{ pointerEvents: "none", opacity: flare, mixBlendMode: "screen",
          background: `radial-gradient(40% 45% at ${ARENA.x / 19.2}% ${ARENA.y / 10.8}%, rgba(255,201,74,0.85), rgba(255,107,43,0.4) 45%, transparent 75%)` }} />
      )}
      {SHOW_CHIP && <StatusChip f={f} />}
    </AbsoluteFill>
  );
}
