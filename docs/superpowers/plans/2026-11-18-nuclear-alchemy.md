# Nuclear Alchemy («Ядерна алхімія») — план реалізації, ітерація 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** том `alchemy` у рушії курсу: лабораторія-пісочниця, де один атом перетворюють снарядами, γ-квантами,
очікуванням розпаду й електронами за справжньою таблицею нуклідів; 11 квестів і вільна лабораторія.

**Architecture:** три шари. (1) Дані: знімок IAEA → скрипт → `nuclides.json` власного формату. (2) Модель:
чистий TypeScript у `app/src/volumes/alchemy/sim/**` (жодного three.js, жодного DOM), стан гри — незмінний
об'єкт, кожен інструмент — функція `(state, …) → { state, event }`. (3) Розділ `lab`: одна сцена на всі 12
кроків; `Session` тримає стан і таймери на годиннику рушія, частини сцени лише програють події моделі, тож
будь-який крок відкривається з будь-якого стану.

**Tech Stack:** Vite 8, TypeScript 6 (strict), three.js 0.187, pnpm 12, Node 22.22, vitest; Python 3.12
(лише стандартна бібліотека) для скрипта даних і конвеєра `tools/content`; Playwright + Chrome для `tools/qa`.

**Spec:** `docs/superpowers/specs/2026-11-17-nuclear-alchemy-design.md` — виконавець читає і план, і дизайн.

## Global Constraints

- Обов'язкові документи платформи: `docs/ARCHITECTURE.md`, `docs/STYLE_GUIDE.md`, `docs/VOLUMES.md`,
  `docs/ENGINE_API.md`, `docs/UI_API.md`, `docs/FX_API.md`. Том не імпортує інші томи; розділ імпортує
  платформу (`@/…`) і свій том: `@alchemy/sim/**`, `@alchemy/content/**`, `@alchemy/shared/**`.
- Платформу й інші томи не змінюємо. Дозволена різниця з `main`: `app/src/volumes/alchemy/**`,
  `docs/volumes/alchemy/**`, `tools/data/**`, один рядок у `app/tsconfig.json`, назва теки `alchemy` у списку
  тесту `app/src/engine/__tests__/volumes.test.ts`, таблиця в `docs/STYLE_GUIDE.md`, запис у
  `docs/THIRD_PARTY.md`, `docs/superpowers/**`. Якщо платформі чогось бракує — найменша сумісна добавка,
  записана в `docs/API_CHANGES.md`, і окремий рядок про це у звіті завдання.
- Жодної мережі під час роботи й збірки: дані лежать у репозиторії.
- Тексти кроків — лише в `docs/volumes/alchemy/chapters/lab.md` через `tools/content`; у коді — тільки
  підписи з `chapters/lab/labels.ts`. Мова — українська, терміни за DECISIONS §54; назви елементів як у
  курсі: «Гідроген (водень)», «Аурум (золото)».
- Час — тільки годинник рушія (`update(dt, t)`, `ctx.tweens`, `info.scope.delay`); випадковість — тільки
  `ctx.random`; модель отримує випадкові числа аргументом. `setTimeout`, `Date.now`, `Math.random` — ні.
- Кожен крок відкривається напряму (`#/alchemy/lab/<step>`) і не залежить від попереднього.
- Чесність: кожне спрощення має чип (`'simplified'`, `'notToScale'`, `'illustrative'`, `{ slowed }`).
- Док кроку вміщується в 1280×720 без прокрутки; усе, що робиться в сцені чи на карті, має двійника в доку.
- Власні елементи керування мають обидві реалізації: `node` (WebGL) і `dom` (DOM).
- Середовище: Node 22.22, pnpm 12; знімки й перевірки `tools/qa` на цій машині запускати з
  `QA_ALLOW_SOFTWARE=1` (драйвер NVIDIA зламаний, рендер програмний).
- Коміти — у гілку `nuclear-alchemy`, без `push`. Кожне повідомлення коміту закінчується двома рядками:
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` і
  `Claude-Session: https://claude.ai/code/session_01HDJrrkNNtorjjnGaydZD7q`.
- Анти-цілі дизайну діють у кожному завданні: жодного перетворення, якого немає в даних; жодних інженерних
  подробиць зброї (лише фізика рівня підручника).

## Уточнення до дизайну (рішення плану)

Дизайн лишив це виконавцеві або не сказав прямо; тут воно зафіксоване, щоб усі завдання сходились.

1. **Кількість нуклідів — 3383**, а не 3386: три рядки знімка з Z = 0 до таблиці не входять. Показник у грі:
   «нуклідів M / 3383».
2. **Нижня межа T½ — не розпад.** Якщо в знімку T½ дано як нижню межу (`operator_hl` = `GT` або `GE`) і вона
   більша за вік Всесвіту, розпаду ніхто не спостерігав: гілок немає, «чекати» відмовляє (приклад: ²⁰⁴Pb).
3. **Поріг рідкісних гілок — 10⁻⁴** (0,01 %) після нормування: рідші гілки відкидаються.
4. **«Чекати» працює для будь-якого ядра з гілкою розпаду**, і для «практично стабільних» теж (²³²Th, ²⁰⁹Bi):
   лічильник часу просто показує, скільки довелося чекати. Відмова — лише коли гілок немає.
5. **Зміна кількості електронів не є ходом.** Ходи рахують перетворення ядра: влучний постріл, вибивання
   γ-квантом, розпад після «Чекати». Відскок, відмова, самочинний розпад нетривкого ядра й вибір уламка — не ходи.
6. **«Найкраще» число ходів квесту** — найменше можливе за інструментами цього квесту; його знаходить пошук
   у ширину, а тест вимагає точного збігу.
7. **Інструменти квестів обмежені в усіх 11 квестах** (таблиця в завданні 5), усі інструменти — лише у
   вільній лабораторії. Інакше «найкраще» число залежало б від ілюстративної формули поділу.
8. **`ec/b+`**: гілка, яку знімок позначає «захоплення електрона та/або β⁺», грається як β⁺, коли енергії
   вистачає (Q > 1022 keV), інакше як захоплення електрона. Це спрощення, про нього каже чип і README моделі.
9. **Уламок поділу** стає нейтральним атомом (електронів стільки, скільки протонів).
10. **Показник «Відкрито елементів / нуклідів»** стоїть на дошці під картою, а не в доку: карта і є
    колекція, а док мусить вміститися у 720p.
11. **Вибір старту у вільній лабораторії в доку** — режим «Новий старт»: кнопка ховає інструменти й показує
    два повзунки (елемент, ізотоп) і «Взяти як старт» / «Скасувати».
