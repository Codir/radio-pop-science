# `shared/sound` — the volume's own sound output

The engine plays only its own sounds (`app/src/audio`), and the platform is not ours to edit, so the volume plays
what the circuit model gives the speaker through a Web Audio output of its own (the design,
`docs/superpowers/specs/2026-11-20-electronics-volume-design.md` §6.3). Two halves:

- **the output** (`output.ts`, `plan.ts`): an `AudioContext` of the volume's own, started by the first gesture, silent
  with `?noaudio`, following the engine's sound and volume settings, through a limiter; blocks of samples planned
  back to back on `AudioContext.currentTime`, at most three at a time, with counters of blocks played, underruns and
  latency; freed with the chapter;
- **the stream** (`stream.ts`, `handler.ts`, `protocol.ts`, `model.worker.ts`): the circuit model (`sim/core`,
  `Transient`) playing the board in blocks in a background thread — one request on its way, a synchronous path when
  there is no thread — after `radio/shared/link` (copied, not imported: `docs/volumes/electronics/REUSE.md`).

Beside them: `tape.ts` (the last samples by their index, for a scope that shows what is heard now) and `board.ts`
(the board of the sound check and what a sandbox needs of `sim/core`: a sandbox imports only `shared/**`).

```ts
import { BOARD_PROBES, createSoundOut, createStream, filterBoard, SPEAKER_FULL_SCALE, Tape } from '@electronics/shared/sound';

const sound = createSoundOut(ctx, { rate: 24000 });
const tape = new Tape(1536 * 6);
const stream = createStream(
  ctx,
  { net: filterBoard(1000), rate: 24000, block: 1536, probes: BOARD_PROBES },
  {
    wants: () => sound.room > 0, // a request only while the output has room
    onBlock: (b) => {
      const [current, volts] = b.samples; // the speaker's current and its voltage, as BOARD_PROBES says
      sound.enqueue(current!, { first: b.first, scale: 1 / SPEAKER_FULL_SCALE });
      tape.write(b.first, volts!);
    },
  },
);
// a knob turned, a part put in: the next block goes on with the new board from the model's last moment
stream.board(filterBoard(10000));
// every engine update
stream.pump();
// a scope: the 20 ms before the sample heard now
tape.read(sound.heard() ?? 0, new Float32Array(480));
```

Both `createSoundOut` and `createStream` put their own `dispose` into `ctx.onDispose`: the sound stops, the context
closes and the thread ends with the chapter, nothing to do by hand.

## What the engine gives a chapter for sound

Found in the engine (no file of the platform changes here):

| Need | Where it is | How the output uses it |
|---|---|---|
| the first gesture | `ctx.gesture: Promise<void>` (`engine/chapter.ts:225`); the input resolves it on the first press of a mouse on the canvas, the first release of a finger or a pen on it, or the first key (`engine/input.ts:523`, `:534`, `:632`, `:689`) | `ctx.gesture.then(start)`: the context is made there, never before; a chapter left before the gesture never makes one |
| `?noaudio` | the engine's `flags.noaudio` (`parseFlags`, `engine/app.ts:68`: `new URLSearchParams(search).has('noaudio')`); **not** in `ChapterContext` (`docs/superpowers/plans/2026-11-18-radio-pilot/facts/chapter-api.md`, «Not in the context: no flags») | `noaudioFlag()` reads `location.search` by the same rule; with it no context is ever made |
| sound and volume | `ctx.store` → `settings.audio` (on / off) and `settings.volume` (0…1, 0.8 by default; `engine/store.ts:29`, `:31`, `:110`), with `ctx.store.subscribe(select, listener)` (it calls the listener only when the selected value changes) | two subscriptions, removed on dispose; the gain is volume² × 0.55 with the sound on, 0 with it off, eased with a time constant of 0.05 s |
| the rule | `docs/ENGINE_API.md` §15, «Audio»: start only after `engine.input.gesture`, stay silent when `engine.flags.noaudio`, follow `settings.audio` / `settings.volume` | as above |

**Not louder than the engine's sounds.** The engine's own master bus is volume² × `MASTER_LEVEL` = 0.55 into a
`DynamicsCompressorNode` (threshold −12 dB, knee 6 dB, ratio 20, attack 3 ms, release 0.25 s;
`audio/engine.ts:11`, `:108`, `:140`). The output copies both: its master gain is the same (`OUTPUT_LEVEL`), its
limiter has the same settings, and every sample is clamped to ±1 before the gain. Its sound is the speaker's current
over `SPEAKER_FULL_SCALE` = 0.5 A — the 8 Ω speaker's rated power as a steady current, √(2 W / 8 Ω); the volume's
amplifier gives 0.45 A at the top of its volume control, where it clips, and 0.12 A (RMS 0.03 A) at its middle. No
other scaling: what is louder on the board is louder in the sound.

**The tab.** While the page is hidden the context is suspended (the engine does the same with its own,
`audio/plugin.ts`), so the plan does not run out behind the reader's back; the engine does not update then either.

