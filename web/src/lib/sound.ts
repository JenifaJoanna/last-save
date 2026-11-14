// Terminal sound: story SFX (ElevenLabs-generated, ours) plus a synthesized key blip. A toggle persists per viewer.
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

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
/** A short terminal key blip: a filtered noise tick plus a square-wave chirp. `tone` shifts the pitch (select vs confirm). */
export function blip(tone: "key" | "select" | "go" = "key"): void {
  if (!enabled || typeof AudioContext === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    noise ??= (() => { const b = ctx!.createBuffer(1, Math.floor(ctx!.sampleRate * 0.03), ctx!.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); return b; })();
    const n = ctx.createBufferSource(); n.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    n.connect(hp).connect(ng).connect(ctx.destination); n.start(t);
    const o = ctx.createOscillator(); o.type = "square";
    const f = tone === "go" ? 880 : tone === "select" ? 620 : 540;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.08);
  } catch { /* audio unavailable */ }
}

export const soundOn = () => enabled;
export function setSound(on: boolean): void {
  enabled = on;
  try { localStorage.setItem("lastsave-sound", on ? "on" : "off"); } catch { /* storage blocked */ }
  listeners.forEach((f) => f());
  if (on) blip("go");
}
export const onSound = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
