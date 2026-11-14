// Terminal takes (asciinema replays through demo/capture/term.html: a 1800 x 980 window centred on a 1920 x 1080 page,
// 40 px bar, 18/26 px padding, 96 x 26 at 26 px Plex Mono, centred by the player's fit). Shown inside ScreenFrame's
// content cropped to the text block at one uniform scale, so the type stays ~25 px on screen and never stretches.
import { AbsoluteFill } from "remotion";
import { Slot, slotSource } from "../../../film/Slot";
import { CONTENT } from "../../../ds/screen";
import { T } from "../../../ds/tokens";
import { Label } from "../../../ds/type";

/** The text block in take px (TUNE against the first real terminal take). */
export const TEXT = { x: 196, y: 110, w: 1528, h: 900 } as const;
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
