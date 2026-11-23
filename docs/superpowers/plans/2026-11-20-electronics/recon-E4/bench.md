# Recon E4 · bench — the bench as the E4 chapter builders will find it (merged view)

This is a read-only map for the chapters `divider`, `capacitor`, `capacitor-kinds` and `filter` (PATH.md §4–7). It
covers two trees:

- `M/` = `/home/pilot/tmp/radio-science-pop/app/src/volumes/electronics/` at `4e6b986`: E3-6 `resistor`, E3-7
  `resistor-pick` and `shared/steps`.
- `C/` = `/home/pilot/tmp/rsp-e2/app/src/volumes/electronics/` at `7ad47b1`: E2-9 scope, E2-10 sound, E3-8 `meter`.
  The working tree also holds the uncommitted, in-progress fix:E3-8#1 (`STILL` half bar, meter steps).

Line numbers are as of those heads. A file that is identical in both trees is cited under `M/`. Reports are cited by
name: `.superpowers/sdd/2026-11-20-electronics/task-*-report.md` (main tree) and
`docs/volumes/electronics/reports/batch-E2.md` (clone).

## 0. Verdict

1. **E4 must build on the merged tree (E3-10).** Each tree has half of what E4 needs:
   - only `C/` has the oscilloscope, the model in time (`live`), sound, the bulged/burnt split and `SCOPE_INPUT`;
   - only `M/` has `shared/steps`, Ω «—» on a live circuit (`powered`), grips shown only where the policy allows, and
     the film anchors.

   The merge will conflict in these files:
   - `shared/model/driver.ts` and `shared/model/__tests__/driver.test.ts`;
   - `shared/README.md`;
   - `shared/hand/tray.ts`: the same fix, with variables `stepped` in `M/` and `body` in `C/`;
   - the sandbox's `scene.ts` and `qa/measure.mjs`;
   - `REUSE.md`.
2. **Biggest gap: everything except the scope and the speaker reads the DC operating point.** That covers the LEDs'
   light, the looks, heat, the multimeter, the lamp and the door's inner view (`C/shared/bench/index.ts:471-476`,
   `:521-530`, `:572`; `M/shared/dive/door.ts:233-238`). In DC a capacitor is open. So:
   - when the switch opens, an LED fed by a capacitor goes dark in the same frame;
   - a meter on a charged capacitor reads 0 V once its circuit has no source;
   - nothing on the main thread knows a capacitor's charge.

   As a result, `capacitor/store`, `capacitor/capacity` and `capacitor/inside` cannot be built honestly on today's
   bench. They need a bench change: the model in time feeding the bench, not only the scope (§4.4). This is the first
   item for a shared E4-0 task.
3. **The capacitor inner view is new work.** It must implement `Cutaway`. `createWedge` cuts only about a horizontal
   axis, and `InsideState` has no voltage and no `bulged` (§9).
4. **The magnifier opens only a part seated on the board.** `capacitor-kinds` asks for the magnifier over the tray
   (PATH.md:550), which the bench cannot do (§9.4).
5. **Small shared fixes for E4-0** (§12): `bench.preset` keeps plugs it does not name; a capacitor's «теплий» is
   tinted as heat; tray labels vanish on `stand` when the back row has a label; the can prints «1 mF»;
   `createStepStand` has no `sound` option; the shared `handPolicy` knows neither the scope's probes nor plug leads,
   nor capacitors and pots by kind.
6. **The +1-geometry-per-mount leak is fixed in both trees.** The cause was the tray block. The ledger line
   (`progress.md:80`) is stale (§12, row 1).

## 1. Two trees, one bench

| Module | `M/` (main, 4e6b986) | `C/` (clone, 7ad47b1) | After merge |
|---|---|---|---|
| `bench/index.ts` | E2-8 bench + E2-M; no scope/live/speaker; `mountBench(ctx)` | + `BenchOptions{sound}` (`:117-129`), `oscilloscope`, `live`, `speaker`, held-page `still` (`:597-616`), steam vs smoke (`:503-508`) | take `C/` |
| `model/driver.ts` | + `powered()` (`:132-138`, `:185-200`, `:337-351`) | + `tauMax`, `still`, `STILL`, `damaged()`, bulged in `part`/`ohms` (`:189-198`, `:280-289`, `:372-384`, `:396-446`) | union of both; conflict in `part`/`ohms` |
| `model/live.ts` | — | new (E2-9/E2-10) | `C/` |
| `instruments/` | meter, probe; `meter-model.ts:78-79` Ω «—» | + `scope.ts`, `scope-model.ts`, `sweep.ts`, `speaker.ts`; probe pair shared (`probe.ts:322-332`) | union; `meter-model.ts` from `M/` |
| `hand/hands.ts` | grips only where `take` allows (`:1266`, `:1288-1293`); glow on mouse only (`:1277`) | old | `M/` |
| `hand/tray.ts` | leak fix `disposeTree(stepped)` (`:157-158`, `:260-262`) | same fix as `body` (204d4d1) | either; one name |
| `inside/film.ts` | anchors moved (E3-6) | old | `M/` |
| `steps/` | new module (E3-7) | absent; `meter` keeps chapter-local copies (`C/chapters/meter/parts/{policy,dock,goals,scope}.ts`, `stand.ts`) | `M/`; migrate `meter` (§11) |
| `sim/core/transient.ts` | old | + `TransientOptions.fails` (`C/sim/core/transient.ts:110-115`) | `C/` |
| `sound/` | E1-9 | + probes, restart, damage in the protocol | `C/` |

## 2. Mounting the bench and seating a step's board

