// S07 Any studio (10.4 s, V07 at 0.3 s). Opens where S06's roll lands: ScreenFrame "Terminal" with the `t-factory`
// take (the real `create_instance` for studio #2 "Tidebreak"). On "single transaction" the tx row lifts 1.3x and
// parks in the empty rows below the output; the `x-factory` flash (same global code hash, 0 access keys) lands on
// "born with no keys". Then the key art prints onto the screen and the camera pulls out of the glass to LS-0001
// floating in space at the frame-B pose (S08 opens on that pose).
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Camera, CONTENT, ScreenFrame } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { DeviceShot } from "./g3/Device";
import { FACTORY, S07_BEATS } from "./g3/factory";
import { Flash } from "./g3/Flash";
import { easeInOut, prog } from "./g3/motion";
import { LiftRow, TermTake } from "./g3/TermTake";

/** Ember Rift key art filling the screen content; `print` 0..1 prints it top to bottom (stepped). */
export function KeyArtScreen({ print = 1 }: { print?: number }) {
  return (
    <AbsoluteFill style={{ clipPath: print < 1 ? `inset(0 0 ${(1 - print) * 100}% 0)` : undefined }}>
      <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
    </AbsoluteFill>
  );
}

export function S07() {
  const f = useCurrentFrame();
  const s = scene("S07");
  const total = s.frames;
  const PULL = S07_BEATS.flash + 33;
  const push = 1 + 0.03 * prog(f, 0, S07_BEATS.flash) - 0.03 * prog(f, S07_BEATS.flash + 4, PULL - 2, easeInOut);
  const terminal = (
    <>
      <TermTake slot={FACTORY.slot} from={FACTORY.from} />
      <LiftRow f={f} at={S07_BEATS.tx} slot={FACTORY.slot} takeAt={FACTORY.tx.takeAt} y={FACTORY.tx.y} toY={FACTORY.parkY} />
    </>
  );

  if (f >= PULL) {
    const p = prog(f, PULL, total - 1, easeInOut);
    const print = stepped(prog(f, PULL, PULL + 8), 5);
    return (
      <DeviceShot p={p} at={s.from} title="Live match">
        {print < 1 && terminal}
        <KeyArtScreen print={print} />
      </DeviceShot>
    );
  }
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Camera scale={push} fx={960} fy={CONTENT.y + CONTENT.h / 2}>
        <ScreenFrame title="Terminal" mode="online">{terminal}</ScreenFrame>
      </Camera>
      <Flash f={f} at={S07_BEATS.flash} dur={33} slot="x-factory" path="testnet.nearblocks.io/address/…" />
    </AbsoluteFill>
  );
}
