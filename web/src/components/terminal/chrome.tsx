// Terminal chrome pieces: the ember status bar (decoding title, live clock, link state), keycap bar, sound toggle.
import { useEffect, useState, useSyncExternalStore } from "react";
import { onSound, setSound, soundOn } from "../../lib/sound";
import { useDecode } from "./effects";
import type { Primary } from "./nav";
import type { Mode } from "./Terminal";

const MODE_TEXT: Record<Mode, string> = { online: "Online", probing: "Probing", dead: "Dead", released: "Released", offline: "Linking" };
const MODE_TONE: Record<Mode, string> = { online: "text-[#0d3b22]", probing: "text-[#4a2a00]", dead: "text-[#4a0610] blink-fast", released: "text-[#3d2a00]", offline: "text-[#3b1a0c]" };

function useClock(): string {
  const fmt = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const [t, setT] = useState(fmt);
  useEffect(() => { const id = window.setInterval(() => setT(fmt()), 10_000); return () => window.clearInterval(id); }, []);
  return t;
}

export function StatusBar({ title, mode }: { title: string; mode: Mode }) {
  const shown = useDecode(title.toUpperCase());
  const clock = useClock();
  const bg = mode === "dead" ? "bg-dead" : mode === "released" ? "bg-gold" : "bg-ember";
  return (
    <div className={`relative grid h-8 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 text-[#160b05] transition-colors duration-150 sm:px-5 ${bg}`}>
      <span className="label hidden truncate text-[11px] sm:block">LS-0001 · Terminal</span>
      <span className="label col-start-1 truncate text-[12px] sm:col-start-2 sm:text-center" aria-live="polite">{shown}</span>
      <span className="label justify-self-end whitespace-nowrap text-[11px]">{clock} · <span className={MODE_TONE[mode]}>{MODE_TEXT[mode]}</span></span>
    </div>
  );
}

export function SoundToggle() {
  const on = useSyncExternalStore(onSound, soundOn);
  return (
    <button onClick={() => setSound(!on)} aria-pressed={on} title="Sound (M)"
      className={`label h-9 shrink-0 whitespace-nowrap rounded-[5px] border px-2.5 text-[11px] sm:px-3 ${on ? "border-gold/70 text-gold" : "border-line-2 text-faint"}`}>
      Sound: <span className={on ? "blink-fast" : ""}>{on ? "On" : "Off"}</span>
    </button>
  );
}

type Actions = { summary: () => void; back: () => void; prev: () => void; next: () => void; primary: () => void };
export function KeycapBar({ actions, primary, pressed, hasPrev, hasNext }: { actions: Actions; primary: Primary | null; pressed: string | null; hasPrev: boolean; hasNext: boolean }) {
  const keys: { id: keyof Actions; label: string; short: string; kbd: string; disabled?: boolean }[] = [
    { id: "summary", label: "Summary", short: "Menu", kbd: "S" },
    { id: "back", label: "Back", short: "Back", kbd: "Esc" },
    { id: "prev", label: "◂ Prev", short: "◂", kbd: "←", disabled: !hasPrev },
    { id: "next", label: "Next ▸", short: "▸", kbd: "→", disabled: !hasNext },
  ];
  return (
    <nav className="flex shrink-0 items-center justify-center gap-1.5 pb-[max(env(safe-area-inset-bottom),4px)] sm:gap-3" aria-label="Terminal keys">
      {keys.map((k) => (
        <button key={k.id} onClick={actions[k.id]} disabled={k.disabled} data-pressed={pressed === k.id} title={`${k.label} (${k.kbd})`}
          className="keycap h-10 min-w-0 flex-1 px-2 text-[12px] sm:h-9 sm:flex-none sm:px-4">
          <span className="sm:hidden">{k.short}</span><span className="hidden sm:inline">{k.label}</span>
        </button>
      ))}
      {primary && (
        <button onClick={actions.primary} disabled={primary.disabled || primary.busy} data-pressed={pressed === "primary"} title={`${primary.label} (Enter)`}
          className="keycap keycap-primary h-10 min-w-0 flex-[1.6] truncate px-3 text-[12px] sm:h-9 sm:flex-none sm:px-5">
          {primary.busy ? "Working…" : primary.label}
        </button>
      )}
    </nav>
  );
}
