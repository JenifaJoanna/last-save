// S09 schedule (scene frames), derived from the V08 word beats in facts.ts. One place to retime the kill.
import { K } from "./facts";

export const S9 = {
  dial: K.goes - 12, //            dial-up box (720 ms) types the studio-ops request
  win: K.dark - 1, //              terminal window opens on "dark"
  pull: [4, K.dark - 4] as const, // the camera eases out of S08's 1.75× player crop to the whole match
  lift1: K.stop - 4, //            "✕ official server deleted" prints in the take (f100) and lifts to 64 px
  lift2: K.disappears, //          "HTTP/2 530 · gone" lifts (the take prints it on f151)
  liftOut: K.disappears + 46, //   both lifted lines print out (held 97 f and 46 f)
  winClose: K.disappears + 49, //         the terminal window collapses (8 f)
  lost: K.disappears + 57, //            hard cut to the lost take: a new sign-in after the shutdown
  rejoin: K.disappears + 59, //          "Rejoin after the shutdown → Connection lost — reconnecting" (≥ 56 px)
  collapse: K.alive + 14, //       the client powers off (10 f) + bloom
  redden: K.alive + 24, //         the line reddens and narrows to the screen (10 f)
  drop: K.alive + 34, //           the line drops onto the flatline (12 f)
  powerOn: K.only + 20, //         the status page opens vertically out of the flatline (8 f)
  lift: K.checks - 4, //           the take dims, the probe log lifts over it
  probe: [K.fail - 3, K.three - 2, K.times - 2], // PROBE 1/3, 2/3, 3/3 print
  fold: K.contract - 9, //         the status page folds back into the flatline (8 f)
  declared: K.marks - 3, //        "> STUDIO DECLARED GONE  DEAD"
  eyebrow: K.dead - 13,
  title: K.dead - 9, //            GONE DARK prints (steps(5), 400 ms), resolved on "dead"
  sun: K.dead - 3,
  flicker: [K.dead + 1, K.dead + 7, K.dead + 13], // three hard dips over 600 ms
  alert: K.dead + 7, //            the alert card slides in
  still: K.voEnd + 5, //           from here only the flatline, grain and LED move
} as const;
