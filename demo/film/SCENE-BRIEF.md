# Scene owner brief (common to every scene builder)

You build some scenes of the Last Save demo film in Remotion 4.0.543 (React 19), cwd
`demo/film` in this repo. Read first, in this order:
`PLAN.md` (§2 direction, §4 shot list, §5 transitions; your rows are the contract), this file,
`src/film/timeline.ts`, `src/ds/*` (tokens, type, crt, screen), `src/film/Slot.tsx`, and the style-frame code in
`src/frames/` (FrameA = inside the screen, FrameB + `frames/b/*` = device in space with an object lifting off, FrameC
+ `frames/c/*` = the isometric machine). The rendered style frames are in `out/frames/*.png`. Look at them.

## Ownership
Edit ONLY your scene files `src/scenes/v1/Sxx.tsx` (keep the exported component name) plus new files in
`src/scenes/v1/<your group folder>/`. Never edit ds/, film/, frames/, Root.tsx, other scenes, PLAN.md or audio. If you
need a shared primitive changed, copy it into your folder. Do not commit and do not run full-film renders.

## The look (binding)
The approved Last Save terminal only: tokens in `src/ds/tokens.ts`, faces Archivo (display, sunset bands via
`<Display>`), Chakra Petch (labels), IBM Plex Mono (body). Stepped terminal motion (print-in steps(5) 400 ms with 55 ms
stagger, decode 25 ms/char, dial-up 720 ms, load bar steps(8)), and eased camera moves (ease-out 0.23,1,0.32,1).
References taught construction only. No new colours, fonts, gradients or emoji.

## How a scene is built
- One continuous world. Camera travel, objects that become the next shot, small supporting motion; every hold drifts
  (slow push +2–3 %). Never entrance-then-hold cards, never connector-line diagrams, never same-size card grids.
- One idea on screen at a time; nothing crosses text; text fits with padding; legible at 1080p (UI text ≥ 18 px on
  screen after camera scale: push into takes, e.g. 1.3–1.6× on the region that matters).
- Footage: `<Slot slot="<id>" plate="<file>" from={sec} />` with ids from FOOTAGE.md. Real takes land later as files;
  until then the slot shows a preview capture or a still plate. Design the scene so the real take drops in: frame the
  region of the app where the action happens (PLAN §4) with `crop` or a Camera push, and keep any overlay away from it.
- In-screen scenes use `<ScreenFrame>` from `src/ds/screen.tsx` (the app's exact chrome at 1x) so motion scenes and
  takes cut together with identical chrome. Status bar title and mode follow the story (online → dead → released).
- Explorer flashes: a ~1-s window that opens with the dial-up box and closes with a quick CRT collapse.
- Land beats on narration words: word times are in `vo/timings/Vxx.json` (seconds from the VO start); the VO starts at
  `voFrame(sceneId)` inside your scene. A beat lands on the word's start frame or 2–4 frames before it.
- Your first frame must match the previous scene's last pose and your last frame the next scene's first pose, as
  PLAN §5 describes. Where PLAN is silent, end in-screen scenes on a settled ScreenFrame pose.
- Every number or claim on screen traces to README.md, proof/ or a real tx. Use the take's own numbers; where you must
  draw a number in motion graphics, use the contract config from PLAN §7 or write `TBD` and say so in the handback.
- Identity: the terms in scripts/check-identity.mjs never appear in any frame, file or metadata (the commit hook enforces it).
- Files under 300 lines. Deterministic: frame-driven only (useCurrentFrame), no Math.random, no CSS animations.

## Check before handing back
Render stills with the installed Chrome (the bundled headless shell is broken on this Mac):
`npx remotion still src/index.ts Sxx out/scenes/Sxx-<frame>.png --frame=<n> --log=error --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
For each scene inspect at full resolution: the first frame, every transition's start, middle and end, each landed beat,
the hero pose and the last frame. Fix defects (overlap, clipping at the frame edge, text behind objects, unreadable
UI, seams that don't match) and re-render. Run `npx tsc --noEmit` (errors in your files must be zero). Keep local
renders to stills (the Mac is short of memory). A short `remotion render --frames=a-b` of one transition at
--scale=0.5 is fine if you need to see motion.

## Handback (short)
Files written; the stills you checked (paths); what each scene does at which frame; placeholders, TBD numbers and
anything that needs a real take to look right; seam poses you assumed at your first and last frame.
