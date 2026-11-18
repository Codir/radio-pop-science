# Chapter `circuit/battery` — «Що робить батарейка?»

Script: `docs/volumes/circuit/chapters/battery.md` (path format). Four steps on the stand floor of the composed world
(`@circuit/shared/world`); the battery opens where it lies (`stand.stand.battery.inside`, stage README «Battery
inside»). All reader text comes from the generated content; the scene addresses the script's «Підписи» by position
(`caption(step, i)`, pinned by `__tests__/manifest.test.ts`). Switch open, lamp off throughout.

## Files

| File                                    | What                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`, `content.ts`                | manifest (lazy scene), runtime content + `caption(step, i)`                                                                                                                     |
| `chapter.ts`                            | `STEP_IDS`, the `Chapter` / `StepModule` contract, session memory of reached goals                                                                                              |
| `world.ts`                              | mounts the world; the cut as a scrub (critically damped glide), the meter's slide and needle, `state(shot)`                                                                     |
| `scene.ts`                              | orchestrator: world → step factories → `world.define` + `stepUi.define` → update routing; QA `battery`                                                                          |
| `steps/01-poles.ts` … `04-voltage.ts`   | one factory per step: input, probes, stage state, UI, update                                                                                                                    |
| `parts/poses.ts`                        | shots `poles` (battery + lens over either end), `cut` (the stage's `battery`, phones framed lower), `meter` (the battery and the meter together); the lens poses over «−» / «+» |
| `parts/lens.ts`                         | the lens in the reader's hand: glides holder ↔ ends from wherever it is, follows a drag                                                                                         |
| `parts/metal.ts`                        | the metal of a pole in the lens window: copper world's top surface in the ring, no plastic, `sim.surface` / `lattice.edge`                                                      |
| `parts/scale.ts`                        | the pole scale «бракує · порівну · забагато»: a screen-sized card on the overlay layer, gliding pointer                                                                         |
| `parts/cue.ts`                          | the hover ring «you can put it here / take this»                                                                                                                                |
| `qa/interactions.mjs`, `qa/helpers.mjs` | the pointer-driven test of every goal, mouse or real touch (below)                                                                                                              |

## Steps

| Step      | Shot              | What the reader does → goal                                                                                                                                                                                                                                                                                                                           | Captions                                                                                                                    |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `poles`   | `stand` → `poles` | tap the lens (→ «−»; on an end: → the other end), tap an end, or drag the lens; the window opens on the metal: on «−» the electrons crowd the surface, on «+» they keep a row away and the edge atoms glow coral; the scale card beside the rim slides with it; goal: ≥ 2 s on each end                                                               | scale names 0–2; «полюс» ×2 over the ends at the takeaway (the scale fades), wires tint `poles` 0 → 1                       |
| `inside`  | `cut`             | dock slider «Розріз» = the cut (drag both ways, click eases); tap zinc / separator / oxide (one name at a time, the layer lifts); 1.6 s after the third the first moment: the scale (minus only, under the cap) falls to «порівну» in 1.1 s, `cell.hold` refills the poles (≈ 4.6 s, events thinning); goal: all three and the scale back at the mark | «Розріз» (slider), layer names on tap                                                                                       |
| `balance` | `cut`             | drag the clump off the minus cap (hover ring); let go far → it melts, the reaction refills (≈ 3 s); any number of times; goal: fell ≥ ⅓, melted, back at the mark                                                                                                                                                                                     | «зайві електрони» on hover / in hand, «межа цинку» for 6 s after a release                                                  |
| `voltage` | `meter` → `stand` | the cut closes, the meter slides onto the table; drag each probe to its clamp (sticks only to its own within 0.42, else glides back); needle → 1,6 (`meterVoltage`, `followVoltage`); goal: both on, 1 s on 1,6; 6 s after the takeaway the probes go back, the meter leaves, the camera settles on `stand` (the chapter's last frame)                | «вимірювач» until a probe touches, «1,6 V» on phones (the meter's own number is too small there), «напруга» at the takeaway |

Every step re-derives its state in `enter`; deep links land on the frame a reader arrives at. «Назад» plays back: the cut
closes or reopens on its spring, the meter slides away with its probes, the lens glides home.

## QA

`node app/src/volumes/circuit/chapters/battery/qa/interactions.mjs --port <port> [--size 1280x720] [--touch] [--out <dir>]`
(frozen clock, plain address; mouse or `Input.dispatchTouchEvent` fingers; every step change and the cut slider sampled
frame by frame — camera ≤ 0.3 units, cut ≤ 0.06, meter ≤ 0.06, pointer ≤ 0.08, lens ≤ 4 % of the height per frame).
Frame scripts: `/srv/electricity/qa/B-circuit-battery/look.mjs` + `s-*.mjs` (strips of the cut, the first moment,
the step changes).

## Simplified / differs from the script (also `docs/requests/B-circuit-battery.md`)

- The metal in the lens is the copper world's lattice (VISUAL §6 shared look), not iron atoms of the steel cap.
- `voltage`: the camera goes to `meter` — the battery and the meter together, needle and «1,6 V» readable — and back
  to `stand` once the meter is put away (the script: «камера повертається на план «Стенд»»).
- `inside` / `balance`: the open cut has its own soft key light (the stage's `battery.inside.island`, VISUAL §2 «освітлений острів»),
  on in these two steps only; with the lamp lit the stage scales it down.
