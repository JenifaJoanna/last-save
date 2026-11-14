// Terminal typography for the film, mirroring web/src/styles.css: sunset-banded Archivo display, Chakra Petch labels,
// IBM Plex Mono body, the "// " eyebrow, the stripes rule and the decode effect (deterministic per frame for rendering).
import type { CSSProperties, ReactNode } from "react";
import { FONT, T } from "./tokens";

export type Tone = "sunset" | "dead" | "gold" | "cream";

/** Band stops as in .display-sunset: cream top, then gold / ember / magenta / violet bands with thin gaps. */
function bands(tone: Tone): string {
  if (tone === "cream") return T.text;
  if (tone === "dead") return `linear-gradient(180deg, #ff6a76 0 47%, ${T.dead} 47% 59%, transparent 59% 62%, #e0384a 62% 72%, transparent 72% 75%, #b8263a 75% 85%, transparent 85% 88%, #7d1626 88% 100%)`;
  if (tone === "gold") return `linear-gradient(180deg, #fff1c4 0 47%, ${T.gold} 47% 59%, transparent 59% 62%, #ffb02e 62% 72%, transparent 72% 75%, #ff8a4c 75% 85%, transparent 85% 88%, ${T.ember} 88% 100%)`;
  return `linear-gradient(180deg, ${T.text} 0 47%, ${T.gold} 47% 59%, transparent 59% 62%, ${T.ember} 62% 72%, transparent 72% 75%, ${T.magenta} 75% 85%, transparent 85% 88%, ${T.violet} 88% 100%)`;
}

/** Big display type. `size` in px; line height 0.92 like the app. Fine print lines run across the letters (CRT texture). */
export function Display({ children, size, tone = "sunset", glow = true, style }: { children: ReactNode; size: number; tone?: Tone; glow?: boolean; style?: CSSProperties }) {
  const lh = Math.round(size * 0.92);
  const fill = tone === "cream" ? { color: T.text } : {
    color: "transparent", WebkitBackgroundClip: "text", backgroundClip: "text",
    backgroundImage: `repeating-linear-gradient(180deg, rgba(10,8,20,0.22) 0 1px, transparent 1px 4px), ${bands(tone)}`,
    backgroundSize: `100% ${lh}px`, backgroundRepeat: "repeat-y",
  };
  const shadow = tone === "dead" ? "rgba(255,77,94,0.35)" : tone === "gold" ? "rgba(255,201,74,0.3)" : "rgba(255,107,43,0.22)";
  return (
    <div style={{ fontFamily: FONT.display, fontStretch: "125%", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.005em",
      fontSize: size, lineHeight: `${lh}px`, whiteSpace: "pre", ...fill, filter: glow ? `drop-shadow(0 0 ${Math.round(size / 6)}px ${shadow})` : undefined, ...style }}>
      {children}
    </div>
  );
}

/** The four-colour stripes rule under page titles (.stripes). */
export function Stripes({ width, height = 26, style }: { width: number; height?: number; style?: CSSProperties }) {
  return <div style={{ width, height, background: `linear-gradient(180deg, ${T.gold} 0 16%, transparent 16% 28%, ${T.ember} 28% 44%, transparent 44% 56%, ${T.magenta} 56% 72%, transparent 72% 84%, ${T.violet} 84% 100%)`, ...style }} />;
}

export function Label({ children, size = 18, color = T.text, track = 0.16, weight = 600, style }: { children: ReactNode; size?: number; color?: string; track?: number; weight?: number; style?: CSSProperties }) {
  return <div style={{ fontFamily: FONT.label, fontWeight: weight, textTransform: "uppercase", letterSpacing: `${track}em`, fontSize: size, color, whiteSpace: "nowrap", ...style }}>{children}</div>;
}

export function Eyebrow({ children, size = 18, color = T.cyan, style }: { children: ReactNode; size?: number; color?: string; style?: CSSProperties }) {
  return <Label size={size} color={color} track={0.18} style={style}>{"// "}{children}</Label>;
}

export function Mono({ children, size = 22, color = T.text, weight = 400, style }: { children: ReactNode; size?: number; color?: string; weight?: number; style?: CSSProperties }) {
  return <div style={{ fontFamily: FONT.mono, fontWeight: weight, fontSize: size, color, lineHeight: 1.6, fontVariantNumeric: "tabular-nums", whiteSpace: "pre", ...style }}>{children}</div>;
}

const GLYPHS = "ABCDEF0123456789#%&*+=<>/\\";
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
/** useDecode as a pure function: the first `p * len` chars are resolved, the rest are glyph noise that changes every 2 frames. */
export function decode(text: string, p: number, frame: number): string {
  const n = Math.floor(Math.min(1, Math.max(0, p)) * text.length);
  return text.slice(0, n) + Array.from(text.slice(n), (c, i) => (c === " " ? " " : GLYPHS[Math.floor(hash(i * 31 + Math.floor(frame / 2)) * GLYPHS.length)])).join("");
}

/** Typed prefix of `text` at progress p, with the gold block caret while typing (or when `caret` is forced). */
export function typed(text: string, p: number): string {
  return text.slice(0, Math.floor(Math.min(1, Math.max(0, p)) * text.length));
}
export function Caret({ on = true, color = T.gold, size }: { on?: boolean; color?: string; size?: number }) {
  return <span style={{ color, opacity: on ? 1 : 0, marginLeft: 2, fontSize: size }}>█</span>;
}
