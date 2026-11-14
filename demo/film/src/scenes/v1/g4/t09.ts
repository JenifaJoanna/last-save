// S09 schedule (scene frames), derived from the V08 word beats in facts.ts. One place to retime the kill.
import { K } from "./facts";

export const S9 = {
  dial: K.goes - 12, //            dial-up box (720 ms) types the studio-ops request
  win: K.dark - 1, //              terminal window opens on "dark"
  killAt: K.dark + 2, //           t-kill command types; the delete line lands on "servers stop"
  chipOff: K.stop - 2, //          S08's "Official server · Online" chip flips to Offline
  goneAt: K.disappears - 20, //    t-404: curl types, HTTP/2 530 prints on "disappears"
  goneTag: K.disappears + 2, //    the "gone" label
  winClose: K.word - 31, //        window collapses (8 f), CONNECTION LOST underneath
  collapse: K.alive + 2, //        the whole game client powers off (10 f) + bloom
  redden: K.alive + 12, //         the line stretches to the screen and turns red (10 f)
  drop: K.alive + 22, //           the line drops onto the flatline (16 f)
  powerOn: K.only + 18, //         the status page opens vertically out of the flatline (8 f)
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
