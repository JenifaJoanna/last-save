// Film design tokens, taken 1:1 from the approved Last Save terminal (web/src/styles.css @theme, 14 Nov).
// Never invent colours or faces here: change the app first, then mirror it.
import { continueRender, delayRender, staticFile } from "remotion";

export const T = {
  void: "#0a0814", ink: "#120e22", ink2: "#19142e", panel: "#1f1938", panel2: "#2a2248",
  line: "rgba(196,182,255,0.13)", line2: "rgba(196,182,255,0.24)",
  text: "#efe5d0", muted: "#b0a7cc", faint: "#8f86ad",
  ember: "#ff6b2b", ember2: "#ff8a4c", gold: "#ffc94a", magenta: "#e8407e", violet: "#9b4fe0",
  cyan: "#4fd8d0", alive: "#45e394", amber: "#ffb02e", dead: "#ff4d5e",
  key: "#d9d0ea", keyInk: "#1b1530", bezel: "#1b1630", statusInk: "#160b05",
} as const;

export const FONT = { display: "Archivo", label: "Chakra Petch", mono: "IBM Plex Mono" } as const;

/** The app's ease-out, cubic-bezier(0.23, 1, 0.32, 1), as a function for interpolate(). */
export { Easing } from "remotion";
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);
/** Quantise a 0..1 progress into n steps (the terminal's stepped motion: steps(5) in 400 ms, steps(8) loads). */
export const stepped = (p: number, n: number) => Math.min(1, Math.max(0, Math.floor(p * n) / n));

const FACES: { family: string; file: string; weight: string; stretch?: string }[] = [
  { family: FONT.display, file: "Archivo-800_900.woff2", weight: "800 900", stretch: "125%" },
  { family: FONT.label, file: "ChakraPetch-500.woff2", weight: "500" },
  { family: FONT.label, file: "ChakraPetch-600.woff2", weight: "600" },
  { family: FONT.label, file: "ChakraPetch-700.woff2", weight: "700" },
  { family: FONT.mono, file: "IBMPlexMono-400.woff2", weight: "400" },
  { family: FONT.mono, file: "IBMPlexMono-500.woff2", weight: "500" },
  { family: FONT.mono, file: "IBMPlexMono-600.woff2", weight: "600" },
];

let loaded = false;
/** Loads the app's three faces from public/fonts (latin subsets fetched from Google Fonts, OFL). Call once at module scope. */
export function loadFilmFonts(): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("film fonts");
  Promise.all(FACES.map(async (f) => {
    const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, { weight: f.weight, stretch: f.stretch ?? "100%" });
    await face.load();
    document.fonts.add(face);
  })).then(() => continueRender(handle), () => continueRender(handle));
}
