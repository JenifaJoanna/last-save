// S17 close lock-up (frame coords): the Last Save mark + wordmark, the display line ("We killed our server." cream /
// "You still have the game." sunset bands), the label row of what it is built on (NEAR and OutLayer marks from
// public/brand, shown like web/src/components/brand.tsx PartnerLogo) and the repo + live URLs.
import { Img, interpolate, staticFile } from "remotion";
import { Display, Label, Mono } from "../../../ds/type";
import { FONT, T } from "../../../ds/tokens";
import { C, out, printP, stepIn } from "./kit";
import { Mark } from "./Mark";

export const AT = { line1: 44, line2: 54, mark: 70, labels: 108, near: 133, urls: 146 } as const;

const COL = { x: 1010, w: 830 };
const SIZE = 70;

type Item = { text?: string; logo?: "near" | "outlayer" };
const ITEMS: Item[] = [
  { logo: "near" }, { text: "NEP-171 / 199 / 297" }, { logo: "outlayer" }, { text: "Chain Signatures" },
  { text: "global contracts" }, { text: "NEP-366" }, { text: "Walrus" }, { text: "Sigstore" },
];

function Logo({ kind, bright }: { kind: "near" | "outlayer"; bright: number }) {
  if (kind === "near") {
    // single-colour SVG mark: rendered white like PartnerLogo (brightness(0) invert), brightened on "NEAR"
    return <Img src={staticFile("brand/near-logo.svg")} style={{ height: 26, width: "auto", opacity: 0.75 + 0.25 * bright,
      filter: `brightness(0) invert(1) drop-shadow(0 0 ${14 * bright}px rgba(239,229,208,${0.75 * bright}))` }} />;
  }
  // multi-colour raster mark keeps its colours and drops its black backdrop with screen blending
  return <Img src={staticFile("brand/outlayer-logo.png")} style={{ height: 26, width: "auto", opacity: 0.85 }} />;
}

export function Lockup({ f }: { f: number }) {
  const markIn = interpolate(f, [AT.mark, AT.mark + 18], [0, 1], { ...C, easing: out });
  const nearB = interpolate(f, [AT.near, AT.near + 8], [0, 1], { ...C, easing: out });
  const l1 = printP(f, AT.line1);
  const l2 = printP(f, AT.line2);
  return (
    <>
      <div style={{ position: "absolute", left: COL.x, top: 214, display: "flex", alignItems: "center", gap: 20, opacity: Math.min(1, markIn * 1.6),
        transform: `translateY(${(1 - markIn) * 18}px) scale(${1.06 - 0.06 * markIn})`, transformOrigin: "0% 50%" }}>
        <Mark size={68} />
        <div style={{ fontFamily: FONT.display, fontStretch: "125%", fontWeight: 900, fontSize: 40, letterSpacing: "0.06em", color: T.text }}>LAST SAVE</div>
      </div>
      <div style={{ position: "absolute", left: COL.x, top: 336, width: COL.w }}>
        <div style={stepIn(l1)}><Display size={SIZE} tone="cream" glow={false}>{"We killed\nour server."}</Display></div>
        <div style={{ marginTop: 26, ...stepIn(l2) }}><Display size={SIZE}>{"You still have\nthe game."}</Display></div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 878, display: "flex", justifyContent: "center", alignItems: "center", gap: 22 }}>
        {ITEMS.map((it, i) => {
          const p = printP(f, AT.labels + i * 2);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, ...stepIn(p), mixBlendMode: it.logo === "outlayer" ? "screen" : undefined }}>
              {i > 0 && <Label size={20} color={T.faint}>·</Label>}
              {it.logo ? <Logo kind={it.logo} bright={it.logo === "near" ? nearB : 0} /> : <Label size={20} color={T.muted} track={0.14}>{it.text}</Label>}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 950, display: "flex", justifyContent: "center", gap: 28, ...stepIn(printP(f, AT.urls)) }}>
        <Mono size={24} color={T.text}>github.com/JenifaJoanna/last-save</Mono>
        <Mono size={24} color={T.gold}>·</Mono>
        <Mono size={24} color={T.text}>last-save.pages.dev</Mono>
      </div>
    </>
  );
}
