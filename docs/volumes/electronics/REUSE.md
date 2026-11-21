# Том «Радіоелектроніка» — що беремо з інших томів (REUSE)

> **Статус:** 20.11.2026 (черга E1, завдання E1-8): план копій до стенда (черга E2) і перших глав (черга E3). Того ж
> дня (черга E2, завдання E2-M — злиття стенда з першою чергою) у «Копії» перенесено копії стенда, а кожен рядок плану
> дістав свій стан. Томи не імпортують один одного (лінт `local/volume-boundary`), тож усе, що том бере з `circuit`,
> `radio` чи `electricity`, **копіюється** в `app/src/volumes/electronics/shared/**` (або в пісочниці
> `_dev/chapters/_sandbox-electronics-*`) і записується тут: звідки, куди і що змінено (проєкт тому §4).

## 1. Правила

- Копія живе в `electronics/shared/<модуль>/` з тестами; глава тому імпортує лише `@electronics/shared/<модуль>`, а
  пісочниця — так само (лінт `app/eslint-rules/chapter-boundary.js`). Жодного `@circuit/*`, `@radio/*`, `@electricity/*`
  в `electronics/`, і type-only теж.
- Кожна копія — рядок у розділі «Копії» нижче, у коміті, що копіює. Рядок плану (розділ 2) показує, що й навіщо
  братимемо; рядок «Копії» — що справді скопійовано, файл за файлом. Стан рядка плану — «заплановано», доки нічого не
  скопійовано; «зроблено» з посиланням на рядки «Копій» (за їхнім стовпцем «Куди»), коли все скопійовано; «без копії»,
  коли річ збудовано наново і копія не знадобилася (там само — де вона й чому).
- З `electricity` копіювати можна (рішення плану черги E2: той самий репозиторій і той самий автор); числа його моделей
  (`electricity/sim/**`) не беремо: усе, що рухається від струму чи напруги, бере числа з `electronics/sim/core`.
- Текст на екрані не копіюємо ніколи: він приходить із документів тому через `tools/content`.
- **Паралельна робота.** Черга E2 (завдання E2-1…E2-8) будувалася в окремому клоні, де цього файлу ще не було, і
  записувала копії в таблицю «Копії» файлу `app/src/volumes/electronics/shared/README.md` — з тими самими стовпцями в
  тому самому порядку. Під час злиття (завдання E2-M) усі 38 її рядків перенесено в розділ 4 дослівно, а в README лишився
  один рядок, що копії записано тут; відтепер кожна копія — одразу рядок тут. Для рядка зі станом «зроблено» стовпець
  «Що змінимо» каже, що змінено.

## 2. План

