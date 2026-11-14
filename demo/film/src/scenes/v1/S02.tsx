// S02 Title (0–204). f0 = S01's end pose: the gold caret alone at the screen centre, inside the glass.
// f0–5 the caret stretches into a 1-px bright line; f5–14 the line opens vertically onto the Ember Rift key art (CRT
// power-on, ease-out) with a bloom that cools. f16–71 the boot log prints a line every 11 f (the app's Boot). f76 the
// log clears; f82 LAST SAVE prints (2 f before "Last"); f116 the eyebrow prints ("licence" f118); f141–153 the sunset
// bands sweep across the title ("outlives" f143). f150–186 the camera pulls back from the glass to the full bezel while
// the status title decodes to HOME. End pose: settled ScreenFrame (scale 1, HOME, online) with the title page.
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { Mono } from "../../ds/type";
import { stepped, T } from "../../ds/tokens";
import { blink, CARET_CENTER, CARET_H, CW, easeOut, GoldCaret, Glass, H, mix, printIn, ramp, S01_END_SCALE, W } from "./g1/kit";
import { BOOT_LINES } from "./g1/copy";
import { TitlePage } from "./g1/TitlePage";

const BOOT_AT = 16;
const BOOT_STEP = 11;
const BOOT_SIZE = 22;
const BOOT_LH = 44;
const PULL = [150, 186] as const;
/** Ink veil over the art: heavier under the boot log, lighter for the title. Exported for S03's first frame. */
export const S02_END_VEIL = 0.58;

function BootLog({ f }: { f: number }) {
  const shown = BOOT_LINES.filter((_, i) => f >= BOOT_AT + i * BOOT_STEP).length;
  const clear = stepped(ramp(f, 76, 82), 5);
  if (f < BOOT_AT - 4 || clear >= 1) return null;
  const top = H - 96 - (BOOT_LINES.length + 1) * BOOT_LH;
  return (
    <div style={{ position: "absolute", left: 330, top, opacity: 1 - clear }}>
      {BOOT_LINES.slice(0, shown).map((l) => <Mono key={l} size={BOOT_SIZE} color={T.gold} style={{ height: BOOT_LH, lineHeight: `${BOOT_LH}px` }}>{l}</Mono>)}
      <div style={{ position: "relative", height: BOOT_LH }}>
        <GoldCaret x={0} y={(BOOT_LH - BOOT_SIZE * 1.18) / 2} w={BOOT_SIZE * 0.6} h={BOOT_SIZE * 1.18} opacity={blink(f, BOOT_AT + shown * BOOT_STEP)} glow={0.2} />
      </div>
    </div>
  );
}

export function S02() {
  const f = useCurrentFrame();
  const inGlass = S01_END_SCALE + 0.02 * Math.min(1, f / PULL[0]);
  const scale = mix(inGlass, 1, ramp(f, PULL[0], PULL[1], easeOut));

  // CRT power-on: caret → horizontal line (f0–5) → vertical open (f5–14).
  const stretch = ramp(f, 0, 5, easeOut);
  const open = ramp(f, 5, 14, easeOut);
  const lineW = mix(CW, W, stretch);
  const lineH = mix(CARET_H, 2, stretch);
  const lineFade = 1 - ramp(f, 9, 16);
  const bloom = 0.85 * (1 - ramp(f, 6, 20));
  const veil = f < 76 ? 0.66 : mix(0.66, S02_END_VEIL, ramp(f, 76, 90));

  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Glass scale={scale} titleAt={PULL[0]}>
        {f >= 5 && (
          <div style={{ position: "absolute", inset: 0, transform: `scaleY(${mix(0.004, 1, open)})`, filter: `brightness(${1 + bloom * 0.5})` }}>
            <TitlePage t={f} veil={veil} title={f >= 82 ? printIn(f, 82) : null} bands={stepped(ramp(f, 141, 153), 8)} eyebrow={f >= 116 ? printIn(f, 116) : null} />
            <BootLog f={f} />
            <div style={{ position: "absolute", inset: 0, background: T.text, opacity: bloom * 0.28, mixBlendMode: "screen" }} />
          </div>
        )}
        {lineFade > 0 && (
          <GoldCaret x={W / 2 - lineW / 2} y={CARET_CENTER.y + CARET_H / 2 - lineH / 2} w={lineW} h={lineH} opacity={lineFade}
            color={interpolateColors(stretch, [0, 1], [T.gold, T.text])} glow={0.35 + 0.4 * stretch} />
        )}
      </Glass>
    </AbsoluteFill>
  );
}
