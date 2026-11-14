// S01 (stub; replaced by its scene owner). Renders alone as composition S01; length from src/film/timeline.ts.
import { AbsoluteFill } from "remotion";
import { Display, Label } from "../../ds/type";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";

export function S01() {
  const s = scene("S01");
  return (
    <AbsoluteFill style={{ background: T.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <Label size={22} color={T.cyan}>{"// S01"}</Label>
      <Display size={120}>{s.name}</Display>
    </AbsoluteFill>
  );
}
