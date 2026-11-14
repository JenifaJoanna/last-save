// The licence card in screen space: its held pose (centred, facing camera, floating) is shared by S04's end and S05's
// start so the seam matches frame for frame. Float terms use the absolute film frame.
import { CARD_H, CARD_W, LicenceCard } from "./Licence";
import { FACTS } from "./facts";

export const HELD = { x: 960, y: 540, s0: 1.42, s1: 1.47 };
export interface CardPose { x: number; y: number; s: number; ry: number; rx: number; z: number }
export const heldPose = (g: number, s: number): CardPose => ({ x: HELD.x + Math.sin(g / 26) * 3, y: HELD.y + Math.sin(g / 21) * 5, s, ry: Math.sin(g / 30) * 0.8, rx: 1.5, z: 0 });

export function CardInSpace({ pose, clipBottom = 0, ...card }: { pose: CardPose; clipBottom?: number } & Omit<Parameters<typeof LicenceCard>[0], "number">) {
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2400, perspectiveOrigin: "50% 50%", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: pose.x - CARD_W / 2, top: pose.y - CARD_H / 2, width: CARD_W, height: CARD_H, transformStyle: "preserve-3d",
        transform: `translateZ(${pose.z}px) rotateY(${pose.ry}deg) rotateX(${pose.rx}deg) scale(${pose.s})`, clipPath: clipBottom > 0 ? `inset(0 0 ${clipBottom * 100}% 0)` : undefined }}>
        <LicenceCard number={FACTS.licenceNo.v} {...card} />
      </div>
    </div>
  );
}
