# `sim/core` — the signal model of the volume «Радіо»

Everything the monitor in the scene shows is computed here from the state of the scene: the camera's frame becomes
a video signal, a frequency-modulated wave, a sum of rays and noise on the monitor's antenna, and a picture again.
The model is pure TypeScript on typed arrays. It imports nothing from the engine, three.js or the DOM and never
reads a clock, a timer or unseeded chance, so the same code runs in a worker, on the main thread and in the
tests. `__tests__/purity.test.ts` keeps this by reading the text of every file under `sim/`; the forbidden names
are looked for in comments too, so they are not written even there. The rest of the volume uses only what
`index.ts` exports.

## Modules

| Module | What it does | Source of the formulas |
|---|---|---|
| `standard.ts` | The reduced standard: the scale `K` between model and real frequencies, the frame of 128 × 96 cells and 100 lines, the parts of a line, the rates of the channel and of the band, the levels of the signal `u`, the frequency deviation, the band and the grid of four channels, `radPerSample(u)`. | The project (`docs/superpowers/specs/2026-11-17-radio-volume-design.md`), part II §7, in the form of the plan's «Спільний договір» (`docs/superpowers/plans/2026-11-18-radio-pilot.md`). The parts of a line keep the proportions of the 625-line television line: 1.65 : 4.7 : 5.7 : 52 μs. |
| `units.ts` | dBm ↔ amplitude in √mW; the mean power of a block of pairs. | The definition of dBm: 10·lg(P / 1 mW). |
| `rng.ts` | The seeded generator `createRng(seed)` with `fork(label)` for the parts of the model; normal noise from `GAUSS_TABLE`, 65 536 quantiles of N(0, 1). | The mulberry32 generator, the same sequence as `app/src/engine/random.ts`. Sampling by the inverse distribution function; the function itself by P. J. Acklam's rational approximation, «An algorithm for computing the inverse normal cumulative distribution function» (relative error below 1.2·10⁻⁹). |
| `dsp.ts` | Low-pass design `designLowpass`; a filter of real samples, a decimator and an interpolator of pairs, all with memory between calls; the frequency shift `mix`; the fractional delay line `createDelay`. | The window method with the Hamming window (Oppenheim, Schafer, «Discrete-Time Signal Processing»). Polyphase interpolation (Crochiere, Rabiner, «Multirate Digital Signal Processing»). An oscillator read from a table of 4096 angles. A windowed-sinc fractional delay of 12 taps (Laakso, Välimäki, Karjalainen, Laine, «Splitting the unit delay», IEEE Signal Processing Magazine, 1996). |
| `video.ts` | The camera's side `encodeFrame`: a frame of 128 × 96 cells as 100 lines of 288 samples of `u` — front porch, sync pulse, back porch and the 234 samples of the row, stretched from 128 cells by a linear mix of neighbours; lines 96–99 are the frame mark; a camera without its sync block puts 0.3 where the pulses were. The monitor's side `createDecoder(seed)`: a line rhythm of its own (the set length plus a seeded wander within ±0.05 sample) that finds the sync pulses below a threshold and takes out the part `trust` of their error, counts four frame marks in a row as lines 96–99, and shares every sample among the cells it covers by the length of the cover. What it saw: `pulses`, `lost`, `lines`, `lineOffset`, `lineDrift`, `lineRow`. | The layout of a line, the frame mark and the stretch: the plan's «Спільний договір». The receiving side: the algorithm of the plan's task B4 (`docs/superpowers/plans/2026-11-18-radio-pilot/batch-2-model.md`), written out step by step there. Its idea is the flywheel line sync of a television receiver: a free-running line oscillator that every sync pulse pulls by a part of its error, a phase-locked loop of the first order. |
| `fm.ts` | The camera's transmitter `createModulator`: u → pairs of length 1 whose phase, kept in double precision within ±π, grows by `radPerSample(u)` every sample. The monitor's side: the limiter `limit` (a pair at least the floor long gets the length 1, a shorter one is divided by the floor; `LIMITER_FLOOR_DBM` −100 dBm); the slope detector `createSlopeDetector`, a tuned circuit of one pole y[n] = x[n] + r·e^(jθ)·y[n − 1] (r 0.2, θ 82°) followed by the line gain·\|y\| + offset that puts black at 0.3 and white at 1 (`slopeStatic` is its settled output); the angle detector `createAngleDetector`, angle(x[n]·conj(x[n − 1])) read back as u; the filter of the video signal `createVideoFilter`, 31 taps cut at 5.5 MHz of 20. `SYNC_THRESHOLD` cuts the sync pulses halfway between their bottom and black at the output of each detector. | Frequency modulation by its definition: the phase is the sum of the instantaneous frequency. The angle detector: textbooks of digital signal processing, e.g. R. G. Lyons, «Understanding Digital Signal Processing», the section on frequency demodulation algorithms. The slope detector: the frequency response of a recursive filter of the first order, 1/\|1 − r·e^(j(θ − ω))\| (Oppenheim, Schafer, «Discrete-Time Signal Processing»). The numbers r, θ, the floor and the thresholds: the plan's task B5; the fixtures `fm-phase.json`, `slope-curve.json` and `angle.json` of `tools/ref-models/radio/fm_chain.py`. |
| `site.ts` | The yard in numbers, metres (x to the east, y to the north, z up, the origin on the ground under the camera): `SITE` is `site.json` after a check of its shape (five stops, finite numbers, known materials, unique wall ids, an axis with a direction, a leaf with a length); a wrong shape throws when the module loads. `LOSS_DB` — what one wall of each material takes: brick 8, wood 3, glass 1, slab 10, iron 30 dB. Only the walls of the house and the open leaf of the garage gate are in it: the shed and the garage are things of the scene. | `site.json`, written by the plan's task B6a from the tables «Подвір’я» of `docs/volumes/radio/VISUAL.md`; the reference `tools/ref-models/radio/link_budget.py` reads the same file. The losses: the plan's «Спільний договір». |
| `channel.ts` | The rays from the camera's antenna to the monitor's. `routePoint` — the monitor on the route, exact on the stops, on a straight line between them; `wallsBetween` — the walls whose segment the ray's trace on the plan crosses, and the slab when the ends lie on different sides of it; `pathGainDb` — 2 × 1.1 dBi − free space (λ = 0.1224 m) − walls. `trace` gives the direct ray and, with the gate open past 0.3, the ray from the leaf of the garage gate (a mirror on the plan, coefficient 1, the amplitude times s²(3 − 2s)), both behind the edge of the tray; the level `rxDbm` in the middle of the camera's channel (`responseDb`, the sum of the rays at one frequency) and the field `fieldVm` that would give it on the antenna. `createAir(seed)`: `apply` adds the rays to the band signal — amplitude, the carrier's phase at 2441 MHz, and a delay line each with the real delay stretched `K` times (0.1 sample per ns); `noise` — seeded normal noise on the antenna. | The rules of geometry (walls, slab, leaf, gate, tray): the plan's task B6a. The formulas and their open sources: the table «Джерела формул» of `tools/ref-models/radio/README.md` (free space, walls, reflection from the leaf, the gate, diffraction over the tray's edge, the level of several rays, the field from power). Two independent calculations of the same yard: `channel.test.ts` compares `trace` with the fixtures `ladder.json` and `notches.json` of `link_budget.py`. |

## Conventions

- **Frequencies.** The model computes at reduced frequencies; scales and labels show the real ones:
  real = model × `K` (`shown`, `model`). A name or a comment that says «real Hz» is already real.
- **Signals.** A signal with both shadows is a `Float32Array` of pairs `[re0, im0, re1, im1, …]`. The unit of
  amplitude is √mW: `re² + im²` is the power in mW, `powerDbm` gives it in dBm.
- **Continuity.** The model is continuous between frames: every block with memory continues the stream of its
  previous call, and the result does not depend on how the stream is cut into calls. `reset()` forgets the
  stream; after it a block repeats its output bit for bit.
- **No allocation per frame.** `process`, `add`, `mix` and `gaussFill` write into arrays the caller owns. An
  output array must not overlap the input (only `mix` may work in place) and must be long enough.
- **Chance.** All noise comes from `createRng(seed)`. A part of the model takes `fork(label)`: a fork depends
  on the seed and the label only, so adding a consumer does not change the numbers of the others.
- **Delays.** `createDecimator` gives `out[k] = Σ h[i]·x[m·k − i]`; a symmetric filter of N taps delays by
  (N − 1)/2 samples; `createDelay` adds `DELAY_LATENCY` samples to every ray. The delay of the whole chain is
  computed from these lengths.
- **Loops over samples** read no imports: constants and functions of other modules go into local `const`s
  before the loop. Under vitest every read of an import costs about 13 ns, which would make a measurement show
  vitest, not the model.

## Tests

```bash
cd app && pnpm test src/volumes/radio/sim                               # the whole model
cd app && pnpm test src/volumes/radio/sim/core/__tests__/dsp.test.ts    # one module
```

`__tests__/helpers.ts` holds the numeric helpers shared by the tests (`gainDb`, `mean`, `std`, `share`,
`argmax`, `spread`, `centre`, `meanPowerDbm`).
