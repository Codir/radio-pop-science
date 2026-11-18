# Черга 3. Пілот

> Розділ плану [`2026-11-18-radio-pilot.md`](../2026-11-18-radio-pilot.md). Обмеження, поправки П1–П21, будова файлів, «Спільний договір» і ворота черги — там; завдання посилаються на них і на інші завдання за номерами.


Черга дає дві глави на справжній моделі — пролог (4 кроки) і `lines` (6 кроків): перевірені на комп'ютері, планшеті й телефоні, прочитані двома незалежними читачами, показані на сайті. Порядок: C1 (сценарії) → C2 (щуп) і C3a → C3b → C3c (прилади світу; C2 можна вести паралельно з C3a–C3c, спільних файлів у них немає) → C4 (пролог) → C5 (`lines`) → C6 (телефон) → C7 (знімки й читання) → C9 (ворота й показ). C8 (проба `arrow`) іде паралельно будь-коли після черги 2, пише лише свої файли й на сайт не потрапляє. Після C9 — зупинка: власник вирішує, чи це еталон.

Правило черги: якщо перевірка завдання вимагає правки в `shared/**` чи `sim/**` поза його списком файлів, це окремий коміт перед комітом завдання — явні шляхи, а перед ним `pnpm test src/volumes/radio` і «Блок Q» без `--only` (частина «Черга 2. Світ») → `PASS sandbox-radio-link`; після правки `sim/**` — ще обидві перевірки зразків еталона з блока «Ворота черги».

**Блок S — перевірка глави в браузері.** Глави перевіряємо на збірці профілю сайту: том там лежить під підкаталогом, як на Pages. Стан оболонки між викликами не зберігається, тож кожен запуск — одна команда цілком, де `<команда>` — один виклик `interactions.mjs`, `chapter-check` чи `mobile-check` з `--base "$BASE"`, а `<журнал>` — `$QA_OUT/<завдання>-<що>.log`:

```bash
. tools/site/qa-env.sh                                  # прелюдія, QA_ALLOW_SOFTWARE=1, QA_OUT, замінники ImageMagick (A7)
node tools/site/build.mjs --volume radio --no-smoke     # останній рядок: site: built …/tools/site/dist (browser check skipped)
site_serve 5391 >/dev/null; BASE=http://127.0.0.1:5391/radio-pop-science/
<команда> > <журнал> 2>&1; tail -1 <журнал>
site_stop 5391
```

Кожен Блок S і кожен Блок Q запускається у фоні (`run_in_background: true`): тут `mobile-check` триває ≈ 67 с на профіль, `interactions.mjs` — до двох із половиною хвилин (факти: `baseline-checks.md`). Висновок — за останнім рядком виводу, коли команда закінчилася. Запуски йдуть по одному: дві перевірки під програмним рендером водночас можуть упасти за часом (факти: `site-profile-probe.md`).

### Завдання C1. Сценарії `prologue.md` і `lines.md`

**Виконавець:** Fable 5.2 — тексти стоять на реєстрі термінів і візуальній мові, які писала вона; читають їх два свіжі агенти.

**Файли:**
- Створити: `docs/volumes/radio/chapters/prologue.md`, `docs/volumes/radio/chapters/lines.md`
- Змінити: `docs/volumes/radio/chapters/_terms.md` (картки «рядок», «сигнал», «кадр», «синхроімпульс»), `docs/volumes/radio/PATH-NOTES.md` (§10 «Журнал рішень», список «Рішення черг»: два пункти у формі «дд.мм.рррр — рішення — звідки» — правило про `labels[0]` і показ повзунків `zoom`, крок 2)
- Пишуть інструменти (руками не редагувати, комітити): `docs/volumes/radio/chapters/_export/{prologue,lines}.json`, `app/src/volumes/radio/content/generated/{prologue,lines}.json` і `{prologue,lines}.manifest.json`, `docs/volumes/radio/{INDEX,GLOSSARY}.md`
- Тест: `python3 tools/content/path_check.py --volume radio`, `tools/content/regen.sh --volume radio`, `python3 docs/volumes/radio/check.py`

**Інтерфейси:**
- Бере: граматику сценарію (факти: `content-pipeline.md` §1; зразки `docs/volumes/circuit/chapters/{prologue,wire}.md`); думку й дію кожного кроку — проєкт II §2, записи `prologue/*` і `lines/*`, дослівно за змістом; `_terms.md`, `COPY_STYLE.md` (A4).
- Дає: id і назви кроків; порядок «Підписів» кожного кроку (сцени C4 і C5 беруть підпис за номером, рахунок від 0); «Підписи глави»; умови «Ціль».

- [ ] **Крок 1. Побачити вихідний стан.** `python3 tools/content/path_check.py --volume radio` друкує `path[radio]: 0 chapter document(s), 0 step(s), 41 register term(s) — ok`. Ціль завдання — `2 chapter document(s), 10 step(s)`.
- [ ] **Крок 2. Написати `prologue.md`.** Перший рядок: `# prologue — Камера у дворі, екран на кухні. Що летить між ними?`. Розділи в цьому порядку: «Питання з життя», «Кроки», «Місток», «Підписи глави»; розділів «Що ми вже знаємо» й «Що ми тепер знаємо» немає. У кроці — поля «Думка», «Текст», «Дія», «Висновок», «Ціль», «Підказки» (рівно дві: де річ; що з нею зробити й на що дивитися), «Підписи», «Нові терміни: —», «Бачимо»; поля «Докладніше» немає. «Бачимо» кожного кроку починається реченням «Око падає на <одна річ>.» — саме цю річ за три секунди мусить назвати людина, що бачить кадр уперше (`VISUAL.md` §1, п. 1, «Три секунди»; §9, перший рядок чек-листа); далі — ракурс і розділи `VISUAL.md`. Слова: «прутик», «число», «зерно», «сніг». «Місток» закінчується реченням «Як гребінець тягне шерстинку, не торкаючись?» (П8). Загадку ставить «Висновок» кроку `one-number`: прутик щомиті віддає одне число, а на екрані ціла картинка. Кроки (рішення плану — назви, підписи, цілі):

  | № | id | Назва | «Підписи» в цьому порядку | «Ціль» |
  |---|---|---|---|---|
  | 1 | `watch` | Екран повторює подвір’я | «Монітор» · «хвіртка» · «камера» · «екран» | монітор увімкнено; хвіртку гойднули при ввімкненому моніторі; картинка на екрані в місці хвіртки змінилася |
  | 2 | `between` | Дроту немає | «Деко» · «осторонь» · «впритул» · «Нести монітор» · «прутик» | деко хоч раз стояло на 0,9 або ближче до прутика; монітор хоч раз донесли до 3,9 маршруту (льох) |
  | 3 | `one-number` | Одне число | «прутик» · «Розтягнути час» · → «одне число» | щуп стоїть на прутику монітора, у віконці менш як 0,002 кадру |
  | 4 | `map` | Мапа дороги | «перша камера» · «друга камера» · «камера» · «передавач» · «повітря» · «приймач» · «екран» · «з чого зроблена хвиля» | торкнуто щонайменше одну позначку на кожній із двох доріжок |

  «Підписи глави» (однакові в обох главах, це підписи плану «де ми»): `«Де ми» · «подвір’я» · «кухня» · «коридор» · «дальня кімната» · «льох» · «стенд» · «під лупою»`. Правило, яке цим же кроком іде в «Журнал рішень» `PATH-NOTES.md` (рішення плану): у главі без наступного питання рушій показує `labels[0]` на кнопці повтору кінцевої картки (`hud/model/path-step.ts:97`), тож у таких главах (`build-digital`, гілки, лабораторії) «Підписи глави» починаються з підпису цієї кнопки, а підписи плану зсуваються на один. Обидві глави пілота мають наступне питання: план починається з `label(0)`. Друге правило туди ж: повзунки «Розтягнути час» (`prologue/one-number`, `lines/whole`) показують ціле число без знака «×» — `COPY_STYLE` §6 забороняє «×N» на екрані. Обидва правила — два пункти списку «Рішення черг» у кінці `PATH-NOTES.md` §10, у його форматі «дд.мм.рррр — рішення — звідки» (звідки — «план робіт, C1»); друге посилається на `COPY_STYLE.md` §6, де правило вже стоїть. Речення «Список відкрито 18.11.2026; записів ще немає.» стає «Список відкрито 18.11.2026.». Межа 400 рядків стосувалася лише A6 (файл уже має 399): дописуємо, нічого не скорочуючи.
- [ ] **Крок 3. Написати `lines.md`.** Перший рядок: `# lines — Як передати цілу картинку одним числом?`. Розділи: «Питання з життя», «Що ми вже знаємо», «Кроки», «Нитка глави», «Що ми тепер знаємо» (три рядки по одному реченню: комірки дають напругу, рядок за рядком виходить сигнал; повний прохід — кадр, двадцять п’ять за секунду; синхроімпульси показують екранові початок рядка й кадру), «Місток» (закінчується «Як покласти сигнал на хвилю?»), «Підписи глави» (ті самі вісім). Поля кроку — ті самі, що в пролозі, плюс «Нові терміни» з таблиці нижче й «Докладніше»; «Бачимо» так само починається реченням «Око падає на …». Кроки:

  | № | id | Назва | «Підписи» в цьому порядку | Нові терміни | «Ціль» |
  |---|---|---|---|---|---|
  | 1 | `cell` | Комірка | «комірка» · «Напруга» · «стіна сараю» · «темний закуток» | — | торкнуто дві комірки, яскравість яких (0…1) різниться більш як на 0,4 |
  | 2 | `row` | Рядок | «Бігунець» · → «рядок» · → «сигнал» | рядок, сигнал | бігунець у цьому відвідуванні побував біля лівого краю (комірка ≤ 2), а потім біля правого (≥ 125) |
  | 3 | `frame` | Кадр | «Швидкість бігунця» · «комірок/с» · «справжня» · → «кадр» | кадр | показана швидкість — не менш як 300 000 комірок за секунду (найбільша, справжня, — 307 200) |
  | 4 | `knit` | Де починається рядок | «Вийняти блок» · «Довжина рядка» · «блок» · «бігунець» · «двійник» | — | блок вийнято, і з вийнятим блоком довжина рядка побувала і нижче 287,5, і вище 288,5 |
  | 5 | `marks` | Позначка перед рядком | «Вийняти блок» · «позначка» → «синхроімпульс» · → «синхроімпульси» | синхроімпульс | блок вставлено після того, як у цьому кроці він був вийнятий, і монітор знову знаходить позначку в кожному рядку |
  | 6 | `whole` | Усе в одному числі | «Де в кадрі» · «Розтягнути час» · «синхроімпульс» · «стіна сараю» · «цятка кота» | — | час розтягнуто щонайменше в сто разів, і провал синхроімпульсу побував посередині віконця; віконце побувало на стіні сараю й на цятці кота |

  «Докладніше» (числа й застереження — звичайними реченнями, П1; три з них несуть рядки таблиці «Чесна фізика» (`PATH-ledger.md`): `cell` — «Картинка на екрані», `row` — «Бігунець читає комірки» і «Лупа часу», `frame` — «Лупа часу»): `cell` — у камери на стенді й на екрані монітора по 128 на 96 комірок, щоб кожну було видно; справжня камера має сотні тисяч; картинку на обох екранах рахує модель, і вона чорно-біла, хоч справжні камери кольорові; модель перераховує екран рідше, ніж малюється сцена: на комп’ютері від 10 до 25 разів за секунду, на телефоні ще рідше. `row` — видима частина рядка триває 52 μs; насправді комірки збирають світло весь час, а читання по черзі — спрощення; бігунець, якого ви ведете повзунком, — ручний показ: сама камера тим часом читає комірки зі справжньою швидкістю, і екрана на кухні цей показ не змінює. `frame` — 625 рядків по 64 μs, 25 кадрів і 50 півкадрів за секунду, у півкадрі 288 видимих рядків; бігунець, чию швидкість ви задаєте повзунком, — сповільнений показ: сама камера весь час читає комірки зі справжньою швидкістю, і екран на кухні не сповільнювався. `knit` — ціна похибки: одна тисячна довжини рядка за один півкадр відсуває низ картинки на третину ширини екрана (0,064 μs × 288 рядків ≈ 18 μs із 52). `marks` — 1,65 + 4,7 + 5,7 + 52 ≈ 64 μs. `whole` — найшвидші зміни сигналу камери — до 5,5 MHz; штахети, які перетинає рядок кота, дають близько 3,7 MHz. «Згадати» має лише `whole`: `` `prologue/one-number` `` (сценаріїв глав 1–3 ще немає, посилання на них — помилка перевірки). У «Тексті» немає знаків `= ≈ × ÷ √ ^` і зворотних лапок. До свого кроку слова «рядок», «сигнал», «кадр», «синхроімпульс» не вживаються ні в тексті, ні в підписах: у `cell` і на початку `row` кажемо «ряд комірок», до `marks` — «позначка».
- [ ] **Крок 4. Уточнити чотири картки в `_terms.md`.** Одне-два речення без формул. Колонку «Крок» не чіпати: `` `lines/row` `` (рядок, сигнал), `` `lines/frame` ``, `` `lines/marks` ``. Форма «рядок» не ловить «ряд», «ряду».
- [ ] **Крок 5. Типографіка й похідні файли.** `python3 tools/content/typography.py --write --volume radio`, потім `tools/content/regen.sh --volume radio`. Серед останніх рядків: `path[radio]: 2 chapter document(s), 10 step(s), 41 register term(s) — ok` і `doccheck[radio]: ALL GREEN`. Попередження `idea has N words` чи `main text has N words` — скоротити речення, а не лишати. `doccheck[radio]: ALL GREEN` включає групу `fonts` (`app/scripts/font-coverage.mjs`): кожен знак екранних полів, «Докладніше» й карток експорту (зокрема чотирьох уточнених карток і картки «півкадр») має гліф в атласі шрифту (T108). «Підписи», «Підказки» й «Підписи глави» (`captions`, `hints`, `labels` експорту) ця група не читає: у них лише знаки, які вже є в перевірених полях, — кирилиця, цифри, пропуск, `’`, `/` і звичайна пунктуація, без нових символів.
- [ ] **Крок 6. Перевірка тому.** `python3 docs/volumes/radio/check.py` → `radio check: OK`.
- [ ] **Крок 7. Два читання тексту.** Свіжий агент-фізик (Fable 5.2) дістає обидва сценарії, `_terms.md` і `PATH-ledger.md` та перелічує твердження, які фізично хибні або зрозуміються хибно; окремо звіряє, що кожна адреса «сказано в „Докладніше“ `lines/…`» таблиці «Чесна фізика» (`PATH-ledger.md`) має своє речення в сценарії: `lines/cell` — екран моделі 128 × 96 комірок проти сотень тисяч, оновлюється рідше за сцену, обидва екрани чорно-білі (П1); `lines/row` — комірки збирають світло весь час, а бігунець — ручний показ над лінією, що біжить зі справжньою швидкістю; `lines/frame` — сповільнений показ, екран на кухні не сповільнюється. Свіжий агент-новачок (Opus 5.5) дістає лише екранні поля (`content/generated/{prologue,lines}.json`) і для кожного кроку пише: що зробити, що побачу, чого не зрозумів. Вага зауваги: «стоп» (неправда або крок не пройти), «суттєво» (зрозуміє хибно або застрягне), «дрібно». Правити й повторювати кроки 5–6, доки жоден не поверне нічого вище «дрібно».
- [ ] **Крок 8. Коміт.**

  ```bash
  git add docs/volumes/radio/chapters/prologue.md docs/volumes/radio/chapters/lines.md docs/volumes/radio/chapters/_terms.md \
    docs/volumes/radio/chapters/_export/prologue.json docs/volumes/radio/chapters/_export/lines.json \
    docs/volumes/radio/INDEX.md docs/volumes/radio/GLOSSARY.md docs/volumes/radio/PATH-NOTES.md \
    app/src/volumes/radio/content/generated/prologue.json app/src/volumes/radio/content/generated/prologue.manifest.json \
    app/src/volumes/radio/content/generated/lines.json app/src/volumes/radio/content/generated/lines.manifest.json
  git commit -m "Сценарії прологу й глави lines тому «Радіо»"
  ```

