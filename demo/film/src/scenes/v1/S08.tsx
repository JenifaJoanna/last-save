// S08 Live match (8.0 s, no VO). Opens on S07's last pose: LS-0001 in space with Ember Rift's key art on its screen and
// S07's two key lines, which step out first. The camera swings square to the glass while the key art grows past the
// bezel, then pushes through the arena's burning core into the game: the `match` take full-frame (the client is its
// own page), cropped tight on the player (≥1.35x), with a punch-in and a decaying shake on every hit (MATCH_HITS),
// and the take's "Official server" chip lifted as a 56 px line for its first 1.8 s. Ends on the match, still playing.
import { AbsoluteFill, Easing, Img, staticFile, useCurrentFrame } from "remotion";
import { CrtLayers } from "../../ds/crt";
import { CONTENT } from "../../ds/screen";
import { FPS, stepped, T } from "../../ds/tokens";
import { Label } from "../../ds/type";
import { Slot } from "../../film/Slot";
import { scene } from "../../film/timeline";
import { DeviceShot } from "./g3/Device";
import { ARENA, MATCH_CROP, MATCH_CUT, MATCH_FROM, MATCH_HITS, playerAt, PUNCH, SERVER_LINE } from "./g3/match";
import { easeInOut, easeOut, lerp, prog } from "./g3/motion";
import { S07Lines } from "./S07";

const CUT = MATCH_CUT; // match crossfade f32-42 (10 f)
const BLEED = { x: -40, y: -40, w: 2000, h: 1160 }; // the key art's full-frame rect, a little past the frame edges
const ART = { w: 1456, h: 816, core: { x: 1000, y: 322 } }; // key art px; core = the arena's burning centre

/** Camera on the take at scene frame f: crop scale (with settle + punch), centre (clamped inside the take), shake. */
function matchCam(f: number) {
  const t = MATCH_FROM + (f - CUT) / FPS;
  const p = playerAt(Math.max(MATCH_FROM, t));
  const settle = lerp(1.1, 1, prog(f, CUT, CUT + 24, easeOut));
  let punch = 0;
  let sx = 0;
  let sy = 0;
  for (const h of MATCH_HITS) {
    const d = f - (CUT + (h - MATCH_FROM) * FPS);
    if (d < 0 || d > PUNCH.up + PUNCH.down) continue;
    punch = Math.max(punch, d <= PUNCH.up ? d / PUNCH.up : 1 - easeOut((d - PUNCH.up) / PUNCH.down));
    if (d < PUNCH.shakeFrames) {
      const a = PUNCH.shake * (1 - d / PUNCH.shakeFrames);
      sx = (Math.floor(d) % 2 === 0 ? 1 : -1) * a;
      sy = (Math.floor(d) % 3 === 0 ? -1 : 1) * a * 0.7;
    }
  }
  const base = MATCH_CROP * settle;
  const s = base * (1 + PUNCH.amount * punch);
  const m = 8 / base; // keep the take's edge out of frame through the shake
  const cx = Math.min(1920 - 960 / base - m, Math.max(960 / base + m, p.x));
  const cy = Math.min(1080 - 540 / base - m, Math.max(540 / base + m, p.y));
  return { s, cx, cy, sx, sy };
}

function KeyArtPlane({ g, z, target }: { g: number; z: number; target: { x: number; y: number } }) {
  const r = { x: lerp(CONTENT.x, BLEED.x, g), y: lerp(CONTENT.y, BLEED.y, g), w: lerp(CONTENT.w, BLEED.w, g), h: lerp(CONTENT.h, BLEED.h, g) };
  const k = Math.max(r.w / ART.w, r.h / ART.h);
  const core = { x: r.x + (r.w - ART.w * k) / 2 + ART.core.x * k, y: r.y + (r.h - ART.h * k) * 0.4 + ART.core.y * k };
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: `${core.x}px ${core.y}px`, transform: `translate(${(target.x - core.x) * z}px, ${(target.y - core.y) * z}px) scale(${lerp(1, 3.4, z)})` }}>
      <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden", borderRadius: lerp(2, 0, g), boxShadow: `0 0 ${60 * g}px rgba(255,107,43,${0.25 * g * (1 - g)})` }}>
        <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%", filter: `blur(${4 * z * z}px) brightness(${1 + 0.5 * z})` }} />
        {g < 1 && <AbsoluteFill style={{ opacity: 1 - g }}><CrtLayers /></AbsoluteFill>}
      </div>
    </div>
  );
}

function ServerLine({ f }: { f: number }) {
  const p = stepped(prog(f, SERVER_LINE.at, SERVER_LINE.at + 12), 5) * (1 - stepped(prog(f, SERVER_LINE.out, SERVER_LINE.out + 6), 3));
  if (p <= 0) return null;
  const blink = Math.floor(f / 36) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: SERVER_LINE.x, top: SERVER_LINE.y, display: "flex", alignItems: "center", gap: 22, padding: "16px 26px", opacity: p, transform: `translateX(${(1 - p) * -14}px)`,
      background: "rgba(10,8,20,0.86)", borderLeft: `6px solid ${T.alive}`, boxShadow: "0 20px 44px rgba(0,0,0,0.6)" }}>
      <span style={{ width: 24, height: 24, borderRadius: 12, background: T.alive, opacity: blink ? 1 : 0.45, boxShadow: `0 0 16px ${T.alive}` }} />
      <Label size={SERVER_LINE.size} color={T.text} track={0.08}>{SERVER_LINE.text}</Label>
    </div>
  );
}

export function S08() {
  const f = useCurrentFrame();
  const s = scene("S08");
  const prev = scene("S07").frames;
  const p = 1 - prog(f, 0, 24, easeInOut); // device pose: frame B (1) → square to the glass (0)
  const g = prog(f, 2, 24, easeInOut); // key art grows from the screen rect past the bezel
  const z = prog(f, 14, 42, Easing.in(Easing.quad)); // push through the core
  const chrome = 1 - prog(f, 6, 20);
  const matchIn = prog(f, CUT, CUT + 10);
  const flare = prog(f, 26, 38) * (1 - prog(f, 38, 52));
  const cam = matchCam(Math.max(f, CUT));
  const arena = { x: 960 + (ARENA.x - cam.cx) * cam.s, y: 540 + (ARENA.y - cam.cy) * cam.s };
  return (
    <AbsoluteFill style={{ background: T.void }}>
      {matchIn < 1 && <DeviceShot p={p} at={s.from} title="Live match" chrome={chrome} over={<KeyArtPlane g={g} z={z} target={arena} />} />}
      {matchIn > 0 && (
        <AbsoluteFill style={{ opacity: matchIn, overflow: "hidden" }}>
          <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${960 - cam.cx * cam.s + cam.sx}px, ${540 - cam.cy * cam.s + cam.sy}px) scale(${cam.s})` }}>
            <Slot slot="match" plate="match.png" from={MATCH_FROM - CUT / FPS} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}
      {flare > 0 && (
        <AbsoluteFill style={{ pointerEvents: "none", opacity: flare, mixBlendMode: "screen",
          background: `radial-gradient(40% 45% at ${arena.x / 19.2}% ${arena.y / 10.8}%, rgba(255,201,74,0.85), rgba(255,107,43,0.4) 45%, transparent 75%)` }} />
      )}
      {f < 8 && <S07Lines f={f + prev} out={prev + 2} />}
      <ServerLine f={f} />
    </AbsoluteFill>
  );
}
