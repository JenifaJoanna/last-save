// Terminal takes (asciinema replays through demo/capture/term.html, recorded at 3840x2160; px below are on the
// 1920x1080 basis). Shown inside ScreenFrame's content cropped to the text block at one uniform scale. Measured on
// raw/t-factory.mp4 (14 Nov 21:19): col 0 at x 252, 14.6 px per col (≈24.5 px type), rows every 33 px from y 136;
// the output fills rows 0-8, so the crop keeps rows 0-19 and the type reads ≈32 px on screen.
import { AbsoluteFill, Freeze, Sequence } from "remotion";
import { Slot, slotSource } from "../../../film/Slot";
import { CONTENT } from "../../../ds/screen";
import { T } from "../../../ds/tokens";
import { Label } from "../../../ds/type";

/** The text block in take px (aspect = the content rect's, so the crop scale is uniform). */
export const TEXT = { x: 230, y: 118, w: 1460, h: 675 } as const;
/** Terminal grid in take px: column 0 x, column width, row 0 top, row pitch, type size. */
export const GRID = { x0: 252, col: 14.6, y0: 136, row: 33, size: 24.5 } as const;
export const rowTop = (r: number) => GRID.y0 + r * GRID.row;
export const TERM_K = Math.min(CONTENT.w / TEXT.w, CONTENT.h / TEXT.h);
const OX = (CONTENT.w - TEXT.w * TERM_K) / 2;
const OY = (CONTENT.h - TEXT.h * TERM_K) / 2;
/** Take px → content px. */
export const termX = (x: number) => OX + (x - TEXT.x) * TERM_K;
export const termY = (y: number) => OY + (y - TEXT.y) * TERM_K;

function Crop({ slot, from }: { slot: string; from: number }) {
  return (
    <div style={{ position: "absolute", left: OX, top: OY, width: TEXT.w * TERM_K, height: TEXT.h * TERM_K, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -TEXT.x * TERM_K, top: -TEXT.y * TERM_K, width: 1920 * TERM_K, height: 1080 * TERM_K }}>
        <Slot slot={slot} from={from} tag={false} />
      </div>
    </div>
  );
}

/** A terminal take filling the content area (ink letterbox). `from` = take seconds at this component's frame 0. */
export function TermTake({ slot, from = 0 }: { slot: string; from?: number }) {
  return (
    <AbsoluteFill style={{ background: T.ink }}>
      <Crop slot={slot} from={from} />
      <PlaceholderTag slot={slot} />
    </AbsoluteFill>
  );
}

/** A take cut into segments: each starts at scene frame `at` showing take second `from`, playing (or held if `hold`). */
export interface Cut { at: number; from: number; hold?: boolean }
export function TermCuts({ slot, cuts, end }: { slot: string; cuts: readonly Cut[]; end: number }) {
  return (
    <AbsoluteFill style={{ background: T.ink }}>
      {cuts.map((c, i) => {
        const until = i + 1 < cuts.length ? cuts[i + 1].at : end;
        return (
          <Sequence key={i} from={c.at} durationInFrames={Math.max(1, until - c.at)} layout="none">
            {c.hold ? <Freeze frame={0}><Crop slot={slot} from={c.from} /></Freeze> : <Crop slot={slot} from={c.from} />}
          </Sequence>
        );
      })}
      <PlaceholderTag slot={slot} />
    </AbsoluteFill>
  );
}

/** Slot's own corner tag is cropped away, so stand-ins are tagged here (the final film has no placeholders). */
export function PlaceholderTag({ slot, plate }: { slot: string; plate?: string }) {
  const src = slotSource(slot, plate);
  if (src.kind === "raw") return null;
  return (
    <Label size={14} color={T.faint} style={{ position: "absolute", right: 14, bottom: 10, background: "rgba(10,8,20,0.7)", padding: "3px 8px", borderRadius: 3 }}>
      {src.kind === "none" ? `take pending · ${slot}` : `placeholder · ${slot}`}
    </Label>
  );
}
