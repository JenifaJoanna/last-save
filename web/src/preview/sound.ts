// Interface sounds (ElevenLabs-generated, ours). Off until the first tap; a toggle persists per viewer.
const FILES = { confirm: "confirm", flatline: "flatline", powerDown: "power-down", reconnect: "reconnect", scan: "scan", type: "type", unlock: "unlock" } as const;
const VOL: Partial<Record<keyof typeof FILES, number>> = { flatline: 0.5, powerDown: 0.45, type: 0.25, scan: 0.45, confirm: 0.55, unlock: 0.6, reconnect: 0.5 };
export type Sfx = keyof typeof FILES;

let enabled = true;
try { enabled = localStorage.getItem("lastsave-sound") !== "off"; } catch { /* storage blocked */ }
const cache = new Map<Sfx, HTMLAudioElement>();
const listeners = new Set<() => void>();

export function sfx(name: Sfx, volume?: number): void {
  if (!enabled || typeof Audio === "undefined") return;
  let a = cache.get(name);
  if (!a) { a = new Audio(`/sfx/${FILES[name]}.mp3`); a.preload = "auto"; cache.set(name, a); }
  const node = a.cloneNode(true) as HTMLAudioElement;
  node.volume = volume ?? VOL[name] ?? 0.5;
  void node.play().catch(() => { /* not unlocked yet */ });
}
export const soundOn = () => enabled;
export function setSound(on: boolean): void {
  enabled = on;
  try { localStorage.setItem("lastsave-sound", on ? "on" : "off"); } catch { /* storage blocked */ }
  listeners.forEach((f) => f());
  if (on) sfx("confirm", 0.35);
}
export const onSound = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