12. **Рівень читання «Просто» не робимо** в цій ітерації: він забороняє верхні індекси й формули, а квести
    на них тримаються. Конвеєр це дозволяє (шар необов'язковий для розділу).
13. **Посилань на кроки інших томів у тексті немає** (розділ «Перехресні посилання» — рядок-заглушка).
    `docs/DECISIONS.md` не чіпаємо: рішення тому записані в `docs/volumes/alchemy/CURRICULUM.md`.
14. **Випадковість між відвідинами.** `ctx.random` щоразу дає ту саму послідовність, тому сцена бере
    `ctx.random.fork('visit:' + progress.rolls)` і збільшує `rolls` у збереженому прогресі. З порожнім
    сховищем (перевірки `tools/qa`) послідовність та сама — тести відтворювані.
15. **Найбільше електронів — `min(Z + 1, 118)`**: восьмої оболонки модель не малює.
16. **Палітра карти** — не більше трьох насичених кольорів, решта — бліді відтінки: перевірка
    `chapter-check` рахує «родини відтінків» у кадрі й падає, коли їх понад чотири.

## Review Focus

Що дизайн має на увазі, але жоден очевидний тест не зачепить; кожен рядок має тест у завданні-власнику.

1. **Зіпсоване чи чуже сховище**: у `localStorage['alchemy:v1']` сміття, старий формат, невідомі нукліди,
   або сховище кидає виняток (приватне вікно) → гра стартує з порожнім прогресом і не падає.
   Тести: завдання 6 (`parseProgress`), завдання 10 (`storage.ts`).
2. **Натискання не вчасно**: інструмент під час вибору уламка, під час анімації, у мить, коли спливає відлік
   нетривкого ядра → стан цілий, розпад один, хід зарахований один раз.
   Тести: завдання 4 (`pending`), завдання 10 (відлік і постріл в один кадр).
3. **Стрибок між кроками посеред дії**: вихід із кроку під час відліку чи вибору уламка, пряме посилання на
   будь-який крок → крок починається зі свого стартового нукліда, старий таймер не спрацьовує.
   Тести: завдання 10 (сценарій) і 12 (взаємодія).
4. **Краї таблиці**: ¹H (вибити нема чого), Z = 118, N = 178, атом без електронів із чистим захопленням
   електрона, аніон після α-розпаду → відмова з причиною або обрізання, ніколи не Z = 0 і не від'ємні числа.
   Тести: завдання 3, 4, 13 (вікно карти біля країв).
5. **Крайні числа в тексті**: T½ від 10⁻²² s до 10²⁶ років, сума очікувань понад 10³⁰ s, енергія ±200 MeV →
   читабельний рядок, ніколи `NaN`, `Infinity` чи `1e+21`. Тести: завдання 9 (`text.ts`).

## Карта файлів

```
tools/data/
  iaea/ground_states-2026-11-17.csv   знімок джерела (вже лежить, не закомічений; sha256 8aee5dc4…12c795)
  build_nuclides.py                   єдине місце, що знає формат джерела
  README.md                           джерело, дата, правила чищення, як перегенерувати
app/src/volumes/alchemy/
  volume.json · volume.ts · chapters.ts
  sim/data/nuclides.json              згенеровано, закомічено
  sim/core/                           те, що знадобиться й наступним ітераціям
    nuclides.ts   elements.ts   shells.ts   notation.ts   index.ts   __tests__/
  sim/lab/                            правила гри
    decay.ts   reactions.ts   game.ts   quests.ts   solver.ts   progress.ts   index.ts   README.md   __tests__/
  shared/                             копії моделей з тому electricity, розширені до Z = 118
    nucleus.ts   shell-atom.ts   count-stepper.ts   fission-drop.ts
  content/generated/lab.json · lab.manifest.json      згенеровано конвеєром
  chapters/lab/
    index.ts   content.ts   chapter.ts   labels.ts   shots.ts   scene.ts   README.md
    parts/ session.ts  storage.ts  text.ts  dock.ts  atom-view.ts  emitter.ts  decay-fx.ts
           fission-view.ts  chart-model.ts  nuclide-chart.ts  start-picker.ts
    qa/interactions.mjs   __tests__/
docs/volumes/alchemy/
  CURRICULUM.md   chapters/lab.md   (+ згенеровані INDEX.md, GLOSSARY.md, chapters/_export/**)
```

---

### Task 1: Дані — знімок, скрипт, `nuclides.json`, доступ із типами

**Files:**
- Create: `tools/data/build_nuclides.py`, `tools/data/README.md`
- Create: `app/src/volumes/alchemy/sim/data/nuclides.json` (результат скрипта)
- Create: `app/src/volumes/alchemy/sim/core/nuclides.ts`, `app/src/volumes/alchemy/sim/core/index.ts`
- Test: `app/src/volumes/alchemy/sim/core/__tests__/nuclides.test.ts`
- Modify: `docs/THIRD_PARTY.md` (один рядок таблиці)
- Вже є: `tools/data/iaea/ground_states-2026-11-17.csv`. Якщо файла немає — завантажити й звірити sha256
  `8aee5dc431af1e35fcb49746387b83e927b3c300e7787defbda621a08212c795`:
  `curl -sS -A 'Mozilla/5.0' 'https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all' -o tools/data/iaea/ground_states-2026-11-17.csv`
  (інша сума означає новіший знімок: зупинитись і повідомити, числа плану прив'язані до цього).

**Interfaces:**
- Consumes: нічого.
- Produces (`@alchemy/sim/core`):

```ts
export type DecayCode =
  | 'b-' | 'b+' | 'ec' | 'ec/b+' | 'a' | 'p' | '2p' | 'n' | '2n'
  | 'b-n' | 'b-2n' | 'b-3n' | 'b-4n' | 'b-p' | 'b-a' | 'b+p' | 'b+2p' | 'b+a' | '2b-' | '2b+' | 'sf';
export type NuclideStatus = 'stable' | 'longLived' | 'radioactive' | 'fleeting' | 'incomplete';
export interface Branch { readonly code: DecayCode; readonly share: number }
export interface NuclideRef { readonly z: number; readonly n: number }
export interface Nuclide extends NuclideRef {
  readonly a: number;
  readonly halfLife: number | 'stable' | null;   // секунди; null — невідомо
  readonly branches: readonly Branch[];           // частки в сумі 1, від найбільшої
  readonly abundance: number | null;              // відсотки в природі
  readonly massExcess: number | null;             // keV
  readonly discovered: number | null;             // рік
  readonly status: NuclideStatus;
}
export const AGE_OF_UNIVERSE_S = 4.35e17;
export const FLEETING_BELOW_S = 1;
export const NUCLIDE_COUNT: number;               // 3383
export const MAX_Z = 118;
export const MAX_N = 178;
export const NEUTRON_MASS_EXCESS: number;         // 8071.318 keV, з даних
export const HYDROGEN_MASS_EXCESS: number;        // 7288.971 keV = massExcess ¹H
export const SOURCE_SYMBOLS: readonly string[];   // 118 символів зі знімка, для звірки з elements.ts
export function getNuclide(z: number, n: number): Nuclide | undefined;
export function hasNuclide(z: number, n: number): boolean;
export function allNuclides(): readonly Nuclide[];            // за z, потім за n
export function isotopesOf(z: number): readonly Nuclide[];    // за n
export function naturalNuclides(): readonly Nuclide[];        // abundance !== null
export function bindingPerNucleon(x: Nuclide): number | null; // keV; null без massExcess
export function nuclideKey(z: number, n: number): string;     // '79-118'
```

Формат `nuclides.json` (власний; модель знає тільки його):

```json
{ "source": "IAEA Nuclear Data Section — Live Chart of Nuclides, ground states",
  "snapshot": "2026-11-17",
  "neutron": { "massExcess": 8071.31806, "halfLife": 613.9 },
  "symbols": ["H", "He", "…118 символів…"],
  "nuclides": [[1, 0, "stable", [], 99.9855, 7288.971064, 1920],
               [1, 2, 388781328.007, [["b-", 1]], null, 14949.8109, 1934]] }
```

Рядок нукліда: `[z, n, halfLife, branches, abundance, massExcess, discovered]`; `halfLife` — секунди,
`"stable"` або `null`; відсортовано за `z`, потім `n`.

**Правила скрипта** (усе чищення тут; README повторює їх словами):

| Крок | Правило |
|---|---|
| рядки | Z = 0 пропустити; з рядка `(0, 1)` взяти `neutron.massExcess` і `neutron.halfLife` |
| `halfLife` | `half_life == 'STABLE'` → `"stable"`; інакше `float(half_life_sec)`, якщо колонка не порожня; інакше `null` |
| коди | `B-`→`b-`, `EC+B+`→`ec/b+`, `EC`→`ec`, `B+`→`b+`, `A`→`a`, `P`→`p`, `2P`→`2p`, `N`→`n`, `2N`→`2n`, `B-N`→`b-n`, `B-2N`→`b-2n`, `B-3N`→`b-3n`, `B-4N`→`b-4n`, `B-P`→`b-p`, `B-A`→`b-a`, `ECP` і `B+P`→`b+p`, `EC2P` і `B+2P`→`b+2p`, `ECA` і `B+A`→`b+a`, `2B-`→`2b-`, `2EC` і `2B+`→`2b+`, `SF`→`sf`; усе інше (`IT`, `ECSF`, `SF+EC+B+`, `B-SF`, `B-5N`…`B-7N`, кластерні `14C`, `24NE`, `{+25}Ne`, `Mg`…) відкинути |
| повтор | той самий код джерела двічі в одному рядку (⁴⁸Ca: `2B-` 78 і 74) → лишити перший; різні коди джерела, що дали один наш код, → частки додати |
| нижня межа | `operator_hl` ∈ {`GT`, `GE`} і `half_life_sec` > 4.35e17 → гілок немає |
| дочірній | гілку, чий дочірній нуклід відсутній у таблиці, відкинути (зсуви `(ΔZ, ΔN)` — таблиця в завданні 3; `sf` лишається завжди) |
| частки | усі частки рядка порожні → порівну; частина порожня → порожні = 0; нормувати до 1; відкинути < 1e-4; нормувати знову; сортувати від найбільшої; 6 значущих цифр |
| решта | `abundance`, `massExcess`, `discovery` — число або `null` |

Статус рахує `nuclides.ts`, у такому порядку: `"stable"` → `stable`; `halfLife` > `AGE_OF_UNIVERSE_S` →
`longLived`; немає гілок → `incomplete`; `halfLife` — `null` або < `FLEETING_BELOW_S` → `fleeting`; інакше
`radioactive`.

- [ ] **Step 1: Написати тест, що падає** — `sim/core/__tests__/nuclides.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { NUCLIDE_COUNT, SOURCE_SYMBOLS, allNuclides, bindingPerNucleon, getNuclide, hasNuclide, isotopesOf, naturalNuclides } from '../nuclides';

describe('nuclide table', () => {
  it('has the snapshot counts', () => {
    expect(NUCLIDE_COUNT).toBe(3383);
    expect(allNuclides()).toHaveLength(3383);
    expect(new Set(allNuclides().map((x) => x.z)).size).toBe(118);
    expect(SOURCE_SYMBOLS).toHaveLength(118);
    expect(naturalNuclides()).toHaveLength(288);
    const count = (s: string) => allNuclides().filter((x) => x.status === s).length;
    expect([count('stable'), count('longLived'), count('radioactive'), count('fleeting'), count('incomplete')])
      .toEqual([244, 38, 1870, 1170, 61]);
    expect(allNuclides().every((x) => x.z >= 1 && x.n >= 0)).toBe(true);
  });
  it('keeps shares normalised and sorted', () => {
    for (const x of allNuclides()) {
      if (x.branches.length === 0) continue;
      expect(x.branches.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 5);
      expect(x.branches.every((b, i, all) => i === 0 || all[i - 1]!.share >= b.share)).toBe(true);
      expect(x.branches.every((b) => b.share >= 1e-4)).toBe(true);
    }
  });
  it('cleans the known quirks of the snapshot', () => {
    expect(getNuclide(79, 118)).toMatchObject({ a: 197, status: 'stable', abundance: 100, branches: [] });
    expect(getNuclide(1, 2)!.branches).toEqual([{ code: 'b-', share: 1 }]);
    expect(getNuclide(1, 2)!.halfLife).toBeCloseTo(388781328, -2);
    expect(getNuclide(118, 176)!.branches.map((b) => [b.code, +b.share.toFixed(4)])).toEqual([['a', 0.8333], ['sf', 0.1667]]);
    expect(getNuclide(4, 2)!.branches).toEqual([{ code: '2p', share: 1 }]);          // α → ²He не існує
    expect(getNuclide(82, 122)).toMatchObject({ status: 'longLived', branches: [] }); // нижня межа: розпаду не бачили
    expect(getNuclide(90, 142)).toMatchObject({ status: 'longLived', branches: [{ code: 'a', share: 1 }] });
    expect(getNuclide(20, 28)!.branches.map((b) => [b.code, b.share])).toEqual([['2b-', 0.78], ['b-', 0.22]]);
    expect(getNuclide(92, 146)!.branches).toEqual([{ code: 'a', share: 1 }]);          // sf 5·10⁻⁷ відкинуто
    expect(getNuclide(3, 1)).toMatchObject({ halfLife: null, status: 'fleeting' });    // ⁴Li: гілка є, T½ немає
    expect(getNuclide(2, 0)).toBeUndefined();
    expect(hasNuclide(118, 177)).toBe(false);
    expect(isotopesOf(118).map((x) => x.n)).toEqual([176]);
  });
  it('derives the binding energy per nucleon from the mass excess', () => {
    expect(bindingPerNucleon(getNuclide(26, 30)!)).toBeCloseTo(8790.36, 0);
    expect(bindingPerNucleon(getNuclide(1, 0)!)).toBeCloseTo(0, 6);
  });
});
```

- [ ] **Step 2: Запустити й побачити падіння**

Run: `cd app && pnpm vitest run src/volumes/alchemy/sim/core/__tests__/nuclides.test.ts`
Expected: FAIL — модуля `../nuclides` ще немає.

- [ ] **Step 3: Написати `tools/data/build_nuclides.py`**

`python3 tools/data/build_nuclides.py [--src tools/data/iaea/ground_states-2026-11-17.csv] [--out app/src/volumes/alchemy/sim/data/nuclides.json]`
— лише стандартна бібліотека (`csv`, `json`, `argparse`), як у `tools/content`. Два проходи: спершу множина
ключів `(z, n)`, потім гілки. Наприкінці друкує зведення: скільки нуклідів, скільки за кожним відкинутим
кодом, скільки гілок відкинуто через відсутній дочірній нуклід. Для цього знімка: рівно 3383 нукліди
(це звіряти); решта — орієнтир, залежить від порядку підрахунку: через дочірній ≈ 32 гілки; `B-5N`, `B-6N`,
`B-7N`, `IT` — по 2, `ECSF` — 4, `SF+EC+B+` — 5, `14C` — 5–6, `24NE` — 2, решта кластерних і `B-SF` — по 1.

- [ ] **Step 4: Згенерувати дані**

Run: `python3 tools/data/build_nuclides.py`
Expected: зведення з числами вище; файл `app/src/volumes/alchemy/sim/data/nuclides.json` ≈ 150–250 kB.

- [ ] **Step 5: Написати `sim/core/nuclides.ts` і `sim/core/index.ts`**

Імпортує JSON (`import raw from '../data/nuclides.json'`), один раз будує `Map<string, Nuclide>` і масиви.
`bindingPerNucleon = (z·HYDROGEN_MASS_EXCESS + n·NEUTRON_MASS_EXCESS − massExcess) / a`.

- [ ] **Step 6: Запустити тест**

Run: `cd app && pnpm vitest run src/volumes/alchemy/sim/core/__tests__/nuclides.test.ts`
Expected: PASS.

- [ ] **Step 7: README і запис про джерело**

`tools/data/README.md`: джерело й адреса, дата знімка 2026-11-17, sha256, команда перегенерації, таблиця
правил чищення, зведення. `docs/THIRD_PARTY.md`, таблиця «Shipped in the application»
(`| Item | Version | Licence | Used for | Where |`), новий рядок:
`| IAEA Nuclear Data Section — Live Chart of Nuclides, ground states (https://nds.iaea.org/relnsd/v1/data) | snapshot 2026-11-17 | terms of use NOT verified (the terms pages were unreachable); the source is replaceable — only tools/data/build_nuclides.py knows its format | nuclide table of the volume «Ядерна алхімія» | tools/data/iaea/, app/src/volumes/alchemy/sim/data/nuclides.json |`

- [ ] **Step 8: Переконатися, що нічого не зламано, і закомітити**

Run: `cd app && pnpm typecheck && pnpm lint && pnpm test`
Expected: усе зелене (1380 наявних тестів + нові).

```bash
git add tools/data app/src/volumes/alchemy/sim/data app/src/volumes/alchemy/sim/core docs/THIRD_PARTY.md
git commit -m "feat(alchemy): nuclide table from the IAEA snapshot"
```

---

### Task 2: Елементи, оболонки, запис нукліда

**Files:**
- Create: `app/src/volumes/alchemy/sim/core/elements.ts`, `shells.ts`, `notation.ts`; доповнити `index.ts`
- Test: `app/src/volumes/alchemy/sim/core/__tests__/elements.test.ts`

**Interfaces:**
- Consumes: `SOURCE_SYMBOLS`, `MAX_Z` (завдання 1).
- Produces:

```ts
export interface ElementInfo { readonly z: number; readonly symbol: string; readonly nameUk: string; readonly substanceUk?: string }
export const ELEMENTS: readonly ElementInfo[];              // 118, індекс z − 1
export function elementByZ(z: number): ElementInfo | undefined;
export function elementName(z: number): string;             // «Аурум (золото)», «Гелій»
export function maxElectrons(z: number): number;            // min(z + 1, 118)
export function shellCounts(z: number, electrons: number): number[];   // K, L, M…; [] для 0 електронів
export function nuclideSymbol(z: number, n: number): string;           // '¹⁹⁷Au'
export function ionSymbol(z: number, n: number, electrons: number): string;  // '¹⁹⁷Au', '¹⁹⁷Au⁺', '⁵⁶Fe²⁺', '¹H⁻'
export function nuclideName(z: number, n: number): string;             // «Аурум (золото)-197»
```

Назви елементів — точна копія (номенклатурна назва; у дужках проста речовина, якщо відрізняється):

```
1 H Гідроген (водень) · 2 He Гелій · 3 Li Літій · 4 Be Берилій · 5 B Бор · 6 C Карбон (вуглець) ·
7 N Нітроген (азот) · 8 O Оксиген (кисень) · 9 F Флуор (фтор) · 10 Ne Неон · 11 Na Натрій · 12 Mg Магній ·
13 Al Алюміній · 14 Si Силіцій (кремній) · 15 P Фосфор · 16 S Сульфур (сірка) · 17 Cl Хлор · 18 Ar Аргон ·
19 K Калій · 20 Ca Кальцій · 21 Sc Скандій · 22 Ti Титан · 23 V Ванадій · 24 Cr Хром ·
25 Mn Манган (марганець) · 26 Fe Ферум (залізо) · 27 Co Кобальт · 28 Ni Нікол (нікель) · 29 Cu Купрум (мідь) ·
30 Zn Цинк · 31 Ga Галій · 32 Ge Германій · 33 As Арсен (миш’як) · 34 Se Селен · 35 Br Бром · 36 Kr Криптон ·
37 Rb Рубідій · 38 Sr Стронцій · 39 Y Ітрій · 40 Zr Цирконій · 41 Nb Ніобій · 42 Mo Молібден · 43 Tc Технецій ·
44 Ru Рутеній · 45 Rh Родій · 46 Pd Паладій · 47 Ag Аргентум (срібло) · 48 Cd Кадмій · 49 In Індій ·
50 Sn Станум (олово) · 51 Sb Стибій (сурма) · 52 Te Телур · 53 I Йод · 54 Xe Ксенон · 55 Cs Цезій · 56 Ba Барій ·
57 La Лантан · 58 Ce Церій · 59 Pr Празеодим · 60 Nd Неодим · 61 Pm Прометій · 62 Sm Самарій · 63 Eu Європій ·
64 Gd Гадоліній · 65 Tb Тербій · 66 Dy Диспрозій · 67 Ho Гольмій · 68 Er Ербій · 69 Tm Тулій · 70 Yb Ітербій ·
71 Lu Лютецій · 72 Hf Гафній · 73 Ta Тантал · 74 W Вольфрам · 75 Re Реній · 76 Os Осмій · 77 Ir Іридій ·
78 Pt Платина · 79 Au Аурум (золото) · 80 Hg Меркурій (ртуть) · 81 Tl Талій · 82 Pb Плюмбум (свинець) ·
83 Bi Бісмут (вісмут) · 84 Po Полоній · 85 At Астат · 86 Rn Радон · 87 Fr Францій · 88 Ra Радій · 89 Ac Актиній ·
90 Th Торій · 91 Pa Протактиній · 92 U Уран · 93 Np Нептуній · 94 Pu Плутоній · 95 Am Америцій · 96 Cm Кюрій ·
97 Bk Берклій · 98 Cf Каліфорній · 99 Es Ейнштейній · 100 Fm Фермій · 101 Md Менделевій · 102 No Нобелій ·
103 Lr Лоуренсій · 104 Rf Резерфордій · 105 Db Дубній · 106 Sg Сіборгій · 107 Bh Борій · 108 Hs Гасій ·
109 Mt Майтнерій · 110 Ds Дармштадтій · 111 Rg Рентгеній · 112 Cn Коперницій · 113 Nh Ніхоній ·
114 Fl Флеровій · 115 Mc Московій · 116 Lv Ліверморій · 117 Ts Теннессин · 118 Og Оганесон
```

Оболонки: нейтральний атом — порядок Маделунга (1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p) з
винятками: Cr 3d⁵4s¹, Cu 3d¹⁰4s¹, Nb 4d⁴5s¹, Mo 4d⁵5s¹, Ru 4d⁷5s¹, Rh 4d⁸5s¹, Pd 4d¹⁰5s⁰, Ag 4d¹⁰5s¹,
La 5d¹6s², Ce 4f¹5d¹6s², Gd 4f⁷5d¹6s², Pt 5d⁹6s¹, Au 5d¹⁰6s¹, Ac 6d¹7s², Th 6d²7s², Pa 5f²6d¹7s²,
U 5f³6d¹7s², Np 5f⁴6d¹7s², Cm 5f⁷6d¹7s², Lr 5f¹⁴7s²7p¹. Катіон: від нейтрального знімати електрони з
найбільшого `n`, у межах `n` — з найбільшого `l`. Аніон (`electrons = z + 1`): конфігурація нейтрального
атома з таким числом електронів. `electrons` обрізати до `0…maxElectrons(z)`, де
`export const maxElectrons = (z: number): number => Math.min(z + 1, 118)` (восьмої оболонки в грі немає).

- [ ] **Step 1: Написати тест, що падає** — `elements.test.ts`

```ts
it('names all 118 elements like the source', () => {
  expect(ELEMENTS).toHaveLength(118);
  expect(ELEMENTS.map((e) => e.symbol)).toEqual([...SOURCE_SYMBOLS]);
  expect(elementByZ(79)).toEqual({ z: 79, symbol: 'Au', nameUk: 'Аурум', substanceUk: 'золото' });
  expect(elementName(1)).toBe('Гідроген (водень)');
  expect(elementName(2)).toBe('Гелій');
  expect(elementName(118)).toBe('Оганесон');
  expect(elementByZ(0)).toBeUndefined();
  expect(elementByZ(119)).toBeUndefined();
});
it('fills the shells', () => {
  const cases: [number, number, number[]][] = [
    [1, 1, [1]], [1, 0, []], [1, 2, [2]], [6, 6, [2, 4]], [24, 24, [2, 8, 13, 1]], [26, 24, [2, 8, 14]],
    [29, 29, [2, 8, 18, 1]], [29, 28, [2, 8, 18]], [46, 46, [2, 8, 18, 18]], [47, 47, [2, 8, 18, 18, 1]],
    [58, 58, [2, 8, 18, 19, 9, 2]], [64, 64, [2, 8, 18, 25, 9, 2]], [79, 79, [2, 8, 18, 32, 18, 1]],
    [92, 92, [2, 8, 18, 32, 21, 9, 2]], [103, 103, [2, 8, 18, 32, 32, 8, 3]], [118, 118, [2, 8, 18, 32, 32, 18, 8]],
  ];
  for (const [z, e, shells] of cases) expect(shellCounts(z, e), `${z}/${e}`).toEqual(shells);
  for (let z = 1; z <= 118; z++) expect(shellCounts(z, z).reduce((a, b) => a + b, 0)).toBe(z);
  expect(shellCounts(79, 500)).toEqual(shellCounts(79, 80));   // не більше z + 1
  expect(shellCounts(79, -3)).toEqual([]);
  expect(maxElectrons(79)).toBe(80);
  expect(maxElectrons(118)).toBe(118);                          // оганесон аніоном не стає
  expect(shellCounts(118, 119)).toEqual([2, 8, 18, 32, 32, 18, 8]);
});
it('writes nuclides and ions', () => {
  expect(nuclideSymbol(79, 118)).toBe('¹⁹⁷Au');
  expect(nuclideSymbol(1, 0)).toBe('¹H');
  expect(ionSymbol(79, 118, 79)).toBe('¹⁹⁷Au');
  expect(ionSymbol(79, 118, 78)).toBe('¹⁹⁷Au⁺');
  expect(ionSymbol(26, 30, 24)).toBe('⁵⁶Fe²⁺');
  expect(ionSymbol(1, 0, 2)).toBe('¹H⁻');
  expect(nuclideName(79, 118)).toBe('Аурум (золото)-197');
});
```

- [ ] **Step 2: Запустити — FAIL** (`pnpm vitest run src/volumes/alchemy/sim/core/__tests__/elements.test.ts`).
- [ ] **Step 3: Написати `elements.ts`, `shells.ts`, `notation.ts`** (верхні індекси — `superscript` з `@/content`).
- [ ] **Step 4: Запустити — PASS**, потім `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(alchemy): element names, shell filling, nuclide notation"`.

---

### Task 3: Перетворення — розпади, снаряди, γ-квант, поділ, енергія

**Files:**
- Create: `app/src/volumes/alchemy/sim/lab/decay.ts`, `reactions.ts`, `index.ts`
- Test: `app/src/volumes/alchemy/sim/lab/__tests__/decay.test.ts`, `reactions.test.ts`

**Interfaces:**
- Consumes: `Nuclide`, `NuclideRef`, `Branch`, `DecayCode`, `getNuclide`, `hasNuclide`, `NEUTRON_MASS_EXCESS`, `HYDROGEN_MASS_EXCESS`.
- Produces:

```ts
// decay.ts
export type Particle = 'e-' | 'e+' | 'alpha' | 'p' | 'n';
export const DECAY_SHIFT: Readonly<Record<Exclude<DecayCode, 'sf'>, readonly [dz: number, dn: number]>>;
export type PlayedMode = Exclude<DecayCode, 'ec/b+'>;         // як гілку зіграно: 'ec/b+' стає 'ec' або 'b+'
export const EMITS: Readonly<Record<Exclude<PlayedMode, 'sf'>, readonly Particle[]>>;
export const ELECTRONS_USED: Readonly<Partial<Record<PlayedMode, number>>>;   // { ec: 1, '2b+': 2 }
export function daughterOf(x: NuclideRef, code: Exclude<DecayCode, 'sf'>): NuclideRef;
export function playedMode(x: Nuclide, code: DecayCode, electrons: number): PlayedMode | null;  // null — зараз неможлива
export function availableBranches(x: Nuclide, electrons: number): readonly Branch[];            // перенормовані
export function pickBranch(branches: readonly Branch[], u: number): Branch;                     // u ∈ [0, 1)
export function sampleLifetime(halfLife: number | 'stable' | null, u: number): number;          // секунди
export function decayQ(x: Nuclide, code: Exclude<DecayCode, 'sf'>): number | null;              // keV

// reactions.ts
export type ProjectileId = 'n' | 'p' | 'd' | 'he3' | 'alpha' | 'c12' | 'o16' | 'ca48';
export interface Projectile extends NuclideRef { readonly id: ProjectileId; readonly symbol: string }
export const PROJECTILES: readonly Projectile[];     // n(0,1) 'n', p(1,0) 'p', d(1,1) '²H', he3(2,1) '³He',
                                                     // alpha(2,2) 'α', c12(6,6) '¹²C', o16(8,8) '¹⁶O', ca48(20,28) '⁴⁸Ca'
export interface Fission { readonly heavy: NuclideRef; readonly light: NuclideRef; readonly neutrons: number;
                           readonly q: number | null; readonly preset: boolean }
export type FireResult =
  | { readonly kind: 'capture'; readonly product: NuclideRef; readonly evaporated: number; readonly q: number | null }
  | { readonly kind: 'pp'; readonly product: NuclideRef; readonly q: number }        // ¹H + p → ²H + e⁺ + ν
  | { readonly kind: 'fission'; readonly fission: Fission }
  | { readonly kind: 'bounce' };
export const MAX_EVAPORATED = 4;
export function fire(target: NuclideRef, projectile: ProjectileId): FireResult;
export function knockOut(target: NuclideRef, what: 'n' | 'p'): { readonly product: NuclideRef; readonly q: number | null } | null;
export function spontaneousFission(parent: NuclideRef): Fission | null;
```

Таблиця зсувів `(ΔZ, ΔN)` і частинок, що вилітають:

| код | ΔZ, ΔN | вилітає | | код | ΔZ, ΔN | вилітає |
|---|---|---|---|---|---|---|
| `b-` | +1, −1 | e⁻ | | `b-n` … `b-4n` | +1, −2 … −5 | e⁻, k·n |
| `b+` | −1, +1 | e⁺ | | `b-p` | 0, −1 | e⁻, p |
| `ec` | −1, +1 | — (електрон оболонки зникає) | | `b-a` | −1, −3 | e⁻, α |
| `a` | −2, −2 | α | | `b+p` | −2, +1 | e⁺, p |
| `p`, `2p` | −1 / −2, 0 | p / 2p | | `b+2p` | −3, +1 | e⁺, 2p |
| `n`, `2n` | 0, −1 / −2 | n / 2n | | `b+a` | −3, −1 | e⁺, α |
| `2b-` | +2, −2 | 2e⁻ | | `2b+` | −2, +2 | — (два електрони оболонки) |

Правила:
- `playedMode`: `ec` потребує ≥ 1 електрона; `2b+` — ≥ 2; `ec/b+` → `'b+'`, якщо `decayQ` > 1022 keV або
  маса невідома; інакше `'ec'` (і тоді потребує електрона); решта кодів — як є.
- `availableBranches`: гілки, для яких `playedMode` не `null`, частки перенормовані до 1.
- `sampleLifetime(T, u) = −ln(1 − u) · T / ln 2`; для `null` і `'stable'` — 0. (При `u = 0.5` це рівно `T`.)
- `decayQ = ME(материнського) − ME(дочірнього) − Σ ME(вилетілих n, ¹H, ⁴He)`; електрони й позитрони не
  віднімаються (маси атомні). `null`, якщо бракує будь-якої маси.
- `fire`: (1) ціль ¹H і снаряд `p` → `pp`, продукт ²H, `q = 2·ME(¹H) − ME(²H)`; (2) снаряд `n` і ціль із
  таблиці подільних → `fission` (preset); (3) складене ядро `(Z + z, N + n − k)` для k = 0…4: перше, що є в
  таблиці, → `capture` з `evaporated = k`, `q = ME(цілі) + ME(снаряда) − ME(продукту) − k·ME(n)`;
  (4) інакше `bounce`. Маса снаряда: `n` — `NEUTRON_MASS_EXCESS`, решта — `massExcess` відповідного нукліда.
- Подільні (ціль + n → важкий + легкий + нейтрони): ²³³U → ¹³⁷Xe + ⁹⁴Sr + 3n; ²³⁵U → ¹⁴¹Ba + ⁹²Kr + 3n;
  ²³⁹Pu → ¹⁴⁴Ba + ⁹⁴Sr + 2n; ²⁴¹Pu → ¹⁴⁴Ba + ⁹⁵Sr + 3n. `q = ME(цілі) + ME(n) − ME(важкого) − ME(легкого) − ν·ME(n)`.
- `spontaneousFission` (ілюстративна формула, одна на всі): `A′ = Z + N − 2`; `A_H = 140`, якщо
  `A′ − 140 ≤ 140`, інакше `A′ − 140`; `Z_H = round(Z · A_H / A′)`; важкий = найближчий наявний нуклід до
  `(Z_H, A_H − Z_H)`, легкий — до `(Z − Z_H, A′ − A_H − (Z − Z_H))`, пошук по N зі зсувами 0, −1, +1, −2, +2 …
  ±4; `neutrons = (Z + N) − A(важкого) − A(легкого)`; немає котрогось — `null`.
- `knockOut`: `n` → `(Z, N − 1)`, `p` → `(Z − 1, N)`; `null`, якщо такого нукліда немає або `Z − 1 < 1`.
  `q = ME(цілі) − ME(продукту) − ME(вибитого)` — від'ємне («потрібно»).

- [ ] **Step 1: Написати тести, що падають**

```ts
// decay.test.ts
it('moves along the chart', () => {
  expect(daughterOf({ z: 6, n: 8 }, 'b-')).toEqual({ z: 7, n: 7 });
  expect(daughterOf({ z: 92, n: 146 }, 'a')).toEqual({ z: 90, n: 144 });
  expect(daughterOf({ z: 80, n: 117 }, 'ec')).toEqual({ z: 79, n: 118 });
  expect(DECAY_SHIFT['b-3n']).toEqual([1, -4]);
  expect(DECAY_SHIFT['b+a']).toEqual([-3, -1]);
});
it('finds every daughter the table lists', () => {              // цілісність даних (дизайн §6.2)
  for (const x of allNuclides())
    for (const b of x.branches) {
      if (b.code === 'sf') continue;
      const d = daughterOf(x, b.code);
      expect(hasNuclide(d.z, d.n), `${x.z}-${x.n} ${b.code}`).toBe(true);
    }
});
it('needs an electron for a pure capture', () => {
  const be7 = getNuclide(4, 3)!, hg197 = getNuclide(80, 117)!, n13 = getNuclide(7, 6)!;
  expect(availableBranches(be7, 0)).toEqual([]);
  expect(availableBranches(be7, 4)).toEqual([{ code: 'ec', share: 1 }]);
  expect(playedMode(hg197, 'ec', 80)).toBe('ec');
  expect(playedMode(n13, 'ec/b+', 7)).toBe('b+');      // Q = 2220 keV > 1022
  expect(playedMode(n13, 'ec/b+', 0)).toBe('b+');
});
it('picks a branch and a lifetime', () => {
  const og = getNuclide(118, 176)!.branches;
  expect(pickBranch(og, 0).code).toBe('a');
  expect(pickBranch(og, 0.5).code).toBe('a');
  expect(pickBranch(og, 0.9).code).toBe('sf');
  expect(pickBranch(og, 0.999999).code).toBe('sf');
  expect(sampleLifetime(100, 0.5)).toBeCloseTo(100, 9);
  expect(sampleLifetime(null, 0.3)).toBe(0);
  expect(sampleLifetime('stable', 0.3)).toBe(0);
  expect(Number.isFinite(sampleLifetime(6.3e26, 0.999999))).toBe(true);
});
it('balances the energy', () => {
  expect(decayQ(getNuclide(1, 2)!, 'b-')).toBeCloseTo(18.59, 1);
  expect(decayQ(getNuclide(92, 146)!, 'a')).toBeCloseTo(4269.9, 0);
  expect(decayQ(getNuclide(2, 3)!, 'n')).toBeCloseTo(735.0, 0);
});

// reactions.test.ts
it('captures, evaporates, bounces', () => {
  expect(fire({ z: 1, n: 0 }, 'n')).toMatchObject({ kind: 'capture', product: { z: 1, n: 1 }, evaporated: 0 });
  expect((fire({ z: 1, n: 0 }, 'n') as { q: number }).q).toBeCloseTo(2224.57, 1);
  expect(fire({ z: 1, n: 0 }, 'p')).toMatchObject({ kind: 'pp', product: { z: 1, n: 1 } });
  expect((fire({ z: 1, n: 0 }, 'p') as { q: number }).q).toBeCloseTo(1442.2, 0);
  expect(fire({ z: 98, n: 151 }, 'ca48')).toMatchObject({ kind: 'capture', product: { z: 118, n: 176 }, evaporated: 3 });
  expect(fire({ z: 2, n: 2 }, 'alpha')).toMatchObject({ kind: 'capture', product: { z: 4, n: 4 } });
  expect(fire({ z: 2, n: 1 }, 'he3')).toMatchObject({ kind: 'capture', product: { z: 4, n: 2 } });
  expect(fire({ z: 118, n: 176 }, 'ca48')).toEqual({ kind: 'bounce' });
});
it('sums to the known D–T energy over capture and decay', () => {
  const capture = fire({ z: 1, n: 2 }, 'd') as { product: NuclideRef; q: number };
  expect(capture.product).toEqual({ z: 2, n: 3 });
  expect(capture.q + decayQ(getNuclide(2, 3)!, 'n')!).toBeCloseTo(17589, -1);   // ≈ 17,6 MeV
});
it('splits the four fissile nuclides the textbook way', () => {
  const u235 = fire({ z: 92, n: 143 }, 'n');
  expect(u235).toMatchObject({ kind: 'fission', fission: { heavy: { z: 56, n: 85 }, light: { z: 36, n: 56 }, neutrons: 3, preset: true } });
  expect((u235 as { fission: Fission }).fission.q! / 1000).toBeCloseTo(173.3, 0);
  for (const [z, n] of [[92, 141], [92, 143], [94, 145], [94, 147]] as const) {
    const r = fire({ z, n }, 'n');
    if (r.kind !== 'fission') throw new Error('expected fission');
    const f = r.fission;
    expect(f.heavy.z + f.light.z).toBe(z);
    expect(f.heavy.z + f.heavy.n + f.light.z + f.light.n + f.neutrons).toBe(z + n + 1);
    expect(hasNuclide(f.heavy.z, f.heavy.n) && hasNuclide(f.light.z, f.light.n)).toBe(true);
  }
  expect(fire({ z: 92, n: 146 }, 'n')).toMatchObject({ kind: 'capture', product: { z: 92, n: 147 } });   // ²³⁸U не ділиться
});
it('finds fragments for every nuclide with a spontaneous-fission branch', () => {
  const sf = allNuclides().filter((x) => x.branches.some((b) => b.code === 'sf'));
  expect(sf.length).toBeGreaterThan(100);
  for (const x of sf) {
    const f = spontaneousFission(x);
    expect(f, `${x.z}-${x.n}`).not.toBeNull();
    expect(f!.heavy.z + f!.light.z).toBe(x.z);
    expect(f!.neutrons).toBeGreaterThanOrEqual(0);
    expect(hasNuclide(f!.heavy.z, f!.heavy.n) && hasNuclide(f!.light.z, f!.light.n)).toBe(true);
  }
});
it('knocks nucleons out, but never below hydrogen or off the table', () => {    // Review Focus 4
  expect(knockOut({ z: 82, n: 126 }, 'p')).toMatchObject({ product: { z: 81, n: 126 } });
  expect(knockOut({ z: 82, n: 126 }, 'p')!.q).toBeCloseTo(-8003, 0);
  expect(knockOut({ z: 82, n: 126 }, 'n')!.q).toBeCloseTo(-7368, 0);
  expect(knockOut({ z: 1, n: 0 }, 'p')).toBeNull();
  expect(knockOut({ z: 1, n: 0 }, 'n')).toBeNull();
  expect(knockOut({ z: 118, n: 176 }, 'n')).toBeNull();
});
```

- [ ] **Step 2: Запустити — FAIL** (`pnpm vitest run src/volumes/alchemy/sim/lab`).
- [ ] **Step 3: Написати `decay.ts`, `reactions.ts`, `index.ts`** за таблицями й правилами вище.
- [ ] **Step 4: Запустити все**

Run: `cd app && pnpm vitest run src/volumes/alchemy && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(alchemy): decays, projectiles, gamma knock-out, fission, energy balance"`.

---

### Task 4: Стан гри — інструменти, ходи, електрони, вибір уламка

**Files:**
- Create: `app/src/volumes/alchemy/sim/lab/game.ts`; доповнити `sim/lab/index.ts`
- Test: `app/src/volumes/alchemy/sim/lab/__tests__/game.test.ts`

**Interfaces:**
- Consumes: усе з завдання 3; `getNuclide`.
- Produces:

```ts
export type ToolId = ProjectileId | 'gamma-n' | 'gamma-p' | 'wait';
export type Refusal = 'stable' | 'notObserved' | 'noData' | 'needsElectron' | 'noProduct' | 'pending';
export type GameEvent =
  | { readonly type: 'capture'; readonly projectile: ProjectileId; readonly from: NuclideRef; readonly to: NuclideRef;
      readonly evaporated: number; readonly pp: boolean; readonly q: number | null }
  | { readonly type: 'bounce'; readonly projectile: ProjectileId }
  | { readonly type: 'knockOut'; readonly what: 'n' | 'p'; readonly from: NuclideRef; readonly to: NuclideRef; readonly q: number | null }
  | { readonly type: 'decay'; readonly mode: Exclude<PlayedMode, 'sf'>; readonly from: NuclideRef; readonly to: NuclideRef;
      readonly seconds: number; readonly q: number | null; readonly auto: boolean }
  | { readonly type: 'fission'; readonly from: NuclideRef; readonly fission: Fission; readonly induced: boolean;
      readonly seconds: number; readonly auto: boolean }
  | { readonly type: 'fragment'; readonly to: NuclideRef }
  | { readonly type: 'electrons'; readonly from: number; readonly to: number }
  | { readonly type: 'refused'; readonly tool: ToolId | 'fragment'; readonly reason: Refusal };
export interface GameState {
  readonly z: number; readonly n: number; readonly electrons: number;
  readonly elapsedSeconds: number; readonly moves: number;
  readonly history: readonly NuclideRef[];        // усі нукліди, якими був атом, зі стартовим; поточний — останній
  readonly pending: Fission | null;               // чекаємо, який уламок обере гравець
  readonly fissioned: boolean;                    // у цьому забігу був поділ
  readonly shed: number;                          // скільки електронів відлетіло під час останньої дії
}
export interface Turn { readonly state: GameState; readonly event: GameEvent }
export function startGame(z: number, n: number): GameState;                     // нейтральний атом, лічильники 0
export function fireAt(state: GameState, projectile: ProjectileId): Turn;
export function knock(state: GameState, what: 'n' | 'p'): Turn;
export function waitForDecay(state: GameState, uTime: number, uBranch: number): Turn;
export function autoDecay(state: GameState, uTime: number, uBranch: number): Turn;   // те саме, але не хід
export function chooseFragment(state: GameState, which: 'heavy' | 'light'): Turn;
export function setElectrons(state: GameState, count: number): Turn;
export function isFleeting(state: GameState): boolean;        // статус 'fleeting' і немає pending
export function waitRefusal(state: GameState): Refusal | null; // чому «Чекати» зараз не спрацює
```

Правила:
- Хід (+1 до `moves`): `capture`, `knockOut`, `decay` від `waitForDecay`, `fission` (і від пострілу, і від
  `waitForDecay`). Не хід: `bounce`, `refused`, `electrons`, `fragment`, усе від `autoDecay`.
- Поки `pending !== null`, усі функції, крім `chooseFragment`, повертають `refused` з `'pending'` і той самий стан.
- `waitForDecay` / `autoDecay`: гілки — `availableBranches(нуклід, electrons)`. Порожньо →
  `refused`: `'stable'` для статусу `stable`; `'notObserved'` для `longLived` без гілок; `'needsElectron'`,
  якщо в нукліда гілки є, але без електронів жодна не можлива; інакше `'noData'`. Інакше:
  `seconds = sampleLifetime(halfLife, uTime)`, гілка — `pickBranch(гілки, uBranch)`; `sf` →
  `spontaneousFission` і `pending`; решта → дочірній нуклід.
- Електрони після перетворення: `electrons − ELECTRONS_USED[mode]`, потім обрізати до
  `0…maxElectrons(Z_new)`; `shed` — скільки обрізано. Після `chooseFragment` — `electrons = Z` уламка.
  `setElectrons` обрізає до `0…maxElectrons(Z)`.
- `elapsedSeconds` росте на `seconds` і лишається скінченним (обрізати до `Number.MAX_VALUE`).
- `history` отримує новий нуклід після кожної зміни `(z, n)`; `chooseFragment` додає уламок.

- [ ] **Step 1: Написати тест, що падає** — `game.test.ts`

```ts
const at = (z: number, n: number) => startGame(z, n);
it('counts moves only for transformations', () => {
  let t = fireAt(at(1, 0), 'n');
  expect(t.state).toMatchObject({ z: 1, n: 1, moves: 1, electrons: 1 });
  t = fireAt(t.state, 'n');
  t = waitForDecay(t.state, 0.5, 0);
  expect(t.event).toMatchObject({ type: 'decay', mode: 'b-', auto: false, to: { z: 2, n: 1 } });
  expect(t.state).toMatchObject({ z: 2, n: 1, moves: 3, electrons: 1 });           // ³He⁺: електрон не додався
  expect(t.state.elapsedSeconds).toBeCloseTo(388781328, -2);
  expect(t.state.history).toEqual([{ z: 1, n: 0 }, { z: 1, n: 1 }, { z: 1, n: 2 }, { z: 2, n: 1 }]);
  expect(fireAt(at(118, 176), 'ca48').state.moves).toBe(0);                        // відскок
  expect(setElectrons(at(6, 6), 3).state.moves).toBe(0);
  expect(autoDecay(at(4, 4), 0.5, 0).state).toMatchObject({ z: 2, n: 2, moves: 0 });
});
it('refuses to wait with a reason', () => {
  expect(waitForDecay(at(79, 118), 0.5, 0).event).toEqual({ type: 'refused', tool: 'wait', reason: 'stable' });
  expect(waitForDecay(at(82, 122), 0.5, 0).event).toMatchObject({ reason: 'notObserved' });
  expect(waitForDecay(setElectrons(at(4, 3), 0).state, 0.5, 0).event).toMatchObject({ reason: 'needsElectron' });
  expect(waitRefusal(at(79, 118))).toBe('stable');
  expect(waitRefusal(at(6, 8))).toBeNull();
});
it('uses up the captured electron and sheds the surplus', () => {                   // Review Focus 4
  const hg = waitForDecay(fireAt(at(80, 116), 'n').state, 0.5, 0);
  expect(hg.state).toMatchObject({ z: 79, n: 118, electrons: 79, shed: 0 });        // нейтральне золото
  const anion = setElectrons(at(84, 126), 85).state;                                 // ²¹⁰Po⁻
  expect(waitForDecay(anion, 0.5, 0).state).toMatchObject({ z: 82, n: 124, electrons: 83, shed: 2 });
  expect(setElectrons(at(1, 0), 99).state.electrons).toBe(2);
  expect(setElectrons(at(1, 0), -5).state.electrons).toBe(0);
});
it('holds everything until a fragment is chosen', () => {                           // Review Focus 2
  const split = fireAt(at(92, 143), 'n');
  expect(split.event).toMatchObject({ type: 'fission', induced: true });
  expect(split.state).toMatchObject({ z: 92, n: 143, moves: 1, fissioned: true });
  expect(split.state.pending).not.toBeNull();
  for (const turn of [fireAt(split.state, 'n'), knock(split.state, 'n'), waitForDecay(split.state, 0.5, 0),
                      autoDecay(split.state, 0.5, 0), setElectrons(split.state, 0)]) {
    expect(turn.event).toMatchObject({ type: 'refused', reason: 'pending' });
    expect(turn.state).toBe(split.state);
  }
  const picked = chooseFragment(split.state, 'heavy');
  expect(picked.state).toMatchObject({ z: 56, n: 85, electrons: 56, pending: null, moves: 1, fissioned: true });
  expect(chooseFragment(picked.state, 'light').event).toMatchObject({ type: 'refused' });
  expect(isFleeting(split.state)).toBe(false);
});
it('takes the rare branch when the dice say so', () => {
  expect(waitForDecay(at(118, 176), 0.5, 0.95).event).toMatchObject({ type: 'fission', induced: false });
  expect(isFleeting(at(4, 4))).toBe(true);
  expect(isFleeting(at(6, 8))).toBe(false);
});
it('keeps the clock finite', () => {                                                // Review Focus 5
  let s = at(83, 126);
  s = waitForDecay(s, 0.999999999, 0).state;
  expect(Number.isFinite(s.elapsedSeconds)).toBe(true);
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати `game.ts`.**
- [ ] **Step 4: Запустити — PASS**; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(alchemy): game state, tools, moves, electrons, fission choice"`.

---

### Task 5: Квести й доказ, що кожен розв'язний

**Files:**
- Create: `app/src/volumes/alchemy/sim/lab/quests.ts`, `solver.ts`; доповнити `index.ts`
- Test: `app/src/volumes/alchemy/sim/lab/__tests__/quests.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ToolId`, `fire`, `knockOut`, `availableBranches`, `spontaneousFission`, `getNuclide`.
- Produces:

```ts
export const QUEST_IDS = ['heavy-hydrogen', 'radiocarbon', 'sun', 'star-forge', 'mercury-gold', 'technetium',
  'plutonium', 'fission', 'uranium-chain', 'lead-gold', 'superheavy'] as const;
export type QuestId = (typeof QUEST_IDS)[number];
export type Goal =
  | { readonly kind: 'nuclide'; readonly z: number; readonly n: number }
  | { readonly kind: 'element'; readonly z: number }
  | { readonly kind: 'stableFragment' };          // стабільний нуклід після поділу
export interface Quest { readonly id: QuestId; readonly start: NuclideRef; readonly tools: readonly ToolId[];
                         readonly goal: Goal; readonly par: number }
export const QUESTS: readonly Quest[];             // 11, у порядку кроків
export const ALL_TOOLS: readonly ToolId[];         // 8 снарядів, 'gamma-n', 'gamma-p', 'wait'
export const FREE_START: NuclideRef;               // { z: 1, n: 0 }
export function questById(id: string): Quest | undefined;
export function reached(goal: Goal, state: GameState): boolean;   // ніколи не true, поки pending
export function solve(quest: Quest, limit?: number): { readonly moves: number; readonly path: readonly string[] } | null;
```

Таблиця квестів (точні значення; `par` перевірено на знімку):

| id | старт (z, n) | інструменти | ціль | par | найкоротший шлях |
|---|---|---|---|---|---|
| `heavy-hydrogen` | 1, 0 | n, wait | нуклід 2, 1 | 3 | n, n, чекати |
| `radiocarbon` | 6, 6 | n, wait | нуклід 7, 7 | 3 | n, n, чекати |
| `sun` | 1, 0 | p, he3, wait | нуклід 2, 2 | 2 | p; ³He → ⁵Li, що сам розпадається на ⁴He |
| `star-forge` | 2, 2 | alpha, wait | нуклід 6, 6 | 2 | α → ⁸Be; α, поки ⁸Be живий |
| `mercury-gold` | 80, 116 | n, wait | нуклід 79, 118 | 2 | n, чекати |
| `technetium` | 42, 56 | n, d, wait | елемент 43 | 1 | ²H → ¹⁰⁰Tc |
| `plutonium` | 92, 146 | n, wait | нуклід 94, 145 | 3 | n, чекати, чекати |
| `fission` | 92, 143 | n, wait | стабільний уламок | 4 | n (уламок ¹⁴¹Ba), чекати ×3 → ¹⁴¹Pr |
| `uranium-chain` | 92, 146 | wait | нуклід 82, 124 | 13 | 14 розпадів; ²¹⁴Po розпадається сам |
| `lead-gold` | 82, 126 | gamma-n, gamma-p, wait | нуклід 79, 118 | 11 | 8 нейтронів і 3 протони в будь-якому дозволеному порядку |
| `superheavy` | 98, 151 | 8 снарядів, wait | елемент 118 | 1 | ⁴⁸Ca |

`solve` — пошук у ширину з вагами 0 і 1 по нуклідах (атом вважається нейтральним): інструмент квесту — ребро
ваги 1 (постріл → продукт; поділ → обидва уламки; γ → продукт; `wait` → дочірній нуклід **головної** гілки,
для `sf` — обидва уламки); самочинний розпад нетривкого нукліда — ребро ваги 0 за головною гілкою. Стан
пошуку — `(z, n, fissioned)`. `limit` за замовчуванням 16 ходів.

- [ ] **Step 1: Написати тест, що падає** — `quests.test.ts`

```ts
it('declares eleven quests with nuclides that exist', () => {
  expect(QUESTS.map((q) => q.id)).toEqual([...QUEST_IDS]);
  for (const q of QUESTS) {
    expect(hasNuclide(q.start.z, q.start.n), q.id).toBe(true);
    expect(q.tools.length).toBeGreaterThan(0);
    expect(reached(q.goal, startGame(q.start.z, q.start.n)), q.id).toBe(false);
  }
});
it.each(QUESTS.map((q) => [q.id, q] as const))('%s is solvable in exactly its par', (_id, quest) => {
  expect(solve(quest)?.moves).toBe(quest.par);
});
it('pins the pars', () => {
  expect(Object.fromEntries(QUESTS.map((q) => [q.id, q.par]))).toEqual({
    'heavy-hydrogen': 3, radiocarbon: 3, sun: 2, 'star-forge': 2, 'mercury-gold': 2, technetium: 1,
    plutonium: 3, fission: 4, 'uranium-chain': 13, 'lead-gold': 11, superheavy: 1,
  });
});
it('every way of waiting from ²³⁸U ends on ²⁰⁶Pb after 14 decays', () => {
  const ends = new Set<string>();
  const walk = (z: number, n: number, depth: number): void => {
    const branches = getNuclide(z, n)!.branches.filter((b) => b.code !== 'sf');
    if (branches.length === 0 || depth > 30) return void ends.add(`${z}-${n}@${depth}`);
    for (const b of branches) { const d = daughterOf({ z, n }, b.code as Exclude<DecayCode, 'sf'>); walk(d.z, d.n, depth + 1); }
  };
  walk(92, 146, 0);
  expect([...ends]).toEqual(['82-124@14']);
});
it('plays quest 1 and quest 8 through the real rules', () => {
  let s = startGame(1, 0);
  s = fireAt(s, 'n').state; s = fireAt(s, 'n').state; s = waitForDecay(s, 0.5, 0).state;
  expect(reached(questById('heavy-hydrogen')!.goal, s)).toBe(true);
  let f = fireAt(startGame(92, 143), 'n').state;
  expect(reached(questById('fission')!.goal, f)).toBe(false);          // ще не обрано уламок
  f = chooseFragment(f, 'heavy').state;
  for (let i = 0; i < 3; i++) f = waitForDecay(f, 0.5, 0).state;
  expect(f).toMatchObject({ z: 59, n: 82, moves: 4 });
  expect(reached(questById('fission')!.goal, f)).toBe(true);
  expect(reached({ kind: 'stableFragment' }, startGame(59, 82))).toBe(false);   // без поділу не рахується
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати `quests.ts` і `solver.ts`.**
- [ ] **Step 4: Запустити — PASS**; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(alchemy): eleven quests and a solver that proves each one"`.

---

### Task 6: Прогрес — що пам'ятаємо між відвідинами (чиста частина) і README моделі

**Files:**
- Create: `app/src/volumes/alchemy/sim/lab/progress.ts`, `app/src/volumes/alchemy/sim/lab/README.md`; доповнити `index.ts`
- Test: `app/src/volumes/alchemy/sim/lab/__tests__/progress.test.ts`

**Interfaces:**
- Consumes: `GameState`, `startGame`, `QuestId`, `QUEST_IDS`, `FREE_START`, `hasNuclide`, `nuclideKey`, `maxElectrons`.
- Produces:

```ts
export const PROGRESS_KEY = 'alchemy:v1';
export interface FreeSave { readonly z: number; readonly n: number; readonly electrons: number;
                            readonly elapsedSeconds: number; readonly moves: number }
export interface Progress {
  readonly discovered: readonly string[];                       // ключі nuclideKey
  readonly best: Readonly<Partial<Record<QuestId, number>>>;    // найменше число ходів
  readonly free: FreeSave | null;
  readonly rolls: number;                                       // лічильник відвідин для випадковості
}
export const EMPTY_PROGRESS: Progress;                          // { discovered: [], best: {}, free: null, rolls: 0 }
export function parseProgress(text: string | null): Progress;  // будь-яке сміття → чистий прогрес, ніколи не кидає
export function serializeProgress(p: Progress): string;
export function discover(p: Progress, z: number, n: number): Progress;        // той самий об'єкт, якщо вже відомо
export function recordBest(p: Progress, quest: QuestId, moves: number): Progress;   // лишає менше
export function saveFree(p: Progress, state: GameState): Progress;            // під час вибору уламка не зберігає
export function restoreFree(p: Progress): GameState;                          // немає збереження → startGame(FREE_START)
export function nextVisit(p: Progress): Progress;                             // rolls + 1
export function countDiscovered(p: Progress): { readonly elements: number; readonly nuclides: number };
```

- [ ] **Step 1: Написати тест, що падає** — `progress.test.ts`

```ts
it('survives garbage and foreign data', () => {                                  // Review Focus 1
  for (const bad of [null, '', 'not json', '42', '[]', 'null', '{"discovered":"x","best":7,"free":[]}'])
    expect(parseProgress(bad)).toEqual(EMPTY_PROGRESS);
  const mixed = JSON.stringify({ discovered: ['1-0', '999-1', 7, '2-0', '1-0'],
    best: { sun: 2, nope: 1, fission: 'x', radiocarbon: -3, plutonium: 2.5 },
    free: { z: 2, n: 0, electrons: 1, elapsedSeconds: 5, moves: 2 }, rolls: 'x', extra: true });
  expect(parseProgress(mixed)).toEqual({ discovered: ['1-0'], best: { sun: 2 }, free: null, rolls: 0 });
});
it('round-trips and counts', () => {
  let p = discover(discover(discover(EMPTY_PROGRESS, 1, 0), 1, 1), 79, 118);
  expect(discover(p, 1, 0)).toBe(p);
  expect(countDiscovered(p)).toEqual({ elements: 2, nuclides: 3 });
  p = recordBest(recordBest(recordBest(p, 'sun', 4), 'sun', 2), 'sun', 3);
  expect(p.best).toEqual({ sun: 2 });
  expect(parseProgress(serializeProgress(nextVisit(p)))).toEqual({ ...p, rolls: 1 });
});
it('restores the free lab or falls back to ¹H', () => {
  expect(restoreFree(EMPTY_PROGRESS)).toEqual(startGame(1, 0));
  const played = waitForDecay(fireAt(startGame(80, 116), 'n').state, 0.5, 0).state;   // ¹⁹⁷Au, 2 ходи
  const saved = saveFree(EMPTY_PROGRESS, played);
  expect(restoreFree(saved)).toMatchObject({ z: 79, n: 118, electrons: 79, moves: 2, pending: null });
  expect(restoreFree(saved).history).toEqual([{ z: 79, n: 118 }]);
  const splitting = fireAt(startGame(92, 143), 'n').state;                              // чекає вибору уламка
  expect(saveFree(saved, splitting)).toBe(saved);
  const hacked = parseProgress(JSON.stringify({ free: { z: 1, n: 0, electrons: 99, elapsedSeconds: -1, moves: 1e99 } }));
  expect(restoreFree(hacked)).toMatchObject({ z: 1, n: 0, electrons: 2 });
  expect(Number.isFinite(restoreFree(hacked).moves) && restoreFree(hacked).elapsedSeconds >= 0).toBe(true);
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати `progress.ts`.**
- [ ] **Step 4: Написати `sim/lab/README.md`** для того, хто будує сцену: що таке стан і подія; таблиця
  інструментів; і **список спрощень моделі** (кожне має з'явитись у чипах чи тексті кроку): час очікування
  пропускається; нетривке ядро в грі живе 2 s; `ec/b+` за порогом 1022 keV; чотири подільні нукліди діляться
  завжди (у природі ≈ 85 % захоплень) і завжди на ту саму пару уламків; спонтанний поділ — одна формула;
  «зайві» нейтрони випаровуються; гілки рідші за 0,01 % відкинуто; пороги й перерізи реакцій не враховано —
  енергія лише показник.
- [ ] **Step 5: Запустити — PASS**; `pnpm typecheck && pnpm lint`.
- [ ] **Step 6: Commit** — `git commit -m "feat(alchemy): progress that survives broken storage; model README"`.

---

### Task 7: Том `alchemy` і документ розділу `lab`

**Files:**
- Create: `app/src/volumes/alchemy/volume.json`, `volume.ts`, `chapters.ts` (копія `_demo/chapters.ts` без змін)
- Create: `docs/volumes/alchemy/CURRICULUM.md`, `docs/volumes/alchemy/chapters/lab.md`,
  `docs/volumes/alchemy/terms_allowlist.tsv`
- Generated (комітяться): `docs/volumes/alchemy/INDEX.md`, `GLOSSARY.md`, `chapters/_export/lab.json`,
  `chapters/_export/_hotspot-ids.tsv`; `app/src/volumes/alchemy/content/generated/lab.json`, `lab.manifest.json`
- Modify: `app/tsconfig.json` (`paths`: `"@alchemy/*": ["./src/volumes/alchemy/*"]`),
  `app/src/engine/__tests__/volumes.test.ts:30` (список стає `['_demo', '_dev', '_path', 'alchemy', 'circuit', 'electricity']`)

**Interfaces:**
- Consumes: числа з `nuclides.json` (кожне число в тексті — звідти).
- Produces: згенерований зміст розділу; ідентифікатори 12 кроків (`QUEST_IDS` + `free`) і hotspot-ів, на які
  спирається код завдань 8–15.

`volume.json` (на цьому кроці том — чернетка; публікується в завданні 8, коли є розділ):

```json
{
  "id": "alchemy",
  "title": "Ядерна алхімія",
  "subtitle": "Як один елемент стає іншим",
  "headline": "title",
  "kicker": "Гра-лабораторія",
  "lead": "Один атом і набір інструментів: нейтрони, протони, γ-кванти й терпіння. Кожне перетворення — за справжньою таблицею нуклідів.",
  "order": 3,
  "accent": "violet",
  "emblem": "star",
  "status": "draft",
  "axis": { "label": "Масштаб", "unit": "m", "hint": "Характерний масштаб розділу", "range": "10⁻¹⁸ m … 10⁻¹⁰ m" },
  "groups": [{ "id": "nucleus", "label": "Ядро", "part": "Частина I. Ядро" }],
  "journey": [{ "id": "lab", "group": "nucleus" }]
}
```

`volume.ts`: `defineVolume(identity, { journey: { axis: { min: -18, max: -10, origin: -14, tick: 1,
majorEvery: 2, format: (exp) => fmtScale(exp), ascending: 'out' }, emblems: { nucleus: 'micro' } },
glossary: { scope: 'volume' }, theme: { sky: 'micro', mood: 'micro' } })`.

**Документ `lab.md`** — формат як у `docs/volumes/_demo/chapters/wave.md`; правила, які перевіряє код:

- Перший рядок `# lab — Лабораторія перетворень`; далі рядок
  ``**Група:** Ядро · **Масштаб:** 10⁻¹⁴ m · **Кроків:** 12 · **Акцентний колір/настрій:** `violet` (домінанта) + `cyan`; «внутрішній космос».``
- Розділи в цьому порядку: `## Навчальні цілі` (нумерований список), `## Наскрізна візуальна ідея`,
  `## Кроки`, `## Модель симуляції`, `## Глосарій розділу`, `## Міні-квіз`, `## Примітки щодо фактів`,
  `## Перехресні посилання` (останній; таблиця з одним рядком
  `| — | — | у тексті розділу немає посилань на кроки інших розділів |`).
- Крок: ``### N. `id` — Назва``; поля лише з переліку: Бачимо, Текст панелі, Терміни, Формули, Цифри і
  факти, Інтерактив, Hotspots, Хибні уявлення, Перехід. Обов'язкові: Бачимо, Текст панелі, Інтерактив.
  Поле «Просто» не пишемо (уточнення 12).
- Сторінка панелі ≤ 450 знаків; 1–3 сторінки на крок.
- Одиниці після числа — латиницею (`2 s`, `23,45 min`, `64,14 h`, `8 MeV`); «р.», «доба / доби / діб» —
  українською. Десяткова кома. Без кодових проміжків виду `` `n/p` `` і без слів «чернетка», `TODO`.
- У «Хибних уявленнях» слова про сцену (кнопка, камера, анімація, перемикач, вкладка) — лише в кінцевих
  дужках `[Сцена: …]`.
- Hotspot: `- **Назва** {#id}: «текст»`. Ідентифікатори зафіксовані (реєстр лише росте):
  крок 1 — `nucleus`, `shells`, `emitter`; крок 4 — `countdown`; крок 8 — `fragments`.
- «Інтерактив»: підписи елементів керування в лапках «…», однаково в усіх кроках, де вони є:
  «Вистрілити», «γ: вибити нейтрон», «γ: вибити протон», «Чекати на розпад», «Почати знову»,
  «Нейтралізувати», «Продовжити з важким уламком», «Продовжити з легким уламком», «Уся карта»,
  «Новий старт», «Взяти як старт», «Скасувати», «Почати звідси». Код бере їх з експорту, не набирає вдруге.
- Глосарій: рядок заголовка `| International | Українською | Позначення | Одиниця | Визначення |`; у колонці
  International — слова, а не символи (`Beta-minus decay`, `Electron capture`, `Half-life`, `Nuclide`,
  `Isotope`, `Alpha decay`, `Fission`, `Fusion`, `Gamma quantum`, `Binding energy`), бо ключ терміна
  будується лише з літер.
- Міні-квіз: 3 питання; `N. **Питання?**`, варіанти `а) …; б) …; в) …`, правильний позначено `✔`,
  далі `_Пояснення:_ …`. Знак `✔` більше ніде не вживати.

Зміст кроків (назви — з дизайну §5.2; числа — з таблиці, перевірені на знімку; кожне, якого немає в
таблиці, іде в «Примітки щодо фактів» з джерелом рівня підручника):

| № | id | Що гравець має зрозуміти | Числа й факти для тексту |
|---|---|---|---|
| 1 | `heavy-hydrogen` | нейтрон додає масу, але не міняє елемент; β⁻-розпад міняє | ²H стабільний, 0,0145 % природного водню; ³H: T½ = 12,32 р., β⁻ → ³He; ¹H + n виділяє 2,22 MeV |
| 2 | `radiocarbon` | період напіврозпаду; радіовуглецеве датування | ¹³C стабільний, 1,06 %; ¹⁴C: T½ = 5700 р., β⁻ → ¹⁴N |
| 3 | `sun` | злиття легких ядер дає енергію | p + p → ²H (1,44 MeV разом з анігіляцією позитрона); ²H + p → ³He; ³He + ³He → ⁶Be → ⁴He + 2p; коротший шлях ²H + ³He → ⁵Li → ⁴He + p |
| 4 | `star-forge` | вузьке місце зір: ⁸Be живе мить | α + α → ⁸Be потребує 92 keV; ⁸Be: T½ ≈ 8,2×10⁻¹⁷ s; ⁸Be + α → ¹²C виділяє 7,37 MeV; у грі ⁸Be живе 2 s |
| 5 | `mercury-gold` | захоплення електрона зсуває елемент на один назад | ¹⁹⁶Hg — 0,15 % природної ртуті; ¹⁹⁷Hg: T½ = 64,14 h, захоплення електрона → ¹⁹⁷Au; ¹⁹⁷Au — єдиний стабільний ізотоп золота |
| 6 | `technetium` | елемент без стабільних ізотопів, уперше зроблений штучно | ⁹⁸Mo — 24,3 % природного молібдену; ⁹⁸Mo + ²H → ¹⁰⁰Tc (T½ = 15,65 s); ⁹⁹Mo: T½ = 65,9 h, β⁻ → ⁹⁹Tc (T½ = 211 тис. р.); 1937, молібден і дейтрони — у примітки |
| 7 | `plutonium` | за ураном: нейтрон і два β⁻-розпади | ²³⁹U: 23,45 min → ²³⁹Np: 2,356 доби → ²³⁹Pu: T½ = 24,1 тис. р. |
| 8 | `fission` | важке ядро рветься на два, уламки радіоактивні | ²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n, ≈ 173 MeV; ¹⁴¹Ba: 18,27 min → ¹⁴¹La: 3,92 h → ¹⁴¹Ce: 32,5 доби → ¹⁴¹Pr стабільний; у природі ділиться ≈ 85 % ядер, що захопили нейтрон, — у примітки |
| 9 | `uranium-chain` | ланцюжок розпадів веде до стабільного свинцю | ²³⁸U: T½ = 4,47 млрд р.; 14 розпадів (8 α і 6 β⁻) до ²⁰⁶Pb; ²²⁶Ra: 1600 р.; ²²²Rn: 3,82 доби; ²¹⁴Po: 163 μs |
| 10 | `lead-gold` | мрія алхіміків здійсненна, але дорога | вибити протон з ²⁰⁸Pb — ≈ 8,0 MeV, нейтрон — ≈ 7,4 MeV; ²⁰⁵Au живе 32 s; до стабільного ¹⁹⁷Au — 3 протони й 8 нейтронів |
| 11 | `superheavy` | край таблиці: ядра, що живуть мілісекунди | ²⁴⁹Cf + ⁴⁸Ca → ²⁹⁴Og + 3n; потрібно ≈ 198 MeV; ²⁹⁴Og: T½ = 0,58 ms; відкрито 2004 (за знімком) |
| 12 | `free` | усі інструменти, карта як колекція | 3383 нукліди 118 елементів; 244 стабільні; 288 трапляються в природі |

Текст кроку називає мету («Перетвори ¹H на ³He») і підказує перший хід, але не диктує весь шлях. Про поділ —
лише фізика перетворення (анти-ціль дизайну). `CURRICULUM.md`: вступ (том — відгалуження курсу, гра), вісь
(масштаб, `10ⁿ m`, −18…−10), таблиця розділів (`№ | Розділ | Назва | Група | Масштаб | Кроків`), рішення тому
(уточнення 1–16 цього плану одним списком).

- [ ] **Step 1: Скелет тому.** Створити `volume.json`, `volume.ts`, `chapters.ts`; рядок у `app/tsconfig.json`;
  назву теки в `volumes.test.ts`.
- [ ] **Step 2: Написати `CURRICULUM.md` і `chapters/lab.md`** за правилами й таблицею вище.
- [ ] **Step 3: Список латинських слів і файл винятків**

Run: `python3 tools/content/terms_check.py --volume alchemy --list-latin`
Кожне слово, якого немає в `tools/content/terms_allowlist.tsv`, додати в
`docs/volumes/alchemy/terms_allowlist.tsv` рядком з чотирьох клітинок через TAB:
`Og<TAB>symbol<TAB>—<TAB>символ хімічного елемента` (так само `Cf`, `Tc`, `Mo`, `Be`, `Ba`, `Np`, `Rn`, `Po`,
`Bi`, `Tl`, `Xe`, `Ce`, `Pr` — ті, що справді вжиті; слово, яке вже є в загальному списку, сюди не дублювати).

- [ ] **Step 4: Типографіка, посилання, генерація**

```bash
python3 tools/content/typography.py --write --volume alchemy
python3 tools/content/xref_check.py --write --volume alchemy
tools/content/regen.sh --volume alchemy
python3 tools/content/doccheck.py --all
```

Expected: `doccheck[alchemy]: ALL GREEN`, решта томів теж зелені. Якщо `regen.sh` обривається без пояснення —
`python3 tools/content/export_content.py --volume alchemy` покаже причину.

- [ ] **Step 5: Тести рушія**

Run: `cd app && pnpm vitest run src/engine/__tests__/volumes.test.ts && pnpm typecheck && pnpm lint && pnpm fonts:check`
Expected: PASS; `fonts:check` не знаходить символів без гліфа.

- [ ] **Step 6: Commit** — `git commit -m "feat(alchemy): volume identity and the chapter document «Лабораторія перетворень»"`.

---

### Task 8: Оболонка розділу, публікація тому, середовище перевірок

**Files:**
- Create: `app/src/volumes/alchemy/chapters/lab/index.ts`, `content.ts`, `chapter.ts`, `labels.ts`, `shots.ts`,
  `scene.ts`, `README.md`
- Test: `app/src/volumes/alchemy/chapters/lab/__tests__/manifest.test.ts`
- Modify: `app/src/volumes/alchemy/volume.json` (`"status": "published"`, додати
  `"aside": { "label": "Відгалуження: Ядерна алхімія" }`)

**Interfaces:**
- Consumes: `@alchemy/content/generated/lab.json`, `lab.manifest.json`; `QUEST_IDS`.
- Produces:

```ts
// chapter.ts
export const STEP_IDS = [...QUEST_IDS, 'free'] as const;   // 12; порядок = порядок кроків документа
export type StepId = (typeof STEP_IDS)[number];
// labels.ts
export const L: { /* згруповані підписи */ };
export const FLAT_LABELS: Record<string, string>;
// shots.ts
export const SHOTS: { lab: Shot; fission: Shot };          // кожен з `fit`
```

Зразки: `electricity/chapters/atom/{index,content,chapter,labels,shots}.ts` (читати, не імпортувати).
`index.ts`: `defineChapter({ id: 'lab', order: meta.order, group: 'nucleus', ...manifestText(meta),
axisValue: -14, theme: { accent: 'violet', sky: 'micro', mood: 'micro' }, load: () => import('./scene') })` —
нічого з `sim` чи `lab.json` тут не імпортувати (маніфест має лишатись крихітним). `labels.ts`: підписи, які
документ цитує в «Інтерактив», беруться функцією `doc(step, wording)` з експорту (як у `atom/labels.ts`);
решта — тут, простою українською. `scene.ts` на цьому кроці: `ctx.env.setScale(6)`, `ctx.camera.shots(SHOTS)`,
`stage.define` для всіх 12 кроків з `camera: 'lab'` і порожнім `show`; атом з'явиться в завданні 11.

- [ ] **Step 1: Написати тест, що падає** — `manifest.test.ts`

```ts
it('lists the steps of the document, in order', () => {
  expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
  expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
  expect([...STEP_IDS]).toEqual([...QUEST_IDS, 'free']);
  expect(manifest).toMatchObject({ id: 'lab', group: 'nucleus', title: raw.title, axisValue: -14 });
  for (const step of manifest.steps) expect(step.blurb.length).toBeGreaterThan(10);
});
it('takes the document captions from the export', () => {
  const exported = new Set(raw.steps.flatMap((s) => s.labels ?? []));
  for (const text of [L.tools.fire, L.tools.gammaN, L.tools.gammaP, L.tools.wait, L.tools.restart, L.tools.neutral,
                      L.fission.heavy, L.fission.light, L.chart.full, L.free.newStart, L.free.take, L.free.cancel, L.free.startHere])
    expect(exported.has(text), text).toBe(true);
  for (const [key, text] of Object.entries(FLAT_LABELS)) expect(text.trim(), key).not.toBe('');
});
it('declares the subject bounds on every shot', () => {
  for (const [name, shot] of Object.entries(SHOTS)) expect(shot.fit, name).toBeDefined();
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати файли розділу; у `volume.json` поставити `published` і `aside`.**
- [ ] **Step 4: Тести й збірка**

Run: `cd app && pnpm vitest run src/volumes/alchemy src/engine/__tests__/volumes.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS; збірка без помилок.

- [ ] **Step 5: Підготувати середовище перевірок** (один раз; далі всі завдання посилаються на «команди QA»)

```bash
command -v montage || export PATH="$PWD/qa-local/bin:$PATH"   # на цій машині немає ImageMagick
export QA_ALLOW_SOFTWARE=1 QA_PORT=5351
(cd app && pnpm preview --port 5351)                           # у фоні; після кожного `pnpm build` перезапустити
```

`qa-local/` не потрапляє в git. `qa-local/bin/{montage,identify,mogrify}` — заміна трьох команд ImageMagick
на Pillow для `tools/qa/sheet.sh` (вже лежить; якщо теки немає — або встановити ImageMagick, або відтворити
заміну: ті самі аргументи, що передає `sheet.sh`). Вивід перевірок — завжди `--out qa-local/alchemy/<назва>`.
Кадровий час на цій машині не перевіряється (рендер програмний): `chapter-check` запускати з `--skip perf`.

- [ ] **Step 6: Розділ відкривається, відгалуження видно з курсу**

```bash
node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud gl  --out qa-local/alchemy/shell-gl
node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud dom --out qa-local/alchemy/shell-dom
node tools/qa/library-check.mjs --out qa-local/alchemy/library
```

Expected: двічі `PASS alchemy/lab`; `PASS library-check` (серед рядків `ok` — кнопка `home-aside-alchemy`, що
веде на `#/alchemy/…`, і «рівно один опублікований том в основному потоці»).

- [ ] **Step 7: Commit** — `git commit -m "feat(alchemy): chapter shell; the volume is published as an aside of the course"`.

---

### Task 9: Числа словами — `parts/text.ts`

**Files:**
- Create: `app/src/volumes/alchemy/chapters/lab/parts/text.ts`; доповнити `labels.ts`
- Test: `app/src/volumes/alchemy/chapters/lab/__tests__/text.test.ts`

**Interfaces:**
- Consumes: `L` (підписи), `fmtNumber`, `fmtSci`, `plural`, `NBSP` з `@/content`; `Nuclide`, `GameState`,
  `GameEvent`, `PlayedMode`; `nuclideSymbol`, `ionSymbol`, `nuclideName`, `bindingPerNucleon`.
- Produces:

```ts
export type Tone = 'green' | 'amber' | 'red' | 'mist';
export function halfLifeText(seconds: number): string;
export function elapsedText(seconds: number): string;              // 0 → «0 s»
export function energyText(q: number | null): string;              // «виділилось ≈ 17,6 MeV» · «потрібно ≈ 8,0 MeV» · «—»
export function modeName(mode: PlayedMode): string;                // «β⁻-розпад», «захоплення електрона», «α-розпад», «поділ»…
export function statusLine(x: Nuclide): { readonly text: string; readonly tone: Tone };
export function chargeText(z: number, electrons: number): string;  // «0 — нейтральний атом» · «+2 e — катіон» · «−1 e — аніон»
export function cardRows(state: GameState): string[][];            // 4 рядки: Атом · Склад · Ядро · Заряд і зв'язок
export function eventLine(e: GameEvent): { readonly text: string; readonly tone: 'ok' | 'info' | 'warning' };
export function questDoneLine(moves: number, best: number): string; // «Виконано за 3 ходи (найкраще — 3)»
```

Правила `halfLifeText` (три значущі цифри, десяткова кома, нерозривний пробіл перед одиницею):
≥ 1 року (31 557 600 s): < 10⁴ р. → «12,3 р.»; < 10⁶ → «24,1 тис. р.»; < 10⁹ → «1,39 млн р.»; < 10¹² →
«4,47 млрд р.»; далі → `fmtSci` + « р.»; ≥ 1 доби → «53,2 доби» (ціле число — відмінок через `plural`
з «доба|доби|діб»); ≥ 3600 s → `h`; ≥ 60 s → `min`; ≥ 1 s → `s`; ≥ 10⁻³ → `ms`; ≥ 10⁻⁶ → `μs`; ≥ 10⁻⁹ →
`ns`; менше → `fmtSci` + ` s`; рівно 0 → «0 s» (в обох функціях). `energyText`: |q| ≥ 1000 keV → MeV (одна цифра після коми до 100 MeV, далі
ціле), інакше keV; знак передається словом. `statusLine`: `stable` → green; `longLived` → green (з T½, якщо
гілки є; без гілок — «розпаду не спостерігали»); `radioactive` → amber, з T½ і назвою головного розпаду;
`fleeting` → red; `incomplete` → mist.

- [ ] **Step 1: Написати тест, що падає** — `text.test.ts`

```ts
const s = (t: string) => t.replaceAll(NBSP, ' ');
it('writes half-lives across forty orders of magnitude', () => {                  // Review Focus 5
  expect(s(halfLifeText(388781328))).toBe('12,3 р.');
  expect(s(halfLifeText(179874478055))).toBe('5700 р.');
  expect(s(halfLifeText(7.608374852e11))).toBe('24,1 тис. р.');
  expect(s(halfLifeText(1.4099634525e17))).toBe('4,47 млрд р.');
  expect(s(halfLifeText(6.342942e26))).toBe('2,0×10¹⁹ р.');
  expect(s(halfLifeText(4598208))).toBe('53,2 доби');
  expect(s(halfLifeText(14112))).toBe('3,92 h');
  expect(s(halfLifeText(1096.2))).toBe('18,3 min');
  expect(s(halfLifeText(32))).toBe('32 s');
  expect(s(halfLifeText(0.00058))).toBe('0,58 ms');
  expect(s(halfLifeText(0.00016346))).toBe('163 μs');
  expect(s(halfLifeText(8.19e-17))).toBe('8,2×10⁻¹⁷ s');
  expect(s(halfLifeText(3.7e-22))).toBe('3,7×10⁻²² s');
});
it('never prints a broken number', () => {                                         // Review Focus 5
  for (const v of [0, 1e-30, 1, 1e30, 1e300, Number.MAX_VALUE])
    for (const text of [halfLifeText(v), elapsedText(v)]) expect(text).not.toMatch(/NaN|Infinity|e\+|e-/);
  expect(s(elapsedText(0))).toBe('0 s');
});
it('says released or needed', () => {
  expect(s(energyText(17589))).toBe('виділилось ≈ 17,6 MeV');
  expect(s(energyText(-8003))).toBe('потрібно ≈ 8,0 MeV');
  expect(s(energyText(18.59))).toBe('виділилось ≈ 18,6 keV');
  expect(s(energyText(-198036))).toBe('потрібно ≈ 198 MeV');
  expect(energyText(null)).toBe('—');
});
it('judges the nucleus', () => {
  expect(statusLine(getNuclide(79, 118)!).tone).toBe('green');
  expect(statusLine(getNuclide(82, 122)!).tone).toBe('green');
  const c14 = statusLine(getNuclide(6, 8)!);
  expect(c14.tone).toBe('amber');
  expect(s(c14.text)).toContain('5700 р.');
  expect(statusLine(getNuclide(4, 4)!).tone).toBe('red');
  expect(statusLine(getNuclide(3, 1)!).tone).toBe('red');                          // T½ невідомий — без «NaN»
  expect(statusLine(getNuclide(3, 1)!).text).not.toMatch(/NaN|null|undefined/);
});
it('fills the card and the event line', () => {
  const rows = cardRows(startGame(79, 118));
  expect(rows).toHaveLength(4);
  expect(rows[0]![1]).toBe('¹⁹⁷Au · Аурум (золото)-197');
  expect(rows[1]![1]).toBe('Z = 79 · N = 118 · A = 197');
  for (const turn of [fireAt(startGame(1, 0), 'n'), fireAt(startGame(118, 176), 'ca48'), knock(startGame(1, 0), 'p'),
                      waitForDecay(startGame(79, 118), 0.5, 0), fireAt(startGame(92, 143), 'n')])
    expect(eventLine(turn.event).text.length).toBeGreaterThan(5);
  expect(questDoneLine(3, 3)).toBe('Виконано за 3 ходи (найкраще — 3)');
  expect(questDoneLine(13, 11)).toBe('Виконано за 13 ходів (найкраще — 11)');
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати `text.ts`; слова — в `labels.ts`.**
- [ ] **Step 4: Запустити — PASS**; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(alchemy): half-lives, energies and events in words"`.

---

### Task 10: Сесія гри й сховище

**Files:**
- Create: `app/src/volumes/alchemy/chapters/lab/parts/session.ts`, `parts/storage.ts`
- Test: `app/src/volumes/alchemy/chapters/lab/__tests__/session.test.ts`, `storage.test.ts`

**Interfaces:**
- Consumes: усе з `@alchemy/sim/lab`; `StepId`.
- Produces:

```ts
// storage.ts — єдине місце, що торкається localStorage
export function loadProgress(): Progress;              // немає window / сховище кидає / сміття → EMPTY_PROGRESS
export function saveProgress(p: Progress): void;       // ніколи не кидає

// session.ts — без three.js і без DOM
export const FLEETING_DELAY_S = 2;
export interface SessionDeps { readonly random: () => number; readonly load: () => Progress; readonly save: (p: Progress) => void }
export type SessionEvent =
  | { readonly type: 'reset'; readonly state: GameState }
  | { readonly type: 'turn'; readonly event: GameEvent; readonly before: GameState; readonly after: GameState }
  | { readonly type: 'done'; readonly moves: number; readonly best: number; readonly improved: boolean };
export class Session {
  constructor(deps: SessionDeps);
  readonly step: StepId;                  // після першого enter()
  readonly quest: Quest | null;           // null у кроці 'free'
  readonly state: GameState;
  readonly tools: readonly ToolId[];
  readonly countdown: number | null;      // секунд до самочинного розпаду нетривкого ядра
  readonly done: boolean;                 // ціль квесту досягнута в цьому забігу
  readonly best: number | null;
  readonly lastQ: number | null;          // енергія останнього перетворення, keV
  readonly progress: Progress;
  enter(step: StepId): void;              // квест → стартовий нуклід; 'free' → збережений стан
  allowed(tool: ToolId): boolean;
  fire(projectile: ProjectileId): void;
  knock(what: 'n' | 'p'): void;
  wait(): void;
  pickFragment(which: 'heavy' | 'light'): void;
  setElectrons(count: number): void;
  neutralise(): void;
  restart(): void;                        // квест → старт квесту; 'free' → ¹H
  startFrom(z: number, n: number): boolean;   // лише в 'free' і лише природний нуклід
  update(dt: number): void;               // відлік; у нулі — autoDecay
  on(listener: (e: SessionEvent) => void): () => void;
}
```

Правила: недозволений інструмент нічого не міняє й дає `turn` з `refused`. Після кожної зміни нукліда —
`discover` і `save` (у `free` ще й `saveFree`). Відлік: щойно стан стає нетривким (і немає `pending`),
`countdown = FLEETING_DELAY_S`; `update(dt)` зменшує; у нулі — `autoDecay`, і якщо новий стан теж нетривкий,
відлік починається знову з повних 2 s (залишок кадру не переноситься; за один `update` — не більше одного розпаду). Будь-яка дія гравця, що змінила нуклід, скидає відлік. `enter` скидає відлік, `done`
і `lastQ`. Ціль перевіряється після кожного `turn`; `done` виставляється один раз за забіг і записує
`recordBest`. Виняток у `save` ковтається. Два числа для `waitForDecay` / `autoDecay` — два виклики `random()`.

- [ ] **Step 1: Написати тести, що падають**

```ts
// session.test.ts
const make = (saved: Progress = EMPTY_PROGRESS, rolls: number[] = [0.5, 0]) => {
  let stored = saved; let i = 0;
  const session = new Session({ random: () => rolls[i++ % rolls.length]!, load: () => stored, save: (p) => { stored = p; } });
  return { session, stored: () => stored };
};
it('resets a quest on every entry', () => {
  const { session } = make();
  session.enter('heavy-hydrogen'); session.fire('n');
  expect(session.state).toMatchObject({ z: 1, n: 1, moves: 1 });
  session.enter('radiocarbon');
  expect(session.state).toMatchObject({ z: 6, n: 6, moves: 0 });
  session.enter('heavy-hydrogen');
  expect(session.state).toMatchObject({ z: 1, n: 0, moves: 0 });
});
it('offers only the tools of the quest', () => {
  const { session } = make();
  session.enter('heavy-hydrogen');
  expect([session.allowed('n'), session.allowed('wait'), session.allowed('p'), session.allowed('gamma-n')]).toEqual([true, true, false, false]);
  session.fire('p');
  expect(session.state).toMatchObject({ z: 1, n: 0, moves: 0 });
  session.enter('free');
  expect(ALL_TOOLS.every((t) => session.allowed(t))).toBe(true);
});
it('completes a quest once and remembers the best', () => {
  const { session, stored } = make();
  const seen: SessionEvent[] = [];
  session.on((e) => seen.push(e));
  session.enter('heavy-hydrogen'); session.fire('n'); session.fire('n'); session.wait();
  expect(session).toMatchObject({ done: true, best: 3 });
  expect(seen.filter((e) => e.type === 'done')).toEqual([{ type: 'done', moves: 3, best: 3, improved: true }]);
  expect(stored().best).toEqual({ 'heavy-hydrogen': 3 });
  session.restart();
  expect(session).toMatchObject({ done: false, best: 3 });
  expect(session.state.moves).toBe(0);
});
it('lets a fleeting nucleus live two seconds', () => {
  const { session } = make();
  session.enter('star-forge'); session.fire('alpha');
  expect(session.state).toMatchObject({ z: 4, n: 4 });
  expect(session.countdown).toBeCloseTo(2, 6);
  session.update(1.9);
  expect(session.state.z).toBe(4);
  session.update(0.2);
  expect(session.state).toMatchObject({ z: 2, n: 2, moves: 1 });
  expect(session.countdown).toBeNull();
});
it('applies the shot, not the decay, when both fall into one frame', () => {       // Review Focus 2
  const { session } = make();
  session.enter('star-forge'); session.fire('alpha'); session.update(1.99);
  session.fire('alpha'); session.update(0.5);
  expect(session.state).toMatchObject({ z: 6, n: 6, moves: 2 });
  expect(session.done).toBe(true);
});
it('drops the countdown and a pending fission when the step is left', () => {      // Review Focus 3
  const { session } = make();
  session.enter('star-forge'); session.fire('alpha'); session.enter('uranium-chain'); session.update(5);
  expect(session.state).toMatchObject({ z: 92, n: 146, moves: 0 });
  expect(session.countdown).toBeNull();
  session.enter('fission'); session.fire('n');
  expect(session.state.pending).not.toBeNull();
  session.enter('fission');
  expect(session.state).toMatchObject({ z: 92, n: 143, pending: null, moves: 0 });
});
it('walks down from oganesson one countdown at a time', () => {
  const { session } = make();                                   // гілка 0 → α
  session.enter('superheavy'); session.fire('ca48');
  expect(session.done).toBe(true);
  session.update(2.1);
  expect(session.state).toMatchObject({ z: 116, n: 174, moves: 1 });
  expect(session.countdown).toBeCloseTo(2, 6);
});
it('keeps the free lab and the collection across sessions', () => {
  const first = make();
  first.session.enter('free'); first.session.fire('n');
  expect(first.stored().free).toMatchObject({ z: 1, n: 1 });
  expect(first.stored().discovered).toEqual(['1-0', '1-1']);
  const second = make(first.stored());
  second.session.enter('free');
  expect(second.session.state).toMatchObject({ z: 1, n: 1, moves: 1 });
});
it('starts the free lab only from a natural nuclide', () => {
  const { session } = make();
  session.enter('free');
  expect(session.startFrom(79, 118)).toBe(true);
  expect(session.state).toMatchObject({ z: 79, n: 118, moves: 0 });
  expect(session.startFrom(43, 56)).toBe(false);                 // ⁹⁹Tc у природі немає
  session.enter('sun');
  expect(session.startFrom(79, 118)).toBe(false);
});
it('plays on when saving fails', () => {                                           // Review Focus 1
  const session = new Session({ random: () => 0.5, load: () => EMPTY_PROGRESS, save: () => { throw new Error('quota'); } });
  session.enter('free');
  expect(() => session.fire('n')).not.toThrow();
  expect(session.state.n).toBe(1);
});

// storage.test.ts                                                                 // Review Focus 1
afterEach(() => vi.unstubAllGlobals());
it('answers with empty progress when there is no window', () => {
  expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  expect(() => saveProgress(EMPTY_PROGRESS)).not.toThrow();
});
it('answers with empty progress when the storage throws', () => {
  vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('denied'); } });
  expect(loadProgress()).toEqual(EMPTY_PROGRESS);
  expect(() => saveProgress(EMPTY_PROGRESS)).not.toThrow();
});
it('round-trips under the key alchemy:v1', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } });
  saveProgress(discover(EMPTY_PROGRESS, 1, 0));
  expect([...data.keys()]).toEqual(['alchemy:v1']);
  expect(loadProgress().discovered).toEqual(['1-0']);
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати `storage.ts` і `session.ts`.**
- [ ] **Step 4: Запустити — PASS**; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `git commit -m "feat(alchemy): game session with countdown, quests and safe storage"`.

---

### Task 11: Атом на сцені

**Files:**
- Create: `app/src/volumes/alchemy/shared/nucleus.ts`, `shared/shell-atom.ts`
  (копії `electricity/chapters/atom/parts/nucleus.ts` і `shell-atom.ts`; у шапці кожної — звідки й з якого
  коміту скопійовано)
- Create: `app/src/volumes/alchemy/chapters/lab/parts/atom-view.ts`
- Modify: `chapters/lab/scene.ts`, `shots.ts`, `labels.ts`

**Interfaces:**
- Consumes: `Session`, `SessionEvent`, `loadProgress`, `saveProgress`, `nextVisit`, `shellCounts`, `ionSymbol`,
  `nuclideName`, `statusLine`.
- Produces:

```ts
// shared/shell-atom.ts — як оригінал, але MAX_SHELLS = 7, SHELL_CAPACITY = [2, 8, 18, 32, 32, 18, 8]
// parts/atom-view.ts
export interface AtomView {
  readonly group: Group;
  readonly anchors: { readonly nucleus: Object3D; readonly shells: Object3D; readonly plate: Object3D };
  show(state: GameState, instant: boolean): void;       // ядро, оболонки, табличка
  setCountdown(fraction: number | null): void;          // 1 → 0: червоне кільце відліку; null ховає
  update(dt: number, t: number): void;
}
export function createAtomView(ctx: ChapterContext): AtomView;
```

Правила вигляду: ядро будується на `maxProtons: 118`, `maxNeutrons: 178`; його масштаб стежить за розміром —
`min(0.3, 0.95 / nucleus.radius)` зі згладжуванням, щоб і ²⁹⁴Og лишався всередині першої оболонки (радіус
1,25). Табличка праворуч від атома, як у конструкторі атома (`atom/steps/09-atom-builder.ts`): символ з
зарядом (`ionSymbol`), назва (`nuclideName`), значок стану кольором `statusLine().tone`. Стан без слів:
стабільне й «практично стабільне» — спокійне (`jiggle = 1`); радіоактивне — неспокійне (`1 + 4 · 0,35`);
нетривке — тремтить (`1 + 4`), червоний ореол (`createHalo`) і кільце відліку.

Сцена: один `Session` (`random` — з `ctx.random.fork('visit:' + progress.rolls)`, після чого зберегти
`nextVisit`); для кожного з 12 кроків `stage.define({ [id]: { show: [atom.group], camera: 'lab',
enter(info) { session.enter(id); atom.show(session.state, true); } } })`; подія сесії → `atom.show(after, false)`;
у `update` — `session.update(dt)`, `atom.setCountdown(session.countdown === null ? null : session.countdown / FLEETING_DELAY_S)`,
`atom.update(dt, t)`. Для перевірок: `ctx.qa.expose('lab', () => ({ step, z, n, electrons, moves, elapsed,
done, best, pending, countdown, discovered, symbol }))`, `ctx.qa.probe('lab.nucleus', atom.anchors.nucleus)`.

- [ ] **Step 1: Скопіювати дві моделі в `shared/`, розширити оболонки до семи.**
- [ ] **Step 2: Написати `atom-view.ts`, під'єднати в `scene.ts`.**
- [ ] **Step 3: Перевірити очима й числами** (команди QA з завдання 8; спершу `pnpm build` і перезапуск сервера)

```bash
for s in heavy-hydrogen lead-gold superheavy; do
  node tools/qa/shot.mjs alchemy/lab/$s --size 1280x720 --out qa-local/alchemy/atom-$s.jpg \
    --eval "JSON.stringify(window.__app.read('lab'))"
done
```

Expected: рядки `eval → {"step":"heavy-hydrogen","z":1,"n":0,…}`, `…"z":82,"n":126…`, `…"z":98,"n":151…`.
Відкрити три знімки: ядро всередині першої оболонки; у свинцю шість оболонок, у каліфорнію сім; табличка
читається («²⁰⁸Pb», «Плюмбум (свинець)-208»); ніщо не обрізано панеллю кроку.

- [ ] **Step 4: Повна перевірка розділу на одному розмірі**

Run: `node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud gl --out qa-local/alchemy/atom-gl`
Expected: `PASS alchemy/lab` (без попереджень у консолі; ≤ 350 викликів малювання; ≤ 4 родин відтінків;
лічильники геометрій і текстур не ростуть після трьох входів-виходів).

- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test`; **Commit** —
  `git commit -m "feat(alchemy): the atom on stage for every quest"`.

---

### Task 12: Док і перша гра від початку до кінця

**Files:**
- Create: `app/src/volumes/alchemy/shared/count-stepper.ts` (копія `electricity/chapters/atom/parts/count-stepper.ts`)
- Create: `app/src/volumes/alchemy/chapters/lab/parts/dock.ts`, `chapters/lab/qa/helpers.mjs`, `qa/interactions.mjs`
- Modify: `chapters/lab/scene.ts`, `labels.ts`

**Interfaces:**
- Consumes: `Session`, `AtomView`, `cardRows`, `eventLine`, `energyText`, `elapsedText`, `questDoneLine`,
  `PROJECTILES`, `createCountStepper`, `stepUi`.
- Produces:

```ts
export interface Lab { readonly ctx: ChapterContext; readonly ui: StepUiApi<StepId>; readonly session: Session; readonly atom: AtomView }
export function stepSpec(lab: Lab, step: StepId): StepUiSpec;      // scene.ts: ui.define({ [step]: stepSpec(lab, step) }) для всіх 12
```

Ідентифікатори елементів керування (на них спираються тести взаємодії):

| id | тип | показується |
|---|---|---|
| `card` | `table`, рядки `cardRows(session.state)` | завжди |
| `projectile` | `segmented`, пункти — дозволені снаряди кроку (`id` снаряда, підпис — його `symbol`) | якщо снарядів ≥ 2 |
| `electrons` | `custom`: лічильник «− N +» (`node` + `dom`), межі `0…maxElectrons(Z)` | завжди |
| `moves`, `elapsed`, `energy` | `readout` (`get` / `text`) | завжди |
| `status` | `note`: останній `eventLine`, після перемоги — `questDoneLine` | коли є що сказати |
| `fire`, `gamma-n`, `gamma-p`, `wait` | `button` | інструмент дозволений і немає `pending` |
| `neutral` | `button` «Нейтралізувати» | заряд ≠ 0 і немає `pending` |
| `pick-heavy`, `pick-light` | `button` | лише під час `pending` |
| `restart` | `button` | завжди |

Головна кнопка (`primary`) — перша наявна з `fire`, `wait`, `gamma-p`. Єдиний снаряд кроку вибраний сам.
Чипи чесності: у всіх кроках `'simplified'`, `'notToScale'`, `{ text: 'час очікування пропущено' }`; у
`sun`, `star-forge`, `uranium-chain`, `superheavy`, `free` ще
`{ slowed: 1e15, text: 'нетривке ядро сповільнено: живе 2 s' }`; у `fission`, `superheavy`, `free` ще
`'illustrative'`. Повідомлення: подія → `ui.toast(eventLine(e).text)`; перемога → `ui.toast(questDoneLine(…),
{ icon: 'star', tone: 'ok' })` і `audio.play('success')`; відмова → `tone: 'warning'` і `audio.play('error',
{ gain: 0.5 })`; влучна дія → `audio.play('click')`. Hotspot-и: `nucleus`, `shells` (крок 1) —
`{ anchor: atom.anchors.…, content: '<id>' }`. Лічильник електронів — один екземпляр на всі 12 кроків
(той самий `node` у кожній специфікації); якщо під час переходу між кроками він блимає чи зникає — по
екземпляру на крок. Якщо док не вміщується у 720p: спершу рядок «Заряд і зв'язок»
злити з лічильником електронів, потім перенести `moves` / `elapsed` / `energy` на дошку.

- [ ] **Step 1: Написати тест взаємодії, що падає** — `qa/interactions.mjs`
  (окремий скрипт за зразком `circuit/chapters/prologue/qa/interactions.mjs`: `parseArgs`, `launch`, `openApp`
  з `?freeze`, справжні кліки за `__ui.locate('ctl-<id>')`, стан — `__app.read('lab')`, наприкінці
  `appErrors(page)` має бути порожнім; код виходу 1, якщо бодай одна перевірка впала). Перевірки:

| № | Сценарій | Очікуємо |
|---|---|---|
| 1 | `heavy-hydrogen`: `fire`, `fire`, `wait` | `z=2, n=1, moves=3, done=true, best=3` |
| 2 | `mercury-gold`: `fire`, `wait` | `z=79, n=118, electrons=79, done=true` |
| 3 | там само: `electrons:minus` → з'являється `neutral` → клік | `electrons` 78, потім 79; `moves` не змінився |
| 4 | `restart` | стартовий нуклід, `moves=0`, `done=false`, `best` лишився |
| 5 | `star-forge`: `fire`, пересунути годинник на 2,2 s | `z=2, n=2, moves=1` |
| 6 | `star-forge`: `fire`; `location.hash = '#/alchemy/lab/uranium-chain'`; годинник на 3 s | `z=92, n=146, moves=0` (Review Focus 3) |
| 7 | `fission`: `fire` → видно `pick-heavy`, не видно `fire`; клік `pick-heavy` | `z=56, n=85, pending=false, moves=1` |
| 8 | `wait` п'ять разів поспіль без руху годинника (`uranium-chain`) | `moves=5`, `z=88, n=138` (²²⁶Ra), консоль чиста (Review Focus 2) |
| 9 | кожен з 12 кроків при 1280×720 | `__ui.offscreen()` порожній; під `--hud dom` у `[data-ui="dock-scroll"]` `scrollHeight ≤ clientHeight + 1` |
| 10 | `lead-gold`: `gamma-p`, потім `gamma-n` | `z=81, n=126`, далі `z=81, n=125`; `moves=2`; показник `energy` каже «потрібно» |
| 11 | `sun`: `fire` (p), обрати `projectile:he3`, `fire`, годинник на 2,2 s | `z=2, n=2, moves=2, done=true` |
| 12 | `heavy-hydrogen`: `wait` на стабільному ¹H | стан той самий, `moves=0`, видно `status` з відмовою |

- [ ] **Step 2: Запустити — FAIL**

Run: `node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud dom`
Expected: FAIL — елементів `ctl-fire` ще немає.

- [ ] **Step 3: Скопіювати лічильник у `shared/`, написати `dock.ts`, під'єднати в `scene.ts`.**
- [ ] **Step 4: Зібрати, перезапустити сервер, пройти тест в обох інтерфейсах**

```bash
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud dom
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud gl
node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud dom --out qa-local/alchemy/dock-dom
```

Expected: усі рядки `ok`, код виходу 0; `PASS alchemy/lab`.

- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test`; **Commit** —
  `git commit -m "feat(alchemy): the dock — every tool playable, quests completable"`.

---

### Task 13: Карта нуклідів

**Files:**
- Create: `app/src/volumes/alchemy/chapters/lab/parts/chart-model.ts`, `parts/nuclide-chart.ts`
- Test: `app/src/volumes/alchemy/chapters/lab/__tests__/chart-model.test.ts`
- Modify: `parts/dock.ts` (дошка), `labels.ts`, `qa/interactions.mjs`

**Interfaces:**
- Consumes: `Nuclide`, `getNuclide`, `allNuclides`, `MAX_Z`, `MAX_N`, `Goal`, `Session`, `halfLifeText`, `modeName`.
- Produces:

```ts
// chart-model.ts — без three.js
export type CellKind = 'stable' | 'longLived' | 'beta-' | 'beta+' | 'alpha' | 'proton' | 'neutron' | 'fission' | 'unknown';
export const KIND_COLOR: Readonly<Record<CellKind, ColorLike>>;
export const WINDOW = { cols: 15, rows: 11 } as const;        // N праворуч, Z угору
export function cellKind(x: Nuclide): CellKind;
export function windowOrigin(center: NuclideRef): { readonly n0: number; readonly z0: number };
export interface ChartView { readonly center: NuclideRef; readonly discovered: ReadonlySet<string>;
                             readonly trail: readonly NuclideRef[]; readonly goal: Goal | null }
export interface Cell extends NuclideRef { readonly col: number; readonly row: number; readonly kind: CellKind;
  readonly discovered: boolean; readonly here: boolean; readonly goal: boolean; readonly onTrail: boolean }
export function windowCells(view: ChartView): Cell[];          // лише наявні нукліди вікна
export function cellAt(view: ChartView, col: number, row: number): NuclideRef | null;
export function fullChart(view: ChartView): { readonly width: number; readonly height: number; readonly rgba: Uint8Array };
export function pickedLine(ref: NuclideRef, discovered: boolean): string;

// nuclide-chart.ts
export interface NuclideChart { readonly node: UiNode; dom(host: DomHost): DomWidget; update(t: number): void }
export function createNuclideChart(opts: { view(): ChartView; full(): boolean; onPick(ref: NuclideRef): void }): NuclideChart;
```

Правила моделі: `cellKind` — за статусом (`stable`, `longLived`, `incomplete` → `unknown`), інакше за
головною гілкою: `b-`, `b-n`…`b-4n`, `b-p`, `b-a`, `2b-` → `beta-`; `b+`, `ec`, `ec/b+`, `b+p`, `b+2p`, `b+a`,
`2b+` → `beta+`; `a` → `alpha`; `p`, `2p` → `proton`; `n`, `2n` → `neutron`; `sf` → `fission`.
`windowOrigin`: `n0 = clamp(n − 7, 0, MAX_N − 14)`, `z0 = clamp(z − 5, 1, MAX_Z − 10)`. Ціль: `nuclide` — одна
клітинка; `element` — усі клітинки цього Z; `stableFragment` — жодної. `fullChart`: 179 × 118 пікселів,
піксель `(n, z − 1)`; відсутній нуклід — прозорий; невідкритий — той самий колір з яскравістю 0,35.
`pickedLine`: відкритий — «¹⁴C · Карбон (вуглець)-14 · T½ = 5700 р. · β⁻-розпад · відкрито 1936»
(для природних ще «· у природі 1,06 %»); невідкритий — символ і «ще не відкрито».

Стартова палітра (`KIND_COLOR`; уточнення 16): `stable` → `white`, `longLived` → `mist`, `beta-` → `blue`,
`beta+` → `coral`, `alpha` → `amber`, `proton` → `steel.light`, `neutron` → `steel`, `fission` → `violet`,
`unknown` → `slate`. Позначки: «ви тут» — біле кільце; «ціль» — кільце `yellow`; шлях — тонка лінія `mist`.
Якщо перевірка відтінків падає — приглушити кольори карти, а не піднімати ліміт.

Віджет: **одна** ціль натискання на всю карту (вузол `ctl-chart`), клітинка визначається з координат
(окремі клітинки менші за 44 одиниці й не можуть бути кнопками). WebGL: вікно — шар малювання `Painter`,
повна карта — `DataTexture` у `MeshNode`, як у `app/src/ui3d/charts/heatmap.ts`. DOM: `canvas` через
`domKit.h`, перемальовується лише коли змінився вигляд. Під картою — легенда з п'яти пунктів («стабільні»,
«β⁻», «β⁺ / захоплення», «α», «інше»). Дошка кроку:
`board: { title: L.chart.title, size: 'md', children: [chart, { type: 'note', id: 'picked', … },
{ type: 'toggle', id: 'full', label: L.chart.full }, { type: 'stats', id: 'collection', items:
[«Елементів N / 118», «Нуклідів M / 3383»] }] }`. Для перевірок: у `__app.read('lab')` додати
`chart: { n0, z0, cols, rows }` і `picked`.

- [ ] **Step 1: Написати тест, що падає** — `chart-model.test.ts`

```ts
const view = (z: number, n: number, extra: Partial<ChartView> = {}): ChartView =>
  ({ center: { z, n }, discovered: new Set([nuclideKey(z, n)]), trail: [{ z, n }], goal: null, ...extra });
it('keeps the window on the table', () => {                                        // Review Focus 4
  expect(windowOrigin({ z: 1, n: 0 })).toEqual({ n0: 0, z0: 1 });
  expect(windowOrigin({ z: 118, n: 176 })).toEqual({ n0: 164, z0: 108 });
  expect(windowOrigin({ z: 79, n: 118 })).toEqual({ n0: 111, z0: 74 });
  for (const [z, n] of [[1, 0], [118, 176], [20, 28], [92, 146]] as const) {
    const cells = windowCells(view(z, n));
    expect(cells.every((c) => c.col >= 0 && c.col < 15 && c.row >= 0 && c.row < 11)).toBe(true);
    expect(cells.filter((c) => c.here)).toHaveLength(1);
    expect(cells.every((c) => hasNuclide(c.z, c.n))).toBe(true);
  }
});
it('colours by status, then by the main decay', () => {
  const kind = (z: number, n: number) => cellKind(getNuclide(z, n)!);
  expect([kind(79, 118), kind(82, 122), kind(6, 8), kind(80, 117), kind(92, 146), kind(3, 1), kind(2, 3), kind(112, 170)])
    .toEqual(['stable', 'longLived', 'beta-', 'beta+', 'alpha', 'proton', 'neutron', 'fission']);
  expect(new Set(allNuclides().map(cellKind)).size).toBe(9);
});
it('marks the goal, the trail and what is still unknown', () => {
  const gold = windowCells(view(80, 116, { goal: { kind: 'nuclide', z: 79, n: 118 } }));
  expect(gold.filter((c) => c.goal).map((c) => [c.z, c.n])).toEqual([[79, 118]]);
  const tc = windowCells(view(42, 56, { goal: { kind: 'element', z: 43 } }));
  expect(tc.filter((c) => c.goal).length).toBeGreaterThan(5);
  expect(tc.filter((c) => c.goal).every((c) => c.z === 43)).toBe(true);
  expect(gold.filter((c) => c.discovered)).toHaveLength(1);
  expect(cellAt(view(1, 0), 0, 0)).toEqual({ z: 1, n: 0 });
  expect(cellAt(view(1, 0), 14, 0)).toBeNull();                 // водню з 14 нейтронами немає
  expect(cellAt(view(1, 0), -1, 3)).toBeNull();
  expect(cellAt(view(1, 0), 2, 99)).toBeNull();
});
it('describes a picked cell', () => {
  expect(pickedLine({ z: 6, n: 8 }, true).replaceAll(NBSP, ' ')).toContain('¹⁴C · Карбон (вуглець)-14 · T½ = 5700 р.');
  expect(pickedLine({ z: 6, n: 8 }, false)).toContain('ще не відкрито');
  expect(pickedLine({ z: 6, n: 8 }, false)).not.toContain('5700');
});
it('draws the whole table into 179 × 118 pixels', () => {
  const full = fullChart(view(1, 0));
  expect([full.width, full.height, full.rgba.length]).toEqual([179, 118, 179 * 118 * 4]);
  const alpha = (z: number, n: number) => full.rgba[((z - 1) * 179 + n) * 4 + 3];
  expect(alpha(1, 0)).toBe(255);
  expect(alpha(1, 100)).toBe(0);
});
```

- [ ] **Step 2: Запустити — FAIL.**
- [ ] **Step 3: Написати `chart-model.ts` — PASS.**
- [ ] **Step 4: Написати `nuclide-chart.ts` (обидві реалізації), додати дошку в `dock.ts`.**
- [ ] **Step 5: Доповнити тест взаємодії**: у `heavy-hydrogen` дошку видно (`__ui.locate('board')`); клік у
  клітинку ²H (координати з `__ui.locate('ctl-chart')` і `read('lab').chart`) → `picked` дорівнює `'1-1'`; після
  `fire` центр вікна той самий, а `discovered` зріс на 1; `full` перемикається без помилок у консолі.
- [ ] **Step 6: Зібрати й перевірити**

```bash
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud dom
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud gl
node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud gl  --out qa-local/alchemy/chart-gl
node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud dom --out qa-local/alchemy/chart-dom
```

Expected: усе `ok`; двічі `PASS` (зокрема не більше чотирьох родин відтінків у кожному кроці й жодного
попередження «без DOM-двійника»).

- [ ] **Step 7:** `pnpm typecheck && pnpm lint && pnpm test`; **Commit** —
  `git commit -m "feat(alchemy): nuclide chart — where I am, the goal, the trail, the collection"`.

---

### Task 14: Анімації подій

**Files:**
- Create: `app/src/volumes/alchemy/shared/fission-drop.ts` (копія `electricity/chapters/plant-nuclear/parts/nucleus.ts`:
  `packCluster` і поза краплі — тремтіння, витягування, два центри)
- Create: `app/src/volumes/alchemy/chapters/lab/parts/emitter.ts`, `parts/decay-fx.ts`, `parts/fission-view.ts`
- Modify: `chapters/lab/scene.ts`, `parts/atom-view.ts`, `parts/dock.ts`, `shots.ts`, `labels.ts`, `qa/interactions.mjs`

**Interfaces:**
- Consumes: `SessionEvent`, `GameEvent`, `EMITS`, `PROJECTILES`, `Fission`, `AtomView`, `@/fx`
  (`createOrbs`, `createElectron`, `createTrail`, `createPhotons`, `createHalo`), `ctx.input`.
- Produces:

```ts
export interface EventFx {
  readonly group: Group;
  readonly busy: boolean;
  play(e: SessionEvent, onImpact: () => void): void;   // onImpact — мить, коли атом має змінитись
  skip(): void;                                         // одразу до кінцевого вигляду
  update(dt: number, t: number): void;
}
export function createEmitter(ctx: ChapterContext): EventFx & { readonly anchor: Object3D };          // снаряди й γ-квант
export function createDecayFx(ctx: ChapterContext, atom: AtomView): EventFx;                           // усе, що вилітає з ядра
export function createFissionView(ctx: ChapterContext, pick: (which: 'heavy' | 'light') => void):
  EventFx & { readonly anchors: { readonly heavy: Object3D; readonly light: Object3D } };
```

Правила: модель уже змінилась — анімація лише показує. Сцена тримає чергу подій; атом перемикається на новий
нуклід у мить `onImpact`; якщо в черзі більше двох подій, крок відкрито напряму (`info.instant`) або ввімкнено
«менше руху» — `skip()` і одразу кінцевий стан. Словник: нейтрон і протон — `createOrbs` свого виду; складений
снаряд — купка зі `z` протонів і `n` нейтронів; електрон — `createElectron` зі слідом; позитрон —
`createOrbs({ kind: 'electron', color: 'coral', glyph: '+' })`; α — два протони й два нейтрони разом; γ —
`createPhotons({ color: 'yellow' })`; захоплення електрона — електрон зовнішньої оболонки падає в ядро;
відскок — снаряд відлітає назад; поділ — крапля тремтить, витягується й рветься на два уламки з підписами,
нейтрони розлітаються зі слідами. Уламок можна обрати кліком у сцені (`ctx.input.register` з підказкою) —
це двійник кнопок `pick-heavy` / `pick-light`. Початкові тривалості: політ снаряда 0,45 s; спалах 0,25 s;
відскок 0,5 s; виліт частинки 0,7 s; падіння електрона 0,6 s; γ 0,6 s; поділ 0,9 s + 0,6 s. Hotspot-и
`emitter` (крок 1), `countdown` (крок 4), `fragments` (крок 8) прив'язати до своїх об'єктів; під час вибору
уламка — виноски з символами уламків. Для перевірок: `ctx.qa.probe` для `lab.emitter`, `lab.fragment.heavy`,
`lab.fragment.light`; у `__app.read('lab')` додати `busy` (чи триває анімація).

- [ ] **Step 1: Доповнити тест взаємодії (має впасти)**: у `fission` після `fire` клік по зонду
  `lab.fragment.heavy` у сцені → `z=56, n=85`; у `heavy-hydrogen` після `fire` й 3 s годинника стан той самий,
  що й одразу після кліку (анімація нічого не міняє в моделі); десять швидких `fire` у `free` без руху
  годинника → `moves=10`, консоль чиста, після 5 s годинника `read('lab').busy === false`. З параметром
  `--out <тека>` тест зберігає три знімки посеред дії (`screenshot` з `tools/qa/lib.mjs`, через 0,3 s годинника
  після кліку): `fx-star-forge.jpg`, `fx-fission.jpg`, `fx-mercury-gold.jpg`.
- [ ] **Step 2: Написати `fission-drop.ts`, `emitter.ts`, `decay-fx.ts`, `fission-view.ts`; черга в `scene.ts`.**
- [ ] **Step 3: Зібрати й перевірити**

```bash
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud dom --out qa-local/alchemy/fx
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud gl
node tools/qa/chapter-check.mjs alchemy/lab --sizes 1280x720 --skip perf --hud gl --out qa-local/alchemy/fx-gl
```

Expected: усе `ok`; `PASS`. Відкрити три знімки з `qa-local/alchemy/fx`: видно снаряд у польоті (до ⁴He);
ядро, що рветься, чи два уламки з підписами; снаряд на шляху до ртуті — без порожнього кадру й без
перекриття панелями.

- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test`; **Commit** —
  `git commit -m "feat(alchemy): every transformation is shown — shots, decays, fission"`.

---

### Task 15: Вільна лабораторія — вибір старту й пам'ять

**Files:**
- Create: `app/src/volumes/alchemy/chapters/lab/parts/start-picker.ts`
- Test: `app/src/volumes/alchemy/chapters/lab/__tests__/start-picker.test.ts`
- Modify: `parts/dock.ts`, `labels.ts`, `qa/interactions.mjs`

**Interfaces:**
- Consumes: `naturalNuclides`, `elementByZ`, `nuclideSymbol`, `Session.startFrom`, `ui.patch`, `ui.value`, `ui.set`.
- Produces:

```ts
export const NATURAL_Z: readonly number[];                       // 84 елементи, що мають природні нукліди
export function naturalIsotopes(z: number): readonly Nuclide[];  // за зростанням A
export function elementCaption(index: number): string;           // «Au · Аурум (золото)»
export function isotopeCaption(z: number, index: number): string; // «¹⁹⁷Au · 100 %»
export function pickerControls(lab: Lab): readonly ControlSpec[];
```

Док кроку `free`: кнопка `new-start` («Новий старт») вмикає режим вибору — інструменти ховаються (`visible`),
з'являються повзунок `pick-element` (ціле 0…83, `format` → `elementCaption`), повзунок `pick-isotope` (ціле
0…k−1; при зміні елемента `ui.patch('pick-isotope', { max })` і значення 0; `format` → `isotopeCaption`),
кнопки `take-start` («Взяти як старт») і `cancel-start` («Скасувати»). Дошка кроку `free`: кнопка `start-here`
(«Почати звідси») видима, коли на карті обрано природний нуклід.

- [ ] **Step 1: Написати тест, що падає** — `start-picker.test.ts`

```ts
it('lists what nature has', () => {
  expect(NATURAL_Z).toHaveLength(84);
  expect(NATURAL_Z[0]).toBe(1);
  expect(NATURAL_Z.at(-1)).toBe(92);
  expect(NATURAL_Z).not.toContain(43);
  expect(NATURAL_Z).not.toContain(61);
  expect(naturalIsotopes(50)).toHaveLength(10);
  expect(naturalIsotopes(79).map((x) => x.a)).toEqual([197]);
  expect(naturalIsotopes(92).map((x) => x.a)).toEqual([234, 235, 238]);
  expect(naturalIsotopes(43)).toEqual([]);
  expect(elementCaption(NATURAL_Z.indexOf(79))).toBe('Au · Аурум (золото)');
  expect(isotopeCaption(79, 0).replaceAll(NBSP, ' ')).toBe('¹⁹⁷Au · 100 %');
  expect(isotopeCaption(79, 7)).toBe(isotopeCaption(79, 0));      // індекс поза межами обрізається
});
```

- [ ] **Step 2: Запустити — FAIL; написати `start-picker.ts` — PASS.**
- [ ] **Step 3: Доповнити тест взаємодії**: `free`: `new-start` → `fire` не видно; `__ui.set('pick-element',
  NATURAL_Z.indexOf(79), true)`; `take-start` → `z=79, n=118, moves=0`; `page.reload()` → той самий нуклід і те
  саме `discovered`; клік по клітинці ¹⁹⁸Hg на карті й `start-here` → `z=80, n=118`; у кроці `sun` кнопки
  `new-start` немає. Окремий прогін зі зламаним сховищем
  (`page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } }))`):
  розділ відкривається, `fire` працює, консоль чиста (Review Focus 1).
- [ ] **Step 4: Додати режим у `dock.ts`; зібрати; пройти тест в обох інтерфейсах** (команди з завдання 12).
- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test`; **Commit** —
  `git commit -m "feat(alchemy): free lab — any natural nuclide as a start, remembered between visits"`.

---

### Task 16: Облік і приймання

**Files:**
- Modify: `docs/STYLE_GUIDE.md` (новий підрозділ `#### 2.2.3 Volume «Ядерна алхімія» (\`alchemy\`)` з таблицею
  `| Meaning | Colour |`: дев'ять видів клітинок карти, позначки «ви тут» / «ціль» / шлях, позитрон, кільце
  відліку — з фактичними токенами після завдань 13–14), `app/src/volumes/alchemy/chapters/lab/README.md`
  (як влаштований розділ, які зонди й стан бачить QA, як запускати тест взаємодії)

