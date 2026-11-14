// A footage slot (ids match FOOTAGE.md). It plays the real v2 take from public/footage/raw/<slot>.mp4 when it exists,
// else a preview-site capture from public/footage/preview/<slot>.mp4, else a still plate from public/plates/. Takes
// are cut by `from` (seconds into the take) and play at `rate`. A placeholder shows a small corner tag so a review can
// tell real from stand-in; the final film has no placeholders.
import type { CSSProperties } from "react";
import { AbsoluteFill, getStaticFiles, Img, OffthreadVideo, staticFile } from "remotion";
import { Label } from "../ds/type";
import { T } from "../ds/tokens";

const has = (p: string) => getStaticFiles().some((x) => x.name === p);

export type SlotSource = { kind: "raw" | "preview"; path: string } | { kind: "plate"; path: string } | { kind: "none" };
export function slotSource(slot: string, plate?: string): SlotSource {
  if (has(`footage/raw/${slot}.mp4`)) return { kind: "raw", path: `footage/raw/${slot}.mp4` };
  if (has(`footage/preview/${slot}.mp4`)) return { kind: "preview", path: `footage/preview/${slot}.mp4` };
  if (plate && has(`plates/${plate}`)) return { kind: "plate", path: `plates/${plate}` };
  return { kind: "none" };
}

/** Fills its parent. `fit` cover by default; `crop` zooms into a region (x, y, w, h as fractions of the take). */
export function Slot({ slot, plate, from = 0, rate = 1, crop, style, tag = true }: {
  slot: string; plate?: string; from?: number; rate?: number; crop?: { x: number; y: number; w: number; h: number }; style?: CSSProperties; tag?: boolean;
}) {
  const src = slotSource(slot, plate);
  const zoom = crop ? { width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%`, position: "absolute" as const } : { width: "100%", height: "100%" };
  return (
    <AbsoluteFill style={{ background: T.ink, overflow: "hidden", ...style }}>
      {(src.kind === "raw" || src.kind === "preview") && (
        <OffthreadVideo src={staticFile(src.path)} muted startFrom={Math.round(from * 30)} playbackRate={rate} style={{ ...zoom, objectFit: "cover" }} />
      )}
      {src.kind === "plate" && <Img src={staticFile(src.path)} style={{ ...zoom, objectFit: "cover" }} />}
      {src.kind === "none" && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: `repeating-linear-gradient(90deg, rgba(196,182,255,0.06) 0 8px, rgba(196,182,255,0.02) 8px 16px), ${T.ink}` }}>
          <Label size={28} color={T.faint}>Take pending · {slot}</Label>
        </AbsoluteFill>
      )}
      {tag && src.kind !== "raw" && (
        <Label size={14} color={T.faint} style={{ position: "absolute", right: 14, bottom: 10, background: "rgba(10,8,20,0.7)", padding: "3px 8px", borderRadius: 3 }}>
          placeholder · {slot}
        </Label>
      )}
    </AbsoluteFill>
  );
}
