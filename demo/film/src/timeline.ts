// The film's beat sheet, laid out sequentially. Footage beat lengths and their on-screen labels come from the real
// cut (edl.json → cut.mjs → edl.generated.json); motion scenes have fixed lengths.
import cut from "./edl.generated.json";

type Cut = Record<string, { dur: number; labels: { at: number; dur: number; text: string }[] }>;
const CUT = cut as Cut;

export type SceneId = "open" | "title" | "escrow" | "close" | "why";
export interface Sfx { file: string; at: number; volume?: number }
export type Beat =
  | { kind: "scene"; id: SceneId; start: number; dur: number; vo?: string; voAt?: number; sfx?: Sfx[] }
  | { kind: "footage"; id: string; start: number; dur: number; vo?: string; voAt?: number; caption?: string; labels: { at: number; dur: number; text: string }[]; sfx?: Sfx[] };

type Spec = { kind: "scene"; id: SceneId; dur: number; vo?: string; voAt?: number; sfx?: Sfx[] } | { kind: "footage"; id: string; vo?: string; voAt?: number; caption?: string; sfx?: Sfx[] };

const SPEC: Spec[] = [
  { kind: "scene", id: "open", dur: 11, vo: "01-open", voAt: 7.6 },
  { kind: "scene", id: "title", dur: 9, vo: "02-title", voAt: 4.6 },
  { kind: "scene", id: "why", dur: 4, vo: "03-why", voAt: 0.4 },
  { kind: "footage", id: "store", caption: "Forever Guarantee, checked on-chain" },
  { kind: "footage", id: "buy", vo: "04-buy", voAt: 1.0, sfx: [{ file: "confirm", at: 4.2 }] },
  { kind: "scene", id: "escrow", dur: 7, vo: "05-promise", voAt: 0.3 },
  { kind: "footage", id: "keys" },
  { kind: "footage", id: "match", sfx: [{ file: "scan", at: 11.2, volume: 0.6 }] },
  { kind: "footage", id: "kill", vo: "06-kill", voAt: 0.6, sfx: [{ file: "power-down", at: 1.2 }] },
  { kind: "footage", id: "release", vo: "07-release", voAt: 1.8, sfx: [{ file: "flatline", at: 7.4, volume: 0.7 }, { file: "unlock", at: 13.4 }] },
  { kind: "footage", id: "choose", vo: "08-choose", voAt: 0.6, sfx: [{ file: "confirm", at: 4.0, volume: 0.6 }] },
  { kind: "footage", id: "host", vo: "09-host", voAt: 0.8 },
  { kind: "footage", id: "back", vo: "10-back", voAt: 1.0, sfx: [{ file: "reconnect", at: 0.0 }] },
  { kind: "scene", id: "close", dur: 9, vo: "11-close", voAt: 3.6 },
];

export const BEATS: Beat[] = (() => {
  let t = 0;
  return SPEC.map((b) => {
    const start = t;
    if (b.kind === "scene") { t += b.dur; return { ...b, start }; }
    const c = CUT[b.id] ?? { dur: 3, labels: [] };
    t += c.dur;
    return { ...b, start, dur: c.dur, labels: c.labels };
  });
})();

export const TOTAL = Math.ceil(BEATS.reduce((m, b) => Math.max(m, b.start + b.dur), 0));
export const startOf = (id: string) => BEATS.find((b) => b.id === id)?.start ?? 0;

/** Vertical 45 s cut: kill → release → back in, captions on. */
export const VERTICAL: { id: string; file: string; dur: number; vo?: string; caption: string }[] = [
  { id: "kill", file: "kill.mp4", dur: CUT.kill?.dur ?? 12, vo: "06-kill", caption: "The studio shuts the official server down." },
  { id: "release", file: "release.mp4", dur: CUT.release?.dur ?? 16, vo: "07-release", caption: "An enclave confirms it and releases the server key on NEAR." },
  { id: "back", file: "back.mp4", dur: Math.min(CUT.back?.dur ?? 14, 14), vo: "10-back", caption: "Fans host it. Same players, same progress." },
];
