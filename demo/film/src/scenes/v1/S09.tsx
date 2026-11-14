// S09 (stub; replaced by its scene owner). Renders alone as composition S09; length from src/film/timeline.ts.
import { AbsoluteFill } from "remotion";
import { Display, Label } from "../../ds/type";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";

export function S09() {
  const s = scene("S09");
  return (
    <AbsoluteFill style={{ background: T.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <Label size={22} color={T.cyan}>{"// S09"}</Label>
      <Display size={120}>{s.name}</Display>
    </AbsoluteFill>
  );
}
