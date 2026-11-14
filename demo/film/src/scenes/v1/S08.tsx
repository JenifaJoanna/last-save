// S08 (stub; replaced by its scene owner). Renders alone as composition S08; length from src/film/timeline.ts.
import { AbsoluteFill } from "remotion";
import { Display, Label } from "../../ds/type";
import { T } from "../../ds/tokens";
import { scene } from "../../film/timeline";

export function S08() {
  const s = scene("S08");
  return (
    <AbsoluteFill style={{ background: T.ink, alignItems: "center", justifyContent: "center", gap: 24 }}>
      <Label size={22} color={T.cyan}>{"// S08"}</Label>
      <Display size={120}>{s.name}</Display>
    </AbsoluteFill>
  );
}