- **Mounting.** A chapter mounts the bench once in its scene factory. In `M/` this happens through
  `createStepStand(ctx, { keepDoor? })` (`M/shared/steps/stand.ts:57-58`), which calls `mountBench(ctx)` with no
  options. `C/chapters/meter/stand.ts:49` calls `mountBench(ctx, { sound: true })` directly.
  - `mountBench` makes the room, base, board, parts, fixed leads, multimeter, model, speaker, model in time,
    oscilloscope, tray, tools, lights and hand (`C/shared/bench/index.ts:320-451`).
  - Everything it makes is freed through `ctx.onDispose`.
- **The step's board: `stand.board(parts, leads)` = `bench.clear()` then `bench.preset(parts, leads)`**
  (`M/shared/steps/stand.ts:72-75`). `C/chapters/meter/stand.ts` does the same in its own `board`.
  - Why the extra `clear()`: `bench.preset` removes every part but leaves every plug it does not name in its socket
    (`C/shared/bench/index.ts:209-215`, `:684-689`).
  - `seatPreset` seats the parts before the plugs (`M/sim/board/presets.ts:68-83`). So a stale plug blocks a part's
    socket and the preset throws `RangeError: preset: J1 (jumper) does not stand …`. E3-6 hit this after the
    amplifier's `spk+` in `c10`; the doc comment is at `M/shared/steps/stand.ts:37-41`.
  - `clear()` also does `state.leads.clear()` (`C/shared/bench/index.ts:690-695`).
  - Bug and fix: §12, row 2.
- **What `takeOff()` does** (`C/shared/bench/index.ts:624-634`):
  - `hands.reset()`;
  - removes every part and calls `model.forget(id)`, so a new `R1` is whole;
  - forgets `BAT`, `SW`, `SPK`, `LAMP` and `PLAYER`, so a lamp burnt in an earlier step is whole again;
  - calls `live.restart()`, so the stream starts again from the new board's operating point and the melody restarts.

  A reader's swap by hand does not restart the stream: the model carries on from its last moment
  (`C/shared/model/live.ts:217-225`).
- **What survives `preset`: the settings that are not a part's.** `SW` (`bench.closed`) and `PLAYER` (the player's
  level, `C/chapters/meter/stand.ts:59-62`) carry over, so every step must set them. A pot's setting goes with the
  pot; set it through `PresetPart.setting`, or at run time with `setSetting(bench.state, 'P1', v)`, re-exported in
  `C/shared/bench/index.ts:93`.
- **Deep links.** The scene calls `stand.snap()` when `info.instant` is set (`M/chapters/resistor/scene.ts:67-70`).
  `bench.snap()` (`C/shared/bench/index.ts:696-705`) syncs the model and jumps the ramps, the meter and the scope.
- **Frame order** (`C/shared/bench/index.ts:537-584`), with a chapter's `update` before it and `late` after it:
  1. the parts and leads follow the state;
  2. `hands.update`;
  3. `model.sync`;
  4. `show(dt)` (`advance`, puffs, looks, LED lights);
  5. `multimeter.measure`;
  6. `live.taps` and `live.update`;
  7. `oscilloscope.show`;
  8. on a held page, `held(dt)`;
  9. the tray and the prints.

  The door and the keeper go after the bench (`M/shared/steps/stand.ts:100-117`).
- **Shots.** The bench shots are `stand`, `board`, `meter`, `scope` and `phone`, and every one has `fit`
  (`M/shared/bench/shots.ts:35-81`). On a phone every name maps to `phone` (`:91-95`).
  - A chapter's own shot needs a `fit` sphere, or tablets crop it: E3-6 fix round 3, `c128d6a`.
  - No shot shows the multimeter and the scope together beyond `stand`.

## 3. The model driver: DC, time, damage

`C/shared/model/driver.ts` is the only caller of `sim/core`.

- **`sync()`** (`:345-361`) recompiles when the netlist key changes: a part in or out, a leg in another row, or an
  instrument's extra part (meter on A, a scope probe's 1 MΩ). A changed setting only solves again. A failed solve
  keeps the last good solution and sets `ok=false`; until a solve succeeds, `reading`/`rowVolts`/`part` return null.
- **DC semantics.** At the operating point a capacitor is its ESR in series with its leak, and nothing else
  (`M/sim/core/capacitor.ts:36-47`, `op.dt === 0`). Its `links` is a DC path (`:33-34`). Consequences:
  - With the switch open, a capacitor's island has no source and DC gives 0 V. A real capacitor would keep its
    charge.
  - With the switch closed, DC gives the capacitor fully charged in the same frame.
- **`advance(dt)`** (`:365-371`) runs `advanceHeat` at the DC point (`M/sim/core/limits.ts:119-142`):
  - heat follows the load with τ = 10 s for capacitors and resistors (`:37-47`);
  - a capacitor's load is |U| / `ratedV`, and its reverse load is (−U) / `reverseV` = 1 V (`:79-80`);
  - above load 0.5 the condition is «warm», above 1 «hot» (`:85-91`);
  - at heat 1 a polar capacitor bulges and every other part burns (`:61-64`, `:95-100`).

  Numbers for PATH: the 6.3 V can on 9 V has load 1.43 and bulges after 10·ln(1.43/0.43) ≈ 12 s. The 16 V can
  reversed on 9 V has load 9 and bulges after 1.18 s. The amplifier's 470 μF at 8.34 V has load 0.52, which is
  «warm».
- **Is bulging split from burning?** Yes, in `C/` (E2-9: 3ff9a51, 115964c). This settles E2-M's concern
  (`task-E2-M-report.md` «Concerns»).
  - `advance` still returns one list of failed ids (`:365-371`); callers tell the two apart through
    `part(id).condition`.
  - `part(id)` reports `bulged` in the circuit and out of it (`:372-384`).
  - `damaged()` copies bulged into the private solves (`:280-289`), so `ohms` sees a bulged can as 1 kΩ
    (`BULGED_OHMS`, `M/sim/core/capacitor.ts:15`).
  - The bench lets out steam, not smoke, and logs `what` (`C/shared/bench/index.ts:503-508`).
  - The stream gets `bulged` through `benchDamage` (`C/shared/model/live.ts:102-111`).
  - `M/` still has the old driver: `part` knows only burnt (`M/shared/model/driver.ts:287-298`), and so do the
    `ohms` copies (`:326-328`). The merge fixes this.
  - What is still not split: the inner view's `InsideState` has only `burnt` (`M/shared/inside/wedge.ts:26-33`;
    `M/shared/dive/door.ts:238`).
