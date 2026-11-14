// S13 (stub; replaced by its scene owner). Renders alone as composition S13; length from src/film/timeline.ts.
import { AbsoluteFill } from "remotion";
import { Display, Label } from "../../ds/type";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";

export function S13() {
  const s = scene("S13");
  return (
    <AbsoluteFill style={{ background: T.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <Label size={22} color={T.cyan}>{"// S13"}</Label>
      <Display size={120}>{s.name}</Display>
    </AbsoluteFill>
  );
}
