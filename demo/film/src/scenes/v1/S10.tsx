// S10 Release (5.4 s, V09 from 0.4 s). Hard cut to gold: the release take in the gold ScreenFrame → on "confirms" the
// OutLayer receipt flashes (dial-up in, CRT collapse out) → on "releases the server" the take dims, RELEASED prints in
// gold bands and the server key lifts off the escrow card, decoding from hex at 18 ms per char → end pose: the key
// centred on the gold screen (g4/facts.ts KEY_POSE), which S11 splits into four rows.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ScreenFrame } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { RELEASE_FROM, TAKE_KEY } from "./g4/facts";
import { lin, SlotAt } from "./g4/kit";
import { KeyLift, ReceiptFlash, S10T } from "./g4/Release";

const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };

export function S10() {
  const f = useCurrentFrame();
  const drift = lin(f, 0, 162, 1, 1.035);
  const dim = 1 - 0.86 * stepped(lin(f, S10T.lift, S10T.lift + 12), 5);
  const gone = 1 - stepped(lin(f, S10T.settle, S10T.settle + 12), 5); // the take prints out to the bare ink screen
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <ScreenFrame title="Licence status" mode="released">
        <AbsoluteFill style={{ filter: `brightness(${dim})`, opacity: gone }}>
          <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: `${TAKE_KEY.x}px ${TAKE_KEY.y}px` }}>
            <SlotAt at={0} slot="release" plate="status-released.png" from={RELEASE_FROM} crop={CONTENT_CROP} />
          </AbsoluteFill>
        </AbsoluteFill>
        <KeyLift />
      </ScreenFrame>
      <ReceiptFlash />
    </AbsoluteFill>
  );
}
