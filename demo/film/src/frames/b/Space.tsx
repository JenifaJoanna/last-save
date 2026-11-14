// Direction B's world behind the terminal: the void, Ember Rift's arena pushed far back like a planet in a nebula,
// and drifting embers. Everything is frame-driven and deterministic; the far layers move slower than the camera.
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T } from "../../ds/tokens";

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function Nebula({ x = 1460, y = 790, width = 1700 }: { x?: number; y?: number; width?: number }) {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, 120], [0, 1]);
  const h = (width * 816) / 1456;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(55% 60% at 78% 80%, rgba(155,79,224,0.26), transparent 70%),
      radial-gradient(35% 40% at 70% 92%, rgba(232,64,126,0.18), transparent 70%), radial-gradient(30% 30% at 12% 18%, rgba(255,107,43,0.06), transparent 70%), ${T.void}` }}>
      <div style={{ position: "absolute", left: x - width / 2, top: y - h / 2, width, height: h,
        transform: `translate(${drift * -14}px, ${drift * -6}px) rotate(${-4 + drift * 1.2}deg) scale(${1 + drift * 0.02})`,
        WebkitMaskImage: "radial-gradient(48% 50% at 50% 52%, #000 30%, transparent 72%)", maskImage: "radial-gradient(48% 50% at 50% 52%, #000 30%, transparent 72%)" }}>
        <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(9px) brightness(0.62) saturate(1.15)", opacity: 0.78 }} />
      </div>
    </AbsoluteFill>
  );
}

/** Embers rising slowly across the frame. Near embers are bigger, brighter and faster (parallax). */
export function Embers({ count = 34, seed = 3 }: { count?: number; seed?: number }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const near = hash(i + seed * 17);
        const size = 1.5 + near * 4;
        const speed = 0.25 + near * 0.9;
        const x = hash(i * 3.1 + seed) * 1920 + Math.sin((f + i * 20) / 38) * (6 + near * 10);
        const y = ((hash(i * 7.7 + seed) * 1240 - f * speed) % 1240 + 1240) % 1240 - 80;
        const flick = 0.45 + 0.55 * Math.abs(Math.sin((f + i * 13) / (9 + near * 7)));
        const col = near > 0.6 ? T.gold : near > 0.3 ? T.ember2 : T.magenta;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size, background: col,
            opacity: (0.25 + near * 0.6) * flick, boxShadow: `0 0 ${size * 3}px ${col}`, filter: near < 0.25 ? "blur(1.2px)" : undefined }} />
        );
      })}
    </AbsoluteFill>
  );
}
