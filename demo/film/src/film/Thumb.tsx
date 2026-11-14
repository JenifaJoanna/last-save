// Thumbnails: YouTube 1280×720 and the X preview frame 1600×900, one design rendered at 1920×1080 (the film's scenes
// size themselves from the composition) and downscaled by scripts/thumbs.sh (both are 16:9).
// The hook sits on the void in the top half; the bottom half is a real frame of the film: S09's dead status screen
// held after "dead" (the red flatline with its sweep, the probe log ending STUDIO DECLARED GONE · DEAD, the dead sun).
// No run-specific numbers appear, so the thumbnails stay true after the judge run.
import { AbsoluteFill, Freeze } from "remotion";
import { CrtLayers } from "../ds/crt";
import { Display, Label } from "../ds/type";
import { T } from "../ds/tokens";
import { S09 } from "../scenes/v1/S09";
import { S9 } from "../scenes/v1/g4/t09";

/** S09 frame used: after the flicker dips, with the log (1 counted probe failure, holder reports, quorum, DEAD) complete. */
export const THUMB_FRAME = S9.alert + 24; // the DEAD row fully printed; the alert card (its real posted title) has landed

export function ThumbArt() {
  return (
    <AbsoluteFill style={{ background: T.void, overflow: "hidden" }}>
      {/* S09 shifted down 130 px: its GONE DARK title falls under the void band; the flatline, sun and probe log stay */}
      <AbsoluteFill style={{ transform: "translateY(130px)" }}>
        <Freeze frame={THUMB_FRAME}><S09 /></Freeze>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${T.void} 0%, ${T.void} 44%, rgba(10,8,20,0.88) 50%, rgba(10,8,20,0) 56%)` }} />
      <div style={{ position: "absolute", left: 92, top: 76 }}>
        <Display size={170} tone="dead">{"We killed\nour server."}</Display>
      </div>
      <Label size={44} color={T.gold} track={0.12} weight={700} style={{ position: "absolute", left: 98, top: 418 }}>You still have the game.</Label>
      <div style={{ position: "absolute", right: 64, top: 64, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 14, height: 14, borderRadius: 7, background: T.dead, boxShadow: `0 0 14px ${T.dead}` }} />
        <Label size={30} color={T.text} track={0.18}>Last Save · NEAR</Label>
      </div>
      <CrtLayers />
    </AbsoluteFill>
  );
}
