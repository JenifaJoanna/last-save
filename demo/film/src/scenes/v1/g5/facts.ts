// Every number, string and take-geometry constant that S11, S13 and S14 draw, in one place so the real v2 takes can be
// lined up by editing this file only. Sources are noted per value; anything marked TUNE needs the real take to confirm.

import { ra, ran, rs, rn } from "../../../film/run";
import RUN from "../../../film/run-facts.json";

/** Seam S11: the decoded server key S10 ends on; must equal the string S10 draws on its last frame. */
export const RELEASED_KEY = ra("releasedKey");

/** Keep-alive pool after the four choices and the post-shutdown buy (run proof: pool after the buy, the config epoch cap
 * and epoch length). Runway = floor(pool / epoch cap) epochs. */
export const POOL = { total: rs("poolTotal"), runwayEpochs: rn("runwayEpochs"), epochCap: rs("epochCap"), epochLen: rs("epochLen") };

/** Host epoch claim (run proof, claim phase): verified holder sessions and the NEAR paid. */
export const CLAIM = { sessions: ran("sessionsVerified"), paid: ra("hostPaid") };

/** The fan's host command, as on the Hosts page (web/src/pages/app/Hosts.tsx CMD) with the e2e host account. */
export const HOST_CMD = "pnpm host --local --account lastsave-fanhost.testnet"; // the e2e host account (fixed by the run harness)

/** Seconds into each take where the slot starts playing (the 1-s hold at the take's start is skipped). TUNE per take. */
export const TAKE_FROM: Record<string, number> = {
  // S11 cut sheet (real takes, 14 Nov 23:20). pledge (mira #3): PLEDGE selected 1.9 s, relayer toast 10.9 s, card flips to
  // "You pledged to the hosts" 13.3 s. pledge2 (kofi #4): selected 1.6 s, flips 9.5 s. postbuy (ines #5): toast ~9 s,
  // "You own licence #5" ~11 s. In-points trim the chain wait; no cut inside a shown wait, nothing sped up.
  // pledge in-point puts its toast on S11 f32 (toast lift); pledge2 puts kofi's flip on f143 (pledged lift).
  // refund2 (dario #2, 12.1 s): REFUND selected from 0 s, toast 9.4 s, card flips to "You took your refund" 11.7 s; its
  // in-point puts the flip on S11 f95, then the take's last frame holds (TAKE_END; no wait is skipped).
  refund2: 9.43, pledge: 10.83, pledge2: 5.83,
  hostbtn: 1.0, "t-host": 0.6,
  backSignin: 1.0, backMatch: 9.0, bounce: 1.0, epoch: 1.0,
};

/** Crop of a full-page LS-0001 take (fractions of 1920×1080) to its content rect (ds/screen.tsx CONTENT), so a take
 * inside ScreenFrame keeps identical chrome. */
export const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };

/** /app/afterlife in the real takes: the "Your licence" choice card and the "Where the money is" card (x 310–1130,
 * y 245–703 of the 1920×1080 take). The on-chain log (y ≥ 720, with its "Release attempt" rows) and the hero's
 * "Last attempt" line (y ≈ 120) stay outside the crop. Same scroll in both pledge takes. TUNE if a take is replaced. */
const choose = { x: 310 / 1920, y: 245 / 1080, w: 820 / 1920, h: 458 / 1080 };
export const CHOOSE_CROP: Record<string, { x: number; y: number; w: number; h: number }> = {
  pledge: choose, pledge2: choose,
  // refund2 scrolls ~100 px further: the choice card alone (x 310–800, y 345–599), so the money card (recorded after the
  // post-death buy) and the "Retry the release" button / on-chain log stay out of frame.
  refund2: { x: 310 / 1920, y: 345 / 1080, w: 490 / 1920, h: 254 / 1080 },
};
/** Take lengths (s) where a take ends inside the scene; its last frame holds from there. */
export const TAKE_END: Record<string, number> = { refund2: 12.1 };
/** Points inside that crop (fractions) the S11 key lines rise from: the money card's Refunded row, the card title. */
export const CHOOSE_POINTS = { refunded: { x: 0.5, y: 0.2 }, title: { x: 0.25, y: 0.12 }, toast: { x: 1.0, y: 1.0 } };

/** /app/store after death: the licence-price card (90 % to the keep-alive pool, 10 % to the gas-free budget since commit 8c374a6), right column of
 * max-w-6xl (x ≈ 1036–1536). TUNE. */
/** S11 buy beat ("New players fund it too"). "demo-ember-rift": ines's post-death buy on ember-rift (postbuy.mp4,
 * 14 Nov 23:21), signed by the in-app judge-demo signer: captioned. "wallet-v2dev": the real-wallet post-death buy on the
 * v2dev instance (wallet approval → licence → 90/10), no caption, plus the instance chip. Swap = this one line plus the
 * TUNE in-point/crop below once the take lands. The pool numbers stay ember-rift's (run facts). */
export const POSTBUY: "wallet-v2dev" | "demo-ember-rift" = "demo-ember-rift";
const STORE_CARD = { x: 880 / 1920, y: 236 / 1080, w: 860 / 1920, h: 398 / 1080 };
export const POSTBUY_TAKE = {
  "demo-ember-rift": { from: 8.0, crop: STORE_CARD }, // ines: buy toast ≈ 9 s, "You own licence #5" ≈ 11 s
  "wallet-v2dev": { from: 8.0, crop: STORE_CARD }, // TUNE when the wallet take lands (in-point on the wallet approval)
}[POSTBUY];
/** Honest captions (S04's wording). pledge, pledge2 and ines's postbuy show no wallet approval: the judge-demo signer
 * signed them. */
