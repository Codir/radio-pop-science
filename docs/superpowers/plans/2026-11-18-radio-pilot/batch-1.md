# Черга 1. Каркас, сайт, документи

> Розділ плану [`2026-11-18-radio-pilot.md`](../2026-11-18-radio-pilot.md). Обмеження, поправки П1–П21, будова файлів, «Спільний договір» і ворота черги — там; завдання посилаються на них і на інші завдання за номерами.


Черга дає том-чернетку `radio` з усією подорожжю, документи тому у формі проєкту з власною перевіркою, профіль сайту й публікацію на GitHub Pages. Після неї сайт показує вестибюль тому (П4), а всі перевірки повного дерева зелені. Порядок в одному дереві: A1 → A2 → A3a → A3b → A4 → A5 → A7 → A6 → A8 → A9 (A6 записує команди з `tools/site`, тому йде після A7). Нитку документів (A3a–A5) і нитку сайту (A7) можна вести водночас лише в окремих робочих деревах: кроки перевіряють `git status --short`, а A8 кличе `check.py` з A3a. Коміти лягають у місцеву `main` (рішення 22); хто працював в окремій гілці, перед воротами A9 робить `git checkout main && git merge --ff-only <гілка>`, а друга з двох гілок перед тим — `git rebase main` (в `origin` її ще немає, тож `--force` не потрібен). Кожна нова оболонка починається з прелюдії (див. «Середовище»); номери «П…» — рядки таблиці «Поправки» цього плану, П1–П21.

### Завдання A1. Архів старого плану й розділ у `README.md`

**Виконавець:** Opus 5.5

**Файли:**
- Перенести: `docs/volumes/radio/{CURRICULUM.md,NOTES.md,VOLUME.md}` → `docs/volumes/radio/plan48/`
- Створити: `docs/volumes/radio/plan48/README.md`
- Змінити: `README.md` (новий блок над наявним текстом; жодного наявного рядка не чіпаємо)
- Тест: `python3 tools/content/doccheck.py --all`; `git diff --numstat -- README.md`

**Інтерфейси:**
- Бере: нічого.
- Дає: каталог `docs/volumes/radio/plan48/` (його оминає `check.py`, A3a) і вільне ім’я `docs/volumes/radio/VOLUME.md`.

- [ ] **Крок 1. Чисте дерево.** `git status --short` → порожньо: каркас плану, його додатки й поправки до проєкту вже в історії (коміт `9667218`). Якщо зміни видно, це мусить бути лише дописаний план і, можливо, таблиця поправок проєкту (частина IV §5: П1 уточнено, П21 додано): `test -f docs/superpowers/plans/2026-11-18-radio-pilot.md && git status --short | grep -vc ' docs/superpowers/'` → `0`. Тоді спершу коміт (рішення плану): `git add` з явним шляхом кожного файла, який друкує `git status --short -uall docs/superpowers` (каталогів і `-A` не додаємо), і `git commit -m "План робіт до пілота тому «Радіо»: завдання черг 1–3"` (якщо серед файлів є проєкт, другим `-m` — `У проєкті уточнено поправку П1 і додано П21`). Будь-яка зміна поза `docs/superpowers/` — зупинитися й доповісти.
- [ ] **Крок 2. Знайти, що вказує на старі файли.** `grep -rnI "volumes/radio" docs README.md tools app/src | grep -v "^docs/superpowers/"` → рівно один рядок, `docs/volumes/radio/VOLUME.md:342:` (він про `app/src/volumes/radio/sim/core/*`, а не про перенесені файли). Отже, правити нічого. Три файли згадують один одного лише за іменем і переїздять разом.
- [ ] **Крок 3. Перенести.** `mkdir -p docs/volumes/radio/plan48 && git mv docs/volumes/radio/CURRICULUM.md docs/volumes/radio/NOTES.md docs/volumes/radio/VOLUME.md docs/volumes/radio/plan48/`
- [ ] **Крок 4. `plan48/README.md`** — дослівно:

  ```markdown
  # Архів: план тому «Радіо» на 48 глав

  Три документи цього каталогу — план тому в попередньому форматі (листопад 2026 р.). Його не будуємо:
  чинний задум — `../VOLUME.md`, шлях — `../PATH.md`. Архів лишається джерелом ідей для майбутніх гілок.
  Обсяг старого плану ширший за чинний том: радіолокації, навігації й стільникового зв’язку в томі немає.
  ```
- [ ] **Крок 5. Блок на початку `README.md`** — вставити перед першим рядком (`# tech — …`), дослівно:

  ```markdown
  # radio-pop-science — том «Радіо · Від електрона до екрана»

  Це копія репозиторію [`tech`](https://github.com/NikoSkakun/tech) з усією його історією. Тут будується один
  новий том інтерактивної 3D-енциклопедії: дорога картинки від бездротової камери у дворі до екрана на кухні.

  - **Сайт:** https://codir.github.io/radio-pop-science/ — показує лише цей том.
  - **Том у коді:** `app/src/volumes/radio/`. **Документи тому:** `docs/volumes/radio/` (задум — `VOLUME.md`,
    шлях — `PATH.md`). Проєкт тому і плани робіт — `docs/superpowers/`.
  - **Рушій** приходить із `tech`: `git fetch upstream && git merge upstream/main`. Каталоги рушія тут не редагуємо.
  - **Зібрати сайт локально:** `node tools/site/build.mjs` (збірка лягає в `tools/site/dist`).

  Далі — опис рушія `tech` без змін.

  ---

  ```
- [ ] **Крок 6. Перевірити.** `sed -n 1p README.md` → `# radio-pop-science — том «Радіо · Від електрона до екрана»`. `git diff --numstat -- README.md` → друге число `0` (вилучених рядків немає). `python3 tools/content/doccheck.py --all | tail -1` → `doccheck: ALL GREEN`. `git status --short` → три рядки `R  docs/volumes/radio/<файл> -> docs/volumes/radio/plan48/<файл>`, ` M README.md`, `?? docs/volumes/radio/plan48/README.md`.
- [ ] **Крок 7. Коміт.** `git add README.md docs/volumes/radio/plan48/README.md docs/volumes/radio/plan48/CURRICULUM.md docs/volumes/radio/plan48/NOTES.md docs/volumes/radio/plan48/VOLUME.md`; повідомлення: `Старий план тому «Радіо» перенесено в архів plan48, у README — розділ про цю копію`; у тілі коміту — один абзац: `docs/LIBRARY.md` (§1, рядок 13, і §4) та таблиця «Томи» в README описують старий задум тому `radio`; це документи платформи, їх не правимо.

