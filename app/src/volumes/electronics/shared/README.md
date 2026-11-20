# `shared` — the bench of the volume «Радіоелектроніка»

The scene's side of the volume: the dark room and the stand, the breadboard, the parts, the hand, the instruments, the
dive through the magnifier and the bench's link to the circuit model (`sim/core`, `sim/board`). No step logic lives
here. The look and the numbers of all of it are fixed by `docs/volumes/electronics/VISUAL.md`. Batch E2
(`docs/superpowers/plans/2026-11-20-electronics/batch-E2.md`) builds the modules one task at a time; this file grows
with them (task E2-10 writes the mount, the options, the state table and the readers for checks).

Each module has its public face in `shared/<module>/index.ts`; there is no `shared/index.ts`. The sandbox
`_dev/chapters/_sandbox-electronics-bench` imports only `@electronics/shared/<module>`.

## Копії

Volumes do not import each other, so what the bench takes from `circuit` and `radio` is copied here. Every copy has a
row below. The table is in Ukrainian on purpose: while batch E2 is built in its own clone, the volume's
`docs/volumes/electronics/REUSE.md` does not exist there yet, and the controller moves these rows into it verbatim when
the clone is merged. «Звідки» and «Куди» are paths from `app/src/volumes/`. A task that copies a file switches its row
from «заплановано» to «зроблено» in the same commit and corrects «Що змінено» if the copy turned out differently.

