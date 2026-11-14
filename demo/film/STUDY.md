# Last Save film: reference study (14 Nov, IST)

The references teach how to build the film: shot construction, camera travel, transitions, timing, sound and pacing.
They never set its look. The look is the approved Last Save terminal (web/src/styles.css, the live preview at
last-save-preview.pages.dev) plus Ember Rift's art. Evidence paths are listed at the end.

## What was studied, and how
| Reference | Access | Method |
|---|---|---|
| Pine Labs P3P, Opus recreation (accepted bar, 28 Sep) | local teaching copy | STUDY.md and RETRO.md, native-rate sheets (`study/native/n1190_1249.jpg`: card collapses into the word "Gold") |
| App Building in Grok, Astra recreation (accepted bar) | local teaching copy | STUDY.md and RETRO.md, transition strips (`study/v5/transitions/phone-pull-0320.jpg`, `dialog-1295.jpg`) |
| Local Edition (Qloo) | youtu.be/D3mw2Bbj5qs, 177.7 s, 1080p30 | download, 1 fps sheets, scene detection at 0.04 and 0.25, bracket frames at 6 transitions, loudness, captions |
| Wallspace (Qloo) | youtu.be/-mzQMyPcbN4, 170.8 s, 1080p30 | same as Local Edition |
| vibrant.design/launch-videos | public page, about 27 films | Runinfra (37.1 s) and Linear Loops (28.5 s) downloaded and analysed; six more read from page tags only |

I read the decoded frames and the computed audio measurements. I did not listen to any reference with my own ears.
Local copies of the two Qloo films were not found (`media-offload --where` returned nothing), so YouTube was the
source for both.

## Construction lessons we will use
1. **One continuous world, objects carry the cut.** Pine Labs has only 6 true hard cuts in 88.6 s, and Qloo Local
   Edition has 2 in 177.7 s. In Local Edition at 33.1 s an orange square becomes the first pin on the 3D map, and in
   Pine Labs at 41.0–41.4 s the "Gold" photo card shrinks into the word over about 10 frames. Our version: the match
   window collapses like a CRT powering off and its line becomes the flatline; the licence lifts off the store screen
   and becomes the pool bar; the server build is one object travelling from the studio to the enclave.
2. **Device push and pull, with content that never stops.** In Grok at frames 301–356 the phone contracts from
   full-bleed to a framed device in about 1.2 s while the race keeps running. In Grok at 1283–1303 the Publish pill
   travels into the dialog it opens. Our version: real footage plays inside the LS-0001 screen; the camera pushes
   through the glass into a take and pulls back out to the terminal.
3. **Type is timed per glyph and lands on the beat.** Pine Labs types about 1 glyph per frame, with colour that ages
   per glyph, and cuts within ±0.1 s of a musical onset. Our type already has its own native motion: the decode (25
   ms per character), the print-in (steps(5) over 400 ms, 55 ms stagger) and the dial-up (720 ms). The film uses
   these, frame-driven, and lands each one on a VO word or a music hit.
4. **Every hold drifts.** Pine Labs and Grok never sit fully still: holds drift 1–3 px per frame or scale slowly.
   Our version: a slow push (+3 % over 4 s) on every hold, grain stepping through 8 seeds, and an occasional CRT roll bar.
5. **One idea on screen at a time.** Each reference shows one phrase or one object at a time. Wallspace stacks its
   labels above the object they describe (score, then price, then visibility). The rough cut broke this rule with
   three-box diagrams, so those are replaced by one travelling object.
6. **A real product plate, zoomed until readable.** Local Edition at 43.6 s zooms into a real dashboard screenshot,
   and Wallspace at 1:58 does the same. The Strehl film's UI was too small to read. Our UI is shown at 1.3–1.6x
   inside the screen, and each chain beat flashes its explorer page for about 1 s.
7. **Camera travel through a 3D world.** Wallspace drops from an overview to street level at 71.7 s and flies past
   five boards between 95.9 s and 108.6 s, with labels facing the camera. Linear Loops swings the camera at 6.8 s to
   follow a comet along an arc, and its labels blur in as the comet reaches them. Our version is the isometric
   "machine" for the escrow beat (style frame C).
8. **Hard cuts are rare and saved for meaning.** Runinfra uses a full-colour flash cut only twice (5.2 s, 33.0 s), and
   Local Edition cuts hard to its one dark scene at 43.6 s. Our hard cuts: the kill (the screen goes red) and the
   release (the screen goes gold). Everything else is continuous.

## Pacing and sound measured
- Narrated films: Local Edition is -15.0 LUFS (LRA 2.4) with VO and music and no distinct SFX; Wallspace is
  -14.0 LUFS. Both hold a quiet tail only under the end card (Local Edition: 173.1 s and 175.8 s).
- Music-led films: Pine Labs at about 99 BPM with every scene change on an onset; Runinfra at -18.7 LUFS with a beat
  every 1.5–2 s; Linear Loops at one label per beat (about 60 BPM).
- Our plan: VO on top, music ducked under it, **action-specific SFX** (the references have almost none, but house
  rules want them; the terminal's own sounds are type, key and blip), **one real silence** after the flatline, and
  the music returning on RELEASED. Master to -14 LUFS, true peak ≤ -1 dBTP.

## What the rough cut gets wrong (fixed by the new plan)
Inter/JetBrains type and an ad-hoc palette instead of the app's Archivo/Chakra Petch/Plex and sunset palette;
entrance-then-hold cards; three-box diagram connectors; footage full-bleed with pill captions; one whoosh-like SFX
per beat; no camera.

## Three style frames (stills in `out/frames/`, each a 4 s composition `FrameA|B|C` in the StyleFrames folder)
- **A, Inside the screen** (`A-39.png` collapse, `A-105.png` hero), on the kill beat. The frame is the CRT screen.
  Footage plays in windows the terminal opens; the status bar is the chapter marker and decodes on each change.
- **B, The terminal in space** (`B-*.png`), on the buy beat. LS-0001 is a physical device at a 3/4 angle over Ember
  Rift's nebula. Footage plays on its screen, and objects (the licence) lift off the glass and carry into the next shot.
- **C, The machine** (`C-*.png`), on the "promise is code" beat. An isometric world where the server build is one
  object the camera tracks: encrypted, copied to studio CDN and Walrus, logged by Sigstore, with its key into the enclave.
The UI inside the frames is preview/placeholder data from last-save-preview.pages.dev and the 14 Nov 02:00 takes.
The film itself uses only the v2 judge run.

## Evidence
Teaching copies: `~/Documents/motion-teaching-projects/round2-2026-09-28/{opus-pinelabs,astra-grok}/`.
Qloo and vibrant downloads, sheets, bracket frames and NOTES.md: the session scratchpad `refs/qloo/` (not committed;
the source links are above). App captures: `public/plates/` (gitignored).