- **`ohms(a, b)`** (`C/…/driver.ts:396-421`) removes the sources and solves with a 5 V source behind 10 kΩ. Readings
  on capacitors are their DC leak in series with the ESR:

  | Capacitor | Reads |
  |---|---|
  | `electrolytic-100u-16v` | 2.581 MΩ |
  | `electrolytic-1000u-16v` | 457 kΩ |
  | ceramic (10 GΩ) | «OL», beyond `OHM_LIMIT` 40 MΩ |
  | film (≥ 1.25 GΩ) | «OL» |

  There is no charging ramp on the display.
- **`powered(a, b)`** (`M/…/driver.ts:337-351`, E3-6) is true when a source whose loop is closed reaches the probes'
  island. Capacitors join nodes through their leak link, so a cap across a closed battery is «powered» and Ω reads
  «—». A charged capacitor alone is not a source.
- **`tauMax()`** (`C/…:422-426`, `:293-317`) is C × the resistance seen across the capacitor at the operating point,
  measured with a 0.5 μA test current. It feeds only the warm-up of `still`.

## 4. The model in time

### 4.1 `live` — the stream

`C/shared/model/live.ts`.

- **Format.** 24 000 samples/s in blocks of 1536 (`LIVE`, `:45`), produced by E1-9's stream: a worker, the main
  thread as fallback, the main thread always on `?freeze`.
- **When it runs.** Only while `bench.scope > 0`, or always with the `sound` option (`C/shared/bench/index.ts:576`).
  Every start after a pause, and every `preset`/`clear`, restarts from the operating point (`'dc'`, `:213-216`;
  `handler.ts:80`).
- **Board changes.** A new driver solve (switch, knob, a part moved, a burn) sends the new board. The model goes on
  from its last moment, and capacitor charges carry over by id (`:217-225`).
- **The stream never fails a part by itself** (`fails: false`, `C/sim/core/transient.ts:110-115`). Damage comes only
  from the driver, so the screen lags a burn on the bench by 0.1–0.2 s.
- **Taps: only the scope's.** `live.taps(oscilloscope.taps())` runs every frame (`C/shared/bench/index.ts:575`), and
  `taps()` returns node voltages of the probes' rows (`C/shared/instruments/scope.ts:262-267`). With sound, the
  speaker's current tap comes first.
- **No public hook for a chapter's own taps.** `Transient` probes accept `{ part }` currents (`StillTap`,
  `C/…/driver.ts:167-168`), but nothing exposes them to a step.

### 4.2 `still` — a held page's window

`C/…/driver.ts:427-446`; bench `held()` at `C/shared/bench/index.ts:597-616`.

- **When it runs.** Only for `display: 'sweep'`, only on a held frame (`dt` 0) after a change.
- **Start and warm-up.** It starts from `'dc'`, then warms up for `STILL.warmup(τmax)`:
  - in the uncommitted `C/` working tree: max(0.2, 5τ), rounded up to a half bar (1 s), at most 2 s (`:179-198`);
  - at HEAD: rounded to 0.5 s.
- **Cost.** 170–183 ms per change on the amplifier (`batch-E2.md` §3.2).
- **Limitation for E4.** `still` cannot show a capacitor holding or losing a charge after a switch event: its start is
  the DC point of the board now. Roll-mode steps on a held page advance with `__app.step` instead; the sandbox `rc`
  check does this.

### 4.3 What the transient model offers

`C/sim/core/transient.ts`; capacitor at `M/sim/core/capacitor.ts`.

- **Starts.** `'dc'`, `'zero'` or `'state'` (`transient.ts:93-96`, `:256-301`). The bench uses only `'dc'`.
- **Integration.** Trapezoid, with backward Euler after each change (`EULER_STEPS` 2).
- **Capacitor stamp.** C behind its ESR, with the leak across C (`capacitor.ts:36-59`). Catalog
  (`M/sim/core/parts.ts:607-650`, `:748-759`):

  | Kind | ESR | Leak | Rated |
  |---|---|---|---|
  | ceramic | 0.03 Ω | 10 GΩ | 50 V |
  | film | 0.03 Ω | 10 GΩ (100 nF), 1.25 GΩ (1 μF) | 63 V |
  | electrolytic 1 μF | 265 Ω | 5.3 MΩ | 16 V |
  | electrolytic 100 μF | 2.65 Ω | 2.58 MΩ | 16 V |
  | electrolytic 470 μF | 0.56 Ω | 887 kΩ | 16 V |
  | electrolytic 1000 μF | 0.27 Ω | 457 kΩ | 16 V |
  | `electrolytic-100u-6v3` | 3.71 Ω | 1.48 MΩ | 6.3 V |

  Electrolytics have `reverseV` 1.
- **Bulged = 1 kΩ, no capacitance** (`capacitor.ts:70-81`; `limits.ts:95-100` sets `volts = 0`). The charge is kept
  per id in `PartMemory.volts` (`M/sim/core/state.ts:21-22`).
- **The player is the melody** (`player`, 0.3 V, 32 Ω). `player-tone` 1 kHz is listed in «Чого стенд не показує»
  (`C/shared/README.md:265-275`). So PATH numbers quoted «на 1 kHz» (`divider/volume`, PATH.md:444) must be
  re-measured on the melody, for example as crests with `peak()`.

### 4.4 Needed for E4 (bench change, E4-0)

A way for steps and the bench itself to read the model in time beyond the scope's probes:

- extra taps merged with the scope's (for example `bench.live.watch([{ part }, { node }])`, plus the latest sample of
  each);
