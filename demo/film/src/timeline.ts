// The film's beat sheet. Times in seconds; footage files live in public/footage/ (captured from the filmed run).
// Every footage beat names the evidence it shows; the overlay chips are real tx hashes filled in from proof/.
export type Beat =
  | { kind: "scene"; id: "open" | "title" | "escrow" | "close" | "why"; start: number; dur: number; vo?: string }
  | { kind: "footage"; id: string; start: number; dur: number; file: string; from?: number; vo?: string; caption?: string; tx?: string; mute?: boolean };

export const BEATS: Beat[] = [
  { kind: "scene", id: "open", start: 0, dur: 12, vo: "01-open" },
  { kind: "scene", id: "title", start: 12, dur: 10, vo: "02-title" },
  { kind: "scene", id: "why", start: 22, dur: 4, vo: "03-why" },
  { kind: "footage", id: "store", start: 26, dur: 4, file: "store.mp4", caption: "Forever Guarantee: checked on-chain" },
  { kind: "footage", id: "buy", start: 30, dur: 12, file: "buy.mp4", vo: "04-buy", caption: "buy_licence · 40% locked by contract" },
  { kind: "scene", id: "escrow", start: 42, dur: 7, vo: "05-promise" },
  { kind: "footage", id: "keys", start: 49, dur: 3, file: "keys.mp4", caption: "access keys on the licence contract: 0" },
  { kind: "footage", id: "match", start: 52, dur: 18, file: "match.mp4", caption: "Ember Rift · official server · 4 licence holders" },
  { kind: "footage", id: "kill", start: 70, dur: 12, file: "kill.mp4", vo: "06-kill", caption: "official server shut down" },
  { kind: "footage", id: "release", start: 82, dur: 18, file: "release.mp4", vo: "07-release", caption: "probe_official × 3 → Dead → release" },
  { kind: "footage", id: "choose", start: 100, dur: 15, file: "choose.mp4", vo: "08-choose", caption: "refund · pledge · post-shutdown sale" },
  { kind: "footage", id: "host", start: 115, dur: 15, file: "host.mp4", vo: "09-host", caption: "pnpm host --local" },
  { kind: "footage", id: "back", start: 130, dur: 15, file: "back.mp4", vo: "10-back", caption: "community host · same progress · claim_epoch" },
  { kind: "scene", id: "close", start: 145, dur: 10, vo: "11-close" },
];

export const TOTAL = BEATS.reduce((m, b) => Math.max(m, b.start + b.dur), 0);

/** Vertical 45 s cut: kill → release → back in, captions on. */
export const VERTICAL: { id: string; file: string; dur: number; vo?: string; caption: string }[] = [
  { id: "kill", file: "kill.mp4", dur: 12, vo: "06-kill", caption: "The studio shuts the official server down." },
  { id: "release", file: "release.mp4", dur: 16, vo: "07-release", caption: "An enclave confirms it and releases the server key on NEAR." },
  { id: "back", file: "back.mp4", dur: 17, vo: "10-back", caption: "Fans host it. Same players, same progress." },
];
