// S10 Release (5.4 s, V09 from 0.4 s). Hard cut to gold: a real release (g4/facts.ts RELEASE_INSTANCE), as recorded (the release
// moment is not replayed): its /status take in the gold ScreenFrame → on "confirms" the chain read flashes (get_info
// over public RPC: status Dead, its cause, released_key) → on "releases the server" the take dims, RELEASED prints in
// gold bands and the key's two rows lift off the escrow card to 56 px → they join into one 36 px line, the end pose
// S11 opens on (g4/facts.ts KEY_POSE). The instance banner and chip are added by withInstance (scenes/v1/index.ts).
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ScreenFrame } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { RELEASE_FROM, S10_TAKES, TAKE_KEY } from "./g4/facts";
import { lin, SlotAt } from "./g4/kit";
import { KeyLift, ReceiptFlash, S10T } from "./g4/Release";

const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };

export function S10() {
  const f = useCurrentFrame();
  const drift = lin(f, 0, 162, 1, 1.035);
  const dim = 1 - 0.92 * stepped(lin(f, S10T.lift, S10T.lift + 12), 5);
  const gone = 1 - stepped(lin(f, S10T.settle, S10T.settle + 12), 5); // the take prints out to the bare ink screen
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <ScreenFrame title="Licence status" mode="released">
        <AbsoluteFill style={{ filter: `brightness(${dim})`, opacity: gone }}>
          <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: `${TAKE_KEY.x - 21}px ${TAKE_KEY.y[0] - 102}px` }}>
            <SlotAt at={0} slot={S10_TAKES.release} plate="status-released.png" from={RELEASE_FROM} crop={CONTENT_CROP} />
          </AbsoluteFill>
        </AbsoluteFill>
        <KeyLift />
      </ScreenFrame>
      <ReceiptFlash />
    </AbsoluteFill>
  );
}