- the stream running while any watch is set;
- LED brightness and, optionally, the meter on V taken from those samples while the stream runs.

Without this, `capacitor/store` and `capacitor/capacity` (an LED fading after the switch) and `capacitor/inside`
(plates that keep the charge) contradict the model (VISUAL §1, principle 3).

The rule in the README that everything shown is the model's output still holds, since the stream is the model. Only
the DC-only plumbing changes, at `C/shared/bench/index.ts:521-530` and `:572`.

## 5. Oscilloscope API (C/ only until the merge)

- **Visibility and input.** `bench.scope = 0…1` slides it in over 0.6 s through the step's param; the probes are taken
  only at 1. While it is shown, the model runs in time. `SCOPE_INPUT` puts 1 MΩ from each probe's row to the − rail
  into the circuit (`C/shared/instruments/scope.ts:66-73`, `:268-276`). This was a shared change in E3-8, and it
  shifts E4 numbers:
  - RC 10 kΩ / 100 μF with the probe on the capacitor reaches 62.84 % at 1 s, not 63.2 % (sandbox `rc`, E3-8
    deviation 4);
  - the final value is 9 × 1/1.01 V;
  - the `filter/block` resistor becomes 10 kΩ ∥ 1 MΩ.

  PATH «Еталон» numbers for probed nodes must be recomputed with this load.
- **`configure(setup)`** (`scope.ts:258-260`) replaces the whole setup: unset fields take `SCOPE_DEFAULTS`, not the
  previous values, and the display clears (`scope-model.ts:88-97`, `:100-122`, `:257-264`). Fields of `ScopeSetup`:

  | Field | Values |
  |---|---|
  | `display` | `'sweep'` or `'roll'` |
  | `timePerDiv` | s per division, 10 divisions |
  | `voltsPerDiv` | V per division, 8 divisions |
  | `channelVolts` | `[ch1, ch2]`, each `number` or `null`; E3-8, per-channel scale, ch1 on the right axis via `ScopeWords.y2` |
  | `ground` | divisions from the middle |
  | `trigger` | `{ channel 0/1, level null=auto-middle, slope ±1, auto }` |
  | `holdoff` | s |
  | `unit` | `'ms'` or `'s'`; default from the span |
- **Sweep** (`scope-model.ts:392-421`):
  - The trigger edge is searched only among recent samples, so the scope shows the present, not a backlog.
  - With `auto: true` and no edge for a span, it runs free.
  - With `auto: false` it waits, and the last sweep stays drawn. This is the single shot `filter/block` needs: an
    explicit `level`, `slope: 1`, `auto: false`.
- **Roll** (`:474+`): 300 time buckets, min/max per bucket, newest sample at the right; a new roll back-fills with its
  first sample. The template for `capacitor/slow` and `capacitor/time` is the sandbox `rc`: roll 0.5 s/div, 2 V/div,
  ground −3, probes e3/e7, switch open on entry (`C/_dev/chapters/_sandbox-electronics-bench/scene.ts:206`, `:239`).
- **`put({ ch1, ch2 })`**: a socket, or null to send the probe back to rest. The ground is a clip on the − rail, so
  every channel reads against node 0 and there is no differential or math channel. `filter/coupling` reads two
  channels against ground.
- **`chart(id, words)`** gives the step's board `ChartSpec`. It is rebuilt at each step entry and redrawn per sweep.
  Helpers for words and scales live in the meter chapter only (`C/chapters/meter/parts/scope.ts:14-40`, `:69-81`,
  `:83-86`, `:98-112`: setups, `timeText`, `voltsText`, `scopeWords`, `scopeBoard`, `crestStats`). They are candidates for
  `shared/steps` (§11).
- **`model.peak(channel, seconds)`** (`scope-model.ts:364-377`, E3-8) is the largest |v| shown over the last
  `seconds`, in chunks of 10 ms, kept for 5.12 s. It is null while the channel is off.
- **Held page (`?freeze`)**: the stream runs on the main thread, and a sweep shows `still` (§4.2). The reader is
  `__app.read('electronics-scope')` (`C/shared/bench/index.ts:827-846`).
- **Phone.** The chart sits in the «Графіки» tab and the instrument is out of the shot. At rest the scope's probes lie
  exactly where the meter's do, so a step with both instruments on a phone must seat one pair (VISUAL §9;
  `batch-E2.md` §4).

## 6. Multimeter

- **Modes** (`M/shared/instruments/meter-model.ts:25-29`, `:61-81`):

  | Mode | Reads |
  |---|---|
  | `off` | nothing |
  | `V` | red row minus black row; ideal, no input resistance (unlike the scope) |
  | `A` | the meter is a 1 mΩ jumper `METER` in the circuit, current into red; across the battery it is an honest short, no fuse |
  | `ohm` | `model.ohms`; «OL» above 40 MΩ or with no path; «—» while `model.powered(red, black)` (`:78-79`, E3-6, `M/` only until the merge) |

  A probe out of a socket reads «—». A failed solve keeps the display unchanged (`undefined`).
- **Display.** Four significant digits, decimal comma, SI prefix (`formatReading`, `:107-130`). It refreshes every
  0.33 s of engine time and jumps on `snap`. A step shows it with `meterReadout` and sets the dial with
  `meterSwitch(bench, label, modes, offWord, value)` (`M/shared/steps/meter.ts:16-36`). The modes list is the step's
  guard: E3-6 and E3-7 hide «A» where it would short the amplifier (D1 burns in 1.07 s, the «on» LED in 0.08 s;
  `task-E3-3-report.md` finding 2) and add «Нові деталі» (`C/chapters/meter/steps/02-amps.ts:65`, `:98`).
- **For E4.**
  - V on a capacitor is DC: it is instant on charge, and 0 V once the switch is open (§3).
  - Ω on capacitors reads their leak (§3).
  - There is no capacitance mode, and PATH does not need one.

