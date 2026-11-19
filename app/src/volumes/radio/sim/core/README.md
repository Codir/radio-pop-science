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
