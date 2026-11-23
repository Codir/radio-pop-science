# `shared` — the bench of the volume «Радіоелектроніка»

The scene's side of the volume: the dark room and the stand, the breadboard, the parts, the hand, the instruments, the
speaker, the dive through the magnifier and the bench's link to the circuit model (`sim/core`, `sim/board`). No step's
logic lives here: a chapter mounts the bench, puts its step's board on it and says what the reader may take; `steps`
holds only the small pieces the chapters' steps share, with the chapters' words and numbers passed in. The look and
the numbers of all of it are fixed by `docs/volumes/electronics/VISUAL.md`. Batch E2
(`docs/superpowers/plans/2026-11-20-electronics/batch-E2.md`) built it one task at a time, E3-5 added the inside of a
resistor and the boards of the pilot's steps, E3-7 the module `steps`; the batch's report is
`docs/volumes/electronics/reports/batch-E2.md`.

Each module has its public face in `shared/<module>/index.ts`; there is no `shared/index.ts`. The sandbox
`_dev/chapters/_sandbox-electronics-bench` imports only `@electronics/shared/<module>`.

## The parts

| Module | What it is | Files | Batch · task |
|---|---|---|---|
| `bench` | the room, the base, the breadboard in 3D, the light rig, the permanent things, the magnifier in its holder, the shots; `mountBench` and the frame | `index`, `room`, `base`, `board-view`, `layout`, `light`, `materials`, `mounts`, `props`, `shots`, `air`, `dyn-tube`, `switch-slider`, `tools/` | E2 · E2-3 |
| | the parts on the board on their legs; a look outside the circuit (`show`) | `on-board` | E2 · E2-4, E2-5 |
| | the leads and plugs of the things, the battery's switch under the hand, what a lead drapes over | `fixed`, `switch`, `mounds` | E2 · E2-5 |
| | the LEDs' three lights; the wisp of a burn and the bulged can's steam | `lights`, `smoke` | E2 · E2-7 (steam E2-9) |
| `parts` | every kind of part with the marks of the real one; the permanent things; the look of heat, the burn, the bulge | `part`, `resistor`, `capacitors`, `diode`, `led`, `transistor`, `pot`, `jumper`, `speaker`, `battery9v`, `player`, `bulb`, `code`, `look`, `heat-scale` | E2 · E2-4; the look E2-7; the catalog's marks E2-M; the bands' reader E3-5 |
| `hand` | the two gestures, the grips and cues, the tray, the legs, the ground a lead lies on, the scripted swap | `hands`, `tray`, `leg`, `grips`, `cue`, `curves`, `glide`, `terrain`, `swap` | E2 · E2-5 |
| `model` | the only caller of the circuit model (`driver`); the model in time for the scope and the speaker (`live`); the checks' hashes | `driver`, `live`, `hash` | E2 · E2-6; the model's time E2-7; `live`, `still` E2-9; the speaker's pace E2-10 |
| `instruments` | the multimeter and its probes; the oscilloscope; the speaker in sound | `meter`, `meter-model`, `probe`; `scope`, `scope-model`, `sweep`; `speaker` | E2 · E2-6; E2-9; E2-10; the speaker's crest E3-9 |
| `dive` | the magnifier as the door from the step's shot to a part and into it; the ladder «де ми» | `door`, `camera-rail`, `rail-math`, `poses`, `levels`, `lens-keeper`, `ladder`, `cutaway` | E2 · E2-8 |
| `inside` | a resistor's carbon film, opened by the door | `film`, `wedge` | E3 · E3-5 |
| `sound` | the volume's own sound output and the model playing in blocks (its own README) | `output`, `plan`, `stream`, `handler`, `protocol`, `model.worker`, `tape`, `board` | E1 · E1-9; probes, restart, damage E2-9 |
| beside it: `sim/board` | the board as data: sockets and rows, footprints, what stands where, the netlist, the steps' boards | `layout`, `footprint`, `seat`, `netlist`, `presets` | E2 · E2-2; footprints E2-M; presets E3-5 |

## Mount

```ts
import { mountBench, type PresetPart } from '@electronics/shared/bench';

export default defineScene((ctx) => {
  const bench = mountBench(ctx, { sound: true }); // once per mount: everything below; freed with the chapter
  ctx.stage.define({ intro: { camera: 'stand' }, measure: { camera: 'meter', params: { meter: 1 } } }); // shots by name
  ctx.stage.param('meter', 0, { duration: 0.6, onChange: (v) => (bench.meter = v) }); // an instrument slides in
  return {
    enterStep(id, info) {
      bench.preset(BOARDS[id] ?? [], PLUGS[id]); // the step's own board, its parts new and whole (or `bench.clear()`)
      bench.tray.set(TRAYS[id] ?? []); // what the tray offers
      bench.hands.policy = { take: (k) => FREE.has(id), tooltip: (k) => WORDS[k] }; // what may be taken, and its name
      bench.closed = 1; // the battery's switch
      if (info.instant) bench.snap(); // a deep link: no ramps
    },
    update: (dt, t) => bench.update(dt, t), // once a frame, before anything that reads the bench
  };
});
```

`mountBench(ctx, options?)` adds the bench to `ctx.root`, sets the room's environment and the depth of field of the
main shot and registers the shots of `shots.ts` under their names (`stand`, `board`, `meter`, `scope`; on a phone
each of them is `phone`, the field of sockets only — VISUAL §9 —, registered again when the form factor changes). It
makes the hand, the model of the board, the multimeter, the oscilloscope and, with `sound`, the speaker, and exposes
the readers for checks. Every mount builds its own bench, nothing lives at module level, and everything it made — the
background thread, the sound output, the listeners, the geometries — goes with the chapter (`ctx.onDispose`; the
sandbox's check `leaks` holds it).

**The frame** (`bench.update`): the filament's and the slider's ramps; the light and the room; the parts and the plugs
follow the board's state; the instruments' probes; the hand (what arrives this frame is in the state); the model's sync
(a new shape compiles, a new setting solves); the model's time (`advance`: heat, a burn and its one wisp); the looks
and the lights from the model; the multimeter's reading; the model in time (the scope's taps, the board, the blocks,
the speaker) and the sweep shown now; on a held page the scope's window; the lit rows, the tray, the prints. A chapter
reads the bench after `bench.update`; the dive's door and the magnifier's keeper go after it («dive» below).

## Options

| Option | Default | What it does |
|---|---|---|
| `sound` | false | the speaker in sound («instruments — the speaker» below): the bench makes the volume's own sound output (an `AudioContext` of its own after the first gesture on the scene, none with `?noaudio`) and plays through it the current the model gives the speaker `SPK`. The model in time then runs from the mount, paced by that output — the player plays on whether the speaker is in the circuit or not — and the chapter's ambient mood is silent while the speaker is in the circuit. Without it the bench makes no sound and no context, and the model in time runs only while the scope is there |

## State

What a chapter, the reader's hand and the bench write, and what each part of the bench is (the numbers are read every
frame by `bench.update`):

