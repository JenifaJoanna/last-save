// Terminal effects: text decode, the once-per-session boot log, and the dial-up interstitial between screens.
import { useEffect, useRef, useState } from "react";
import { sfx } from "../../lib/sound";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const GLYPHS = "ABCDEF0123456789#%&*+=<>/\\";

/** Resolves `text` from random glyphs, left to right, `msPerChar` apart. Instant under reduced motion. */
export function useDecode(text: string, msPerChar = 25, glyphs = GLYPHS): string {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced() || !text) { setOut(text); return; }
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setOut(text.slice(0, i) + Array.from(text.slice(i), (c) => (c === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)])).join(""));
      if (i >= text.length) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar, glyphs]);
  return out;
}

const BOOT_KEY = "ls-boot";
/** First visit in a session: the terminal prints its checks line by line, then cuts to the screen. Any key or click skips. */
export function Boot({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(0);
  const count = useRef(lines.length);
  const [done, setDone] = useState(() => { try { return sessionStorage.getItem(BOOT_KEY) === "1" || reduced(); } catch { return true; } });
  useEffect(() => {
    if (done) return;
    const finish = () => { try { sessionStorage.setItem(BOOT_KEY, "1"); } catch { /* storage blocked */ } setDone(true); };
    const n = count.current;
    const timers = Array.from({ length: n }, (_, i) => window.setTimeout(() => { setShown(i + 1); sfx("type", 0.12); }, 300 + i * 400));
    timers.push(window.setTimeout(finish, 300 + n * 400 + 500));
    const skip = (e: Event) => { e.stopImmediatePropagation(); e.preventDefault(); finish(); };
    window.addEventListener("keydown", skip, { capture: true, once: true });
    window.addEventListener("pointerdown", skip, { capture: true, once: true });
    return () => { timers.forEach(clearTimeout); window.removeEventListener("keydown", skip, { capture: true }); window.removeEventListener("pointerdown", skip, { capture: true }); };
  }, [done]);
  if (done) return null;
  return (
    <div className="absolute inset-0 z-[45] flex flex-col justify-end bg-ink p-5 sm:p-8" aria-live="polite">
      <div className="text-[13px] leading-7 text-gold">
        {lines.slice(0, shown).map((l) => <p key={l} className="whitespace-pre">{l}</p>)}
        <p className="caret h-7" />
      </div>
      <p className="label mt-4 text-[11px] text-faint">Press any key or click to skip</p>
    </div>
  );
}

/** Between screens: a centred box types the request, prints two link lines and a stepped receive bar (~700 ms). */
export function Dialup({ path, onDone }: { path: string; onDone: () => void }) {
  const cmd = `$ ls-0001 open ${path}`;
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduced()) { onDone(); return; }
    const t0 = performance.now();
    const id = window.setInterval(() => { const e = performance.now() - t0; setT(e); if (e >= 720) { window.clearInterval(id); onDone(); } }, 30);
    return () => window.clearInterval(id);
  }, [onDone]);
  const typed = cmd.slice(0, Math.floor(Math.min(1, t / 260) * cmd.length));
  const pct = Math.max(0, Math.min(100, Math.floor((t - 420) / 280 * 8) * 12.5));
  const bar = "#".repeat(Math.round(pct / 10)).padEnd(10, "─");
  return (
    <div className="absolute inset-0 z-[45] grid place-items-center bg-ink px-4">
      <div className="w-full max-w-md border border-line-2 bg-ink-2/80 p-4 text-[12.5px] leading-6">
        <p className="text-gold">{typed}{t < 260 && <span className="caret" />}</p>
        {t > 300 && <p className="text-muted">&gt; resolving NEAR testnet ...... <span className="text-alive">ok</span></p>}
        {t > 380 && <p className="text-muted">&gt; link 1200 baud ............. <span className="text-alive">ok</span></p>}
        {t > 420 && <p className="text-muted">&gt; receiving [<span className="text-gold">{bar}</span>] {pct} %</p>}
      </div>
    </div>
  );
}
