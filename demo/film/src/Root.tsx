import { AbsoluteFill, Audio, Composition, Folder, getStaticFiles, Sequence, staticFile } from "remotion";
import { Film, Footage } from "./Film";
import { loadFilmFonts } from "./ds/tokens";
import { FrameA } from "./frames/FrameA";
import { FrameB } from "./frames/FrameB";
import { FrameC } from "./frames/FrameC";

loadFilmFonts();
import { C, chakra, s } from "./theme";
import { TOTAL, VERTICAL } from "./timeline";

const has = (p: string) => getStaticFiles().some((f) => f.name === p);

function Vertical() {
  let t = 0;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {VERTICAL.map((v) => {
        const start = t;
        t += v.dur;
        return (
          <Sequence key={v.id} from={s(start)} durationInFrames={s(v.dur)} name={v.id}>
            <div style={{ position: "absolute", top: 420, left: 0, width: 1080, height: 608, overflow: "hidden" }}><Footage file={v.file} /></div>
            <div style={{ position: "absolute", top: 1140, left: 70, right: 70, fontFamily: chakra, fontSize: 52, lineHeight: 1.2, color: C.text, fontWeight: 600 }}>{v.caption}</div>
            {v.vo && has(`vo/${v.vo}.mp3`) && <Audio src={staticFile(`vo/${v.vo}.mp3`)} />}
          </Sequence>
        );
      })}
      <div style={{ position: "absolute", top: 140, left: 70, fontFamily: chakra, fontSize: 40, letterSpacing: 8, color: C.ember }}>LAST SAVE</div>
    </AbsoluteFill>
  );
}

export function Root() {
  return (
    <>
      <Composition id="LastSave" component={Film} durationInFrames={s(TOTAL)} fps={30} width={1920} height={1080} />
      <Folder name="StyleFrames">
        <Composition id="FrameA" component={FrameA} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="FrameB" component={FrameB} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="FrameC" component={FrameC} durationInFrames={120} fps={30} width={1920} height={1080} />
      </Folder>
      <Composition id="LastSaveVertical" component={Vertical} durationInFrames={s(VERTICAL.reduce((n, v) => n + v.dur, 0))} fps={30} width={1080} height={1920} />
    </>
  );
}
