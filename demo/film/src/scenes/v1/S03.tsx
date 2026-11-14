// S03 Why (0–378). f0 = S02's end pose (full bezel, HOME, title page). f0–22 the page scrolls up like a teleprompter
// (ease-out) while the status title decodes to WHY STUDIOS OPT IN and the camera creeps +2 %. Three European
// Commission cards from IP/26/1369 follow, one on screen at a time, each scrolling the last one up and out:
//   card 1 head f22, lead types f26–83, key words print f90 ("law" f94), ember underline f104
//   card 2 scrolls in f148–164, prints f160–164 ("code" f169), underline f176, C(2026)4110 note types f206 ("Last Save" f209)
//   card 3 scrolls in f260–276, line 1 f274, "proportionate refund" prints f308, gold block grows f315–329 ("refund" f315)
// Camera (all ease-out): push into the glass f20–58, drift +4 % inside, pull back to the bezel f336–374.
// End pose: settled ScreenFrame (scale 1, WHY STUDIOS OPT IN, online, HOME hints/keys) with card 3, "refund" in gold.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { T } from "../../ds/tokens";
import { CardPage } from "./g1/Card";
import { EC_CARDS } from "./g1/copy";
import { cl, easeOut, Glass, H, IN_GLASS, mix, printIn, ramp } from "./g1/kit";
import { TitlePage } from "./g1/TitlePage";
import { S02_END_VEIL } from "./S02";

const S02_LEN = 204;
const SCROLLS: [number, number][] = [[0, 22], [148, 164], [260, 276]];
const TITLE = "WHY STUDIOS OPT IN";

export function S03() {
  const f = useCurrentFrame();
  // the first scroll leaves S02's held title page, so it eases in as well as out (no frame-1 jump at the seam)
  const page = SCROLLS.reduce((n, [a, b]) => n + ramp(f, a, b, a === 0 ? Easing.bezier(0.65, 0, 0.35, 1) : easeOut), 0);
  // Hold the bezel while the status title decodes, push through the glass (chrome leaves frame mid-move, never on a
  // hold), drift inside, then pull back out to the bezel for the end pose.
  const inGlass = mix(1.02, IN_GLASS, ramp(f, 20, 58, easeOut)) + interpolate(f, [58, 336], [0, 0.04], cl);
  const scale = mix(f < 20 ? mix(1, 1.02, f / 20) : inGlass, 1, ramp(f, 336, 374, easeOut));
  const settled = printIn(9999, 0);

  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Glass scale={scale} title={f < 2 ? "HOME" : TITLE} titleAt={2}>
        <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", transform: `translateY(${-H * page}px)` }}>
          {page < 1 && <TitlePage t={S02_LEN + f} veil={S02_END_VEIL} title={settled} bands={1} eyebrow={settled} />}
          {EC_CARDS.map((c, i) => Math.abs(page - (i + 1)) < 1 && <CardPage key={c.eyebrow} f={f} spec={c} top={H * (i + 1)} />)}
        </div>
      </Glass>
    </AbsoluteFill>
  );
}
