# Chapter `circuit/charge` — «Що тримає електрон біля ядра?»

Script: `docs/volumes/circuit/chapters/charge.md` (path format). Six steps: on the table in front of the stand
(props of this chapter), under the lens, and on the lower floors of the copper world. All reader text comes from
the generated content; captions are addressed by position (`caption(step, i)`, pinned by `__tests__`).

## Files

| File | What |
| --- | --- |
| `index.ts`, `content.ts`, `chapter.ts`, `scene.ts` | manifest; content + `caption`; step contract (`tick` runs every frame for a step's own props arriving / leaving); orchestrator (the arrival from `wire`'s last frame) |
| `world.ts`, `layout.ts` | the composed world + the props on the table; the table shots (`charge-table`, `charge-spheres`, `charge-field`, `charge-spare`) with depth of field on the props; where every prop stands |
| `parts/balloon.ts`, `figure.ts`, `strands.ts`, `hanger.ts` | the balloon; the figure with 64 hair strands in one dynamic geometry; the second balloon on a thread (a damped pendulum) |
| `parts/handle.ts`, `rub-state.ts` | the hand on the balloon (drag plane, obstacles, glides on an arc when a step sends it somewhere); rubs, charge, pull on the hair, push on the second balloon |
| `parts/lens-keeper.ts`, `lens-view.ts`, `banks.ts` | the lens carried by the chapter (glides; hands back to the stage's own pose seamlessly); the window onto rubber and hair (the world's stencil window reused) |
| `parts/spheres.ts`, `arrow.ts` | four charged spheres with contact shadows; thick `amber` force arrows ∝ 1/d² (capped) |
| `parts/glyphs.ts`, `crumbs.ts` | «+» / «−» stickers over the copper atom (overlay layer, crisp under the depth of field); two pieces of copper |
| `parts/trail.ts`, `spare.ts` | ≤ 40 pale arrows of the field (additive, the oldest fade); the spare piece of wire |
| `steps/01-rub.ts` … `06-shift.ts` | one factory per step |
| `qa/interactions.mjs`, `qa/helpers.mjs` | the pointer-driven test (below) |

## Steps

| Step | Where · shot | What the reader does → goal | Captions |
| --- | --- | --- | --- |
| `rub` | table · `charge-table` (stand right, soft) | arrives from the stand shot (2.6 s); drag the balloon over the hair (≥ 3 rubs = 6 moves of ≥ 0.22), draw it away (hair rises, held 0.5 s), bring it to the second balloon (lean ≥ 0.16 rad), in that order | «кулька» on hover / in hand, «волосся», «друга кулька» |
| `charge` | table · `charge-table` | the balloon glides onto the hair; drag the lens from its holder (full cyan) to the contact (lands within 0.85); rub by dragging the lens or the balloon: each move slides the banks, one electron hops; counter 100 000 000 000 a move → 600 000 000 000; goal: placed, 6 moves, ≥ 5 hops | «гума», «волосся», «перейшло електронів: N»; → «заряджена кулька», «заряджене волосся» |
| `signs` | table · `charge-spheres` | slide the spheres; arrows on the sphere in hand and its nearest (else the nearest pair); goal: −−, ++, +− each closer than 2 diameters | «−» / «+» on hover; → «негативний заряд», «позитивний заряд» |
| `neutral` | flight through the lens on the near wire to «один атом», then up to «ряди» (`charge-crumbs`) | «+» on the nucleus, «−» on the 29 electrons, «+29», «−29» for 3.4 s; the crystal thins to two pieces (18 + 18 atoms, 9 + 9 free electrons, «+» on the front ions); carry electrons across; goal: ≥ 3 carried, a piece non-zero once, «разом» 0 | «+29», «−29»; «0» over each piece; «разом: 0» → «разом: 0 — нейтральний» |
| `field` | table · `charge-field` | the probe comes once the camera is on the table; drag it round the hanging balloon; a copy every 0.36; goal: ≥ 8 copies, distances ≥ 3× apart | «пробник», «заряджена кулька»; → «електричне поле» |
| `shift` | table · `charge-spare` | the lens glides over the spare piece and opens as a window («ряди»); bring the balloon near an end: `sim.lean` → 0.8 × closeness² (nothing beyond the piece's length), τ 0.33 s; coral glow over the uncovered side; goal: near, settled ≥ 2 s, then away and even; 3.5 s later the window closes, the balloon goes home, the lens to its holder, the camera to `stand` | «заряджена кулька», «шматочок дроту» |

Lamp off all chapter (chapter 1 ends with it off); no «+»/«−» before `signs`. Every step re-derives its state in
`enter` (deep links = the frame a reader arrives at); goals reached are kept for the session.

## What is simplified (honest list)

- The balloon, figure, hair and spheres are a picture model, not electrostatics: hair pull falls off over ≈ 3
  units, the second balloon leans ∝ 1/d², arrows ∝ 1/d², the crowd's lean ∝ closeness².
- The counter counts moves, not the hops seen (it counts the whole balloon, as the script says).
- `neutral` uses the stand's own door and the chapter's own pieces (requests §7, §8).
- The «600 мільярдів» is shown in digits (requests §6).

## QA

`node app/src/volumes/circuit/chapters/charge/qa/interactions.mjs --port <p> --size 1280x720|1920x1080|390x844`
(390×844 drives by touch through the DevTools protocol). Arrives from `wire/plastic`; checks the first frame is the
stand shot and the last frame equals it; samples every step change frame by frame (camera, balloon, lens: no frame
moves > 3× both neighbours, steps under 0.06 units ignored — requests §4). Scratch drives and strips:
`/srv/electricity/qa/B-circuit-charge/{*-drive.mjs,walk.mjs,strips/}`.
