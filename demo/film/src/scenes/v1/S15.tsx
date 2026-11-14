// S15 (stub; replaced by its scene owner). Renders alone as composition S15; length from src/film/timeline.ts.
import { AbsoluteFill } from "remotion";
import { Display, Label } from "../../ds/type";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";

export function S15() {
  const s = scene("S15");
  return (
    <AbsoluteFill style={{ background: T.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <Label size={22} color={T.cyan}>{"// S15"}</Label>
      <Display size={120}>{s.name}</Display>
    </AbsoluteFill>
  );
}
