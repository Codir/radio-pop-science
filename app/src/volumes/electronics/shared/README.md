# `shared` — the bench of the volume «Радіоелектроніка»

The scene's side of the volume: the dark room and the stand, the breadboard, the parts, the hand, the instruments, the
dive through the magnifier and the bench's link to the circuit model (`sim/core`, `sim/board`). No step logic lives
here. The look and the numbers of all of it are fixed by `docs/volumes/electronics/VISUAL.md`. Batch E2
(`docs/superpowers/plans/2026-11-20-electronics/batch-E2.md`) builds the modules one task at a time; this file grows
with them (task E2-10 writes the mount, the options, the state table and the readers for checks).

Each module has its public face in `shared/<module>/index.ts`; there is no `shared/index.ts`. The sandbox
`_dev/chapters/_sandbox-electronics-bench` imports only `@electronics/shared/<module>`.

## `bench` — the room, the base and the breadboard (E2-3)

```ts
export default defineScene((ctx) => {
  const bench = mountBench(ctx); // the room, the base with the breadboard, the light, the magnifier; once per mount
  ctx.stage.define({ look: { camera: 'stand' } }); // the bench registers its shots: stand, board, phone, meter, scope
  return {
    enterStep: (_id, info) => void (info.instant && bench.snap()), // deep links: no filament or slider ramp
    update: (dt, t) => bench.update(dt, t),
  };
});
```

`mountBench(ctx)` adds the bench to `ctx.root`, sets the room's environment and the depth of field of the main shot,
and registers the shots of `shots.ts` under their names. On a phone every name (`stand`, `board`, `meter`, `scope`)
is the shot `phone` — the field of sockets only (VISUAL §9); the bench re-registers them when the form factor changes.
Each mount builds its own bench; nothing lives at module level.

What a chapter writes (plain numbers, read every frame by `bench.update`):