| Що | Звідки (`app/src/volumes/`) | Куди | Що змінимо | Черга | Стан |
|---|---|---|---|---|---|
| кімната й стенд | `circuit/shared/stage/` — `room`, `materials`, `layout`, `base`, `light`, `shots`, `dyn-tube`, `air`, `mounts`, `small-parts`, `index` | `electronics/shared/bench/` | без ліхтарика, його розкладання й равлика; основа з макетною платою, лоток спереду, місця приладів (`VISUAL.md` §2); ключове світло — лампа стенда, коли горить, інакше — розсіяне світло темної кімнати; `mountBench` замість `mountStage` | E2-3 | зроблено (E2-3) → §4: `electronics/shared/bench/` — `materials.ts`, `room.ts`, `layout.ts`, `__tests__/layout.test.ts`, `base.ts`, `light.ts`, `shots.ts`, `dyn-tube.ts`, `air.ts`, `index.ts`, `mounts.ts`, `switch-slider.ts` |
| лупа й пірнання | `circuit/shared/stage/tools/lens`, `circuit/shared/world/dive`, `levels`; `circuit/chapters/lamp/parts/rail`, `lens-keeper`, `door`; `circuit/chapters/resistance/parts/poses` | `electronics/shared/bench/tools/`, `electronics/shared/dive/` | поверхи «стенд · деталь · усередині деталі · атоми»; зупинки й розріз — від пози деталі на платі | E2-3, E2-8 | зроблено (E2-3, E2-8) → §4: `electronics/shared/bench/tools/lens.ts`, `electronics/shared/bench/tools/index.ts`; `electronics/shared/dive/` — `rail-math.ts`, `camera-rail.ts`, `lens-keeper.ts`, `door.ts`, `levels.ts`, `poses.ts`, `__tests__/dive.test.ts`, `levels.test.ts` |
| захвати дротів і рука | `circuit/chapters/build/parts/` — `glide`, `ends`, `curves`, `clamps`, `grips`, `hands`, `swap`, `switch`; `circuit/chapters/battery/parts/cue` | `electronics/shared/hand/`, `electronics/shared/bench/switch` | ніжки деталей замість кінців дроту, гнізда плати замість затискачів; захват на кожну ніжку, штекер і щуп; згоріла деталь іде, нова приходить | E2-5 | зроблено (E2-5) → §4: `electronics/shared/hand/` — `glide.ts`, `leg.ts`, `curves.ts`, `terrain.ts`, `grips.ts`, `hands.ts`, `swap.ts`, `cue.ts`; `electronics/shared/bench/switch.ts` |
| лампа | `circuit/shared/stage/bulb`, `bulb-heat` | `electronics/shared/parts/` | без великого плану; температуру нитки дає модель (`sim/core/lamp.ts`), а не власний баланс енергії | E2-4 | зроблено (E2-4) → §4: `electronics/shared/parts/bulb.ts`, `heat-scale.ts`, `__tests__/bulb.test.ts`, `heat-scale.test.ts` |
| щуп мультиметра | `circuit/shared/stage/tools/gauge` (щуп і дріт) | `electronics/shared/instruments/probe` | вістря — у гніздо плати; число — лише в панелі кроку; стрілку й шкалу не беремо | E2-6 | зроблено (E2-6) → §4: `electronics/shared/instruments/probe.ts` |
| фоновий потік моделі | `radio/shared/link` (протокол потоку, один запит у дорозі, запасний синхронний шлях) | `electronics/shared/sound/` | модель кола `sim/core` замість лінії радіо; блоки відліків для звуку й осцилографа | E1-9 | зроблено (E1-9) → §4: `electronics/shared/sound/` — `stream.ts`, `handler.ts`, `protocol.ts`, `model.worker.ts` і їхні тести |
| власний звуковий вихід | нове (зразок протоколу — `radio/shared/link`) | `electronics/shared/sound/` | Web Audio тому після першого жесту, мовчить з `?noaudio`, слухає налаштування звуку рушія | E1-9 | без копії (E1-9): новий код — вступ розділу 4 |
| допоміжне для перевірок | `radio/shared/world` (`fnv1a`, `meanOf`) | `electronics/shared/model/hash` | `meanOf` бере будь-який масив чисел | E2-3 | зроблено (E2-3) → §4: `electronics/shared/model/hash.ts` |
| пісочниці | `_dev/chapters/_sandbox-radio-link/` (`index.ts`, `qa/`); `circuit/chapters/build/qa/helpers.mjs` | `_dev/chapters/_sandbox-electronics-sound/`, `_dev/chapters/_sandbox-electronics-bench/` | свої кроки й слова (`SANDBOX`), свої перевірки | E1-9, E2-3 | зроблено (E1-9, E2-3) → §4: `_dev/chapters/_sandbox-electronics-sound/` — `index.ts`, `qa/check.mjs`; `_dev/chapters/_sandbox-electronics-bench/index.ts`, `qa/measure.mjs`, `qa/helpers.mjs` |
| конденсатор усередині | `electricity/chapters/charge-field/parts/capacitor` (обкладки, поле, ізолятор) | `electronics/shared/inside/` | заряд і поле — з моделі; електроліт — рулон фольги з оксидом, якого в джерелі немає | E4 | заплановано |
| кремній, дірки, p-n-перехід | `electricity/chapters/matter/parts/` — `si-sheet`, `dopants`, `pn-block`, `diamond` | `electronics/shared/inside/` | ширина бар’єра й струм — із `sim/core/diode.ts`, а не з `electricity/sim/matter` | E5 | заплановано |
| світлодіод усередині | `electricity/chapters/matter/parts/dev-diode-led` (`createLed`) | `electronics/shared/inside/` | колір — із кольору деталі, яскравість — зі струму моделі | E5 | заплановано |
| корпус електроліта | `electricity/chapters/lab-inverter/parts/components` (`addCan`) | `electronics/shared/parts/` | масштаб і напис «470 μF 16 V» з даних деталі; здуття — зі стану моделі | E2-4 або E4 | без копії (E2-4): корпус збудовано наново за `VISUAL.md` §4.7 (`electronics/shared/parts/capacitors.ts`), розмір і напис — з ключа каталогу; вигляд здутого — E2-7, його прив’язка до моделі — E2-9 |

