// A bracket card for S03 (the app's .bracket: 1 px line-2 border, ember corner marks, here at 2× for the film).
// Lines either type on behind the gold caret (`rate` chars per frame) or print in stepped; one mark per card grows
// under or behind its key words (ember underline, or the gold block whose words flip to status ink).
import type { ReactNode } from "react";
import { Eyebrow, Label, Mono } from "../../../ds/type";
import { stepped, T } from "../../../ds/tokens";
import type { CardLine, CardSpec } from "./copy";
import { EC_SOURCE } from "./copy";
import { blink, easeOut, GoldCaret, H, printIn, ramp, W } from "./kit";

export const CARD_W = 1220;
const BIG = 50;
const SMALL = 27;
const metrics = (l: CardLine) => { const size = l.big ? BIG : SMALL; return { size, cw: size * 0.6, lh: Math.round(size * (l.big ? 1.32 : 1.6)) }; };

function Corner({ at }: { at: "tl" | "br" }) {
  const s = { position: "absolute" as const, width: 24, height: 24, borderColor: T.ember, borderStyle: "solid", borderWidth: 0 };
  return at === "tl"
    ? <div style={{ ...s, left: -3, top: -3, borderLeftWidth: 3, borderTopWidth: 3 }} />
    : <div style={{ ...s, right: -3, bottom: -3, borderRightWidth: 3, borderBottomWidth: 3 }} />;
}

function Line({ f, line, children }: { f: number; line: CardLine; children?: ReactNode }) {
  const { size, cw, lh } = metrics(line);
  const color = line.big ? T.text : T.muted;
  if (f < line.at) return <div style={{ height: lh }} />;
  if (line.rate) {
    const n = Math.min(line.text.length, Math.floor((f - line.at) * line.rate));
    const done = n >= line.text.length;
    const doneAt = line.at + Math.ceil(line.text.length / line.rate);
    const caret = !done || f < doneAt + 20;
    return (
      <div style={{ position: "relative", height: lh }}>
        <Mono size={size} color={color} style={{ lineHeight: `${lh}px` }}>{line.text.slice(0, n)}</Mono>
        {caret && <GoldCaret x={n * cw + 2} y={(lh - size * 1.18) / 2} w={cw} h={size * 1.18} opacity={done ? blink(f, doneAt) : 1} glow={0.2} />}
        {children}
      </div>
    );
  }
  return (
    <div style={{ position: "relative", height: lh, ...printIn(f, line.at) }}>
      <Mono size={size} color={color} weight={line.big ? 500 : 400} style={{ lineHeight: `${lh}px` }}>{line.text}</Mono>
      {children}
    </div>
  );
}

/** The growing mark: ember underline (steps(8), like the load bar) or a gold block that grows behind the words (ease-out). */
function Mark({ f, spec, line }: { f: number; spec: CardSpec["mark"]; line: CardLine }) {
  if (f < spec.at) return null;
  const { size, cw, lh } = metrics(line);
  const left = spec.a * cw;
  const w = (spec.b - spec.a) * cw;
  if (spec.kind === "under") {
    const p = stepped(ramp(f, spec.at, spec.at + 12), 8);
    return <div style={{ position: "absolute", left, top: lh - 6, width: w * p, height: 4, background: T.ember }} />;
  }
  const p = ramp(f, spec.at, spec.at + 14, easeOut);
  const padX = 10;
  const bh = Math.round(size * 1.2);
  return (
    <div style={{ position: "absolute", left: left - padX, top: (lh - bh) / 2, width: w + padX * 2, height: bh, overflow: "hidden",
      clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, background: T.gold, boxShadow: "0 0 28px rgba(255,201,74,0.35)" }}>
      <Mono size={size} color={T.statusInk} weight={600} style={{ position: "absolute", left: padX, top: -(lh - bh) / 2, lineHeight: `${lh}px` }}>
        {line.text.slice(spec.a, spec.b)}
      </Mono>
    </div>
  );
}

/** One page of the teleprompter: a W × H block with the card centred in it. */
export function CardPage({ f, spec, top }: { f: number; spec: CardSpec; top: number }) {
  const head = f >= spec.at ? printIn(f, spec.at) : { opacity: 0 };
  return (
    <div style={{ position: "absolute", left: 0, top, width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: CARD_W, boxSizing: "border-box", padding: "52px 84px 50px", border: `1px solid ${T.line2}`, borderRadius: 2 }}>
        <Corner at="tl" />
        <Corner at="br" />
        <div style={head}><Eyebrow size={22} color={T.cyan}>{spec.eyebrow}</Eyebrow></div>
        <div style={{ marginTop: 30 }}>
          {spec.lines.map((l, i) => (
            <Line key={i} f={f} line={l}>{spec.mark.line === i && <Mark f={f} spec={spec.mark} line={l} />}</Line>
          ))}
        </div>
        {spec.note && <div style={{ marginTop: 22 }}><Line f={f} line={spec.note} /></div>}
        <div style={{ marginTop: 34, paddingTop: 22, borderTop: `1px solid ${T.line}`, ...head }}>
          <Label size={20} color={T.faint} track={0.16}>{EC_SOURCE}</Label>
        </div>
      </div>
    </div>
  );
}
