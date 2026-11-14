// Compositions: the full film (LastSave), each scene alone (Scenes/S01–S17), and the style frames.
// LastSaveX is the X cut (src/film/xcut.ts); LastSaveVertical the 45 s vertical (src/film/Vertical.tsx).
import { Composition, Folder } from "remotion";
import { loadFilmFonts } from "./ds/tokens";
import { Film, XCut } from "./film/Film";
import { Vertical, VERTICAL_FRAMES } from "./film/Vertical";
import { X_TOTAL } from "./film/xcut";
import { XOPEN, XOpen } from "./film/XOpen";
import { ThumbArt } from "./film/Thumb";
import { f, PLACED, TOTAL_FRAMES } from "./film/timeline";
import { FrameA } from "./frames/FrameA";
import { FrameB } from "./frames/FrameB";
import { FrameC } from "./frames/FrameC";
import { SCENE_COMPONENTS } from "./scenes/v1";

loadFilmFonts();

export function Root() {
  return (
    <>
      <Composition id="LastSave" component={Film} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="LastSaveX" component={XCut} durationInFrames={X_TOTAL} fps={30} width={1920} height={1080} />
      <Composition id="LastSaveVertical" component={Vertical} durationInFrames={VERTICAL_FRAMES} fps={30} width={1080} height={1920} />
      <Folder name="Scenes">
        <Composition id="XO" component={XOpen} durationInFrames={f(XOPEN.dur)} fps={30} width={1920} height={1080} />
        {PLACED.map((s) => (
          <Composition key={s.id} id={s.id} component={SCENE_COMPONENTS[s.id]} durationInFrames={s.frames} fps={30} width={1920} height={1080} />
        ))}
      </Folder>
      <Folder name="Thumbnails">
        <Composition id="Thumb" component={ThumbArt} durationInFrames={600} fps={30} width={1920} height={1080} />
      </Folder>
      <Folder name="StyleFrames">
        <Composition id="FrameA" component={FrameA} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="FrameB" component={FrameB} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="FrameC" component={FrameC} durationInFrames={120} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
}
