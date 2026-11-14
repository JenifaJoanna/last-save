// S07 Any studio (10.4 s, V07 at 0.3 s). Opens where S06's roll lands: ScreenFrame "Terminal" with the `t-factory`
// take (the real `pnpm -s studio:launch tidebreak`), cut so its "launches" row prints on "launches" and the result
// block on "single transaction". Then the terminal drops to texture and the account line lifts off its row as 56 px
// film type; the `x-factory` flash opens behind it and, on "born", "access keys: 0 · born locked" lifts off its row. Both lines hold while the key art prints onto the screen
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
import { GRID, rowTop, TermCuts, TERM_K, termX, termY } from "./g3/TermTake";

const FLASH_DUR = 33;

/** Ember Rift key art filling the screen content; `print` 0..1 prints it top to bottom (stepped). */
export function KeyArtScreen({ print = 1 }: { print?: number }) {
  return (
    <AbsoluteFill style={{ clipPath: print < 1 ? `inset(0 0 ${(1 - print) * 100}% 0)` : undefined }}>
      <Img src={staticFile("plates/ember-rift-key.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
    </AbsoluteFill>
  );
}

/** The two S07 key lines, each lifted off its own row of the take; `f` may be offset by S08 to hold them across the seam. */
export function S07Lines({ f, out, push = 1 }: { f: number; out?: number; push?: number }) {
  const fy = CONTENT.y + CONTENT.h / 2;
  const at = (row: number) => ({ x: 960 + (CONTENT.x + termX(GRID.x0 + 2 * GRID.col) - 960) * push, y: fy + (CONTENT.y + termY(rowTop(row)) - fy) * push });
  const k0 = (GRID.size * TERM_K * push) / S07_SLOTS.size;
  return (
    <>
      <KeyLine f={f} at={S07_BEATS.account} from={at(FACTORY.rows.account)} fromScale={k0} to={S07_SLOTS.account} size={S07_SLOTS.size} accent={T.gold} out={out}>
        <span style={{ color: T.gold }}>{FACTORY.account.text}</span>  <span style={{ color: T.alive }}>{FACTORY.account.status}</span>
      </KeyLine>
      <KeyLine f={f} at={S07_BEATS.keys} from={at(FACTORY.rows.keys)} fromScale={k0} to={S07_SLOTS.keys} size={S07_SLOTS.size} accent={T.alive} out={out}>
        {KEYS_LINE.head}<span style={{ color: T.alive }}>{KEYS_LINE.tail}</span>
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
      <TermCuts slot={FACTORY.slot} cuts={FACTORY.cuts} end={total} />
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
