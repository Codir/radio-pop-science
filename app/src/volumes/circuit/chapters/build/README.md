# `circuit/build` — «Зберіть коло самі» (the practicum, the volume's last part)

Script: `docs/volumes/circuit/chapters/build.md`; writer's notes `docs/requests/C-circuit-4.md` (A 9–11).
Four steps on the stand; the chapter opens on the lit stand (the neighbours' frame) and ends on the prologue's
first frame — the flashlight shining in the dark room — with the volume's closing card over it.

## Files

| File                                               | What                                                                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scene.ts`                                         | wiring of the steps, the lens input, `qa.expose('motion' / 'build')`                                                                                                 |
| `bench.ts`                                         | the world + wiring + switch + the rule «the lamp has power exactly when the model says `lit`» (`closed` = power)                                                     |
| `parts/circuit.ts`                                 | **pure model** (unit-tested): six clamps, three wires, ends in clamps, `contact`, `whole` → `lit` / `open` / `short`; `switchControls`                               |
| `parts/clamps.ts`                                  | mouths and outward directions of the six clamps, resting places of the loose ends, the raised ground loose wires drape over                                          |
| `parts/ends.ts`                                    | one end: place (clamp + slot · lying · hand), travel from the shown pose (eased, low arc), `hop`, `seated`                                                           |
| `parts/curves.ts`                                  | loose wire shapes: Hermite between two ends, a route with a peeled tail, point-wise blend                                                                            |
| `parts/wiring.ts`                                  | A = `p1`, B = `p2`, C = `m` (one wire); writes the stand's pieces while `active` and `unfold ≥ 1`; a wire home in its stand clamps settles onto its route |
| `parts/grips.ts`, `parts/hands.ts`                 | cyan grips; drag → click into the nearest clamp within `SNAP` (a clamp takes two), drop = lies there                                                                 |
| `parts/switch.ts`                                  | the slider placed by the chapter, tap to flip                                                                                                                        |
| `parts/magnifier.ts`                               | `find-fault`'s real magnifier: stencil portal on the lens glass + twins of the nearby stand meshes scaled about the focus                                            |
| `parts/swap.ts`                                    | `find-fault` 3: the broken far wire rolls off behind the board, a whole one comes back the same way                                                                  |
| `parts/thermal-warm.ts`                            | `short`: warm twins (battery body, wires) over the stage's heat view, same false colour, same ring test                                                              |
| `parts/lens-keeper.ts`, `loop-track.ts`, `rail.ts` | copies of `lamp/parts/…` (`idle` added to the keeper)                                                                                                                |

## Steps

- `first-light`: lit stand → the six ends come out one after another (≈ 2 s) and lie in front of the stand; any end
  into any clamp; goal = `switchControls` + the lamp has shone + the reader put it out with the switch.
- `find-fault`: the reader's wiring goes home; three faults, each arriving with a «reset» (every end hops out and
  back, the lamp dark): (1) the plus end in «−» (touch the clamp), (2) the lamp wire clamped by its sheath at the
  lamp's bottom terminal, (3) the far wire's copper broken under the sheath — 2 and 3 seen and mended through the
  lens (drag it along the loop; tap it when it is over the place). 1.5 s of light after each repair.
- `short`: frame on `p1` reads amperes (0,3 → ≈ 6 → 0), heat lens on the battery, the lamp wire's end to «−».
- `flashlight`: slider «Скласти» = 1 − `unfold`; camera on its own rail stand → `flashlight` with the prologue's
  timing; `moon` = the prologue's ramp; poles fade to the neutral sheath; the card (`board`) 1.6 s after the end.

## QA

`qa/interactions.mjs --port <p> [--size WxH] [--touch] [--out dir]` — 34 checks (every goal by pointer, per-frame
continuity on entries, resets and the slider, «Докладніше», «Згадайте», the card, console). Frames:
`/srv/electricity/qa/B-circuit-build/`.
