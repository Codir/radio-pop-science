# `circuit/prologue` — «Клацнув вимикач — і світло. Що сталося за цю мить?»

Script: `docs/volumes/circuit/chapters/prologue.md` (all reader text from `content/generated/prologue.json`).
World: `@circuit/shared/world` (stand + copper, see its README). Interface: `?hud=dom` (the default).

## Structure

| File                     | What                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `index.ts`, `content.ts` | manifest from the generated content; theme `studio`                                                             |
| `scene.ts`               | mounts the world, step states (`world.define`), goals (`stepUi`), QA state `__app.read('prologue')`             |
| `shots.ts`               | `map` = the world's «away» frame (the stand out of focus behind the board)                                      |
| `steps/switch.ts`        | the yellow slider as a direct control (tap = flip `closed`), counts lightings                                   |
| `steps/open.ts`          | `open`: the «Розкласти» slider drives `unfold`; let go → plays on; camera flashlight → stand at beat 3          |
| `steps/dive.ts`          | `dive`: take the lens (tap / drag), the depth wheel (three stops) flies the world                               |
| `steps/riddle.ts`        | `riddle`: the crawl under one slider of true time (`clock.ts`: the time in the script's words, the goal's hold) |
| `steps/map.ts`           | `map`: the platform's journey map (`journeyInset`) on the step's board, the stand blurred behind                |
| `qa/interactions.mjs`    | every goal by real pointer input, takeaways, «Докладніше», console                                              |

## Steps — states and interaction

1. **click** — `flashlight`, `unfold 0`, `moon 0`, lamp off. Callout «вимикач» on the slider (it glows faintly in
   the dark, W1). Tap the slider: on/off. Goal: two lightings and the lamp on now.
2. **open** — enters with the lamp on. Dock slider «Розкласти» = `unfold` directly (both ways, stop anywhere); idle
   0.8 s → it plays on at the stage's pace (6 s for the whole). The camera moves to `stand` when beat 3 starts
   (back below it). The cold room light comes up with the stand. Names of parts on hover / long press («батарейка»,
   «лампочка», «вимикач», «дріт», «корпус»). Goal: `unfold` = 1.
3. **dive** — `stand`, lens in its holder calling (`lensCall`), callout «лупа». Tap / drag the lens → it lies on the
   wire, the camera comes to `lens`. Wheel «Глибина» (disabled until then): stops «стенд» / «усередині дроту» /
   «ряди кульок»; each change is a flight (ring 2.1 s, floor 2.2 s). Goal: last stop, 2 s there.
4. **riddle** — the crawl (DECISIONS §60 t, `stand.crawlScene`): one slider «Час» (`riddle-time`, 0 … 136.4 s, marks
   «0 с» / «2 хв 16 с», the value in true time with the script's unit words) is the moment of the scene. A drag
   follows the thumb, a click on the track or a key glides there (speed-limited, the whole range ≥ 3.5 s), the
   track's fill is the shown moment. Lamp off at 0, on in the frame the time leaves 0, off again at 0; the stand's
   switch is inert. The snail crawls its 13.6 cm beside the wire, the marked spark in the magnifier at the wire's
   start reaches «6 мм». The scene arrives once the reader is back on the stand (flight up from «ряди») and leaves
   with every other step; from a lit `dive` (or back from `map`) the lamp dims over 1.4 s. Back from `map` the
   time starts at 0 again (the takeaway stays). Names «равлик», «позначена іскорка» on hover / long press.
   Goal: the slider at its end, held 1 s.
5. **map** — camera pulls back, the stand blurred behind; the volume's journey map (`@/hud-dom/journey`
   `journeyInset`: the same stops, floors and «лишилося ≈ N хв» as «Мапа подорожі») on the board. Goal: all seven
   chapter stops opened (`onOpen`).

## Simplified / differs from the script (also in docs/requests/B-circuit-prologue.md)

- No «де ми» mini-ladder (a platform HUD element); the dive wheel's stop names play that role in `dive`.
- `open`: a third shot `opening` (the flashlight shot pulled back) for beats 1–2, so the halves stay in the picture.
- `world.lensPose` is no longer used by the prologue (the stand's `besideRace` pose replaced it); kept in the world.