export const DEMO_SIGNER = "signed by the judge-demo signer · no wallet";
export const PLEDGES_DEMO_SIGNED = true;
export const V2DEV_CHIP = "v2dev · same code";

/** Game client HUD (game/client/src/ui/styles.css: --b 10, --strip 30, --pad 14): #board top-left (4 players) and #me
 * bottom-left (level box, name, "Skin · Emberwing", XP). Fractions of the 1920×1080 take. TUNE against `back`. */
export const HUD_BOARD = { x: 10 / 1920, y: 44 / 1080, w: 300 / 1920, h: 150 / 1080 };
export const HUD_ME = { x: 10 / 1920, y: 950 / 1080, w: 300 / 1920, h: 118 / 1080 };

/** /app/hosts: focus for the epoch take (the "Your host" card, right column of max-w-6xl, x ≈ 1042–1536). TUNE. */
export const EPOCH_FOCUS = { fx: 1290, fy: 600, scale: 1.4 };

/** term.html geometry for terminal takes (demo/capture/term.html: 1800×980 window centred, 8 px padding, 40 px bar,
 * 18/26 px player padding, 26 rows). The screen below the bar, as a fraction of the 1920×1080 take: */
export const TERM_CROP = { x: 68 / 1920, y: 98 / 1080, w: 1784 / 1920, h: 924 / 1080 };
/** Row of each lifted t-host line in the take (0 = the `$ pnpm host` line). Guesses from host/lib order. TUNE. */
export const HOST_ROWS = { walrus: 3, hash: 6, provenance: 4, snapshot: 8, register: 11 };
export const TERM_ROW = { top: 18 / 924, h: 34.4 / 924 }; // first row offset and row height, as fractions of TERM_CROP.h

// ---- v2 legibility pass: key lines lifted as film type (≥ 56 px after camera, ≥ 45 f, ≤ 4 px/f). Positions are TUNE. ----
/** S11 toast body, verbatim from web/src/lib/wallet.tsx (gasless toast). Title is texture. */
export const KEY_TOAST = { title: "Pledge added to the pool", body: "Gas paid by the relayer: you paid 0 Ⓝ." }; // pledge.mp4 10.9 s
/** A run value, or null while the run facts list it as MISSING (then the take's own visible figure is used). */
/** A run value by name, or null while it is absent or MISSING (keys the facts worker has not added yet included). */
const loose = (k: string): string | null => { const v = (RUN.values as Record<string, unknown>)[k]; return v === null || v === undefined || typeof v === "object" ? null : String(v); };
/** "take their share back": the money card's Refunded row as both pledge takes show it (0.1 Ⓝ: one refund had landed
 * when they were recorded). */
// value: run fact refundedNear (judge-v2 afterlife.refunded_near), else dario's money card (0.2 Ⓝ, refund2.mp4).
// count: refundedCount when the facts carry it (the card itself shows no count).
export const KEY_REFUNDED = { label: "Refunded", value: loose("refundedNear") ?? "0.2", count: loose("refundedCount") };
/** "keep the game alive": the choice card after the pledge (title + the licence's locked share). */
export const KEY_PLEDGED = { title: "You pledged to the hosts", value: rs("lockedShare") };
/** S11 end: the pool after the pledges, then the post-shutdown sale (run proof: 90 % to the pool, 10 % to the ops budget,
 * contracts/licence/src/ops.rs). */
// before: run fact, else the Keep-alive pool row in pledge2.mp4 after kofi's pledge (0.2 Ⓝ). after: run fact only (the
// mint's storage fee comes off before the 90 %, so it is never derived here); while MISSING the number holds at `before`.
// line: the post-shutdown store card's split legend, verbatim (postbuy.mp4).
export const KEY_SPLIT = { before: loose("poolBefore") ?? "0.2", after: loose("poolTotal") ?? loose("poolAfter"), line: "90% to the keep-alive pool · 10% gas-free budget" };
/** S13 key lines in the host CLI's own formats (host/lib/mirrors.mjs, provenance.mjs); values from the launch proof
 * (Walrus aggregator host, CI build commit, Rekor index and time). */
export const KEY_WALRUS = [`walrus ${ra("walrusHost")} …`, "200, sha256 matches on-chain ✓"];
export const KEY_PROVENANCE = ["provenance ✓ built by workflow", ra("workflow"), `at commit ${ra("commit7")}, logged ${ra("rekorLogged")}`, `(Rekor #${ra("rekorIndex")})`];
/** Layout (TUNE): S11 toast centre, S13 lift band centre (content px), S12 key line top (frame px). */
export const LAYOUT = { toast: { x: 960, y: 540 }, s13LiftY: 640, s12LineY: 880 };
/** S14 stand-ins while `back` / `bounce` are pending, so the open never sits on a near-black "Take pending" card
 * (scripts/check-dead-air). Game-client plates from public/plates; tagged as stand-ins by Slot. */
export const BACK_PLATE = "match.png";
export const BOUNCE_PLATE = "kill-lost.png";
export const HOSTBTN_PLATE = "status-released.png"; // S13 stand-in while `hostbtn` is pending (no dead air)
