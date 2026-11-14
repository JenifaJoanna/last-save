// On-screen words for S01–S03, verbatim from demo/SOURCES.md (each checked against its source there).
// Timings are scene frames (30 fps). VO word starts: V01 "goes" = S01 f224; V02 "Last" f84, "licence" f118,
// "outlives" f143; V03 "law" f94, "code" f169, "Last Save" f209, "refund" f315.

export interface OpenQuote { lines: string[]; source: string; start: number; rate: number }

/** S01: three player quotes, typed one after another. Line 2 of the BBC quote hangs one space past the opening mark. */
export const OPEN_QUOTES: OpenQuote[] = [
  { lines: ["“they took my money, they host the game”"], source: "Steam Community · The Crew forum · 2 Apr 2024", start: 8, rate: 1 },
  {
    lines: ["“No refunds, no actual heads-up at the time of purchase,", " and nothing you can do to keep it at all”"],
    source: "BBC News · 6 Jun 2026", start: 60, rate: 1.25,
  },
  { lines: ["“skeleton of what you thought you paid for”"], source: "The Crew players' lawsuit, via Game Developer · 10 Apr 2025", start: 150, rate: 1 },
];
export const S01_GREY = 222; // 2 f before "goes"

/** S02 boot log: web/src/components/terminal/Terminal.tsx bootLines with the live contract's values. */
export const BOOT_LINES = [
  "LS-0001  LAST SAVE TERMINAL  v2.0",
  "Licence contract ......... ember-rift.lastsave-factory.testnet",
  "Server key ............... SEALED IN ENCLAVE",
  "Access keys on contract .. 0 (LOCKED)",
  "Link NEAR testnet ........ CONNECTED",
  "Hello. The game outlives its studio.",
];

export interface CardLine { text: string; big?: boolean; at: number; rate?: number }
export interface CardMark { line: number; a: number; b: number; at: number; kind: "under" | "block" }
export interface CardSpec { eyebrow: string; at: number; lines: CardLine[]; mark: CardMark; note?: CardLine }

export const EC_SOURCE = "European Commission · IP/26/1369 · 16 June 2026";

/** S03: European Commission press release IP/26/1369. Card 1 is the full sentence; the key words land on "law". */
export const EC_CARDS: CardSpec[] = [
  {
    eyebrow: "01 · The law", at: 22,
    lines: [
      { text: "“The Commission considers that at this stage it", at: 26, rate: 0.82 },
      { text: "cannot propose a legal obligation", big: true, at: 90 },
      { text: "to keep video games playable", big: true, at: 92 },
      { text: "after they stop being provided commercially.”", at: 98 },
    ],
    mark: { line: 1, a: 0, b: 33, at: 104, kind: "under" },
  },
  {
    eyebrow: "02 · The ask", at: 154,
    lines: [
      { text: "“…an industry code of conduct", big: true, at: 160 },
      { text: "on managing video games'", big: true, at: 162 },
      { text: "'end of life'”", big: true, at: 164 },
    ],
    mark: { line: 0, a: 14, b: 29, at: 176, kind: "under" },
  },
  {
    eyebrow: "03 · The refund", at: 268,
    lines: [
      { text: "“Consumers may be entitled to", big: true, at: 274 },
      { text: "proportionate refund", big: true, at: 308 },
      { text: "of their purchases.”", big: true, at: 310 },
    ],
    mark: { line: 1, a: 14, b: 20, at: 315, kind: "block" },
  },
];
