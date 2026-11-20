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
| `lamp` | 0 | the lamp's filament 0 cold … 1 white; shown with the filament's inertia (the model drives it from E2-7) |
| `closed` | 0 | the battery's switch: 0 open (the thumb pushed left, the gap shows) … 1 closed — the setting of the model's part `SW` in `state.settings`; a tap on the slider flips it |
| `flying` | false | the camera flies (the magnifier, a chapter's border): the hand and the switch do nothing |
| `lens`, `lensTarget` | 0, `null` | the magnifier: 0 in its holder … 1 at `lensTarget` (a `LensPose` in the base frame, e.g. `overPose`) |
| `lensCall` | 0 | the step asks the reader to take the magnifier: the resting ring turns full cyan and pulses |
| `dive` | 0 | progress of the flight through the ring: the rim's arcs from 0.5 on |
| `meter`, `scope` | 0 | the instruments: 0 away beyond the frame's edge … 1 on their places (a step tweens them, 0.6 s) |

What the bench has (read-only): `room`, `base` (`base.frame` is the tilted base frame: whatever stands on the base
goes there, then `tameAll(bench.group)`), `light` (the rig owns `ctx.env.tune`; never tune the environment from a
chapter; the lamp light hangs at the `filament`, and `mountBench` puts the shadowless `bounce` above the lamp's pool
every frame), `layout` (the board as data, `sim/board`), `board` (the 3D breadboard: `socketWorld(id)`,
`socketLocal(id)`, the instanced `mouths`, the `print`, the lit rows `highlight(rows, dt)` / `lit`), `state` and
`parts` (the parts on the board, below), `props` (the permanent things: the battery box with the switch, the player,
the speaker and the lamp with their real marks from `shared/parts` — `props.things`, `props.bulb` — the lamp post and
the `filament` where the light hangs; the multimeter and the oscilloscope still stand-ins of their size and colour),
`fixed`, `switch`, `tray` and `hands` (the reader's hand, «hand» below) and `tools` (the magnifier and its `holder`
pose).

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
K materials) and `body` (those that take the look of heat, never a resistor's bands) are for E2-7. `setLook` here
lights an LED (`light` b → glow 1.8 · b, none below 0.02) and turns a pot's knob (`setting`, 300° within 0.15 s);
heat, burnt and bulged are E2-7's. The prints are Text3D, made only where the fonts are loaded (never in unit tests).

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
sockets (a part or a plug that does not stand there is a RangeError); `bench.clear()` takes everything off. `props.things` and `props.bulb` are the permanent things; the bench gives the bulb's filament the light
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
  body, a capsule on a jumper's end; `lead:<name>`: the capsule on a plug): out of its socket at the press (the part
  pending), led within its reach (the part's span from its other legs, 4.0 of a lead from its thing); `hands.near` is
  the free socket within `NEAR` it would take (a cue ring, the row lit) — never the one it left until the hand has
  gone `AWAY`. A part's leg clicks in within `SNAP` while the hand moves; a jumper's end and a plug click in when let
  go within `SNAP` (they cross many sockets on their way), and lie where they were let go otherwise; a part's leg let
  go with no socket goes back.
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
  go of whatever the hand holds (`hands.reset`). The body's glow under the pointer is cyan emissive on the part's
  `body` materials (E2-7's heat look shares them).
- `hand/swap.ts` (`createSwap`) is a scripted repair kept for the chapters: a still copy of a thing leaves along a way
  while the new one comes back the same way.

For checks: `__app.read('electronics-board')` also has `key` (the netlist's shape: it changes when a leg moves to
another row) and `pending`; `__app.read('electronics-hand')` → `{ held, near, preview, rows, busy, switchFlips }`;
`__app.read('electronics-motion')` → `{ camera, focus, tilt, plugs }` (world, every frame: the camera, the thing the
hand moves now or moved last, that part's own up — its body's turn against the table — and every plug). Probes: `part:<id>`, `leg:<id>:<k>` (its grip), `tip:<id>:<k>` (the leg's foot on
the board's face), `lead:<name>`, `end:<name>`, `tray:<key>`, `switch`. The sandbox's step `hand` and
`qa/measure.mjs --only hand` (a mouse, `--touch`) drive them.

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
| `circuit/chapters/build/parts/ends.ts` | `electronics/shared/hand/leg.ts` | `End` → `Leg`: місця «гніздо», «лежить», «у руці», «лоток» (гнізда й рельєф — від стенда, `LegWorld`); одне гніздо — один кінець (затискачів на два кінці, їхнього зсуву й віяла немає); напрям повертає за якорем — річчю дроту чи тілом деталі; `seated` — лише по прибуттю | E2-5 | зроблено |
| `circuit/chapters/build/parts/curves.ts` | `electronics/shared/hand/curves.ts` | рельєф — параметр (`Terrain`); `peeled` і `blend` (з ними й `resample`) не взято: обидва кінці кожного дроту стенда вільні | E2-5 | зроблено |
| `circuit/chapters/build/parts/clamps.ts` (`ground`) | `electronics/shared/hand/terrain.ts` | лише `ground()` із піднятими ділянками як даними (тіло плати, бокс батареї, речі на основі, а для дротів і тіла деталей на платі — їх дає стенд, `bench/mounds.ts`) і лічильник змін `version`, за яким дріт перебудовує форму; затискачі й місця спокою — ні | E2-5 | зроблено |
| `circuit/chapters/build/parts/grips.ts` | `electronics/shared/hand/grips.ts` | батьківська група — параметр; загальний ключ; три форми (`VISUAL.md` §6): кільце на ніжці аксіальної деталі, язичок перед радіальною, капсула 0,07 × 0,24 на кінці перемички, штекері й щупі; радіус сфери дає стенд (сфери не перекриваються); тримач завжди видимий, з’являється й зникає лише вигляд — прихований захват теж бере вказівник | E2-5 | зроблено |
| `circuit/chapters/build/parts/hands.ts` | `electronics/shared/hand/hands.ts` | загальні руки з двома жестами: ключі `part:` / `leg:` / `lead:` / `probe:` / `tray:` / `switch`, площина — лице плати з її рамки, кандидати — гнізда (`layout.nearest`), живі `near` і `preview`, межа вильоту з відбитка, `LIFT` для пальця, захват — від точки натиску; ніжка деталі клацає під час руху, кінець перемички чи штекер — коли відпустили; зміна плати — по прибуттю | E2-5 | зроблено |
| `circuit/chapters/build/parts/swap.ts` | `electronics/shared/hand/swap.ts` | `createSwap(parent, thing, way, lift)`: батьківська група, річ і її шлях — параметри (у `circuit` — один дріт стенда через дальній край); копія знімається з усіх видимих сіток речі | E2-5 | зроблено |
| `circuit/chapters/build/parts/switch.ts` | `electronics/shared/bench/switch.ts` | вимикач батареї; `world.flying` → `bench.flying`; `closed` → налаштування деталі `SW` (`bench.closed`); повзунок з інерцією ставить сам стенд | E2-5 | зроблено |
| `circuit/chapters/battery/parts/cue.ts` | `electronics/shared/hand/cue.ts` | внутрішній радіус кільця, швидкість появи й ім’я — параметри (кільце-підказка на гнізді: 0,12 і 0,025, 0,12 s) | E2-5 | зроблено |
| `circuit/chapters/build/qa/helpers.mjs` | `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs` | нічого, лише коментар-заголовок (бриф E2-3 називає файл серед файлів пісочниці, і `measure.mjs` бере з нього `read`) | E2-3 | зроблено |
| `circuit/shared/stage/tools/gauge.ts` (щуп і дріт) | `electronics/shared/instruments/probe.ts` | вістря — `Leg` (гніздо, спокій, рука); дріт — від гнізда приладу; стрілку, шкалу, `GAUGE_HOME` і число в 3D не взято | E2-6 | заплановано |
| `circuit/shared/world/dive.ts` | `electronics/shared/dive/rail-math.ts` | нічого | E2-8 | заплановано |
| `circuit/chapters/lamp/parts/rail.ts` | `electronics/shared/dive/camera-rail.ts` | імпорт — з `./rail-math` | E2-8 | заплановано |
| `circuit/chapters/lamp/parts/lens-keeper.ts` | `electronics/shared/dive/lens-keeper.ts` | спирається на лупу стенда (`BenchTools`) | E2-8 | заплановано |
| `circuit/chapters/lamp/parts/door.ts` | `electronics/shared/dive/door.ts` | `partDoor(ctx, bench, partId)`: зупинки — з пози деталі на платі; `cut` веде розріз деталі | E2-8 | заплановано |
| `circuit/shared/world/levels.ts` | `electronics/shared/dive/levels.ts` | поверхи `stand`, `part`, `inside`, `atoms`; `legsBetween` не взято | E2-8 | заплановано |
| `circuit/chapters/resistance/parts/poses.ts` | `electronics/shared/dive/poses.ts` | `partLensPose(bench, id)` | E2-8 | заплановано |
| `circuit/shared/world/__tests__/dive.test.ts`, `levels.test.ts` | `electronics/shared/dive/__tests__/` | синтетичні зупинки | E2-8 | заплановано |
