// Which instance a scene shows. The judge instance ember-rift is launched, played, killed and declared dead on camera
// (S01–S09, S11). Its key release could not complete tonight (its release program reads the chain through public RPCs
// that were rate-limiting), so S10 and S13–S16 show the dev instance v2dev's REAL afterlife on the same global code:
// its OutLayer release, fan host, epoch claim and Base payout on 14 Nov (v2dev has no Walrus/Archive copy). Every frame of those
// scenes says so: S10 opens with a banner, and a corner chip stays on S10 and S13–S16 in every cut (S12, ember-rift's stored build, carries its own) (the vertical shows
// it in its own header instead, since its band crops the frame's edges).
import { createContext, useContext, type FC, type ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Label } from "../ds/type";
import { stepped, T } from "../ds/tokens";

export const INSTANCE_BANNER = "Real OutLayer release · dev instance v2dev · same code · 14 Nov";
export const INSTANCE_CHIP = "v2dev · same code · real release 14 Nov";
/** S11 returns to the judge instance (its holders choose after the kill), so it says so too. */
export const JUDGE_CHIP = "ember-rift · judge instance · holders choose";
/** Which instance the story's second half shows. "split" (shipped 15 Nov 01:41): v2dev's 14 Nov afterlife in S10 and
 * S13–S16. "ember-rift": the judge instance end to end, after its key was released at 01:05 IST (release, host, back),
 * with only S15's payout still v2dev's real 14 Nov record, so only S15 carries a v2dev chip. */
export const STORY: "split" | "ember-rift" = "split";
/** Scenes whose run values and takes come from v2dev (src/film/run-facts-after.json). */
export const AFTER_SCENES = new Set(STORY === "split" ? ["S10", "S13", "S14", "S15", "S16"] : ["S15"]);
export const PAYOUT_CHIP = "v2dev · same code · real Base payout 14 Nov";
/** S12 shows ember-rift's encrypted build, stored for good and waiting for its key. */
export const JUDGE_STORED_CHIP = "ember-rift · judge instance · build stored, key not yet released";

/** false inside the vertical cut, which draws the chip in its own header. */
export const ChipInFrame = createContext(true);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The persistent chip, bottom-left under the screen's hint row (raised where a full-frame game HUD sits there). */
export function InstanceChip({ bottom = 14, left = 24, text = INSTANCE_CHIP }: { bottom?: number; left?: number; text?: string }) {
  return (
    <div style={{ position: "absolute", left, bottom, display: "flex", alignItems: "center", gap: 10, padding: "6px 12px",
      background: "rgba(18,14,34,0.86)", border: `1px solid ${T.line2}`, borderRadius: 3 }}>
      <div style={{ width: 9, height: 9, borderRadius: 5, background: T.gold, boxShadow: `0 0 8px ${T.gold}` }} />
      <Label size={20} color={T.text} track={0.12}>{text}</Label>
    </div>
  );
}

/** S10's opening banner: the instance switch stated in full, readable at phone size, for 2.5 s. */
function Banner() {
  const f = useCurrentFrame();
  const o = stepped(interpolate(f, [0, 6], [0, 1], clamp), 3) * interpolate(f, [75, 84], [1, 0], clamp);
  if (o <= 0) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 150, opacity: o }}>
      <div style={{ padding: "16px 28px", background: "rgba(10,8,20,0.92)", border: `1px solid ${T.gold}`, borderRadius: 3,
        boxShadow: "0 0 40px rgba(255,201,74,0.18)" }}>
        <Label size={36} color={T.gold} track={0.08} weight={700}>{INSTANCE_BANNER}</Label>
      </div>
    </AbsoluteFill>
  );
}

/** Wraps a scene component so it carries the instance label wherever it plays (full film, X cut, scene comps). */
export function withInstance(Scene: FC, opts: { banner?: boolean; chipBottom?: number; text?: string } = {}): FC {
  const Wrapped: FC = () => {
    const inFrame = useContext(ChipInFrame);
    return (
      <AbsoluteFill>
        <Scene />
        {inFrame && opts.banner && <Banner />}
        {inFrame && <InstanceChip bottom={opts.chipBottom} text={opts.text} />}
      </AbsoluteFill>
    );
  };
  Wrapped.displayName = `withInstance(${Scene.displayName ?? Scene.name})`;
  return Wrapped;
}

export function NoChip({ children }: { children: ReactNode }) {
  return <ChipInFrame.Provider value={false}>{children}</ChipInFrame.Provider>;
}