| Member | Default | Written by | What it is |
|---|---|---|---|
| `ambient` | `BENCH_AMBIENT` 0.8 | the chapter | lift of the unlit room: a cool fill and a stronger moon that step back when the lamp burns |
| `moon` | 1 | the chapter | strength of the cold moon |
| `closed` | 0 | the chapter; the hand (a tap on the slider, or the dock's toggle the chapter binds) | the battery's switch: 0 open (the thumb pushed left, the gap shows) … 1 closed — the setting of the model's part `SW` in `state.settings` |
| `flying` | false | the dive's door; a chapter at its border | the camera flies: the hand and the switch do nothing |
| `lens`, `lensTarget` | 0, `null` | the chapter (a door's keeper takes it over) | the magnifier: 0 in its holder … 1 at `lensTarget` (a `LensPose` in the base frame, e.g. `overPose`) |
| `lensCall` | 0 | the chapter | the step asks the reader to take the magnifier: the resting ring turns full cyan and pulses |
| `dive` | 0 | the chapter (a door's keeper) | progress of the flight through the ring: the rim's arcs from 0.5 on |
| `meter`, `scope` | 0 | the chapter (a step's param, tweened 0.6 s) | the instruments: 0 away beyond the frame's edge … 1 on their places; their probes may be taken only at 1, and go with them when they leave |
| `state` | empty | the chapter (`preset`, `clear`; a pot's knob: `setSetting(bench.state, 'P1', v)`); the hand (legs, plugs) | the board as data (`sim/board`): what stands in which socket, the plugs, the settings |
| `hands.policy`, `tray.set` | nothing taken, an empty tray | the chapter | what the reader may take, the words under the pointer, what the tray offers («hand») |
| `multimeter.mode`, `.put` | `'V'`, at rest | the chapter; the hand moves the probes | the meter's dial and its probes («instruments — the multimeter») |
| `oscilloscope.configure`, `.put` | `SCOPE_DEFAULTS`, at rest | the chapter; the hand moves the probes | the scope's scale, display, trigger and probes («instruments — the oscilloscope») |
| `lamp` | 0 | the bench, from the model | read-only: the lamp's filament 0 cold … 1 white, from the circuit model alone, shown with the filament's inertia |
| `model` | — | the bench (sync and time every frame) | the circuit on the board; a chapter reads it (`reading`, `part`, `rowVolts`) and calls `forget` only for a part it puts under a used id by hand |
| `live` | `off` | the bench | the model in time: for the scope, and with `sound` for the speaker |
| `speaker` | `null` | the bench (`sound`) | the speaker in sound; a chapter reads it (`inCircuit`, `output`) |
| `leds`, `smoke` | — | the bench, on the model's events | read-only: the LEDs' lights; the wisps of a burn and a bulged can's steam |
| `room`, `base`, `light`, `layout`, `board`, `parts`, `props`, `fixed`, `switch`, `tools` | — | the bench | the things themselves, below |

**Who writes what.** The chapter writes the plain numbers above, the step's board (`preset`, `clear`, a pot's
setting), the hand's policy, the tray, the instruments' dial, scale and probes, and the words of its panel. The
reader's hand writes the board's state (a part, a leg, a plug), the switch and the probes' places. The bench writes
everything the model says: the model's solve and time, the lamp, the looks, the lights, the wisps, the meter's reading,
the scope's trace and the speaker's sound — none of these has a setter. The dive's door writes `flying` and lays the
magnifier through its keeper. Only `shared/model/driver.ts` calls the circuit model; the stream's thread runs the
same model on the board the driver gives it.

## Rules

- **The instrument shows only the model** (VISUAL §1, principle 3): whatever shines, warms, burns, sounds or shows on an
  instrument is the circuit model's output for the board now. While the model's last solve failed (`ok: false`) the
  bench holds the last good look and shows nothing new — never a `NaN` in a chart or a readout.
- **No step logic, no words.** The bench has no step ids and no Ukrainian word; a chapter gives the words (the hand's
  tooltips, the readouts' labels, the chart's axes). The sandbox's words are its `SANDBOX`.
- **A step's board is new and whole.** `preset` and `clear` take every part off and the model forgets them, the
  permanent things too; a part put under a used id by other means needs `model.forget(id)` first.
- **Time** is the engine's: tweens and counters in `update(dt)`, never a timer; `dt` 0 (a held frame) and 1/15 s are
  normal frames; chance is `ctx.random`, ids are counters; no state at module level (two copies of a chapter live side
  by side at a border).
- **Tables by kind are partial** (`Partial<Record<PartKind, …>>` with a `null` branch), never an exhaustive switch:
  the catalog grows.
- **The light count never changes**: the LEDs' three lights, the wisps' and the marks' keepers are made with the bench.
- **Sound** starts only after the engine's gesture — a press on the scene or a key; a press on the panel is not one —,
  never with `?noaudio`, follows the engine's sound and volume settings and is never louder than the engine
  (`shared/sound/README.md`). From the circuit one hears only the speaker; the chapter's mood is silent while the
  speaker is in the circuit.
- **What leaves the tree is freed by its owner.** The engine frees the chapter's root after `ctx.onDispose`; a thing
  that takes its group out of the tree in its own `dispose` frees it there (the tray's block: one geometry a mount was
  left behind until the check `leaks` found it, E2-10).
- **Imports.** The sandbox imports only `@electronics/shared/<module>`; what it needs of `sim/**` comes through
  `bench/index.ts`. No other volume is imported: copies are recorded in `docs/volumes/electronics/REUSE.md`.

## Readers for checks

| Reader (`__app.read`) | What it gives | Section of the sandbox's `qa/measure.mjs` |
|---|---|---|
| `electronics-bench` | the mouths drawn, the rows, the last frame's draw calls, the print shown, a phone's page | `room`, `shots` and every draw-call check |
| `electronics-board` | every part with the socket of each leg, the plugs, the settings, the models, the netlist's key, the parts pending | `parts`, `hand`, `meter`, `heat`, `loupe`, `film`, `scope`, `sound` |
| `electronics-parts` | every part and permanent thing: where, its draw calls, its prints and whether the camera sees them | `parts` |
| `electronics-hand` | what the hand holds, where a carried end would go, the preview, the lit rows, the switch's flips | `hand` |
| `electronics-motion` | the camera, the thing moved, its tilt and every plug, every frame | `hand` |
| `electronics-model` | the netlist's key, solves, compiles, `ok`, `failure`, `dcMs`, every part's reading and the rows' volts | `parts`, `meter`, `heat`, `film` |
| `electronics-heat` | every part's condition, heat, load, light and surface; the things, the lamp, the LEDs' lights, the wisps, the burns | `heat` |
| `electronics-meter` | the dial, the probes' sockets, the reading now and the display's text | `meter` |
| `electronics-scope` | the model in time (where, blocks, `since`, `now`), the sweep, its points and hash, a held page's windows | `scope` |
| `electronics-sound` | `on` (the option); the output (state, clock, played, underruns, queued, latency, gain), the stream (mode, ms, `since`, the sample heard), the speaker in the circuit, its full scale, blocks, levels and hash | `sound`, `repeat`, `leaks` |
| `electronics-dive` | the door's rail, the floor, whether it flies, the inner view, the camera and the lens | `loupe`, `film` |

Probes (`__app.locate`): `socket:<id>` for all 204 sockets; `bench:lamp`, `bench:lens`, `bench:meter`, `bench:scope`,
`switch`; the hand's `part:<id>`, `leg:<id>:<k>`, `tip:<id>:<k>`, `lead:<name>`, `end:<name>`, `tray:<key>`,
`probe:<red|black|ch1|ch2>` and the probes' tips `end:<red|black|ch1|ch2>`; the door's `dive:end0`, `dive:end1`,
`dive:ring-top`, `dive:ring-bottom`. The sandbox adds `film:film`, `film:groove`, `film:rod`.

## `bench` — the room, the base and the breadboard (E2-3)

What the bench has (read-only): `room`, `base` (`base.frame` is the tilted base frame: whatever stands on the base
goes there, then `tameAll(bench.group)`), `light` (the rig owns `ctx.env.tune`; never tune the environment from a
chapter; the lamp light hangs at the `filament`, and `mountBench` puts the shadowless `bounce` above the lamp's pool
every frame), `layout` (the board as data, `sim/board`), `board` (the 3D breadboard: `socketWorld(id)`,
`socketLocal(id)`, the instanced `mouths`, the `print`, the lit rows `highlight(rows, dt)` / `lit`), `state` and
`parts` (the parts on the board, below), `props` (the permanent things: the battery box with the switch, the player,
the speaker and the lamp with their real marks from `shared/parts` — `props.things`, `props.bulb` — the lamp post and
the `filament` where the light hangs; `props.meter` and `props.scope` are the instruments' places on the table),
`fixed`, `switch`, `tray` and `hands` (the reader's hand, «hand» below), `tools` (the magnifier and its `holder` pose),
`model` and `live` (the circuit model of the board, and the same in time, «model» below), `multimeter`,
`oscilloscope` and, with the option `sound`, `speaker` («instruments» below), `leds` and `smoke` (the LEDs' light on
the board; the wisps of a burn and a bulged can's steam in the air, read-only — «light, heat, burn» below).

The board's print (the letters of the lines, the column numbers) is drawn only where all of it has ≥ 16 px-equivalent
per em (`chapter-check`'s rule): on `board`, not on `stand`, never on a phone. The rails' «+» and «−» are not print
but marks of the body, like the stripes (VISUAL §3): flat geometry 0.1 wide in the rail's colour, always shown.

For checks: `__app.read('electronics-bench')` → `{ sockets, rows, drawCalls, print, phone }` (the mouths drawn, 36
rows, the last frame's draw calls, the print's texts shown, a phone's page); probes `socket:<id>` for all 204 sockets
(`a1` … `j17`, `+1` … `+17`, `-1` … `-17`), `bench:lamp`, `bench:lens`, `bench:meter`, `bench:scope`. The sandbox's
`qa/measure.mjs --only room,shots` reads them.

`model/hash.ts` has the checks' small helpers `fnv1a` and `meanOf` (copied from `radio`).

## `parts` — the parts with their real marks (E2-4)

`shared/parts` builds every part as a model with the marks of the real one (VISUAL §4): the resistor's value in four
colour bands from the data (`resistorBands` → `bandColor`, gold and silver mixed from tokens), the 1N4148's glass and
the 1N4007's print, the LEDs in five colours with the collar cut on the cathode's side, the pot whose knob follows its
setting, the violet jumper, the ceramic disc and the film box with their code (`capacitorCode`), the electrolytic can
with its stripe over the minus leg and the rim, the transistors in TO-92 with their name on the flat side; and the
permanent things of the base — the 9 V battery in its box, the player, the speaker and the lamp (the circuit's bulb,
made smaller).

```ts
const r = buildPart('resistor-4k7'); // null for a key with no model: a fixed thing, or a key the catalog lacks
board.group.add(r.group);
r.fit([board.socketLocal('a3'), board.socketLocal('a7')]); // the body between the tips, the legs bent to them
r.setLook({ light, setting, heat, status, load }, dt); // the hook of the model's state, every frame (dt may be 0)
r.view({ camera, aspect, phone, room }); // the print only where it reads (≥ 16 px-equivalent), never on a phone
```

A part is built in its body frame — the origin on the board's face under the middle between its outer legs, +x from
leg 0 to the last, +z toward the reader at the orientation 0 — and `fit(tips)` stands it on any tips: every quarter
turn, across the channel (e → f is 0.6), a leg re-seated or in the air. Every part has `hit`, the invisible box of its
body (gesture 1's target: never drawn, still hit by a ray), at most six draw calls, no shadow; `materials` (all its lit
K materials) and `body` (those that take the look of heat, never a resistor's bands). `setLook` shows the model's
state: the heat on the body's surface, the burnt marks, the bulged electrolytic (`look.ts`, «light, heat, burn» below),
an LED's light (`light` b → glow 1.8 · b and a halo 0.5 · b, none below 0.02) and a pot's knob (`setting`, 300° within
0.15 s); `surface` is what the body shows now. The prints are Text3D, made only where the fonts are loaded (never in
unit tests).

Every mark is read off the key's spec: a `capacitor`'s code, or its value and voltage, from its `dielectric`, `farads`
and `ratedV` (E1-5), a `transistor`'s name and type from its key and `polarity` (`TRANSISTORS`) and its leads from the
board's `TO92_LEGS` (E1-6). `printed` is what a model's print says, text by text, also where the fonts are not loaded
and no Text3D is made (unit tests). Where every key of the catalog stands: «The catalog on the bench» below.

On the bench: `bench.state` (the board as data) and `bench.parts` (`bench/on-board.ts`): every frame the 3D parts follow
the state — a part that came gets its model, a part whose legs moved stands on its new sockets, a leg taken out of its
socket hangs in the air over where it was while the body keeps its turn, a part that left is disposed (the hand moves
the legs of the parts it drives: «hand» below); `bench.parts.show(id, model, sockets)` stands a model the state does not
hold outside the circuit (a look alone). `bench.preset([{ id: 'R1', spec:
'resistor-4k7', at: 'a3', o?, setting? }, …], leads?)` makes the board hold exactly a step's parts at once, and the
named plugs in their sockets (a part or a plug that does not stand there is a RangeError); a part of two legs that
stands at any span within its reach — a jumper from a rail to the row it feeds — takes `to`, the socket of its leg 1,
instead of `o` (`{ id: 'J1', spec: 'jumper', at: '+3', to: 'a3' }`); `bench.clear()` takes everything off.
`props.things` and `props.bulb` are the permanent things; the bench gives the bulb's filament the light rig's glow every
frame.

For checks: `__app.read('electronics-board')` → `{ parts: { R1: { spec, legs } … }, leads, settings, models, shown, key,
pending }`;
`__app.read('electronics-parts')` → for every part, shown model and permanent thing (`battery`, `player`, `speaker`,
`lamp`): `{ key, center, radius, drawCalls, prints, printsShown, printsClear, printsCovered, printAt, printEm }`
(world). `printsClear` counts the prints the camera sees with nothing drawn in front of them (rays from the camera to the
middle and both ends of each print's line), `printsCovered` those shown although something covers them. The sandbox's
step `parts` and `qa/measure.mjs --only parts` read them.

## The catalog on the bench (E2-M)

Every key of the circuit model's catalog (`sim/core` `PARTS`) has one place on the bench, and
`shared/__tests__/catalog.test.ts` goes through all of them:

- **a part of the board** — a footprint (`sim/board` `footprintOf`: a leg for every pin of the key, every pin in one
  leg), a model on those legs (`buildPart`, its marks read off the key) and a slot of the tray in the row its size asks
  for, the drawn part within the slot: the resistors, the pot, the jumper, the diodes, the LEDs, the capacitors and the
  transistors — one of each kind stands on the board in the sandbox's step `parts`;
- **a permanent thing of the base** — a fixed part of the netlist (`sim/board` `BENCH_FIXED`) with its rails or plugs in
  the order of the catalog's pins, and its model on the base (`bench.props`): the battery `BAT` and its switch `SW`, the
  speaker `SPK` (`spk+` on its plus, `spk-` on its minus), the lamp `LAMP` (`lamp1`, `lamp2`: no polarity) and the
  player `PLAYER` (the signal `pl+` on its plus, the common `pl-` on its minus); a coral plug is always a plus, an ink
  one a minus;
- **or a row of «Чого стенд не показує»** below, with the reason.

**Which pin is in which leg.** Leg k at the orientation 0 carries the catalog's pin `Footprint.pins[k]`, and the test
holds every key's legs, from leg 0, to the real part's: a resistor, a ceramic or film capacitor and a jumper `a`, `b`; a
diode and an LED `anode`, `cathode` — the diode's band and the LED's cut collar on the side of leg 1; an electrolytic
`plus`, `minus` — its stripe over leg 1; the pot `ccw`, `wiper`, `cw`. The longer leg of a real LED's anode and of an
electrolytic's plus is not on the bench: both legs are hidden under the body and the same (VISUAL §4, «Полярність»),
and the cut and the stripe show the polarity. A transistor in TO-92, seen on its flat side with the legs down, from the
left — pin 1 of the maker's package drawing is the leftmost seen so (`sim/board` `TO92_LEGS`, VISUAL §4.7):

| Key | Leg 0 · 1 · 2 | The maker's drawing |
|---|---|---|
| `transistor-bc547b` | collector · base · emitter | Philips «BC546; BC547 NPN general purpose transistors» (2004 Nov 25), SOT54 (TO-92) |
| `transistor-bc557b` | collector · base · emitter | Philips «BC556; BC557 PNP general purpose transistors» (1999 Apr 15), SOT54 |
| `transistor-bc337-25` | collector · base · emitter | Philips «BC337; BC337A; BC338 NPN general purpose transistors» (1999), SOT54 |
| `transistor-bc327-25` | collector · base · emitter | onsemi «BC327» (January 2024, Rev. 2), TO-92 |
| `transistor-2n3904` | emitter · base · collector | Fairchild «2N3904 / MMBT3904 / PZT3904» (2001, Rev. A), TO-92 |
| `transistor-2n3906` | emitter · base · collector | Fairchild «2N3906 / MMBT3906 / PZT3906» (2001, Rev. A), TO-92 |

### «Чого стенд не показує»

What the catalog has and the bench never shows (the test reads this table: every key in backticks of the first cell):

| Keys | Why |
|---|---|
| `ideal-9v`, `ideal-5v` | ideal sources: the references of hand calculations and of the oracle; the bench has batteries only (the design §3.4). Inside the driver, the ohmmeter's own solve takes `ideal-5v` for the meter's battery (`OHMMETER`), never on the board |
| `ideal-ac-6v` | the oracle's sine in time and the filters' generator; the safe adapter of the rectifier's branch is the decision of the task that builds that branch (the design §3.4; `docs/volumes/electronics/PATH-NOTES.md` §10) |
| `player-tone` | the amplifier's test tone of 1 kHz, for its tests and their oracle (`sim/core` `amplifier.ts`); the bench's player plays the volume's melody, `player` |
| `battery-4aa`, `battery-aa` | the bench has one source, the 9 V battery in its box with the switch (VISUAL §1, principle 6; §2); a second source of 6 V is a choice the path has not taken (`PATH-NOTES.md` §7, variant «в») |
| `earphone-32` | the bench's sound is the 8 Ω speaker on the base (VISUAL §2, §4.1), which the amplifier plays (`sim/core` README, «The amplifier»); the 32 Ω earphone is a variant the path has not taken (`PATH-NOTES.md` §5) |

## `hand` — the reader's hand (E2-5)

The bench mounts the hand with itself: `bench.hands` (the two gestures, VISUAL §6), `bench.tray` (the tray of parts on
the table), `bench.fixed` (the battery's wires and the plug leads of the speaker, the player and the lamp) and
`bench.switch` (the battery's slide switch under a tap). A chapter says what may be taken and names it:

```ts
bench.tray.set(['resistor-1k', 'jumper', 'led-red']); // a step's kinds; the row is their size's choice, ≤ 6 a row
bench.preset([{ id: 'R1', spec: 'resistor-4k7', at: 'a3' }], { 'spk+': 'c17', 'spk-': '-17' }); // parts and plugs
bench.hands.policy = {
  take: (k) => k !== 'switch', // 'part:R1', 'leg:R1:0', 'lead:spk+', 'tray:resistor-1k', 'switch'
  flip: () => false, // no turning end for end in this step
  done: (k, where) => {}, // a thing arrived: 'board', 'tray' or 'away'
  tooltip: (k) => names[k], // the words are the chapter's
};
```

- **Gesture 1 — a whole part** (`part:<id>`, or a new one from a slot, `tray:<key>`): the part leaves its sockets at
  the press (out of the circuit, not pending) and follows the hand; over the board leg 0 looks for a socket within
  `SNAP` and, when every leg finds a free one, the part hangs `HOVER` over them (`hands.preview`, the rows lit, a cue
  ring on each); let go, the legs go down in `SEAT_SECONDS` and the board changes when they have arrived. Over the
  board with no place it goes back where it was; off the board, to its slot (0.4 s) and is gone. A click turns a
  placed part end for end (0.3 s). A part from the tray is level with the table in it and takes the board's tilt on
  its way (0.25 s, from the level it has), and lays it down again on its way back (0.4 s). On a phone the tray is the
  dock's: `bench.hands.offer(key)` puts a new part over the board to be taken.
- **Gesture 2 — one end** by its grip (`leg:<id>:<k>`: a ring on an axial part's leg, a tab before a radial part's
  body, a capsule on a jumper's end; `lead:<name>`: the capsule on a plug; `probe:<name>`: the capsule on a probe's
  handle, «instruments» below): out of its socket at the press (the part pending), led within its reach (the part's
  span from its other legs, 4.0 of a lead from its thing, 9 of a probe from its jack); `hands.near` is the free socket
  within `NEAR` it would take (a probe: any but the other probe's) — a cue ring, the row lit — never the one it left
  until the hand has gone `AWAY`. A part's leg clicks in within `SNAP` while the hand moves; a jumper's end, a plug and
  a probe click in when let go within `SNAP` (they cross many sockets on their way), and lie where they were let go
  otherwise (a probe let go off the base goes back to rest by the meter); a part's leg let go with no socket goes back.
- On a touch screen the thing rides `LIFT` (48 px) above the finger and the grips are always shown; with a mouse they
  come while the pointer is on the part and 1.5 s after. Either way a grip shows only on an end the step's policy lets
  the hand take (`policy.take` of `leg:…`, `lead:…`, `probe:…`): a grip says «this can be moved» (VISUAL §6). The grips' spheres never overlap (VISUAL §6 and §8: the tests
  cast rays from the cameras of `stand`, `board` and `phone`). On a phone the radial parts' tabs are hidden: those
  parts are carried whole.
- The leads lie on the bench's ground and drape over what stands up: the board's body, the things on the base and the
  bodies of the parts standing on the board (`bench/mounds.ts`: a part's body box rises in 0.2 s when it comes to stand
  and sinks where it was in 0.2 s when the hand takes it whole, `hands.carried(id)`, so a plug lying on it or a wire
  over it never jumps); a plug let go on a part lies on its body, and a plug in the hand rides over the parts. The
  parts' own legs (a jumper's end let go) lie on the board's face.
- The battery's switch is a tap on its slider (`bench.switch`, `switch` in the policy). The shot `phone` leaves the
  switch out (VISUAL §9): a step that lets the reader flip it gives the dock a toggle bound to `bench.closed` — the
  sandbox's `battery-switch`, which also follows a step that sets it.
- Every part on the board stands on its `Leg`s (`bench.parts.legs`); while the hand does not drive a part, its legs
  follow the board's state at once (a step's `preset`, a test's `seatLeg`). `bench.preset` and `bench.clear` first let
  go of whatever the hand holds (`hands.reset`), and the model forgets every part they take off (`model.forget`, «model»
  below): a preset's parts are new and whole. The body's glow under the pointer is cyan emissive on the part's
  `body` materials (E2-7's heat look shares them); a mouse's pointer only — the engine keeps the last touched thing
  «under» a lifted finger, and a glow left there would tint the part (a burnt LED's dark dome) until the next touch.
- While the camera flies (`bench.flying`: the magnifier's dive, «dive» below) nothing can be taken: every handler is
  off, no grip is shown (on a touch screen neither) and no body glows.
- `hand/swap.ts` (`createSwap`) is a scripted repair kept for the chapters: a still copy of a thing leaves along a way
  while the new one comes back the same way.

For checks: `__app.read('electronics-board')` also has `key` (the netlist's shape: it changes when a leg moves to
another row) and `pending`; `__app.read('electronics-hand')` → `{ held, near, preview, rows, busy, switchFlips }`;
`__app.read('electronics-motion')` → `{ camera, focus, tilt, plugs }` (world, every frame: the camera, the thing the
hand moves now or moved last, that part's own up — its body's turn against the table — and every plug). Probes: `part:<id>`, `leg:<id>:<k>` (its grip), `tip:<id>:<k>` (the leg's foot on
the board's face), `lead:<name>`, `end:<name>`, `tray:<key>`, `switch`. The sandbox's step `hand` and
`qa/measure.mjs --only hand` (a mouse, `--touch`) drive them.

## `model` — the circuit on the board (E2-6)

`shared/model/driver.ts` is the only file of the bench that calls the circuit model (`sim/core`); everything the bench
shows of the circuit is read from it. The bench mounts one (`bench.model`) and syncs it every frame after the hand, so a
leg that arrived this frame is in the circuit the same frame:

```ts
const model = createBenchModel({ layout, board: state, extra: () => multimeter.extra() }); // fixed?: BENCH_FIXED, now?
model.sync(); // the board's netlist; a new shape compiles, a changed setting only solves again; nothing changed: nothing
model.ok; // the last solve succeeded; `failure` says why not ('singular', 'no-convergence')
model.rowVolts('7ae'); // 5.997 V on the divider; `nodeVolts(n)`, `reading(id)` → { u, i, p }; null after a failure
model.ohms(a, b); // what an ohmmeter reads between two nodes: Ω, Infinity (no path), null (no solve)
model.powered(a, b); // a source that drives a current is in their island: the closed battery, a plugged player
model.forget('R1'); // a new part goes under this id: its memory goes at once, the next sync solves again
model.advance(dt); // the model's time passes (heat; a part that burns is solved out at once): the ids burnt now
model.part('R1'); // { condition, load, heat, kelvin? } as the bench shows it; null while the last solve failed
```

- **Compile on a new shape, solve on a new setting.** The netlist's `key` (`sim/board`) is the circuit's shape: a part
  in or out, a leg in another row. A setting (a pot's knob, the battery's switch `SW`) is written into the compiled
  parts, which the model reads live, and the same circuit is solved again. `compiles`, `version` (one per solve) and
  `dcMs` (the last solve's time, `performance.now`; a test passes its own clock) are for the checks: a board of the
  sandbox solves in ≈ 0.03 ms.
- **One `ModelState` for the bench's life** (`model.state`): what the model remembers of every part — heat, burnt, a
  lamp's filament — lives there by part id through every new circuit. A part in the hand keeps its entry (it stays
  burnt); a part that left the board for good (into the tray: `state.parts` no longer has it) has its entry deleted at
  the next sync, as `sim/core/README.md` («The state») asks. The hand never gives an id twice (`sim/board` `nextId`),
  but a step's preset puts its own list under fixed ids (`R1`, `J1`) in the same call that takes the old parts off, so
  at the next sync the board cannot tell a new `R1` from an old one: whoever puts a new part under an id that was given
  calls `model.forget(id)` first (`bench.preset` and `bench.clear` do it for every part they take off). The entry goes
  at once and the next sync solves again, though the circuit's shape is the same.
- **A failed solve is never shown** (gotcha G7): `solution` stays the last good one, `ok` is false, and `reading`,
  `rowVolts`, `nodeVolts` give null until a solve succeeds — never a NaN, never the failure's zeros.
- **The ohmmeter's own solve** (`ohms`): the circuit now on the board with its sources out (the battery, the player),
  the meter's own source `OHMMETER` — 5 V behind 10 kΩ, at most 0.5 mA, so a lamp reads its cold 5.5 Ω — between the
  two nodes, and the voltage it makes over its current. It has a model state of its own (the burnt parts copied in as
  gaps): the bench's is untouched. Computed once per solve of the board and pair of nodes.
- **Whether the probes touch a live circuit** (`powered`, task E3-6, plan decision 5 of batch E3): a source of the
  circuit now on the board — the battery behind its switch, a plugged player — whose two terminals the rest of the
  circuit joins (its loop closed: it drives a current), with that loop reaching one of the two nodes; joined through
  the paths for direct current of every part at its setting (an open switch and a burnt part join nothing). The
  multimeter's Ω mode reads nothing there («—»).
- **Capacitors and transistors** (E1-5, E1-6) are parts of the board like any other: a board with them compiles and has
  its operating point (a capacitor open but for its leak), and the amplifier of `sim/core` (`amplifierNetlist`), every
  leg of every part in its node's row and the player's and the speaker's plugs too, has the very operating point of
  `sim/core` without the board, node by node and part by part within 1e-9 (`model/__tests__/driver.test.ts`). That
  build has no jumper, so its legs stand anywhere in their rows; built as on a real board — every part in its
  footprint's own shape (`place`), within its reach, and six jumpers (`seatLeg`) where one strip cannot hold a node —
  it has that point within 1e-4: a jumper's 1 mΩ (`WIRE_OHMS`) under its strip's current moves it by up to 5.1e-5,
  most in the output pair's bias current. The model's time here is the operating point's alone; the circuit in time
  is below.

- **A burnt part and a bulged can** (E1-5) stay so wherever they are moved, until they leave the bench: `part(id)` is
  `burnt` or `bulged` in the circuit and out of it, and the ohmmeter's own solve takes a burnt part as a gap and a
  bulged can as its leak of 1 kΩ (`BULGED_OHMS`). `advance` tells both by id; `part(id).condition` says which.

**The circuit in time** (E2-9). Two ways, both the model's:

- **`live.ts` — the board played in time** for the oscilloscope and the speaker: `bench.live`, E1-9's stream
  (`shared/sound`: one background thread, the main thread when there is none, and on a held page) at 24 000 samples a
  second in blocks of 1536. Without the option `sound` it is paced by the bench's own engine time through E1-9's
  `BlockPlan` (a request while the plan has room; `live.now` the sample the plan plays now, which the scope shows) and
  runs only while `bench.scope` is above 0 — no thread before. With `sound` the speaker's output paces it (a request
  while fewer than two blocks are queued there; `live.now` the sample heard now) and it runs from the mount, the
  player playing on whether the speaker is in the circuit or not; every request then records the speaker's current
  first — the ground's 0 V in its place while the speaker is out of the board given in the same request, so that a
  request's board and taps always agree — and the scope's taps after it («instruments — the speaker»). A new solve of the driver gives the stream the board of that moment
  (the model goes on from its last moment); a step's `preset` or `clear`, and every start after a pause, start it again
  from the board's operating point (`Stream.restart`). The driver's damage is the stream's (`benchDamage`: its burnt
  parts and bulged cans on the board, `StreamDamage`): it goes with every start — so a part burnt before the scope came,
  or while it was away, is a gap on the screen too, and a part a preset made new is whole — and with every solve that
  changed it (`Stream.damage`: a part burnt while the scope plays is a gap from the next block on, ≈ 0.1–0.2 s after
  the bench shows it, as any change on the board). The stream's model fails nothing on its own heat
  (`TransientOptions.fails` false): the driver alone burns a part (plan decision 11), so beyond that lag the screen
  and the bench never part on what is burnt (`model/__tests__/live.test.ts`: a part burnt before the start, during a
  pause, while it plays, and a run longer than its own time to burn). The scope's probes are its taps: the node of each
  probe's row (`Stream.probes`, the next request carries them; the model plays on). `live.since` is the model's moment
  (s, by the stream's numbering) from which the blocks are of the board, the damage and the probes now. `live.starts`
  counts the model's starts and `live.begun` is the first sample of the first block since the last one (null until it
  came; E3-9): a start drops the request on its way, so from `begun` on every block is of the board that start was
  given — a step that puts its own board reads `begun` once `starts` has passed the count at its preset, since a
  reply of the board before can still come between the preset and the start and move `since`.
- **`still(window)` — a held page's window** (`?freeze`, plan decision 16): the board now from its operating point,
  computed at once on the main thread, the bench's damage in a state of its own (nothing of the bench's written, and
  nothing fails in the window on its own heat, as in the stream): warmed up for `STILL.warmup(tauMax())`, then `count`
  samples of each tap. `tauMax()` is the longest time constant of its capacitors — the capacitance times the
  resistance the circuit at its operating point shows between its
  pins (a test current of 0.5 μA through them): 9 V through 10 kΩ into 100 μF 0.997 s, the amplifier with the
  filter of the sandbox's step `scope` 0.045–0.055 s. The warm-up is max(0.2 s, 5 τmax) rounded up to a half bar
  of the melody (1 s), so that two boards of one step show the same stretch of the music, and held to 2 s: an RC
  behind an open switch has τ of minutes (its capacitor's own leak), and a circuit of direct currents is at rest from its
  operating point anyway. A half bar, not a beat (0.5 s until E3-8's review): every half bar of the loop opens with a
  bass note and the kick, while the second beat of the first bar is the bass's rest — a held window of music from
  0.5 s showed one high note and no bass. The same board gives the same samples (the checks hash them).

For checks: `__app.read('electronics-model')` → `{ key, version, compiles, ok, failure, dcMs, iterations, issues,
pending, parts: { id: { u, i, p } }, rows: { row: volts } }` (the rows a part uses; nothing of a failed solve).

## `instruments` — the multimeter (E2-6)

The bench mounts the multimeter with itself (`bench.multimeter`, VISUAL §5.1): a digital pocket meter on the table on
the left, display up — its matt window has no digits, the number is in the step's panel — a dial of four positions
(off, V, A, Ω) whose knob turns after the panel's switch in 0.25 s, the two jacks, and the red and black probes on their
leads. It comes and goes with `bench.meter` (0.6 s); its probes are taken only when it is on its place, and go with it
when it leaves.

```ts
bench.meter = 1; // or the step's param, tweened
ui.define({ divider: { controls: [
  { type: 'segmented', id: 'meter-mode', items: [...], value: 'V', onChange: (m) => (bench.multimeter.mode = m) },
  bench.multimeter.readout('meter', words.meter), // a text readout: no count-up, right on a held page
] } });
bench.multimeter.put({ red: 'a7', black: '-3' }); // a step's own probes, at once; null — back to rest
```

- **What it reads** (`meter-model.ts`): **V** — from the red probe's row to the black one's, an ideal voltmeter; **A** —
  the meter is a wire between its probes (`METER`, the catalog's jumper, 1 mΩ) that the model driver takes into the
  circuit (`extra()`), the current into the red probe; across the battery an honest short, no fuse (plan decision 8);
  **Ω** — `model.ohms`, «OL» when no current flows or beyond `OHM_LIMIT` 40 MΩ (a pocket meter's top range; the
  catalog's largest resistor is 10 MΩ); «—» while the probes touch a live circuit (`model.powered`: a resistance is
  measured without power, plan decision 5 of batch E3 — task E3-6). A probe out of a socket, or the meter off: «—». With the model's last solve
  failed the display keeps what it shows.
- **The display** (`createMeterDisplay`) shows four significant digits with a decimal comma and the range's SI prefix
  (V: mV, V; A: μA, mA, A; Ω: Ω, kΩ, MΩ), picked on the rounded value — «5,997 V», «4,700 kΩ», «500,0 mV», «2,998 mA»;
  plain «0,000 V» for zero. It reads every `METER_REFRESH` 0.33 s of engine time and holds its reading between, at once
  when the dial turns or on `snap` (a deep link); a held frame (`dt` 0) never refreshes.
- **The probes** (`probe.ts`, copied from the circuit's gauge) are ends of the hand like the plugs (`probe:red`,
  `probe:black`; `hand/hands.ts` `ProbeEnd`): a `cyan` capsule on the handle, taken and let go like a plug's end, but
  a probe takes no socket of the board — its socket is the meter's (`multimeter.sockets`) and it goes into any socket,
  one a leg or a plug is in too (its tip then touches the top of what is there), never the other probe's. Let go away
  from the sockets it lies on the base, or off the base goes back to rest beside the meter (`Leg` place `rest`, which
  the meter moves with itself). In a socket and in the hand a probe stands leaning toward the meter; its lead rises from
  the jack in an arch to the probe's back. On a phone the probes rest on the base in front of the board (VISUAL §9).

For checks: `__app.read('electronics-meter')` → `{ mode, red, black, live, value, text, unit, refreshes, shown, ready,
prints }` (`live` — the reading now; `value`, `text` — what the display shows); probes `probe:red`, `probe:black` (the
grips) and `end:red`, `end:black` (the tips on the board's face). The sandbox's steps `meter` and `divider` and
`qa/measure.mjs --only meter` drive them.

## `instruments` — the oscilloscope (E2-9)

The bench mounts the oscilloscope with itself (`bench.oscilloscope`, VISUAL §5.2): a `slate` case on the table at the
back on the right, its face toward the reader — the screen of dark glass with its grid of 10 × 8 divisions, three
knobs, the inputs of the two channels with their rings (`lime`, `magenta`) under the screen's left part, toward the
board — and two probes on their leads, an `ink` handle with a ring of the channel's colour; the ground is a black clip
on the battery's minus wire by its power terminal (the − rail, node 0; no socket). It comes and goes with
`bench.scope` (0.6 s); its probes are taken only when it is on its place. While it is there the model plays the board
in time (`bench.live`, «model» above) and the scope shows it.

```ts
bench.scope = 1; // or the step's param, tweened
bench.oscilloscope.configure({ display: 'sweep', timePerDiv: 0.002, voltsPerDiv: 0.1, trigger: { channel: 0 } });
bench.oscilloscope.put({ ch1: 'j17', ch2: 'j13' }); // a step's own probes, at once; null — back to rest
ui.define({ scope: { board: { title, size: 'md', children: [
  bench.oscilloscope.chart('scope', { x: (s) => `t, ${s.unit} · …`, y: (s) => `U, V · …`, ch1: words.ch1, ch2: words.ch2 }),
] } } }); // the main trace: the step's board chart (the design §6.2)
```

- **What it shows** (`scope-model.ts`, no three.js): the samples of the model in time, the voltage of each probe's row
  (a probe out of a socket: its channel shows nothing). The scale is the step's, never picked by the scope (VISUAL
  §5.2): `voltsPerDiv` over eight divisions with 0 V `ground` divisions from the middle, `timePerDiv` over ten; beyond
  the screen the trace is cut at its edge. A channel may have a scale of its own, as a real scope has a knob for each
  (`channelVolts`, E3-8: `meter/twice` shows the amplifier's small input at 0,02 V a division beside its speaker at
  0,25 V): its trace on the screen at it, and on the board's chart channel 1 on the right axis — a chart made with
  `ScopeWords.y2`; without it every channel is drawn on the chart at `voltsPerDiv`.
- **The input** (`SCOPE_INPUT`, E3-8): each probe in a socket off the − rail puts 1 MΩ from its row to the − rail
  into the circuit (`oscilloscope.extra()`, beside the meter's own part in the driver's `extra`), as a real scope's
  input does: the model's row is loaded as on a real bench — a rail behind an open switch falls to its diode's
  leak (0,014 V) instead of following the reservoir it is cut off from, and a node of kilohms moves by parts in a
  thousand (the divider's 5,997 V reads 5,993 V with a probe on it). The input leaves with the probe.
- **A channel's crest** (`model.peak(channel, seconds)`, E3-8): the largest |v| of the samples shown over the last
  seconds (kept per chunk of `PEAK_CHUNK` 240 samples, 10 ms; the samples ahead of the one shown do not count yet),
  null while the channel is off — a step's readout of a wave's crest (`meter/twice`). **Sweep** (`display: 'sweep'`): a sweep starts where the trigger's channel
  crosses its level the way its slope says (the level: the step's, or the middle of the last span of that channel;
  `sweep.ts` `findTrigger`), within the last span of candidates and not before the end of the last sweep and its
  `holdoff`; with `auto` and no edge for a whole span it runs free; at most one a frame, only of samples that came.
  **Roll** (`display: 'roll'`): the newest sample at the right edge, the window kept in 300 buckets of equal time; a
  roll that starts fills the window behind its first sample with that sample (the circuit at rest before).
- **The same samples twice**: every sweep is drawn by min/max decimation (`sweep.ts` `decimateMinMax`: each bucket's
  smallest and largest sample in their order, so no peak is lost and a window of audio draws as the band it is) —
  up to 300 buckets, ≤ 600 points a channel, for the board chart; 80 buckets, 160 points, for the instrument's screen.
  The chart is filled at every entry of a step (`init`: the DOM charts are made again then) and drawn again only when
  a new sweep came (`update`).
- **The screen** (`scope.ts`) is built of `createScreen` and `RibbonLines` of `@/fx` — the pieces `createScope` is made
  of, not `createScope` itself: its traces are drawn again only on its own tick, which runs only when the engine's
  time moves (`fx/core/tick.ts`), so a held page's window would never reach the screen; and it holds its trace in 0.8
  of the screen's half height. The trace is painted in its channel's colour (`RibbonLines` in the `normal` blend): no
  glow, no bloom. The grid's tint is `steel` at 0.6 (the platform's screen draws its rim in it too).
- **A held page** (`?freeze`): the bench's stream runs on the main thread (frames of fixed time give the same samples)
  and, on a frame with no time after anything changed — the board, a setting, a probe, the scale, time that passed —,
  the scope shows `model.still` of two spans (once per change, as the radio's held frames): one span after the first
  edge within the first span, or from its start without one. A roll keeps what it rolled.
- **The probes** are ends of the hand like the multimeter's (`probe:ch1`, `probe:ch2`; `end:ch1`, `end:ch2` their tips),
  any socket but the other one's; they rest on the table in front of the scope, on a phone on the base in front of the
  board where the multimeter's rest (VISUAL §9: a step with both instruments on a phone puts one pair in sockets).
  On a phone the chart is in the panel's tab «Графіки» and the instrument out of the shot.

For checks: `__app.read('electronics-scope')` → `{ mode, blocks, ms, since, now, display, fs, span, unit, timePerDiv,
voltsPerDiv, channelVolts, volts, ground, trigger: { channel, level, slope, auto, used, found, at }, version, sweeps, holds, on, n, min,
max, screen, t0, hash, points, frozen, stills, still: { warmup, tau, ms }, ch1, ch2, shown, ready }` (`mode` — where the
model runs in time: `worker`, `sync`, `off`; `volts` — the V a division each channel is shown at; `points` — each channel's trace, its times on the chart's axis from `t0`;
`screen` — the instrument's extremes, −1 … 1; `hash` — FNV-1a of the points: two pages that show the same, the same
hash). The sandbox's steps `scope` and `rc` and `qa/measure.mjs --only scope` drive it.

## `instruments` — the speaker in sound (E2-10)

With the option `sound` (`mountBench(ctx, { sound: true })`) the bench's speaker plays what the circuit model gives it
(VISUAL §1, principle 3; the design §6.3): its current, block by block from the model in time, through the volume's own
sound output (`shared/sound`, E1-9). `instruments/speaker.ts`; `bench.speaker`, null without the option.

```ts
const bench = mountBench(ctx, { sound: true });
bench.preset(VOLUME, { 'pl+': 'c13', 'pl-': 'c17', 'spk+': 'c15', 'spk-': 'a17' }); // the player → a pot → the speaker
setSetting(bench.state, 'P1', v); // the volume knob, from the step's slider: the model's setting, the knob follows
bench.speaker!.inCircuit; // both plugs in rows the circuit has: the speaker sounds, the chapter's mood is silent
```

- **The scale** (`SPEAKER`, `speakerFullScale`, `speakerSamples`): 1 W on the speaker is half of full scale — a
  sample is the current over 2·√(1 W / R), 0.707 A for the 8 Ω speaker: a steady 1 W, or the RMS of a sine of 1 W, is
  0.5; the rated 2 W 0.707; 4 W full scale, more held to it. No other scaling: what is louder on the board is louder in
  the sound; the output's gain (the engine's settings, volume² × 0.55) and its limiter come after. The amplifier on the
  board at its top gives 0.45 A (0.64 of full scale); the player straight on the speaker 7.5 mA at most, 0.0106 —
  barely heard, as the prologue says. (E1-9's sound sandbox keeps its own full scale, 0.5 A: `SPEAKER_FULL_SCALE`.)
- **The steps**: the samples are those of a 16-bit output, on steps of 2⁻¹⁵ of full scale, so a current below half a
  step (10.8 μA on 8 Ω) is silence — a block of zeros. The volume knob at 0 leaves the 1 mΩ end of the pot's track
  across the speaker, a few nanoamperes: zeros. After a moment without a solution (`steps`) the rest of a block is
  zeros too.
- **The pace**: a block is asked only while fewer than `SPEAKER.queue` (two) are queued on the output, so with the one
  on its way at most three are planned — the output's capacity — and a change on the board is heard one to two blocks
  later (the sandbox's check: latency 0.08–0.16 s with the context's own). Until the first gesture the output plans on
  the engine's clock silently; with `?noaudio` always. The scope shows the sample heard now.
- **Out of the circuit** (a plug out, or in the air) the speaker's tap is the ground: silence, and the model plays on —
  the melody runs on, so the speaker plugged back sounds where the music is. A step's `preset` or `clear` starts the
  model again from the new board's operating point (the melody from its start), as for the scope.
- **The mood**: while the speaker is in the circuit the chapter's ambient pad (`audio.mood`) is silent; it comes back
  — the chapter's theme's mood — when the speaker leaves. The bench says it every frame (`speaker.circuit(on)`); the
  speaker tells the platform only on a change.
- **The crest** (`speaker.peak(seconds, start?)`, E3-9): the largest voltage on the speaker — |I| × its 8 Ω of the
  model's current, not the output's steps nor held to its full scale (a knock of 6,5 V reads 6,5 V) — over the last
  `seconds` of the samples heard (up to `heard()`; the blocks planned ahead do not count yet), kept per chunk of
  `CREST_CHUNK` 240 samples (10 ms) as the blocks come, 2,56 s of them; null before any block. With `start` nothing
  before that sample counts: the window begins at the first chunk wholly at or after it (a block of 1536 samples ends
  mid-chunk in four cases of five, and that chunk holds the board before). The prologue's bar «Хвиля на динаміку»
  reads it from the first sample of its step's own board on (`bench.live.begun` after the start of the step's
  preset).
- The output is made with the speaker and goes with the chapter (`ctx.onDispose`): its context closes, the background
  thread ends.

For checks: `__app.read('electronics-sound')` → `{ on, state, clock, played, underruns, queued, latency, gain, gainNow,
mode, rate, block, ms, since, heard, speaker, fullScale, blocks, levels: [{ first, peak, rms }], hash }` (`on` false
and `mode` only without the option; `levels` — the last 32 blocks as the output got them; `hash` — FNV-1a of every
sample given to the output: two held pages that play the same, the same hash). The sandbox's step `sound` (the player →
a 10 kΩ pot as the volume control → the speaker, the slider `volume`) and `qa/measure.mjs --only sound,repeat,leaks`
drive it.

## Light, heat, burn — the model's state on the bench (E2-7)

Everything on the bench that shines, warms or burns is the circuit model's output for the board now (VISUAL §1,
principle 3): the bench reads it from `bench.model` every frame and nothing else lights or tints a thing. A chapter
writes nothing for it: it puts a circuit on the board (`preset`, the hand) and closes the switch.

```ts
bench.preset([{ id: 'J1', spec: 'jumper', at: '+9', to: 'a9' }, { id: 'R1', spec: 'resistor-100', at: 'b9' },
  { id: 'J2', spec: 'jumper', at: 'e13', to: '-13' }]); // ≈ 0.8 W on a 0.25 W part
bench.closed = 1;
bench.model.part('R1'); // { condition: 'hot', load: 3.14, heat: 0 } — and after ≈ 3.8 s of frames: 'burnt'
bench.lamp; // the lamp's filament from the model, read-only
```

- **The model's time.** After its sync in every frame the bench lets the frame's time pass in the model
  (`model.advance(dt)`, `sim/core` `advanceHeat`): every part's heat moves toward its load, and a part whose heat reaches
  its limit burns — the driver solves the circuit again at once, the part a gap — and the burn is told once, by id. A
  frame with `dt` 0 lets no time pass; a frame of 1/15 s burns a part within that frame; while the model's last solve
  failed no time passes and every look holds. `model.part(id)` → `{ condition, load, heat, kelvin? }`: in the circuit its
  condition and load of the last solve; out of it (in the hand, a leg in the air) `ok` and no load, or `burnt` — which a
  part stays, the same id wherever it is moved, until it leaves the bench (a new one from the tray has a new id and is
  whole: `ok` and cold in the hand, and once it closes the circuit the condition of its load — a 100 Ω on the 9 V `hot`
  at once, as E1-4's condition follows the load, while its look is still a cold one's; a step's preset forgets what it
  takes off). Its heat stays as it was while it is out of the circuit (E1-4's model lets time pass only in the circuit).
- **Heat is a colour of the surface, never light** (VISUAL §4.8; `parts/look.ts`): the body mixed with `heatRamp(t)` by
  0.3 · t, t = (h − 0.5) / 0.5 held to 0…1; a hot body also darkens toward `mix('wireBrown', 'ink', 0.5)` by 0.3 · t; a
  burnt one is charred — mix(body, ink, 0.75), an LED's dome 0.6 — and its tint goes within 1 s; no emissive, glow or
  halo from heat. The platform's `applyHeat` lights a surface by its emissive, which VISUAL forbids here, so the mix is
  a term of the body's own shader (`heatable`, written in before the part is first drawn): a burn compiles no program. A
  resistor's bands take no heat but char with the body. The kinds are a partial table (`KIND_LOOK`): a battery and a
  speaker only tint (the battery never burns), a burnt speaker shows a dark ring on its cone, a burnt lamp its broken
  filament and a greyed top of the glass (`bulb.setBurnt`), a burnt resistor a black belt with a crack, a diode a crack,
  an LED a black spot on its crystal. An electrolytic under the state `bulged` (E1-5's: over its rated voltage, or more
  than 1 V the wrong way round, its heat to 1 — 100 μF / 6.3 V the wrong way round on the battery after ≈ 1.2 s)
  domes its top up 0.05 with the vent opened and its sleeve a little wider, and stays so until it leaves the bench.
- **The burn** (`smoke.ts`): at the moment the model tells a part burnt (`model.advance` gave its id) the bench itself
  lets out one wisp — eight soft puffs of `mist`, at most 0.35 opaque, rising 0.6 in 1.2 s over the part's body — once,
  never a loop, no flame, spark, flash or sound. The lamp gives none: its filament breaks inside the sealed glass, so the
  broken coil, the greyed top of the glass and the dark are the whole event. A can that bulges lets out one puff of
  steam (four puffs, 1.5 s) out of its vent instead, on the same event of the model (its id from `advance`, its
  condition `bulged`). Nothing else lets a wisp out: `bench.smoke` is read-only (`active`, `fired`, for the checks), and
  a chapter has no way to puff smoke or steam. The puffs are lit translucent plastic, the lamp's stem's very shader, made with the bench
  and hidden while nothing burns.
- **Light**: an LED's brightness b = min(1, (Φ / Φ₀)^(1/3)) from the model's current (`ledBrightness`), its glow and
  halo; the three brightest LEDs (ties by id) take the bench's three shadowless point lights (`bench.leds`,
  `lights.ts`: range 2.5, intensity `LED_POWER` 0.35 · b; an unused one at 0; made once, never added or taken away).
  The lamp: `bench.lamp` = the model's filament temperature on the incandescence scale (`lampGlow`) while both plugs are
  in, 0 out of the circuit or burnt; the light rig makes it the room's key light.

For checks: `__app.read('electronics-heat')` → `{ ok, parts: { id: { key, condition, heat, load, i, light, surface,
marks, bulged } }, things: { battery, speaker, lamp }, lamp: { level, glow, output, intensity }, leds: { lit, intensity
}, lights, smoke: { active, fired }, burns: [{ id, t, what }] }` (`lights` — every light under the chapter's root: five,
always; `what` — `burnt` or `bulged`). The sandbox's steps `led`, `overload`, `lamp`, `bulged` (an electrolytic the
wrong way round) and `qa/measure.mjs --only heat` drive them.

## `dive` — the floors: the magnifier as the door (E2-8)

The axis «Поверх» of the volume (`stand` → `part` → `inside` → `atoms`, VISUAL §7): the magnifier is the only door
from the step's shot down to one part on the board and into it. A chapter makes a door for a part and feeds its rail
from a depth slider; the keeper lays the lens, the ladder shows the floor:

```ts
const door = partDoor(ctx, bench, 'R1', { lead: 'board' }); // the step's shot the dive starts from and ends on
const keeper = lensKeeper(bench.tools); // the magnifier's pose after the bench's own update
const ladder = benchLadder(ctx, () => door.floor); // the ladder «де ми» (null on the step's shot: hidden)
ui.define({ inside: { controls: [{ type: 'slider', id: 'depth', min: 0, max: 1 + LENS_LEG, step: 0.005, value: 0,
  label, onChange: (v) => door.travelTo(v - LENS_LEG), // a click or a key: the flight's time
  onInput: (v, how) => how === 'drag' && door.rail.scrub(v - LENS_LEG) }] } }); // a drag: the frame at once
keeper.to(() => door.lens(door.rail.position), 1.2); // on the step's entry
// update(dt, t): bench.update(dt, t); door.update(dt); keeper.rim = door.rim(p); keeper.glass = door.glass(p);
//                keeper.late(dt, t); ladder.update();      (p = door.rail.position; rim 0, glass 1 while not engaged)
// leaving the step: door.home({ instant: info.instant, then: nextStepShot })
```

- **The rail** (`rail-math.ts`, `camera-rail.ts`, copies of `circuit`): one position −`LENS_LEG` … 1 is the whole way,
  both ways, at any speed — −½ the step's shot with the lens in its holder; 0 the lens at work over the part (its ring
  22–26 % of the frame's height, the camera about as far as the shot `board`); 1 the part opened on its place, close,
  on the same line. A drag (`rail.scrub`) follows the hand; `door.travelTo` glides in the flight's time (`levels.ts`
  `flightSeconds`: the whole way 2 s, with reduced motion 0.6 s, a shorter way less). The rail takes the camera with the
  first move and gives it back when it rests on the step's shot again (that shot held, `ctx.camera.hold`); while the
  camera is anywhere else the door writes `bench.flying` — the hand and the switch do nothing. `door.home()` glides
  back, then `then` takes the camera; `door.home({ instant: true })` (a step entered without motion) puts the rail on
  its start at once — `door.lens(door.rail.position)` is the holder's pose, the next dive starts from the step's shot —
  and leaves the camera on the shot the new step has put it on.
- **The stops** (`poses.ts`, pure maths of the part's sockets and its model's `hit`): both cameras on one line from the
  body, 60° over the board's face, across the part's axis on the reader's side (`partPlace`, `partStops`; `PART_VIEW`
  holds the numbers). A part moved while the rail rests gets new stops; the door is `ready` only while every leg of its
  part is in a socket. `partLensPose(bench, id, from)` is the lens over a part as the dive lays it.
- **The floors** (`levels.ts`, VISUAL §7): `floorAt(position)` — `part` from 0.5 (the push-in has brought the part
  large; its bands ≥ 12 px at 1280 × 720, the body ≥ 35 % of the safe frame's width from ≈ 0.64), `inside` from 1,
  `atoms` from 2 (a third stop E3 adds); on the slider that is `part` from 1 and `inside` at its end. `door.floor` is
  null while the rail rests on the step's shot. `benchLadder` is the platform's `floorLadder` with the volume's floors —
  in a `_dev` sandbox too, whose own axis has none (the context it is built with answers the volume «Радіоелектроніка» as
  `nav.volume`); on a phone the ladder is the header's chip, which in `_dev` keeps the sandbox's own label.
- **Through the ring** (`door.ts`): the ring comes to meet the camera and passes it at `PASS` 0.82, its rim's arcs stay
  in the frame's corners (`rim`), its glass thins out before (`glass`); the part opens after it (`CUT_OPENS` 0.78 … 1).
  The keeper (`lens-keeper.ts`) lays the lens after the bench's update: while a chapter calls its `late`, the bench's
  own `lens`, `lensTarget`, `lensCall` and `dive` have no say over the magnifier.
- **The inside** (`cutaway.ts`, VISUAL §7): the door opens the inner view of its part's kind (a partial table; a kind
  with none stays whole on `inside`) by its `cut`, and every frame feeds it what the bench's model says of the part —
  the current into its leg 0, its heat, whether it burnt (`follow`; the last good solve's while one fails). A resistor's
  is its carbon film («inside» below), which took the place of E2-8's temporary cutaway. `door.cutaway` is the view;
  `asFilm(door.cutaway)` (`shared/inside`) gives a resistor's film, its callouts' points and its numbers.

For checks: `__app.read('electronics-dive')` → `{ part, ready, engaged, position, target, moving, min, floor, flying,
bench, cut, open, inside, camera, aim, lens, atHolder, stops }` (the door's rail, the floor shown, whether it flies and
`bench.flying`, the inner view: how far open and what it shows — a film's `FilmState`, below —, the camera and its
aim, the lens's ring and whether it lies in its holder, the stops);
probes `dive:end0`, `dive:end1` (the body's ends along its axis) and `dive:ring-top`, `dive:ring-bottom` (the ring's
extent along the camera's up). One door per chapter: a second one's reader takes the name over. The sandbox's step
`loupe` (a 4.7 kΩ in a5 … a9) and `qa/measure.mjs --only loupe` (a mouse, `--touch`) drive them.

## `inside` — inside the parts (E3-5)

The floor `inside` of the door's dive (VISUAL §7): the inner view of a part, opened on its place by the door's `cut`.
The door makes and feeds it (`dive` above); a chapter reads it — `asFilm(door.cutaway)` — for its callouts and checks.

```ts
const film = createFilm(model); // a resistor's model of `shared/parts`, closed; a child of its body frame
film.set(cut, view); // open by `cut` 0 … 1 toward `view` (world, from the body to the camera): the door does it
film.flow(amps); film.heat(share); film.burnt(on); film.update(dt, t); // the model's state; the door's `follow`
film.turns(10_000); // the groove cut for another value (`filmTurns`); a new part under the door makes a new film
film.anchor('film' | 'groove' | 'rod', out); // a world point for a callout, on the camera's side (`anchorX`: the groove's
// crossing by ANCHOR_X, the film's a strip's middle a turn or so toward leg 1 from it, both open between the caps)
```

- **What it is** (`film.ts`): the white ceramic rod; the carbon film (`ink`) on it, a strip wound between the turns of
  the helical groove, where the white ceramic shows; its grains (instanced, a shade lighter); the metal end caps
  (`mist`) pressed on the rod's ends over the film, where the legs come in. The lacquer with the bands is the part's own
  body: the wedge (`wedge.ts`, the mechanics of E2-8's cutaway, `FILM.wedge` 120° at `cut` 1, on the camera's side)
  clips it away and section faces close the cut — the lacquer and the bands' paint all along, and up to `FILM.step`
  from the end by leg 0 the cut goes down to the axis: the rod's section, the film on it and the cap, layers seen side
  by side. Nothing is drawn while the part is whole.
- **The model on it**: the groove's turns grow with the value, `filmTurns(ohms)` = 2 · log₁₀(Ω) − 1.5 held to 1 … 12
  (330 Ω 3.5, 1 kΩ 4.5, 10 kΩ 6.5): more ohms, a longer and narrower strip. The electrons (`cyan`, the library's
  electron orb without its glow) drift along the strip at `electronSpeed(amps)` = −6 units/s per ampere of the current
  into leg 0, held at 0.6: the other way to the current, proportional to it, 29 times slower with 10 kΩ than with
  330 Ω in the LED's loop. They come round from one end to the other under the caps. The heat of the model is the
  colour of the film, the rod and the caps (`createSurfaceLook`, VISUAL §4.8: never light); burnt, the film breaks under a charred belt with a
  pale crack and the electrons stand. Both drawings are pictures of the rule, not of a real part (the script's
  «Докладніше»: the turns are not a real part's, the speed shows only the current).
- **Numbers** (`FILM`): the rod 0.085, the film to 0.092, the caps 0.01 … 0.17 of the length to 0.122 (as E2-8's
  cutaway), the groove 0.012 wide, the electrons 0.008 across, 160 of them, the grains 640.
- **Draw calls** while open, the whole view — the part's own lacquer, painted bands, metal bands (a gold or silver
  one) and legs with the inside: eight at most. The inside's four: the rod, the caps, the strip and (burnt) its belt
  in one mesh, its colours per vertex, the heat on all of it; the grains (instanced); the electrons; both section
  faces in one mesh, turned to the wedge. Burnt, the part shows its own charred belt on the lacquer too, a ninth.
  None of the inside while the part is whole.

For checks: the door's reader (`dive` above) has the film's `state()` under `inside`: `{ ohms, turns, pitch, width,
path, amps, speed, electrons, shown, open, amount, heat, burnt, surface, drawCalls, insideCalls }` (`drawCalls` — the
whole view, the part's meshes with the inside's; `insideCalls` — the inside's own). The sandbox's step `film` (the
red LED's loop, the value switch 330 Ω / 10 kΩ, probes `film:film`, `film:groove`, `film:rod`) and `qa/measure.mjs
--only film` drive it.

## Boards of the steps (`sim/board/presets.ts`, E3-5)

`bench.preset(parts, leads)` seats a step's board through `seatPreset` (`sim/board`), the same pure maths a test runs
without the bench (`presetState`): `PresetPart` is `sim/board`'s, and the bench re-exports it. Boards as data, for the
chapters:

- `LED_LOOP` — the red LED's loop of `resistor` and `resistor-pick` (their scripts' «Бачимо»): J1 from `+5` to `a5`,
  R1 330 Ω in `b5` … `b9`, LED1 anode `c9`, cathode `c10`, J2 from `e10` to `-10`; with the switch closed the model
  gives 21.235 mA, 1.960 V on the LED, 7.008 V and 0.149 W on the resistor; with a 10 kΩ in R1's sockets 0.734 mA.
  A step takes it whole (`ohm`, `inside`, `share`, `bands`, `series`) or leaves a part of it out (`limit`: R1, `calc`:
  J2); the tests hold that no two of its bodies take the same place.
- `AMPLIFIER_IDS` — the amplifier's ids (`sim/core` `amplifierNetlist`) as the bench names them: `B1` → `BAT`, `S1` →
  `SW`, `PL` → `PLAYER`, `LS1` → `SPK`, `VR1` → `P1` (a pot's id on the board), every other part its own.
- `AMPLIFIER_PRESET` — the amplifier of E1-6 on the board (the prologue's; the chapters of the path take a part of it):
  its sixteen parts, the jumpers `J1` … `J10`, the plugs `pl+`, `pl-`, `spk+`, `spk-`, the pot at 0.5 (where every node
  is: the comment in `presets.ts`). With the jumpers taken as the wires they stand for, its nodes are
  `amplifierNetlist`'s one by one and its operating point is sim/core's within 1e-9; with the jumpers of 1 mΩ within
  1e-4 (`sim/board/__tests__/presets.test.ts`) — measured from the − rail, so a node of a few μV that returns through a
  ground row may be off by that row's rise (the speaker's, 34 μV at rest: the 1 mΩ of its ground's jumper against the
  speaker's 8 Ω is 1.25e-4 of it). No jumper carries the bias diodes' current between the bases of the output pair
  (their bias is exponential in those voltages: 8 μV over such a jumper moved it by 1.4e-4). On the bench
  (`bench/__tests__/presets.test.ts`, the real models): no two bodies take one place, the jumpers' too; no leg, jumper
  or plug stands where another part is — a raised body (an LED, a can, a TO-92) may stand over a jumper or an axial
  part's leg, the pot (its case from 0.22) over the leg only; and every plug is within its lead. `spk-` cannot reach
  the − rail from the speaker (4.1 at the nearest socket), so it goes into a ground row a jumper ties to the rail.
  On the bench's shots the tall cans stand at the back (C1 and C2 on the line a, C3 across the channel at the left)
  and nothing tall in front of the volume knob, at the far right by the player; the speaker's coral lead lies over
  the knob's case on its way to `c10` (the speaker's row is left of the pot).

## `steps` — what the chapters' steps build from (E3-7, E3-10)

The small pieces every chapter on the bench repeated, moved here from `chapters/resistor` once `resistor-pick` needed
them too, and from `chapters/meter` (the probes by name, the player, the oscilloscope's words and crests, the stand
with sound) once the clone was merged (REUSE.md, «Копії»). A chapter keeps its own words (captions), boards, scales
and hold times and passes them in.

```ts
const stand = createStepStand(ctx, { keepDoor, sound }); // the chapter's `stand.ts`: the bench, the door, the lens
// keeper, the ladder «де ми», the names under the pointer (`stand.naming`, set by each step),
// `stand.board(parts, leads)`; with `sound` the speaker in sound and the player: `stand.play(on)`, `stand.playing()`,
// a tap where `naming.tap`
const tally = createTally(['a', 'b'], HOLD.reading); // the chapter's `HOLD`; `rowsOf`, `rowOf`, `sameRows`, `across`,
// `within`; `createHold(need)`: a run of time in a row
bench.hands.policy = handPolicy(bench, { part, leg, tray, probes, switch, flip, name }); // by kind (`kindOf`);
// `probes`: `true` (the multimeter's red and black) or the probes by name, ['ch1', 'ch2'] the oscilloscope's
trayButtons(bench, specs, label, stand.phone); switchToggle(bench, label, stand.phone); // a phone's dock
playerToggle(label, stand.phone, (on) => stand.play(on)); // the player in a phone's dock
meterSwitch(bench, label, ['off', 'V'], offWord, 'off'); meterReadout(bench, label); // the multimeter in the panel
board: scopeBoard(bench, id, title, { volts, time, division, ch1, ch2, own }); // the oscilloscope's chart and its words
crestStats(bench, id, [in, out], seconds); // both channels' crests over the last seconds, one block of two numbers
const depth = depthSlider(ctx, bench, ui, () => stand.door, () => here(S), end, { label, top, bottom });
// controls: [depth.control, …]; enter: depth.reset(); update: depth.update()
```

- **`stand.ts`** — `createStepStand`: `mountBench` once (with `sound`, its speaker in sound), the magnifier's door into
  a part (`openDoor(partId, info, lead)`; `closeDoor(info, then)` flies the rail home, then the step's shot; the door is
  given up once home), its lens keeper over everything, the ladder, the names — of the parts a step keeps in place
  (`naming.part`), of the multimeter's and the oscilloscope's cases (`naming.meter`, `naming.scope`: only once the
  instrument stands on its place, only where a pointer hovers) and, with `sound`, of the player (`naming.player`).
  Without `keepDoor` every `openDoor` makes a new door (`resistor`: one dive step); with it a door the step before left
  open into the same part stays, its rail where it is, except on a deep link (`resistor-pick`: `bands` → `series`).
  With `sound` the player is the model's setting of the bench's `PLAYER` (0 stopped; with none set it plays the
  catalog's 0,3 V): `play(on)` sets it, a new board keeps it (every step sets it on entry), and a tap on its box flips
  it where the step's `naming.tap` lets it, never while the camera flies (`taps` counts them; QA probe `player`).
- **`goals.ts`** — the rows of sockets (null when one is out), one socket's row, two rows in any order, one row on each
  of two sides, a number in a window; the tally of readings that each must hold `need` seconds in a row, counted once;
  a run of time while a condition holds (`createHold`: done once it held, `restart` keeps it done).
- **`policy.ts`** — `HandPolicy` from a step's rules by kind: `part:` / `leg:` by the catalog key, `tray:` slots, the
  probes by name (`probe:red`, `probe:black`, `probe:ch1`, `probe:ch2`; `probes: true` — the multimeter's two),
  `switch`; plug leads never; the names under the pointer from the step's `name`, a probe by its own name.
- **`names.ts`** — invisible twins of the parts' `hit` boxes and of the multimeter's case for the names of what a step
  keeps in place; only where a pointer hovers.
- **`dock.ts`**, **`meter.ts`** — a phone's dock buttons for the tray's slots, the battery's switch and the player
  (`player`, shown on a phone only); the dial's switch (`meter-mode`) and the number (`meter`).
- **`scope.ts`** — the oscilloscope in the panel: a division's text («0,5 s», «20 ms», «0,02 V»; the number and the unit
  from the code, the words «на поділку» the step's), an axis' title (the step's caption, then its division), the chart's
  words (`own`: channel 1 on the right axis at its own scale, the titles sharing the width), the step's board with the
  chart, a crest with three decimals («—» with nothing) and both channels' crests over the step's seconds as one block.
- **`depth.ts`** — the slider «Глибина» (`depth`): 0 … `end` + `LENS_LEG`, the rail at the slider − `LENS_LEG`; a drag
  scrubs, a click glides; a tap on the resting lens lays it on the part; the fill follows the rail every frame.

Tests: `__tests__/goals.test.ts` (rows, the tally, the run), `rules.test.ts` (the hand's rules and the probes by name,
the dock with the player, the meter over a stub bench), `scope.test.ts` (the words, the crests, the board),
`stand.test.ts` (a live bench with the engine's `CameraDirector`: the board, the door made anew or kept, given up once
home; with `sound` the speaker, the player's level across a board and its tap; the instruments' names; the depth
slider's way, the lens's tap and the fill).

## Копії

The copies from other volumes are recorded in `docs/volumes/electronics/REUSE.md`, section «Копії».