### Завдання A2. Каркас тому `radio`: `volume.json`, `volume.ts`, `chapters.ts`, тест подорожі

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/radio/volume.json`, `app/src/volumes/radio/volume.ts`, `app/src/volumes/radio/chapters.ts`
- Змінити: `app/tsconfig.json` (у `compilerOptions.paths` після рядка `@circuit/*`: `"@radio/*": ["./src/volumes/radio/*"]`); `app/src/engine/__tests__/volumes.test.ts:30` (перелік стає `['_demo', '_dev', '_path', 'circuit', 'electricity', 'radio']`)
- Тест: `app/src/volumes/radio/__tests__/journey.test.ts`

**Інтерфейси:**
- Бере: `defineVolume(identity, spec)` з `@/engine/api`; лінійку, групи й таблицю подорожі — див. Спільний договір, «Подорож тому».
- Дає: типовий експорт `VolumeManifest` із `app/src/volumes/radio/volume.ts`; псевдонім `@radio/*`; `volume.json` як джерело подорожі для `tools/content` і `check.py`.

- [ ] **Крок 1. Написати тест, що падає.** `journey.test.ts`: плановані глави читаємо з маніфесту (`volume.journey.planned` має тип `PlannedChapter` з необов’язковим `parent`), сирий JSON — лише для `status`, `seamless`, `emblem`. `TABLE` — 37 рядків таблиці «Подорож тому» в тому самому порядку. Назви тестів тому — українською (так у всіх чергах плану), коментарі в коді — англійською, як у `circuit`; самі назви глав звіряє з проєктом крок 8.

  ```ts
  import { describe, expect, it } from 'vitest';
  import volume from '../volume';
  import identity from '../volume.json';

  const TABLE: readonly (readonly [id: string, group: string, parent: string | null, minutes: number, floor: string])[] = [
    ['prologue', 'prologue', null, 5, 'road'], /* … ще 35 рядків договору … */ ['lab-yard', 'labs', 'build-digital', 9, 'road'],
  ];
  const planned = volume.journey.planned;
  const layerOf = (group: string) => volume.journey.groups.find((g) => g.id === group)!.layer;
  const main = planned.filter((c) => layerOf(c.group) !== 'branch');

  describe('radio: подорож тому', () => {
    it('37 записів у порядку договору', () => expect(planned.map((c) => c.id)).toEqual(TABLE.map((r) => r[0])));
    it('група, батько, хвилини й позначка кожного запису', () =>
      expect(planned.map((c) => [c.id, c.group, c.parent ?? null, c.minutes, c.floor])).toEqual(TABLE));
    it('20 записів поза гілками, 17 глав шляху, 169 хвилин', () => {
      expect(main).toHaveLength(20);
      expect(planned.filter((c) => layerOf(c.group) === 'path')).toHaveLength(17);
      expect(main.reduce((sum, c) => sum + c.minutes!, 0)).toBe(169);
    });
    it('гілка стоїть після батька, а батько — не гілка', () => {
      for (const [i, c] of planned.entries()) {
        if (layerOf(c.group) !== 'branch') { expect(c.parent).toBeUndefined(); continue; }
        const at = planned.findIndex((p) => p.id === c.parent);
        expect(at).toBeGreaterThanOrEqual(0); expect(at).toBeLessThan(i);
        expect(layerOf(planned[at]!.group)).not.toBe('branch');
      }
    });
    it('групи — дев’ять, у порядку договору', () =>
      expect(volume.journey.groups.map((g) => [g.id, g.label, g.layer])).toEqual([
        ['prologue', 'Пролог', 'prologue'], ['basics', 'Основи', 'path'], ['picture', 'Дорога картинки', 'path'],
        ['practicum-analog', 'Практикум', 'practicum'], ['numbers', 'Дорога чисел', 'path'],
        ['practicum-digital', 'Практикум', 'practicum'], ['branches', 'Гілки', 'branch'],
        ['engineering', 'Інженерні гілки', 'branch'], ['labs', 'Лабораторії', 'branch']]));
    it('лінійка: сім позначок зі значеннями 0…6', () => {
      const { axis } = volume.journey;
      expect(axis.floors.map((f) => [f.id, f.label, f.value])).toEqual([['basics', 'основи', 0], ['camera', 'камера', 1],
        ['transmitter', 'передавач', 2], ['air', 'повітря', 3], ['receiver', 'приймач', 4], ['screen', 'екран', 5], ['road', 'уся дорога', 6]]);
      expect([axis.min, axis.max, axis.origin, axis.format(0), axis.format(6)]).toEqual([0, 6, 0, 'основи', 'уся дорога']);
      expect([axis.label, axis.hint, axis.range]).toEqual(['Станція', 'Де ми на дорозі картинки', 'від камери до екрана']);
    });
    it('назви: питання всюди, крім практикумів; без U+0027 і U+00B5', () => {
      for (const c of planned) {
        expect(c.title!.endsWith('?')).toBe(layerOf(c.group) !== 'practicum');
        expect(c.title).not.toMatch(/['\u00b5]|^Практикум/);
      }
    });
    it('чернетка з рядком вестибюля; без seamless та emblem', () => {
      expect([identity.status, 'seamless' in identity, 'emblem' in identity]).toEqual(['draft', false, false]);
      expect([volume.title, volume.subtitle, volume.headline, volume.emptyNote, volume.accent, volume.order, volume.format])
        .toEqual(['Радіо', 'Від електрона до екрана', 'Радіо', 'Перші глави — в роботі', 'sky', 2, 'path']);
      expect(volume.theme).toEqual({ sky: 'dusk', mood: 'diorama', accent: 'sky' });
    });
  });
  ```
- [ ] **Крок 2. Побачити, що падає.** `(cd app && pnpm test src/volumes/radio)` → `Error: Cannot find module '../volume' imported from …/src/volumes/radio/__tests__/journey.test.ts`, `Test Files  1 failed (1)`.
- [ ] **Крок 3. `volume.json`.** Поля в цьому порядку: `"id": "radio"`, `"title": "Радіо"`, `"subtitle": "Від електрона до екрана"`, `"emptyNote": "Перші глави — в роботі"`, `"order": 2`, `"accent": "sky"`, `"status": "draft"`, `"format": "path"`, `"axis"` (`label`, `"unit": ""`, `hint`, `range`, `floors` — сім записів `{ id, label, value }`), `"groups"` (дев’ять `{ id, label, layer }`), `"journey"` (37 записів `{ id, group, [parent,] title, minutes, floor }`, один на рядок, як у `circuit/volume.json`). Полів `seamless`, `emblem`, `headline`, `kicker`, `lead` немає. Назви — дослівно з проєкту II §1, §3.1, §3.2, §4 (готовий перелік — факти: `spec-requirements.md` §1.3) з двома правками: прямий апостроф → `’` (три назви: `build-analog`, `build-digital`, `lab-yard`) і без «Практикум. » на початку.
- [ ] **Крок 4. `volume.ts`, `chapters.ts`, псевдонім.** `chapters.ts` — `cp app/src/volumes/circuit/chapters.ts app/src/volumes/radio/chapters.ts` (файл однаковий у всіх томах). `volume.ts` — за зразком `circuit/volume.ts`: `axis: { min: 0, max: 6, origin: 0, tick: 1, majorEvery: 1, format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '', ascending: 'out' }`, `layout: { dx: 210, dy: 70 }`, `glossary: { scope: 'volume' }`, `theme: { sky: 'dusk', mood: 'diorama' }` (обидва імені є в рушії: `style/env/presets.ts:81`, `engine/pipeline/post-params.ts:102`). Коментар у шапці англійською, як у `circuit`: вісь — станції дороги картинки, тема — вечірня діорама. Додати рядок у `app/tsconfig.json`.
- [ ] **Крок 5. Тест тому зелений.** `(cd app && pnpm test src/volumes/radio)` → `Test Files  1 passed (1)`, `Tests  8 passed (8)`.
- [ ] **Крок 6. Повний прогін показує рівно одне падіння.** `(cd app && pnpm test)` → `Test Files  1 failed | 146 passed (147)`, `Tests  1 failed | 1610 passed (1611)`; падає `volumes in the repository > has the volumes this test knows about` (отримано зайве `"radio"`). Два падіння в цьому файлі означають, що рядка в `tsconfig.json` бракує.
- [ ] **Крок 7. Дописати `'radio'` в перелік (П3).** `(cd app && pnpm test)` → `Test Files  147 passed (147)`, `Tests  1611 passed (1611)`.
- [ ] **Крок 8. Решта перевірок.** `(cd app && pnpm typecheck && pnpm lint && pnpm build && ls dist/assets | grep -c '^volume-radio-')` → `1`. `python3 tools/content/doccheck.py --volume radio` → `volume radio has no documents yet (docs/volumes/radio/chapters): nothing to do`, далі `doccheck: ALL GREEN`.
  Назви звіряємо з проєктом машиною, а не оком (тест закріплює лише знак питання й апостроф) — кожна мусить стояти в проєкті цілою коміркою таблиці або в лапках: `python3 -c "import json; d = open('docs/superpowers/specs/2026-11-17-radio-volume-design.md', encoding='utf-8').read(); j = json.load(open('app/src/volumes/radio/volume.json', encoding='utf-8'))['journey']; print(len(j), [c['id'] for c in j if not any(f % c['title'].replace('’', chr(39)) in d for f in ('| %s |', '. %s |', '«%s»'))])"` → `37 []`.
- [ ] **Крок 9. Коміт.** `git add app/src/volumes/radio/volume.json app/src/volumes/radio/volume.ts app/src/volumes/radio/chapters.ts app/src/volumes/radio/__tests__/journey.test.ts app/tsconfig.json app/src/engine/__tests__/volumes.test.ts`; `Каркас тому «Радіо»: уся подорож із 37 глав, лінійка із семи позначок, том-чернетка`.

### Завдання A3a. Власна перевірка тому `check.py`

**Виконавець:** Opus 5.5 — перевірки (рішення 17).

**Файли:**
- Створити: `docs/volumes/radio/check.py`
- Тест: `docs/volumes/radio/test_check.py`

**Інтерфейси:**
- Бере: `app/src/volumes/radio/volume.json` (A2); розбір рядка таблиці — як `cells()` у `docs/volumes/circuit/check.py:21-24` (комірки ділить `|`, `\|` — літерал).
- Дає (рішення плану):
  - Команда `python3 docs/volumes/radio/check.py` (лише стандартна бібліотека; `check.py` і `test_check.py` ставлять `sys.dont_write_bytecode = True`, як інструменти `tools/content`); її разом із `test_check.py` кличуть ворота черг і `pages.yml`, а ворота вимагають, щоб рядків `skipped` не було. Друкує по рядку `radio check: <проблема>`, далі `radio check: journey 37 · path 20 · ledger terms 41 · links 8 · chapter documents 0`, далі — за кожну звірку, чийого файла ще немає, — `radio check: skipped rule N (<файл> is not there yet)`, останнім рядком `radio check: OK` (вихід 0) або `radio check: N problem(s)` (вихід 1). Немає `PATH.md` чи `PATH-ledger.md` — це проблема `radio check: <файл> is missing`: правила, що його читають, не запускаються, а в рядку чисел за нього стоїть 0.
  - Функції для тестів: `norm(s) -> str`; `table(md, title) -> list[dict[str, str]]` — рядки першої таблиці під заголовком H2 `title`, ключі — комірки шапки; `rule1(volume, path_md)`, `rule2(volume, path_md)`, `rule3(volume, ledger_md, terms_md | None)`, `rule4(files: dict[str, str])`, `rule5(chapters: dict[str, str], terms_md | None)`, `rule6(visual_md)`, `rule7(path_md, pages: set[str])` — кожна повертає `list[str]`; `VISUAL_SECTIONS` — дев’ять заголовків H2, які мусить мати `VISUAL.md` (A5; список — у тесті `test_visual`).
  - Форма, яку перевірка читає (її тримають A3b і A4). `PATH.md`: під `## Основний шлях` — таблиця проєкту II §1; стовпчики перевірка знаходить за шапкою: `id` (комірка `` `id` ``), `Назва-питання`, `≈ хв`. Кожна глава, гілка, практикум і лабораторія має рівно один заголовок ``### [N. ]`id` — <назва>`` (на рядку більше нічого). Під `## Посилання на курс про електрику` — таблиця, друга комірка якої починається адресою `` `#/<том>/<глава>[/<крок>]` ``. `PATH-ledger.md`: під `## Терміни шляху` — таблиця `№ | Термін | Крок`, «Крок» — `` `chapter/step` ``.

Правила (перші шість — із задуму черги, сьоме — з проєкту III §1; уточнення — рішення плану). `NOWHERE` у правилі 5 — вираз `\bглушінн|\b(?:за)?глуш(?:ил|ит)|джамер|\bдрон|безпілотн|БПЛА|військ|радіолокац|\bРЕБ\b|\bРЛС\b` без урахування регістру; межа слова перед «глуш» лишає вільними «приглушили світло» й «приглушити».

| № | Що перевіряє | Уточнення |
|---|---|---|
| 1 | Рядки «Основного шляху» = записи `journey` поза гілками, у тому самому порядку: `id`, назва, хвилини | назви порівнює `norm`: нижній регістр, лише літери й цифри, початкове «практикум» відкинуто |
| 2 | Кожен `id` подорожі має рівно один заголовок H3; зайвих немає | назва після ` — ` дорівнює назві з `volume.json` за `norm` |
| 3 | «Терміни шляху» в `PATH-ledger.md` і в `chapters/_terms.md`: ті самі терміни з тими самими кроками | глава кожного кроку є в подорожі; без `_terms.md` звірку пропущено з рядком `skipped rule 3` |
| 4 | Знака U+00B5 немає ніде в `docs/volumes/radio/` (крім `plan48/`) і в `app/src/volumes/radio/` | там само немає прямого апострофа між двома кириличними літерами; файли `.md .tsv .json .ts .mjs .py` |
| 5 | У `chapters/*.md` (увесь текст, із «Докладніше») і в картках `_terms.md` немає тем «ніде» | шукаємо вираз `NOWHERE`; у `_terms.md` читаємо лише комірку «Картка» рядків «Терміни шляху» і «Слова лише для «Докладніше»» — таблиця «Чого на шляху немає» сама містить ці слова |
| 6 | `VISUAL.md` має всі розділи з `VISUAL_SECTIONS` | номер перед назвою дозволено (`## 8. Телефон`); без файла — `skipped rule 6` |
| 7 | Кожна адреса з таблиці «Посилання на курс про електрику» є в цьому дереві — так перелік звіряється з главами основного курсу після кожного злиття з `upstream` | сторінка є, якщо є `app/src/volumes/<том>/chapters/<глава>/index.ts` або `app/src/volumes/<том>/content/generated/<глава>.manifest.json`; крок — `id` у полі `steps` цього файла. Сьогодні є всі вісім |

- [ ] **Крок 1. Написати `test_check.py`** (`unittest`; `sys.path.insert(0, <каталог файла>)`, `import check as K`; наприкінці `unittest.main()`). Знак мікро і прямий апостроф у самому тесті — лише кодами (`\u00b5`, `\'`, `\u0027`): правило 4 читає і цей файл. Зразки й тести — дослівно:
  ```python
  V = {'groups': [{'id': 'picture', 'layer': 'path'}, {'id': 'practicum-analog', 'layer': 'practicum'}, {'id': 'branches', 'layer': 'branch'}], 'journey': [
       {'id': 'lines', 'group': 'picture', 'title': 'Як передати цілу картинку одним числом?', 'minutes': 10},
       {'id': 'tv', 'group': 'branches', 'parent': 'lines', 'title': 'Як працював звичайний телевізор?', 'minutes': 13},
       {'id': 'build-analog', 'group': 'practicum-analog', 'title': 'Проведіть картинку крізь подвір’я самі', 'minutes': 12}]}
  LINES = '| 4 | `lines` | Як передати цілу картинку одним числом? | 10 | третину відповіді |\n'; TV = '### `tv` — Як працював звичайний телевізор?\n'
  PATH = ('## Основний шлях\n| № | id | Назва-питання | ≈ хв | Без цієї глави не пояснити |\n|---|---|---|---|---|\n' + LINES
          + '| — | `build-analog` | Практикум. Проведіть картинку крізь подвір’я самі | 12 | — |\n## Кроки шляху\n'
          + '### 4. `lines` — Як передати цілу картинку одним числом?\n- `lines/row` — Комірки одного ряду дають сигнал.\n' + TV
          + '### `build-analog` — Практикум. Проведіть картинку крізь подвір’я самі\n## Посилання на курс про електрику\n| Крок тому | Сторінка |\n'
          + '|---|---|\n| `lines/row` | `#/circuit/charge` — що тримає електрон біля ядра |\n| `tv/beam` | `#/electricity/magnetism/lorentz` |\n')
  LEDGER = '## Терміни шляху\n| № | Термін | Крок |\n|---|---|---|\n| 1 | рядок | `lines/row` |\n'; ROW = '| рядок | `\\bрядо?к\\w*` | `lines/row` | шлях | Ряд комірок, прочитаних по черзі. |\n'
  TERMS = ('## Терміни шляху\n| Термін | Форми | Крок | Тип | Картка |\n|---|---|---|---|---|\n' + ROW
           + '## Чого на шляху немає\n| Тема | Форми |\n|---|---|\n| безпілотники | `безпілотн\\w*` |\n')

  class CheckTest(unittest.TestCase):
      def test_clean(self):
          self.assertEqual(K.rule1(V, PATH) + K.rule2(V, PATH) + K.rule3(V, LEDGER, TERMS) + K.rule5({}, TERMS) + K.rule7(PATH, {'circuit/charge', 'electricity/magnetism/lorentz'}), [])
      def test_main_path(self):
          title = '| Як передати цілу картинку одним числом? |'
          self.assertEqual(K.rule1(V, PATH.replace('| 10 | третину', '| 9 | третину')), ['PATH.md: `lines`: 9 хв ≠ volume.json 10'])
          self.assertEqual(K.rule1(V, PATH.replace(title, '| як передати цілу картинку — одним числом |')), [])
          self.assertEqual(K.rule1(V, PATH.replace(title, '| Як передати картинку? |')), ['PATH.md: `lines`: title differs from volume.json'])
          self.assertEqual(K.rule1(V, PATH.replace(LINES, '')), ['PATH.md: no main-path row for `lines`'])
      def test_headings(self):
          self.assertEqual(K.rule2(V, PATH.replace(TV, '')), ['PATH.md: no heading for `tv`'])
          self.assertEqual(K.rule2(V, PATH + TV), ['PATH.md: 2 headings for `tv`'])
          self.assertEqual(K.rule2(V, PATH + '### `ghost` — Що це?\n'), ['PATH.md: heading for `ghost` is not in the journey'])
      def test_register(self):
          self.assertEqual(K.rule3(V, LEDGER, TERMS.replace('`lines/row`', '`lines/frame`')), ['PATH-ledger.md: «рядок» → `lines/row`, _terms.md → `lines/frame`'])
          self.assertEqual(K.rule3(V, LEDGER.replace('`lines/row`', '`nope/row`'), None), ['PATH-ledger.md: «рядок» → `nope/row`: no such chapter in the journey'])
          self.assertEqual(K.rule3(V, LEDGER, TERMS.replace(ROW, '')), ['_terms.md: «рядок» is missing'])
      def test_characters(self):
          self.assertEqual(K.rule4({'docs/volumes/radio/PATH.md': '64 \u00b5s\nподвір\'я\n`сузір[’\'\u02bc]`\n'}), [
              'docs/volumes/radio/PATH.md:1: micro sign U+00B5 (write U+03BC)', 'docs/volumes/radio/PATH.md:2: straight apostrophe in «подвір\u0027я» (write U+2019)'])
      def test_nowhere(self):
          got = K.rule5({'chapters/air.md': '- **Докладніше:** безпілотники тут ні до чого.\n'}, TERMS); self.assertEqual(len(got), 1); self.assertIn('chapters/air.md:1', got[0])
          self.assertIn('_terms.md: «рядок»', K.rule5({}, TERMS.replace('Ряд комірок', 'Як у радіолокації: ряд комірок'))[0])
          self.assertEqual(len(K.rule5({'chapters/x.md': 'Сусід заглушить картинку.\n'}, TERMS)), 1); self.assertEqual(K.rule5({'chapters/x.md': 'Ліхтар приглушили.\n'}, TERMS), [])
      def test_visual(self):
          names = ['Принципи', 'Подвір’я', 'Де ми', 'Кольори зі змістом', 'Екран монітора', 'Щуп і стрічка', 'Ракурси', 'Телефон', 'Чек-лист аудитора кадру']
          full = ''.join('## %d. %s\n' % (i + 1, h) for i, h in enumerate(names)); self.assertEqual(K.VISUAL_SECTIONS, names)
          self.assertEqual(K.rule6(full), []); self.assertEqual(K.rule6(full.replace('## 8. Телефон\n', '')), ['VISUAL.md: section «Телефон» missing'])
      def test_links(self):
          self.assertEqual(K.rule7(PATH, {'circuit/charge'}), ['PATH.md: link `tv/beam` → #/electricity/magnetism/lorentz: no such page in this tree'])
  ```
- [ ] **Крок 2. Побачити, що падає.** `python3 docs/volumes/radio/test_check.py` → `ModuleNotFoundError: No module named 'check'`.
- [ ] **Крок 3. Написати `check.py`.** Функції й рядки повідомлень — як у тестах. Решта повідомлень (рішення плану): ``PATH.md: main-path row `<id>` is not in the journey``, `PATH.md: main-path rows are out of order`, ``PATH.md: heading `<id>`: title differs from volume.json``, `PATH-ledger.md: «<термін>» is missing` (термін є лише в `_terms.md`). `main()` читає `volume.json`, три документи, `chapters/*.md` (без `_terms.md`) і `VISUAL.md` від кореня репозиторію (корінь — від `__file__`); файли для правила 4 збирає обходом двох каталогів без `plan48/`; множину `pages` для правила 7 — обходом `app/src/volumes/*/` (записи `том/глава` і `том/глава/крок`). У власному тексті перевірки заборонені знаки записано кодами (`'\u00b5'`), а не літерами.
- [ ] **Крок 4. Тести зелені, документів ще немає.** `python3 docs/volumes/radio/test_check.py` → `Ran 8 tests`, `OK`. `python3 docs/volumes/radio/check.py; echo $?` → рівно сім рядків: `radio check: PATH.md is missing` · `radio check: PATH-ledger.md is missing` · `radio check: journey 37 · path 0 · ledger terms 0 · links 0 · chapter documents 0` · `radio check: skipped rule 3 (chapters/_terms.md is not there yet)` · `radio check: skipped rule 6 (VISUAL.md is not there yet)` · `radio check: 2 problem(s)` · `1`.
- [ ] **Крок 5. Коміт.** `git add docs/volumes/radio/check.py docs/volumes/radio/test_check.py`; `Власна перевірка тому «Радіо»: подорож, заголовки, реєстр, знаки, теми «ніде», посилання`.

### Завдання A3b. Документи «у формі проєкту»: `VOLUME.md`, `PATH.md`, `PATH-ledger.md`

**Виконавець:** Fable 5.2 — документи переносять зміст проєкту й числа моделі.

**Файли:**
- Створити: `docs/volumes/radio/VOLUME.md`, `docs/volumes/radio/PATH.md`, `docs/volumes/radio/PATH-ledger.md`
- Тест: `python3 docs/volumes/radio/check.py` і лічильники кроку 6

**Інтерфейси:**
- Бере: `check.py` і форму документів (A3a); проєкт, частини I і II та таблицю III §1; таблицю «Поправки» і «Зменшений стандарт» — див. перед завданнями та Спільний договір.
- Дає: три документи; з них читають A4 (терміни, «Чесна фізика», «Не кажемо ніколи»), A6 (таблиця поправок), C1 (кроки `prologue` і `lines`).

Правки під час перенесення (рішення плану; діють в усіх трьох документах, решта тексту — дослівно). **П1:** позначок немає; назва позначки з проєкту стає звичайним словом у реченні й дістає адресу — «спрощено: …; сказано в «Докладніше» `<крок>`» або «лише пам’ятка авторам». Де назва була всім змістом комірки — рядок «Частинки-кульки, лічильник заряду»: «кульки — малюнок, а не вигляд частинок; на гребінець переходять мільярди електронів, лічильник показує десятки; сказано в «Докладніше» `field/charge`». Рядок «Картинка на екрані»: «підпису під екраном немає; що екран моделі має 128 × 96 комірок, а справжній — сотні тисяч, і що оновлюється він рідше за сцену, каже «Докладніше» `lines/cell`; обидва екрани чорно-білі». Крок `sat-digital/code`: «(у «Докладніше»: у моделі один довгий код)». Зворот «з чесним підписом» про кадри моделі (I §5.2, II §8.2) → «без підпису; сказано в «Докладніше» `lines/cell`». **П21** (II §0): «з повзунком маршруту монітора» → «з місцем монітора на маршруті», «на мініатюрі «де ми»» → «поруч із мініатюрою «де ми»». **П15:** мікро — `μ`, апостроф — `’`; мілісекунди як радіовеличина — `ms`. **П20:** усі вісім сторінок таблиці посилань збудовано (факти: `spec-requirements.md` §1.7), слова «чекають» немає. Хвилини гілок — зі Спільного договору; межі слів (I §4.2) — як у «Global Constraints»: стелі, а не цілі.

- [ ] **Крок 1. Побачити, що падає.** `python3 docs/volumes/radio/check.py | tail -1` → `radio check: 2 problem(s)`.
- [ ] **Крок 2. `VOLUME.md`** ← проєкт, частина I, зі збереженням номерів розділів 1–5 і таблиці рішень власника 1–26; останнім розділом `## 6. Поправки після оновлення рушія (18.11.2026)` — таблиця «Поправки» цього плану цілком, П1–П21 (три стовпчики, перша комірка — `П<N>`). У §3 анти-ціль про спрощення читається «…дозволені лише зі сказаним чесно застереженням (`PATH-ledger.md`, «Чесна фізика»)»; §4.2 — без переліку позначок; у шапці — статус «затверджено 18.11.2026» і посилання на проєкт та план.
- [ ] **Крок 3. `PATH.md`** ← проєкт II §0–§4, §8, §9 і таблиця посилань із III §1. Розділи H2 в цьому порядку: `Світ і правила` (§0) · `Основний шлях` (§1: таблиця з її шапкою, «Разом», «Нитка шляху») · `Кроки шляху` (§2; заголовок глави — ``### 4. `lines` — Як передати цілу картинку одним числом?``, пролог — ``### 0. `prologue` — …``; рядок про сцену глави — першим під заголовком; рядки кроків — дослівно) · `Гілки` (§3; кожна гілка — ``### `tv` — <питання>``, під ним рядок «після `raster` · 8 кроків · ≈ 13 хв · терміни: …»; дев’ять інженерних гілок — теж по заголовку, зміст рядка таблиці стає абзацом) · `Практикуми й лабораторії` (§4; ``### `build-analog` — Практикум. Проведіть картинку крізь подвір’я самі``) · `Посилання на курс про електрику` (таблиця III §1; перша комірка — `` `глава/крок` `` тому, для гілки `tv` — `` `tv/beam` ``; друга починається адресою в зворотних лапках) · `Ризики й відкриті питання` (§8) · `Пілот` (§9 і П4, П5, П8).
- [ ] **Крок 4. `PATH-ledger.md`** ← проєкт II §5–§7. Розділи H2: `Терміни шляху` (таблиця `№ | Термін | Крок` з 41 рядка; номери глав проєкту → id: 1 `field`, 2 `current`, 3 `wave`, 4 `lines`, 5 `carrier`, 6 `air`, 7 `select`, 8 `shift`, 9 `slope`, 10 `arrow`, 13 `compress`, 14 `packets`, 15 `points`, 16 `many`; пояснень тут немає — картки пише A4 в `_terms.md`; під таблицею — примітка про короткі назви: «радіохвиля» далі «хвиля», «обертова стрілка» — «стрілка») · `Терміни гілок` (§5.2) · `Слова лише для «Докладніше»` (§5.3 — таблиця `Слово | Примітка` з 31 рядка: 25 слів і шість абревіатур) · `Робочі слова й правила` (§5.4 і «Правила» з §5.1) · `Чого немає ніде` (§5.5) · `Чесна фізика` (таблиця §6, 29 рядків; третій стовпчик зветься «Що кажемо чесно і де»; під таблицею — «Не кажемо ніколи»: нумерований список із десяти речень, кожне в лапках «…») · `Числа моделі` (§7; абзац «Зменшений стандарт екрана» переписано числами Спільного договору: `K = 40/9`, 128 × 96, 100 рядків, рядок 288 = 7 + 21 + 26 + 234 відліки, темпи 4,5 і 22,5 MHz моделі = 20 і 100 MHz справжніх, кадр моделі 6,4 ms, гуляння `f(u) = −4,3 + 8,3·u MHz`, шум −101 dBm + 9 dB; слово «попередньо» лишається біля сходинок рівня, зламу й пари гуляння — його знімає B9c; попередні й числа відлуння — 33 ns, провали що 30 MHz, крок 6 см: за планом подвір’я з A5 виходить 35 ns, що 28 MHz і 7 см, тож «Докладніше» `air/echo` цитуватиме числа еталона, а не проєкту).
- [ ] **Крок 5. Знаки.** У трьох документах: `sed -i $'s/\u00b5/\u03bc/g' docs/volumes/radio/VOLUME.md docs/volumes/radio/PATH.md docs/volumes/radio/PATH-ledger.md`; прямі апострофи в словах → `’` (їх покаже правило 4). Про заборонений знак документи пишуть кодом: «U+00B5».
- [ ] **Крок 6. Перевірка зелена, перенесено все.** `python3 docs/volumes/radio/check.py` → `radio check: journey 37 · path 20 · ledger terms 41 · links 8 · chapter documents 0`, два рядки `skipped rule 3`, `skipped rule 6`, останній — `radio check: OK`. Лічильники повноти:
  ```bash
  S='^- `[a-z0-9-]*/[a-z0-9-]*`'; D=docs/superpowers/specs/2026-11-17-radio-volume-design.md; R=docs/volumes/radio
  grep -c "$S — " $R/PATH.md; diff <(grep -o "$S" $D | sort) <(grep -o "$S" $R/PATH.md | sort) && echo same    # 117 · same: усі кроки проєкту
  grep -c '^| [0-9][0-9]* | ' $R/VOLUME.md; grep -c '^| П[0-9]* | ' $R/VOLUME.md                              # 26 рішень · 21 поправка
  python3 - <<'EOF'
  import re, sys; sys.dont_write_bytecode = True; sys.path.insert(0, 'docs/volumes/radio'); import check as K
  L = open('docs/volumes/radio/PATH-ledger.md', encoding='utf-8').read()
  print(len(K.table(L, 'Слова лише для «Докладніше»')), len(K.table(L, 'Чесна фізика')), len(re.findall(r'^\d+\. «', L, re.M)))   # 31 29 10
  EOF
  ```
- [ ] **Крок 7. Коміт.** `git add docs/volumes/radio/VOLUME.md docs/volumes/radio/PATH.md docs/volumes/radio/PATH-ledger.md`; `Документи тому «Радіо» у формі проєкту: задум, шлях із кроками, реєстр і чесна фізика`.

### Завдання A4. Реєстр термінів, дозволені написи, правила тексту

**Виконавець:** Fable 5.2 — картки термінів і форми слів вирішують, що читач побачить і що пропустить перевірка; картки читає незалежний читач-фізик.

**Файли:**
- Створити: `docs/volumes/radio/chapters/_terms.md`, `docs/volumes/radio/terms_allowlist.tsv`, `docs/volumes/radio/COPY_STYLE.md`
- Створює інструмент (комітимо): `docs/volumes/radio/INDEX.md`, `docs/volumes/radio/GLOSSARY.md`
- Змінити: `docs/volumes/radio/PATH-ledger.md` (лише якщо правило 3 знайде розбіжність)
- Тест: `python3 tools/content/path_check.py --volume radio`; `tools/content/regen.sh --volume radio`; `python3 docs/volumes/radio/check.py`

**Інтерфейси:**
- Бере: граматику реєстру (факти: `content-pipeline.md` §2); `PATH-ledger.md` (A3b) і `check.py` (A3a).
- Дає: 41 термін шляху з формами (сценарії C1 не можуть ужити форму раніше за її крок); перелік дозволених латинських написів тому.

- [ ] **Крок 1. Побачити, що падає.** `mkdir -p docs/volumes/radio/chapters && python3 tools/content/path_check.py --volume radio; echo $?` → `error: _terms.md: missing (…/docs/volumes/radio/chapters/_terms.md)`, `1`. Проба написів (вона ж — тест кроку 5):

  ```bash
  python3 - <<'EOF'
  import sys; sys.dont_write_bytecode = True; sys.path.insert(0, 'tools/content')
  import chapters as C, terms_check as T
  C.use_volume('radio'); allow, problems = T.load_allowlist()
  line = 'dBm nW bit/s Mbit/s QPSK QAM OFDM PLL LDPC PAL SECAM FM angle(x[n]·conj(x[n−1]))·fs/2π'
  print(problems, [w for w, _ in T.latin_words(line) if not T.allowed(w, allow)])
  EOF
  ```
  Зараз друкує `[] ['dBm', 'nW', 'bit/s', 'Mbit/s', 'QPSK', 'QAM', 'OFDM', 'PLL', 'LDPC', 'PAL', 'SECAM', 'angle', 'conj', 'fs/2']` (`FM` уже дозволено загальним переліком).
- [ ] **Крок 2. `_terms.md`, таблиця `## Терміни шляху`** — стовпчики `Термін | Форми | Крок | Тип | Картка`; 41 рядок у порядку `PATH-ledger.md`; «Крок» — `` `chapter/step` ``; «Тип» — `шлях`; «Картка» — одне-два прості речення без формул і без слів, уведених пізніше; картки пише це завдання — у `PATH-ledger.md` пояснень немає. Форми (рішення плану; у таблиці `|` всередині виразу пишемо `\|`):

  ```text
  заряд \bзаряд(?!к)\w*|\bзаряджен\w*   електричне поле \bелектричн\w+ пол\w+   напруженість поля \bнапружен\w*   електрон \bелектрон\w*
  напруга \bнапру[гз]\w*   струм \bструм\w*   магнітне поле \bмагнітн\w+ пол\w+   радіохвиля \bрадіохвил\w*   частота \bчастот\w*
  герц \b(?:кіло|мега|гіга)?герц\w*   антена \bантен\w*   рядок \bрядо?к\w*   сигнал \bсигнал\w*   кадр \bкадр\w*   синхроімпульс \bсинхроімпульс\w*
  несна \bнесн\w*   розмах \bрозмах\w*   частотна модуляція \bчастотн\w+ модуляці\w+   канал \bканал\w*   завада \bзавад\w*   шум \bшум\w*
  резонанс \bрезонанс\w*   фільтр \bфільтр\w*   підсилювач \bпідсил\w*   опорна хвиля \bопорн\w*   частотний детектор \bдетектор\w*
  обмежувач \bобмежувач\w*   відлік \bвідлік\w*   обертова стрілка \bстріл(?:к|ок|ц)\w*   тіні I та Q \bI та Q\b
  аналогова лінія \bаналогов\w+ ліні\w+   цифрова лінія \bцифров\w+ ліні\w+   біт \bбіт(?:а|у|ом|і|и|ів|ам|ами|ах)?\b   стиснення \bстисненн\w*
  пакет \bпакет\w*   перевірні біти \bперевірн\w+ біт\w*   код \bкод(?:а|у|ом|і|и|ів|ам|ами|ах)?\b   символ \bсимвол\w*
  сузір’я \bсузір[’'ʼ]\w+   піднесна \bпіднесн\w*   вирівнювання \bвирівнюванн\w*
  ```
  Чому вузькі: «хвиля» вільна до `wave/free` (пролог каже «з чого зроблена хвиля»), «ряд» вільний до `lines/row`, «тінь» вільна до `arrow/two`; `\bпідсил\w*` і `\bстріл…` навмисно широкі (проєкт II §5.1, «Правила»).
- [ ] **Крок 3. Ще дві таблиці `_terms.md`.** `## Слова лише для «Докладніше»` (`Слово | Форми | Картка`) — 25 слів проєкту II §5.3 і шість абревіатур (`\bFM\b`, `\bQPSK\b`, `\bQAM\b`, `\bOFDM\b`, `\bPAL\b`, `\bSECAM\b`), 31 рядок; форма — основа й `\w*` (`\bфаз\w*`, `\bспектр\w*`), складені слова — обидві основи (`\bпроміжн\w+ частот\w*`, `\bзмінн\w+ струм\w*`, `\bключов\w+ кадр\w*`). Вузькі й неправильні форми (рішення плану): «амплітуда» `\bамплітуд(?:а|и|і|у|ою|о)\b` (не ловить «амплітудну модуляцію»), «насичення» `\bнасиченн\w*` (не ловить «насиченість»), «смуга частот» `\bсмуг\w+ частот\b` (не ловить «бічні смуги»), «теорема відліків» `\bтеорем\w+ відліків`, «контрольна сума» `\bконтрольн\w+ сум\w*`, «захисний проміжок» `\bзахисн\w+ проміж\w+`, «петля підстроювання» `\bпетл\w+ підстроюванн\w*`, «піксель» `\bпіксел\w*`, «передбачення руху» `\bпередбаченн\w+ руху`. `PLL` і `LDPC` сюди не входять: у своїх гілках вони стоять на екрані. `## Чого на шляху немає` (`Тема | Форми`) — чотири рядки з тим самим виразом, що в правилі 5: глушіння й способи заважати `\bглушінн\w*\|\b(?:за)?глуш(?:ил\|ит)\w*\|джамер\w*`; безпілотники `\bдрон\w*\|безпілотн\w*\|\bБПЛА\b`; військові застосування `військ\w*\|\bРЕБ\b`; радіолокація `радіолокац\w*\|\bРЛС\b`. Терміни гілок зараз не реєструємо: вони приходять зі своїми гілками (запис про це — `PATH-NOTES.md` §10, A6).
- [ ] **Крок 4. Картки читає незалежний читач.** Свіжий агент без контексту автора дістає таблицю «Терміни шляху» і розділи «Чесна фізика» та «Не кажемо ніколи» з `PATH-ledger.md`; повертає картки з фізичною помилкою, з терміном, ужитим раніше за свій крок, або з реченням зі списку «не кажемо». Виправити й повторити, доки список не порожній.
- [ ] **Крок 5. `terms_allowlist.tsv`** — рядки `слово<TAB>вид<TAB>пояснення<TAB>причина`, рівно чотири комірки; шапка — коментар із `#`. Рядки: `dBm`, `nW`, `bit/s`, `Mbit/s` — вид `symbol`, пояснення `—`; `QPSK` (`сузір’я з чотирьох точок`), `QAM` (`сузір’я з багатьох точок`), `OFDM` (`багато піднесних`), `PLL` (`петля підстроювання`), `LDPC` (`код із рідкими перевірками`) — вид `abbr` з українським поясненням; `PAL`, `SECAM` — вид `mark`, пояснення `—`; `angle`, `conj`, `fs` — вид `symbol`, пояснення `—` (`fs` — рішення плану: без нього запис `…·fs/2π` із `angle/step` не проходить). `FM` не повторюємо (П15). Проба з кроку 1 тепер друкує `[] []`.
- [ ] **Крок 6. `COPY_STYLE.md`** — шість розділів H2: `1. Що діє з circuit` (`docs/volumes/circuit/COPY_STYLE.md` чинний повністю) · `2. Одиниці` (побутові довжини й час — українськими знаками в підписах і словами в тексті; радіо- й електричні величини — міжнародними: V, V/m, A, Ω, Hz, kHz, MHz, GHz, W, mW, nW, dB, dBm, ms, μs, ns, bit/s, Mbit/s — перелік проєкту II §5.1 і те, що вже стоїть у його кроках; мілісекунди як радіовеличина — `ms`, не «мс»; `μ` — грецька) · `3. Абревіатури й латинські написи` (спершу українське пояснення; перелік — `terms_allowlist.tsv`) · `4. Робочі слова` (таблиця «слово → що за ним стоїть → до якого кроку живе» з проєкту II §5.4 і правил §5.1; сюди ж те, чого інструмент не ловить: «гребінець» не про хвилю на стрічці, «поріг» лише про синхроімпульси, сила передавача не вища за 10 mW) · `5. Не кажемо ніколи` (десять речень проєкту II §6) · `6. Застереження замість позначок` (П1: речення в «Докладніше» або підпис сцени; жодних «спрощена модель», «×N»).
- [ ] **Крок 7. Згенерувати й перевірити.** `tools/content/regen.sh --volume radio` → серед останніх рядків `doccheck[radio]: ALL GREEN`. `python3 tools/content/path_check.py --volume radio` → `path[radio]: 0 chapter document(s), 0 step(s), 41 register term(s) — ok`. `python3 docs/volumes/radio/check.py` → рядка `skipped rule 3` більше немає, останній рядок `radio check: OK`. `grep -c '^## ' docs/volumes/radio/COPY_STYLE.md` → `6`. `python3 tools/content/doccheck.py --all | tail -1` → `doccheck: ALL GREEN`.
  Форми читає проба — слова, які мусять лишатися вільними до свого кроку, і відмінки, які мусять ловитися:
  ```bash
  python3 - <<'EOF'
  import sys; sys.dont_write_bytecode = True; sys.path.insert(0, 'tools/content'); import path_format as F
  reg, err = F.parse_register(open('docs/volumes/radio/chapters/_terms.md', encoding='utf-8').read()); hit = lambda s: [r['name'] for k in ('terms', 'more', 'banned') for r in reg[k] if r['rx'].search(s)]
  free = ['хвиля', 'ряд комірок', 'тінь', 'стрічка', 'магніт', 'амплітудна модуляція', 'насиченість', 'бічні смуги', 'Ліхтар приглушили']
  must = {'радіохвилі': 'радіохвиля', 'рядків': 'рядок', 'стрілці': 'обертова стрілка', 'I та Q': 'тіні I та Q', 'амплітуду': 'амплітуда', 'пікселів': 'піксель',
          'захисного проміжку': 'захисний проміжок', 'петлі підстроювання': 'петля підстроювання', 'заглушити': 'глушіння й способи заважати'}
  print(len(reg['terms']), len(reg['more']), len(reg['banned']), err, [s for s in free if hit(s)], [s for s, n in must.items() if hit(s) != [n]])
  EOF
  ```
  → `41 31 4 [] [] []`.
- [ ] **Крок 8. Коміт.** `git add docs/volumes/radio/chapters/_terms.md docs/volumes/radio/terms_allowlist.tsv docs/volumes/radio/COPY_STYLE.md docs/volumes/radio/INDEX.md docs/volumes/radio/GLOSSARY.md` (і `PATH-ledger.md`, якщо правили); `Реєстр термінів тому «Радіо», дозволені латинські написи і правила тексту`.

### Завдання A5. `VISUAL.md` — візуальна мова тому й план подвір’я в метрах

**Виконавець:** Fable 5.2 — візуальна мова (рішення 17).

**Файли:**
- Створити: `docs/volumes/radio/VISUAL.md`
- Тест: `python3 docs/volumes/radio/check.py` (правило 6); команди кроків 3 і 4

**Інтерфейси:**
- Бере: `docs/volumes/circuit/VISUAL.md` (зразок і §9), `docs/STYLE_GUIDE.md` §2, §4, §8; факти: `kit-fx-ui3d.md` §2.3, §3, §5.3, §7; проєкт II §0; ключі `YARD_SHOTS`, `RouteStop`, якорі `Yard`, числа рівнів і фізику стін — див. Спільний договір.
- Дає: у «Подвір’ї» — план у метрах: числа моделі (B6a переносить їх у `site.json`), місця `places.*` і розміри предметів (B12, B13), таблицю сутінків за главами (C4, C5); в «Екрані монітора» — поля середовища для `yard/look.ts` (B13); у «Ракурсах» — вісім сталих `Shot` у метрах плану (B13); чек-лист аудитора кадру (B13, C7).

- [ ] **Крок 1. Побачити, що падає.** Створити файл з одним рядком `# Радіо — візуальна мова` і запустити `python3 docs/volumes/radio/check.py; echo $?` → дев’ять рядків `radio check: VISUAL.md: section «…» missing`, `radio check: 9 problem(s)`, `1`.
- [ ] **Крок 2. Розділи 1, 3–9.** Заголовки H2 дослівно (їх читає правило 6): «Принципи», «Подвір’я», «Де ми», «Кольори зі змістом», «Екран монітора», «Щуп і стрічка», «Ракурси», «Телефон», «Чек-лист аудитора кадру». Що кожен мусить вирішити й записати:
  - **Принципи.** Мірило еталонного кадру (що видно за три секунди); один світ на том; оператор літає лише вздовж дороги картинки або крізь лупу; текст у сцені — лише короткі підписи з документів.
  - **Де ми.** Вигляд плану `whereami`: стіни із `SITE`, стовп, маршрут, цятка монітора, три позначки глибини (подвір’я · стенд · під лупою); на телефоні — в доку. Повзунків на плані немає: маршрут і «посунути антену» — звичайні повзунки кроку поруч (`routeSlider`, `nudgeSlider`; П21).
  - **Кольори зі змістом.** E — `amber`, B — `magenta`, несна — `sky`, тіні — `sky` і `violet`, біти — `lime`, електрони — `cyan`, шум — зерно `steel`. Родини відтінків перевірки `chapter-check` (поріг — 4; рахується піксель із насиченістю ≥ 0,35 і яскравістю ≥ 0,3; родина сильна від 8 %): `amber`, `lime` → `yellow`; `magenta` → `magenta`; `sky`, `cyan` → `cyan`; `violet` → `blue`; `steel` не рахується. Правило (рішення плану): саме подвір’я малює лише `blue` (небо, сутінки, тіні) і `yellow` (ліхтар, вікна); трава, листя, цегла й кухонний блок (`steel`, а не типовий `teal`) — приглушені, з насиченістю нижче 0,35. Набір рушія `dusk` цього не тримає: його `mid`, `cloudColor`, `fogColor` і `rimColor` — `magenta` (323°, 297°, 278°, 308°), а `sunColor` — `red` (346°); том заступає ці п’ять кольорів (див. «Екран монітора»). Тоді `magenta` в кадрі — лише поле B, і радіозір (`yellow`, `magenta`, `cyan`) разом із подвір’ям дає не більш як чотири родини в будь-якому кадрі; `green` і `red` — тільки малими плямами, менш як 8 %.
  - **Екран монітора.** Комірки — найближчим сусідом, без згладжування; біле = 1,0, ореолу немає (поріг `bloomThreshold` 1,0); зерно рушія вимкнено (`grain: 0`, П2). Сутінки роблять небо і світло, а не корекція кадру (рішення плану). Поля середовища для `look.ts`: поле за полем від набору `dusk` (сутінки 0) до `night` (1); на кінці `dusk` п’ять кольорів свої — `mid`: `bg.violet` і `bg.plum` порівну; `cloudColor`: `bg.plum`; `fogColor`: `bg.indigo` і `bg.violet` порівну; `sunColor`: як у `night` (`sky` із `white`, 0,6); `rimColor`: `violet` — усі в родині `blue` або без насиченості; на обох кінцях `gradeTintAmount: 0` і `harmony: 0`, щоб сіре на екрані лишалося сірим; ледь синій підйом чорного (`gradeLift` 0,012) лишаємо. Різкість: у ракурсах `screen`, `window`, `both` поле `focus` — центр екрана, а екран стоїть у середній третині висоти кадру; якщо на знімку `screen` комірки все ж розмиті, том ставить `tiltAmount: 0` (діорама розмиває верх і низ кадру: `tiltAmount` 0,4). Екран зі снігом займає не більш як чверть площі кадру: сніг миготить із частотою кадрів моделі. Вимкнений екран — темне скло. Кухню освітлює один `PointLight` біля монітора — світло самого екрана (`Yard.screenLight`).
  - **Щуп і стрічка.** Вигляд щупа й віконця біля його кінчика; стрічка — одна крива на темному склі з тонкою сіткою `steel`; колір кривої за відведенням (на металі — `white`, після детектора — колір сигналу); розміри в частках висоти кадру.
  - **Ракурси.** Таблиця з восьми рядків, перша комірка — ключ `YARD_SHOTS` у зворотних лапках, далі `position`, `target`, `fit.center`, `fit.radius` і що в кадрі (числа — нижче); під нею по реченню про те, де герой кроку.
  - **Телефон.** Правила проєкту II §0: «оригінал і копія» (кіт і екран разом у кадрі або один у вставці); у сцені лишаються екран і стрічка, решта — в доку; не більш як чотири блоки полиці в кадрі; крок називає одне місце, куди дивитися.
  - **Чек-лист аудитора кадру.** `circuit/VISUAL.md` §9, переписаний під подвір’я, плюс рядки тому: «на екрані немає намальованого снігу: вимкнули модель — екран темний»; «не більш як чотири родини відтінків: `hues.families.length ≤ 4` у `report.json` кожного кроку (пролог — сутінки 0,15, `lines` — 0,35), а в пісочниці — у кожному з восьми ракурсів і на знімках `both` за сутінків 0, 0,5 і 1»; «камера у дворі не бачить стендів, щупа, мапи й підписів»; «екран зі снігом — не більш як чверть кадру»; «біле на екрані не дає ореолу»; «комірки екрана різкі в ракурсі `screen`»; «сутінки відповідають таблиці глави».

  Ракурси — сталі `Shot` у метрах плану: `position` → `target`, далі `fit.center` і `fit.radius` (осі — як у кроці 3; `fov` усюди 32). Числа початкові (рішення плану): B13 виправляє їх на знімках і тим самим комітом править таблицю. Читач дивиться з півдня, крім `pole`:
  ```text
  both     (9,5; −29,8; 13,1) → (9,5; −1,0; 1,5)      fit (9,3; −2,0; 1,8), 11,2      стовп із камерою і кіт ліворуч, західна стіна кухні з монітором праворуч
  yard     (14; −45; 23) → (14; −1; 1)                fit (14; −1; 1), 21             усе подвір’я: паркан, сарай, дім, гараж, вікно сусіда
  pole     (1,5; 5,5; 5,0) → (−0,3; −5,0; 1,2)        fit (0,5; −4,5; 1,5), 6,5       з-за плеча камери: кіт, хвіртка, біла стіна, закуток
  window   (14,0; −4,5; 2,4) → (19,2; −1,0; 1,4)      fit (19,3; −0,8; 1,4), 1,6      вікно кухні знадвору, крізь нього видно монітор
  screen   (20,6; −0,8; 1,25) → (19,8; 0; 1,1)        fit (19,8; 0; 1,1), 0,35        екран на кухні просто перед читачем, близько 12 % кадру; це screenShot(1)
  antenna  (20,3; −0,7; 1,5) → (19,8; 0; 1,25)        fit (19,8; 0; 1,25), 0,2        прутик монітора
  route    (23,6; −13,4; 9,7) → (23,6; 0; 0,3)        fit (23,0; 1,5; 0,2), 6,4       дім у розрізі: кухня, коридор, дальня кімната, льох і зупинка надворі
  top      (14; −1,5; 75) → (14; −1; 0)               fit (14; −1; 0), 21             план згори, північ угорі
  ```
- [ ] **Крок 3. Розділ «Подвір’я»: план у метрах.** Осі: x — схід, y — північ, z — угору; початок — земля під камерою; `yaw` — кут у плані в градусах: 0 — предмет дивиться на схід, 90 — на північ. Дім стоїть на схід від стовпа; камера дивиться на південь уздовж західного паркану, тож ні дому, ні гаража не бачить. Числа моделі (рішення плану) перевіряє команда нижче; B6a переносить їх у `site.json` і, якщо еталон змусить щось пересунути, тим самим комітом править цей розділ:

  | Що | Де, м | Примітка |
  |---|---|---|
  | `tx`: антена камери; звідси модель шле хвилю | (0; 0; 3,0) | об’єктив — на 0,2 м нижче, (0; 0; 2,8) |
  | зупинки `yard`, `kitchen`, `hallway`, `far-room`, `cellar` | (19,0; 6,0; 1,2), (19,8; 0; 1,2), (23,2; 0; 1,2), (27,2; 0; 1,2), (26,6; 0; −1,5) | точка — прутик монітора; `yaw` монітора всюди −45°: екран видно і з півдня, і зі сходу |
  | перекриття над льохом (`slabZ`) | z = −0,2 | льох — під дальньою кімнатою, підлога на −2,5 |
  | стулка воріт гаража (`gateLeaf`), відчинена | вісь (27,25; −4,8) → вільний кінець (25,8; −6,75) | 2,43 × 2,2 м, залізо; у бік дому відбиває лише відчинена |
  | вісь «посунути антену» (`nudgeAxis`) | (0,866; −0,5) | уздовж різниці напрямків двох хвиль у коридорі |
  | роутер сусіда; піч | (12; 14; 2), 10 mW; (19,8; 0,6; 1,0), назовні 0,1 mW | рівні завад добирає B7 |

  Стіни — відрізок у плані й матеріал; у `VISUAL.md` — таблицею, по рядку на стіну, перша комірка — `` `id` ``. Для моделі стіна не має меж по висоті; у сцені стіни дому — 0…2,7 м, шафи — 0…2,0 м. Вікно кухні — у західній стіні, y −1,8…−0,2, z 0,9…2,1, а підвіконня — дошка, довша за вікно: монітор стоїть на ній поруч із вікном, тож між ним і камерою цегла, як у моделі (вікон модель не має).
  ```text
  shell-w (19,2; −3) → (19,2; 3) цегла · shell-s (19,2; −3) → (28,6; −3) цегла · shell-n (19,2; 3) → (28,6; 3) цегла · shell-e (28,6; −3) → (28,6; 3) цегла
  partition (21,4; −3) → (21,4; 3) дерево — перегородка між кухнею й коридором · cupboard (21,7; −3) → (21,7; 3) дерево — шафа-стінка вздовж неї
  inner (25,0; −3) → (25,0; 3) цегла — між коридором і дальньою кімнатою · шафа під південною стіною коридору: wardrobe-doors (21,7; −2,4) → (25,0; −2,4) дерево, wardrobe-back (21,7; −2,7) → (25,0; −2,7) дерево
  ```
  Те, що знає лише сцена (B12, B13), — місце й `yaw`; у `VISUAL.md` — таблицею, по рядку на місце, перша комірка — `` `places.<назва>` ``. Числа початкові: B13 виправляє їх на знімках і тим самим комітом править таблицю.
  ```text
  LENS.lookAt (0; −6,0; 0,45), поле зору 40° — з об’єктива (0; 0; 2,8) кіт, хвіртка, біла стіна й закуток не далі 0,75 пів кадру від центру
  places.pole (0; 0; 0) · −90 — стовп 3,2 м, обидві камери дивляться на південь      places.wicket (−1,2; −3,2; 0,55) · 0 — середина хвіртки 1,0 × 1,1 м у західному паркані
  places.cat (−1,2; −5,2; 1,3) · 90 — кіт 0,45 м на паркані, мордою до камери: до об’єктива 5,5 м, 10,7 комірки; біла цятка на лобі 5 см — одна-дві комірки
  places.shedWall (0,8; −9,0; 1,2) · 90 — біле кадру; сарай x −1,0…2,6, y −12…−9, 2,4 м      places.nook (3,3; −9,2; 0,9) · 90 — чорне кадру: отвір дровника, x 2,6…4,0
  places.swing (8,0; 5,0; 0) · 0 — 2,2 м      places.bicycle (18,6; 1,6; 0) · 90 — під західною стіною дому, на північ від вікна      places.lantern (−1,2; −7,0; 0) · 0 — 3,2 м, жарівка поза кадром камери
  places.trayRest (19,7; 1,5; 0,95) · 0 — деко на стільниці кухонного блока      телефон на підвіконні перед вікном (19,45; −0,8; 1,0)      кухонний блок — уздовж західної стіни на північ від монітора, якір microwave збігається з піччю      екран монітора 0,32 × 0,24 м, прутики по 6 см
  паркан (−1,2; −9) → (−1,2; 12) → (30; 12), 1,1 м, штахета 6 см і проміжок 6 см — півтори комірки на кадрі камери      дерева (4; 10), (15; 10,5), (24; 10,5), (−3,5; 6), (−3,5; −1)      острів: центр (14; −1), радіус 21
  гараж x 27,25…32,0, y −9,7…−4,8, 2,6 м, залізо, ворота на захід; зачинена стулка лежить уздовж x = 27,25, до (27,25; −7,23)      вікно сусіда (12; 14; 0) · −90, роутер на підвіконні
  ```
  Таблиця сутінків (рішення плану) — теж у «Подвір’ї», параметр `dusk` за главами: пролог 0,15; глави 1–12 — по +0,05 (від `field` 0,20 до `raster` 0,75; `lines` — 0,35); `build-analog` 0,80; глави 13–17 — від 0,82 до 0,94 з кроком 0,03; `build-digital` 1,00; гілка й лабораторія беруть значення батька. Ліхтар горить від 0,4.

  Умови, які план мусить тримати (звідки ці числа): рівень зупинки = `12,2 − 20·lg(4π·d/0,1224) − Σ стін` dBm, у межах ± 1,0 dB від цілі −54 / −62 / −70 / −78 / −88; кожна кімната додає близько 1 dB відстанню, тому між кухнею й коридором дві дерев’яні стінки (6 dB), а не цегла. Стулка: відбита хвиля до коридору на 10,6 м довша за пряму (провали що 28,3 MHz, ціль 27–33) і проходить стільки ж децибелів стін, скільки пряма (14 = 14: цегла й дві стінки шафи проти цегли, перегородки й шафи-стінки) — тоді мертва точка має глибину 10,1 dB (ціль 8…10,5); хвилі сходяться під кутом 119° (щонайменше 100°, інакше мертві точки рідші за 8 см; за планом — що 7,1 см); промінь до стулки проходить повз південну стіну дому (y = −4,2 на x = 19,2) і влучає в середину стулки (0,54 її довжини). Перевірка плану:
  ```bash
  python3 - <<'EOF'
  import math
  TX = (0, 0, 3.0); STOPS = [(19.0, 6.0, 1.2), (19.8, 0, 1.2), (23.2, 0, 1.2), (27.2, 0, 1.2), (26.6, 0, -1.5)]; SLAB = -0.2; A, B = (27.25, -4.8), (25.8, -6.75)
  WALLS = [((19.2, -3), (19.2, 3), 8), ((19.2, -3), (28.6, -3), 8), ((19.2, 3), (28.6, 3), 8), ((28.6, -3), (28.6, 3), 8), ((21.4, -3), (21.4, 3), 3),
           ((21.7, -3), (21.7, 3), 3), ((25.0, -3), (25.0, 3), 8), ((21.7, -2.4), (25.0, -2.4), 3), ((21.7, -2.7), (25.0, -2.7), 3)]
  side = lambda u, v, w: (v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])
  loss = lambda p, q: sum(d for a, b, d in WALLS if side(p, q, a) * side(p, q, b) < 0 and side(a, b, p) * side(a, b, q) < 0) + 10 * ((p[2] - SLAB) * (q[2] - SLAB) < 0)
  print(' / '.join('%.1f' % (12.2 - 20 * math.log10(4 * math.pi * math.dist(TX, s) / 0.1224) - loss(TX, s)) for s in STOPS))
  L = math.dist(A, B); u = ((B[0] - A[0]) / L, (B[1] - A[1]) / L); t = -A[0] * u[0] - A[1] * u[1]; rx = STOPS[2]
  IMG = (2 * (A[0] + t * u[0]), 2 * (A[1] + t * u[1]), TX[2]); s = side(A, B, IMG) / (side(A, B, IMG) - side(A, B, rx))    # камера, відбита в площині стулки
  R = tuple(IMG[i] + s * (rx[i] - IMG[i]) for i in range(3)); on = ((R[0] - A[0]) * u[0] + (R[1] - A[1]) * u[1]) / L       # точка відбиття, її місце на стулці
  dd, dr = math.dist(TX, rx), math.dist(IMG, rx); wd, wr = loss(TX, rx), loss(TX, R) + loss(R, rx); ratio = dd / dr * 10 ** ((wd - wr) / 20)
  k = [(rx[i] - TX[i]) / dd - (rx[i] - R[i]) / math.dist(R, rx) for i in range(2)]; n = math.hypot(*k); e = dr - dd
  print('leaf %.2f · extra %.1f m · %.1f ns · every %.1f MHz · walls %d = %d dB · depth %.1f dB · axis (%.2f; %.2f) · step %.1f cm' % (on, e, e / 0.29979, 299.79 / e, wd, wr, -20 * math.log10(1 - ratio), k[0] / n, k[1] / n, 12.24 / n))
  EOF
  ```
  → `-54.1 / -62.0 / -69.4 / -78.7 / -88.6` і `leaf 0.54 · extra 10.6 m · 35.3 ns · every 28.3 MHz · walls 14 = 14 dB · depth 10.1 dB · axis (0.86; -0.51) · step 7.1 cm`.
- [ ] **Крок 4. Перевірка зелена, таблиці повні.** `python3 docs/volumes/radio/check.py` → жодного рядка `skipped`, останній рядок `radio check: OK`. ``V=docs/volumes/radio/VISUAL.md; grep -cE '^\| `(both|yard|pole|window|screen|antenna|route|top)` \|' $V; grep -c '^| `places\.' $V; grep -cE '^\| `(shell-[wsne]|partition|cupboard|inner|wardrobe-(doors|back))` \|' $V`` → `8`, `9`, `9`.
- [ ] **Крок 5. Коміт.** `git add docs/volumes/radio/VISUAL.md`; `Візуальна мова тому «Радіо»: подвір’я в метрах, кольори зі змістом, екран, ракурси, чек-лист кадру`.

### Завдання A6. `PATH-NOTES.md` — формат і рушій, як їх перевіряють інструменти

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `docs/volumes/radio/PATH-NOTES.md`
- Тест: команди кроку 3

**Інтерфейси:**
- Бере: `docs/superpowers/plans/2026-11-18-radio-pilot/facts/*.md` (лишаються в репозиторії як докладне джерело); `tools/site/README.md` і `qa-env.sh` (A7); таблицю «Поправки» цього плану.
- Дає: одну сторінку-вхід для автора сценарію й будівника глави (C1–C7); розділ «Журнал рішень», куди наступні черги дописують рішення з датою.

- [ ] **Крок 1. Каркас із десяти розділів H2** (рішення плану), у цьому порядку: `1. Звідки це взято` (по рядку на кожен із десяти звітів: що в ньому шукати) · `2. Сценарій глави: граматика` (факти: `content-pipeline.md` §1; один справжній приклад — крок `atoms` із `docs/volumes/circuit/chapters/wire.md:13-35`; відмінності шарів — таблиця §1.5) · `3. Реєстр _terms.md` (§2: три таблиці, як перевіряється порядок) · `4. Межі й перевірки` (§3.1 — таблиця меж; §3.2–3.3 — кожна перевірка з дослівним текстом помилки; що не перевіряє ніхто) · `5. Команди` (§4 і команди тому: `regen.sh --volume radio`, `path_check.py --volume radio`, `typography.py --write --volume radio`, `docs/volumes/radio/check.py`) · `6. Файли глави в коді` (шаблон `circuit/wire`; факти: `volume-anatomy.md` §1.1, §7.2 і `reference-chapters.md` §1) · `7. Рушій для глави на одній сторінці` (життєвий цикл, `ChapterContext`, керування й цілі, камера, детермінізм — по два-три рядки з посиланнями на розділи `docs/ENGINE_API.md` і на факти: `chapter-api.md`) · `8. Перевірки в браузері на цій машині` (факти: `baseline-checks.md`; `source tools/site/qa-env.sh`, `site_serve`, `--base`, `--out`, `--skip perf`, замінники ImageMagick; що пропускаємо й чому; правило робочої копії профілю з `tools/site/README.md`: у ній не запускати pnpm і corepack, а зіпсований `app/node_modules` лагодить `(cd app && pnpm install --frozen-lockfile --offline)`) · `9. Пастки, які записав circuit` (факти: `reference-chapters.md` §6; розділи «Surprises» інших звітів — лише те, що стосується глави) · `10. Журнал рішень` (таблиця «Поправки» цілком, П1–П21, — ті самі рядки, що у `VOLUME.md` §6; під нею три пункти проєкту, які черга 1 відкладає, з чергою, що їх закриває: емблеми груп — `volume.ts` поки без `emblems`, бо набір рушія малює лише емблеми курсу про електрику, — коли в платформі з’являться емблеми радіо; підпис позначки «Основи» «з чого зроблена хвиля» — в `AxisFloor` такого поля немає, підпис стоїть на мапі в сцені прологу, черга 3; терміни гілок (проєкт III §2) — у `_terms.md` з типом «шлях» і кроком своєї гілки, разом зі звіркою «термін гілки не стоїть на екрані поза своєю гілкою» правилом у `check.py`, з першою гілкою, черга 9; далі порожній список із датою).
- [ ] **Крок 2. Заповнити.** Українська проза, ідентифікатори як у коді; нічого не вигадувати понад звіти — якщо факту в них немає, відкрити файл рушія й навести шлях із рядком. Не більш як 400 рядків: довгі таблиці лишаються у звітах, сюди — правило й посилання.
- [ ] **Крок 3. Перевірити.**

  ```bash
  wc -l < docs/volumes/radio/PATH-NOTES.md                 # ≤ 400
  grep -c '^## ' docs/volumes/radio/PATH-NOTES.md          # 10
  grep -o 'facts/[a-z0-9-]*\.md' docs/volumes/radio/PATH-NOTES.md | sort -u | while read -r f; do
    test -f "docs/superpowers/plans/2026-11-18-radio-pilot/$f" || echo "MISSING $f"; done    # нічого не друкує
  diff <(grep '^| П[0-9]* | ' docs/volumes/radio/VOLUME.md) <(grep '^| П[0-9]* | ' docs/volumes/radio/PATH-NOTES.md) | wc -l   # 0: двадцять один рядок поправок той самий
  python3 docs/volumes/radio/check.py | tail -1            # radio check: OK
  ```
- [ ] **Крок 4. Коміт.** `git add docs/volumes/radio/PATH-NOTES.md`; `Запис формату «шлях» і рушія для авторів тому «Радіо»`.

### Завдання A7. Профіль сайту `tools/site`

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `tools/site/build.mjs`, `tools/site/smoke.mjs`, `tools/site/qa-env.sh`, `tools/site/shims/{montage,identify,mogrify}`, `tools/site/README.md`
- Тест: команди кроків 1, 4–7 (збірка сама закінчується перевіркою в браузері)

**Інтерфейси:**
- Бере: прототипи `docs/superpowers/plans/2026-11-18-radio-pilot/prototypes/site/{build.mjs,smoke.mjs}` і `prototypes/qa-shims/*` (перевірені; факти: `site-profile-probe.md`); `volume.json` тому (A2).
- Дає:
  - `node tools/site/build.mjs [--volume radio] [--out tools/site/dist] [--sub radio-pop-science] [--port 5391] [--no-smoke] [--keep-work]` — останній рядок `PASS site smoke`, вихід 0; дерево репозиторію не змінюється. З `--keep-work` друкує шлях робочої копії й правило: у ній не запускати pnpm і corepack.
  - `node tools/site/smoke.mjs --dist <dir> --volume <id> [--sub …] [--port …]` · `--dist <dir> --serve [--port …]` · `--url <адреса зі скісною рискою в кінці> --volume <id>` (нічого не роздає, перевіряє вже розданий сайт).
  - `source tools/site/qa-env.sh` → прелюдія Node 24, `QA_ALLOW_SOFTWARE=1`, `QA_OUT` (типово `$HOME/.cache/radio-pop-science/qa`, каталог створено), `tools/site/shims` на початку `PATH`, лише якщо `montage` у системі немає; функції `site_serve [порт] [каталог]` (друкує адресу `http://127.0.0.1:<порт>/radio-pop-science/`) і `site_stop [порт]` (повертається, коли порт уже вільний); типові значення — 5391 і `tools/site/dist`.

- [ ] **Крок 1. Побачити, що падає.** `node tools/site/build.mjs --volume nope; echo $?` → `Cannot find module`, `1`.
- [ ] **Крок 2. Перенести прототипи.** `mkdir -p tools/site/shims && cp docs/superpowers/plans/2026-11-18-radio-pilot/prototypes/site/build.mjs docs/superpowers/plans/2026-11-18-radio-pilot/prototypes/site/smoke.mjs tools/site/ && cp docs/superpowers/plans/2026-11-18-radio-pilot/prototypes/qa-shims/montage docs/superpowers/plans/2026-11-18-radio-pilot/prototypes/qa-shims/identify docs/superpowers/plans/2026-11-18-radio-pilot/prototypes/qa-shims/mogrify tools/site/shims/ && chmod +x tools/site/shims/*`. У `build.mjs` дві зміни проти прототипу — `note` у виклику `smoke` (крок 3) і застереження про робочу копію (нижче); решта як є: копія `app/` без `node_modules`, `dist`, `.vite`; у копії — лише том, `library.json` = `{ "title": null, "defaultVolume": "<том>" }` без `legacyVolume`, `status` → `published`; `tsc`, `vite build --outDir <out> --emptyOutDir`.
  Друга зміна `build.mjs`: рядок `site: work copy kept at <шлях>` (з `--keep-work`) і повідомлення про невдалу збірку (`… failed (work copy kept: <шлях>)`) закінчуються словами ` — do not run pnpm or corepack in it`. Чому: `node_modules` копії — посилання на справжній `app/node_modules`; pnpm 12, запущений у копії (`pnpm test`, `pnpm typecheck`), спершу перев’язує його на шлях копії, і після її вилучення `tsc`, `vite` й `vitest` в `app/` не знаходять пакетів. Сама збірка кличе `app/node_modules/.bin/tsc` і `…/vite` напряму.
- [ ] **Крок 3. Доробити `smoke.mjs`** (рішення плану):
  - `smoke({ dist | url, sub, port, volume, title, note, appDir })`: з `url` сервер не піднімається, усі запити мусять лишатися під цією адресою.
  - Запущений із командного рядка, `smoke.mjs` бере очікувані `title` і `note` з `app/src/volumes/<том>/volume.json` (заголовок — `subtitle`, якщо `headline: "subtitle"`, інакше `title`; `note` — `emptyNote`, а без нього порожній рядок), а не зі зібраного `index.html`. `build.mjs` передає ті самі два значення: у його виклику `smoke` до `title: headline` додається `note: identity.emptyNote ?? ''`.
  - Том без глав: додаткова перевірка `home: the lobby shows the volume's note` — `home.names.includes('home-empty') && home.text.includes(note)` (П4). Том із главами: `home.names` містить `home-start` або `home-resume`, і далі перевірка глибокого посилання, як у прототипі.
  - Немає `<dist>/index.html` → одразу `site: <dist>/index.html is missing`, вихід 1 (без запуску браузера).
- [ ] **Крок 4. Збірка тому.** `node tools/site/build.mjs --volume radio; echo $?` → перший рядок `site: volume radio (draft → published); removed from the copy: _demo _dev _path circuit electricity`, усі рядки перевірки починаються з `ok`, серед них `home: the only volume is radio`, останні рядки `PASS site smoke`, `0` (15–20 с). Далі: `git status --short` → лише `?? tools/site/` (збірка в `tools/site/dist` ігнорується правилом `dist/`); `grep -o '<title>[^<]*</title>' tools/site/dist/index.html` → `<title>Радіо</title>`; `ls tools/site/dist/assets | grep -cE 'electricity|circuit|_dev|_demo|_path'` → `0`.
- [ ] **Крок 5. Відмови.** `node tools/site/build.mjs --volume nope; echo $?` → `site: app/src/volumes/nope/volume.json is missing`, `1`. `node tools/site/smoke.mjs --dist "$(mktemp -d)" --volume radio; echo $?` → `site: … index.html is missing`, `1`. `node tools/site/build.mjs --volume circuit --out "$HOME/.cache/radio-pop-science/site-circuit"` → серед рядків `deep link: #/circuit/prologue/click opens that step`, останній `PASS site smoke` (30–35 с).
- [ ] **Крок 6. `qa-env.sh`.** Корінь репозиторію — від `${BASH_SOURCE[0]}`. `site_serve` запускає `node tools/site/smoke.mjs --dist <каталог> --serve --port <порт>` відокремлено (`setsid nohup … &`, журнал у `$QA_OUT/site-<порт>.log`), чекає відповіді 200 до 10 с і друкує адресу; `site_stop` убиває того, хто слухає порт (`ss -ltnpH "sport = :<порт>"` → `pid=`), бо `$!` і `pkill -f` тут не працюють (факти: `baseline-checks.md`, «Server»), і повертається, щойно `ss -ltnH "sport = :<порт>"` порожній (чекає до 5 с). Обидва очікування — цикли всередині функцій: окремого `sleep` у команді агента бути не повинно. Перевірки (третя вперше запускає режим `--url`; якби він піднімав власний сервер, порт був би зайнятий):
  ```bash
  bash -c 'source tools/site/qa-env.sh; node -v; command -v montage; echo "$QA_ALLOW_SOFTWARE $QA_OUT"'
  bash -c 'source tools/site/qa-env.sh; tools/qa/sheet.sh "$QA_OUT/shim-test.jpg" --cols 2 app/public/fonts/body.png app/public/fonts/mono.png'
  bash -c 'source tools/site/qa-env.sh; site_serve >/dev/null; U=http://127.0.0.1:5391/radio-pop-science/
    curl -s -o /dev/null -o /dev/null -w "%{http_code} " $U http://127.0.0.1:5391/; node tools/site/smoke.mjs --url $U --volume radio | tail -1
    node tools/site/smoke.mjs --url $U --volume circuit | grep -c "^FAILED site smoke"; site_stop; curl -s -o /dev/null -w "%{http_code}\n" $U'
  ```
  → перша: `v24.22.3`, `<корінь>/tools/site/shims/montage`, `1 /home/<користувач>/.cache/radio-pop-science/qa`; друга: `sheet …/shim-test.jpg (1304x254, 2 tiles)`; третя: `200 404 PASS site smoke`, `1`, `000`.
- [ ] **Крок 7. Дорога перевірок глав по збірці профілю** (нею підуть C4–C7; тут — на готовому томі `circuit`; разом близько двох хвилин — тому у фоні, `run_in_background`, а висновок — за виводом після завершення):
  ```bash
  bash -c 'source tools/site/qa-env.sh; site_serve 5392 "$HOME/.cache/radio-pop-science/site-circuit" >/dev/null; B=http://127.0.0.1:5392/radio-pop-science/
    node tools/qa/chapter-check.mjs circuit/prologue --base $B --skip perf --out "$QA_OUT/site-circuit"; echo "exit $?"
    node tools/qa/mobile-check.mjs circuit/prologue --base $B --profiles pp --skip perf --out "$QA_OUT/site-circuit" | tail -1; site_stop 5392'
  ```
  → `PASS circuit/prologue — report: …/site-circuit/circuit-prologue/report.json`, `exit 0`, далі `mobile-check circuit/prologue: PASS — 0 failure(s), …` (аркуші телефона збирають ті самі замінники). Після цього `rm -rf "$HOME/.cache/radio-pop-science/site-circuit"` і знову `node tools/site/build.mjs --volume radio`, щоб у `tools/site/dist` лежав сайт тому.
- [ ] **Крок 8. `tools/site/README.md`.** Розділи: що робить профіль і чого не чіпає (три зміни в копії); три команди з прикладами, серед них `smoke.mjs --url`; змінні `QA_CHROME`, `QA_CHROME_ARGS`; `qa-env.sh` і приклад із кроку 7; замінники ImageMagick потребують Pillow у `/usr/bin/python3`; правило робочої копії (`--keep-work` або невдала збірка): у ній не запускати pnpm і corepack, а `tsc` і `vite` кликати з `app/node_modules/.bin/` — причина та сама, що в кроці 2; якщо `app/node_modules` уже зіпсовано, лагодить `(cd app && pnpm install --frozen-lockfile --offline)` (сховище тепле, мережа не потрібна); модульні тести в копії профілю не запускаємо (вісім тестів платформи там падають за побудовою); дві поламки, які ловить лише браузер (`legacyVolume`, том лишився чернеткою).
- [ ] **Крок 9. Коміт.** `git add tools/site/build.mjs tools/site/smoke.mjs tools/site/qa-env.sh tools/site/shims/montage tools/site/shims/identify tools/site/shims/mogrify tools/site/README.md`; `Профіль сайту: збірка одного тому з перевіркою в браузері і середовище для перевірок глав`.

### Завдання A8. Публікація: `.github/workflows/pages.yml`

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `.github/workflows/pages.yml`
- Змінити: `tools/site/README.md` (розділ «Публікація»)
- Тест: команда кроку 1

**Інтерфейси:**
- Бере: `tools/site/build.mjs` (A7), `docs/volumes/radio/check.py` (A3a); блок YAML із фактів `site-profile-probe.md`, «Proposed workflow (yaml)».
- Дає: потік `pages` з роботами `build` і `deploy`; кроки `build` звуться `pnpm`, `Install`, `Types`, `Lint`, `Unit tests`, `Documents`, `Pages settings`, `Site profile`. За цими іменами ворота черг розпізнають, що впало, і беруть рівно один запасний хід (рішення плану; у README — таблицею «що впало — що це означає — що робимо»):
  - `Pages settings` — власник іще не ввімкнув Pages. Не дефект: просимо ввімкнути й натиснути «Re-run all jobs»; порожніх комітів не робимо; чергу закриваємо за кроком 6 з A9.
  - `Site profile`, а кроки до нього зелені — Chrome або WebGL2 на машині GitHub. У команді кроку додати `--no-smoke`; у README — рядок, що димова перевірка лишилася локальними воротами.
  - `actions/upload-pages-artifact@v5` або робота `deploy` — найновіші версії дій не працюють разом. Повернути `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`.
  - `Types`, `Lint`, `Unit tests`, `Documents`, `Install` — дерево на чистій машині поводиться інакше. Відтворити в чистому клоні (`git clone . "$(mktemp -d)"`), знайти причину, виправити її.

- [ ] **Крок 1. Написати перевірку, що падає.**

  ```bash
  python3 - <<'EOF'
  import yaml
  d = yaml.safe_load(open('.github/workflows/pages.yml'))
  on, steps = d[True], d['jobs']['build']['steps']      # PyYAML читає ключ `on` як True
  assert sorted(on) == ['push', 'workflow_dispatch'] and on['push'] == {'branches': ['main']}
  assert [s.get('name') or s['uses'] for s in steps] == ['actions/checkout@v7', 'actions/setup-node@v7', 'pnpm', 'Install',
      'Types', 'Lint', 'Unit tests', 'Documents', 'Pages settings', 'Site profile', 'actions/upload-pages-artifact@v5']
  docs = next(s for s in steps if s.get('name') == 'Documents')['run']
  assert 'tools/content/doccheck.py --all' in docs and 'docs/volumes/radio/check.py' in docs and 'docs/volumes/radio/test_check.py' in docs
  assert 'tools/site/build.mjs --volume radio' in next(s for s in steps if s.get('name') == 'Site profile')['run']
  assert d['permissions'] == {'contents': 'read'} and d['jobs']['deploy']['permissions'] == {'pages': 'write', 'id-token': 'write'}
  print('pages.yml: OK')
  EOF
  ```
  → `FileNotFoundError: … '.github/workflows/pages.yml'`.
- [ ] **Крок 2. Написати `pages.yml`.** Блок YAML із фактів дослівно, з двома змінами: коментар `(not in the design)` прибрати; крок `Documents` стає багаторядковим — `python3 tools/content/doccheck.py --all`, під ним `python3 docs/volumes/radio/test_check.py` і `python3 docs/volumes/radio/check.py`. Що лишається як у фактах і чому: `runs-on: ubuntu-24.04`; Node 24 через `actions/setup-node@v7` з `package-manager-cache: false`; pnpm — `corepack enable`, кожна команда pnpm із `working-directory: app`; `Pages settings` (`actions/configure-pages@v6`) стоїть перед збіркою і дає `base_path` для `--sub`; збірка йде в `$RUNNER_TEMP/site`; ні `.nojekyll`, ні `404.html`, ні `--base` не потрібні (маршрути — лише після `#`, `base: './'`); `concurrency: { group: pages, cancel-in-progress: false }`.
- [ ] **Крок 3. Перевірка зелена.** Команда кроку 1 → `pages.yml: OK`.
- [ ] **Крок 4. `tools/site/README.md`, розділ «Публікація».** Адреса сайту; одноразова дія власника (Settings → Pages → Build and deployment → Source: GitHub Actions); потік запускається надсиланням у `main` і вручну; запасні ходи з розділу «Інтерфейси» цього завдання — таблицею — і правило: якщо в потоці стоїть `--no-smoke`, димова перевірка лишається локальними воротами, а після публікації сайт перевіряє `smoke.mjs --url`; дві перевірки зразків еталона (з черги 2) у потоці не стоять — їм потрібні numpy і scipy, вони лише в локальних воротах.
- [ ] **Крок 5. Коміт.** `git add .github/workflows/pages.yml tools/site/README.md`; `Публікація сайту тому на GitHub Pages після перевірок повного дерева`.

### Завдання A9. Ворота черги 1, надсилання, перевірка сайту

**Виконавець:** Opus 5.5

**Файли:**
- Змінити: `.github/workflows/pages.yml`, `tools/site/README.md` — лише якщо знадобиться запасний хід з A8
- Тест: блок «Ворота черги»; `node tools/site/smoke.mjs --url https://codir.github.io/radio-pop-science/ --volume radio`

**Інтерфейси:**
- Бере: блок «Ворота черги» — див. Спільний договір; імена кроків потоку й запасні ходи (A8).
- Дає: черга 1 в `origin/main`; сайт за адресою `https://codir.github.io/radio-pop-science/`; звіт власникові; спосіб стежити за потоком (крок 3) — ним користуються ворота черг 2 і 3.

- [ ] **Крок 1. Ворота.** `git branch --show-current` → `main` (інакше спершу злиття гілок, як у вступі черги). Блок «Ворота черги» цілком; очікуване: `Tests  1611 passed (1611)`, `doccheck: ALL GREEN` (серед рядків — `path[radio]: 0 chapter document(s), 0 step(s), 41 register term(s) — ok`), `radio check: OK` без жодного `skipped` (`python3 docs/volumes/radio/check.py | grep -c skipped` → `0`), `python3 docs/volumes/radio/test_check.py 2>&1 | tail -1` → `OK`, `PASS site smoke`, `git status --short` порожній. Приміток про ШІ немає в наших комітах: `git log --first-parent --no-merges 63fd42c..HEAD --format=%B | grep -ciE 'co-authored-by|generated with|claude\.ai'` → `0` (коміти синхронізацій `upstream`, влиті в `main`, мають власні підписи; `--first-parent` їх оминає).
- [ ] **Крок 2. Надіслати.** `git push origin main` (без `--force`; якщо відмовлено — зупинитися й доповісти). `git status -sb | head -1` → `## main...origin/main`, без слова `ahead`.
- [ ] **Крок 3. Стежити за потоком через відкритий API** (`gh` тут немає). Команда триває до 15 хв, тому її запускають у фоні (у Claude Code — `run_in_background: true`): команду переднього плану оболонка агента обриває через 2–10 хв і не дозволяє в ній `sleep`. Без ключа API дає 60 запитів на годину, тому питаємо раз на хвилину. Коміт — вершина `origin/main`, а не `HEAD`: коли крок 3 продовжують пізніше (крок 6), місцева `main` може вже піти вперед.
  ```bash
  SHA=$(git rev-parse origin/main); API=https://api.github.com/repos/Codir/radio-pop-science/actions
  for i in $(seq 1 15); do
    RUN=$(curl -s "$API/runs?per_page=5" | jq -r --arg s "$SHA" 'if .message then "api: " + .message else ([.workflow_runs[] | select(.head_sha == $s)][0] | "\(.id) \(.status) \(.conclusion)") end')
    echo "$RUN"; case "$RUN" in api:*|*completed*) break ;; esac; sleep 60
  done
  ```
  Очікуване закінчення — `<id> completed success`. `null null null` — запуск іще не з’явився. `api: Not Found` (репозиторій закритий) або `api: API rate limit exceeded…` — стежити нема чим: крок 6.
- [ ] **Крок 4. Якщо `completed failure` — знайти крок і застосувати рівно один запасний хід з A8.** `curl -s https://api.github.com/repos/Codir/radio-pop-science/actions/runs/<id>/jobs | jq -r '.jobs[] | .name + ": " + (.conclusion // "—"), (.steps[] | select(.conclusion == "failure") | "  ✗ " + .name)'`, де `<id>` — перше число останнього рядка кроку 3. Кожен хід — окремий коміт (явні шляхи; наприклад `У потоці Pages повернуто попередні версії дій`), надсилання і знову крок 3. Після третього невдалого кола API більше не питаємо: зупинитися й доповісти.
- [ ] **Крок 5. Перевірити живий сайт.** `node tools/site/smoke.mjs --url https://codir.github.io/radio-pop-science/ --volume radio; echo $?` → `PASS site smoke`, `0`. Сторінка з’являється за хвилину-дві після успіху потоку: якщо відповідь 404, повторити до трьох разів із перервою в хвилину (чекати теж фоновою командою).
- [ ] **Крок 6. Чим закінчується черга, коли сайт залежить не від нас.** Упав `Pages settings` (власник іще не ввімкнув Pages) або API відповів `api: …`. Тоді чергу 1 закривають ворота кроку 1 і надсилання кроку 2; у звіті стоїть відкритий рядок «живий сайт не перевірено: <причина>»; черга 2 може починатися; коли власник увімкне Pages і перезапустить потік, це завдання продовжують із кроку 3.
- [ ] **Крок 7. Звіт власникові** — повідомлення українською (не файл), п’ять пунктів: адреса сайту; що він показує зараз — вестибюль: «Радіо», «Від електрона до екрана», рядок «Перші глави — в роботі», позаду непідписані плити глав, а мапа з підписами з’явиться з першою главою (П4); де документи (`docs/volumes/radio/`: `VOLUME.md`, `PATH.md`, `PATH-ledger.md`, `VISUAL.md`, `COPY_STYLE.md`, `PATH-NOTES.md`) і що перевіряє `check.py`; що вийшло інакше, ніж у проєкті, — поправки, які змінили чергу 1 (П1, П3, П4, П6, П15, П18, П19, П20), одним рядком кожна; що потрібно від власника: джерело Pages (якщо ще не ввімкнено, разом із відкритим рядком кроку 6), документи формату (рішення 26), терпимий до нових томів тест `volumes.test.ts:30` в `upstream` (П3), слова «на слух» із проєкту II §8.7.
- [ ] **Крок 8. Коміт.** Лише якщо крок 4 щось змінив (тоді коміти вже зроблено там); інакше черга закінчується надсиланням із кроку 2.