| Звідки | Куди | Що змінено | Завдання | Стан |
|---|---|---|---|---|
| `circuit/shared/stage/materials.ts` | `electronics/shared/bench/materials.ts` | нічого, лише шляхи імпорту | E2-3 | заплановано |
| `circuit/shared/stage/room.ts` | `electronics/shared/bench/room.ts` | нічого, лише шляхи імпорту | E2-3 | заплановано |
| `circuit/shared/stage/layout.ts` | `electronics/shared/bench/layout.ts` | лишено `BOARD` (основа 8,4 × 5,6) і `LENS` (новий тримач); `LOOP`, `WIRE`, `BATTERY`, `SWITCH`, `SEAT`, `STAPLES`, `RULER`, `SHELF_WORLD` замінено на `PLACES` (`VISUAL.md` §2) | E2-3 | заплановано |
| `circuit/shared/stage/__tests__/layout.test.ts` | `electronics/shared/bench/__tests__/layout.test.ts` | правила `VISUAL.md` §2 і §8 для нових місць і ракурсів | E2-3 | заплановано |
| `circuit/shared/stage/base.ts` | `electronics/shared/bench/base.ts` | розміри з нового `BOARD`; полицю позаду прибрано (лоток стоїть спереду) | E2-3 | заплановано |
| `circuit/shared/stage/light.ts` | `electronics/shared/bench/light.ts` | ключове світло — лампа стенда, коли горить; інакше піднятий «місяць» і більше розсіяного світла | E2-3 | заплановано |
| `circuit/shared/stage/shots.ts` | `electronics/shared/bench/shots.ts` | лишено `boardToWorld`, `STAGE_FOV`, `STAGE_POST` і `stand` з новими числами; нові `board`, `phone`, `meter`, `scope`; ліхтарик, равлик, лампа зблизька, лупа над дротом і передача на нижній поверх прибрані | E2-3 | заплановано |
| `circuit/shared/stage/dyn-tube.ts` | `electronics/shared/bench/dyn-tube.ts` | нічого | E2-3 | заплановано |
| `circuit/shared/stage/air.ts` | `electronics/shared/bench/air.ts` | без променя ліхтарика | E2-3 | заплановано |
| `circuit/shared/stage/tools/lens.ts` | `electronics/shared/bench/tools/lens.ts` | нічого (`LENS` — з нового `layout`) | E2-3 | заплановано |
| `circuit/shared/stage/tools/index.ts` | `electronics/shared/bench/tools/index.ts` | лишено перетворення «основа ↔ світ», тримач лупи й позу лупи над точкою плати; вимірювач, рамку, равлика й лупу-збільшувач прибрано | E2-3 | заплановано |
| `circuit/shared/stage/index.ts` | `electronics/shared/bench/index.ts` | `mountBench` замість `mountStage`: без ліхтарика, розкладання, равлика, розрізу батарейки й лампи зблизька | E2-3 | заплановано |
| `circuit/shared/stage/mounts.ts` (частини) | `electronics/shared/bench/mounts.ts` | лише затискачі, стійка лампи й тримач лупи | E2-3 | заплановано |
| `circuit/shared/stage/small-parts.ts` (`createSlider`) | `electronics/shared/bench/switch-slider.ts` | хід повзунка з нового `layout`: вимикач на кришці боксу батареї | E2-3 | заплановано |
| `radio/shared/world/index.ts` (`fnv1a`, `meanOf`) | `electronics/shared/model/hash.ts` | `meanOf` бере `ArrayLike<number>` | E2-3 | заплановано |
| `_dev/chapters/_sandbox-radio-link/index.ts` | `_dev/chapters/_sandbox-electronics-bench/index.ts` | свій id, порядок, кроки й слова (`SANDBOX`) | E2-3 | заплановано |
| `_dev/chapters/_sandbox-radio-link/qa/measure.mjs` (скелет) | `_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs` | лишено аргументи, `report` / `check` / вердикт, `open`, `held`; розділи перевірок нові | E2-3 | заплановано |
| `circuit/shared/stage/bulb.ts` | `electronics/shared/parts/bulb.ts` | без великого плану (`close`); `supportPath` вбудовано; розміри лампи з `layout`; `depthShell` — і для куполів світлодіодів | E2-4 | заплановано |
| `circuit/shared/stage/bulb-heat.ts` | `electronics/shared/parts/heat-scale.ts` | лише шкала «тепло ↔ температура» й `formatTemperature`; енергетичний баланс лампи прибрано: температуру нитки дає модель | E2-4 | заплановано |
| `circuit/shared/stage/__tests__/bulb.test.ts`, `bulb-heat.test.ts` | `electronics/shared/parts/__tests__/` | разом із кодом | E2-4 | заплановано |
| `circuit/chapters/build/parts/glide.ts` | `electronics/shared/hand/glide.ts` | нічого | E2-5 | заплановано |
| `circuit/chapters/build/parts/ends.ts` | `electronics/shared/hand/leg.ts` | `End` → `Leg`: місця «гніздо», «лежить», «у руці», «лоток»; одне гніздо — одна ніжка; `seated` — лише по прибуттю | E2-5 | заплановано |
| `circuit/chapters/build/parts/curves.ts` | `electronics/shared/hand/curves.ts` | `resample` — з `../bench/dyn-tube`; рельєф — параметр (`Terrain`) | E2-5 | заплановано |
| `circuit/chapters/build/parts/clamps.ts` (`ground`) | `electronics/shared/hand/terrain.ts` | лише `ground()` із піднятими ділянками як даними; затискачі й місця спокою — ні | E2-5 | заплановано |
| `circuit/chapters/build/parts/grips.ts` | `electronics/shared/hand/grips.ts` | батьківська група — параметр; загальний ключ; захват на кожну ніжку, штекер і щуп | E2-5 | заплановано |
| `circuit/chapters/build/parts/hands.ts` | `electronics/shared/hand/hands.ts` | загальні руки: ключі `part:` / `leg:` / `lead:` / `probe:` / `tray:`, площина з рамки плати, кандидати — гнізда, живі `near` і `preview` | E2-5 | заплановано |
| `circuit/chapters/build/parts/swap.ts` | `electronics/shared/hand/swap.ts` | `createSwap(parent, source, path)`: згоріла деталь іде, нова приходить | E2-5 | заплановано |
| `circuit/chapters/build/parts/switch.ts` | `electronics/shared/bench/switch.ts` | вимикач батареї; `world.flying` → `bench.flying`; `closed` → налаштування деталі `SW` | E2-5 | заплановано |
| `circuit/chapters/battery/parts/cue.ts` | `electronics/shared/hand/cue.ts` | нічого | E2-5 | заплановано |
| `circuit/chapters/build/qa/helpers.mjs` | `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs` | нічого (та сама глибина шляху до `tools/qa/lib.mjs`) | E2-5 | заплановано |
| `circuit/shared/stage/tools/gauge.ts` (щуп і дріт) | `electronics/shared/instruments/probe.ts` | вістря — `Leg` (гніздо, спокій, рука); дріт — від гнізда приладу; стрілку, шкалу, `GAUGE_HOME` і число в 3D не взято | E2-6 | заплановано |
| `circuit/shared/world/dive.ts` | `electronics/shared/dive/rail-math.ts` | нічого | E2-8 | заплановано |
| `circuit/chapters/lamp/parts/rail.ts` | `electronics/shared/dive/camera-rail.ts` | імпорт — з `./rail-math` | E2-8 | заплановано |
| `circuit/chapters/lamp/parts/lens-keeper.ts` | `electronics/shared/dive/lens-keeper.ts` | спирається на лупу стенда (`BenchTools`) | E2-8 | заплановано |
| `circuit/chapters/lamp/parts/door.ts` | `electronics/shared/dive/door.ts` | `partDoor(ctx, bench, partId)`: зупинки — з пози деталі на платі; `cut` веде розріз деталі | E2-8 | заплановано |
| `circuit/shared/world/levels.ts` | `electronics/shared/dive/levels.ts` | поверхи `stand`, `part`, `inside`, `atoms`; `legsBetween` не взято | E2-8 | заплановано |
| `circuit/chapters/resistance/parts/poses.ts` | `electronics/shared/dive/poses.ts` | `partLensPose(bench, id)` | E2-8 | заплановано |
| `circuit/shared/world/__tests__/dive.test.ts`, `levels.test.ts` | `electronics/shared/dive/__tests__/` | синтетичні зупинки | E2-8 | заплановано |
