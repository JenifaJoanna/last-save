// The after-release instance switch (g5/facts AFTER_INSTANCE). "v2dev" returns the committed specs unchanged;
// "ember-rift" returns the judge-instance paths. Every ember-rift value marked TUNE is a placeholder until its take
// lands (t-host-er .cast, back-er, bounce-er); text comes from the judge run facts (rs) or the take itself.
import { rs } from "../../../film/run";
import { AFTER_INSTANCE, type HostSpec, TAKE_FROM, V2_HOST } from "./facts";

export const ER = AFTER_INSTANCE === "ember-rift";

/** S13 on ember-rift: `pnpm host` against the judge instance. The studio copy is gone, so the first verified mirror is
 * expected to be Walrus. TUNE: every time, row and the bracketed values, from t-host-er.cast. */
const ER_HOST: HostSpec = {
  slot: "t-host-er", title: "Fan host · ember-rift",
  video: { command: 0.83, released: 1.64, copy: 2.03, warning: 2.8, snapshot: 3.03, local: 4.78, tunnel: 7.8, serving: 10.8, register: 13.8 },
  cut: { at: 255, to: 13.6, label: "cut · … s later" },
  rows: { y0: 151, pitch: 32.8, released: 2, copy: 4, snapshot: 11, register: 15 },
  lines: {
    copy: [`walrus ${rs("walrusHost")} …`, "200, sha256 matches on-chain ✓"],
    released: ["released key matches the on-chain commitment", "(…)"],
    snapshot: ["restoring progress snapshot #…"],
    register: ["register_host:", "https://testnet.nearblocks.io/txns/", "…"],
  },
};
export const HOST: HostSpec = ER ? ER_HOST : V2_HOST;

type Crop = { x: number; y: number; w: number; h: number };
interface MeteorScreen { label: string; crop: Crop; at: number; until: number }
/** S14 slots and in-points. ember-rift: back-er = the game login through Meteor (its "Sign Message" screen readable
 * ≥ 1.5 s, lifted as it shows), then the match on ember-rift's community host (scoreboard and pilot card lifted exactly
 * as shown: her real level there). No bounce on ember-rift (the only refusal there predates her buy): its time goes to
 * the match, which runs to the epoch roll. The epoch beat stays v2dev's take with its own chip. All TUNE. */
export const BACK = ER
  ? {
      back: "back-er", signinFrom: 0.0, matchFrom: 0.0, match: 66, bounce: false,
      meteor: [{ label: "Meteor · Sign Message", crop: { x: 0.3, y: 0.15, w: 0.4, h: 0.7 }, at: 20, until: 66 }] as MeteorScreen[],
      epochChip: "v2dev · same code · real 14 Nov record" as string | null,
    }
  : { back: "back", signinFrom: TAKE_FROM.backSignin, matchFrom: TAKE_FROM.backMatch, match: 40, bounce: true, meteor: [] as MeteorScreen[], epochChip: null as string | null };