### Завдання C2. Щуп і стрічка: `shared/probe`

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/radio/shared/probe/strip.ts`, `app/src/volumes/radio/shared/probe/index.ts`
- Тест: `app/src/volumes/radio/shared/probe/__tests__/strip.test.ts`, `app/src/volumes/radio/shared/probe/__tests__/probe.test.ts`

**Інтерфейси:**
- Бере: `RadioWorld` (`probe`, `probeData`), `TapId`, `ProbeRequest`, `LEVEL` — див. Спільний договір; `RibbonLines` з `@/fx` (`new RibbonLines({ capacity, color, width, dashStrength, mitre: true, blend })` — `mitre` тримає товщину на прямих кутах імпульсів; `blend: 'normal'` — фарба поверх тла, типове `'additive'` додає світло, `fx/core/ribbon.ts:114`; `setLines([{ points: Vector3[] }, …])`); `toOverlay` з `@/engine/api`; `ctx.root`, `ctx.camera.camera` (камера оператора), `ctx.qa`.
- Дає:

  ```ts
  // strip.ts — чисте
  /** Одна ламана обвідної: для стовпчика i дві точки з x = −width/2 + width·(i + 0,5)/n; парний i — (lo, hi), непарний — (hi, lo).
   *  y(v) = clamp((v − mid)·gain, −1, 1)·height/2. Повертає пари (x, y), довжина 4·n. */
  export function stripPolyline(lo: Float32Array, hi: Float32Array, width: number, height: number, gain: number, mid?: number): Float32Array;
  export function autoGain(lo: Float32Array, hi: Float32Array, mid: number): number;   // 0,9 / max(1e-9, найбільше |v − mid|)
  /** Комірки кадру камери як напруга u = 0,3 + 0,7·Y/255: `count` комірок у порядку читання, що закінчуються перед `end` (номери за модулем 12 288). */
  export function lumaStrip(luma: Uint8Array, end: number, count: number, columns: number): { lo: Float32Array; hi: Float32Array };
  // index.ts
  export interface ProbeOptions { width: number; height: number; columns?: number }   // віконце в одиницях сцени; columns типово 256, не більш як 512
  export interface Probe {
    readonly object: Group;        // наконечник, віконце й вусик між ними; шар оверлею; mountProbe додає його в ctx.root і в world.yard.hidden
    readonly window: Object3D;     // щокадру повернуте лицем до камери оператора
    scale: number;                 // множник усіх розмірів щупа: віконця, відступу віконця від наконечника, довжини наконечника (height/3 — у віконці 0,18 висоти кадру це 0,06, VISUAL.md §6) і товщини ліній (RibbonLines.width); типово 1
    touch(tap: TapId, at: Object3D, windowAt?: Object3D): void;   // world.probe = { tap, view: 'strip', start, span, columns }
    feed(at: Object3D, source: () => { lo: Float32Array; hi: Float32Array } | null, windowAt?: Object3D): void;   // місцеве джерело без моделі; world.probe = null
    lift(): void;                  // world.probe = null, tap = null, start = 0, span = 1, object.visible = false
    readonly tap: TapId | null;
    start: number; span: number;   // частки кадру; типово 0 і 1
    anchorAt(x: number, v: number, out?: Vector3): Vector3;   // точка світу у віконці: x 0…1 уздовж, v — значення сигналу
    update(): void;
  }
  export function mountProbe(ctx: ChapterContext, world: RadioWorld, opts: ProbeOptions): Probe;   // не createProbe: так зветься щуп моделі (B8)
  ```

  Рішення плану. `feed` і `anchorAt`: у `lines/cell`, `row`, `frame` стрічку малюємо з кадру камери `world.luma`, без моделі; підписи кроків чіпляються до місця на кривій. Місце віконця: центр — у світовій точці `windowAt`, а без неї — над наконечником на `0,65·height·scale` уздовж осі «вгору» камери оператора. `scale` потрібен прологові: його ракурси різняться в десятки разів, тож він тримає віконце сталим на екрані (C4). У режимі `feed` `update()` запиту `world.probe` не чіпає. Масштаб кривої: для `camera.video`, `rx.detected` і `feed` — `mid 0,5`, `gain 1,8`; для решти відведень — `mid 0`, `autoGain` на кожен кадр даних. Щуп публікує `ctx.qa.expose('radio-probe', () => ({ tap, local, start, span, n, min, max }))` (`local` — працює `feed`; `n` — стовпчиків намальовано; `min`, `max` — найменше й найбільше з намальованих `lo`, `hi`, в одиницях сигналу) і дві точки `ctx.qa.probe('strip-a' | 'strip-b', …)` — протилежні кути віконця.

- [ ] **Крок 1. Тест чистих частин, що падає.** `strip.test.ts`:

  ```ts
  it('рівний сигнал — рівна лінія', () => {
    const f = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    expect([...stripPolyline(f, f, 2, 1, 1)]).toEqual([-0.75, 0.25, -0.75, 0.25, -0.25, 0.25, -0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.75, 0.25, 0.75, 0.25]);
  });
  it('пилка: парний стовпчик знизу вгору, непарний згори вниз', () =>
    expect([...stripPolyline(new Float32Array([0, 0.5]), new Float32Array([0.5, 1]), 2, 2, 1)]).toEqual([-0.5, 0, -0.5, 0.5, 0.5, 1, 0.5, 0.5]));
  it('зрізає за межами віконця', () => {
    expect([...stripPolyline(new Float32Array([-5]), new Float32Array([5]), 2, 2, 1)]).toEqual([0, -1, 0, 1]);
    expect([...stripPolyline(new Float32Array([-5]), new Float32Array([5]), 2, 2, 0.1)]).toEqual([0, -0.5, 0, 0.5]);
  });
  it('mid зсуває нуль', () => expect(stripPolyline(new Float32Array([0.5]), new Float32Array([0.5]), 2, 2, 1, 0.5)[1]).toBe(0));
  it('autoGain', () => expect(autoGain(new Float32Array([-0.002]), new Float32Array([0.001]), 0)).toBeCloseTo(450, 3));
  it('lumaStrip: чотири комірки на вісім стовпчиків', () => {
    const luma = new Uint8Array(12288); luma[1] = 255; luma[3] = 255;
    const s = lumaStrip(luma, 4, 4, 8);
    expect([...s.lo].map((v) => +v.toFixed(3))).toEqual([0.3, 0.3, 1, 1, 0.3, 0.3, 1, 1]);
    expect([...s.hi]).toEqual([...s.lo]);
  });
  it('lumaStrip: увесь кадр на 96 стовпчиків — по рядку на стовпчик', () => {
    const luma = new Uint8Array(12288); for (let i = 0; i < 12288; i++) luma[i] = i >> 7;
    const s = lumaStrip(luma, 12288, 12288, 96);
    for (const r of [0, 40, 95]) { expect(s.lo[r]).toBeCloseTo(0.3 + 0.7 * r / 255, 6); expect(s.hi[r]).toBeCloseTo(s.lo[r], 6); }
  });
  it('lumaStrip: дві комірки на стовпчик дають найменше й найбільше; початок переходить через край кадру', () => {
    const luma = new Uint8Array(12288); for (let i = 0; i < 12288; i += 2) luma[i] = 255;
    const s = lumaStrip(luma, 256, 256, 128);
    expect(s.lo[7]).toBeCloseTo(0.3, 6); expect(s.hi[7]).toBeCloseTo(1, 6);
    expect(lumaStrip(luma, 2, 4, 4).hi[0]).toBeCloseTo(1, 6);       // комірка 12 286
  });
  ```

- [ ] **Крок 2. Побачити падіння.** З `app/`: `pnpm test src/volumes/radio/shared/probe` → `Error: Cannot find module '../strip' imported from …/shared/probe/__tests__/strip.test.ts`, `Test Files  1 failed (1)`.
- [ ] **Крок 3. Написати `strip.ts`.** Після нього той самий запуск: `Tests  8 passed (8)`.
- [ ] **Крок 4. Тест щупа, що падає.** `probe.test.ts`. Підробки, приведені до типів: світ `{ probe: null, probeData: null, yard: { hidden: [] } }`; контекст `{ root: new Group(), camera: { camera: new PerspectiveCamera() }, onDispose: () => {}, qa: { expose: (name, fn) => (readers.set(name, fn), () => {}), probe: () => () => {} } }`, де `readers` — `Map` тесту; читач — `readers.get('radio-probe')!()`. Перевірки:
  - після `mountProbe` — `ctx.root.children` і `world.yard.hidden` містять `probe.object`;
  - `touch('air.rx', at)` → `world.probe` дорівнює `{ tap: 'air.rx', view: 'strip', start: 0, span: 1, columns: 256 }`, `probe.tap === 'air.rx'`;
  - `probe.span = 0.002; probe.start = 0.499; probe.update()` → `world.probe` має ці `start` і `span`;
  - `lift()` → `world.probe === null`, `probe.tap === null`, `probe.start === 0`, `probe.span === 1`, `probe.object.visible === false`;
  - `feed(at, () => ({ lo, hi }))` із 256 значень `0.65` → `world.probe === null`; чужий запит, записаний після цього у `world.probe`, `update()` лишає як є; читач дає `local === true`, `n === 256`; при `height: 0.5` точки `anchorAt(0.5, 0.65)` і `anchorAt(0.5, 0.5)`, переведені в місцеві координати `probe.window`, різняться по `y` на `0.0675` (це `0,15 · 1,8 · 0,25`), а по `x` збігаються;
  - `touch('air.rx', at, windowAt)` і `update()` → світове місце `probe.window` дорівнює місцю `windowAt`;
  - `mountProbe(…, { width: 1, height: 1, columns: 900 })` і `touch` → `world.probe.columns === 512`.
- [ ] **Крок 5. Написати `index.ts`.** Дві `RibbonLines` з незмінними наборами `Vector3`: крива — на 1024 точки, товщина `height/36` (0,005 висоти кадру, коли віконце — 0,18); друга, на 32 точки, утричі тонша й з `blend: 'normal'` (тоді `brightness` і є непрозорість), — вусик від наконечника до найближчого краю віконця й сітка стрічки (рамка, середня горизонталь, сім вертикалей; сітка — з `brightness` 0,35, це її непрозорість 35 %; `VISUAL.md` §6). Обидві товщини множить `scale`. `update()`: якщо є місцеве джерело — малює його, інакше `world.probeData` (вигляд `strip`: `lo`, `hi`); немає даних — крива порожня. Колір і товщина — `VISUAL.md` «Щуп і стрічка». Запуск: `pnpm test src/volumes/radio/shared/probe` → `Test Files  2 passed (2)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 6. Коміт.** `git add app/src/volumes/radio/shared/probe/strip.ts app/src/volumes/radio/shared/probe/index.ts app/src/volumes/radio/shared/probe/__tests__/strip.test.ts app/src/volumes/radio/shared/probe/__tests__/probe.test.ts` · `git commit -m "Щуп зі стрічкою в спільному світі тому «Радіо»"`

### Завдання C3a. Подвір'я для пілота: місце кота і два якорі

**Виконавець:** Opus 5.5

**Файли:**
- Змінити: `app/src/volumes/radio/shared/yard/layout.ts` (`CAT_RUN`, `catPlace`), `app/src/volumes/radio/shared/yard/index.ts` (поле `catAt`, якорі `shedWall`, `nook` — і в типі `Yard`, і в `mountYard`: B13 їх не оголошує), `app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts` (`SANDBOX.labels.cat`), `…/scene.ts` (крок `yard`: повзунок `cat`, читач `radio-anchors`), `…/qa/measure.mjs` (розділ `anchors`)
- Змінити, лише якщо цього вимагає крок 6: `app/src/volumes/radio/shared/yard/look.ts`, `app/src/volumes/radio/shared/models/{cat,shed,index}.ts` (розмір цятки — стала `CAT.spot`, у тому файлі, де її оголосив B12), а тоді тим самим комітом і `docs/volumes/radio/VISUAL.md`: новий `CAT_RUN` і зсуви кота на кадрі — §2 «Кадр камери», пункт «Кіт»; розмір цятки — рядок `places.cat` і пункт «Кіт» §2; змінений рецепт матеріалу — §4 «Приглушені поверхні»
- Тест: `app/src/volumes/radio/shared/yard/__tests__/layout.test.ts` (доповнити); розділ `anchors` у `measure.mjs`

**Інтерфейси:**
- Бере: `Yard`, `Eye.project`, `RadioWorld.luma` — див. Спільний договір; `LAYOUT`, якорі `wall` і `nook` моделі сараю (B12, B13); «Блок Q» (частина «Черга 2. Світ»).
- Дає: у `layout.ts` — `export const CAT_RUN = 3` (метрів паркану, якими ходить кіт; початкове значення, добирається в кроці 6) і `export function catPlace(catAt: number): V3` = `LAYOUT.places.cat.position` + `(clamp(catAt, 0, 1) − 0,5)·CAT_RUN` уздовж поперечного паркану — відрізка (−1,2; −3,9) → (4,6; −3,9) плану `VISUAL.md` §2 (у сцені `toScene2` → (−1,2; 3,9) → (4,6; 3,9), тобто вздовж +x сцени); його `route` — у тому `FenceRun` з `LAYOUT.plan.fences` (B12, B13), що має `board: true`, а не найближчий відрізок паркану довкола подвір'я — той іде вздовж променя зору камери. У `Yard` — поле `catAt: number` (місце кота на паркані, 0…1; типово 0,5 — це `LAYOUT.places.cat`, тож кадри черги 2 не змінюються) і два нові якорі: `shedWall` (якір `wall` сараю — середина білої стіни) та `nook` (якір `nook` — темний закуток), з точками `yard:shedWall`, `yard:nook`. Білу цятку на лобі кота вже дає якір `cat`. Ходу кота (рішення плану) малює не швидкість, а саме місце: тулуб підстрибує на `0,015·|sin(π·catAt·CAT_RUN/0,25)|` м — функція `catAt`, без історії й без ділення на `dt` (на зупиненому кадрі `dt = 0`).

- [ ] **Крок 1. Тест, що падає.** У `layout.test.ts` — «кіт: 0,5 — його місце в плані, повний хід — `CAT_RUN` уздовж паркану»: `expect(catPlace(0.5)).toEqual(LAYOUT.places.cat.position)`; для `d = sub(catPlace(1), catPlace(0))` — `expect(Math.hypot(d[0], d[2])).toBeCloseTo(CAT_RUN, 9)` і `expect(d[1]).toBe(0)`, `expect(d[0]).toBeCloseTo(CAT_RUN, 9)` і `expect(d[2]).toBeCloseTo(0, 9)` (хід — уздовж поперечного паркану, +x сцени); `expect(catPlace(-3)).toEqual(catPlace(0))`, `expect(catPlace(7)).toEqual(catPlace(1))`.
- [ ] **Крок 2. Побачити падіння.** `pnpm test src/volumes/radio/shared/yard` → `catPlace is not a function`.
- [ ] **Крок 3. Написати `catPlace`, `catAt` і якорі.** Той самий запуск: усе зелене; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 4. Розділ `anchors` у `measure.mjs`.** Сторінка `_dev/_sandbox-radio-link/yard`, `freeze: 1`; числа з `__app.read('radio-anchors')` — для `cat`, `shedWall`, `nook`, `wicket`: `{ cell: world.eye.project(якір), luma, around }` (`luma` — `world.luma` в цій комірці, `around` — середнє восьми сусідів) і `wicketMid: world.eye.project(new Vector3(...LAYOUT.places.wicket.position))` — комірка середини стулки. Вісімнадцять перевірок: `opened`; для сутінків пілота `__ui.set('dusk', 0.15, true)` і `0.35`, кожного разу з `__ui.set('cat', 0.62, true)`, — по сім: (1) `cat`, `shedWall`, `nook` у кадрі (`cell !== null`); (2) `shedWall.luma ≥ 200`; (3) `nook.luma ≤ 70`; (4) `cat.luma ≥ 200`; (5) `cat.luma − cat.around ≥ 60`; (6) тулуб кота щонайменше на 40 темніший за гравій за ним і (7) штахета й проміжок різняться щонайменше на 90 — умови (а) і (б) рядка `tones` розділу `yard` B13 у масиві `radio-luma`, де замість `seen.cat.cell` — `cat.cell` цього читача, а замість `seen.wicket.cell` — `wicketMid` (середина стулки, як у B13, а не якір `wicket` на клямці); `VISUAL.md` §2, «Тони кадру»: C3a міряє всі п’ять тонів; далі (15) між `cat = 0.2` і `cat = 0.8` стовпчик кота різниться щонайменше на 30 комірок, і обидва рази він у кадрі; (16) при `cat = 0.3` і `cat = 0.6` стовпчики кота й хвіртки різняться щонайменше на 16 комірок — цим відрізком кіт ходить у пролозі, і тест кроку `watch` (C4) спирається на те, що він не заходить у вікно хвіртки; (17) консоль чиста.
- [ ] **Крок 5. Побачити падіння.** «Блок Q» з `--only anchors` → `FAIL anchors …` (читача `radio-anchors` ще немає), код 1.
- [ ] **Крок 6. Повзунок і читач у пісочниці.** Крок `yard`: повзунок `cat` (0…1, типово 0,5, пише `yard.catAt`; підпис — `SANDBOX.labels.cat`) і `ctx.qa.expose('radio-anchors', …)`. «Блок Q» з `--only anchors` → `PASS sandbox-radio-link — 18 checks`. Якщо стіна темніша за 200 або закуток світліший за 70 — правимо світло й матеріали в `shared/yard/look.ts` чи `shared/models/shed.ts`; якщо не тримаються (6) чи (7) — світло в `look.ts` (кольори кота, гравію й штахет задає `VISUAL.md` §4); якщо цятка не тримає порогів — `CAT.spot` (там, де її оголосив B12); якщо не сходяться (15) чи (16) — `CAT_RUN`. Порогів не чіпаємо.
- [ ] **Крок 7. Черга 2 не зламалася.** «Блок Q» без `--only` → `PASS sandbox-radio-link` (сходинки, `screenHash`, малювання й родини відтінків кожного ракурсу — ті самі перевірки, що в B17).
- [ ] **Крок 8. Коміт.** `git status --short` показує лише файли зі списку вище. `git add app/src/volumes/radio/shared/yard/layout.ts app/src/volumes/radio/shared/yard/index.ts app/src/volumes/radio/shared/yard/__tests__/layout.test.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/scene.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs` (і ті з `look.ts`, `models/cat.ts`, `models/shed.ts`, `models/index.ts`, які правив крок 6; і `docs/volumes/radio/VISUAL.md`, якщо крок 6 змінив `CAT_RUN`, цятку чи матеріал) · `git commit -m "Подвір'я для пілота: кіт ходить парканом, якорі білої стіни й закутка"`

