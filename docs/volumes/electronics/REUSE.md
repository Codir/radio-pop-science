# Том «Радіоелектроніка» — що беремо з інших томів (REUSE)

> **Статус:** 20.11.2026 (черга E1, завдання E1-8): план копій до стенда (черга E2) і перших глав (черга E3). Томи не
> імпортують один одного (лінт `local/volume-boundary`), тож усе, що том бере з `circuit`, `radio` чи `electricity`,
> **копіюється** в `app/src/volumes/electronics/shared/**` (або в пісочниці `_dev/chapters/_sandbox-electronics-*`) і
> записується тут: звідки, куди і що змінено (проєкт тому §4).

## 1. Правила

- Копія живе в `electronics/shared/<модуль>/` з тестами; глава тому імпортує лише `@electronics/shared/<модуль>`, а
  пісочниця — так само (лінт `app/eslint-rules/chapter-boundary.js`). Жодного `@circuit/*`, `@radio/*`, `@electricity/*`
  в `electronics/`, і type-only теж.
- Кожна копія — рядок у розділі «Копії» нижче, у коміті, що копіює. Рядок плану (розділ 2) показує, що й навіщо
  братимемо; рядок «Копії» — що справді скопійовано, файл за файлом.
- З `electricity` копіювати можна (рішення плану черги E2: той самий репозиторій і той самий автор); числа його моделей
  (`electricity/sim/**`) не беремо: усе, що рухається від струму чи напруги, бере числа з `electronics/sim/core`.
- Текст на екрані не копіюємо ніколи: він приходить із документів тому через `tools/content`.
- **Паралельна робота.** Черга E2 будується в окремому клоні, і там копії записуються в таблицю «Копії» файлу
  `app/src/volumes/electronics/shared/README.md`. Під час злиття контролер переносить її рядки сюди дослівно: стовпці
  ті самі й у тому самому порядку. Для рядка зі станом «зроблено» стовпець «Що змінимо» каже, що змінено.

## 2. План

| Що | Звідки (`app/src/volumes/`) | Куди | Що змінимо | Черга |
|---|---|---|---|---|
| кімната й стенд | `circuit/shared/stage/` — `room`, `materials`, `layout`, `base`, `light`, `shots`, `dyn-tube`, `air`, `mounts`, `small-parts`, `index` | `electronics/shared/bench/` | без ліхтарика, його розкладання й равлика; основа з макетною платою, лоток спереду, місця приладів (`VISUAL.md` §2); ключове світло — лампа стенда, коли горить, інакше — розсіяне світло темної кімнати; `mountBench` замість `mountStage` | E2-3 |
| лупа й пірнання | `circuit/shared/stage/tools/lens`, `circuit/shared/world/dive`, `levels`; `circuit/chapters/lamp/parts/rail`, `lens-keeper`, `door`; `circuit/chapters/resistance/parts/poses` | `electronics/shared/bench/tools/`, `electronics/shared/dive/` | поверхи «стенд · деталь · усередині деталі · атоми»; зупинки й розріз — від пози деталі на платі | E2-3, E2-8 |
| захвати дротів і рука | `circuit/chapters/build/parts/` — `glide`, `ends`, `curves`, `clamps`, `grips`, `hands`, `swap`, `switch`; `circuit/chapters/battery/parts/cue` | `electronics/shared/hand/`, `electronics/shared/bench/switch` | ніжки деталей замість кінців дроту, гнізда плати замість затискачів; захват на кожну ніжку, штекер і щуп; згоріла деталь іде, нова приходить | E2-5 |
| лампа | `circuit/shared/stage/bulb`, `bulb-heat` | `electronics/shared/parts/` | без великого плану; температуру нитки дає модель (`sim/core/lamp.ts`), а не власний баланс енергії | E2-4 |
| щуп мультиметра | `circuit/shared/stage/tools/gauge` (щуп і дріт) | `electronics/shared/instruments/probe` | вістря — у гніздо плати; число — лише в панелі кроку; стрілку й шкалу не беремо | E2-6 |
| фоновий потік моделі | `radio/shared/link` (протокол потоку, один запит у дорозі, запасний синхронний шлях) | `electronics/shared/sound/` | модель кола `sim/core` замість лінії радіо; блоки відліків для звуку й осцилографа | E1-9 |
| власний звуковий вихід | нове (зразок протоколу — `radio/shared/link`) | `electronics/shared/sound/` | Web Audio тому після першого жесту, мовчить з `?noaudio`, слухає налаштування звуку рушія | E1-9 |
| допоміжне для перевірок | `radio/shared/world` (`fnv1a`, `meanOf`) | `electronics/shared/model/hash` | `meanOf` бере будь-який масив чисел | E2-3 |
| пісочниці | `_dev/chapters/_sandbox-radio-link/` (`index.ts`, `qa/`); `circuit/chapters/build/qa/helpers.mjs` | `_dev/chapters/_sandbox-electronics-sound/`, `_dev/chapters/_sandbox-electronics-bench/` | свої кроки й слова (`SANDBOX`), свої перевірки | E1-9, E2-3 |
| конденсатор усередині | `electricity/chapters/charge-field/parts/capacitor` (обкладки, поле, ізолятор) | `electronics/shared/inside/` | заряд і поле — з моделі; електроліт — рулон фольги з оксидом, якого в джерелі немає | E4 |
| кремній, дірки, p-n-перехід | `electricity/chapters/matter/parts/` — `si-sheet`, `dopants`, `pn-block`, `diamond` | `electronics/shared/inside/` | ширина бар’єра й струм — із `sim/core/diode.ts`, а не з `electricity/sim/matter` | E5 |
| світлодіод усередині | `electricity/chapters/matter/parts/dev-diode-led` (`createLed`) | `electronics/shared/inside/` | колір — із кольору деталі, яскравість — зі струму моделі | E5 |
| корпус електроліта | `electricity/chapters/lab-inverter/parts/components` (`addCan`) | `electronics/shared/parts/` | масштаб і напис «470 μF 16 V» з даних деталі; здуття — зі стану моделі | E2-4 або E4 |

