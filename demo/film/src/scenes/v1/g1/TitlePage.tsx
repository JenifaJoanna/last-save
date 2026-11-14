// The title page S02 builds and S03 scrolls away: Ember Rift key art drifting under an ink veil, LAST SAVE in the
// Archivo display (cream until the sunset bands sweep across it) and the gold eyebrow. Fills the content rect (W × H).
import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { Display, Label } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { H, W } from "./kit";

export const TITLE_SIZE = 170; // content px: ≈220 px on screen inside the glass, 170 px once the bezel is in view
/** Frames from S02's first frame to S03's last: the art drifts across both scenes without a reset. */
const DRIFT_SPAN = 582;

export function TitlePage({ t, veil, title, bands, eyebrow, style }: {
  /** frames since S02 f0 (S03 passes 204 + its frame) */ t: number;
  /** ink veil opacity over the art */ veil: number;
  /** print-in style for the title, or null before it prints */ title: CSSProperties | null;
  /** 0..1 sweep of the sunset bands, left to right */ bands: number;
  eyebrow: CSSProperties | null;
  style?: CSSProperties;
}) {
  const d = Math.min(1, Math.max(0, t / DRIFT_SPAN));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", background: T.ink, ...style }}>
      <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${1.06 + 0.07 * d}) translate(${-26 * d}px, ${-8 * d}px)`, transformOrigin: "62% 50%" }} />
      <div style={{ position: "absolute", inset: 0, background: T.ink, opacity: veil }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {title && (
          <div style={{ position: "relative", ...title }}>
            <Display size={TITLE_SIZE} tone="cream">LAST SAVE</Display>
            <div style={{ position: "absolute", left: 0, top: 0, clipPath: `inset(-40px ${(1 - bands) * 100}% -40px -40px)` }}>
              <Display size={TITLE_SIZE} tone="sunset">LAST SAVE</Display>
            </div>
          </div>
        )}
        {eyebrow && (
          <div style={{ marginTop: 52, ...eyebrow }}>
            <Label size={26} color={T.gold} track={0.18}>A game licence that outlives its publisher</Label>
          </div>
        )}
      </div>
    </div>
  );
}