### Завдання C3b. Стенд камери, бігунці, копія екрана

**Виконавець:** Opus 5.5 будує; Fable 5.2 приймає знімки кроку 7 до коміту (вигляд — її частина роботи, рішення 17).

**Файли:**
- Створити: `app/src/volumes/radio/shared/stand/{plate.ts,index.ts}`, `app/src/volumes/radio/shared/screen/{runner.ts,inset.ts}`
- Змінити: `app/src/volumes/radio/shared/screen/index.ts` (реекспорт `runner` і `inset`: глави імпортують усе з `@radio/shared/screen`), `app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs}` (крок і розділ `stand`)
- Тест: `app/src/volumes/radio/shared/stand/__tests__/{plate,stand}.test.ts`, `app/src/volumes/radio/shared/screen/__tests__/{runner,inset}.test.ts`; розділ `stand` у `measure.mjs`

**Інтерфейси:**
- Бере: `RadioWorld`, `Yard`, `Screen`, `Meters` (знак `lineOffset` і `lineDrift`, поле `lineRow`), `LINE`, розтягування 128 комірок на 234 відліки — див. Спільний договір; уніформу `tLuma` екрана (B1a); `Shot` з `@/engine/api`; `CameraDirector` з `@/engine/camera/director` (лише тест стенда, крок 4: кадр телефона).
- Дає:

  ```ts
  // stand/plate.ts — чисте
  export const PLATE = { width: 1.28, height: 0.96 } as const;                 // одиниці сцени; комірка 0,01 × 0,01
  export interface Cell { col: number; row: number }
  export function cellCentre(col: number, row: number): [number, number];      // місцеві x, y пластинки; комірка (0, 0) — зліва вгорі
  export function cellOf(x: number, y: number): Cell | null;                    // null — поза пластинкою
  export function cellSample(col: number, row: number): number;                // відлік камери з серединою комірки: row·288 + 54 + (col + 0,5)·234/128 − 0,5
  export function sampleCell(sample: number): Cell | null;                      // цілі col, row; null — синхроімпульс, поличка чи кадрова позначка
  // stand/index.ts
  export const STAND = { back: 2.4, right: 1.6, up: 1.5 } as const;            // центр пластинки від точки землі під якорем lens; початкові значення
  export interface CameraStand {
    readonly object: Group;                 // mountCameraStand додає його в ctx.root і в world.yard.hidden
    unfold: number;                         // 0 — усе складено в камеру на стовпі … 1 — стенд розкладено
    readonly plate: Mesh;                   // 128 × 96 комірок, показує world.luma
    cellAt(col: number, row: number, out?: Vector3): Vector3;                   // світові координати центра комірки
    cellUnder(point: Vector3): Cell | null;                                     // для торкання пластинки
    readonly syncBlock: { readonly object: Object3D; readonly lid: Object3D; taken: number };   // taken: 0 — у гнізді … 1 — вийнято
    readonly shelf: Object3D;               // полиця під рядом блоків: верх — на низу syncBlock; за taken = 1 лишається на місці
    readonly cable: Object3D;
    readonly inset: Mesh;                   // копія екрана монітора: createScreenInset(world.screen, 1.28)
    readonly stripAt: { readonly plate: Object3D; readonly cable: Object3D };   // місця віконця щупа (третій аргумент touch і feed)
    readonly shots: Readonly<Record<'stand' | 'plate' | 'pair' | 'copy', Shot>>;
    narrow: boolean;                        // вузький кадр (C6; типово false): true — shots.plate і shots.copy дають ракурси вузького кадру, а update() ставить stripAt на його місця
    update(): void;                         // пластинка ← world.luma щокадру, поки unfold > 0; місця частин за unfold і taken
  }
  export function mountCameraStand(ctx: ChapterContext, world: RadioWorld): CameraStand;
  // screen/runner.ts
  export function twinCell(col: number, row: number, m: Pick<Meters, 'lineOffset' | 'lineDrift' | 'lineRow'>): Cell | null;
  export function footprint(cellsPerSecond: number): { cols: number; rows: number };
  export interface Runner { readonly object: Object3D; at(surface: Mesh, col: number, row: number): void; spread(cols: number, rows: number): void; visible: boolean }
  export function createRunner(color: ColorLike): Runner;
  // screen/inset.ts
  export function createScreenInset(screen: Screen, width: number): Mesh;       // той самий матеріал і текстура, що у screen.object; 4:3
  /** Масштаб, за якого предмет завширшки baseWidth у точці at займає на екрані widthPx: widthPx·2·d·tan(fov/2)/viewportHeight/baseWidth; d — глибина at уздовж погляду. */
  export function screenScale(camera: PerspectiveCamera, viewportHeight: number, at: Vector3, baseWidth: number, widthPx: number): number;
  ```

  Рішення плану:
  - Стенд пілота має лише те, що називає `lines`: пластинку, полицю з блоком під кришкою без напису, кабель, копію екрана. Генератора й антени глави 5 на ньому ще немає. Камера на стовпі лишається на місці (нею дивиться око); `unfold` веде весь стенд від якоря `lens` (масштаб 0,04) до свого місця (масштаб 1) прямою, плавно; `object.visible = unfold > 0.02`. Кабель стенда тягнеться до якоря `cable` подвір'я.
  - Місце й орієнтація: читач стоїть за стендом і дивиться туди ж, куди камера у дворі, — подвір'я видно за пластинкою, і картинка на ній не дзеркальна. Місцеві осі стенда: x — праворуч, y — угору, z — до читача; початок — центр пластинки, він стоїть на `STAND.back` м позаду якоря `lens` (проти погляду камери, по землі), `STAND.right` м праворуч і `STAND.up` м над землею. Якщо на знімках стенд перетинає предмет подвір'я — рухаємо `STAND`, а не подвір'я.

    | Частина | Центр (x; y; z), м | Розмір, м |
    |---|---|---|
    | пластинка `plate` | (0; 0; 0) | 1,28 × 0,96; `DataTexture(128, 96)`, найближчий відлік |
    | копія екрана `inset` | (1,46; 0; 0) | 1,28 × 0,96 — комірка проти комірки пластинки |
    | блок `syncBlock.object`, кришка `lid` зверху | (1,10; −0,62; 0,10) — стоїть на полиці; за `taken = 1` — (1,10; −0,56; 0,36): піднятий і висунутий до читача, поза полицею | 0,24 × 0,16 × 0,16 |
    | полиця `shelf` | (1,16; −0,71; 0,10) | 1,04 × 0,02 × 0,20 — тонка дошка, рецепт дерева `VISUAL.md` §4 (`mix('wireBrown', 'mist', 0.6)`); верх −0,70 — під низом блока; лівий край x 0,64 — під правим краєм пластинки; кабель іде вздовж неї до точки `cable`; за `taken = 1` лишається на місці |
    | точка кабелю `cable` | (1,60; −0,62; 0,05) | кабель іде від правого нижнього кута пластинки крізь блок до цієї точки й далі до якоря `cable` |
    | `stripAt.plate`, `stripAt.cable` | (0; −0,85; 0,05), (1,46; −1,05; 0,05) | центр віконця щупа; розмір віконця на екрані — `VISUAL.md` §6 (глава ставить `probe.scale`, C5) |

    У вузькому кадрі (`stand.narrow = true`, C6) ракурси `plate` і `copy` мають `center` (0; −0,66; 0) і (1,46; −0,66; 0), `h` 1,8, як у широкому, і `radius` 1,13 (`position` — за правилом ракурсів нижче), а місця `stripAt.plate` і `stripAt.cable` — (0; −1,38; 0,05) і (1,46; −1,38; 0,05). За кадром рушія (аркуш `half`: сцені лишається 390 × 360 px) віконце 351 × 140,4 px тоді стоїть щонайменше за 12 px від полиці, від блока в гнізді й вийнятого, від пластинки й копії; воно на 13 px вище за аркуш, а пластинка й копія мають 0,49·W завширшки. На `peek` проміжок — щонайменше 19 px. Ракурса `pair` вузький кадр не показує.

  - Полиця (`VISUAL.md` §8 і §9: блоки камери стоять на полиці в порядку дороги картинки) — тонка дерев'яна дошка під рядом блоків: її верх — на висоті низу `syncBlock` (−0,70), пластинка — на її початку (лівий край полиці, x 0,64, — під правим краєм пластинки), кабель іде вздовж неї до точки `cable`; вийнятий блок (`taken = 1`) сходить із полиці, полиця лишається. Місце й розмір дібрано так, щоб у ракурсах `plate`, `pair`, `copy` віконце щупа на обох місцях `stripAt` не налазило ні на полицю, ні на вийнятий блок. Віконце (`VISUAL.md` §6) у кадрі 16 : 9 — 0,45·h × 0,18·h (`h` — висота кадру ракурсу): 0,81 × 0,32 м у `plate` і `copy`, 0,90 × 0,36 м у `pair`; воно повернуте лицем до камери, що дивиться згори під кутом atan 0,2 = 11,3°, тож у площині z 0,05 його висота більша в 1/cos 11,3° = 1,02 раза. Біля `stripAt.plate` віконце кінчається праворуч на x 0,46 (`pair`; 0,42 у `plate` і `copy`), біля `stripAt.cable` його верх — на y −0,86 (−1,05 + 0,18·1,02); полиця займає x 0,64…1,68, а її передній нижній край (y −0,72, z 0,20) з погляду ракурсу видно на y ≈ −0,72 − 0,2·0,15 = −0,75. Найменший проміжок — 31 px на 1280 × 720 (`pair`, `stripAt.cable`); на 390 × 844 кадр ракурсу інший: рушій вписує безпечний кадр 1,5 : 1 у ширину 390 px і збільшує його за `fit` (`engine/camera/director.ts`, `REFRAME`), а типовий аркуш `half` лишає сцені 390 × 360 px, тож кадр ракурсу має ≈ 273 px заввишки в `plate`, ≈ 259 px у `copy` і ≈ 182 px у `pair`, і віконце 351 × 140,4 px відносно нього в 2,9–4,3 раза більше, ніж у кадрі 16 : 9 (числа вузького кадру — під таблицею частин). На комп'ютері колонка кроку й корінець стискають кадр рушія до ≈ 0,8 висоти вікна (`engine/camera/director.ts:126-162`), а віконце рахують від висоти вікна, тож відносно сцени воно в 1,25 раза більше (праворуч до x 0,57, верх до y −0,81); проміжок лишається (≥ 12 px), і тест кроку 4 міряє саме з цим запасом. Меж трикутників і малювань стенд не має: полиця — одна `BoxGeometry` (12 трикутників, одне малювання); межу кадру, 350 малювань, стереже `chapter-check` у C7.

  - Ракурси: `target = center`, `position = center + n·(h/(2·tan 16°))`, де `n` — одиничний вектор (0; 0,2; 1) у місцевих осях, `h` — висота кадру; `fov` типовий (32°); `fit = { center, radius }`.

    | Ракурс | `center` | `h` | `radius` | Що в кадрі |
    |---|---|---|---|---|
    | `stand` | середина між центром пластинки і якорем `lens` | 2·`radius` | половина відстані між ними + 1,7 | стовп із камерою і весь стенд |
    | `plate` | (0; −0,31; 0) | 1,8 | 1,05 | пластинка і стрічка під нею |
    | `pair` | (0,73; −0,41; 0) | 2,0 | 1,7 | пластинка, копія, блок, кабель, стрічка |
    | `copy` | (1,46; −0,41; 0) | 1,8 | 1,1 | копія, блок, кабель, стрічка — місце вузького кадру (C6) |

  - `twinCell` — де на екрані монітора лежить комірка камери; це обернений хід приймального боку B4: `P = 288 + lineDrift`, `n = cellSample(col, row)`, `k = floor((n − lineOffset)/P)`, `ph = n − lineOffset − k·P`; рядок `r = (k + lineRow) mod 100`; `null`, якщо `ph < 53,5`, `ph ≥ 287,5` або `r` поза 0…95 (комірка в полиці, синхроімпульсі чи за краєм — двійника ховаємо); інакше `{ col: (ph − 53,5)·128/234 − 0,5, row: r }` (стовпчик дробовий). Глави дають третім аргументом `world.meters`: двійник іде за картинкою і вбік, і вгору чи вниз.
  - `footprint`: `n = cellsPerSecond/25` (око тримає слід близько 1/25 с); `cols = clamp(ceil(n), 1, 128)`, `rows = clamp(ceil(n/128), 1, 96)`. `Runner.at` рахує місце з меж геометрії площини (128 × 96 комірок на всю площину; стовпчик і рядок можуть бути дробові) і стає її дитиною; `spread` розтягує цятку в смугу й тьмянить її як `1/√(cols·rows)`, не нижче 0,12.
  - `createScreenInset` — єдиний спосіб показати «копію» поруч з «оригіналом», не додаючи проходів рендерера: друга площина з тим самим матеріалом.

- [ ] **Крок 1. Тести чистих частин, що падають.**

  ```ts
  // plate.test.ts
  expect(cellCentre(0, 0)).toEqual([-0.635, 0.475]);  expect(cellCentre(127, 95)).toEqual([0.635, -0.475]);   // toBeCloseTo, 9 знаків
  expect(cellOf(...cellCentre(64, 48))).toEqual({ col: 64, row: 48 });  expect(cellOf(0.65, 0)).toBeNull();
  expect(cellSample(0, 0)).toBeCloseTo(54.4140625, 9);  expect(cellSample(127, 95)).toBeCloseTo(27646.5859375, 9);
  expect(sampleCell(17)).toBeNull();  expect(sampleCell(Math.round(cellSample(40, 10)))).toEqual({ col: 40, row: 10 });
  expect(sampleCell(96 * 288 + 100)).toBeNull();
  // runner.test.ts — t(col, row, lineOffset, lineDrift, lineRow = 0) повертає [стовпчик до трьох знаків, рядок] або null
  const t = (c: number, r: number, lineOffset: number, lineDrift: number, lineRow = 0) => {
    const q = twinCell(c, r, { lineOffset, lineDrift, lineRow }); return q && [+q.col.toFixed(3), q.row]; };
  expect(t(10, 0, 0, 0)).toEqual([10, 0]);                           // ритм стоїть — двійник там само
  expect(t(10, 0, 8, 0)).toEqual([5.624, 0]);                        // монітор відстає на 8 відліків — картинка лівіше
  expect(t(120, 40, 0, 0.5)).toEqual([109.06, 40]);                  // довгий рядок монітора: на 40-му рядку — ліворуч на 10,94 комірки
  expect(t(10, 40, 0, -0.5)).toEqual([20.94, 40]);                   // короткий рядок — праворуч
  expect(t(5, 10, -20, 0)).toEqual([15.94, 10]);
  expect(t(10, 40, 0, 0.5)).toBeNull();  expect(t(5, 10, 30, 0)).toBeNull();          // комірка потрапила в поличку
  expect(t(5, 10, 100, 0)).toEqual([107.838, 9]);                    // перенос на попередній рядок: рядок — 288 відліків, а не 128 комірок
  expect(t(5, 0, 100, 0)).toBeNull();  expect(t(120, 95, -140, 0)).toBeNull();        // за верхнім і нижнім краєм
  expect(t(10, 0, 0, 0, 97)).toBeNull();  expect(t(10, 5, 0, 0, 97)).toEqual([10, 2]);
  expect(footprint(8)).toEqual({ cols: 1, rows: 1 });        expect(footprint(1600)).toEqual({ cols: 64, rows: 1 });
  expect(footprint(4000)).toEqual({ cols: 128, rows: 2 });   expect(footprint(38400)).toEqual({ cols: 128, rows: 12 });
  expect(footprint(307200)).toEqual({ cols: 128, rows: 96 });
  // inset.test.ts
  const cam = new PerspectiveCamera(40, 16 / 9, 0.1, 100); cam.updateMatrixWorld();
  expect(screenScale(cam, 720, new Vector3(0, 0, -10), 2, 288)).toBeCloseTo(1.4559, 3);
  const screen = createScreen({ width: 0.32, height: 0.24 }); const inset = createScreenInset(screen, 1.6);
  expect(inset.material).toBe(screen.object.material);  expect((inset.geometry as PlaneGeometry).parameters).toMatchObject({ width: 1.6, height: 1.2 });
  ```

