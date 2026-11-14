// Compositions: the full film (LastSave), each scene alone (Scenes/S01–S17), and the style frames.
// LastSaveX is the X cut (src/film/xcut.ts); the vertical is added once v1 is in.
import { Composition, Folder } from "remotion";
import { loadFilmFonts } from "./ds/tokens";
import { Film, XCut } from "./film/Film";
import { X_TOTAL } from "./film/xcut";
import { PLACED, TOTAL_FRAMES } from "./film/timeline";
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
      <Folder name="Scenes">
        {PLACED.map((s) => (
          <Composition key={s.id} id={s.id} component={SCENE_COMPONENTS[s.id]} durationInFrames={s.frames} fps={30} width={1920} height={1080} />
        ))}
      </Folder>
      <Folder name="StyleFrames">
        <Composition id="FrameA" component={FrameA} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="FrameB" component={FrameB} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="FrameC" component={FrameC} durationInFrames={120} fps={30} width={1920} height={1080} />
      </Folder>
    </>
  );
}
