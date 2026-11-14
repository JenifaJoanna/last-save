// S06 screen content: the `attack` take cut into four segments so each "> REFUSED" line prints on its V06 word, and
// each red line lifted 1.3x off the log as it lands (a frozen crop of the take itself, so the text is the contract's
// own refusal). The lifted copy flies to the empty column under the attack menu, clear of the menu and the log.
import { AbsoluteFill, Freeze, Sequence } from "remotion";
import { Slot } from "../../../film/Slot";
import { CONTENT } from "../../../ds/screen";
import { FPS, stepped, T } from "../../../ds/tokens";
import { Label } from "../../../ds/type";
import { HITS, LEAD, LIFT, LOG, type Row, TAKE_LEN, TOTAL_ATTACKS, TRAY } from "./attack";
import { easeOut, lerp, prog } from "./motion";

/** ScreenFrame content crop: a full-page take shown at 1:1 inside the content rect. */
export const CONTENT_CROP = { x: CONTENT.x / 1920, y: CONTENT.y / 1080, w: CONTENT.w / 1920, h: CONTENT.h / 1080 };

/** Take segments as [start frame, end frame, take seconds at start]. */
function segments(total: number) {
  return HITS.map((h, i) => {
    const start = i === 0 ? 0 : h.cue - LEAD;
    const end = i === HITS.length - 1 ? total : HITS[i + 1].cue - LEAD;
    const from = Math.max(0, h.ref - (h.cue - start) / FPS);
    return { start, end, from: Math.max(0, Math.min(from, TAKE_LEN - (end - start) / FPS - 0.1)) };
  });
}

/** One red line lifted off the log: slides from its log row to tray slot `slot`, scaling to LIFT. */
function LiftedRow({ r, slot, p, gone, takeAt, has }: { r: Row; slot: number; p: number; gone: number; takeAt: number; has: boolean }) {
  const x = lerp(LOG.x, TRAY.x, p) - CONTENT.x;
  const y = lerp(r.y, TRAY.y + slot * TRAY.pitch, p) - CONTENT.y + gone * 14;
  const k = lerp(1, LIFT, p);
  const w = LOG.w * k;
  const hh = LOG.row * k;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: 1 - gone }}>
      <div style={{ position: "absolute", left: 0, top: -30 * p, opacity: stepped(p, 5) }}>
        <Label size={13} color={T.dead} track={0.16}>{`0${r.n} / 0${TOTAL_ATTACKS} · ${r.title} · refused`}</Label>
      </div>
      {has && <div style={{ position: "relative", width: w + 16, height: hh + 8, marginLeft: -8, marginTop: -4, background: T.void, borderLeft: `3px solid ${T.dead}`,
        boxShadow: `0 ${14 * p}px ${30 * p}px rgba(0,0,0,${0.7 * p}), 0 0 ${26 * p}px rgba(255,77,94,${0.28 * p})`, transform: `translate(${-6 * p}px, ${-6 * p}px)` }}>
        <div style={{ position: "absolute", left: 8, top: 4, width: w, height: hh, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: -LOG.x * k, top: -r.y * k, width: 1920 * k, height: 1080 * k }}>
            <Freeze frame={0}><Slot slot="attack" from={takeAt} tag={false} /></Freeze>
          </div>
        </div>
      </div>}
    </div>
  );
}

/** A beat's red line(s): lifted on its cue (a second row 3 f later), dropped when the next beat lands. */
function Lifted({ f, i }: { f: number; i: number }) {
  const h = HITS[i];
  const next = HITS[i + 1];
  const gone = next ? stepped(prog(f, next.cue - 1, next.cue + 3), 2) : 0;
  if (f < h.cue || gone >= 1) return null;
  return (
    <>
      {h.rows.map((r, j) => f >= h.cue + 3 * j && (
        <LiftedRow key={r.n} r={r} slot={j} p={prog(f, h.cue + 3 * j, h.cue + 3 * j + 9, easeOut)} gone={gone} takeAt={h.ref} has={h.ref < TAKE_LEN} />
      ))}
    </>
  );
}

export function AttackTake({ f, total }: { f: number; total: number }) {
  return (
    <AbsoluteFill>
      {segments(total).map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.end - s.start} layout="none">
          <AbsoluteFill><Slot slot="attack" from={s.from} crop={CONTENT_CROP} /></AbsoluteFill>
        </Sequence>
      ))}
      {HITS.map((_, i) => <Lifted key={i} f={f} i={i} />)}
    </AbsoluteFill>
  );
}
