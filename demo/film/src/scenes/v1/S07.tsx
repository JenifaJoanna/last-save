// S07 Any studio (10.4 s, V07 at 0.3 s). Opens where S06's roll lands: ScreenFrame "Terminal" with the `t-factory`
// take (the real `create_instance` for studio #2 "Tidebreak"). On "single transaction" the terminal drops to texture
// and the new instance account lifts off its line as 56 px film type; the `x-factory` flash opens behind it and, on
// "born with no keys", "0 access keys" lifts off the explorer. Both lines hold while the key art prints onto the screen
// and the camera pulls out of the glass to LS-0001 in space (frame-B pose); S08 opens on that pose and steps them out.
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Camera, CONTENT, ScreenFrame } from "../../ds/screen";
import { stepped, T } from "../../ds/tokens";
import { scene } from "../../film/timeline";
import { TEXTURE } from "./g3/attack";
import { DeviceShot } from "./g3/Device";
import { FACTORY, KEYS_LINE, S07_BEATS, S07_SLOTS } from "./g3/factory";
import { Flash } from "./g3/Flash";
import { KeyLine } from "./g3/KeyLine";
import { easeInOut, lerp, prog } from "./g3/motion";
import { TermTake, TERM_K, termX, termY } from "./g3/TermTake";

const FLASH_DUR = 33;

/** Ember Rift key art filling the screen content; `print` 0..1 prints it top to bottom (stepped). */
export function KeyArtScreen({ print = 1 }: { print?: number }) {
  return (
    <AbsoluteFill style={{ clipPath: print < 1 ? `inset(0 0 ${(1 - print) * 100}% 0)` : undefined }}>
      <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
    </AbsoluteFill>
  );
}

/** The two S07 key lines; `f` may be negative-offset by S08 to keep them on screen across the seam. */
export function S07Lines({ f, out, push = 1 }: { f: number; out?: number; push?: number }) {
  const fy = CONTENT.y + CONTENT.h / 2;
  const acc = { x: 960 + (CONTENT.x + termX(196) - 960) * push, y: fy + (CONTENT.y + termY(FACTORY.account.y) - fy) * push };
  return (
    <>
      <KeyLine f={f} at={S07_BEATS.account} from={acc} fromScale={(26 * TERM_K * push) / S07_SLOTS.size} to={S07_SLOTS.account} size={S07_SLOTS.size} accent={T.gold} out={out}>
        {FACTORY.account.text}
      </KeyLine>
      <KeyLine f={f} at={S07_BEATS.keys} from={{ x: 700, y: 480 }} fromScale={0.4} to={S07_SLOTS.keys} size={S07_SLOTS.size} accent={T.gold} out={out}>
        <span style={{ color: T.gold, fontWeight: 600 }}>{KEYS_LINE.zero}</span>{KEYS_LINE.rest}
      </KeyLine>
    </>
  );
}

export function S07() {
  const f = useCurrentFrame();
  const s = scene("S07");
  const total = s.frames;
  const PULL = S07_BEATS.flash + FLASH_DUR;
  const push = 1 + 0.03 * prog(f, 0, S07_BEATS.flash) - 0.03 * prog(f, S07_BEATS.flash + 4, PULL - 2, easeInOut);
  const texture = stepped(prog(f, S07_BEATS.account - 4, S07_BEATS.account + 2), 3);
  const terminal = (
    <AbsoluteFill style={{ opacity: lerp(1, TEXTURE.opacity, texture), filter: texture > 0 ? `blur(${TEXTURE.blur * texture}px)` : undefined }}>
      <TermTake slot={FACTORY.slot} from={FACTORY.from} />
    </AbsoluteFill>
  );

  if (f >= PULL) {
    const p = prog(f, PULL, total - 1, easeInOut);
    const print = stepped(prog(f, PULL, PULL + 8), 5);
    return (
      <AbsoluteFill>
        <DeviceShot p={p} at={s.from} title="Live match">
          {print < 1 && terminal}
          <KeyArtScreen print={print} />
        </DeviceShot>
        <S07Lines f={f} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: T.void }}>
      <Camera scale={push} fx={960} fy={CONTENT.y + CONTENT.h / 2}>
        <ScreenFrame title="Terminal" mode="online">{terminal}</ScreenFrame>
      </Camera>
      <Flash f={f} at={S07_BEATS.flash} dur={FLASH_DUR} slot="x-factory" path="testnet.nearblocks.io/address/…" dim={stepped(prog(f, S07_BEATS.keys - 2, S07_BEATS.keys + 4), 3)} />
      <S07Lines f={f} push={push} />
    </AbsoluteFill>
  );
}