## 7. Hand policy

- **The policy.** `bench.hands.policy: HandPolicy` (`M/shared/hand/hands.ts:119-131`) has these hooks:
  - `take(k)`, where `k` is one of `part:<id>`, `leg:<id>:<k>`, `lead:<name>`, `probe:<name>`, `tray:<key>`,
    `switch` (`:110-116`);
  - optional `seat` (`:671`), `place` (`:489`), `flip` (`:907`; only `=== false` blocks, so a missing hook allows the
    flip), `done` (`:474`), `tooltip`.

  With no policy at all, everything may be taken (`:423`).
- **Grips.** Grips and the hover glow show only for keys `take` allows (`:1266`, `:1288-1293`, `M/`). The glow is
  mouse-only (`:1277`).
- **On a phone** (`world.phone()`):
  - the tray is the dock: `hands.offer(spec)` (`:1129`) through `trayButtons`;
  - tray slots are not live in 3D (`:1009`);
  - radial parts' leg tabs are hidden (`:951`, `:1266`), so capacitors, LEDs and TO-92s are carried whole;
  - the switch is a dock toggle (`switchToggle`);
  - things ride `LIFT` 48 px above the finger (`:92`).
- **Flip.** A click turns a placed part end for end in 0.3 s. `capacitor-kinds/reverse` needs it: allow `flip` for
  that spec only.
- **Shared rules** (`M/shared/steps/policy.ts`):
  - `HandRules` covers `part`, `leg`, `tray`, `probes: boolean`, `switch`, `flip`, `name` (`:9-22`).
  - `probes` covers every probe, and the name maps anything not `black` to `red` (`:37`, `:49`). The scope's
    `ch1`/`ch2` get the red probe's name.
  - Plug leads are always refused (`:38`), but `filter/pass` («поставити замість батарейки плеєр») needs `lead:pl+`
    and `lead:pl-`.
  - `kindOf` knows only `resistor`, `led` and `jumper`; every capacitor and pot is `other` (`:56-61`).
  - The meter chapter already has a superset: `probes: ProbeKey[]` with `ch1`/`ch2` names
    (`C/chapters/meter/parts/policy.ts:10-48`).
  - Fix in E4-0: probes by name, a `lead` rule, kinds `capacitor`/`electrolytic`/`pot`.
- **Gaps.**
  - Plug reach is not checked at run time: `seatLead` checks only that the socket is free
    (`M/sim/board/seat.ts:164-173`). New boards with plugs must be tested the way `bench/__tests__/presets.test.ts`
    tests reach. `spk-` cannot reach the − rail from the speaker (4.04 vs a 4.0 lead), so use a ground row with a
    jumper; `pl-` reaches the rail from column 8 rightwards (`task-E3-5-report.md`).
  - On a dense grid a leg clicks into the first free socket on its way (`batch-E2.md` §4).

## 8. Names and callouts

- **Names under the pointer.**
  - The hand names what it may take (`policy.tooltip`).
  - `partNames` gives invisible twins for parts the step keeps in place, and the multimeter case, on hover devices
    only (`M/shared/steps/names.ts:20-69`).
  - `Naming` is `{ part(id), meter }` (`M/shared/steps/stand.ts:16-19`), with no scope and no player. The meter
    chapter registers the scope and player cases itself (`C/chapters/meter/stand.ts:76-100`), so E4 needs `scope` and
    `player` in `Naming`.
- **Callouts** are the platform's `CalloutSpec` (`anchor()`, `text`, `side`, `visible`) in the step's
  `ui.callouts`. Lessons from E3-7:
  - Put the point on the part's body, moved toward the camera by half its thinner side
    (`M/chapters/resistor-pick/steps/06-on.ts:57-69`).
  - The QA must raycast that each point lands on its own part (`:94-116`).
  - Use `side: 'down'` on a phone when the left side has no room (`:79-81`).
  - Hide callouts while a probe is held (`:71-72`).
  - Inner-view callouts come from the view's own anchors (`asFilm(door.cutaway).anchor`,
    `M/chapters/resistor/steps/04-inside.ts:43-51`), and so must a capacitor view's.
- **Words.** The bench has none. Every label is a chapter caption (`caption(step, i)`). Units in code are fine.

## 9. Magnifier, dive and inner views

### 9.1 The door

- `partDoor(ctx, bench, partId, { lead })` (`M/shared/dive/door.ts:96`) builds the stops from the part's sockets and
  its `hit` box (`M/shared/dive/poses.ts:46-60`). It is `ready` only while every leg is seated (`door.ts:161-163`).
- The rail runs −`LENS_LEG` (the shot) … 0 (lens over the part) … 1 (opened).
- Floors from `FLOOR_FROM` (`M/shared/dive/levels.ts:25-29`): `part` ≥ 0.5, `inside` ≥ 1, `atoms` ≥ 2.
- While the camera is away from the step's shot, the door writes `bench.flying` and the hand is off.
- `door.home({ instant, then })`.
- Chapters drive it through `stand.openDoor` and `closeDoor` (`M/shared/steps/stand.ts:77-96`; with `keepDoor`, two
  dive steps share a door) and `depthSlider(…, end, words)` (`M/shared/steps/depth.ts:39+`; `end` 1 for the inside,
  0.75 for the `part` floor in `resistor-pick/bands`).

### 9.2 How the inner view plugs in

- `CUTAWAYS` (`M/shared/dive/cutaway.ts:14-16`) is a partial table by `PartKind`; today it holds only
  `resistor: createFilm`. The door makes the view with the part's model and calls `set(cut, view)` every frame. It then
  feeds `follow({ amps, heat, burnt })` from the DC driver (`door.ts:223-239`).
- A chapter reads `door.cutaway` (narrowed with `asFilm`).

### 9.3 What a capacitor view must implement

