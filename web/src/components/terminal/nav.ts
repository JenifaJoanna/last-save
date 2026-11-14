// Terminal navigation: the screens in film order, their titles and menu numbers, and the primary-action registry.
import { createContext, useContext, useEffect } from "react";

export interface Screen { path: string; title: string; n?: number; sub?: string; app?: boolean }
/** Film order. PREV / NEXT walk this list; the home menu shows the numbered ones. */
export const SCREENS: Screen[] = [
  { path: "/", title: "Home" },
  { path: "/app/store", title: "Store", n: 1, sub: "Ember Rift · 0.25 Ⓝ licence", app: true },
  { path: "/app/library", title: "Library", n: 2, sub: "Your licence and progress", app: true },
  { path: "/app/play", title: "Play", sub: "Choose a server", app: true },
  { path: "/app/afterlife", title: "Licence status", n: 3, sub: "Proof of life · escrow · your choice", app: true },
  { path: "/app/hosts", title: "Community hosts", n: 4, sub: "Host the game, get paid per player", app: true },
  { path: "/how", title: "How it works", n: 5, sub: "The lifecycle in six steps" },
  { path: "/judges", title: "Judge guide", n: 6, sub: "Verify every claim in five minutes" },
  { path: "/attack", title: "Try to kill it" },
];
export const MENU = SCREENS.filter((s) => s.n);
const EXTRA: Record<string, string> = { "/signin": "Sign in", "/status": "Licence status", "/home": "Home", "/host-run": "Fan host" };

export function screenFor(path: string): Screen {
  const hit = SCREENS.find((s) => s.path === path) ?? SCREENS.find((s) => s.path !== "/" && path.startsWith(s.path));
  if (hit) return hit;
  return { path, title: EXTRA[path] ?? (path === "/" ? "Home" : "Not found") };
}
export function neighbours(path: string): { prev: Screen | null; next: Screen | null } {
  const i = SCREENS.findIndex((s) => s.path === path || (s.path !== "/" && path.startsWith(s.path)));
  if (i < 0) return { prev: SCREENS[0], next: SCREENS[1] };
  return { prev: i > 0 ? SCREENS[i - 1] : null, next: i < SCREENS.length - 1 ? SCREENS[i + 1] : null };
}

/** The screen's own primary action (the orange keycap, Enter) and its keyboard hints. */
export interface Primary { label: string; run: () => void; disabled?: boolean; busy?: boolean }
export interface PrimaryCtx { primary: Primary | null; setPrimary: (p: Primary | null) => void; hints: string[]; setHints: (h: string[]) => void }
export const PrimaryContext = createContext<PrimaryCtx>({ primary: null, setPrimary: () => {}, hints: [], setHints: () => {} });

/** Registers the screen's primary action for the keycap bar while the screen is mounted. */
export function usePrimary(p: Primary | null, deps: unknown[]): void {
  const { setPrimary } = useContext(PrimaryContext);
  useEffect(() => {
    setPrimary(p);
    return () => setPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
export function useHints(h: string[]): void {
  const { setHints } = useContext(PrimaryContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setHints(h); return () => setHints([]); }, [h.join("|")]);
}

/** True when a key event should be left to a text field. */
export const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable=true]");
