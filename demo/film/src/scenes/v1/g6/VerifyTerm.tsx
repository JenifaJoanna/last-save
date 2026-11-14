// Motion-graphics stand-in for the `t-verify` take: `pnpm verify` in the terminal palette (IBM Plex Mono 26 px, gold
// prompt, green ✓), drawn in ScreenFrame content coords. Row labels and group names are the real ones from
// scripts/verify (checks-chain/artifact/evm/proof.mjs) in their real order; the two reason lines are instance-independent
// (global code hash from scripts/verify/instances.json). Per-instance reasons and the summary counts come with the take.
// The real command prints the whole table at once after ~2 s; the stand-in prints rows in so they read on camera.
import { interpolate } from "remotion";
import { FONT, T } from "../../../ds/tokens";
import { VERIFY_INSTANCE } from "./facts";
import { C, printP, stepIn } from "./kit";

export const LH = 35; // row height at 26 px (term.html: 26 rows in ~924 px)
export const PAD = { x: 26, y: 18 };
export const CMD = "pnpm verify";
export const TYPE_AT = 16; // first command char
export const ENTER_AT = 30;
export const ROWS_AT = 38; // first output row
export const LAST_AT = 192; // last ✓ row lands just before "chain." (V15 f197)
const VISIBLE = 22; // rows that fit before the terminal scrolls

type Row = { kind: "title" | "group" | "ok" | "why" | "blank"; text: string };
const R = (kind: Row["kind"], text = ""): Row => ({ kind, text });
export const ROWS: Row[] = [
  R("title", `LAST SAVE verify · ${VERIFY_INSTANCE}`),
  R("blank"), R("group", "Code"),
  R("ok", "Contract code is the published code"),
  R("why", "global code 4Awoknek…6rt1 = published hash = factory.code_hash(); no local code"),
  R("ok", "Published global code is readable and hashes to its id"),
  R("ok", "0 access keys on the instance (locked)"),
  R("why", "0 access keys: nobody can redeploy, drain or delete the contract"),
  R("blank"), R("group", "Factory"),
  R("ok", "Factory points at the same global hash"),
  R("ok", "Instance listed by the factory"),
  R("blank"), R("group", "Escrow"),
  R("ok", "Escrow attested by the enclave"),
  R("ok", "Keystore access rule is exactly release.wasm + this contract"),
  R("blank"), R("group", "Artifacts"),
  R("ok", "Encrypted artifact: every mirror's sha256 = on-chain"),
  R("ok", "Walrus mirror serves it"),
  R("blank"), R("group", "Release"),
  R("ok", "Released key hashes to the commitment"),
  R("ok", "Released key decrypts the artifact to build_hash"),
  R("blank"), R("group", "Chain Signatures"),
  R("ok", "Payer address re-derived from public inputs"),
  R("ok", "Signed payouts mined on Base Sepolia"),
  R("blank"), R("group", "Provenance"),
  R("ok", "Build attested by GitHub Actions (Sigstore) for the on-chain build hash"),
  R("blank"), R("group", "Proof"),
  R("ok", "Every tx in the proof manifests resolves on RPC"),
];

// Blank rows take 1 unit of time, others 2: spread the rows from ROWS_AT to LAST_AT.
const units = ROWS.map((r) => (r.kind === "blank" ? 1 : 2));
const total = units.slice(1).reduce((a, b) => a + b, 0);
export const ROW_AT: number[] = (() => {
  let acc = 0;
  return ROWS.map((_, i) => { if (i > 0) acc += units[i]; return Math.round(ROWS_AT + ((LAST_AT - ROWS_AT) * acc) / total); });
})();

/** Rows printed by frame f, as a continuous count (for a smooth scroll). */
const printedAt = (f: number) => {
  const xs = [ROWS_AT - 1, ...ROW_AT];
  const ys = [0, ...ROW_AT.map((_, i) => i + 1)];
  return interpolate(f, xs, ys, C);
};
/** Scroll offset (px) at frame f: the terminal scrolls once the print head passes the last visible row. */
export const scrollAt = (f: number) => Math.max(0, (printedAt(f) + 1 - VISIBLE) * LH);

const line = (size: number) => ({ fontFamily: FONT.mono, fontSize: size, lineHeight: `${LH}px`, height: LH, whiteSpace: "pre" as const });

/** The terminal at frame f. `cmdDim` 0..1 dims the command row while its lifted copy floats. */
export function VerifyTerm({ f, cmdDim = 0 }: { f: number; cmdDim?: number }) {
  const typedN = Math.max(0, Math.min(CMD.length, Math.floor(f - TYPE_AT + 1)));
  const done = f >= LAST_AT + 12;
  const caretOn = Math.floor(f / 18) % 2 === 0;
  const scroll = scrollAt(f);
  const lastPrinted = ROW_AT.filter((a) => f >= a).length;
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: PAD.x, top: PAD.y, right: PAD.x, transform: `translateY(${-scroll}px)` }}>
        <div style={{ ...line(26), color: T.text, opacity: 1 - cmdDim * 0.75 }}>
          <span style={{ color: T.gold, fontWeight: 600 }}>$ </span>{CMD.slice(0, typedN)}
          {f < ENTER_AT + 2 && <span style={{ color: T.gold, opacity: f < TYPE_AT || caretOn ? 1 : 0 }}>█</span>}
        </div>
        {ROWS.map((r, i) => {
          const p = printP(f, ROW_AT[i], 8);
          if (p <= 0) return <div key={i} style={line(26)} />;
          const last = i === ROWS.length - 1;
          const hi = last ? interpolate(f, [LAST_AT + 6, LAST_AT + 14], [0, 1], C) : 0;
          return (
            <div key={i} style={{ ...line(r.kind === "why" ? 22 : 26), ...stepIn(p), position: "relative" }}>
              {hi > 0 && <span style={{ position: "absolute", left: -10, right: 0, top: 0, bottom: 0, background: `rgba(69,227,148,${0.08 * hi})`, borderLeft: `3px solid rgba(69,227,148,${hi})` }} />}
              {r.kind === "title" && <span style={{ fontWeight: 600, color: T.text }}>{r.text}</span>}
              {r.kind === "group" && <span style={{ fontWeight: 600, color: T.text, textDecoration: "underline", textUnderlineOffset: 5 }}>{r.text}</span>}
              {r.kind === "ok" && <span style={{ position: "relative" }}><span style={{ color: T.alive, fontWeight: 600 }}>{"✓   "}</span><span style={{ color: T.text }}>{r.text}</span></span>}
              {r.kind === "why" && <span style={{ color: T.faint }}>{"     "}{r.text}</span>}
            </div>
          );
        })}
        {lastPrinted === ROWS.length && done && <div style={{ ...line(26), color: T.gold }}><span style={{ fontWeight: 600 }}>$ </span><span style={{ opacity: caretOn ? 1 : 0 }}>█</span></div>}
      </div>
    </div>
  );
}
