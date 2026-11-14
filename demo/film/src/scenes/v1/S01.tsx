// S01 Open (0–270). Inside the CRT glass, no chrome in view: three sourced player quotes type on at ~1 char per frame
// behind the gold block caret, each with its source in faint Chakra Petch. On "goes with it" (f224) they grey out to
// faint, then step away; the caret glides to the screen centre and holds. End pose: the gold caret alone at the centre
// (S02 expands it into the CRT power-on line). Camera: locked in the glass, +2.5 % push.
import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Label, Mono } from "../../ds/type";
import { stepped, T } from "../../ds/tokens";
import { blink, CARET_CENTER, CARET_H, cl, CW, easeOut, GoldCaret, Glass, H, IN_GLASS, mix, MONO, printIn, ramp, S01_END_SCALE } from "./g1/kit";
import { OPEN_QUOTES, S01_GREY } from "./g1/copy";

const LH = MONO * 1.5;
const SRC = 16; // source label size in content px (≈20 px on screen)
const SRC_GAP = 8;
const BLOCK_GAP = 46;
const LEFT = 470;

// Lay the three blocks out once, vertically centred in the content rect.
const heights = OPEN_QUOTES.map((q) => q.lines.length * LH + SRC_GAP + SRC * 1.4);
const total = heights.reduce((a, b) => a + b, 0) + BLOCK_GAP * (OPEN_QUOTES.length - 1);
const lastIndex = <X,>(xs: X[], ok: (x: X) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (ok(xs[i])) return i; return -1; };
const BLOCKS = OPEN_QUOTES.map((q, i) => {
  const top = (H - total) / 2 + heights.slice(0, i).reduce((a, b) => a + b, 0) + BLOCK_GAP * i;
  const len = q.lines.reduce((n, l) => n + l.length, 0);
  const done = q.start + Math.ceil(len / q.rate);
  return { ...q, top, len, done, srcAt: done + 2 };
});

/** Characters typed of a block at frame f, split back into its lines. */
function typedLines(b: (typeof BLOCKS)[number], f: number) {
  let n = Math.max(0, Math.min(b.len, Math.floor((f - b.start) * b.rate)));
  return b.lines.map((l) => { const s = l.slice(0, n); n = Math.max(0, n - l.length); return s; });
}

/** Where the caret sits: after the last typed character of the block being typed (or the next one waiting to start). */
function caretAt(f: number) {
  const i = Math.max(0, lastIndex(BLOCKS, (b) => f >= b.start));
  const b = BLOCKS[i];
  const lines = typedLines(b, f);
  let li = lastIndex(lines, (s) => s.length > 0);
  if (li < 0) li = 0;
  const typing = f >= b.start && f < b.done;
  return { x: LEFT + lines[li].length * CW + 2, y: b.top + li * LH + (LH - CARET_H) / 2, typing, idleSince: f < b.start ? 0 : b.done };
}

export function S01() {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, 269], [IN_GLASS, S01_END_SCALE], cl);
  const grey = stepped(ramp(f, S01_GREY, S01_GREY + 12), 5);
  const gone = stepped(ramp(f, 238, 250), 5);
  const ink = interpolateColors(grey, [0, 1], [T.text, T.faint]);

  const c = caretAt(f);
  const move = ramp(f, 247, 266, easeOut);
  const cx = mix(c.x, CARET_CENTER.x, move);
  const cy = mix(c.y, CARET_CENTER.y, move);
  const caretOn = f >= 236 || c.typing ? 1 : blink(f, c.idleSince);

  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Glass scale={scale}>
        <AbsoluteFill style={{ opacity: 1 - gone }}>
          {BLOCKS.map((b) => {
            if (f < b.start) return null;
            const lines = typedLines(b, f);
            return (
              <div key={b.source} style={{ position: "absolute", left: LEFT, top: b.top }}>
                {lines.map((s, li) => (
                  <Mono key={li} size={MONO} color={ink} style={{ height: LH, lineHeight: `${LH}px` }}>{s}</Mono>
                ))}
                {f >= b.srcAt && (
                  <div style={{ marginTop: SRC_GAP, paddingLeft: CW, ...printIn(f, b.srcAt) }}>
                    <Label size={SRC} color={T.faint} track={0.16} style={{ opacity: 1 - grey * 0.45 }}>{"— "}{b.source}</Label>
                  </div>
                )}
              </div>
            );
          })}
        </AbsoluteFill>
        <GoldCaret x={cx} y={cy} opacity={caretOn} />
      </Glass>
    </AbsoluteFill>
  );
}
