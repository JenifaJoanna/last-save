// S12's key line: the stored (encrypted) build's sha256 = the on-chain value, 56 px film type in a screen-space band
// below the plinths and the flashes (g5's ShaKeyLine construction, with the judge instance's encrypted-artifact hash).
import { interpolate } from "remotion";
import { Mono } from "../../../ds/type";
import { T } from "../../../ds/tokens";
import { rs, shortHash } from "../../../film/run";
import { LAYOUT } from "../g5/facts";
import { c, LiftPlate, printIn, ramp } from "../g5/kit";

export function StoredShaLine({ f, at, out }: { f: number; at: number; out: number }) {
  const up = ramp(f, at, at + 10);
  const gone = interpolate(f, [out, out + 8], [0, 1], c);
  if (up <= 0 || gone >= 1) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: LAYOUT.s12LineY, display: "flex", justifyContent: "center",
      transform: `translateY(${-50 + (1 - up) * 20}%)`, opacity: Math.min(1, up * 2) * (1 - gone) }}>
      <LiftPlate lift={up} edge={T.gold} style={{ padding: "16px 40px 18px", clipPath: `inset(0 ${(1 - printIn(f, at)) * 100}% 0 0)` }}>
        <Mono size={56} color={T.text} style={{ lineHeight: 1.3 }}>
          sha256 <span style={{ color: T.gold }}>{shortHash(rs("buildSha"))}</span> = on-chain <span style={{ color: T.alive }}>✓</span>
        </Mono>
      </LiftPlate>
    </div>
  );
}

/** S12 "public" mode key line: the released key, from rs("releasedKey") (else the proof's recorded value). */
export function KeyReleasedLine({ f, at, value }: { f: number; at: number; value: string }) {
  const up = ramp(f, at, at + 10);
  if (up <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: LAYOUT.s12LineY, display: "flex", justifyContent: "center",
      transform: `translateY(${-50 + (1 - up) * 20}%)`, opacity: Math.min(1, up * 2) }}>
      <LiftPlate lift={up} edge={T.gold} style={{ padding: "16px 40px 18px", clipPath: `inset(0 ${(1 - printIn(f, at)) * 100}% 0 0)` }}>
        <Mono size={56} color={T.text} style={{ lineHeight: 1.3 }}>
          key released on chain · <span style={{ color: T.gold }}>{shortHash(value)}</span>
        </Mono>
      </LiftPlate>
    </div>
  );
}