The contract is `Cutaway`, `M/shared/inside/wedge.ts:35-55`:

- `amount`, `open`;
- `set(cut, view)`, with nothing drawn below `CLOSED` 0.01;
- optional `follow(state | null, dt, t)`; null means the last solve failed, so hold the view;
- `state()` for the door's reader `electronics-dive`;
- `dispose()`, which gives the part back whole: materials unclipped, geometries freed;
- registration in `CUTAWAYS.capacitor`. All capacitors share `kind: 'capacitor'`, so the factory must branch on
  `PARTS[key].dielectric` (ceramic, film, electrolytic).
- Mirror the film's extras:
  - `asPlates(c)` for type narrowing;
  - `anchor(name, out)` for callouts and QA probes (`film.ts:149-168`, `:680-692`, `:741`);
  - a draw-call budget in VISUAL §7 (the film: ≤ 8 for the whole view).

What the current mechanics lack for a capacitor:

- **The wedge cuts only about a horizontal axis.** `createWedge(model, width, axisY, skip)` cuts about the body's x
  axis at height `axisY` (`wedge.ts:145-149`), which fits an axial resistor. A can, disc or box stands upright, so
  the wedge needs an axis parameter (vertical for radials) or a clip of the view's own. The film-box half-cut of
  `capacitor-kinds/film` («розрізати навпіл») is a different cut again.
- **`InsideState` carries only `amps`, `heat` and `burnt`** (`wedge.ts:26-33`). The plates need the charge or
  voltage, and the bulged state. Today's door would feed DC values: plates empty the moment the switch opens
  (PATH.md:481-485 says they keep the charge). Extend `InsideState` with `volts` and `bulged`, and feed `volts` from
  the model in time (§4.4).
- **VISUAL §7 has no capacitor inside view** (`docs/volumes/electronics/VISUAL.md:633-649` covers the resistor only;
  PATH.md:468 says «вигляд — черга E4»). The decision comes before the code.
- **Prior art to copy**, recorded in REUSE.md: `app/src/volumes/electricity/chapters/charge-field/parts/capacitor.ts`
  (249 lines) and `cap-circuit.ts`, with plates, field and discharge (`recon-E3/prior.md`, verdict row
  «capacitor»).

### 9.4 The magnifier over the tray

`capacitor-kinds` wants this (PATH.md:550). The door targets board parts only, and the tray has no sockets or stops.
There are two choices:

- seat the step's capacitors on the board and dive part by part (no bench change);
- a new «tray door», which is a VISUAL §7 decision plus shared code.

## 10. Tray

- **Capacity.** `bench.tray.set(keys)` takes two rows of up to 6 kinds each (`M/shared/hand/tray.ts:188-198`);
  overflow is a RangeError. The row depends on size (`trayRow`, `:67-70`): low parts in front, tall or deep ones
  behind. `capacitor-kinds` (4 ceramic, 2 film, 6 electrolytic) has to be split across steps.
- **Labels.** `trayLabel` (`:76-84`):
  - resistor and pot: `fmtSI(Ω)`;
  - every capacitor: `electrolyticPrint(farads, ratedV)`, capacity plus voltage («100 μF 6,3 V», «100 nF 50 V»;
    53ca0c8);
  - diodes and transistors: their model;
  - LED and jumper: none.

  The ceramic's own body prints its code («104») (`M/shared/parts/code.ts:95`), which is what
  `capacitor-kinds/ceramic` needs.
- **Supply and ids.** Supply never runs out. A part taken gets the board's next id, so ids are never repeated.
- **Dock.** On a phone the dock button text is the chapter's `label(spec)` (`M/shared/steps/dock.ts:14-28`), so name
  a pot and a resistor that share «10 kΩ» from captions (`task-E2-M-report.md` concern).
- **Open defects** (§12): every label hides on `stand` when any back-row label is too small; and «1 mF 16 V».

## 11. `shared/steps` (E3-7, `M/` only)

`M/shared/steps/index.ts:7-13` exports the following:

| Export | Use |
|---|---|
| `createStepStand(ctx, { keepDoor })` | the bench, the door, the keeper, the ladder, `naming`, `board()`, `openDoor`/`closeDoor`, `phone()`, `snap`, `update` |
| `createTally`, `rowsOf`, `sameRows`, `across`, `within` | goal maths; the chapter keeps its own `HOLD` |
| `handPolicy`, `kindOf` | §7 |
| `partNames` | §8 |
| `trayButtons`, `switchToggle`, `SWITCH_ID`, `trayButtonId` | phone dock |
| `meterSwitch`, `meterReadout`, `MODE_ID`, `READOUT_ID` | meter in the panel |
| `depthSlider`, `DEPTH_ID` | «Глибина» |

The scene still syncs the dock toggle to `bench.closed` every frame (`M/chapters/resistor/scene.ts:76-78`).

Gaps E4 will hit:

- `createStepStand` cannot pass `sound` (`stand.ts:58`).
- There is no scope in `Naming`.
- No scope helpers: the meter chapter's `parts/scope.ts` is the template.
- No player tap or toggle: the meter chapter's `C/chapters/meter/stand.ts:59-88` (player level is the `PLAYER` setting, `PLAYING`)
  and `parts/dock.ts` `PLAYER_ID`.
- No callout-on-body helper (§8).

The meter chapter (`C/`) has chapter-local copies of `policy`, `dock`, `goals` and `stand`. E3-10 should move it onto
`shared/steps` and lift the scope, player and probe-name pieces into it, so E4 does not copy a third time
(REUSE.md:110 records the earlier move).

## 12. Known open bench bugs