## 3. Чого не беремо

- **З `circuit`:** ліхтарик і його розкладання, равлика, розріз батарейки, лампу зблизька, вигляд «усередині міді»
  (`circuit/shared/copper`): він прив’язаний до стенда `circuit` і мідної ґратки; плівку резистора збудовано нову
  (`electronics/shared/inside/film.ts`, черга E3, завдання E3-5): копій у ній немає — механіку розрізу перенесено з
  власного `electronics/shared/dive/cutaway.ts` (E2-8) у `electronics/shared/inside/wedge.ts`, а електрони — орби
  платформи (`@/fx`, `createOrbs`), не копія.
- **З `radio`:** подвір’я, монітор, модель лінії й еталон радіо — лише протокол фонового потоку.
- **З `electricity`:** моделі `electricity/sim/**` (діод із бар’єром 0,71 V та інші): модель цього тому — SPICE
  (`sim/core`), і числа мусять збігатися з мультиметром; тексти глав (старий формат, не «шлях»).
- **Тексти будь-якого тому.**

## 4. Копії

Нижче — копії завдання E1-9, а за ними 38 копій черги E2 (завдання E2-3…E2-8), перенесені під час злиття (E2-M)
дослівно з таблиці «Копії» файлу `app/src/volumes/electronics/shared/README.md`. «Звідки» й «Куди» — шляхи від
`app/src/volumes/`. Власний звуковий вихід
(`electronics/shared/sound/output.ts`, `plan.ts`, `tape.ts`, `board.ts`) — новий код, не копія: рівень і обмежувач
у ньому — ті самі числа, що в `app/src/audio/engine.ts` (`MASTER_LEVEL` 0,55; поріг −12 dB, коліно 6 dB, ratio 20,
атака 3 ms, відпуск 0,25 s), записані числами, бо платформа їх не експортує.