| Member | Default | What it is |
|---|---|---|
| `ambient` | `BENCH_AMBIENT` 0.8 | lift of the unlit room: a cool fill and a stronger moon that step back when the lamp burns |
| `moon` | 1 | strength of the cold moon |
| `lamp` | 0 | read-only: the lamp's filament 0 cold … 1 white, from the circuit model alone («light, heat, burn» below); shown with the filament's inertia |
| `closed` | 0 | the battery's switch: 0 open (the thumb pushed left, the gap shows) … 1 closed — the setting of the model's part `SW` in `state.settings`; a tap on the slider flips it |
| `flying` | false | the camera flies (the magnifier, a chapter's border): the hand and the switch do nothing |
| `lens`, `lensTarget` | 0, `null` | the magnifier: 0 in its holder … 1 at `lensTarget` (a `LensPose` in the base frame, e.g. `overPose`) |
| `lensCall` | 0 | the step asks the reader to take the magnifier: the resting ring turns full cyan and pulses |
| `dive` | 0 | progress of the flight through the ring: the rim's arcs from 0.5 on |
| `meter`, `scope` | 0 | the instruments: 0 away beyond the frame's edge … 1 on their places (a step tweens them, 0.6 s); the multimeter's probes may be taken only at 1, and go with it when it leaves |

What the bench has (read-only): `room`, `base` (`base.frame` is the tilted base frame: whatever stands on the base
goes there, then `tameAll(bench.group)`), `light` (the rig owns `ctx.env.tune`; never tune the environment from a
chapter; the lamp light hangs at the `filament`, and `mountBench` puts the shadowless `bounce` above the lamp's pool
every frame), `layout` (the board as data, `sim/board`), `board` (the 3D breadboard: `socketWorld(id)`,
`socketLocal(id)`, the instanced `mouths`, the `print`, the lit rows `highlight(rows, dt)` / `lit`), `state` and
`parts` (the parts on the board, below), `props` (the permanent things: the battery box with the switch, the player,
the speaker and the lamp with their real marks from `shared/parts` — `props.things`, `props.bulb` — the lamp post and
the `filament` where the light hangs; `props.meter` is the multimeter's place on the table, the oscilloscope still a
stand-in of its size and colour), `fixed`, `switch`, `tray` and `hands` (the reader's hand, «hand» below), `tools` (the
magnifier and its `holder` pose), `model` (the circuit model of the board, «model» below), `multimeter` («instruments»
below), `leds` and `smoke` (the LEDs' light on the board; the wisps of a burn in the air, read-only — «light, heat,
burn» below).

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

The kinds the model's catalog gains in other tasks are bound already by the fields of their specs: a `capacitor` by
its `dielectric`, `farads` and `ratedV` (E1-5), a `transistor` by its key in `TRANSISTORS` and the board's
`TO92_LEGS` (E1-6). Until the clone is merged with them, `buildPart` gives null for those keys and their models are
made directly (`createCeramic`, `createFilm`, `createElectrolytic`, `createTransistor`).

On the bench: `bench.state` (the board as data) and `bench.parts` (`bench/on-board.ts`): every frame the 3D parts
follow the state — a part that came gets its model, a part whose legs moved stands on its new sockets, a leg taken out
of its socket hangs in the air over where it was while the body keeps its turn, a part that left is disposed (the hand
moves the legs of the parts it drives: «hand» below); `bench.parts.show(id, model, sockets)` stands a model the state
does not hold (a kind the catalog lacks yet) outside the circuit. `bench.preset([{ id: 'R1', spec: 'resistor-4k7',
at: 'a3', o?, setting? }, …], leads?)` makes the board hold exactly a step's parts at once, and the named plugs in their
sockets (a part or a plug that does not stand there is a RangeError); a part of two legs that stands at any span within
its reach — a jumper from a rail to the row it feeds — takes `to`, the socket of its leg 1, instead of `o`
(`{ id: 'J1', spec: 'jumper', at: '+3', to: 'a3' }`); `bench.clear()` takes everything off. `props.things` and `props.bulb` are the permanent things; the bench gives the bulb's filament the light
rig's glow every frame.

For checks: `__app.read('electronics-board')` → `{ parts: { R1: { spec, legs } … }, leads, settings, models, shown, key,
pending }`;
`__app.read('electronics-parts')` → for every part, shown model and permanent thing (`battery`, `player`, `speaker`,
`lamp`): `{ key, center, radius, drawCalls, prints, printsShown, printsClear, printsCovered, printAt, printEm }`
(world). `printsClear` counts the prints the camera sees with nothing drawn in front of them (rays from the camera to the
middle and both ends of each print's line), `printsCovered` those shown although something covers them. The sandbox's
step `parts` and `qa/measure.mjs --only parts` read them.

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
  come while the pointer is on the part and 1.5 s after. The grips' spheres never overlap (VISUAL §6 and §8: the tests
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
  `body` materials (E2-7's heat look shares them).
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
- **The ohmmeter's own solve** (`ohms`): the circuit now on the board with its sources out (the batteries; the player
  when the catalog has it), the meter's own source `OHMMETER` — 5 V behind 10 kΩ, at most 0.5 mA, so a lamp reads its
  cold 5.5 Ω — between the two nodes, and the voltage it makes over its current. It has a model state of its own (the
  burnt parts copied in as gaps): the bench's is untouched. Computed once per solve of the board and pair of nodes.

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
  catalog's largest resistor is 10 MΩ). A probe out of a socket, or the meter off: «—». With the model's last solve
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
  an LED a black spot on its crystal. An electrolytic under the state `bulged` (E1-5 gives it; E2-9 binds it to the
  model) domes its top up 0.05 with the vent opened and its sleeve a little wider.
- **The burn** (`smoke.ts`): at the moment the model tells a part burnt (`model.advance` gave its id) the bench itself
  lets out one wisp — eight soft puffs of `mist`, at most 0.35 opaque, rising 0.6 in 1.2 s over the part's body — once,
  never a loop, no flame, spark, flash or sound. The lamp gives none: its filament breaks inside the sealed glass, so the
  broken coil, the greyed top of the glass and the dark are the whole event. Nothing else lets a wisp out: `bench.smoke`
  is read-only (`active`, `fired`, for the checks), and a chapter has no way to puff smoke or steam. A bulged can's one
  puff of steam (1.5 s) will be the same kind of thing — on the model's event, E1-5's `bulged`, which E2-9 binds; until
  then nothing lets steam out. The puffs are lit translucent plastic, the lamp's stem's very shader, made with the bench
  and hidden while nothing burns.
- **Light**: an LED's brightness b = min(1, (Φ / Φ₀)^(1/3)) from the model's current (`ledBrightness`), its glow and
  halo; the three brightest LEDs (ties by id) take the bench's three shadowless point lights (`bench.leds`,
  `lights.ts`: range 2.5, intensity `LED_POWER` 0.35 · b; an unused one at 0; made once, never added or taken away).
  The lamp: `bench.lamp` = the model's filament temperature on the incandescence scale (`lampGlow`) while both plugs are
  in, 0 out of the circuit or burnt; the light rig makes it the room's key light.

For checks: `__app.read('electronics-heat')` → `{ ok, parts: { id: { key, condition, heat, load, i, light, surface,
marks } }, things: { battery, speaker, lamp }, lamp: { level, glow, output, intensity }, leds: { lit, intensity },
lights, smoke: { active, fired }, burns: [{ id, t }] }` (`lights` — every light under the chapter's root: five, always).
The sandbox's steps `led`, `overload`, `lamp`, `bulged-look` (the look alone, for a snapshot; E2-9's step `bulged`
binds it to the model) and `qa/measure.mjs --only heat` drive them.

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
- **The temporary cutaway** (`cutaway.ts`, VISUAL §7, plan decision 13): a quarter wedge of the body taken out on the
  camera's side, 90° · `cut` wide; flat faces show the resistor's white ceramic rod, its thin ink film, the metal caps
  (`mist`) and the lacquer of the body's colour with the bands' paint at the rim. The body's materials clip the wedge
  (two planes, `clipIntersection`, parked far away while closed: opening compiles nothing); the faces stand a hair inside
  the clipped side with materials that clip nothing — the lacquer's a twin of the body's sharing its heat, so a hot part
  is hot in the section too. `createCutaway(model)` is null for a kind with no inside yet (E3 builds the real ones in the
  same mechanics: the door's `cut` opens them). Four draw calls while open.

For checks: `__app.read('electronics-dive')` → `{ part, ready, engaged, position, target, moving, min, floor, flying,
bench, cut, open, camera, aim, lens, atHolder, stops }` (the door's rail, the floor shown, whether it flies and
`bench.flying`, the cutaway, the camera and its aim, the lens's ring and whether it lies in its holder, the stops);
probes `dive:end0`, `dive:end1` (the body's ends along its axis) and `dive:ring-top`, `dive:ring-bottom` (the ring's
extent along the camera's up). One door per chapter: a second one's reader takes the name over. The sandbox's step
`loupe` (a 4.7 kΩ in a5 … a9) and `qa/measure.mjs --only loupe` (a mouse, `--touch`) drive them.

## Копії

Volumes do not import each other, so what the bench takes from `circuit` and `radio` is copied here. Every copy has a
row below. The table is in Ukrainian on purpose: while batch E2 is built in its own clone, the volume's
`docs/volumes/electronics/REUSE.md` does not exist there yet, and the controller moves these rows into it verbatim when
the clone is merged. «Звідки» and «Куди» are paths from `app/src/volumes/`. A task that copies a file switches its row
from «заплановано» to «зроблено» in the same commit and corrects «Що змінено» if the copy turned out differently.

| Звідки | Куди | Що змінено | Завдання | Стан |
|---|---|---|---|---|
| `circuit/shared/stage/materials.ts` | `electronics/shared/bench/materials.ts` | нічого, лише коментар-заголовок | E2-3 | зроблено |
| `circuit/shared/stage/room.ts` | `electronics/shared/bench/room.ts` | нічого, лише коментар-заголовок | E2-3 | зроблено |
| `circuit/shared/stage/layout.ts` | `electronics/shared/bench/layout.ts` | лишено `BOARD` (основа 8,4 × 5,6) і `LENS` (новий тримач); `LOOP`, `WIRE`, `BATTERY`, `SEAT`, `STAPLES`, `RULER`, `SHELF_WORLD` замінено на `PLACES` (`VISUAL.md` §2); `SWITCH` (щілина й хід повзунка на кришці боксу батареї) і `LAMP` (стійка лампи зі склом 0,38) — власні стенда | E2-3 | зроблено |
| `circuit/shared/stage/__tests__/layout.test.ts` | `electronics/shared/bench/__tests__/layout.test.ts` | правила `VISUAL.md` §2, §8 і §9 для нових місць і ракурсів; панелі інтерфейсу на комп’ютері й перерамкування телефона — справжнім `CameraDirector`; перевірки лампи, ліхтарика й петлі дроту прибрано | E2-3 | зроблено |
| `circuit/shared/stage/base.ts` | `electronics/shared/bench/base.ts` | розміри з нового `BOARD`; полицю позаду прибрано (лоток стоїть спереду) | E2-3 | зроблено |
| `circuit/shared/stage/light.ts` | `electronics/shared/bench/light.ts` | ключове світло — лампа стенда, коли горить; у темній кімнаті розсіяного світла більше: `BENCH_AMBIENT` 0,8 замість 0,5; решта — як у `circuit` | E2-3 | зроблено |
| `circuit/shared/stage/shots.ts` | `electronics/shared/bench/shots.ts` | лишено `boardToWorld`, `STAGE_FOV`, `STAGE_POST` і `stand` з новими числами; нові `board`, `phone`, `meter`, `scope` і `benchShots` (на телефоні всі ракурси стенда — `phone`); ліхтарик, равлик, лампа зблизька, лупа над дротом і передача на нижній поверх прибрані | E2-3 | зроблено |
| `circuit/shared/stage/dyn-tube.ts` | `electronics/shared/bench/dyn-tube.ts` | нічого, лише коментар-заголовок | E2-3 | зроблено |
| `circuit/shared/stage/air.ts` | `electronics/shared/bench/air.ts` | без променя ліхтарика; коли лампа темна, порошинок не малює зовсім | E2-3 | зроблено |
| `circuit/shared/stage/tools/lens.ts` | `electronics/shared/bench/tools/lens.ts` | нічого (`LENS` — з нового `layout`) | E2-3 | зроблено |
| `circuit/shared/stage/tools/index.ts` | `electronics/shared/bench/tools/index.ts` | лишено перетворення «основа ↔ світ», тримач лупи й позу лупи над точкою основи (`overPose`); вимірювач, рамку, равлика, повзання й лупу-збільшувач прибрано | E2-3 | зроблено |
| `circuit/shared/stage/index.ts` | `electronics/shared/bench/index.ts` | `mountBench` замість `mountStage`: без ліхтарика, розкладання, равлика, розрізу батарейки й лампи зблизька; постійні речі — поки заготовки (`props.ts`); відбите світло лампи (`light.bounce`) щокадру висить над її плямою зі зсувом `circuit` для лампи без променя, дзеркальним по x (`BOUNCE_OFFSET`: лампа стенда — у дальньому лівому куті) | E2-3 | зроблено |
| `circuit/shared/stage/mounts.ts` (частини) | `electronics/shared/bench/mounts.ts` | лише гвинтовий затискач, стійка лампи (менша, під скло 0,38) і тримач лупи | E2-3 | зроблено |
| `circuit/shared/stage/small-parts.ts` (`createSlider`) | `electronics/shared/bench/switch-slider.ts` | щілина й хід повзунка з нового `layout`: вимикач на кришці боксу батареї; пружини немає | E2-3 | зроблено |
| `radio/shared/world/index.ts` (`fnv1a`, `meanOf`) | `electronics/shared/model/hash.ts` | `meanOf` бере `ArrayLike<number>` | E2-3 | зроблено |
| `_dev/chapters/_sandbox-radio-link/index.ts` | `_dev/chapters/_sandbox-electronics-bench/index.ts` | свій id, порядок 9031, кроки й слова (`SANDBOX`) | E2-3 | зроблено |
| `_dev/chapters/_sandbox-radio-link/qa/measure.mjs` (скелет) | `_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs` | лишено аргументи, `report` / `check` / вердикт, `open`, `held`; розділи перевірок нові | E2-3 | зроблено |
| `circuit/shared/stage/bulb.ts` | `electronics/shared/parts/bulb.ts` | без великого плану (`close`, `lamp-view.ts`) і без `print` `circuit`; `supportPath` вбудовано з `bulb-close.ts`; уся лампа зменшена в `BULB_SCALE` 0,8 (скло — `LAMP.glass` 0,38, різьба 0,14 входить у патрон стійки), відблиск — під менше скло; на цоколі друк «6 V»; `depthShell` експортовано — ним користуються купол світлодіода й скло 1N4148 | E2-4 | зроблено |
| `circuit/shared/stage/bulb-heat.ts` | `electronics/shared/parts/heat-scale.ts` | лише шкала «тепло ↔ температура» (`HEAT_STOPS`, `temperatureOfHeat`, `heatOfTemperature`, `FIRST_GLOW`) і `formatTemperature`; енергетичний баланс лампи прибрано: температуру нитки дає модель | E2-4 | зроблено |
| `circuit/shared/stage/__tests__/bulb.test.ts`, `bulb-heat.test.ts` | `electronics/shared/parts/__tests__/bulb.test.ts`, `heat-scale.test.ts` | тести скла взято як є; з тестів тепла — лише шкала й показ; нові: скло й різьба лампи стенда за `VISUAL.md` §2, лампа на 6 V і 3 V на шкалі за §4.6 | E2-4 | зроблено |
| `circuit/chapters/build/parts/glide.ts` | `electronics/shared/hand/glide.ts` | нічого, лише коментар-заголовок | E2-5 | зроблено |
| `circuit/chapters/build/parts/ends.ts` | `electronics/shared/hand/leg.ts` | `End` → `Leg`: місця «гніздо», «лежить», «у руці», «лоток», «спокій біля приладу» (щуп, E2-6) (гнізда й рельєф — від стенда, `LegWorld`); одне гніздо — один кінець (затискачів на два кінці, їхнього зсуву й віяла немає); напрям повертає за якорем — річчю дроту чи тілом деталі; `seated` — лише по прибуттю | E2-5 | зроблено |
| `circuit/chapters/build/parts/curves.ts` | `electronics/shared/hand/curves.ts` | рельєф — параметр (`Terrain`); `peeled` і `blend` (з ними й `resample`) не взято: обидва кінці кожного дроту стенда вільні | E2-5 | зроблено |
| `circuit/chapters/build/parts/clamps.ts` (`ground`) | `electronics/shared/hand/terrain.ts` | лише `ground()` із піднятими ділянками як даними (тіло плати, бокс батареї, речі на основі, а для дротів і тіла деталей на платі — їх дає стенд, `bench/mounds.ts`) і лічильник змін `version`, за яким дріт перебудовує форму; затискачі й місця спокою — ні | E2-5 | зроблено |
| `circuit/chapters/build/parts/grips.ts` | `electronics/shared/hand/grips.ts` | батьківська група — параметр; загальний ключ; три форми (`VISUAL.md` §6): кільце на ніжці аксіальної деталі, язичок перед радіальною, капсула 0,07 × 0,24 на кінці перемички, штекері й щупі; радіус сфери дає стенд (сфери не перекриваються); тримач завжди видимий, з’являється й зникає лише вигляд — прихований захват теж бере вказівник | E2-5 | зроблено |
| `circuit/chapters/build/parts/hands.ts` | `electronics/shared/hand/hands.ts` | загальні руки з двома жестами: ключі `part:` / `leg:` / `lead:` / `probe:` / `tray:` / `switch`, площина — лице плати з її рамки, кандидати — гнізда (`layout.nearest`), живі `near` і `preview`, межа вильоту з відбитка, `LIFT` для пальця, захват — від точки натиску; ніжка деталі клацає під час руху, кінець перемички чи штекер — коли відпустили; зміна плати — по прибуттю | E2-5 | зроблено |
| `circuit/chapters/build/parts/swap.ts` | `electronics/shared/hand/swap.ts` | `createSwap(parent, thing, way, lift)`: батьківська група, річ і її шлях — параметри (у `circuit` — один дріт стенда через дальній край); копія знімається з усіх видимих сіток речі | E2-5 | зроблено |
| `circuit/chapters/build/parts/switch.ts` | `electronics/shared/bench/switch.ts` | вимикач батареї; `world.flying` → `bench.flying`; `closed` → налаштування деталі `SW` (`bench.closed`); повзунок з інерцією ставить сам стенд | E2-5 | зроблено |
| `circuit/chapters/battery/parts/cue.ts` | `electronics/shared/hand/cue.ts` | внутрішній радіус кільця, швидкість появи й ім’я — параметри (кільце-підказка на гнізді: 0,12 і 0,025, 0,12 s) | E2-5 | зроблено |
| `circuit/chapters/build/qa/helpers.mjs` | `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs` | нічого, лише коментар-заголовок (бриф E2-3 називає файл серед файлів пісочниці, і `measure.mjs` бере з нього `read`) | E2-3 | зроблено |
| `circuit/shared/stage/tools/gauge.ts` (щуп і дріт) | `electronics/shared/instruments/probe.ts` | щуп у мірилі стенда (вістря 0,25, ручка 0,9), червоний `coral` і чорний `ink`; вістря — `Leg` руки (гніздо, лежить на основі, рука, спокій біля приладу); дріт `DynTube` — від гнізда приладу дугою до спинки щупа; стрілку, шкалу, `GAUGE_HOME`, нахил приладу й число в 3D не взято | E2-6 | зроблено |
| `circuit/shared/world/dive.ts` | `electronics/shared/dive/rail-math.ts` | нічого, лише коментар-заголовок | E2-8 | зроблено |
| `circuit/chapters/lamp/parts/rail.ts` | `electronics/shared/dive/camera-rail.ts` | лише імпорт — з `./rail-math` | E2-8 | зроблено |
| `circuit/chapters/lamp/parts/lens-keeper.ts` | `electronics/shared/dive/lens-keeper.ts` | спирається на лупу стенда (`BenchTools`: модель лупи й поза тримача); решта як була | E2-8 | зроблено |
| `circuit/chapters/lamp/parts/door.ts` | `electronics/shared/dive/door.ts` | `partDoor(ctx, bench, partId, { lead })` — двері в будь-яку деталь на платі: зупинки — з її місця (`poses.ts`), нові, коли деталь переставили, поки камера на ракурсі кроку; камеру бере з першим рухом і віддає на ракурсі кроку (`home`); поки камера деінде — `bench.flying`; `cut` відкриває тимчасовий розріз (`cutaway.ts`) після проходу кільця (`CUT_OPENS` 0,78 … 1, `PASS` 0,82 як у `circuit`); читач `electronics-dive` і проби для перевірок | E2-8 | зроблено |
| `circuit/shared/world/levels.ts` | `electronics/shared/dive/levels.ts` | поверхи тому `stand`, `part`, `inside`, `atoms` і де кожен починається на рейці — дані, а не найближча зупинка (`part` від 0,5, `inside` від 1, `atoms` від 2); час прольоту, коротший зі зменшеним рухом; `mixAt`, `floorValue`, `LEG`, `FLIGHT_EASE` і `legsBetween` не взято | E2-8 | зроблено |
| `circuit/chapters/resistance/parts/poses.ts` | `electronics/shared/dive/poses.ts` | узято лише задум (лупа над місцем, піднята до камери вздовж погляду — тут через `overPose` стенда); код новий: місце деталі з її гнізд (`partPlace`), зупинки прольоту в неї (`partStops`), лупа над нею (`partLensPose`) | E2-8 | зроблено |
| `circuit/shared/world/__tests__/dive.test.ts`, `levels.test.ts` | `electronics/shared/dive/__tests__/dive.test.ts`, `levels.test.ts` | синтетичні зупинки замість ракурсів `circuit` (перша зупинка — лупа в роботі приблизно так далеко, як ракурс, далі — на одній лінії до точки плати); рівні — поверхи тому, пороги на рейці й час прольоту | E2-8 | зроблено |
