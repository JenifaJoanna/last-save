import { loadFont as loadChakra } from "@remotion/google-fonts/ChakraPetch";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const chakra = loadChakra("normal", { weights: ["500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

export const C = {
  ink: "#07060d", panel: "#12101d", line: "rgba(255,255,255,0.10)", text: "#efeaff", muted: "#9a92b8", faint: "#6b6488",
  ember: "#ff7a1a", gold: "#ffd27a", cyan: "#5ef0ff", alive: "#42ffc9", dead: "#ff4d6d",
};
export const FPS = 30;
export const s = (sec: number) => Math.round(sec * FPS);

/** Facts from the live run (whitelisted numbers only). Updated from proof/ after the filmed run. */
export const RUN = {
  contract: "lastsave-licence.testnet",
  release: "9fafaf8e417245337c30af82b045ecd0b75a6e2885f1c03300808a3f4f472b7a",
  artifact: "7ee9918d3b370288b7519ad7384496609a7b0a15308d865851d63c205277fe04",
  build: "b723c6d4854b1b8688a0a4a1191dda26d0492d6cf28a26cd1c88e7ac222bc967",
};
