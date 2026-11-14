// S08 tune sheet for the `match` take (raw/match.mp4, 3840x2160 @2x, 41.2 s, 14 Nov 22:02: mira = "YOU" vs yuna,
// kofi, dario on the official server, LIVE). Positions are take px on the 1920x1080 basis, read off 0.5-s frames.
// MATCH_HITS is written by `node scripts/hits.mjs` from raw/match.events.json (the client's own impact log).

/** S08 frame where the match take crossfades in (f32–42). */
export const MATCH_CUT = 32;
/** Take second at the match cut-in (S08 f32): the busiest stretch (hits at 9.05, a 4-hit burst 9.45-9.70 with the
 * white impact flash, then 11.1-13.9), so the X cut's first 6 s carry the action. */
export const MATCH_FROM = 9;
/** Take seconds of each hit (punch-in + shake; cues.ts wires a hit SFX to these). Placeholders inside the first 6 s. */
export const MATCH_HITS: number[] = [9.05, 9.45, 11.12, 11.85, 12.57, 13.87, 15.39];
/** Crop: ≥1.35x, centred on the player ("YOU"); 1.75x so the preview's ~25 px ships read at ~45 px. */
export const MATCH_CROP = 1.75;
/** "YOU" track [take s, x, y] (raw/match.mp4, every 0.5 s); linear between keys, the crop clamped inside the take. */
export const PLAYER_TRACK: [number, number, number][] = [
  [8.5, 1133, 388], [9, 1210, 261], [9.5, 1229, 180], [10, 1171, 230], [10.5, 1106, 292], [11, 876, 315], [11.5, 864, 323],
  [12, 845, 284], [12.5, 806, 311], [13, 814, 319], [13.5, 749, 357], [14, 749, 384], [14.5, 749, 419], [15, 814, 449],
  [15.5, 837, 488], [16, 806, 372],
];
/** The game arena's centre in take px (the key art's core is pushed onto it). */
export const ARENA = { x: 950, y: 538 } as const;
/** Punch-in per hit: +6 % over 2 f, eased back over 8 f; shake ±6 px decaying over 6 f. */
export const PUNCH = { amount: 0.06, up: 2, down: 8, shake: 6, shakeFrames: 6 } as const;
/** The take's own top-bar chip ("LS-0001 · EMBER RIFT · OFFICIAL SERVER" … "LIVE"), lifted as a 56 px line for 1.8 s;
 * bottom-left, clear of the action (mira fights near the top of the arena in this stretch). */
export const SERVER_LINE = { text: "Official server", status: "Live", at: 46, out: 108, x: 72, y: 920, size: 56 } as const;

export function playerAt(t: number): { x: number; y: number } {
  const k = PLAYER_TRACK;
  if (t <= k[0][0]) return { x: k[0][1], y: k[0][2] };
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      return { x: k[i - 1][1] + (k[i][1] - k[i - 1][1]) * u, y: k[i - 1][2] + (k[i][2] - k[i - 1][2]) * u };
    }
  }
  const l = k[k.length - 1];
  return { x: l[1], y: l[2] };
}
