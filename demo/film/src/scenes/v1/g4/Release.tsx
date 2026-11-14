// S10 pieces: the x-release flash (the instance's release state read from the chain over public RPC, ~1 s, dial-up in, CRT
// collapse out at half speed) and the released key lifted off the take's escrow card as recorded (no decode replay):
// its two rows grow to 56 px, hold, then join into S11's one 36 px line.
import { useCurrentFrame } from "remotion";
import { Display, Eyebrow, Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { KEY_POSE, RELEASED_KEY, R, S10_TAKES, TAKE_KEY, XREL } from "./facts";
import { CrtWindow, DialBox, lin, out, printIn, SlotAt } from "./kit";

export const S10T = {
  dial: R.confirms - 24, //  dial-up box for the chain read
  flash: R.confirms - 2, //  x-release window open on "confirms" (1 s)
  flashOut: R.confirms + 28, // CRT collapse at half speed (20 f)
  lift: R.releases - 3, //   the key rows lift to 56 px; RELEASED prints
  settle: 148, //           rows join into one 36 px line; RELEASED and the take print out (S11's first pose)
};

export function ReceiptFlash() {
  const W = { w: 1500, h: Math.round((1500 * XREL.crop.h * 1080) / (XREL.crop.w * 1920)) };
  return (
    <>
      <DialBox at={S10T.dial} path={S10_TAKES.dial} s={1.9} />
      <CrtWindow open={S10T.flash} close={S10T.flashOut} dur={20} x={(1920 - W.w) / 2} y={500 - W.h / 2} w={W.w} h={W.h} tilt={6}
        style={{ border: `1px solid ${T.line2}`, boxShadow: "0 40px 120px rgba(0,0,0,0.75)", background: T.ink }}>
        <SlotAt at={S10T.flash} slot={S10_TAKES.xrelease} from={XREL.from} crop={XREL.crop} tag={false} />
      </CrtWindow>
    </>
  );
}

const BIG = 56;
const CH = (size: number) => size * 0.6; // Plex Mono advance
/** One key row: from the take's escrow card (content px) to its 56 px place; at the settle both rows shrink to 36 px
 * stacked at the line's left edge, then row 2 slides right under row 1 and both close up to
 * one line (no overlap on the way); settled by f161. */
function Row({ text, i, f }: { text: string; i: number; f: number }) {
  const lx = 960 - (RELEASED_KEY.length * CH(KEY_POSE.size)) / 2 - 21, ly = KEY_POSE.cy - 102, ss = KEY_POSE.size / BIG;
  const take = { x: TAKE_KEY.x - 21, y: TAKE_KEY.y[i] - 102, s: TAKE_KEY.size / BIG };
  const big = { x: 960 - (TAKE_KEY.wrap * CH(BIG)) / 2 - 21, y: 556 + i * 68 - 102, s: 1 };
  const mid = { x: lx, y: ly + (i ? 24 : -24), s: ss };
  const line = { x: lx + i * TAKE_KEY.wrap * CH(KEY_POSE.size), y: ly, s: ss };
  const a = lin(f, S10T.lift + 2 * i, S10T.lift + 16 + 2 * i, 0, 1, out);
  const b = lin(f, S10T.settle, S10T.settle + 6, 0, 1, out);
  const c = { x: lin(f, S10T.settle + 5, S10T.settle + 10, 0, 1, out), y: lin(f, S10T.settle + 9, S10T.settle + 13, 0, 1, out), s: 1 };
  const m = (k: "x" | "y" | "s") => take[k] + (big[k] - take[k]) * a + (mid[k] - big[k]) * b + (line[k] - mid[k]) * c[k];
  return (
    <div style={{ position: "absolute", left: m("x"), top: m("y"), transform: `translateY(-50%) scale(${m("s")})`, transformOrigin: "0 50%", opacity: printIn(f, S10T.lift + 2 * i) }}>
      <Mono size={BIG} weight={500} color={KEY_POSE.color} style={{ lineHeight: 1.2, textShadow: "0 0 18px rgba(255,201,74,0.45)" }}>{text}</Mono>
    </div>
  );
}

/** RELEASED above the key rows as recorded on-chain; at the settle only the eyebrow and the one-line key remain. */
export function KeyLift() {
  const f = useCurrentFrame();
  if (f < S10T.lift) return null;
  const tp = printIn(f, S10T.lift + 2) * (1 - printIn(f, S10T.settle));
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 118, display: "flex", justifyContent: "center", opacity: tp, transform: `translateY(${(1 - tp) * -10}px)` }}>
        <Display size={150} tone="gold">Released</Display>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: KEY_POSE.eyebrowTop, display: "flex", justifyContent: "center", opacity: printIn(f, S10T.lift + 6) }}>
        <Eyebrow size={22} color={T.cyan}>Server key · decoded on-chain</Eyebrow>
      </div>
      <Row text={RELEASED_KEY.slice(0, TAKE_KEY.wrap)} i={0} f={f} />
      <Row text={RELEASED_KEY.slice(TAKE_KEY.wrap)} i={1} f={f} />
    </>
  );
}