**A gesture on the interface is not the engine's gesture.** Under the DOM interface the dock and the board are HTML
over the canvas, and a press on them never reaches the canvas: the sound starts with a press on the scene or a key
(the engine's own sounds start the same way). Checked in the sandbox (E1-9, one-off): a click on «Напряму» changed
the board and left the output `waiting`; a key then started it. The sandbox's text says so.

## The output (`createSoundOut`)

`createSoundOut(ctx, { rate, capacity?, noaudio?, makeContext? })`:

| Member | What it is |
|---|---|
| `state` | `off` (never plays: `?noaudio`, no Web Audio, or the context could not be made), `waiting` (until the gesture), then the context's own state (`suspended`, `running`, `closed`) |
| `clock` | `engine` — the blocks are planned on the engine's clock (`ctx.clock.time`) and nobody hears them; `audio` — on `AudioContext.currentTime`, from the moment the context first runs (the silent blocks on the plan are dropped then) |
| `enqueue(samples, { first, scale })` | plays `samples` × `scale`, clamped to ±1, after the blocks before; `first` is the stream's index of its first sample; false when the plan is full |
| `room`, `queued` | how many more blocks it takes now, how many are on the plan |
| `played`, `underruns` | blocks whose end has passed; blocks that came after the sound had run out (on the context's clock only) |
| `latency` | the sound planned ahead plus the context's own output latency (`outputLatency`, or `baseLatency`), s: how long until a block asked for now could be heard |
| `gain`, `gainNow` | the gain the settings ask for; the gain the context applies now |
| `heard()` | the stream's sample heard now (for a scope: `Tape.read`) |

The context is made at the blocks' rate (`new AudioContext({ sampleRate: 24000, latencyHint: 'interactive' })`, so
no block is resampled on its own; the browser resamples the whole output for the device), or at the device's rate
when that is refused — then each buffer keeps the blocks' rate and its source resamples it. Chrome makes it at 24 kHz
(the QA below reads it).

**The plan** (`BlockPlan`, pure bookkeeping, every call given the clock's reading):

- a block that comes while the plan still runs starts exactly where the last one ends — the sound is continuous;
- a block that comes after the plan has run out is an **underrun**: it starts `PLAN_LEAD` = 0.05 s after now, and so
  does the first block after a start (no underrun);
- at most `PLAN_CAPACITY` = 3 blocks are on the plan (not yet ended): `add` refuses one more, and `room` says so;
- a block counts as **played** once its end has passed.

## The stream (`createStream`)

`createStream(ctx, setup, { wants, onBlock, mode?, makeWorker? })`, with `setup` = `{ net, rate, block, substeps?,
probes }` (`protocol.ts`; a probe is `{ node }` or `{ part }`, as `Transient.run` records them):

- **A background thread** (`model.worker.ts`) when there is one. `init` carries the setup; the handler
  (`handler.ts`) compiles the board into a `Transient` at 1/rate, starts it from the operating point and makes one
  array per probe. A `block` request carries the stream's index of its first sample, the board when it changed since
  the last request (`Transient.rebuild`: time, charges and the melody run on) and the revision of the board; the reply
  carries copies of the probes' arrays (transferred, not copied again), how many steps succeeded (the samples after a
  moment without a solution are 0) and how long the model took.
- **One request on its way**, and only while the output `wants` a block (`sound.room > 0`). When a block comes,
  `onBlock` takes it and, if the output wants another, the next request leaves at once — from the thread's message,
  not at the next engine update — so a long frame does not starve the sound unless it is longer than the sound
  planned ahead. `pump()` (once per engine update) sends a request when one is wanted and none is on its way.
- **The main thread** when there is no `Worker`, or for good after the thread fails (its constructor throws,
  `onerror`, an `error` message: one `console.error` in the stream's life): the model starts again there with the
  board of that moment, from its operating point, and gives one block per `pump` while the output wants one. The
  block on its way when the thread fell is lost (the plan may run out: an underrun). The samples are numbered by the
  stream, so they run on. An error of the model on the main thread gives no block; a board the model cannot start is not tried again
  until another board comes.
- `dispose` (also from `ctx.onDispose`) ends the thread; a reply after it changes nothing.

What is different from `radio/shared/link`: blocks of samples instead of frames; a request leaves while the output
has room, not at 25 a second, and the next one right after a reply; the board travels only when it changed; no
`still`; the main thread computes a block per update (not one in six) while the output wants one.

## Rate and block

24 000 samples a second — the volume's rate (`sim/core/README.md`, «Speed»: the amplifier plays 5.4 times faster
than real time there). Blocks of **1536 samples, 64 ms** (the design: 50–100 ms): with up to three on the plan, the
sound planned ahead is 2–3 blocks, and a change on the board, which goes into the next request, is heard
0.12–0.21 s later (the QA's `latency`; the design: ≈ 0.1–0.2 s). With 2048 samples (85 ms) the same QA measured
0.17–0.27 s — over the design's mark — and no underrun either. In the worker the model takes 12–14 ms for a block of
the amplifier (4.6–5.2 times real time on this machine); a stall of the main thread longer than the sound planned ahead (≈ 0.12 s at
the moment of a request) is an underrun: a stall of 60 ms gave none, a stall of 300 ms one (one-off probe of
E1-9).

## The board (`board.ts`)

`filterBoard(ohms)` — the board of the sound check: the player (`player`, the volume's melody, 0.3 V behind 32 Ω)
on a node of its own (`BOARD_NODES.source`), then either a jumper (`ohms` null) or a low-pass — a resistor of
`ohms` to the amplifier's input node and `ceramic-100n` from there to the ground — then the volume's amplifier
(`amplifierNetlist`, the volume control at the middle) and its speaker `LS1`. `FILTER_OHMS` are the resistors a
slider offers (E12 from 100 Ω to 100 kΩ, 37 values); `BOARD_PROBES` record the speaker's current (the sound) and the
voltage on it (the scope).

Why the amplifier between the filter and the speaker (the plan said «player → RC low-pass → speaker»): the 8 Ω
speaker straight across 100 nF would make no low-pass. Its 8 Ω beside the capacitor put the filter's edge at
1/(2π · (8 Ω ‖ (R + 32 Ω)) · 100 nF) — above 200 kHz for every R — and the resistor only divides the level. The model, the speaker's current over
three seconds of the melody: the share above 2 kHz is 0.176 straight and 0.176 through every resistor from 100 Ω to
100 kΩ, while the level falls 26 times through 1 kΩ and 2500 times through 100 kΩ. Between the player and the
amplifier's volume control — where the step `filter/lows` of PATH.md puts this filter — it filters: the share
above 2 kHz is 0.197 straight, 0.140 through 1 kΩ, 0.077 through 4.7 kΩ, 0.059 through 10 kΩ and 0.041 through
100 kΩ (the 10 kΩ of the volume control load it, so the whole level falls too: 0.03 A straight, 0.0096 A through
10 kΩ). And the amplifier is the board the volume will play live, so the check measures its real load.

## QA (`_dev/_sandbox-electronics-sound/qa/check.mjs`)

```bash
cd app && pnpm build && pnpm exec vite preview --port 5391     # in the background
node app/src/volumes/_dev/chapters/_sandbox-electronics-sound/qa/check.mjs --port 5391 --out <dir>
```

Chrome on the GPU with the flags of `tools/qa/lib.mjs` (`GPU_ARGS`). **The check relies on a real click** for the
engine's gesture: before it the output is `waiting` (the check asserts that), and Playwright's mouse click on the
scene — a trusted input event — resolves `ctx.gesture`. `GPU_ARGS` include `--autoplay-policy=no-user-gesture-required`,
but the check does not need it: run with `QA_CHROME_ARGS` = `GPU_ARGS` without that flag it passes the same, 21 of
21 (E1-9). The pages open without `?noaudio` (the QA helpers add it by default), except the section that checks it.
An init script counts the page's contexts (`window.__qaAudio`): the engine's own one (made on the same gesture, at
the device's 48 kHz) and the sandbox's.

E1-9, 20.11.2026, RTX 5070 (ANGLE/Vulkan), 1280 × 720, the DOM interface — PASS, 21 checks:

| Section | What it found |
|---|---|
| sound | the output on the context's clock at 24 kHz, the model in a thread: 154 blocks played in 10.08 s (157 fit in it), 0 underruns, the model 13.8 ms a block of 64 ms; latency 0.119–0.21 s |
| settings | the sound off → gain 0 (0.0009 applied a moment later); on at volume 0.5 → 0.1375 = 0.5² × 0.55 |
| filter | the speaker's current above 2 kHz over 32 blocks of each board: 0.0052 A straight → 0.0031 A through 1 kΩ → 0.0006 A through 10 kΩ; its share 0.167 → 0.124 → 0.066; the scope redrawn 29.9 times a second (30 a second of engine time), peak 0.94 V |
| noaudio | no `AudioContext` at all after a click; the output `off` on the engine's clock, the model playing silently in its thread |
| visits | three visits to `_sandbox-studio` and back: after each exit no thread and only the engine's context live; after each return one thread and the sound running; 5 contexts made, 2 live at the end |

## Tests

`__tests__/`: `plan.test.ts` (with a fake clock: blocks back to back, an underrun counted and started after the
lead, never more than three on the plan, blocks played, the sample heard, a reset); `output.test.ts` (a fake
`AudioContext` and store: nothing before the gesture, none with `?noaudio`, the context at the blocks' rate, the
gain and the limiter, blocks on `currentTime` with a 30-second run without a gap and an underrun after a stall, the
settings, the dispose); `tape.test.ts`; `handler.test.ts` and `stream.test.ts` (the protocol: the same samples as a
`Transient` of the same board, a new board carried once and taken by `rebuild`, own buffers in the transfer list,
one request on its way and the next at once when a block comes, the main thread after a failure, numbering, the
dispose); `board.test.ts` (the board, the resistors, the full scale, and that through 1 kΩ and 10 kΩ the high notes
fall).