**Interfaces:**
- Consumes: усе попереднє. Produces: звіт приймання (у повідомленні завдання, не файлом).

- [ ] **Step 1: Дописати таблицю кольорів і README розділу.**
- [ ] **Step 2: Код і документи**

```bash
cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm fonts:check && cd ..
python3 tools/content/doccheck.py --all
```

Expected: усе зелене; `doccheck` — `ALL GREEN` для кожного тому.

- [ ] **Step 3: Перевірки розділу на всіх розмірах, в обох інтерфейсах** (сервер зібраної версії перезапущено)

```bash
node tools/qa/chapter-check.mjs alchemy/lab --sizes all --skip perf --hud gl  --out qa-local/alchemy/final-gl
node tools/qa/chapter-check.mjs alchemy/lab --sizes all --skip perf --hud dom --out qa-local/alchemy/final-dom
node tools/qa/mobile-check.mjs alchemy/lab --skip perf --out qa-local/alchemy/final-mobile
node tools/qa/library-check.mjs --out qa-local/alchemy/final-library
for hud in dom gl; do for size in 1280x720 1920x1080; do
  node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size $size --hud $hud
done; done
```

Expected: двічі `PASS alchemy/lab`, `PASS` мобільної перевірки, `PASS library-check`, чотири прогони тесту
взаємодії з кодом 0. На програмному рендері прогін «усі розміри» триває хвилини — це не збій.

