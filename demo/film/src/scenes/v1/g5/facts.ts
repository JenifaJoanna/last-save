// Every number, string and take-geometry constant that S11, S13 and S14 draw, in one place so the real v2 takes can be
// lined up by editing this file only. Sources are noted per value; anything marked TUNE needs the real take to confirm.

import { ra, ran, rs, rn } from "../../../film/run";
import RUN from "../../../film/run-facts.json";
import AFTER from "../../../film/run-facts-after.json";

/** Which instance S13/S14 (and S11's buy beat) show after the release. "v2dev" = the committed final (fallback).
 * "ember-rift" = the judge instance (key released 15 Nov 01:05, community host up): t-host-er / back-er / postbuy-er,
 * values from the judge set, no bounce; the epoch beat stays v2dev's take with its own chip. Paths: g5/after.ts. */
export const AFTER_INSTANCE: "v2dev" | "ember-rift" = "v2dev";

/** Seam S11: the decoded server key S10 ends on; must equal the string S10 draws on its last frame. */
export const RELEASED_KEY = ra("releasedKey");

/** Keep-alive pool after the four choices and the post-shutdown buy (run proof: pool after the buy, the config epoch cap
 * and epoch length). Runway = floor(pool / epoch cap) epochs. */
export const POOL = { total: rs("poolTotal"), runwayEpochs: rn("runwayEpochs"), epochCap: rs("epochCap"), epochLen: rs("epochLen") };

/** Host epoch claim (run proof, claim phase): verified holder sessions and the NEAR paid. */
export const CLAIM = { sessions: ran("sessionsVerified"), paid: ra("hostPaid") };


