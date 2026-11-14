// The Last Save terminal: top strip, rounded bezel with a CRT screen (status bar, print-in, roll, grain, scanlines),
// keyboard navigation and the keycap bar. Every route renders inside it.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useInfo, useLockedKeys } from "../../lib/licence";
import { CONTRACT } from "../../lib/near";
import { blip, setSound, soundOn } from "../../lib/sound";
import { PREVIEW } from "../../preview/store";
import { Boot, Dialup } from "./effects";
import { KeycapBar, SoundToggle, StatusBar } from "./chrome";
import { neighbours, PrimaryContext, screenFor, typing, type Primary } from "./nav";

const PreviewStrip = lazy(() => import("../../preview/PreviewDock").then((m) => ({ default: m.PreviewStrip })));
export type Mode = "online" | "probing" | "dead" | "released" | "offline";

function useMode(): Mode {
  const d = useInfo(5000).data;
  if (!d) return "offline";
  if (d.releasedKey) return "released";
  if (d.status === "Dead") return "dead";
  if (d.probeInFlight || d.failures > 0) return "probing";
  return "online";
}
const LED: Record<Mode, string> = { online: "bg-alive", probing: "bg-amber", dead: "bg-dead", released: "bg-gold", offline: "bg-faint" };

/** In-app history depth: Back steps through screens this terminal opened, never out of the site. */
let depth = 0;

/** Prints the screen in: every [data-print] block steps in, 60 ms apart, including blocks that mount a moment later. */
function printIn(root: HTMLElement | null): void {
  if (!root) return;
  let i = 0;
  const mark = (el: HTMLElement) => {
    if (el.dataset.printed) return;
    el.dataset.printed = "1";
    el.style.animationDelay = `${Math.min(i++, 12) * 55}ms`;
    el.classList.add("step-in");
  };
  root.querySelectorAll<HTMLElement>("[data-print]").forEach((el) => { delete el.dataset.printed; el.classList.remove("step-in"); });
  void root.offsetWidth;
  root.querySelectorAll<HTMLElement>("[data-print]").forEach(mark);
  const obs = new MutationObserver(() => root.querySelectorAll<HTMLElement>("[data-print]:not([data-printed])").forEach(mark));
  obs.observe(root, { childList: true, subtree: true });
  window.setTimeout(() => obs.disconnect(), 900);
}

export function Terminal({ children }: { children: ReactNode }) {
  const [loc, navigate] = useLocation();
  const mode = useMode();
  const keys = useLockedKeys().data;
  const info = useInfo(8000).data;
  const screen = screenFor(loc);
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [dial, setDial] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const prevLoc = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => ({ primary, setPrimary, hints, setHints }), [primary, hints]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    if (prevLoc.current === loc) return;
    const firstLoad = prevLoc.current === null;
    prevLoc.current = loc;
    if (firstLoad) { window.setTimeout(() => printIn(scroller.current), 0); return; }
    depth++;
    setDial(loc);
  }, [loc]);
  const dialDone = useCallback(() => { setDial(null); window.setTimeout(() => printIn(scroller.current), 0); }, []);

  const go = useCallback((to: string | null | undefined) => { if (to && to !== loc) { blip("select"); navigate(to); } }, [loc, navigate]);
  const { prev, next } = neighbours(loc);
  const press = (k: string) => { setPressed(k); window.setTimeout(() => setPressed(null), 120); };
  const actions = useMemo(() => ({
    summary: () => { press("summary"); go("/"); },
    back: () => { press("back"); blip("key"); if (depth > 0) { depth -= 2; history.back(); } else go(loc === "/" ? null : "/"); },
    prev: () => { press("prev"); go(prev?.path); },
    next: () => { press("next"); go(next?.path); },
    primary: () => { if (primary && !primary.disabled && !primary.busy) { press("primary"); blip("go"); primary.run(); } },
  }), [go, prev, next, primary]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "Escape") actions.back();
      else if (k === "ArrowLeft") actions.prev();
      else if (k === "ArrowRight") actions.next();
      else if (k === "s" || k === "S") actions.summary();
      else if (k === "m" || k === "M") setSound(!soundOn());
      else if (k === "Enter" && !(e.target as HTMLElement)?.closest?.("button, a")) { e.preventDefault(); actions.primary(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  const bootLines = useMemo(() => [
    "LS-0001  LAST SAVE TERMINAL  v2.0",
    `Licence contract ......... ${CONTRACT}`,
    `Server key ............... ${info?.releasedKey ? "RELEASED" : "SEALED IN ENCLAVE"}`,
    `Access keys on contract .. ${keys ?? "…"}${keys === 0 ? " (LOCKED)" : ""}`,
    "Link NEAR testnet ........ CONNECTED",
    "Hello. The game outlives its studio.",
  ], [info?.releasedKey, keys]);

  return (
    <PrimaryContext.Provider value={ctx}>
      <div className="flex h-dvh flex-col gap-2 overflow-hidden bg-void p-2 sm:gap-3 sm:p-3">
        <header className="flex h-9 shrink-0 items-center justify-between gap-3 px-1">
          <a href="/" onClick={(e) => { e.preventDefault(); go("/"); }} className="flex min-w-0 items-center gap-2.5 no-underline">
            <span className={`size-2.5 shrink-0 rounded-full blink ${LED[mode]}`} aria-hidden />
            <span className="label hidden whitespace-nowrap text-[13px] text-text min-[480px]:inline">LS-0001</span>
            <span className="label hidden truncate text-[11px] text-faint sm:inline">Last Save · transmission terminal</span>
          </a>
          <div className="flex min-w-0 items-center gap-2">
            {PREVIEW && <Suspense fallback={null}><PreviewStrip /></Suspense>}
            <SoundToggle />
          </div>
        </header>
        <div className="min-h-0 flex-1 rounded-[20px] border border-black/60 bg-[#1b1630] p-[5px] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_18px_50px_-20px_rgb(0_0_0/0.9)] sm:p-2">
          <div className="crt-flicker relative flex h-full flex-col overflow-hidden rounded-[14px] border border-black/70 bg-ink">
            <StatusBar title={dial ? "Connecting_" : screen.title} mode={mode} />
            <div className="relative min-h-0 flex-1">
              <div ref={scroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-10 pt-5 sm:px-8 sm:pt-7" style={{ visibility: dial ? "hidden" : "visible" }}>
                {children}
              </div>
              <div key={`load-${loc}`} className="crt-load" />
              <div key={`roll-${loc}`} className="crt-roll" />
              <div className="crt-scan" /><div className="crt-grain" /><div className="crt-vignette" />
              {dial && <Dialup path={dial} onDone={dialDone} />}
              <Boot lines={bootLines} />
            </div>
            <div className="hidden h-9 shrink-0 items-center gap-5 border-t border-line px-5 text-[11px] text-faint md:flex">
              {(hints.length ? hints : ["S summary", "Esc back", "←/→ prev/next", "Enter run", "M sound"]).map((h) => {
                const [k, ...rest] = h.split(" ");
                return <span key={h} className="label tracking-[0.12em]"><kbd>{k}</kbd> {rest.join(" ")}</span>;
              })}
            </div>
          </div>
        </div>
        <KeycapBar actions={actions} primary={primary} pressed={pressed} hasPrev={!!prev} hasNext={!!next} />
      </div>
    </PrimaryContext.Provider>
  );
}
