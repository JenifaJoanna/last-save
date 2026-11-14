// Preview controls in the terminal's top strip: the PREVIEW tag, step through the lifecycle, switch who is signed in.
import { useEffect, useSyncExternalStore } from "react";
import { Link } from "wouter";
import { blip, sfx } from "../lib/sound";
import { current, move, setPersona, stepIndex, subscribe } from "./store";
import { PERSONAS, STEPS, type Persona } from "./world";

const snap = () => `${current().step}|${current().persona}`;
const ARRIVE: Record<string, Parameters<typeof sfx>[0]> = { sold: "confirm", probing: "scan", fail1: "powerDown", fail2: "powerDown", dead: "flatline", releasing: "scan", released: "unlock", chosen: "confirm", postbuy: "confirm", hosted: "reconnect", paid: "confirm", evm: "unlock", studio2: "confirm" };
/** The sound a lifecycle state makes when you arrive at it. */
export const arrive = (step: string) => (ARRIVE[step] ? sfx(ARRIVE[step]) : blip("select"));

export function PreviewStrip() {
  useSyncExternalStore(subscribe, snap);
  const i = stepIndex();
  const step = STEPS[i];
  const go = (d: number) => { move(d); arrive(current().step); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "]" || e.key === ".") go(1);
      if (e.key === "[" || e.key === ",") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const btn = "grid h-9 w-7 shrink-0 place-items-center text-muted hover:text-text disabled:opacity-30";
  return (
    <div className="flex h-9 min-w-0 items-center border border-gold/60 bg-gold/[0.06]">
      <Link href="/preview" className="label flex h-full items-center border-r border-gold/40 px-2 text-[11px] text-gold no-underline hover:bg-gold/10 sm:px-2.5" title="All screens and states"><span className="hidden min-[420px]:inline">Preview</span><span className="min-[420px]:hidden">PV</span></Link>
      <button onClick={() => go(-1)} disabled={i === 0} className={btn} aria-label="Previous state (,)">◂</button>
      <span className="label shrink-0 whitespace-nowrap px-0.5 text-[11px] text-text" title={step.label}>
        <span className="num text-gold">{String(i + 1).padStart(2, "0")}/{STEPS.length}</span><span className="hidden md:inline"> · {step.short}</span>
      </span>
      <button onClick={() => go(1)} disabled={i === STEPS.length - 1} className={btn} aria-label="Next state (.)">▸</button>
      <label className="h-full border-l border-gold/40">
        <span className="sr-only">Signed in as</span>
        <select value={current().persona} onChange={(e) => { blip("select"); setPersona(e.target.value as Persona); }}
          className="label h-full max-w-[84px] cursor-pointer appearance-none bg-transparent px-2 text-[11px] text-text outline-none sm:max-w-none sm:px-2.5">
          {PERSONAS.map((p) => <option key={p} value={p} className="bg-panel">{p === "guest" ? "signed out" : p}</option>)}
        </select>
      </label>
    </div>
  );
}