/** Seconds into each take where the slot starts playing (the 1-s hold at the take's start is skipped). TUNE per take. */
export const TAKE_FROM: Record<string, number> = {
  // S11 cut sheet (real takes, 14 Nov 23:20). pledge (mira #3): PLEDGE selected 1.9 s, relayer toast 10.9 s, card flips to
  // "You pledged to the hosts" 13.3 s. pledge2 (kofi #4): selected 1.6 s, flips 9.5 s. postbuy (ines #5): toast ~9 s,
  // "You own licence #5" ~11 s. In-points trim the chain wait; no cut inside a shown wait, nothing sped up.
  // pledge in-point puts its toast on S11 f32 (toast lift); pledge2 puts kofi's flip on f143 (pledged lift).
  // refund2 (dario #2, 12.1 s): REFUND selected from 0 s, toast 9.4 s, card flips to "You took your refund" 11.7 s; its
  // in-point puts the flip on S11 f95, then the take's last frame holds (TAKE_END; no wait is skipped).
  refund2: 9.43, pledge: 10.83, pledge2: 5.83,
  // back-signin.mp4 (10.1 s, real wallet, game client on v2dev's host): CONNECT YOUR WALLET 0–1.7 s → NEAR WALLET (NEAR
  // CONNECT) 1.7 s → wallet list 4.4 s (Meteor) → Meteor Connect ≈ 7 s → ends at the wallet tab (the take's cut: Connect
  // Request + Sign Message approved off camera). back.mp4 (10.4 s burst of real shots): the live match. backMatch keeps
  // ≥ 3 s of footage after it for XOpen's cold open.
  backSignin: 6.6, backMatch: 1.0,
  bounce: 0.6, epoch: 1.0, // bounce.mp4: the denied panel is up from 0.5 s; epoch.mp4: the host card is static
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
export const POSTBUY: "wallet-v2dev" | "demo-ember-rift" | "wallet-ember-rift" = "wallet-v2dev"; // committed choice; "wallet-ember-rift" (postbuy-er, not checked) and "demo-ember-rift" are the alternatives
const STORE_CARD = { x: 880 / 1920, y: 236 / 1080, w: 860 / 1920, h: 398 / 1080 };
export const POSTBUY_TAKE = {
  "demo-ember-rift": { slot: "postbuy", from: 8.0, crop: STORE_CARD, cutAt: null as number | null }, // ines: toast ≈ 9 s, "#5" ≈ 11 s
  // postbuy-wallet.mp4 (6.0 s, v2dev, Meteor Web): cursor on BUY AND FUND THE HOSTS to 2.5 s, the take's own cut at
  // 2.77 s (the Meteor tab where the purchase was approved), then toast "Licence bought · Approved in your wallet" and
  // "You own licence #6.". In-point 2.24 s puts the take's cut on S11 f212 (cutAt). The card sits ~90 px lower after the
  // cut, so the crop is taller-placed than ines's.
  "wallet-v2dev": { slot: "postbuy-wallet", from: 2.24, crop: { x: 880 / 1920, y: 300 / 1080, w: 860 / 1920, h: 398 / 1080 }, cutAt: 212 as number | null },
  // postbuy-er.mp4 (5.47 s, burst of the builder's CDP screencast, er-journey-2, real capture intervals, 3 segments in
  // real order): store at BUY 0–1.71 s · Meteor "Approve Transaction" (send 0.25 NEAR jenifajoanna.testnet →
  // ember-rift) 1.71–3.56 s · the store back with "You own licence #6" + "Licence bought" toast 3.56–5.47 s
  // (tx 9oiC9dtL…, buy_licence, SuccessValue). The jumps between segments are cuts (tab switches; the approve → receipt
  // cut is labelled). 1920×962 frames: the crop drops the app's own chrome.
  "wallet-ember-rift": { slot: "postbuy-er", from: 0.7, crop: { x: 0.011, y: 0.1, w: 0.978, h: 0.8 }, cutAt: 282 as number | null },
}[POSTBUY];
/** ember-rift buy beat: the take plays untextured; its two lines lift as film type in a band below the Meteor popup.
 * A ~1 s x-postbuy-er chain-view flash does not fit: not used. */
export const POSTBUY_ER = {
  approval: { line: "Approve Transaction · 0.25 NEAR → ember-rift", at: 228, until: 278 }, // Meteor screen on S11 f226–282
  receipt: { line: "You own licence #6 · tx 9oiC9dtL…", at: 284 }, // to the scene end; needs S11 ≥ 10.7 s (+2.0 s)
  panelAt: 1e6, // no pool panel in this mode: the beat is the approval and the receipt
};
/** The wallet take's header, verbatim (connected-wallet pill, top right of the page): the honest proof of a real wallet. */
export const WALLET_PILL = { account: "jenifajoanna", wallet: "METEOR WALLET", from: { x: 1500, y: 28 } };
export const WALLET_CUT_LABEL = "cut · approved in Meteor Wallet";
/** The wallet take's own note after the buy (store card, gold note), verbatim. Replaces the pool count in wallet mode:
 * the pool numbers are ember-rift's, and this buy went into v2dev's pool. */
export const WALLET_OWNED = "You own licence #6.";
/** S14 fallback if the game-client `back` re-shoot fails: signin.mp4 (14.9 s: /signin 0–3 s → wallet list 3.0 s →
 * Meteor Connect 6.6 s → the take's cut 10.37 s → header "jenifajoanna · METEOR WALLET · GAS-FREE"). In-point TUNE. */
export const BACK_SOURCE: "back" | "signin" = "back";
export const SIGNIN_TAKE = { from: 8.6, cut: 10.37 }; // the take's cut lands on S14 f27 + (10.37 − from)·30
/** Honest captions (S04's wording). pledge, pledge2 and ines's postbuy show no wallet approval: the judge-demo signer
 * signed them. */
export const DEMO_SIGNER = "signed by the judge-demo signer · no wallet";
export const PLEDGES_DEMO_SIGNED = true;
export const V2DEV_CHIP = "v2dev · same code";

/** Game client HUD (game/client/src/ui/styles.css: --b 10, --strip 30, --pad 14): #board top-left (4 players) and #me
 * bottom-left (level box, name, "Skin · Emberwing", XP). Fractions of the 1920×1080 take. TUNE against `back`. */
// Measured on back.mp4 (1920 scale): scoreboard box x 24–305, y 50–205; pilot card x 24–290, y 912–1055.
export const HUD_BOARD = { x: 18 / 1920, y: 44 / 1080, w: 296 / 1920, h: 168 / 1080 };
export const HUD_ME = { x: 16 / 1920, y: 904 / 1080, w: 284 / 1920, h: 158 / 1080 };
/** True of THIS player's card on the community host (not the killed match's pilot: other instance, other account). */
export const PILOT_CAPTION = "restored from the on-chain snapshot";

/** /app/hosts: focus for the epoch take (the "Your host" card, right column of max-w-6xl, x ≈ 1042–1536). TUNE. */
export const EPOCH_FOCUS = { fx: 1200, fy: 690, scale: 1.4 }; // epoch.mp4: "Your host" card x 1050–1530, y 610–800
/** S14 key lines, verbatim from the takes (v2dev). The host card shows the host's totals, not one epoch. Wanted after-set
 * keys: hostSessionsPaid ("8") and hostEarned ("0.08"); until they exist the take's own text is used. */
const after = (k: string): string | null => { const v = (AFTER.values as Record<string, unknown>)[k]; return v === null || v === undefined || typeof v === "object" ? null : String(v); };
export const KEY_HOST = { who: "fanhost", sessions: after("hostSessionsPaid") ?? "8", earned: after("hostEarned") ?? "0.08" };
export const KEY_DENIED = { line: "ACCESS DENIED · NO LICENCE", from: { x: 950, y: 468 }, to: { x: 960, y: 210 } }; // bounce.mp4 panel

/** term.html geometry for terminal takes (demo/capture/term.html: 1800×980 window centred, 8 px padding, 40 px bar,
 * 18/26 px player padding, 26 rows). The screen below the bar, as a fraction of the 1920×1080 take: */
export const TERM_CROP = { x: 68 / 1920, y: 98 / 1080, w: 1784 / 1920, h: 924 / 1080 };

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
/** S13 (V12 locked 15 Nov: "A fan runs one command. It fetches a public copy, checks it against the hash from day one,
 * and restores everyone's progress."). No one-button beat: no deploy take exists, so that beat and its slot are gone. */
/** S13 on v2dev — t-host.mp4: term.html replay (3840×2160) of the real `pnpm host` run (cast 152 s, idle capped →
 * 21.1 s). Line times in the VIDEO (s) ≈ cast − 0.2 s until the tunnel, then idle-capped; measured from the rows. One
 * honest cut: just after "tunnel up" (video 8.0 s) to just before register_host (13.6 s); the run waited ≈ 81 s for the
 * tunnel (cast 11 → 92 s). Rows: first row y 151 (centre), pitch 32.8 px, in the take's 1920×1080 frame. Lift text is
 * the take's own (wrapped, nothing added). Wanted after-set keys: keyCommitment12, snapshotSeq, registerHostTx. */
export const V2_HOST = {
  slot: "t-host", title: "Fan host · v2dev",
  video: { command: 0.83, released: 1.64, copy: 2.03, warning: 2.8, snapshot: 3.03, local: 4.78, tunnel: 7.8, serving: 10.8, register: 13.8 },
  cut: { at: 255, to: 13.6, label: "cut · 81 s later" },
  rows: { y0: 151, pitch: 32.8, released: 2, copy: 3, snapshot: 10, register: 14 },
  lines: {
    copy: ["github raw raw.githubusercontent.com …", "200, sha256 matches on-chain ✓"],
    released: ["released key matches the on-chain commitment", "(f2772b9f97d8...)"],
    snapshot: ["restoring progress snapshot #2"],
    register: ["register_host:", "https://testnet.nearblocks.io/txns/", "3hQdHRjgEtpCx8KQW1dm85MgMf4H3nAYhUT9r5kkQJCa"],
  },
};
export type HostSpec = typeof V2_HOST;
/** Layout (TUNE): S11 toast centre, S13 lift band centre (content px), S12 key line top (frame px). */
export const LAYOUT = { toast: { x: 960, y: 540 }, s13LiftY: 640, s12LineY: 880 };
/** S14 stand-ins while `back` / `bounce` are pending, so the open never sits on a near-black "Take pending" card
 * (scripts/check-dead-air). Game-client plates from public/plates; tagged as stand-ins by Slot. */
export const BACK_PLATE = "match.png";
export const BOUNCE_PLATE = "kill-lost.png";
