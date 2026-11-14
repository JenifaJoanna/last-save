// Scene registry: one component per scene, each also registered as its own composition.
import type { FC } from "react";
import type { SceneId } from "../../film/timeline";
import { S01 } from "./S01"; import { S02 } from "./S02"; import { S03 } from "./S03"; import { S04 } from "./S04";
import { S05 } from "./S05"; import { S06 } from "./S06"; import { S07 } from "./S07"; import { S08 } from "./S08";
import { S09 } from "./S09"; import { S10 } from "./S10"; import { S11 } from "./S11"; import { S12 } from "./S12";
import { S13 } from "./S13"; import { S14 } from "./S14"; import { S15 } from "./S15"; import { S16 } from "./S16";
import { S17 } from "./S17";
import { XOpen } from "../../film/XOpen";
import { withInstance } from "../../film/Instance";

// S10 and S12–S16 show the dev instance v2dev's real afterlife (src/film/Instance.tsx): labelled in every frame.
export const SCENE_COMPONENTS: Record<SceneId, FC> = {
  XO: XOpen, S01, S02, S03, S04, S05, S06, S07, S08, S09, S11, S17,
  S10: withInstance(S10, { banner: true }), S12: withInstance(S12), S13: withInstance(S13),
  S14: withInstance(S14, { chipBottom: 96 }), S15: withInstance(S15), S16: withInstance(S16),
};