- [ ] **Крок 2. Побачити падіння.** `pnpm test src/volumes/radio/shared/stand src/volumes/radio/shared/screen` → три нові файли з `Error: Cannot find module '…' imported from …` (`'../plate'`, `'../runner'`, `'../inset'`).
- [ ] **Крок 3. Написати чисті частини** (`plate.ts`, `runner.ts` без `createRunner`, `inset.ts`). Той самий запуск: три нові файли зелені.
- [ ] **Крок 4. Тест стенда, що падає.** `stand.test.ts`. Підробки: світ `{ yard: { root: new Group(), hidden: [], anchors: { lens, cable } }, luma: new Uint8Array(12288), screen: createScreen({ width: 0.32, height: 0.24 }) }`, де `lens` стоїть у (0; 2,4; 0) і дивиться вздовж −Z; контекст `{ root: new Group(), track: (x) => x, onDispose: () => {}, qa: { expose: () => () => {}, probe: () => () => {} } }`. Після `stand.unfold = 1; stand.update()`:
  - `ctx.root.children` і `world.yard.hidden` містять `stand.object`; світове місце `stand.plate` — (1,6; 1,5; 2,4) ± 1e-6;
  - для комірок (0, 0), (64, 48), (127, 95): `stand.cellUnder(stand.cellAt(c, r))` дорівнює `{ col: c, row: r }`; `cellAt(127, 0).x > cellAt(0, 0).x` і `cellAt(0, 0).y > cellAt(0, 95).y` (комірка (0, 0) — зліва вгорі для читача);
  - для `runner = createRunner('white')`: `runner.at(stand.plate, 64, 48)` → світове місце `runner.object` збігається з `stand.cellAt(64, 48)` до 1e-6; те саме для `stand.inset` і місця, зсунутого на 1,46 по x;
  - `stand.syncBlock.taken = 1; stand.update()` → блок зсунувся на (0; 0,06; 0,26), а світова `Box3` `stand.shelf` не змінилася й блока не перетинає;
  - `world.luma[0] = 200; stand.update()` → перший байт текстури пластинки дорівнює 200;
  - кожен із чотирьох `stand.shots` має `fit`; у `pair` кути пластинки й копії лежать у кулі `fit`;
  - полиця: верх світової `Box3` `stand.shelf` — на висоті низу світової `Box3` `stand.syncBlock.object` (± 1e-6), а блок у плані (x, z) лежить у полиці; віконце щупа не налазить на полицю: для кожного з ракурсів `plate`, `pair`, `copy` (камера `new PerspectiveCamera(32, a)` у `position` ракурсу, `lookAt(target)`, `updateMatrixWorld()`) і кожного з місць `stripAt.plate`, `stripAt.cable` прямокутник у NDC із центром у спроєктованому світовому місці `stripAt`, пів-шириною `w` і пів-висотою `v` не перетинає обвідного прямокутника восьми спроєктованих кутів `Box3` полиці, а за `taken = 1` — і `Box3` блока; `(a, w, v)` — `(16 / 9, 0.253125·k, 0.18·k)` для `k` 1 і 1,25 (віконце `VISUAL.md` §6 — 0,45 × 0,18 висоти кадру; 1,25 — запас на колонку кроку, що на комп'ютері стискає кадр рушія до ≈ 0,8 висоти вікна); на 390 × 844 камеру ставить сам рушій, бо на телефоні кадр не `PerspectiveCamera(32, a)`: `const d = new CameraDirector(); d.reframe = true; d.setViewport(390, 844); d.setInsets({ top: 62 / 844, bottom: b }, true); d.go({ ...ракурс, drift: 0 }, { instant: true })` (`@/engine/camera/director`; верх 62 — шапка з відступом, `hud-dom/touch/sheet.ts:336-345`), для `b` = 422 / 844 (типовий аркуш `half`) і 154 / 844 (`peek`) — `hud/model/sheet.ts:89-97`; проєкція — через `d.camera`, `(w, v)` = `(0.9, 0.16635)` (0,9·W завширшки й 0,4 ширини заввишки: 351 × 140,4 px); пари — ті, що показує вузький кадр C6, після `stand.narrow = true; stand.update()`: `shots.plate` зі `stripAt.plate` і `shots.copy` зі `stripAt.cable`;
  - `stand.unfold = 0; stand.update()` → `stand.object.visible === false`.
- [ ] **Крок 5. Написати `mountCameraStand` і `createRunner`; додати `runner` і `inset` у реекспорт `screen/index.ts`.** `pnpm test src/volumes/radio/shared` — усе зелене; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 6. Крок `stand` пісочниці й розділ `stand` у `measure.mjs`.** Крок: стенд на `mountWorld` пісочниці, повзунки `unfold` і `taken` (0…1), вибір `view` із чотирьох ракурсів стенда, бігунець у комірці (64, 48) пластинки і двійник на копії; підписи — у `SANDBOX`. Точки `plate-a`, `plate-b`, `inset-a`, `inset-b` (протилежні кути), `strip-plate`, `strip-cable`. Розділ (сторінка `…/stand`, `freeze: 1`), вісім перевірок: `opened`; (2) `view = pair`, `unfold = 1`: чотири кути у вікні; (3) копія на екрані не вужча за `0,2·W` (`|inset-a.x − inset-b.x|`); (4) `view = plate`: `plate-a`, `plate-b`, `strip-plate` у вікні; (5) `view = copy`: `inset-a`, `inset-b`, `strip-cable` у вікні; (6) `screenHash` у `radio-world` однаковий за `unfold` 0 і 1 — камера у дворі стенда не бачить; (7) у кожному з чотирьох ракурсів `hueFamilies(decodePng(знімок)).families.length ≤ 4`; (8) консоль чиста. З `--touch --size 390x844` перевірки (2) і (3) пропускаються, а в (5) копія не вужча за `0,49·W`.
- [ ] **Крок 7. Запустити й показати знімки.** «Блок Q» з `--only stand` → `PASS sandbox-radio-link — 8 checks`; з `--only stand --touch --size 390x844` → `PASS sandbox-radio-link — 6 checks`; без `--only` → `PASS sandbox-radio-link`. Знімки чотирьох ракурсів і `unfold` 0,5 дивиться Fable 5.2: картинка на пластинці та сама, що бачить камера, не дзеркальна й не перевернута; комірки видно окремо; блок, кабель і копія читаються як одна дорога «пластинка → блок → кабель»; блок стоїть на полиці, а вийнятий (`taken = 1`) — поза нею; стенд не перетинає предметів подвір'я. Її зауваги правляться до коміту. Полицю композиція рухає лише разом із блоком, точкою `cable` і місцем вийнятого блока, доки тест полиці й віконця з кроку 4 (пункт «полиця: …») зелений: за цих чисел — угору не більш як на 0,06 (вище блок налазить на копію), униз не більш як на 0,04, ліворуч не більш як на 0,06.
- [ ] **Крок 8. Коміт.** `git add app/src/volumes/radio/shared/stand/plate.ts app/src/volumes/radio/shared/stand/index.ts app/src/volumes/radio/shared/stand/__tests__/plate.test.ts app/src/volumes/radio/shared/stand/__tests__/stand.test.ts app/src/volumes/radio/shared/screen/index.ts app/src/volumes/radio/shared/screen/runner.ts app/src/volumes/radio/shared/screen/inset.ts app/src/volumes/radio/shared/screen/__tests__/runner.test.ts app/src/volumes/radio/shared/screen/__tests__/inset.test.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/scene.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs` · `git commit -m "Стенд камери, бігунці й копія екрана тому «Радіо»"`

### Завдання C3c. Мапа дороги

**Виконавець:** Opus 5.5 будує; Fable 5.2 приймає знімки кроку 6 до коміту.

**Файли:**
- Створити: `app/src/volumes/radio/shared/map/{layout.ts,index.ts}`
- Змінити: `app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs}` (крок і розділ `map`), `app/src/volumes/radio/shared/README.md` (рядки про `probe`, `stand`, `screen/runner`, `screen/inset`, `map`)
- Тест: `app/src/volumes/radio/shared/map/__tests__/{layout,map}.test.ts`; розділ `map` у `measure.mjs`

**Інтерфейси:**
- Бере: `Yard` — див. Спільний договір; `LENS`, `monitorPlace` з `shared/yard` (B13); `Text3D` з `@/text` (`billboard`, `screenSpace`); `toOverlay`.
- Дає:

  ```ts
  // map/layout.ts — чисте
  export const STATIONS = ['camera', 'transmitter', 'air', 'receiver', 'screen'] as const;
  export type Station = (typeof STATIONS)[number];
  export const STATION_AT: Readonly<Record<Station, number>>;                   // частка дороги: 0 · 0,25 · 0,5 · 0,75 · 1
  export const TRACK_GAP = 4;                                                   // м між доріжками: у tall на 390 × 844 (≈ 12,8 px/м) ≈ 51 px
  export function roadPoints(from: [number, number, number], to: [number, number, number], track: 0 | 1): [number, number, number][];
  // map/index.ts
  export interface RoadMapLabels { tracks: readonly [string, string]; stations: readonly [string, string, string, string, string]; basics: string }
  export interface RoadMap {
    readonly object: Group;                 // mountRoadMap додає його в ctx.root і в yard.hidden; усе на шарі оверлею
    readonly marks: Readonly<Record<Station, [Object3D, Object3D]>>;   // у кожній — диск радіусом 0,5 і невидима куля-мішень радіусом 1,8
    readonly shots: Readonly<Record<'wide' | 'tall', Shot>>;
    show: number;                           // 0…1: дорога намальована до цієї частки; позначка видна, коли її STATION_AT ≤ show
    light(station: Station, track: 0 | 1): void;   // позначка стає яскравою й лишається такою до reset()
    reset(): void;
  }
  export function mountRoadMap(ctx: ChapterContext, yard: Yard, opts: { labels: RoadMapLabels }): RoadMap;
  ```

  Рішення плану. Дорога лежить на землі (y = 0,1) від точки під `LENS.position` до точки під `monitorPlace(1, 0).position` — від камери до кухні; обидва місця беремо з розкладки, а не з якорів, бо під час монтування монітор іще не поставлено. `roadPoints` дає п'ять точок станцій; доріжка 0 зсунута на `TRACK_GAP/2` ліворуч від напрямку руху, доріжка 1 — праворуч (праворуч — це `напрямок × вгору`). `opts.labels` потрібні, бо код не містить українських слів. Написи — `Text3D` (`billboard`, `screenSpace`, 16 px на 1280×720, шар оверлею), а не виноски: телефон показує лише три виноски. Їх вісім: назви доріжок — біля позначок `camera`, кожна зі свого зовнішнього боку дороги; назви станцій — на осі дороги між двома позначками станції; `basics` — на осі за 2,4 м перед початком дороги. Ракурси — вид згори: `target` — середина дороги, `fit = { center: середина, radius: половина довжини + 3 }`; `wide`: `position = середина + (0; 30; 0) + 0,5·праворуч` — дорога лежить на екрані горизонтально, камера ліворуч; `tall`: `position = середина + (0; 30; 0) − 0,5·напрямок` — дорога вертикальна, камера внизу (вузький кадр, C6). Частки станцій, `TRACK_GAP` і радіус кулі-мішені дібрано під телефон: дорога від камери до кухні — 19,8 м, `fit.radius` 12,9, і в `tall` на 390 × 844 рушій дає ≈ 12,8 px на метр (`engine/camera/director.ts:500-513`), тож станції стоять за 4,95 м (≈ 63 px), доріжки — за 4 м (≈ 51 px), а кулі-мішені по 3,6 м (≈ 46 px) не налазять одна на одну; на 1280 × 720 `wide` дає ≈ 41,9 px на метр.

- [ ] **Крок 1. Тести, що падають.** `layout.test.ts`, для `p0 = roadPoints([0, 0, 0], [10, 0, 0], 0)` і `p1 = roadPoints(…, 1)`: `p0.map((p) => p[0])` дорівнює `[0, 2.5, 5, 7.5, 10]` (`toBeCloseTo`); у кожної точки `p0` — `p[1] === 0` і `p[2] = −2` (доріжка 0 — ліворуч від руху вздовж +x), у кожної точки `p1` — `p[2] = +2` (до 1e-9). `map.test.ts` (підробки як у C3b: `yard = { root: new Group(), hidden: [] }`, контекст із `root`): `Object.keys(map.marks)` дорівнює `STATIONS`, у кожної станції дві позначки; `ctx.root.children` і `yard.hidden` містять `map.object`; світове місце `map.marks.camera[0]` — перша точка `roadPoints(…, 0)`; `map.show = 0` — жодної видної позначки; `map.show = 0.5` — видні `camera`, `transmitter`, `air` і не видні `receiver`, `screen`; `light('air', 1)` і `reset()` повертають позначку до звичайної яскравості; обидва ракурси мають `fit`, і кінці дороги та місце напису `basics` лежать у кулі `fit`; у `tall` камера стоїть позаду середини дороги (скалярний добуток `target − position` і напрямку дороги додатний), у `wide` — праворуч від неї.
- [ ] **Крок 2. Побачити падіння.** `pnpm test src/volumes/radio/shared/map` → два файли з `Error: Cannot find module '…' imported from …` (перший відсутній імпорт кожного тесту: `'../layout'` чи `'..'`).
- [ ] **Крок 3. Написати `layout.ts` і `index.ts`.** Той самий запуск: `Test Files  2 passed (2)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 4. Крок `map` пісочниці й розділ `map` у `measure.mjs`.** Крок: мапа з підписами `SANDBOX.labels.map`, повзунок `show`, вибір `view` (`wide`, `tall`), дотик до позначки кличе `light`. Точки `map-<станція>-<доріжка>` (десять). Розділ (сторінка `…/map`, `freeze: 1`), сім перевірок: `opened`; (2) `show = 1`, `view = wide`: усі десять точок у вікні; (3) дві позначки кожної станції розведені на екрані щонайменше на 44 px; (4) кожен напис із `__app.textSizes()` не дрібніший за 16 px; (5) `screenHash` у `radio-world` однаковий за `show` 0 і 1; (6) `hueFamilies(decodePng(знімок)).families.length ≤ 4`; (7) консоль чиста. З `--touch --size 390x844` — `view = tall`, у (4) поріг 14 px.
- [ ] **Крок 5. Запустити.** «Блок Q» з `--only map` → `PASS sandbox-radio-link — 7 checks`; з `--only map --touch --size 390x844` → `PASS sandbox-radio-link — 7 checks`; без `--only` → `PASS sandbox-radio-link`.
- [ ] **Крок 6. Показати знімки й дописати `shared/README.md`.** Знімки `wide` і `tall` дивиться Fable 5.2: дві доріжки розрізнювані, п'ять станцій ідуть від камери до екрана, вісім написів не налазять один на одного й на позначки, дорога читається поверх подвір'я, яскрава позначка помітно відрізняється від звичайної. У `shared/README.md` — по рядку про `probe`, `stand`, `screen/runner`, `screen/inset`, `map` (що це й хто додає себе в `yard.hidden`).
- [ ] **Крок 7. Коміт.** `git add app/src/volumes/radio/shared/map/layout.ts app/src/volumes/radio/shared/map/index.ts app/src/volumes/radio/shared/map/__tests__/layout.test.ts app/src/volumes/radio/shared/map/__tests__/map.test.ts app/src/volumes/radio/shared/README.md app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/scene.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs` · `git commit -m "Мапа дороги з двома доріжками тому «Радіо»"`

### Завдання C4. Глава `prologue`

**Виконавець:** Opus 5.5

**Файли:**
- Створити в `app/src/volumes/radio/chapters/prologue/`: `index.ts`, `content.ts`, `chapter.ts`, `world.ts`, `scene.ts`, `steps/01-watch.ts`, `steps/02-between.ts`, `steps/03-one-number.ts`, `steps/04-map.ts`, `parts/swing.ts`, `parts/seen.ts`, `qa/helpers.mjs`, `qa/interactions.mjs`, `README.md`
- Тест: `__tests__/manifest.test.ts`, `__tests__/parts.test.ts` (там само); браузерний — `qa/interactions.mjs`

**Інтерфейси:**
- Бере: зразок файлів — `app/src/volumes/circuit/chapters/wire/` (факти: `reference-chapters.md` §1.2); `mountWorld`, `YARD_SHOTS`, `whereami`, `routeSlider`, `DEFAULT_STATE`, `Screen.luma` — див. Спільний договір; `mountProbe` (C2); `createScreenInset`, `screenScale`, `Cell` (C3b); `mountRoadMap` (C3c); зміст — `content/generated/prologue.json` (C1); `stepUi` з `@/hud`, `defineChapter`, `defineScene`, `damp`, тип `Shot` з `@/engine/api`.
- Дає: `caption(step, i)` і `label(i)` у `content.ts` (кидають `prologue: no caption ${i} in step '${step}'` і `prologue: no chapter label ${i}`); `STEP_IDS = ['watch', 'between', 'one-number', 'map']`; у `chapter.ts` — `Chapter`, `StepModule`, `StepFactory`, `sessionGoals`, як у `wire/chapter.ts`, з `world: PrologueWorld`; помічники `qa/helpers.mjs`, які бере й C5: `advance(page, seconds)`, `read(page, name)`, `at(page, probe)`, `locate(page, id)` (спершу відкриває вкладку «Керування» через `tools/qa/sheet-tab.mjs`), `shown(page, selector)`, `press(page, selector)`, `pointer(page, touch)` → `{ tap(x, y), drag(x0, y0, x1, y1) }` (миша або дотик через CDP, як у `circuit/chapters/charge/qa/interactions.mjs`), `slide(page, ptr, id, to, from)`, `screenShare(page)`, `inView(page, probe)`, `screenSeen(page)`, `stripSeen(page)`.

  ```ts
  // world.ts
  export interface PrologueWorld {
    readonly world: RadioWorld;            // mountWorld(ctx, { dusk: 0.15 }) — сутінки прологу з таблиці VISUAL.md
    readonly probe: Probe;                 // mountProbe(ctx, world, { width: 1, height: 0.4 }) — 2,5 : 1, як віконце VISUAL.md §6 (0,18 × 0,45 висоти кадру)
    readonly map: RoadMap;                 // підписи — caption('map', 0…7)
    readonly copy: Mesh;                   // createScreenInset(world.screen, 1): копія екрана сталого розміру на екрані; шар оверлею, у yard.hidden
    readonly where: CustomSpec;            // whereami(ctx, { labels: { title: label(0), stops: [label(1)…label(5)], depth: [label(1), label(6), label(7)] }, route, nudge, depth: () => 0 })
    showCopy(anchor: Object3D | null): void;   // над яким якорем висить копія; null — сховати
    state(shot: keyof typeof YARD_SHOTS | Shot, extra?: Partial<StepSpec>): StepSpec;   // { camera: typeof shot === 'string' ? YARD_SHOTS[shot] : shot, ...extra }
    reset(): void;                         // world.resetLine(); yard.wicket = 0; probe.lift(); map.show = 0; map.reset(); showCopy(null)
    update(dt: number, t: number): void;   // кіт → world.update → розмір і місце щупа та копії → probe.update
  }
  export function createPrologueWorld(ctx: ChapterContext): PrologueWorld;
  // parts/swing.ts, parts/seen.ts — чисті
  export function swingAt(tau: number): number;        // 0,8·e^(−τ/1,2)·sin(2π·0,9·τ) для 0 ≤ τ ≤ 5; далі 0
  export interface CellWindow { at: Cell; halfCols: number; halfRows: number }
  export function windowDiff(a: Uint8Array, b: Uint8Array, w: CellWindow): number;                // середнє |a − b| у вікні, обрізаному краями кадру 128 × 96
  export function restDiff(a: Uint8Array, b: Uint8Array, skip: readonly CellWindow[]): number;    // те саме по комірках поза всіма вікнами skip
  ```

Правила для всіх кроків (і для C5):
- `index.ts` — `group: 'prologue'`, `theme: { accent: 'sky', sky: 'dusk', mood: 'diorama' }`; у томі немає `seamless` (П5), тож `leaveChapter` не пишемо; `nav.hiddenUntil` не вживаємо ніде. Стани кроків сцена дає рушієві через `ctx.stage.define`, а `update` сцени кличе `update` поточного кроку, потім `update` світу глави. Жодного українського слова в коді: усе через `caption` і `label`.
- Відтворюваність (Review Focus 3): кожен крок має `reset: true`, а його `enter(info)` починає з `reset()` світу глави і ставить власний стан із таблиці. Після `reset()` жоден прилад не пам'ятає попереднього кроку, тож глибоке посилання, крок назад і прихід кроком уперед дають той самий кадр. Кіт у пролозі має одне правило на всі чотири кроки: `yard.catAt = 0,45 + 0,15·sin(0,25·t)` (у вікно хвіртки він не заходить — C3a, перевірка 16).
- План «де ми» (`where`) стоїть у керуванні кожного кроку обох глав і лише показує план (П21); повзунок маршруту (`routeSlider`) має лише `between`.
- Повзунок, що рухає сцену, пише значення напряму під час тягнення (`onInput(v, 'drag')`) і веде до нього через `damp` після натискання на доріжку чи клавіші; ціль дивиться на показане значення, а не на повзунок.
- Копія екрана й віконце щупа в пролозі тримають сталий розмір на екрані, бо ракурси подвір'я різняться від одного метра до двадцяти п'яти: щокадру `copy.scale` — `screenScale(ctx.camera.camera, H, місце, 1, 0,225·W)`, `probe.scale` — те саме з шириною `min(0,45·H, 0,9·W)` (`W`, `H` — `ctx.viewport`; `VISUAL.md` §6: віконце 0,18 × 0,45 висоти кадру, а пропорцій 2,5 : 1 віконце не міняє, тож на вузькому кадрі ширину обмежує 0,9·W); копія повернута лицем до камери оператора, її нижній край — на чверть її висоти вище якоря, до якоря йде тонкий вусик. Віньєтку діорами глава не вимикає (`VISUAL.md` §5): у `both` копія стоїть на краю овалу віньєтки, і якщо на знімках кроку 7 її сірий помітно фіолетовіє, копію зсуваємо вбік до середини кадру — вона лишається над монітором, а вусик іде до того самого якоря.
- Сцена публікує `ctx.qa.expose('prologue', () => ({ step, reached, monitor, tray, route, wicket, near, far, marks }))` і точки `ctx.qa.probe`: `wicket`, `rod`, `map-<станція>-<доріжка>`, `screen-a`, `screen-b` (протилежні кути видимого екрана — копії, якщо її показано, інакше `world.screen.object`). `near` — `windowDiff(world.screen.luma, знімок, вікно хвіртки)`, де знімок — екран у мить останнього дотику до хвіртки при ввімкненому моніторі, а вікно — `{ at: world.eye.project(anchors.wicket), halfCols: 6, halfRows: 12 }`; `far` — `restDiff` тих самих масивів поза вікном хвіртки й двома вікнами кота (`halfCols: 12, halfRows: 10` довкола його комірки тоді й тепер); до першого такого дотику обидва — 0.

| Крок | Ракурс | Стан на вході (після `reset()`) | Керування й торкання | Ціль у коді |
|---|---|---|---|---|
| `watch` | `both` | `monitor.on = false`; `showCopy(anchors.monitorScreen)` | перемикач `monitor` (підпис 0); хвіртка `yard.anchors.wicket` — `ctx.input.register(…, { click, tooltip: caption 1 })`: дотик запускає `yard.wicket = swingAt(t − t0)` і, якщо монітор увімкнено, бере знімок екрана; виноски «камера» на `lens`, «екран» на `monitorScreen` | `monitor.on`; після дотику при ввімкненому моніторі `\|yard.wicket\|` перевищив 0,3 і `near ≥ 6` |
| `between` | `window`; коли показаний `route` вищий за 1,10 — `ctx.camera.go(YARD_SHOTS.route)`, коли нижчий за 1,02 — назад до `window` | `monitor.on = true`, `route 1`, `tray 0`; `showCopy(anchors.monitor)` | повзунок `tray` 0…1, крок 0,01, мітки «осторонь» (0) і «впритул» (1); `routeSlider({ label: caption('between', 3), stops: [label(2), label(3), label(4), label(5)], from: 1 })` зі своїми обробниками за правилом вище; виноска «прутик» на `monitorAntenna` | хоч раз `line.air.tray ≥ 0,9` і хоч раз `line.air.route ≥ 3,9` |
| `one-number` | `antenna` | `monitor.on = true`; копії немає — у кадрі справжній екран | прутик `monitorAntenna` — `ctx.input.register(…, { click, tooltip: caption 0 })`: `probe.touch('air.rx', anchors.monitorAntenna)`; повзунок `zoom` (підпис 1) 1…9000, `scale: 'log'`, `format: (v) => String(Math.round(v))` (без «×», C1): `probe.span = 1/zoom`, `probe.start = 0,5 − span/2`; виноска «одне число» на `probe.window` після цілі | `probe.tap === 'air.rx'` і `probe.span < 0,002` |
| `map` | `map.shots.wide` | `map.show = 1` | десять позначок `map.marks[станція][доріжка]` — дотик: `map.light(…)`, підказка — назва станції | торкнуто позначку доріжки 0 і позначку доріжки 1 |

- [ ] **Крок 1. Тести, що падають.** `manifest.test.ts` — як `circuit/chapters/wire/__tests__/manifest.test.ts`, із `raw` з `@radio/content/generated/prologue.json`: id і назви кроків маніфесту дорівнюють згенерованим; `[...STEP_IDS]` дорівнює id; `it.each` на кожен підпис, який беруть кроки, — усі з таблиці C1, зокрема `['watch', 0, 'Монітор']`, `['between', 3, 'Нести монітор']`, `['one-number', 0, 'прутик']`, `['one-number', 2, 'одне число']`, `['map', 7, 'з чого зроблена хвиля']`; `label(0) === 'Де ми'`, `label(5) === 'льох'`, `label(7) === 'під лупою'`; підпис «одне число» має `at: 'takeaway'`. `parts.test.ts`:

  ```ts
  expect(swingAt(0)).toBe(0);  expect(swingAt(1 / 3.6)).toBeCloseTo(0.635, 2);  expect(Math.abs(swingAt(4.9))).toBeLessThan(0.02);  expect(swingAt(5.1)).toBe(0);
  const a = new Uint8Array(12288), b = new Uint8Array(12288); b[48 * 128 + 64] = 120;
  const w = { at: { col: 64, row: 48 }, halfCols: 6, halfRows: 12 };
  expect(windowDiff(a, b, w)).toBeCloseTo(120 / (13 * 25), 9);  expect(restDiff(a, b, [w])).toBe(0);  expect(restDiff(a, b, [])).toBeCloseTo(120 / 12288, 9);
  b.fill(0); b[0] = 91;  expect(windowDiff(a, b, { at: { col: 0, row: 0 }, halfCols: 6, halfRows: 12 })).toBe(1);   // вікно обрізано кутом: 7 × 13 комірок
  ```

- [ ] **Крок 2. Побачити падіння.** `pnpm test src/volumes/radio/chapters/prologue` → `Error: Cannot find module '../chapter' imported from …/__tests__/manifest.test.ts` (за зразком `wire` тест імпортує `../chapter`, `../content`, `../index`; vitest називає перший відсутній) і `Error: Cannot find module '../parts/…' imported from …/__tests__/parts.test.ts`, `Test Files  2 failed (2)`.
- [ ] **Крок 3. Каркас глави.** `index.ts`, `content.ts`, `chapter.ts`, `parts/*`, `world.ts`, `scene.ts` і чотири кроки поки лише зі станом сцени (`spec`) та порожнім `ui`. `pnpm test src/volumes/radio/chapters/prologue` → `Test Files  2 passed (2)`; `pnpm typecheck && pnpm lint` — без виводу; `pnpm test src/engine/__tests__/volumes.test.ts` — зелений (глава є в подорожі з тією самою групою).
- [ ] **Крок 4. Браузерний тест.** `qa/helpers.mjs` і `qa/interactions.mjs` за зразком `circuit/chapters/wire/qa/` (заголовок `/* global process, console, window, document */`; параметри `--port`/`--base`, `--size` (типово 1280x720), `--touch`, `--out`; сторінка `appUrl(base, { route: 'radio/prologue/watch', freeze: 1, extra: { hud: 'dom' } })`; жести — лише через `pointer`). Числа — з `read(page, 'radio-world')`, `read(page, 'radio-probe')`, `read(page, 'prologue')`. Нові помічники: `inView(page, probe)` — точка `__app.locate(probe)` має `visible` і `shown`, і під нею саме полотно сцени (`document.elementFromPoint(x, y).tagName === 'CANVAS'`), а не панель чи аркуш; `screenSeen(page)` — `screen-a` і `screen-b` у вікні за `inView`, і `|a.x − b.x|` не менший за `0,2·W` у кадрі з `W ≥ H` та за `0,49·W` у вузькому (256 px на 1280×720, 191 px на 390×844); `stripSeen(page)` — те саме для `strip-a`, `strip-b`. 39 перевірок:
  - `watch` (7): висновку немає; `screenMean === 0`, доки монітор вимкнено; після перемикача `screenMean > 10`; висновку досі немає; після дотику до хвіртки й `advance(0.3)` — `near ≥ 6` і `near ≥ 3 × far` (змінилося саме місце хвіртки, а не кіт чи весь кадр); висновок є; після `advance(5)` — `near ≤ 3` (хвіртка стала, екран повернувся);
  - `between` (8): висновку немає; `meters.rxDbm` = −62 ± 1,5; деко до кінця — рівень упав на 15…18 dB; зерно: `screenNoise ≥ 1,2 ×` кухонного; висновку досі немає; деко назад, монітор до кінця маршруту — `rxDbm` = −88 ± 1,5; сніг: `screenNoise ≥ 1,2 ×` числа з деком, `meters.syncLost > 0,3`, а з деком він був менший за половину цього; висновок є;
  - `one-number` (5): висновку немає; після дотику до `rod` `tap === 'air.rx'` і `max > min`; висновку досі немає; повзунок до кінця — `span < 0.002`; висновок є;
  - `map` (3): висновку немає; після `map-camera-0` — досі немає; після `map-screen-1` — є;
  - кінцева картка (4), через `closingCard` з `tools/qa/next-chapter.mjs`: `card.shown`, `card.lines === 0`, а `card.bridge` закінчується назвою наступної глави з кнопки (`card.next` після «Далі: »); кнопка `[data-ui="path-next"]` вимкнена й має непорожній `data-tip` (рушій пише туди «Ця глава ще готується»); кнопки `[data-ui="path-map"]` немає (вона буває лише в кінці подорожі); ще одне «Далі» в навігаторі (`[data-ui="nav-next"]`) і `advance(2.5)`: якщо в `__app.listChapters('radio')` є `lines` — `__app.position().chapterId === 'lines'` (П8), інакше позиція лишилася `prologue/map` («Далі» ходить лише збудованими главами, а `lines` з'явиться в C5);
  - кадр кожного кроку (4): `screenShare(page) ≤ 0.25` (площа прямокутника між `screen-a` і `screen-b`, поділена на площу вікна; 0, якщо екран сховано); у `watch` — `screenSeen`; у `between` — `screenSeen` на кухні і ще раз у льоху, після зміни ракурсу; у `one-number` — `screenSeen` і, після дотику, `stripSeen`;
  - план «де ми» (1), у `watch`: `[data-ui="ctl-whereami"]` є, а `[data-ui="ctl-whereami:depth-0"]` має `aria-current="true"`;
  - крок назад (2): із `between` із монітором у льоху — `__app.prev()` і `advance(1)`: позиція `prologue/watch`; `screenMean === 0`, `prologue.route === 1`, `prologue.wicket === 0`, `prologue.near === 0`;
  - глибокі посилання (4): чотири свіжі сторінки з `freeze: 3` — позиція та сама; `watch`: `screenMean === 0`; `between`: `rxDbm` = −62 ± 1,5; `one-number`: `tap === null`; `map`: `prologue.marks` порожній; помилок консолі немає;
  - консоль (1): `appErrors(page)` порожній — ні помилок, ні попереджень.

  Останній рядок: `PASS <n> checks at <W>x<H>[ (touch)]` (тут — `PASS 39 checks at 1280x720`) або `FAIL <k> of <n>`; код виходу 1 за будь-якої невдачі. Окремий режим `--live <крок>` (рішення плану): відкриває крок без `freeze`, чекає 5 с справжнього часу, вимагає `mode === 'worker'`, `frames > 0` і порожній `appErrors` та друкує `PASS live <крок>` і `radio-world` одним рядком JSON — так уперше перевіряється фоновий потік у збірці сайту під підкаталогом.
- [ ] **Крок 5. Зібрати сайт і побачити падіння.** Блок S, у фоні, з командою

  ```bash
  node app/src/volumes/radio/chapters/prologue/qa/interactions.mjs --base "$BASE" --out "$QA_OUT/c4"     # журнал $QA_OUT/c4-prologue.log
  ```

  Очікуємо падіння вже на кроці `watch`: у журналі `FAIL watch        threw: control 'monitor' is not on screen` (керування й цілей ще немає), останній рядок `FAIL <k> of 39`.
- [ ] **Крок 6. Написати кроки** за таблицею вище, по одному, щоразу повторюючи крок 5, доки не буде `PASS 39 checks at 1280x720`. Те саме з `--size 1920x1080` → `PASS 39 checks at 1920x1080`. Потім `--live between` → `PASS live between`; якщо `mode` виявився `sync`, фоновий потік не завантажився з підкаталогу сайту: це вада `shared/link` (адреса `new URL('./model.worker.ts', import.meta.url)`), а не глави. Якщо деко дає не 15…18 dB — це вада B6a/B6b (закон краю вже в Спільному договорі): правимо за правилом черги, окремим комітом, разом зі зразками еталона й обома `--check`; поріг тесту не чіпаємо. Якщо `screenSeen` падає в `one-number` — правимо `YARD_SHOTS.antenna` у `shared/yard/shots.ts`, теж окремим комітом, і тим самим комітом у `docs/volumes/radio/VISUAL.md` §7 — рядок `antenna` таблиці «Ракурси» й пункт «`antenna` — герой …» (тепер: прутик і весь екран у кадрі; екран не вужчий за 0,2 ширини кадру, у вузькому кадрі — за 0,49).
- [ ] **Крок 7. Подивитися кадри.** У `$QA_OUT/c4` по знімку на крок. Шукаємо: монітор вимкнено — скло темне, без картинки; на екрані й на копії видно паркан, кота й хвіртку, а не стенди, щуп, копію чи підписи; із деком — зерно, і картинка стоїть; у льоху — сніг, рядки рвуться; сніг не намальований поверх чистої картинки (між двома знімками зерно різне лише там, де різний стан); копія не закриває хвіртки й кота, а її сірий у `both` і `window` помітно не фіолетовіє (інакше — зсунути копію за правилом про копію вище; віньєтки не вимикаємо); стрічка у віконці щупа — одна крива; на мапі дві доріжки й п'ять станцій із читабельними назвами.
- [ ] **Крок 8. `README.md` глави** — «Файли», таблиця кроків (ракурс · що робить читач → ціль · підписи), «Що спрощено», команда перевірки — за зразком `circuit/chapters/wire/README.md`.
- [ ] **Крок 9. Коміт.** `git status --short -uall` показує рівно шістнадцять нових файлів зі списку «Файли», і жодного іншого.

  ```bash
  P=app/src/volumes/radio/chapters/prologue
  git add $P/{index,content,chapter,world,scene}.ts $P/steps/{01-watch,02-between,03-one-number,04-map}.ts $P/parts/{swing,seen}.ts \
    $P/qa/{helpers,interactions}.mjs $P/README.md $P/__tests__/{manifest,parts}.test.ts
  git commit -m "Пролог тому «Радіо»: чотири кроки на живій лінії"
  ```

### Завдання C5. Глава `lines`

**Виконавець:** Opus 5.5

**Файли:**
- Створити в `app/src/volumes/radio/chapters/lines/`: `index.ts`, `content.ts`, `chapter.ts`, `world.ts`, `scene.ts`, `steps/01-cell.ts`, `steps/02-row.ts`, `steps/03-frame.ts`, `steps/04-knit.ts`, `steps/05-marks.ts`, `steps/06-whole.ts`, `parts/window.ts`, `qa/helpers.mjs` (`export * from '../../prologue/qa/helpers.mjs'`), `qa/interactions.mjs`, `README.md`
- Змінити, лише якщо крок 6 змінив `ROW_SHIFT`: `docs/volumes/radio/VISUAL.md` (§2 «Кадр камери», пункт «Штахети»)
- Тест: `__tests__/manifest.test.ts`, `__tests__/window.test.ts`; браузерний — `qa/interactions.mjs`

**Інтерфейси:**
- Бере: усе, що C4; `mountCameraStand`, `createRunner`, `twinCell`, `footprint`, `cellSample`, `sampleCell` (C3b); `lumaStrip` (C2); `FRAME_CH`, `LINE` — див. Спільний договір.
- Дає: `STEP_IDS = ['cell', 'row', 'frame', 'knit', 'marks', 'whole']`; `index.ts` — `group: 'picture'`, та сама тема; читач `ctx.qa.expose('lines', …)`.

  ```ts
  // world.ts
  export interface LinesWorld {
    readonly world: RadioWorld;                                // mountWorld(ctx, { dusk: 0.35 })
    readonly stand: CameraStand;
    readonly probe: Probe;                                     // mountProbe(ctx, world, { width: 1, height: 0.4 }), як у пролозі; розмір на екрані — VISUAL.md §6, scale щокадру в update
    readonly runner: Runner;     readonly twin: Runner;        // twin живе на stand.inset
    readonly where: CustomSpec;                                // як у пролозі, але depth: () => 1
    readonly places: { wall(): Cell | null; nook(): Cell | null; spot(): Cell | null; row(): number };   // world.eye.project якорів shedWall, nook, cat; row = рядок цятки + ROW_SHIFT
    state(shot: keyof CameraStand['shots'], extra?: Partial<StepSpec>): StepSpec;
    reset(): void;      // world.resetLine(); yard.catAt = 0.62; stand.unfold = 1; stand.syncBlock.taken = 0; stand.inset.visible = true; probe.lift(); бігунці сховано, spread(1, 1)
    update(dt: number, t: number): void;                       // world.update → stand.update → probe.scale = screenScale(ctx.camera.camera, H, місце віконця, 1, min(0,45·H, 0,9·W)) → probe.update
  }
  // parts/window.ts — чисте; кадр сигналу камери — FRAME_CH = 28 800 відліків
  export function windowOf(pos: number, zoom: number): { start: number; span: number };   // span = 1/zoom; start = clamp(pos − span/2, 0, 1 − span)
  export function holds(start: number, span: number, sample: number): boolean;            // start·28800 ≤ sample < (start + span)·28800
  export function syncInWindow(start: number, span: number): boolean;                     // у середній третині вікна є відлік s із s mod 288 = 17 (середина синхроімпульсу)
  ```

Правила C4 чинні. У всій главі кіт сидить (`yard.catAt = 0,62`), монітор на кухні. `ROW_SHIFT = 4` у `world.ts` — на стільки комірок рядок кроку `row` лежить нижче цятки: він іде крізь тулуб кота, а не крізь саму цятку. Напруга комірки — `u = 0,3 + 0,7·Y/255`, у вольтах: рівні зменшеного стандарту збігаються зі справжнім відеосигналом (рішення плану).

| Крок | Ракурс | Стан на вході (після `reset()`) | Керування й торкання | Ціль у коді |
|---|---|---|---|---|
| `cell` | `plate` | `stand.inset` сховано; `stand.unfold` іде 0 → 1 за 2,4 с від входу, лінійно за часом, і зупиняється рівно на 1; одразу 1 лише за `info.direction === −1`; `panel.hiddenUntil: () => stand.unfold > 0.98` | пластинка — `ctx.input.register(stand.plate, { click, tooltip: caption 0 })`: `if (!e.point) return; const c = stand.cellUnder(e.point); if (!c) return;` → наконечник на `cellAt(c)`, `probe.feed(наконечник, рівна лінія на висоті напруги комірки, stand.stripAt.plate)`; показ `volts` (підпис 1, одиниця `V`, два знаки); виноски «стіна сараю» і «темний закуток» на точках `cellAt` місць `places.wall()`, `places.nook()` (сховані, якщо місце `null`) | серед торкнутих комірок найбільша й найменша `Y/255` різняться більш як на 0,4 |
| `row` | `plate` | `stand.inset` сховано; бігунець у комірці `(0, places.row())` | повзунок `runner` 0…127, крок 1; `probe.feed(бігунець, () => lumaStrip(world.luma, row·128 + col + 1, col + 1, 256), stand.stripAt.plate)`; після цілі виноски «рядок» (на пластинці) і «сигнал» (`probe.anchorAt(0.5, 0.65)`) | бігунець побував у комірці ≤ 2, а після того — у ≥ 125 |
| `frame` | `pair` | швидкість 8 | повзунок `speed` 8…307200, `scale: 'log'`, одиниця — підпис 1, мітка «справжня» на 307200; бігунець іде комірками в порядку читання: `p += v·dt`; `const f = footprint(v); runner.spread(f.cols, f.rows); twin.spread(f.cols, f.rows)`; двійник — у тій самій комірці на `stand.inset`; `probe.feed` — останні `min(2·v, 12288)` комірок перед `p`, віконце на `stripAt.plate`; після цілі виноска «кадр» на пластинці | показана швидкість ≥ 300000 |
| `knit` | `pair` | блок у камері (`camera.sync = true`), `monitor.lineLength = 288`; бігунець іде зі швидкістю 96 | перемикач `block` (підпис 0; увімкнено — вийнято) і дотик до `stand.syncBlock.object`: `syncBlock.taken` іде до 1 чи 0, а `line.camera.sync = taken < 0.5`; повзунок `line-length` 280…296, крок 0,5 → `line.monitor.lineLength`; двійник: `const m = world.meters; const c = m ? twinCell(col, row, m) : null; twin.visible = c !== null; if (c) twin.at(stand.inset, c.col, c.row)`; виноски «блок», «бігунець», «двійник» | `camera.sync === false`, і з таким станом довжина побувала < 287,5 і > 288,5 |
| `marks` | `pair` | блок вийнято: `camera.sync = false`, `syncBlock.taken = 1`, `lineLength = 288,5`; перемикач `block` типово ввімкнено; `probe.touch('camera.video', stand.cable, stand.stripAt.cable)`, `start = 0`, `span = 2/100` | перемикач `block` і дотик до блока, як у `knit`; виноска «позначка» → «синхроімпульс» на `probe.anchorAt(17/576, 0)`, видна, коли блок у камері; після цілі на `syncBlock.lid` напис «синхроімпульси» | `camera.sync === true` після того, як у цьому відвідуванні було `false`, і `world.meters.syncLost ≤ 0,01` |
| `whole` | `pair` | блок у камері; `probe.touch('camera.video', stand.cable, stand.stripAt.cable)` | повзунок `place` (підпис 0) 0…1, типово 0,505 (середина рядка: синхроімпульсу посередині віконця ще немає), крок 1/2880, `snaps` — місця стіни й цятки (`cellSample(…)/28800`); повзунок `zoom` (підпис 1) 1…1800, `scale: 'log'`, показ як у пролозі; `{ start, span } = windowOf(place, zoom)`; бігунець і двійник — у `sampleCell` середини вікна (сховані, якщо `null`); три виноски на кривій, кожна видна, поки її місце у вікні | знайдено всі три: синхроімпульс — `zoom ≥ 100` і `syncInWindow`; стіна — `zoom ≥ 25` і `holds(…, cellSample(places.wall()))`; цятка — `zoom ≥ 50` і `holds(…, cellSample(places.spot()))` |

Рішення плану (уточнення проєкту II §2):
- Вхідний стан `marks`: за проєктом блок у `knit` виймає сам читач, тож кіт «пливе одразу» на вході в `marks` (запис `lines/marks`: «Вставити вийнятий блок назад»), а не в `knit`.
- Розкладання стенда в `cell` іде й тоді, коли `info.instant`: перший крок глави рушій завжди відкриває з `instant: true` (факти: `chapter-api.md` §1.5, випадки A і C), інакше читач не побачив би його ніколи.
- Ціль `whole` для синхроімпульсу — «розтягнуто щонайменше в сто разів і провал посередині»: за `zoom` 50…99 у вікні завжди є хоч один синхроімпульс, і шукати не було б чого.

- [ ] **Крок 1. Тести, що падають.** `manifest.test.ts` — як у C4, із підписами таблиці C1 (зокрема `['cell', 0, 'комірка']`, `['marks', 1, 'позначка']`, `['marks', 2, 'синхроімпульс']`, `['marks', 3, 'синхроімпульси']`, `['whole', 0, 'Де в кадрі']`, `['whole', 4, 'цятка кота']`; «рядок», «сигнал», «кадр», «синхроімпульс», «синхроімпульси» мають `at: 'takeaway'`, «позначка» — `until: 'takeaway'`). `window.test.ts`:

  ```ts
  expect(windowOf(0.5, 100)).toEqual({ start: 0.495, span: 0.01 });      // toBeCloseTo, 12 знаків
  expect(windowOf(0, 50).start).toBe(0);  expect(windowOf(1, 50).start).toBeCloseTo(0.98, 12);
  expect(holds(0.495, 0.01, 14400)).toBe(true);  expect(holds(0.495, 0.01, 14600)).toBe(false);
  expect(syncInWindow(0, 576 / 28800)).toBe(true);  expect(syncInWindow(0, 30 / 28800)).toBe(true);
  expect(syncInWindow(100 / 28800, 100 / 28800)).toBe(false);  expect(syncInWindow(150 / 28800, 100 / 28800)).toBe(false);
  const mid = windowOf(0.505, 100), on = windowOf(0.5, 100);              // вікно в один рядок: провал збоку — ні, посередині — так
  expect(syncInWindow(mid.start, mid.span)).toBe(false);  expect(syncInWindow(on.start, on.span)).toBe(true);
  ```

- [ ] **Крок 2. Побачити падіння.** `pnpm test src/volumes/radio/chapters/lines` → `Error: Cannot find module '…' imported from …` у `manifest.test.ts` (`'../chapter'`) і `window.test.ts` (`'../parts/window'`), `Test Files  2 failed (2)`.
- [ ] **Крок 3. Каркас глави** (як крок 3 у C4): `Test Files  2 passed (2)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 4. Браузерний тест `qa/interactions.mjs`.** Сторінка `radio/lines/cell`, `freeze: 1`. Сцена публікує `lines`: `{ step, reached, unfold, volts, row: { row, edges, catRun }, runner, twin, speed, footprint, sync, taken, lineLength, lid, found, places, shear: { measured, twin } }` і точки `cell-wall`, `cell-nook`, `block`, `screen-a`, `screen-b` (кути `stand.inset`). `edges` — скільки сусідніх комірок рядка `places.row()` різняться більш як на 40; `catRun` — довжина відрізка цього рядка довкола стовпчика цятки, де яскравість відходить від тамтешньої не більш як на 12 (сходинка кота). `shear` (лише для тесту, рахується під час читання): `r` — рядок `places.wall()`; `measured` — цілий зсув `d` із −100…100, за якого середнє `|world.screen.luma[r][c + d] − world.luma[r][c]|` (рядки по 128) по стовпчиках, де обидва в кадрі (не менш як 40), найменше; `twin` — `twinCell(c, r, meters).col − c` для першого `c` із 64, 32, 96, де двійник не `null` і лишився в рядку `r`. 54 перевірки:
  - `cell` (5): висновку немає; після `advance(2)` `unfold === 1`; дотик до `cell-wall` — `volts ≥ 0.84`, висновку ще немає; дотик до `cell-nook` — `volts ≤ 0.5` (це пороги 200 і 70 із C3a у вольтах); висновок є;
  - `row` (5): висновку немає; `row.edges ≥ 6` і `row.catRun ≥ 5` (у рядку є штахети й кіт); бігунець до середини — висновку немає; до кінця — у `radio-probe` `local === true` і `max − min > 0.3`; висновок є;
  - `frame` (5): висновку немає; `footprint` = `{ cols: 1, rows: 1 }`; швидкість до кінця й `advance(1)` — `footprint` = `{ cols: 128, rows: 96 }`; у `radio-probe` `local === true`, `n === 256`, `max − min > 0.3` (стрічка — один довгий сигнал); висновок є;
  - `knit` (9): висновку немає; з блоком у камері `meters.syncLost === 0`, а `twin` у тому самому рядку, що `runner`, і не далі ніж за 2 стовпчики; перемикач і `advance(0.6)` — `sync === false`, висновку немає; повзунок на 0,1 доріжки — `meters.lineDrift < −0.3`; на 0,9 — `> 0.3`; `|meters.lineDrift − (lineLength − 288)| < 0.2`; висновок є; `__ui.set('line-length', 288.5, true)` і `advance(0.2)` — `shear.measured ≤ −8` (довгий рядок монітора: картинка поїхала ліворуч) і `|shear.measured − shear.twin| ≤ 2`; `287.5` — `shear.measured ≥ 8` і `|shear.measured − shear.twin| ≤ 2` (двійник лежить там, куди справді поїхала картинка);
  - `marks` (5): на вході `sync === false`, `lid === false`, `meters.lineDrift` = 0,5 ± 0,1 і `radio-probe.min ≥ 0.28` (провалу на кривій немає); висновку немає; перемикач і `advance(0.6)` — `meters.syncLost === 0` і `radio-probe.min ≤ 0.15` (провал нижчий за чорне); висновок є; `lid === true`;
  - `whole` (7): висновку немає; `radio-probe.tap === 'camera.video'`; `zoom` до 0,62 доріжки (≈ ×104) — `found.sync === false`; `place` на `(places.wall.row·288 + 17)/28800` — `found.sync`; на місце стіни — `found.wall`; на місце цятки — `found.spot`; висновок є;
  - кінцева картка (2), через `closingCard`: `shown`, `lines === 3`, місток закінчується назвою наступної глави з кнопки (`card.next`); кнопка `path-next` вимкнена й має непорожній `data-tip`;
  - кадр кожного кроку (6): `screenShare(page) ≤ 0.25`; `stripSeen` — у `row`, `frame`, `marks`, `whole`; `screenSeen` — у `knit`, `marks`, `whole`, а в кадрі з `W ≥ H` ще й у `frame`;
  - план «де ми» (1), у `cell`: `[data-ui="ctl-whereami:depth-1"]` має `aria-current="true"`;
  - крок назад (2): із `marks` після висновку — `__app.prev()` і `advance(1)`: позиція `lines/knit`; `sync === true`, `taken === 0`, `lineLength === 288`, `meters.syncLost === 0`;
  - глибокі посилання (6), `freeze: 3`: позиція та сама й консоль чиста; додатково `knit` — `sync === true` і `syncLost === 0` (кіт стоїть), `marks` — `sync === false` і `lineDrift` = 0,5 ± 0,1 (кіт пливе одразу), `cell` — `unfold === 1`;
  - консоль (1).

  Останній рядок — як у C4: `PASS 54 checks at 1280x720`. Режим `--live knit` понад умови C4: `__ui.set('block', true, true)`, `__ui.set('line-length', 290, true)`, 3 с, далі п'ять читань через 0,5 с (`radio-world` і `lines` — в одному `evaluate`): `meters.lineOffset` різняться більш як на 1 відлік (без блока ритм рядків справді пливе); `meters.syncLost === 1`; хоч раз `meters.lineRow` між 4 і 96 (картинка котиться), а в кожному читанні з видним двійником `(twin.row − runner.row − meters.lineRow + 200) % 100` — одне з 98, 99, 0, 1, 2 (двійник котиться з картинкою; ±1 дає перенос рядка, ще ±1 — кадр моделі, що прийшов після кроку). Потім тричі `__app.goto('prologue', 'watch')` і `__app.goto('lines', 'knit')`, щоразу дочекавшись цієї позиції в `__app.position()`: після третього повернення `mode === 'worker'` і не пізніш як за 5 с `page.workers().length === 1` (Review Focus 3: потоки не лишаються).
- [ ] **Крок 5. Побачити падіння** — як крок 5 у C4: Блок S із `node app/src/volumes/radio/chapters/lines/qa/interactions.mjs --base "$BASE" --out "$QA_OUT/c5"`, журнал `$QA_OUT/c5-lines.log`; у ньому `FAIL cell         threw: probe 'cell-wall' is unknown`.
- [ ] **Крок 6. Написати кроки** за таблицею, по одному, до `PASS 54 checks at 1280x720`; потім `--size 1920x1080` і `--live knit` → `PASS live knit`. Якщо в рядку `places.row()` немає штахет чи кота (`edges < 6` або `catRun < 5`) — міняємо `ROW_SHIFT`, а не поріг, і тим самим комітом — «на 4 комірки нижче цятки» в `docs/volumes/radio/VISUAL.md` §2 («Кадр камери», пункт «Штахети»). Якщо не сходиться `shear` — вада в `twinCell` або в `meters` моделі: шукаємо її (правило черги), а не міняємо знак на око.
- [ ] **Крок 7. Пролог тепер має сусіда.** Два Блоки S, по одному. Перший: `node app/src/volumes/radio/chapters/prologue/qa/interactions.mjs --base "$BASE" --out "$QA_OUT/c5"` → `PASS 39 checks at 1280x720` (останнє «Далі» кінцевої картки тепер веде в `lines/cell`). Другий: `node tools/qa/chapter-check.mjs radio/lines --base "$BASE" --skip perf,random,layout --out "$QA_OUT/c5"` — у журналі серед рядків `[5/5] leak check: radio/lines ⇄ radio/prologue ×3`, і за ним жодного `FAIL leak: …` (Review Focus 3); решту вад цієї перевірки закриває C7.
- [ ] **Крок 8. Подивитися кадри.** Шукаємо: `cell` — комірки пластинки видно окремо, картинка на ній та сама, що бачить камера; `row` — на стрічці зубці штахет і сходинка кота; `frame` — на найбільшій швидкості цятка зникла в рівному світінні, стрічка — один довгий сигнал; `knit` — кіт на копії екрана скошений в один бік при короткому рядку й у другий при довгому, двійник іде за ним; у живому режимі з вийнятим блоком картинка ще й повільно котиться вгору чи вниз, і двійник котиться з нею; `marks` — провал перед кожним рядком добре видно на кривій (поріг міряє тест); на кришці напис з'являється лише після висновку; `whole` — при `zoom ≈ ×100` у вікні один рядок, а цятка кота — вузька голка.
- [ ] **Крок 9. `README.md` глави** — як у C4.
- [ ] **Крок 10. Коміт.** `git status --short -uall` показує рівно сімнадцять нових файлів зі списку «Файли» і, якщо крок 6 змінив `ROW_SHIFT`, ще ` M docs/volumes/radio/VISUAL.md` (тоді й він — у `git add`), і жодного іншого.

  ```bash
  L=app/src/volumes/radio/chapters/lines
  git add $L/{index,content,chapter,world,scene}.ts $L/steps/{01-cell,02-row,03-frame,04-knit,05-marks,06-whole}.ts $L/parts/window.ts \
    $L/qa/{helpers,interactions}.mjs $L/README.md $L/__tests__/{manifest,window}.test.ts
  git commit -m "Глава lines тому «Радіо»: шість кроків від комірки до сигналу"
  ```

### Завдання C6. Телефон і планшет

**Виконавець:** Opus 5.5

**Файли:**
- Змінити: `app/src/volumes/radio/chapters/prologue/{world.ts,steps/*.ts}`, `app/src/volumes/radio/chapters/lines/{world.ts,steps/*.ts}` (вузький кадр); `app/src/volumes/radio/shared/yard/shots.ts`, `app/src/volumes/radio/shared/stand/index.ts`, `app/src/volumes/radio/shared/map/index.ts` (лише `fit` ракурсів, крок 2); `docs/volumes/radio/VISUAL.md` (§7, таблиця «Ракурси»: `fit.center`, `fit.radius` того ракурсу `YARD_SHOTS`, чий `fit` змінено, — тим самим комітом)
- Тест: `tools/qa/mobile-check.mjs` у профілях `pp,pl,tp`; `qa/interactions.mjs --touch --size 390x844` обох глав; «Блок Q»

**Інтерфейси:**
- Бере: `ctx.viewport.aspect`, `ctx.onResize`; `PrologueWorld.showCopy`, `CameraStand.shots.copy`, `CameraStand.narrow` (C3b), `RoadMap.shots.tall`; `Shot.fit`.
- Дає: правило вузького кадру (рішення плану): `narrow = ctx.viewport.aspect < 1`, поле обох світів глав, перераховується в `ctx.onResize`. У вузькому кадрі крок називає одне місце, а екран і стрічка стоять поруч із ним:

  | Крок | Місце у вузькому кадрі | Екран | Стрічка |
  |---|---|---|---|
  | `prologue/watch` | ракурс `pole` (кіт і хвіртка, `VISUAL.md` §7) | копія над якорем `wicket` | — |
  | `prologue/between` | `window`, далі `route` | копія над `monitor` | — |
  | `prologue/one-number` | `antenna` | справжній екран | над прутиком |
  | `prologue/map` | `map.shots.tall` | — | — |
  | `lines/cell`, `row`, `frame` | `plate` | — (у `frame` копію сховано) | під пластинкою |
  | `lines/knit`, `marks`, `whole` | `copy` | `stand.inset` | під копією (`marks`, `whole`) |

  У вузькому кадрі копія прологу має ширину `0,56·W`; віконце щупа — за правилом C4, `min(0,45·H, 0,9·W)` за сталих 2,5 : 1 (на 390 × 844 — `0,9·W`, 351 px). Ні копія, ні сам екран не займають більш як чверть кадру. Керування й план «де ми» — у доку чи на вкладці «Керування»; у сцені лишаються екран, стрічка й не більш як три виноски. Умову Review Focus 5 «видно екран і стрічку разом» міряють `screenSeen` і `stripSeen` тих самих 39 і 54 перевірок на розмірі 390×844.

- [ ] **Крок 1. Побачити вихідний стан.** Чотири Блоки S, по одному, у фоні; кожен рядок нижче — `<команда>` свого блока:

  ```bash
  node tools/qa/mobile-check.mjs radio/prologue --profiles pp,pl,tp --skip perf --base "$BASE" --out "$QA_OUT/c6"
  node tools/qa/mobile-check.mjs radio/lines    --profiles pp,pl,tp --skip perf --base "$BASE" --out "$QA_OUT/c6"
  node app/src/volumes/radio/chapters/prologue/qa/interactions.mjs --base "$BASE" --touch --size 390x844 --out "$QA_OUT/c6"
  node app/src/volumes/radio/chapters/lines/qa/interactions.mjs    --base "$BASE" --touch --size 390x844 --out "$QA_OUT/c6"
  ```

  Записати кожен рядок `FAIL` із журналів. Швидкодію тут не міряємо (`--skip perf`, `PATH-NOTES.md` §8: під програмним рендером кадр телефона 37–45 ms проти 16,6; міряє власник).
- [ ] **Крок 2. Вузький кадр.** Додати `narrow` у два `world.ts` і застосувати таблицю вище в кроках. Кожному ракурсу, який не вміщає свій предмет у профілі `pp`, поправити `fit` (центр і радіус предмета кроку), а не позицію камери. Стенду глава `lines` ставить `stand.narrow = narrow` (C3b): ракурси `plate` і `copy` й місця `stripAt` стенда тоді стоять за числами вузького кадру C3b, і `fit` цих двох ракурсів у вузькому кадрі не правимо — їхні числа тримає тест полиці C3b (крок 4).
- [ ] **Крок 3. Досяжність.** Усі торкання в сцені (хвіртка, прутик, позначки мапи, комірки, блок) мають ціль не меншу за 44 px у профілях `pp` і `pl` та за 48 px у `tp` (так рахує `mobile-check`): де предмет менший, зареєструвати невидиму більшу кулю-мішень (зразок — `circuit/chapters/wire/parts/proxies.ts`; позначки мапи її вже мають). Для `lines/cell` дотик бере комірку під пальцем; ціль досяжна, бо стіна й закуток — великі плями.
- [ ] **Крок 4. Зелене.** Повторювати крок 1, доки не буде: `mobile-check radio/prologue: PASS — 0 failure(s), …` і те саме для `radio/lines`; `PASS 39 checks at 390x844 (touch)`; `PASS 54 checks at 390x844 (touch)`. Потім: обидва тести без `--touch` на 1280x720 — ті самі `PASS 39…` і `PASS 54…`; `interactions.mjs` прологу з `--live between --touch --size 390x844` → `PASS live between` (рідші кадри моделі нічого не ламають — третя умова Review Focus 5); «Блок Q» без `--only` і з `--only yard,whereami,stand,map --touch --size 390x844` → обидва `PASS sandbox-radio-link` (правки `fit` не зламали пісочниці).
- [ ] **Крок 5. Подивитися аркуші** `$QA_OUT/c6/{prologue,lines}/mobile-phone-portrait.jpg`, `…-tabs.jpg` і ті самі для `phone-landscape`, `tablet-portrait`. Шукаємо: у кожному кроці видно предмет кроку цілком; екран і стрічка з таблиці вище — в кадрі й не закриті аркушем панелі; повзунок маршруту й план «де ми» є на вкладці «Керування»; текст сцени не дрібніший за 14 px; мапа стоїть уздовж довгого боку кадру, назви доріжок — біля її нижнього кінця; сніг на екрані не займає більш як чверть кадру.
- [ ] **Крок 6. Коміт.** `git status --short` показує лише файли зі списку «Файли». `git add app/src/volumes/radio/chapters/{prologue,lines}/world.ts app/src/volumes/radio/chapters/prologue/steps/{01-watch,02-between,03-one-number,04-map}.ts app/src/volumes/radio/chapters/lines/steps/{01-cell,02-row,03-frame,04-knit,05-marks,06-whole}.ts app/src/volumes/radio/shared/yard/shots.ts app/src/volumes/radio/shared/stand/index.ts app/src/volumes/radio/shared/map/index.ts` (і `docs/volumes/radio/VISUAL.md`, якщо крок 2 змінив `fit` у `shots.ts`) · `git commit -m "Пілот тому «Радіо» на телефоні й планшеті"`

### Завдання C7. Знімки, аудит кадру, читання

**Виконавець:** Opus 5.5 запускає й править; судять два свіжі агенти: фізик — Fable 5.2, новачок — Opus 5.5 (рішення плану). Жоден не бачить ні плану, ні проєкту.

**Файли:**
- Створити: `docs/volumes/radio/reports/batch3-pilot.md` (розділи «Знімки» й «Читачі»; решту дописує C9)
- Змінити: те, на що вкажуть аудит і читачі — сценарії C1 (тоді знову `regen.sh`), кроки глав, `shared` (за правилом черги)
- Тест: `tools/qa/chapter-check.mjs` для обох глав; звіти двох читачів без зауваг вище «дрібно»

**Інтерфейси:**
- Бере: Блок S (початок черги), замінники ImageMagick із `tools/site/shims` (їх підставляє `qa-env.sh`), чек-лист `docs/volumes/radio/VISUAL.md` «Чек-лист аудитора кадру», `docs/volumes/radio/COPY_STYLE.md`.
- Дає: каталог знімків `$QA_OUT/c7` і таблицю зауваг у звіті.

- [ ] **Крок 1. Перевірка глав.** Два Блоки S, по одному, у фоні; кожен рядок — `<команда>` свого блока:

  ```bash
  node tools/qa/chapter-check.mjs radio/prologue --base "$BASE" --sizes 1920x1080,1280x720,3840x2160 --skip perf --out "$QA_OUT/c7"
  node tools/qa/chapter-check.mjs radio/lines    --base "$BASE" --sizes 1920x1080,1280x720,3840x2160 --skip perf --out "$QA_OUT/c7"
  ```

  Кожна закінчується рядком `PASS radio/<глава> — report: …/report.json`. Серед рядків кожного запуску — `[5/5] leak check: radio/<глава> ⇄ radio/<друга глава> ×3`, а за ним жодного `FAIL leak: …`: за три входи й виходи не росте кількість геометрій, текстур і програм (Review Focus 3; під `?freeze` лінія синхронна, тож фоновий потік стережуть `--live knit` у C5 і тест B14). Типові причини падіння й що робити: попередження в консолі (прибрати причину, а не попередження); понад чотири родини відтінків (звірити кольори з `VISUAL.md` «Кольори зі змістом»; `chapter-check` рахує родини зі знімка всієї сторінки разом із панеллю кроку — `tools/qa/chapter-check.mjs:188`, `page.screenshot`, — тож акцент тому `sky` і знак «можна торкнутися» `cyan` на панелі займають родину `cyan`; у таблицю «Знімки» записати родини кожного кроку з `report.json` і котру з них дає панель; панель — платформа, її не перефарбовуємо); текст сцени дрібніший за 16 px на 1280×720 (збільшити або прибрати); понад 350 малювань (злити нерухомі предмети подвір'я).
- [ ] **Крок 2. Аудит кадру.** Переглянути `sheet-1920x1080.jpg`, `sheet-1280x720.jpg`, `sheet-3840x2160.jpg`, `sheet-random.jpg` обох глав і аркуші телефона з C6 за кожним рядком чек-листа `VISUAL.md`; проба «три секунди» — проти першого речення поля «Бачимо» кожного кроку («Око падає на …», C1). Окремо: на екрані немає намальованого снігу; камера у дворі не бачить стендів, щупа, мапи, копії й підписів; у кадрі не більш як чотири родини відтінків; екран зі снігом — не більш як чверть кадру; зерна плівки рушія немає (П2). Кожну заувагу — рядком у таблицю «Знімки» звіту: крок · розмір · що не так · що змінено.
- [ ] **Крок 3. Читання вголос.** Кожен крок обох глав — за `COPY_STYLE`: речення до 20 слів; текст 25–60 слів; порядок «навіщо → що зробити → на що дивитися»; відповіді в тексті немає, її каже висновок; дія названа тим словом, що й підпис на екрані; термін — після явища. Правки сценаріїв — через кроки 5–6 із C1, потім `pnpm test src/volumes/radio/chapters` (номери підписів) і обидва `interactions.mjs`.
- [ ] **Крок 4. Два читачі.** Фізик дістає `$QA_OUT/c7`, аркуші з C6, обидва сценарії, `_terms.md`, `PATH-ledger.md`; питання: «Перелічіть усе, що фізично хибне або буде зрозуміле хибно — у тексті чи на картинці; для кожного — крок і чому». Новачок дістає знімки кроків у порядку шляху й лише екранні тексти (`content/generated/{prologue,lines}.json`); питання: «Ви нічого не знаєте про радіо. Для кожного кроку: що мені сказали зробити; що я побачив; чого не зрозумів; де застряг». Вага: «стоп» — неправда або крок не пройти; «суттєво» — зрозуміє хибно або застрягне довше, ніж до підказки; «дрібно» — слово, кома, смак. Відповіді — у таблицю «Читачі» звіту: коло · хто · крок · заувага · вага · що змінено.
- [ ] **Крок 5. Правити й повторювати** кроки 1–4, щоразу зі свіжими читачами, доки обидва не повернуть нічого вище «дрібно»; після правок сцен — обидва `interactions.mjs` на 1280x720 і з `--touch --size 390x844`. Не більш як три кола (рішення плану): що лишилося після третього — у розділ звіту «Питання до власника», без дальших правок.
- [ ] **Крок 6. Коміт.** `git status --short` дає перелік; у `git add` — саме ці файли поіменно (не каталоги): звіт `docs/volumes/radio/reports/batch3-pilot.md`, змінені сценарії з їхніми похідними файлами (перелік — як у коміті C1), змінені файли глав. Файлів C8 (`_sandbox-radio-arrow/**`, `reports/batch3-arrow.md`) цей коміт не бере · `git commit -m "Пілот тому «Радіо»: аудит кадрів і два читання"`

### Завдання C8. Проба глави `arrow` у пісочниці

**Виконавець:** Fable 5.2 задумує кроки й судить, чи сходинка читається; Opus 5.5 пише код; свіжий агент-новачок (Opus 5.5) — «проба на читачеві» (проєкт II §8.4). Код одноразовий: у главу `arrow` він без нового завдання не йде.

**Файли:**
- Створити: `app/src/volumes/_dev/chapters/_sandbox-radio-arrow/{index.ts,scene.ts,qa/measure.mjs}`, `docs/volumes/radio/reports/batch3-arrow.md` (власний файл: C7 і C9 у цей час пишуть `batch3-pilot.md`)
- Тест: `qa/measure.mjs`

**Інтерфейси:**
- Бере: лише `@radio/shared/**` (П7): `mountWorld`, `world.probe`, `world.probeData.points`; зразок глави-пісочниці — `_sandbox-radio-link` (B16): `dev: true`, та сама група, підписи керування — у маніфесті `index.ts`. `mountProbe` (C2) пісочниця не бере: договір дає один запит щупа, і його тут займає стрілка — сцена сама пише `world.probe = { tap: 'rx.shifted', view: 'arrow', start, span, columns: 24 }`. Відведення `rx.shifted` іде в темпі каналу (28 800 пар на кадр) і запізнюється проти сигналу камери на 18 відліків (Спільний договір; якщо B10 вкоротив `INPUT_FILTER`, запізнення менше на 1–2 — тоді обидва вікна нижче зсунути на стільки ж).
- Дає: нічого для дальших завдань; звіт із числами, абзацом Fable і відповіддю читача.

Кроки пісочниці (проєкт II §2, `arrow/still` → `arrow/two`): `still` — перед об'єктивом картка, що закриває середні 60 % ширини кадру, повзунок `card` веде її яскравість від чорної до білої; стрілка малюється від нуля до точки `(I, Q)` відліку `n`, повзунок `sample` гортає `n`; вибір `where` ставить вікно стрілки: `card` — 24 відліки рядка 48 від 141-го відліку рядка (22 відліки всередині картки, якщо рахувати з запізненням), `sync` — 16 відліків того самого рядка від 28-го (синхроімпульс після запізнення лежить на 25…45). `two` — та сама стрілка з двома тінями на двох стінах; перемикач `second` ховає тінь `Q`. Екран монітора при цьому не змінюється: моделі з однією тінню в договорі немає, а малювати наслідок на екрані заборонено. Сцена публікує `ctx.qa.expose('radio-arrow', () => ({ stepDeg, points }))`, де `stepDeg` — середній кут між сусідніми точками в градусах, `atan2` від `z[n]·conj(z[n−1])`.

- [ ] **Крок 1. Тест, що падає.** `qa/measure.mjs` (повне дерево, заморожений годинник) відкриває `_dev/_sandbox-radio-arrow/still` і для п'яти значень `card` (0, 0,25, 0,5, 0,75, 1 через `__ui.set('card', v, true)`) читає `stepDeg`. Дев'ять умов: `__app.position().chapterId === '_sandbox-radio-arrow'`; послідовність строго зростає; для чорної картки `stepDeg < −10`; для білої `+50 ≤ stepDeg ≤ +75` (ціль договору для білого — +72°); знак змінюється рівно один раз; `points.length === 48`; після `__ui.set('where', 'sync', true)` — `−85 ≤ stepDeg ≤ −60` (ціль договору для дна синхроімпульсу — −77,4°: стрілка йде назад); у кроці `two` після `__ui.set('second', false, true)` `screenHash` у `radio-world` той самий; консоль чиста. Числа всіх вимірів і знімки (п'ять кроку `still`, два кроку `two`) — у `--out`.
- [ ] **Крок 2. Побачити падіння.** «Блок Q», у якому рядок `measure.mjs` замінено на `node app/src/volumes/_dev/chapters/_sandbox-radio-arrow/qa/measure.mjs --port 5377 --out "$QA_OUT/c8"` → `FAIL position` (такої глави ще немає), код виходу 1.
- [ ] **Крок 3. Написати пісочницю** до `PASS 9 checks`. Якщо біла картка дає менш як +50°, це автоматична витримка ока камери (`0,45/середня яскравість`) тягне картку до сірого: записати виміряне число й не підганяти поріг — це знахідка для глав `carrier` і `arrow`.
- [ ] **Крок 4. Перевірити, що пісочниці немає на сайті.** `node tools/site/build.mjs --volume radio --no-smoke && ls tools/site/dist/assets | grep -c sandbox` → `0`.
- [ ] **Крок 5. Проба на читачеві.** Свіжий агент-новачок дістає сім знімків із кроку 1 у порядку показу й по одному реченню про те, що зроблено на кожному («картку зроблено світлішою», «другу тінь сховано»), без плану й проєкту. Питання: «Що робить стрілка, коли картка світлішає? Що зникає, коли лишається одна тінь? Чого ви не зрозуміли?» Відповідь іде у звіт дослівно.
- [ ] **Крок 6. Звіт `batch3-arrow.md`.** Числа з кроку 1; відповідь читача; абзац Fable 5.2 за знімками, числами й відповіддю: чи читається «стрілка стоїть для темно-сірого, іде вперед для білого, назад для чорного й синхроімпульсу»; чи видно з однієї тіні, що напрям втрачено; чи спитав читач «а що між відліками?» (тоді густота відліків повертається на шлях окремим кроком — проєкт II §8.4); чого бракує главі — щонайменше: два відведення щупа водночас (стрічка `camera.video` і стрілка `rx.shifted`; тепер договір дає один запит), режим моделі з однією тінню для `arrow/two`, стала витримка камери для картки, друга полиця стенда. `python3 docs/volumes/radio/check.py` → `radio check: OK`.
- [ ] **Крок 7. Коміт.** `git add app/src/volumes/_dev/chapters/_sandbox-radio-arrow/index.ts app/src/volumes/_dev/chapters/_sandbox-radio-arrow/scene.ts app/src/volumes/_dev/chapters/_sandbox-radio-arrow/qa/measure.mjs docs/volumes/radio/reports/batch3-arrow.md` · `git commit -m "Проба глави arrow в пісочниці: стрілка на справжній моделі"`

### Завдання C9. Ворота черги 3, сайт, показ власникові

**Виконавець:** Opus 5.5

**Файли:**
- Змінити: `tools/site/smoke.mjs`, `tools/site/build.mjs` (параметр `--deep`), `tools/site/README.md`, `docs/volumes/radio/reports/batch3-pilot.md` (завершити)
- Тест: блок «Ворота черги» з початку плану; перевірки глав; `tools/site/smoke.mjs` на живій адресі

**Інтерфейси:**
- Бере: усе з C1–C8; `.github/workflows/pages.yml` (A8); крок 3 завдання A9 (стеження за потоком) і крок 4 A9 (як знайти крок, що впав); запасні ходи — таблиця «Якщо потік упав» у `tools/site/README.md` (вона новіша за перелік A8: для `Site profile` спершу журнал кроку, `--no-smoke` — лише коли не стартує Chrome чи немає WebGL2).
- Дає (рішення плану): `node tools/site/smoke.mjs … --deep <глава/крок>[,<глава/крок>…]` — кожну адресу відкриває свіжою сторінкою й друкує `ok   deep link: #/<том>/<глава>/<крок> opens that step`; `build.mjs` передає `--deep` далі. Коли в томі є збудована глава, димова перевірка додатково доводить обіцянку П4 — мапу всіх глав «у планах»: (1) на головному екрані є кнопки `home-start` (або `home-resume`) і `home-map` — рядок `home: the start button and the map button are there`; (2) після натискання `[data-ui="home-map"]` `__ui.overlay() === 'map'`, і кожен `id` із `journey` файла `volume.json` має вузол (`__ui.mapNode(id) !== null`) — рядок `map: <усіх> chapters, <не збудованих> planned`, де збудовані — `__app.listChapters(том)`; (3) клік у вузол першої не збудованої глави (`field` — сусід прологу, він у кадрі) відкриває картку `[data-ui="map-card"]` із класом `planned` і словами «у планах» — рядок `map: a planned chapter says «у планах»`.

- [ ] **Крок 1. Глибокі посилання й мапа в димовій перевірці.** Додати `--deep` і три перевірки. Докази: `node tools/site/build.mjs --volume radio --deep prologue/watch,lines/marks` → серед рядків `ok   deep link: #/radio/lines/marks opens that step`, `ok   home: the start button and the map button are there`, `ok   map: 37 chapters, 35 planned`, `ok   map: a planned chapter says «у планах»`, останній рядок `PASS site smoke`; `node tools/site/build.mjs --volume radio --deep lines/nope` → `FAIL deep link: #/radio/lines/nope opens that step`, код виходу 1. У `tools/site/README.md` — параметр `--deep` і нові рядки перевірки.
- [ ] **Крок 2. Ворота.** `git branch --show-current` → `main` (інакше спершу `git checkout main && git merge --ff-only <гілка>`). Блок «Ворота черги» повністю, з `--deep prologue/watch,lines/marks` у рядку `build.mjs`; очікуване: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — зелено; `doccheck: ALL GREEN`; `radio check: OK`, а рядок чисел перед ним — `radio check: journey 37 · path 20 · ledger terms 41 · links 8 · chapter documents 2 · cards 72`; `python3 docs/volumes/radio/test_check.py 2>&1 | tail -1` → `OK`; `fm_chain: 8 fixture(s) up to date`; `link_budget: 2 fixture(s) up to date`; `PASS site smoke`. Додатково: з `app/` `pnpm test src/volumes/radio` — зелений; з кореня `git log --first-parent --no-merges 63fd42c..HEAD --format=%B | grep -ciE 'co-authored-by|generated with|claude\.ai'` → `0`. Перевірки в браузері — по одній, кожна своїм блоком у фоні: (1)–(2) Блок S з `interactions.mjs` прологу на 1280x720 і з `--touch --size 390x844` → `PASS 39 checks…`; (3)–(4) те саме для `lines` → `PASS 54 checks…`; (5)–(6) Блок S з кожним `chapter-check` кроку 1 C7 → `PASS radio/<глава>`; (7)–(8) Блок S з кожним `mobile-check` кроку 1 C6 → `PASS — 0 failure(s)`; (9) «Блок Q» без `--only` → `PASS sandbox-radio-link` (усі розділи черги 2 разом з `anchors`, `stand`, `map`); (10) «Блок Q» з `measure.mjs` проби `arrow` (крок 2 C8) → `PASS 9 checks`; (11)–(12) Блок S з `interactions.mjs` прологу `--live between` → `PASS live between` і `lines` `--live knit` → `PASS live knit` (після трьох виходів потоків не лишається — Review Focus 3; рядки JSON цих двох запусків ідуть у «Числа», крок 3). `ls tools/site/dist/assets | grep -c sandbox` → `0`; `ls tools/site/dist/assets | grep -cE 'chapter-radio-(prologue|lines)-'` → `2`. `git status --short` показує рівно три рядки — правки кроку 1: ` M tools/site/README.md`, ` M tools/site/build.mjs`, ` M tools/site/smoke.mjs`.
- [ ] **Крок 3. Завершити звіт `batch3-pilot.md`.** Розділи: «Що збудовано» (дві глави, прилади світу, адреси); «Числа» — рядки JSON із `interactions.mjs --live between` (пролог) і `--live knit` (`lines`): `mode`, `fps`, `modelMs` (мірило — `≤ 100`, Спільний договір), `eye.lastMs`, `eye.lastCalls`; малювання й трикутники кроків із `report.json`; час кадру тут не судимо (програмний рендер); «Знімки» й «Читачі» (C7); «Проба `arrow`» — висновок одним абзацом і посилання на `batch3-arrow.md` (C8); «Питання до власника»: слова на слух (проєкт II §8.7; у пілоті з цього переліку немає жодного — назвати ті, що є: «бігунець», «двійник», «позначка», «синхроімпульс», «комірка»); шов пілота (П8: місток прологу веде до `field`, кнопка картки вимкнена, «Далі» в навігаторі веде до `lines`); швидкодія на його відеокарті й телефоні (рішення 18); документи формату (П18). `python3 docs/volumes/radio/check.py` → `radio check: OK`.
- [ ] **Крок 4. Коміт і надсилання.** `git add tools/site/smoke.mjs tools/site/build.mjs tools/site/README.md docs/volumes/radio/reports/batch3-pilot.md` · `git commit -m "Ворота третьої черги: пілот тому «Радіо» готовий до показу"` · `git status --short` — порожньо · `git push origin main` (без `--force`).
- [ ] **Крок 5. Дочекатися сайту.** Блок кроку 3 завдання A9 дослівно, у фоні (`run_in_background: true`): цикл стежить за запуском, чий `head_sha` дорівнює `git rev-parse origin/main` (після надсилання це HEAD), не довше 15 хвилин, а відповідь `api: Not Found` означає, що стежити нема чим. Очікуване закінчення — `<id> completed success`. За `completed failure` — крок 4 завдання A9 (знайти крок потоку, застосувати один запасний хід із таблиці «Якщо потік упав» у `tools/site/README.md`, надіслати, стежити знову); дефект сайту в кроці `Site profile` виправляємо, а не ставимо `--no-smoke`. Сайт не оновився — це не готово.
- [ ] **Крок 6. Перевірити живу адресу.** `node tools/site/smoke.mjs --url https://codir.github.io/radio-pop-science/ --volume radio --deep prologue/watch,lines/marks` → рядок `site: … → radio/prologue/watch, overlay home, title «Радіо», chapters: prologue/watch lines/cell`, обидва `ok   deep link: …`, `ok   map: 37 chapters, 35 planned`, останній рядок `PASS site smoke`.
- [ ] **Крок 7. Показ.** Повідомлення власникові українською: адреса сайту; що він тепер показує (головний екран із кнопками «Почати подорож» і «Мапа», мапа з усіма 37 главами, 35 із них — «у планах», дві збудовані глави); два прямі посилання — `#/radio/prologue/watch` і `#/radio/lines/marks` (кіт на екрані пливе одразу: блок вийнято); де звіти; питання зі звіту. **Зупинка.** Жодного завдання черг 4–11 не починаємо, доки власник не скаже, чи це еталон.