## 3. Чого не беремо

- **З `circuit`:** ліхтарик і його розкладання, равлика, розріз батарейки, лампу зблизька, вигляд «усередині міді»
  (`circuit/shared/copper`): він прив’язаний до стенда `circuit` і мідної ґратки; плівку резистора будуємо нову
  (`electronics/shared/inside/film.ts`, черга E3, завдання E3-5).
- **З `radio`:** подвір’я, монітор, модель лінії й еталон радіо — лише протокол фонового потоку.
- **З `electricity`:** моделі `electricity/sim/**` (діод із бар’єром 0,71 V та інші): модель цього тому — SPICE
  (`sim/core`), і числа мусять збігатися з мультиметром; тексти глав (старий формат, не «шлях»).
- **Тексти будь-якого тому.**

## 4. Копії

Нижче — копії завдання E1-9; рядки черги E2 принесе злиття її клону. Власний звуковий вихід
(`electronics/shared/sound/output.ts`, `plan.ts`, `tape.ts`, `board.ts`) — новий код, не копія: рівень і обмежувач
у ньому — ті самі числа, що в `app/src/audio/engine.ts` (`MASTER_LEVEL` 0,55; поріг −12 dB, коліно 6 dB, ratio 20,
атака 3 ms, відпуск 0,25 s), записані числами, бо платформа їх не експортує.

| Звідки | Куди | Що змінимо | Завдання | Стан |
|---|---|---|---|---|
| `radio/shared/link/` — `index.ts`, `handler.ts`, `protocol.ts`, `model.worker.ts`, `__tests__/link.test.ts`, `__tests__/handler.test.ts` | `electronics/shared/sound/` — `stream.ts`, `handler.ts`, `protocol.ts`, `model.worker.ts`, `__tests__/stream.test.ts`, `__tests__/handler.test.ts` | змінено: модель кола (`Transient` з `sim/core`) замість лінії радіо; запит — блок відліків (1536 при 24 kHz) з дошкою лише тоді, коли вона змінилася; запит іде, лише поки звуковий вихід хоче блок, а наступний — одразу, щойно прийшов попередній, не чекаючи оновлення рушія; немає `still`, межі 25 запитів на секунду й одного кадру на шість оновлень (синхронний шлях дає блок за оновлення, поки вихід хоче); відліки нумерує сцена, тож після падіння потоку вони йдуть далі; без змін: `WorkerLike`, форма `new Worker(new URL(…))`, один запит у дорозі, перехід на головний потік назавжди, одна помилка в консолі за життя, `dispose` через `ctx.onDispose` | E1-9 | зроблено |
| `_dev/chapters/_sandbox-radio-link/` — `index.ts` (слова в `SANDBOX`), `qa/measure.mjs` (каркас: `check`, `open`, розділи `--only`, звіт JSON, рядок `PASS`/`FAIL`) | `_dev/chapters/_sandbox-electronics-sound/` — `index.ts`, `qa/check.mjs` | змінено: один крок і свої слова; свої розділи перевірки (`sound`, `settings`, `filter`, `noaudio`, `visits`); сторінки без `?noaudio`, справжнє клацання по сцені, лічба `AudioContext` скриптом сторінки | E1-9 | зроблено |