| # | Bug | Where | Cause | Smallest fix | Owner in E4 |
|---|---|---|---|---|---|
| 1 | +1 geometry per chapter enter/leave (sandbox `room`: 65→68→69→70; chapter-check leak FAIL) | `M/shared/hand/tray.ts:157-158`, `:260-262` (fixed); `C/…/tray.ts` same (fixed in 204d4d1) | `tray.dispose()` took the block off the tree before the engine's root sweep, so `Mesh:tray:toon` was never disposed (`task-E2-10-report.md` deviation 6; `task-E3-7-report.md` deviation 1) | **Done in both trees.** E3-7 measured `geo 90→92→92→92` and `79→79→79→79` after the fix, and E3-8's full-tree chapter-check leak PASSes. Only a merge conflict is left (variable name); the ledger line `progress.md:80` is stale | E3-10 (merge); nothing in E4 |
| 2 | `bench.preset` keeps plugs it does not name and seats parts before plugs, so a stale plug's socket gives a RangeError (sandbox lamp → led/divider) | `C/shared/bench/index.ts:209-215`, `:684-689`; `M/sim/board/presets.ts:68-83`; workaround `M/shared/steps/stand.ts:72-75`; `C/` sandbox passes `NO_LEADS` (`…/scene.ts:242`, `:541`); `M/` sandbox still buggy (`…/scene.ts:383`) | design: «a plug not named stays where it is» | In `bench.preset`, add `state.leads.clear()` after `takeOff()` (a preset is the step's whole bench). Update the doc at `:209-215` and README «bench». Then `stand.board`'s extra `clear()` is redundant but harmless. Add a test: a preset after a board with plugs | E4-0 (or E3-10) |
| 3 | A capacitor's «теплий» (load > 0.5 from voltage alone) is tinted as heat. PATH-ledger «Чесна фізика» asks for no tint on «теплий»; «гарячий» and bulged stay as they are (`docs/volumes/electronics/PATH-ledger.md:172`) | `M/shared/parts/look.ts:59-63` (`capacitor: CHARRED`), `:100-117` (`surfaceOf` tints any non-burnt status by heat); load from voltage at `M/sim/core/limits.ts:79` | `look.ts` tints every kind by heat; VISUAL §4.8 has no capacitor rule | Add `KindLook.tint: 'heat' \| 'hot'`, with capacitor `'hot'`: tint only while the status is `hot` or `bulged` (overvoltage, where the leak current really heats). Add a test in `look.test.ts` and a VISUAL §4.8 line. Chapters must also not print the model's «теплий» for a capacitor in panels or QA (`capacitor-kinds/amp`, `capacitor/reservoir`, amplifier at load 0.52) | E4-0, before `capacitor` / `capacitor-kinds` |
| 4 | DC-only looks: the LED's light, the meter's V and the door's inner view ignore the model in time; a capacitor discharge is invisible except on the scope | `C/shared/bench/index.ts:471-476`, `:521-530`, `:572`, `:575-576`; `M/shared/dive/door.ts:233-238` | by construction (E2-6/E2-7 before E2-9 existed) | §4.4: watch taps on `live`, the stream runs while watched, LED brightness and the inner view's volts from the stream (and optionally meter V) | E4-0 (blocks `capacitor/store`, `capacitor/capacity`, `capacitor/inside`) |
| 5 | Tray labels: one `Prints` for every label, shown only if the smallest px-eq ≥ 16, so any back-row label (electrolytic, film, pot) hides every label on `stand` | `M/shared/hand/tray.ts:162`, `:221-227`, `:254`; rule at `M/shared/parts/part.ts:200-224` | one legibility switch for two rows of different em (0.22 / 0.19) | Two `Prints`, one per row (front and back), each with its own `view`. Optionally a VISUAL §6 line | E4-0 (`divider` pot, every capacitor tray) |
| 6 | «1 mF 16 V» on the 1000 μF can and its tray label; PATH says «1000 μF» | `M/shared/parts/capacitors.ts:60-62` (`fmtSI(farads,'F')`) | the SI formatter picks milli | Print electrolytics in μF (`fmtNumber(farads·1e6)` + «μF»); update E2-4's print tests | E4-0 or the `capacitor-kinds` builder |
| 7 | `createStepStand` mounts without `sound`; `Naming` has no scope or player | `M/shared/steps/stand.ts:16-19`, `:23-26`, `:58` | written before E2-9/E2-10 reached main | Add `sound?: boolean` and `scope?: string`, `player?` to `Naming`; lift the meter chapter's player tap | E3-10 or E4-0 (`filter`, `divider/volume` and `capacitor/reservoir` need sound) |
| 8 | Shared `handPolicy`: scope probes get the red probe's name; plug leads are never takeable; `kindOf` lacks capacitor and pot | `M/shared/steps/policy.ts:37-38`, `:49`, `:56-61` | written for E3 steps | probes as a list of names (as `C/chapters/meter/parts/policy.ts:10-48`), a `lead?(name)` rule, more kinds | E4-0 |
| 9 | No capacitor inner view; the wedge cuts only about a horizontal axis; `InsideState` has no volts or bulged | `M/shared/dive/cutaway.ts:14-16`; `M/shared/inside/wedge.ts:26-33`, `:145-149`; `door.ts:238` | not built yet | §9.3 | a shared task like E3-5 ahead of `capacitor/inside` (E4-S), or that chapter's builder |
| 10 | Magnifier only over board parts (`capacitor-kinds` wants the tray) | `M/shared/dive/poses.ts:46-60`; `door.ts:161-163` | design | seat parts on the board, or a VISUAL §7 decision plus a tray door | `capacitor-kinds` builder (decide first) |
| 11 | `seatLead` does not check a plug's reach | `M/sim/board/seat.ts:164-173` | only tests check reach | check reach in `seatPreset`, or keep testing every board with plugs | chapter builders (tests); optional E4-0 |
| 12 | Amplifier with sound runs at 2.5–3.5× real time on desktop, an estimated 0.6–0.9× on a phone: the sound tears | `batch-E2.md` §3.4, §4; `C/shared/model/live.ts` | model cost (jumpers at 1 mΩ, filter) | owner decision 17 (live or loop), not a code fix | owner; `filter`, `divider/volume`, `capacitor/reservoir` are at risk |
| 13 | The first press on the dock starts no sound (a DOM press is not the engine's gesture) | `C/shared/README.md:121-125`; `batch-E2.md` §4 | platform | the step's text asks for a tap on the scene | `filter` builder |
| 14 | Tight spots: the sandbox `scope` board's J2 arc is 0.005 under the pot case (the `filter/lows` board); the speaker's lead crosses the volume knob; C3's print is covered on `board` and hides J10 on `meter/amps` | `task-E2-9-report.md` concerns; `task-E3-5-report.md` fix-round concerns; `task-E3-8-report.md` review | `AMPLIFIER_PRESET` geometry | re-lay part of the preset if a step shows it (presets tests guard bodies) | `filter` and `capacitor-kinds/amp` builders |
| 15 | `M/` sandbox `divider` step and checks still run the pre-merge bench | `M/_dev/chapters/_sandbox-electronics-bench/scene.ts:383` | merge pending | take `C/`'s sandbox and keep `M/`'s Ω-«—» check | E3-10 |

## 13. Shared changes from E3 that later chapters must follow

1. **Ω reads «—» on a live circuit** (E3-6; `M/shared/instruments/meter-model.ts:78-79`, `driver.ts:337-351`). An Ω
   step opens the switch first (dock toggle `battery-switch` on a phone) or has no source. Capacitors count as a DC
   path.
2. **`shared/steps` is the only home for step helpers** (E3-7; REUSE.md:110). Do not copy them into a chapter; extend
   the module and add its tests.
3. **Seat every board through `stand.board()`** (clear, then preset) until fix 2 lands.
4. **Grips show only for what `take` allows, and the body glow is mouse-only** (E3-6, `hands.ts:1266`, `:1277`). QA
   on phone shots should expect no stray capsules.
5. **The tray leak fix** (E3-7 and E2-10). Anything a module takes out of the tree in its own `dispose` must be
   disposed there (README «Rules», `C/shared/README.md:126-128`).
6. **`SCOPE_INPUT` 1 MΩ per probe** (E3-8). Every probed node is loaded; recompute the numbers (§5).
7. **Scope `channelVolts`, `ScopeWords.y2` and `peak()`** (E3-8). Use them for per-channel zoom and crest readouts.
8. **`STILL` rounds the warm-up up to a half bar, 1 s** (fix:E3-8#1, uncommitted at `C/…/driver.ts:179-198`). Held
   sweeps of music now open on a bass note. Held-page hashes change.
9. **Callout points sit on the part's body toward the camera**, and QA raycasts that each lands on its own part
   (E3-7, `resistor-pick/steps/06-on.ts:57-116`).
10. **A chapter's own shot needs a `fit` sphere** for tablets (E3-6, c128d6a).
11. **«Нові деталі»**: after a step can burn or bulge something, a dock button re-seats the step's board
    (`resistor/amp`, `C/chapters/meter/steps/02-amps.ts:65`, `:98`). `capacitor-kinds/rated` and `reverse` need the
    same.
12. **Amplifier hazards**: removing D2/D3 burns Q2 in 0.8 s, and «A» across amplifier rows burns D1 or the LED
    (`progress.md:53`; `task-E3-3-report.md`). Steps on the amplifier must forbid those removals or modes.
    `capacitor/reservoir` removes the 470 μF reservoir: measure that nothing burns.
13. **`bench.closed` and the `PLAYER` setting persist across presets.** Every step sets them on entry.

## 14. What the E4 steps need from the bench

| Step | Bench support today (merged) | Missing |
|---|---|---|
| `divider/two`, `ratio`, `load` | meter V on rows; presets | — |
| `divider/pot` | `pot-10k`, knob through a panel slider plus `setSetting(state,'P1',v)` | `kindOf('pot')`; a tray label distinct from `resistor-10k`; back-row label (bug 5) |
| `divider/volume` | amplifier, scope, `peak()`, sound | sound in `createStepStand` (bug 7); PATH numbers at 1 kHz must become melody numbers; phone performance (bug 12) |
| `capacitor/store`, `capacitor/capacity` | DC lights the LED while the switch is closed | **the LED's fade after the switch** (bug 4) |
| `capacitor/inside` | door, depth slider | **capacitor inner view, volts in time** (bugs 4, 9); VISUAL §7 |
| `capacitor/slow`, `capacitor/time` | scope roll, sandbox `rc` template, 4.7 k / 10 k / 22 k in E24 | numbers with the 1 MΩ probe (§5) |
| `capacitor/reservoir` | amplifier, scope on the supply row, remove C by hand (no restart) | sound and performance (bugs 7, 12); no «теплий» on C (bug 3) |
| `capacitor-kinds/ceramic`, `film`, `electrolytic` | prints («104», «1μ»/«105», «470 μF 16 V»), floor `part` through the door | magnifier over the tray (bug 10); film half-cut and can view (bug 9); tray rows ≤ 6 per row; «1000 μF» (bug 6); labels (bug 5) |
| `capacitor-kinds/rated`, `reverse` | heat, «hot», bulge, steam (`C/`), flip | no tint while «теплий» (bug 3); «Нові деталі» |
| `capacitor-kinds/amp` | meter V across three cans | probes reaching around tall cans; never show the «теплий» word |
| `filter/block` | scope sweep with `auto:false`, explicit level | — (τ is 9.9 ms with the probe) |
| `filter/pass` | player plugs as a source | `lead:` rule in the shared policy (bug 8) |
| `filter/coupling`, `highs` | two channels against ground; swap the 470 μF by hand (the stream goes on) or by preset (the melody restarts) | sound and performance (bugs 7, 12, 13) |
| `filter/lows`, `tone` | sandbox `filterParts` board (`C/…/scene.ts:196`), pot as variable R | J2 against the pot case (bug 14); sound |
