// Every number, string and take-geometry constant that S11, S13 and S14 draw, in one place so the real v2 takes can be
// lined up by editing this file only. Sources are noted per value; anything marked TUNE needs the real take to confirm.

/** Seam S10→S11: the decoded server key S10 ends on. Preview-site value (plates/status-released.png); must equal the
 * string S10 draws on its last frame and, in the final cut, the judge run's released key. TUNE. */
export const RELEASED_KEY = "fb0ac47f464bb2c8d5cb1b162c35185bd9c965b9278e8bf95c136c642717e490";

/** Keep-alive pool after the four choices and the post-shutdown buy, from the contract config in
 * proof/run-v2dev-20261114T0857Z.json: price 0.25 Ⓝ, fund_bps 4000 (0.1 Ⓝ pot share), two pledges → pool 0.2 Ⓝ (readback
 * phase 10), plus a post-death sale of 0.25 Ⓝ of which 10 % goes to the ops budget (contracts/licence/src/ops.rs) →
 * +0.225 Ⓝ. Runway = floor(0.425 / epoch_cap 0.05) = 8 epochs of 2 min (epoch_ms 120000). Replace with the judge run's
 * Money card values when the takes land. */
export const POOL = { total: "0.425", runwayEpochs: 8, epochCap: "0.05", epochLen: "2 min" };

/** Host epoch claim, proof/run-v2dev-20261114T0857Z.json phase 13: epoch 10, 4 verified holder sessions, paid 0.04 Ⓝ
 * (tx cwucJfkGEZH4ZSZgUZenFkG17JXp2A6x3Avuum7iAx7). The judge run's epoch take supersedes these. */
export const CLAIM = { sessions: 4, paid: "0.04" };

/** The fan's host command, as on the Hosts page (web/src/pages/app/Hosts.tsx CMD) with the e2e host account. */
export const HOST_CMD = "pnpm host --local --account lastsave-fanhost.testnet";

/** Seconds into each take where the slot starts playing (the 1-s hold at the take's start is skipped). TUNE per take. */
export const TAKE_FROM: Record<string, number> = {
  refund: 1.9, refund2: 1.9, pledge: 1.8, pledge2: 1.8, postbuy: 2.0,
  hostbtn: 1.0, "t-host": 0.6,
  backSignin: 1.0, backMatch: 9.0, bounce: 1.0, epoch: 1.0,
};

/** Crop of a full-page LS-0001 take (fractions of 1920×1080) to its content rect (ds/screen.tsx CONTENT), so a take
 * inside ScreenFrame keeps identical chrome. */
export const CONTENT_CROP = { x: 21 / 1920, y: 102 / 1080, w: 1878 / 1920, h: 868 / 1080 };

/** /app/afterlife: the "Your licence" choice card and the "Where the money is" card (row 2 of AfterlifeView, max-w-7xl
 * centred: the choice card at x ≈ 320–720), tight enough that 13 px app text reads ≥ 18 px. The take scrolls so row 2 is in
 * view (refund ≈ 1.5 s in, pledge a little further). y per slot measured on the preview captures. TUNE for the v2 takes. */
const choose = (y: number) => ({ x: 310 / 1920, y: y / 1080, w: 522 / 1920, h: 270 / 1080 });
export const CHOOSE_CROP: Record<string, { x: number; y: number; w: number; h: number }> = {
  refund: choose(345), refund2: choose(345), pledge: choose(272), pledge2: choose(272), // from the preview captures
};

/** /app/store after death: the licence-price card (90 % to the keep-alive pool, 10 % to the gas-free budget since commit 8c374a6), right column of
 * max-w-6xl (x ≈ 1036–1536). TUNE. */
export const POSTBUY_CROP = { x: 880 / 1920, y: 236 / 1080, w: 860 / 1920, h: 398 / 1080 };

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
