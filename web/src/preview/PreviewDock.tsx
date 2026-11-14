// Floating preview dock: the "Preview" pill, step through the lifecycle, switch who is signed in, sound.
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, LayoutGrid, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "wouter";
import { current, move, setPersona, stepIndex, subscribe } from "./store";
import { onSound, setSound, sfx, soundOn } from "./sound";
import { PERSONAS, STEPS, type Persona } from "./world";

const snap = () => `${current().step}|${current().persona}`;
const ARRIVE: Record<string, Parameters<typeof sfx>[0]> = { sold: "confirm", probing: "scan", fail1: "powerDown", fail2: "powerDown", dead: "flatline", releasing: "scan", released: "unlock", chosen: "confirm", postbuy: "confirm", hosted: "reconnect", paid: "confirm", evm: "unlock", studio2: "confirm" };
/** The sound a state makes when you arrive at it. */
export const arrive = (step: string) => sfx(ARRIVE[step] ?? "type", ARRIVE[step] ? undefined : 0.18);

export function PreviewDock() {
  useSyncExternalStore(subscribe, snap);
  const sound = useSyncExternalStore(onSound, soundOn);
  const [flash, setFlash] = useState(0);
  const i = stepIndex();
  const step = STEPS[i];
  const go = (d: number) => { move(d); arrive(current().step); setFlash((x) => x + 1); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "]" || (e.key === "ArrowRight" && e.altKey)) go(1);
      if (e.key === "[" || (e.key === "ArrowLeft" && e.altKey)) go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3 sm:bottom-5">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border border-line-2 bg-panel/95 p-1.5 backdrop-blur-xl shadow-[0_20px_60px_-10px_rgb(0_0_0/0.8)]">
        <Link href="/" className="flex h-10 items-center gap-2 rounded-xl bg-gold/15 px-3 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-gold no-underline hover:bg-gold/25" title="All screens">
          <LayoutGrid className="size-4" /><span className="hidden sm:inline">Preview</span>
        </Link>
        <button onClick={() => go(-1)} disabled={i === 0} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-text disabled:opacity-30" aria-label="Previous state"><ChevronLeft className="size-5" /></button>
        <div className="relative min-w-0 px-1 text-center sm:w-[300px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${step.id}-${flash}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              <p className="truncate text-[13px] font-semibold leading-tight"><span className="sm:hidden">{step.short}</span><span className="hidden sm:inline">{step.label}</span></p>
              <p className="num text-[11px] leading-tight text-faint">{i + 1} / {STEPS.length}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <button onClick={() => go(1)} disabled={i === STEPS.length - 1} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-white/5 hover:text-text disabled:opacity-30" aria-label="Next state"><ChevronRight className="size-5" /></button>
        <label className="relative h-10">
          <span className="sr-only">Signed in as</span>
          <select value={current().persona} onChange={(e) => setPersona(e.target.value as Persona)}
            className="h-10 cursor-pointer appearance-none rounded-xl border border-line bg-white/[0.04] pl-3 pr-3 text-[13px] font-medium text-text outline-none hover:bg-white/[0.07]">
            {PERSONAS.map((p) => <option key={p} value={p} className="bg-panel">{p === "guest" ? "signed out" : p}</option>)}
          </select>
        </label>
        <button onClick={() => setSound(!sound)} className={`grid size-10 place-items-center rounded-xl hover:bg-white/5 ${sound ? "text-alive" : "text-faint"}`} aria-label={sound ? "Mute" : "Sound on"}>
          {sound ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
        </button>
      </div>
    </div>
  );
}