- [ ] **Step 4: Інші томи не змінились**

Run: `node tools/qa/chapter-check.mjs atom --sizes 1280x720 --skip perf --out qa-local/alchemy/other-atom && node tools/qa/chapter-check.mjs circuit/prologue --sizes 1280x720 --skip perf --out qa-local/alchemy/other-prologue`
Expected: двічі `PASS`.

- [ ] **Step 5: Самоперевірка знімків** за списком `docs/STYLE_GUIDE.md` §8: відкрити зведені аркуші
  `qa-local/alchemy/final-gl/alchemy-lab/sheet-1280x720.jpg` і `sheet-1920x1080.jpg` (та `final-dom`), пройти
  вісім пунктів списку для кожного з 12 кроків, записати у звіт пункт за пунктом; знайдене — виправити й
  повторити кроки 2–3.
- [ ] **Step 6: Межі змін**

Run: `git diff --stat main...HEAD -- . ':!app/src/volumes/alchemy' ':!docs/volumes/alchemy' ':!tools/data' ':!docs/superpowers'`
Expected: лише `app/tsconfig.json` (1 рядок), `app/src/engine/__tests__/volumes.test.ts` (1 рядок),
`docs/STYLE_GUIDE.md`, `docs/THIRD_PARTY.md` (і `docs/API_CHANGES.md`, якщо була добавка до платформи).

- [ ] **Step 7: Звіт і коміт.** У звіті чесно: що перевірено й чим; що **не** перевірено на цій машині
  (кадровий час на GPU; зручність на телефоні — не шліфувалась, лише `mobile-check`); умови використання даних
  IAEA лишаються неперевіреними. **Commit** — `git commit -m "docs(alchemy): semantic colours, chapter README; acceptance run"`.
