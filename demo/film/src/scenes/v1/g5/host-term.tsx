// S13's terminal: the real `pnpm host` run on v2dev (t-host.mp4, a term.html replay) inside ScreenFrame "Fan host ·
// v2dev". Only what the take prints lifts off the glass, one line at a time, as ≥ 56 px film type held ≥ 45 f while the
// take goes to texture (the WARNING line stays visible as texture): the github-raw copy's sha256 match on "public copy"
// → "hash", the released-key commitment on "from day one", the progress snapshot on "progress", then register_host,
// which ends the scene and S14 dials into. One honest, labelled cut skips the ≈ 81 s tunnel wait.
// S14 renders this component at S13's last frame (`at`) for its first pose.
import { AbsoluteFill, Freeze, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Camera, ScreenFrame } from "../../../ds/screen";
import { Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { scene } from "../../../film/timeline";
import { Slot } from "../../../film/Slot";
import { HOST } from "./after";
import { TERM_CROP } from "./facts";

const HOST_VIDEO = HOST.video, HOST_CUT = HOST.cut, TERM_ROWS = HOST.rows, KEY_HOSTLINES = HOST.lines;
import { c, LiftPlate, out, ramp, Tag, word } from "./kit";

const W = (s: number) => word("S13", s);
const LAST = scene("S13").frames - 1;
/** Terminal on screen from here: the dial-up box opens into it. */
export const TERM_AT = 34;
/** In-point so the command line prints just before "command". */
const SEG1_FROM = Math.max(0, HOST_VIDEO.command - (W(1.2) - 3 - TERM_AT) / 30);
/** Take time (s) shown at scene frame f. */
const takeAt = (f: number) => (f < HOST_CUT.at ? SEG1_FROM + (f - TERM_AT) / 30 : HOST_CUT.to + (f - HOST_CUT.at) / 30);

/** The take fitted to the content height (868) and centred: its screen below the bar, scale 868/924. */
const BOX_H = 868;
const K = BOX_H / (TERM_CROP.h * 1080);
const BOX_W = Math.round(TERM_CROP.w * 1920 * K);
const BOX_X = Math.round((1878 - BOX_W) / 2);
/** Screen y of a take row (frame px). */
const rowY = (r: number) => 102 + (TERM_ROWS.y0 + r * TERM_ROWS.pitch - TERM_CROP.y * 1080) * K;
const LIFT_Y = 760; // screen-space centre of the lift band (TUNE)

type Kind = keyof typeof KEY_HOSTLINES;
interface Lift { kind: Kind; row: number; at: number; until: number }
const LIFTS: Lift[] = [
  { kind: "copy", row: TERM_ROWS.copy, at: W(2.66) - 3, until: W(4.46) + 3 }, // "public copy" → "hash"
  { kind: "released", row: TERM_ROWS.released, at: W(4.46) + 5, until: W(4.46) + 60 }, // "from day one"
  { kind: "snapshot", row: TERM_ROWS.snapshot, at: W(7.02) - 15, until: W(7.02) + 40 }, // "progress"
  { kind: "register", row: TERM_ROWS.register, at: HOST_CUT.at + 7, until: 1e6 }, // into S14
];
const SINK = 7;
const ticked = (t: string) => t.split("✓").flatMap((part, i) => (i ? [<span key={i} style={{ color: T.alive }}>✓</span>, part] : [part]));
const level = (f: number, l: Lift) => ramp(f, l.at, l.at + 10) * (1 - ramp(f, l.until, l.until + SINK));

function KeyLift({ l, f }: { l: Lift; f: number }) {
  const up = ramp(f, l.at, l.at + 10);
  const down = ramp(f, l.until, l.until + SINK);
  if (up <= 0 || down >= 1) return null;
  const y = interpolate(up, [0, 1], [rowY(l.row), LIFT_Y]) + down * 20;
  const lines = KEY_HOSTLINES[l.kind];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: Math.min(1, up * 3) * Math.max(0, 1 - 2 * down),
      transform: `translateY(-50%) scale(${interpolate(up, [0, 1], [0.43, 1])})` }}>
      <LiftPlate lift={up} edge={l.kind === "register" ? T.gold : T.alive} style={{ padding: "18px 40px 20px" }}>
        {lines.map((t, i) => <Mono key={i} size={56} style={{ lineHeight: 1.3, color: l.kind === "copy" && i === 1 ? T.alive : T.text }}>{ticked(t)}</Mono>)}
      </LiftPlate>
    </div>
  );
}

/** The take: two segments around the cut. With `at` (S14's frozen first pose) it shows that one frame. */
function Take({ at }: { at?: number }) {
  const slot = (from: number) => <Slot slot={HOST.slot} from={from} crop={TERM_CROP} />;
  if (at !== undefined) return <Freeze frame={0}>{slot(takeAt(at))}</Freeze>;
  return (
    <>
      <Sequence from={TERM_AT} durationInFrames={HOST_CUT.at - TERM_AT} layout="none">{slot(SEG1_FROM)}</Sequence>
      <Sequence from={HOST_CUT.at} layout="none">{slot(HOST_CUT.to)}</Sequence>
    </>
  );
}

/** ScreenFrame with the run, the lifted key lines and the cut label. */
export function HostTerminal({ at }: { at?: number }) {
  const now = useCurrentFrame();
  const f = at ?? now;
  const tex = Math.max(...LIFTS.map((l) => level(f, l)));
  const push = interpolate(f, [TERM_AT, LAST], [1, 1.04], { ...c, easing: out });
  return (
    <AbsoluteFill>
      <Camera scale={push} fx={960} fy={420}>
        <ScreenFrame title={HOST.title} mode="released" titleAt={TERM_AT - 4}>
          <div style={{ position: "absolute", left: BOX_X, top: 0, width: BOX_W, height: BOX_H, opacity: 1 - 0.6 * tex, filter: tex > 0.01 ? `blur(${(2 * tex).toFixed(2)}px)` : undefined }}>
            <Take at={at} />
          </div>
        </ScreenFrame>
      </Camera>
      {f >= HOST_CUT.at && <Tag color={T.cyan} size={26} style={{ position: "absolute", right: 64, top: 118 }}>{HOST_CUT.label}</Tag>}
      {LIFTS.map((l) => <KeyLift key={l.kind} l={l} f={f} />)}
    </AbsoluteFill>
  );
}