| Звідки | Куди | Що змінимо | Завдання | Стан |
|---|---|---|---|---|
| `radio/shared/link/` — `index.ts`, `handler.ts`, `protocol.ts`, `model.worker.ts`, `__tests__/link.test.ts`, `__tests__/handler.test.ts` | `electronics/shared/sound/` — `stream.ts`, `handler.ts`, `protocol.ts`, `model.worker.ts`, `__tests__/stream.test.ts`, `__tests__/handler.test.ts` | змінено: модель кола (`Transient` з `sim/core`) замість лінії радіо; запит — блок відліків (1536 при 24 kHz) з дошкою лише тоді, коли вона змінилася; запит іде, лише поки звуковий вихід хоче блок, а наступний — одразу, щойно прийшов попередній, не чекаючи оновлення рушія; немає `still`, межі 25 запитів на секунду й одного кадру на шість оновлень (синхронний шлях дає блок за оновлення, поки вихід хоче); відліки нумерує сцена, тож після падіння потоку вони йдуть далі; без змін: `WorkerLike`, форма `new Worker(new URL(…))`, один запит у дорозі, перехід на головний потік назавжди, одна помилка в консолі за життя, `dispose` через `ctx.onDispose` | E1-9 | зроблено |
| `_dev/chapters/_sandbox-radio-link/` — `index.ts` (слова в `SANDBOX`), `qa/measure.mjs` (каркас: `check`, `open`, розділи `--only`, звіт JSON, рядок `PASS`/`FAIL`) | `_dev/chapters/_sandbox-electronics-sound/` — `index.ts`, `qa/check.mjs` | змінено: один крок і свої слова; свої розділи перевірки (`sound`, `settings`, `filter`, `noaudio`, `visits`); сторінки без `?noaudio`, справжнє клацання по сцені, лічба `AudioContext` скриптом сторінки | E1-9 | зроблено |
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
| `circuit/chapters/build/qa/helpers.mjs` (через копію пісочниці стенда `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs`) | `electronics/chapters/meter/qa/helpers.mjs` | нічого, лише коментар-заголовок (рішення плану черги E3, п. 9: помічники сценарію взаємодії — копія з пісочниці стенда) | E3-8 | зроблено |
| `circuit/shared/stage/tools/gauge.ts` (щуп і дріт) | `electronics/shared/instruments/probe.ts` | щуп у мірилі стенда (вістря 0,25, ручка 0,9), червоний `coral` і чорний `ink`; вістря — `Leg` руки (гніздо, лежить на основі, рука, спокій біля приладу); дріт `DynTube` — від гнізда приладу дугою до спинки щупа; стрілку, шкалу, `GAUGE_HOME`, нахил приладу й число в 3D не взято | E2-6 | зроблено |
| `circuit/shared/world/dive.ts` | `electronics/shared/dive/rail-math.ts` | нічого, лише коментар-заголовок | E2-8 | зроблено |
| `circuit/chapters/lamp/parts/rail.ts` | `electronics/shared/dive/camera-rail.ts` | лише імпорт — з `./rail-math` | E2-8 | зроблено |
| `circuit/chapters/lamp/parts/lens-keeper.ts` | `electronics/shared/dive/lens-keeper.ts` | спирається на лупу стенда (`BenchTools`: модель лупи й поза тримача); решта як була | E2-8 | зроблено |
| `circuit/chapters/lamp/parts/door.ts` | `electronics/shared/dive/door.ts` | `partDoor(ctx, bench, partId, { lead })` — двері в будь-яку деталь на платі: зупинки — з її місця (`poses.ts`), нові, коли деталь переставили, поки камера на ракурсі кроку; камеру бере з першим рухом і віддає на ракурсі кроку (`home`); поки камера деінде — `bench.flying`; `cut` відкриває тимчасовий розріз (`cutaway.ts`) після проходу кільця (`CUT_OPENS` 0,78 … 1, `PASS` 0,82 як у `circuit`); читач `electronics-dive` і проби для перевірок | E2-8 | зроблено |
| `circuit/shared/world/levels.ts` | `electronics/shared/dive/levels.ts` | поверхи тому `stand`, `part`, `inside`, `atoms` і де кожен починається на рейці — дані, а не найближча зупинка (`part` від 0,5, `inside` від 1, `atoms` від 2); час прольоту, коротший зі зменшеним рухом; `mixAt`, `floorValue`, `LEG`, `FLIGHT_EASE` і `legsBetween` не взято | E2-8 | зроблено |
| `circuit/chapters/resistance/parts/poses.ts` | `electronics/shared/dive/poses.ts` | узято лише задум (лупа над місцем, піднята до камери вздовж погляду — тут через `overPose` стенда); код новий: місце деталі з її гнізд (`partPlace`), зупинки прольоту в неї (`partStops`), лупа над нею (`partLensPose`) | E2-8 | зроблено |
| `circuit/shared/world/__tests__/dive.test.ts`, `levels.test.ts` | `electronics/shared/dive/__tests__/dive.test.ts`, `levels.test.ts` | синтетичні зупинки замість ракурсів `circuit` (перша зупинка — лупа в роботі приблизно так далеко, як ракурс, далі — на одній лінії до точки плати); рівні — поверхи тому, пороги на рейці й час прольоту | E2-8 | зроблено |
