# Chapter `circuit/flow` — «Що тече в дроті?»

Script: `docs/volumes/circuit/chapters/flow.md` (all reader text from `content/generated/flow.json`, captions by
position — `__tests__/manifest.test.ts`). World: `@circuit/shared/world` (stand + copper). Plan «Стенд» throughout;
first and last frame are the stand shot.

## Files

| File                                                    | What                                                                                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scene.ts` · `chapter.ts`                               | orchestrator (world → step modules → `world.define` + `stepUi.define`); contract, session goals                                                                                                                   |
| `stand.ts`                                              | the world plus the chapter's props, each a number that travels (`parts/glide.ts`); stage `closed` = «the circuit is whole» (the lamp), the slider is placed by `parts/switch.ts`                                  |
| `parts/loose-end.ts`                                    | `connect`: the minus wire's end bent out of its clamp, cyan grip                                                                                                                                                  |
| `parts/counter.ts`, `count-display.ts`, `loop-track.ts` | the counter frame as a bead on the loop (hops over switch, socket, seat; never into the battery), the exact count of 0.3 A with rolling low digits, the ring of the second; on phones the number is a DOM callout |
| `parts/jumper.ts`                                       | `loop`: the second seat's jumper hopping into the first seat (mount part `seatJumper`)                                                                                                                            |
| `parts/water*.ts`                                       | `pump`: the water picture as one `morph` (pipes swell out of the wires, battery → pump, lamp → narrow place with a wheel, switch → tap, bubbles)                                                                  |
| `parts/lenses.ts`, `lens-picture.ts`                    | `together`/`push`: three lenses (the stand's own + two copies), each a one-draw-call picture of «усередині міді» with its own common shift                                                                        |
| `parts/clock.ts`                                        | the snail slider's time words, the goal's hold (same helpers as the prologue's)                                                                                                                                   |
| `qa/interactions.mjs`                                   | every goal by real pointer input (mouse or `--touch`), continuity sampling on every step entry                                                                                                                    |

## Steps

| Step       | Reader does → goal                                                                                                                  | Notes                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connect`  | drags the cyan grip into the minus clamp → lit, 2 s                                                                                 | lens over the near wire as a window (`window: 1`, span 8.5, `sim.leash` 1.7, `sim.box` 6.25, drift 6 %)                                                                                                                        |
| `count`    | drags the frame onto any wire → one full second counted                                                                             | «0,3 A» under the number at the takeaway                                                                                                                                                                                       |
| `same`     | slides the frame along the wire, a second in each of 4 stretches                                                                    | «перед/після лампочки» at the frame                                                                                                                                                                                            |
| `loop`     | carries the slider to the second seat (circuit opens at once), lays it in (the jumper hops, lamp lights), clicks it open and closed | frame slides by itself to the near wire on entry; the loop glows faintly once at the takeaway                                                                                                                                  |
| `pump`     | clicks the tap shut and open                                                                                                        | the picture comes/goes as one 2 s / 1.4 s morph; cold room (no lamp), ambient lifted                                                                                                                                           |
| `snail`    | slider «Час» to the end, 1 s                                                                                                        | `stand.crawlScene` unchanged, own slider step; the crawl arrives after the water picture has turned back                                                                                                                       |
| `together` | clicks the switch, closed 2 s                                                                                                       | three lenses lie down one after another; shift on/off in all three in the frame the circuit closes/opens                                                                                                                       |
| `push`     | slider «Час» 0…1 ns to the end, 1 s                                                                                                 | `shared/stage/loop-glow.ts` from the switch both ways, meets at 0.8; a lens starts drifting in the frame the wave passes it; lamp dark; 3.5 s after the takeaway the lenses leave and the lamp lights (the closing stand shot) |

## QA

`node app/src/volumes/circuit/chapters/flow/qa/interactions.mjs --port <port> --size 1280x720 [--touch] [--out <dir>]`
(53 checks; frozen clock). Scratch tools, strips and contact sheets: `/srv/electricity/qa/B-circuit-flow/`
(`look.mjs <scenario>`, `sheets.sh`, `sheets/contact-*.jpg`).
