// S08 tune sheet for the `match` take (game client as mira on the official server). TUNE WHEN THE TAKE LANDS with the
// builder's hit log. Preview values (preview/match.mp4, practice mode): sign-in 0-2 s, countdown 2-5 s, GO at 5 s.

/** Take second at the match cut-in (S08 f32): the first frame must already read as a busy arena. */
export const MATCH_FROM = 6;
/** Take seconds of each hit (punch-in + shake; cues.ts wires a hit SFX to these). Placeholders inside the first 6 s. */
export const MATCH_HITS: number[] = [7.3, 8.9, 10.4, 11.6];
/** Crop: ≥1.35x, centred on the player ("YOU"); 1.75x so the preview's ~25 px ships read at ~45 px. */
export const MATCH_CROP = 1.75;
/** Player track [take s, x, y] in take px (preview, read off 1-s frames); linear between keys, clamped to the take. */
export const PLAYER_TRACK: [number, number, number][] = [[6, 1080, 765], [9, 1080, 750], [10, 951, 900], [12, 760, 600], [14, 760, 560]];
/** The game arena's centre in take px (the key art's core is pushed onto it). */
export const ARENA = { x: 960, y: 530 } as const;
/** Punch-in per hit: +6 % over 2 f, eased back over 8 f; shake ±6 px decaying over 6 f. */
export const PUNCH = { amount: 0.06, up: 2, down: 8, shake: 6, shakeFrames: 6 } as const;
/** The take's own server chip text, lifted as a 56 px line for its first 1.8 s on screen. */
export const SERVER_LINE = { text: "Official server", at: 46, out: 108, x: 72, y: 72, size: 56 } as const;

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
