// S06: the `attack` take cut into one segment per beat (so each beat's refusal prints on its V06 word), and the
// refusal list: each refusal lifts off the take's log line as 56 px film type and stacks under a REFUSED tally.
import { AbsoluteFill, Sequence } from "remotion";
import { Slot } from "../../../film/Slot";
import { CONTENT } from "../../../ds/screen";
import { FPS, stepped, T } from "../../../ds/tokens";
import { Display } from "../../../ds/type";
import { HITS, LEAD, LIST, LOG, TAKE_LEN } from "./attack";
import { KeyLine } from "./KeyLine";
import { prog } from "./motion";

/** ScreenFrame content crop: a full-page take shown at 1:1 inside the content rect. */
export const CONTENT_CROP = { x: CONTENT.x / 1920, y: CONTENT.y / 1080, w: CONTENT.w / 1920, h: CONTENT.h / 1080 };

/** Take segments as [start frame, end frame, take seconds at start], clamped inside the take on disk. */
function segments(total: number) {
  return HITS.map((h, i) => {
    const start = i === 0 ? 0 : h.cue - LEAD;
    const end = i === HITS.length - 1 ? total : HITS[i + 1].cue - LEAD;
    const from = Math.max(0, h.ref - (h.cue - start) / FPS);
    return { start, end, from: Math.max(0, Math.min(from, TAKE_LEN - (end - start) / FPS - 0.1)) };
  });
}

/** The take inside ScreenFrame's content (under the camera). */
export function AttackTake({ total }: { total: number }) {
  return (
    <AbsoluteFill>
      {segments(total).map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.end - s.start} layout="none">
          <AbsoluteFill><Slot slot="attack" from={s.from} crop={CONTENT_CROP} /></AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Frame-level refusal list. `toScreen` maps take px to frame px (the camera), so each lift starts on its log line. */
export function RefusalList({ f, toScreen, camScale }: { f: number; toScreen: (x: number, y: number) => { x: number; y: number }; camScale: number }) {
  const rows = HITS.flatMap((h) => h.rows.map((r, j) => ({ r, at: h.cue + 3 * j })));
  const count = rows.filter((x) => f >= x.at).length;
  const head = stepped(prog(f, HITS[0].cue - 4, HITS[0].cue + 6), 5);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {head > 0 && (
        <div style={{ position: "absolute", left: LIST.x, top: LIST.headerY, opacity: head, transform: `translateX(${(1 - head) * -14}px)` }}>
          <Display size={96} tone="dead">{`Refused ${count}/${rows.length}`}</Display>
        </div>
      )}
      {rows.map(({ r, at }, i) => (
        <KeyLine key={r.n} f={f} at={at} from={toScreen(LOG.x, r.logY)} fromScale={(LOG.size * camScale) / LIST.size} to={{ x: LIST.x, y: LIST.y0 + i * LIST.pitch }} size={LIST.size}>
          <span style={{ color: T.gold, fontWeight: 600 }}>{r.n}</span> {r.method} <span style={{ color: T.faint }}>→</span> <span style={{ color: T.dead, fontWeight: 500 }}>{r.text}</span>
        </KeyLine>
      ))}
    </AbsoluteFill>
  );
}
