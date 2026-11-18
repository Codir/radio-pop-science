# Том «Радіо» до пілота (черги 1–3) — план робіт

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Збудувати каркас тому «Радіо · Від електрона до екрана» із сайтом на GitHub Pages, чесну модель лінії з частотною модуляцією разом зі спільним світом-подвір'ям, і на них — пілот: пролог та главу `lines`, доведені до еталона.

**Architecture:** Том живе в `app/src/volumes/radio/` на рушії `tech` у форматі «шлях». Модель сигналу — чистий TypeScript у `radio/sim/core/` (без three.js), яку сцена запускає у фоновому потоці через `radio/shared/link`; камера у дворі справді «дивиться» додатковим проходом рендерера, її кадр іде крізь модель і повертається на екран монітора. Сайт — збірка тимчасової копії `app/`, у якій лишено тільки том `radio`.

**Tech Stack:** TypeScript 6, three.js 0.187, Vite 8, vitest 5, ESLint 10; Python 3.12 (numpy, scipy) для еталонних моделей і стандартна бібліотека для `tools/content`; Node 24, pnpm 12.18 (corepack); playwright-core з Google Chrome для перевірок у браузері; GitHub Actions і GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-17-radio-volume-design.md` (далі — «проєкт»; посилання виду «проєкт II §7» ведуть на його частини). Виконавець читає проєкт разом із планом.

**Додатки до плану** (`docs/superpowers/plans/2026-11-18-radio-pilot/`):

- `facts/*.md` — десять звітів про рушій після злиття з `upstream` (коміт `63fd42c`): точні шляхи, сигнатури, команди, з номерами рядків. Завдання посилаються на них як «факти: `<файл>` §N». Шляхи виду `/tmp/claude-…/scratchpad/…` у звітах — робочі каталоги сесії, їх уже немає.
- `prototypes/site/{build.mjs,smoke.mjs}` — перевірений прототип профілю сайту.
- `prototypes/qa-shims/{montage,identify,mogrify}` — заміна ImageMagick для контактних аркушів на Pillow.
- `prototypes/model/slope_scan.py` — розрахунок параметрів детектора на схилі.
- `preview/` — два пробні знімки вестибюля й мапи.
- `batch-1.md`, `batch-2-model.md`, `batch-2-world.md`, `batch-3.md` — завдання черг (покажчик — у кінці цього файла).

**Межі плану.** Черги 1–3 з проєкту III §8: каркас і сайт → модель і світ → пілот. План закінчується показом пілота власникові. Черги 4–11 дістають власні плани після його рішення: пілот змінить і мірила, і ціну глави.

**Поза цим планом:** амплітудний і цифровий ланцюги; гілки; кнопка зовнішніх посилань; безшовні межі глав (П5); телефон на ≈ 2,55 GHz — він не вміщається в змодельовані 100 MHz і прийде з главою `select` як доданок до стелі підсилювача, а не як відліки.

**Виконавці.** У кожному завданні названо бажаного виконавця за рішенням 17: Fable 5.2 — модель сигналу, візуальна мова, документи задуму; Opus 5.5 — код глав, тести, перевірки. Поки Fable недоступна (ліміт до 22.11.2026), її завдання виконує Opus 5.5 на високому зусиллі, а результат читає ще один незалежний перевіряльник.

---

## Global Constraints

Кожне завдання неявно містить ці вимоги.

**Зміст і мова (проєкт I §4, II §5).**

- Читач — одна доросла людина без технічної освіти; звертання «ви» з малої літери. Без формул, квізів і питань до читача на шляху.
- Формат «шлях»: назва глави — питання; пролог 4–5 кроків, глава 4–8; не більш як 6 нових термінів на главу і 2 на крок. Межі слів у `tools/content/path_check.py` — це стелі, а не цілі: «Думка» — попередження понад 25 слів, помилка понад 32; «Текст» — попередження понад 80, помилка понад 90. Орієнтир `circuit`: думка ≈ 15 слів, текст 25–60.
- Термін уживаємо лише після кроку, де його введено (проєкт II §5.1). До того річ живе під робочим словом: «прутик» (антена), «число» (напруга, сигнал), «позначка» (синхроімпульс, лише до `lines/marks`).
- Одиниці: побутові довжини й час — українськими знаками в підписах (мм, см, м, км, с, хв) і словами в тексті; радіо- й електричні величини — міжнародними (V, V/m, A, Ω, Hz, kHz, MHz, GHz, W, mW, nW, dB, dBm, ms, μs, ns, bit/s, Mbit/s). Мікро — грецька `μ` (U+03BC), ніколи `µ` (U+00B5). Апостроф у текстах для екрана — `’` (U+2019).
- Увесь текст на екрані приходить із документів тому через `tools/content` (поле «Підписи» кроку, «Підписи глави»). Код сцен не містить жодного українського слова.
- Чутливі теми: завади — лише випадкові побутові (роутер сусіда, мікрохвильова піч, відбиття, стіни). Ніде немає навмисного глушіння, порад «як заважати», безпілотників, військових застосувань, радіолокації, сили передавача понад 10 mW.
- Робочий приймач власника — лише еталон формули детектора кута. Ні коду, ні записів, ні назви того проєкту в репозиторії немає.

**Модель (проєкт I анти-цілі, III §3–4).**

- Усе, що видно на екрані монітора в сцені, видала модель лінії з поточного стану сцени. Жодного ефекту «сніг», «зрив», «двоїння» шейдером чи текстурою.
- `radio/sim/**` — чистий TypeScript: без `three`, без `Math.random`, `Date.now`, `performance.now`, `setTimeout`, без DOM. Шум — із генератора з заданим зерном.
- Числа моделі — з проєкту II §7 у формі, записаній нижче в розділі «Спільний договір». Якщо еталон не сходиться з таблицею рівнів, пересуваємо стіни діорами (`site.json`, завдання B6a), а не числа.

**Репозиторій (проєкт III §1).**

- Не редагуємо: `app/src/{engine,hud,hud-dom,kit,fx,ui3d,text,style,audio,content}`, `tools/content`, `tools/qa`. Єдині два винятки, яких вимагає сам рушій: рядок `"@radio/*"` у `app/tsconfig.json` і слово `'radio'` у списку томів `app/src/engine/__tests__/volumes.test.ts:30`.
- Том у дереві — чернетка: `radio/volume.json` має `"status": "draft"`. Опублікованим його робить лише профіль сайту у своїй копії.
- Коміти: українські речення без префіксів, як у журналі `tech`; **без жодних приміток про ШІ** (ні `Co-Authored-By`, ні «Generated with…», ні посилань на сесію); у `git add` — лише явні шляхи файлів (каталогів, `-A` і `.` не додаємо; дужки bash на кшталт `…/{eye,screen}.ts` дозволено — вони розгортаються в імена файлів); `--force` заборонено. Правило про примітки стосується наших комітів: синхронізації `upstream`, влиті в `main`, мають власні підписи.
- Коміти йдуть у місцеву `main`. Хто працює в окремій гілці чи робочому дереві, перед воротами робить `git checkout main && git merge --ff-only <гілка>`; якщо `main` тим часом пішла вперед (паралельну нитку вже влито), спершу в гілці `git rebase main`, потім знову `--ff-only` (гілки в `origin` немає, тож `--force` не потрібен). Так само перед завданням, яке бере зроблене іншою ниткою (черга 1 — A6; черга 2 — B11, B13, B14, B16; черга 3 — C4): ту нитку спершу вливають у `main` через `--ff-only`, а цю гілку — `git rebase main`. У `origin/main` надсилаємо наприкінці кожної черги, коли всі її ворота зелені.
- Не запускати `pnpm format`: він переписує 761 файл.

**Середовище (перевірено на цій машині, факти: `baseline-checks.md`).**

- Кожна нова оболонка починається з прелюдії (без неї — Node 22 або 18):

  ```bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  ```

- Усі команди `pnpm` — з каталогу `app/` (там закріплено pnpm 12.18.0). Команди Python і `tools/…` — з кореня репозиторію.
- Базова лінія на коміті `63fd42c`: `pnpm typecheck` 6 с, `pnpm lint` 9 с, `pnpm test` 9 с (146 файлів, 1601 тест), `pnpm build` 8 с, `python3 tools/content/doccheck.py --all` 18 с — усе зелене.
- Перевірки в браузері: Chrome `/usr/bin/google-chrome`, відеокарти немає, рендер програмний. Завжди `QA_ALLOW_SOFTWARE=1`, завжди `--out <каталог>` (типовий `/srv/electricity/qa` тут не існує), завжди `--skip perf` для `chapter-check` (межа 8 мс на кадр тут недосяжна: 75–97 мс). ImageMagick не встановлено: контактні аркуші збирають замінники з `tools/site/shims/` (завдання A7).
- У робочій копії профілю сайту (`build.mjs --keep-work` або збірка, що впала) не запускати ні `pnpm`, ні `corepack`: pnpm 12 переприв'язує справжній `app/node_modules` до шляху копії. Лагодиться командою `(cd app && pnpm install --frozen-lockfile --offline)`.
- Команда на передньому плані в оболонці агента обривається за 2–10 хвилин, а `sleep` там заборонено: довгі очікування (сервер, запуск GitHub Actions) ідуть у фоні.
- Знімки під програмним рендером не повторюються біт у біт (63 пікселі з мільйонів). Тому тести порівнюють числа, які сцена віддає через `ctx.qa.expose`, а не пікселі кадру.

---

## Поправки до проєкту після оновлення рушія (18.11.2026)

Проєкт затверджено 18.11.2026. Того ж дня в `main` влито три нові синхронізації `upstream` (коміт `63fd42c`). Вони й десять звітів про рушій показали розбіжності з проєктом; нижче — як план їх закриває. Ті самі пункти записано в проєкт, частина IV §5.

| № | Що з'ясувалося | Як робимо |
|---|---|---|
| П1 | Позначки чесності скасовано в усіх томах (`docs/DECISIONS.md` §60 x): інструменти відкидають поля «Позначки» й «Чесно», панель кроку їх не малює. | Позначок і підпису під екраном немає. Таблиця «Чесна фізика» (проєкт II §6) лишається в `PATH-ledger.md` як пам'ятка авторам; застереження, без яких читач зрозуміє хибно, стоять звичайними реченнями в «Докладніше». Так само немає підпису «кадрів моделі менше, ніж кадрів сцени» (проєкт III §4): про зменшений і рідший екран каже «Докладніше» кроку `lines/cell`. |
| П2 | Рушій сам додає до кадру зерно плівки (`grain: 0.022`). | Вигляд тому вимикає його (`grain: 0`): зерно на екрані монітора дає лише модель. |
| П3 | Тест рушія `volumes.test.ts:30` містить перелік каталогів томів; новий том його ламає. | Дописуємо `'radio'` в цей перелік — другий і останній виняток із правила «платформу не редагуємо». Власникові — пропозиція зробити тест терпимим в `upstream`. |
| П4 | Том без жодної збудованої глави рушій показує як «вестибюль»: назва, підзаголовок, рядок `emptyNote`; мапу з підписами відкрити не можна. | Після черги 1 сайт показує вестибюль із рядком «Перші глави — в роботі». Мапа всіх глав «у планах» з'являється з першою збудованою главою (черга 3). |
| П5 | `circuit` тепер має безшовні межі глав (`"seamless": true`, `SceneHooks.leaveChapter`). | У пілоті пролог і `lines` не сусіди (між ними глави 1–3), тож межі будуємо з черги 4. `radio/volume.json` поки без `seamless`; між главами — звичайний перехід рушія. |
| П6 | Перевірки з `volume.json → docs.checks` для томів формату «шлях» не запускаються. | Власна перевірка тому — окремий скрипт `docs/volumes/radio/check.py`; його викликають ворота черг і `pages.yml`. |
| П7 | Пісочниця всередині тому потрапила б на сайт (рушій показує службові глави, якщо інших немає). | Пісочниці — глави службового тому `_dev` (`_sandbox-radio-*`), як `_sandbox-circuit-*`. Вони імпортують лише `@radio/shared/**`; профіль сайту том `_dev` викидає. |
| П8 | У пілоті пролог мусить закінчуватися питанням глави `field` (так вимагає `path_check`), а кнопка картки «Далі» до не збудованої `field` вимкнена. | Так і лишаємо до черги 4: місток прологу веде до `field`, навігатор «Далі» перестрибує до `lines`. |
| П9 | Перевірка рушія не бачить ні додаткового проходу «ока камери» (лічильник малювань скидається), ні часу фонового потоку. | Том рахує сам: `ctx.qa.expose('radio-world', …)` віддає час і кількість малювань проходу та кадри моделі за секунду; числа йдуть у звіт черги 2. |
| П10 | Сповільнення процесора через інструменти Chrome не діє на фоновий потік. | Оцінку «телефон» знімаємо на синхронному шляху моделі в основному потоці під чотирикратним сповільненням. |
| П11 | `?freeze` — це N синхронних оновлень без малювання, а потім кадри з `dt = 0`; ознаки «зупинений кадр» у контексті глави немає. | Світ читає `freeze` з адреси сторінки; модель рахує один кадр `still` лише на зупиненому кадрі й лише коли стан змінився. |
| П12 | Дві копії глави співіснують до 12 с на межі глав; стан на рівні модуля рушій забороняє. | Фоновий потік створює `mountWorld` кожної глави й зупиняє `ctx.onDispose`. |
| П13 | Еталонні дані мають лежати під `app/`: профіль сайту копіює тільки `app/` і запускає там `tsc`. | Зразки еталона — `app/src/volumes/radio/sim/core/__fixtures__/*.json`; пишуть їх скрипти з `tools/ref-models/radio/`. |
| П14 | Правила «без годинника й випадковості» лінт перевіряє лише в `chapters/**`. | Чистоту `radio/sim/**` стереже власний тест, який читає тексти файлів. |
| П15 | `FM` уже є в загальному переліку дозволених слів; `dBm`, `nW`, `bit/s`, `Mbit/s` — ні. | У `docs/volumes/radio/terms_allowlist.tsv` — лише те, чого немає в загальному переліку. |
| П16 | Мапу в пролозі `circuit` малює віджет рушія `journeyInset`. | Пролог «Радіо» малює мапу дороги з двома доріжками в сцені (`shared/map`), як у проєкті; режим `--map` перевірки `volume-walk` не використовуємо. |
| П17 | `DECISIONS` §60 v в `upstream`: агенти лише на Opus. | Для цього репозиторію чинне рішення 17 власника з цієї роботи: Fable 5.2 — планування, модель сигналу, візуальна мова; Opus 5.5 — код глав, тести, перевірки. |
| П18 | Документів формату (`PATH_FORMAT.md` та ін., рішення 26) в `upstream` досі немає. | Формат беремо з того, що перевіряють інструменти; запис — `docs/volumes/radio/PATH-NOTES.md` (завдання A6). Коли документи з'являться, звіряємо з ними пілот. |
| П19 | Контактні аркуші знімків без ImageMagick — це помилка інструмента, а не пропуск; межа часу кадру під програмним рендером недосяжна. | Аркуші збирають замінники на Pillow з `tools/site/shims/` (завдання A7); `chapter-check` тут запускаємо з `--skip perf`, швидкодію міряє власник (рішення 18). |
| П20 | У `circuit` збудовано всі дев'ять глав. | Посилання на `circuit/charge`, `circuit/battery`, `circuit/flow` (проєкт III §1) більше не чекають; сама кнопка-посилання з'явиться з четвертою чергою. |
| П21 | Справжній повзунок рушія живе лише в панелі кроку; усередині власного віджета його не буде. | Мініатюра «де ми» лише показує план і місце монітора. Повзунки маршруту й «посунути антену» — звичайні повзунки кроку поруч із нею (`routeSlider`, `nudgeSlider`). |

---

## Review Focus

П'ять умов, яких проєкт прямо не називає, а читач на них натрапить. Кожна має тест у завданні-власнику.

1. **Вкладку сховали або модель не встигає.** Очікування: у дорозі до фонового потоку щонайбільше один запит; після повернення на вкладку немає ні черги старих кадрів, ні стрибка. Тест — B11, `link.test.ts` «один запит у дорозі; після перерви — один кадр і один запит».
2. **Фонового потоку немає або він упав** (старий браузер, помилка в моделі). Очікування: лінія один раз перемикається на синхронний шлях, екран і далі показує картинку, у консолі одна помилка, а не потік. Тести — B11, «падіння потоку → синхронний шлях» і «помилка моделі: одна помилка в консолі, останній добрий кадр лишається».
3. **Глибоке посилання, крок назад, повторний вхід у главу.** Очікування: будь-який крок відтворюється з нуля (наприклад, `#/radio/lines/marks` одразу показує кота, що пливе); три входи й виходи не лишають ні потоків, ні текстур. Тести — C4 і C5, `qa/interactions.mjs`, групи «глибокі посилання» і «крок назад»; прохід на витоки `chapter-check` — C5 і C7; потоки на живому годиннику (три виходи й повернення, `page.workers().length === 1`) — C5 і ворота C9, режим `--live knit`; B14 — тест звільнення `mountWorld`.
4. **Крайні положення ручок і порожній кадр.** Очікування: довжина рядка на краях, довіра до синхроімпульсів 0, сила 0,1 mW, монітор між зупинками, антена на ±15 см, чорний чи білий кадр уночі — жодного `NaN`, винятку чи завислого екрана. Тест — B9b, `fm-link.test.ts` «крайні стани».
5. **Телефон.** Очікування: без підтримки читання текстури з плаваючою комою око камери переходить на вісім бітів; у вузькому кадрі видно екран і стрічку разом, а повзунок маршруту досяжний у панелі; рідші кадри моделі нічого не ламають. Тести — B1a, `eye.test.ts` «запасний формат»; C4–C6, `qa/interactions.mjs` на 390 × 844 (екран і стрічка в кадрі) і `mobile-check` у трьох профілях.

---

## Будова файлів

Нове, якщо не позначено інакше. Відповідальність — одна на файл.

```
app/tsconfig.json                                  ЗМІНА: + "@radio/*": ["./src/volumes/radio/*"]
app/src/engine/__tests__/volumes.test.ts           ЗМІНА: + 'radio' у переліку (рядок 30)

app/src/volumes/radio/
  volume.json            особа тому, сім позначок лінійки, дев'ять груп, уся подорож (37 записів)
  volume.ts              вісь лінійки й тема
  chapters.ts            пошук глав (копія circuit/chapters.ts)
  __tests__/journey.test.ts      подорож відповідає проєктові II §1, §3, §4
  content/generated/     пише tools/content (не редагувати руками)

  sim/core/              МОДЕЛЬ — чистий TypeScript
    standard.ts          зменшений стандарт: темпи, частини рядка, рівні, сітка каналів
    units.ts             dBm ↔ розмах, потужність блока відліків
    rng.ts               генератор із зерном, нормальний шум із таблиці
    dsp.ts               фільтри з пам'яттю між кадрами, зсув частоти, дробове запізнення
    video.ts             кадр → сигнал із синхроімпульсами; сигнал → растр із власним ритмом рядків
    fm.ts                модулятор, обмежувач, детектор на схилі, детектор кута, фільтр відеосигналу
    site.json            подвір'я числами (метри): одне джерело для сцени, моделі й еталона
    site.ts              читає site.json і перевіряє його форму
    channel.ts           промені, рівні, шум антени
    interferers.ts       роутер і мікрохвильова піч
    rf.ts                діапазон із чотирьох каналів, вхідний фільтр, підсилювач, зсув, фільтр каналу
    spectrum.ts          швидке перетворення Фур'є
    probe.ts             відведення й три вигляди щупа
    fm-link.ts           увесь перший ланцюг: createFmLink(seed)
    index.ts             що видно назовні
    README.md            таблиця «модуль — що робить — джерело формул»
    __tests__/           по тесту на модуль, emerges.test.ts, oracle.test.ts, purity.test.ts; helpers.ts, curve.ts;
                         fm-link.bench.ts (вимір швидкості, не входить у `pnpm test`)
    __fixtures__/        зразки еталона (JSON)

  shared/                СВІТ — жодної логіки кроків
    link/protocol.ts     типи повідомлень
    link/handler.ts      обробник повідомлень (його кличе і потік, і синхронний шлях)
    link/model.worker.ts вхід фонового потоку
    link/index.ts        createLink(ctx, opts)
    screen/eye.ts        око камери: додатковий прохід і яскравість
    screen/screen.ts     екран монітора: текстура, яку оновлює модель
    screen/index.ts      реекспорт eye, screen; з черги 3 (C3b) — runner, inset
    screen/runner.ts     бігунець на пластинці камери та його двійник на екрані        (черга 3)
    screen/inset.ts      копія екрана у вставці                                         (черга 3)
    models/*.ts          предмети: камера, стовп, монітор, хвіртка, сарай, гараж, кіт, …; index.ts збирає їх за планом
    yard/layout.ts       site.ts → місця предметів у сцені
    yard/look.ts         небо, сутінки, пост-обробка (зерно вимкнено)
    yard/shots.ts        ракурси
    yard/index.ts        mountYard(ctx, opts)
    whereami/model.ts    маршрут монітора на плані
    whereami/dom.ts      віджет плану для панелі
    whereami/index.ts    whereami(ctx, opts)
    world/index.ts       mountWorld(ctx, opts): подвір'я + око + лінія + екран
    probe/index.ts       щуп і стрічка; strip.ts — крива з найменших і найбільших значень (черга 3)
    stand/index.ts       стенд камери: блоки; plate.ts — пластинка з комірками          (черга 3)
    map/index.ts         мапа дороги з двома доріжками; layout.ts — місця позначок      (черга 3)
    README.md
    */__tests__/         тести чистих частин

  chapters/prologue/     index.ts content.ts chapter.ts scene.ts world.ts steps/ parts/
                         __tests__/{manifest,parts}.test.ts (у lines — {manifest,window})
                         qa/{helpers,interactions}.mjs README.md                        (черга 3)
  chapters/lines/        те саме                                                        (черга 3)

app/src/volumes/_dev/chapters/
  _sandbox-radio-link/   живий екран: index.ts scene.ts qa/measure.mjs                  (черга 2; у черзі 3 — розділи
                         перевірки стенда, якорів і мапи)
  _sandbox-radio-arrow/  проба глави arrow                                              (черга 3)

docs/volumes/radio/
  plan48/                архів: README.md + CURRICULUM.md NOTES.md VOLUME.md (перенесені)
  VOLUME.md              задум тому (проєкт I)
  PATH.md                шлях: світ, таблиця глав, кроки, гілки, практикуми (проєкт II §0–4)
  PATH-ledger.md         реєстр термінів, чесна фізика, числа моделі (проєкт II §5–7)
  VISUAL.md              візуальна мова й чек-лист аудитора кадру
  COPY_STYLE.md          правила тексту тому
  PATH-NOTES.md          формат і рушій, як їх перевіряють інструменти; журнал рішень
  terms_allowlist.tsv    латинські написи тому
  check.py               власна перевірка тому; test_check.py — її тести
  chapters/_terms.md     реєстр у формі, яку читає tools/content
  chapters/prologue.md   chapters/lines.md                                              (черга 3)
  chapters/_export/      пише tools/content/regen.sh (у репозиторії, як у circuit)
  INDEX.md GLOSSARY.md   пише tools/content/regen.sh
  reports/batch2-model.md   reports/batch3-pilot.md   reports/batch3-arrow.md

tools/ref-models/radio/  fm_chain.py link_budget.py README.md requirements.txt
tools/site/              build.mjs smoke.mjs qa-env.sh shims/{montage,identify,mogrify} README.md
.github/workflows/pages.yml
README.md                ЗМІНА: розділ на початку
```

---

## Спільний договір

Назви, типи й числа, на які спираються кілька завдань. Завдання не повторюють їх, а посилаються сюди. Коментарі в блоках коду — пояснення для виконавця: у файли під `app/src/volumes/radio/` вони йдуть англійською (як у рушії) — прямий апостроф у кириличному слові там валить правило 4 `check.py`.

### Зменшений стандарт — `sim/core/standard.ts`

Модель рахує в зменшених частотах; на шкалах і підписах стоять справжні. Правило: справжня частота = частота моделі × `K`.

```ts
export const K = 40 / 9;                       // ≈ 4,44 («≈ 4,5» проєкту)
export const COLS = 128, ROWS = 96, FRAME_LINES = 100;         // 96 видимих рядків + 4 рядки кадрової позначки
export const LINE = { samples: 288, front: 7, sync: 21, back: 26, active: 234 } as const;   // 1,65 : 4,7 : 5,7 : 52
export const FS_CH = 4.5e6;                    // темп каналу, Hz моделі  = 20 MHz справжніх («20 мільйонів пар»)
export const OVERSAMPLE = 5;
export const FS_WB = 22.5e6;                   // темп діапазону          = 100 MHz справжніх
export const FRAME_CH = 28_800, FRAME_WB = 144_000;            // відліків на кадр
export const LEVEL = { sync: 0, black: 0.3, white: 1 } as const;   // сигнал u: 0 — дно синхроімпульсу
export const DEVIATION = { atSync: -4.3e6, span: 8.3e6 } as const; // справжні Hz: f(u) = atSync + span·u
export const VIDEO_BW = 5.5e6, CHANNEL_BW = 20e6;              // справжні Hz
export const BAND = { centre: 2441e6, lo: 2400e6, hi: 2483.5e6 } as const;
export const IF = 35e6;                        // справжні Hz: де стоїть канал після зсуву (на шкалах щупа — 25…45 MHz)
export const CHANNELS = [2414e6, 2432e6, 2450e6, 2468e6] as const;
export type ChannelNo = 1 | 2 | 3 | 4;
export const shown = (modelHz: number): number => modelHz * K;
export const model = (shownHz: number): number => shownHz / K;
/** Поворот стрілки за один відлік каналу, радіани: білий +72°, дно синхроімпульсу −77,4°. */
export const radPerSample = (u: number): number => (2 * Math.PI * (DEVIATION.atSync + DEVIATION.span * u)) / 20e6;
```

Домовленості для всієї моделі:

- Сигнал із двома тінями — `Float32Array` парами `[re0, im0, re1, im1, …]`. Одиниця розмаху — √mW: `re² + im²` дає потужність у mW.
- Рядок кадру: `[front 7 × 0,3][sync 21 × 0][back 26 × 0,3][active 234]`, де `u = 0,3 + 0,7 · яскравість / 255`. 128 комірок розтягнуто на 234 відліки так: відлік `k` (0…233) стоїть у точці `p = (k + 0,5)·128/234 − 0,5` і бере лінійну суміш комірок `⌊p⌋` і `⌊p⌋ + 1` (на краях — крайню комірку). Рядки 96–99 — кадрова позначка: `[front 7 × 0,3][255 × 0][back 26 × 0,3]` (спад на тому самому місці, що й у звичайного рядка). Камера без блока синхроімпульсів (`sync: false`) ставить 0,3 всюди, де був 0.
- Модель неперервна між кадрами: фільтри, фаза модулятора й ритм рядків пам'ятають попередній кадр.
- Кадр моделі триває 6,4 ms часу моделі (100 рядків по 64 μs).
- Проріджувач рахує `out[k] = Σ h[i]·x[m·k − i]`. Від цього залежить запізнення ланцюга: картинка доходить до складання рядків через `CHAIN_DELAY` відліків каналу (`fm-link.ts`, B9b; рахується з довжин фільтрів: за `INPUT_FILTER` на 47 відводів — 33, а якщо B10 скоротить його до 37 чи 27 — 32 чи 31).

### Числа, які модель мусить видати (проєкт II §7)

| Що | Ціль | Допуск у тестах |
|---|---|---|
| Рівень на п'яти зупинках маршруту, 10 mW, ворота зачинені | −54 / −62 / −70 / −78 / −88 dBm | ± 1,5 dB |
| Напруженість поля за 20 м | 0,03 V/m | ± 10 % |
| Шум у фільтрі каналу | −101 dBm + 9 dB власного шуму приймача = −92 dBm | ± 0,5 dB |
| Злам кривої «чистота картинки проти рівня» | ≈ −80 dBm | між −86 і −76 dBm |
| Ворота відчинені: зайва дорога 10 м, запізнення 33 ns | провали що 30 MHz | 27–33 MHz |
| Найглибша мертва точка (зупинка 2, коридор) | −9,5 dB | −8…−10,5 dB |
| Крок мертвих точок уздовж «посунути антену» | ≈ 6 см | 5,5–8 см |
| Деко впритул до антени монітора | 15–18 dB: на кухні ≈ −78,5 dBm — зерно, а не сніг | 15…18 dB |
| Роутер | горб ≈ 20 MHz довкола 2437 MHz: накриває канал 2 і 2440–2447 MHz каналу 3 | канали 1 і 4 — щонайменше на 20 dB тихіші |
| Піч | ковзає 2450–2470 MHz, увімкнена половину кадру | камера на каналі 3, монітор на кухні: одна смуга зіпсованих рядків заввишки 40–60 рядків; на каналах 1 і 2 — жодного |

Фізика, якою це рахується (докладно — завдання B6a, «Правила геометрії»):

- послаблення вільного простору `20·lg(4πd/λ)`, `λ = 0,1224 м` — довжина хвилі на 2450 MHz, третьому каналі (на 2441 MHz було б 0,1228 м); нею рахуються рівні всіх каналів, а з нею перевірка плану у `VISUAL.md` §2 дала сходинки й крок мертвих точок 7,1 см; підсилення кожної антени 1,1 dBi;
- стіни: цегла 8 dB, дерево 3, скло 1, перекриття 10, залізо 30; стіну пораховано, коли промінь перетинає її відрізок на плані;
- відбиття від відчиненої стулки воріт гаража з коефіцієнтом 1 (слабше воно лише через довшу дорогу); розмах відбитого променя множиться на `s²(3 − 2s)`, де `s = (gate − 0,3)/0,6`, обмежене 0…1;
- деко біля антени — огинання одного краю: `J(v) = 6,9 + 20·lg(√((v − 0,1)² + 1) + v − 0,1)` для `v ≥ −0,78`, інакше 0; `v = h·√(2(d₁ + d₂)/(λ·d₁·d₂))`, `d₂ = 0,05 м`, край `h = −0,4 + 0,48·tray` метрів (0,08 м за лінією погляду, коли `tray = 1`).

Відкрите питання до власника (піде у звіт черги 2): пласка стулка воріт на перевіреному плані подвір'я помітно відбиває до монітора лише в коридорі (маршрут ≈ 1,56…2,40; на 0…0,34 відбитий промінь на 34 dB слабший за прямий). Проєкт каже «мертву точку видно від коридору й далі», а `many/hole` (черга 8) ставить монітор у дальню кімнату. Для пілота це не важить: у пролозі й `lines` ворота зачинені.

Правило масштабу запізнень: відбиття в межах подвір'я (до 100 ns) модель розтягує в `K` разів — так зберігається відношення запізнення до ширини каналу. Фазу несної кожного променя рахуємо зі справжніх `2441 MHz` і справжнього запізнення.

### Модель — що видно назовні (`sim/core/index.ts`)

```ts
// site.ts — подвір'я в метрах: x на схід, y на північ, z угору; джерело — site.json
export type Material = 'brick' | 'wood' | 'glass' | 'slab' | 'iron';
export const LOSS_DB: Readonly<Record<Material, number>>;          // 8, 3, 1, 10, 30
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export interface Wall { id: string; a: Vec2; b: Vec2; material: Material }   // лише стіни дому; сарай і гараж ставить сцена
export interface Site {
  tx: Vec3;                                    // антена камери
  route: readonly [Vec3, Vec3, Vec3, Vec3, Vec3];   // п'ять зупинок монітора
  nudgeAxis: Vec2;                             // напрям «посунути антену»
  walls: readonly Wall[];
  slabZ: number;                               // перекриття над льохом
  gateLeaf: { a: Vec2; b: Vec2 };              // відчинена стулка воріт гаража; a — завіса
  router: { at: Vec3; mw: number };
  oven: { at: Vec3; leakMw: number };
}
export const SITE: Site;

// channel.ts
export function routePoint(site: Site, route: number): [number, number, number];   // точно на зупинках, лінійно між ними
export function wallsBetween(site: Site, from: Vec3, to: Vec3): string[];
export interface AirState {
  route: number;         // 0…4: 0 подвір'я (20 м від камери) · 1 кухня · 2 коридор · 3 дальня кімната · 4 льох
  nudge: number;         // «посунути антену», метри, −0.15…+0.15
  gate: number;          // стулка воріт гаража: 0 зачинена … 1 відчинена
  tray: number;          // деко: 0 немає … 1 впритул до антени монітора
  txPowerMw: number;     // 0.1…10
  txChannel: ChannelNo;  // канал першої камери, типово 3
  router: boolean;
  oven: boolean;
}
export interface Ray { gainDb: number; delayNs: number; phase: number }      // phase — радіани на 2441 MHz
export interface Air { rays: Ray[]; rxDbm: number; fieldVm: number }         // rays.length ≤ 3; rxDbm — у середині каналу txChannel
export function trace(site: Site, air: AirState): Air;

// fm-link.ts
export interface CameraState { sync: boolean }                               // false — блок синхроімпульсів вийнято
export interface MonitorState {
  on: boolean;
  rxChannel: ChannelNo | null;     // null — перемикається разом із камерою
  lineLength: number;              // власний ритм рядків, відліків на рядок; правильне значення 288
  syncTrust: number;               // 0…1: наскільки ритм слухає синхроімпульси
  detector: 'slope' | 'angle';
  limiter: boolean;
}
export interface FmLinkState { air: AirState; camera: CameraState; monitor: MonitorState }
export const DEFAULT_STATE: FmLinkState;   // route 1, nudge 0, gate 0, tray 0, 10 mW, канал 3, без роутера й печі;
                                           // sync true; on true, rxChannel null, lineLength 288, syncTrust 0.25, 'slope', limiter true
export interface Meters {
  rxDbm: number; fieldVm: number; cnrDb: number;
  syncLost: number;      // частка рядків цього кадру, де синхроімпульс не знайдено ближче ніж за 16 відліків від його місця, 0…1
  lineOffset: number;    // на скільки відліків початок рядка монітора відстає від камери на першому рядку кадру
  lineDrift: number;     // на скільки відліків він відстає додатково за кожен рядок (≈ lineLength − 288 без синхроімпульсів)
  lineRow: number;       // рядок екрана (0…99), з якого монітор починає кадр камери; 0, поки кадрова позначка тримає
}
// Знак: додатні lineOffset і lineDrift зсувають картинку ліворуч — комірка камери (c, r) стоїть на екрані
// у стовпчику c − (lineOffset + r·lineDrift)·128/234 і в рядку (r + lineRow) mod 100 (зсув понад частину рядка
// переносить її на сусідній рядок). Усі три числа рахуються від картинки, що вже дійшла до монітора (декодер
// дістає delay = CHAIN_DELAY, B4), тож у замкненому стані lineOffset = 0 і lineRow = 0.
export interface FmLinkFrame { screen: Uint8Array; meters: Meters; probe: ProbeData | null }   // screen: 128·96, рядок 0 — верх
export interface FmLink {
  /** Наступний кадр; продовжує попередній. Повернуті масиви живуть до наступного виклику. */
  step(state: FmLinkState, luma: Uint8Array, probe?: ProbeRequest | null): FmLinkFrame;
  /** Кадр, що залежить лише від (seed, state, luma): скидання, один кадр розгону, потім цей кадр. */
  still(state: FmLinkState, luma: Uint8Array, probe?: ProbeRequest | null): FmLinkFrame;
  reset(): void;
}
export function createFmLink(seed: number): FmLink;      // step кидає виняток на зіпсованому стані; запасних значень не підставляє
export const CHAIN_DELAY: number;                        // затримка ланцюга у відліках каналу; рахується з довжин фільтрів (зараз 33)

// probe.ts
export type TapId = 'camera.video' | 'air.rx' | 'rx.shifted' | 'rx.limited' | 'rx.detected';
export type ProbeView = 'strip' | 'scale' | 'arrow';
export interface ProbeRequest { tap: TapId; view: ProbeView; start: number; span: number; columns: number }
//   start, span — частки кадру 0…1 (найменший span — 16 відліків відведення); columns ≤ 512
export interface ProbeData {
  tap: TapId; view: ProbeView;
  lo: Float32Array; hi: Float32Array;   // 'strip': найменше й найбільше значення в кожному стовпчику; коротші за columns, коли у вікні менше відліків
  bins: Float32Array;                   // 'scale': dBm у кожному стовпчику
  fromHz: number; toHz: number;         // 'scale': справжні частоти країв
  points: Float32Array;                 // 'arrow': пари (I, Q), не більш як columns пар
}
```

Відведення: `camera.video` — сигнал `u` на кабелі камери (темп каналу); `air.rx` — напруга на антені монітора, права тінь суми всього діапазону (темп діапазону); `rx.shifted` — після зсуву й фільтра каналу; `rx.limited` — після обмежувача; `rx.detected` — після детектора й фільтра відеосигналу. Останні три йдуть у темпі каналу (28 800 відліків на кадр); шкала частот для `rx.shifted` і `rx.limited` стоїть довкола `IF` (25…45 MHz). `rx.shifted` відстає від `camera.video` на `CHAIN_DELAY − (VIDEO_TAPS − 1)/2` відліків каналу: за `INPUT_FILTER` на 47 відводів — 18, на 37 — 17, на 27 — 16 (B10, крок 3; на це число спирається C8).

Ланцюг `step` у порядку обчислення: `video.encodeFrame` → `fm` модулятор → `rf` `createPlacer().place` (канал на своє місце в діапазоні) → `channel` (промені) → `interferers` → шум антени → `rf` приймач (вхідний фільтр → підсилювач зі стелею → зсув → фільтр каналу → проріджування ÷5) → `fm.limit` → детектор (`slope` або `angle`) → фільтр відеосигналу → `video` декодер → `screen`.

### Світ — що видно главам (`shared/**`)

```ts
// shared/link/protocol.ts
export interface LinkRequest { seq: number; kind: 'step' | 'still'; state: FmLinkState; luma: Uint8Array; probe: ProbeRequest | null }
export interface LinkReply { seq: number; screen: Uint8Array; meters: Meters; probe: ProbeData | null; ms: number }
export type ToWorker = { type: 'init'; seed: number } | { type: 'frame'; request: LinkRequest };
export type FromWorker = { type: 'ready' } | { type: 'frame'; reply: LinkReply } | { type: 'error'; message: string };

// shared/link/handler.ts
export function createHandler(now: () => number): {
  handle(msg: ToWorker): { reply: FromWorker; transfer: ArrayBuffer[] } | null;
};

// shared/link/index.ts
export type LinkMode = 'worker' | 'sync';
export interface WorkerLike {
  postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  onmessage: ((e: { data: FromWorker }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}
export interface LinkOptions { seed?: number; mode?: 'auto' | LinkMode; makeWorker?: () => WorkerLike }
export interface Link {
  readonly mode: LinkMode;
  readonly frame: LinkReply | null;    // найсвіжіший кадр моделі
  readonly frames: number;             // скільки кадрів моделі прийшло
  readonly fps: number;                // кадрів моделі за секунду часу рушія, згладжено
  /** Раз на оновлення рушія. Якщо запиту в дорозі немає — бере стан, кличе luma() й надсилає. true — відтоді прийшов новий кадр. */
  pump(state: FmLinkState, luma: () => Uint8Array, probe: ProbeRequest | null): boolean;
  /** Кадр `still` синхронно, у будь-якому режимі. */
  still(state: FmLinkState, luma: Uint8Array, probe: ProbeRequest | null): LinkReply;
  dispose(): void;
}
export function createLink(ctx: ChapterContext, opts?: LinkOptions): Link;
export const LINK_SYNC_EVERY = 6;      // синхронний шлях: щонайбільше один кадр моделі на 6 оновлень рушія
export const LINK_MAX_FPS = 25;        // не більш як 25 запитів за секунду часу рушія

// shared/screen/eye.ts
export interface EyeOptions { fov?: number; hide?: () => readonly Object3D[] }
export interface Eye {
  readonly camera: PerspectiveCamera;  // mountWorld робить її дитиною якоря yard.anchors.lens: око дивиться туди, куди об'єктив
  readonly format: 'half' | 'byte';    // формат власної текстури 128 × 96
  readonly passes: number; readonly lastMs: number; readonly lastCalls: number;
  /** Один додатковий прохід рендерера (рішення 24) і читання яскравості; повертає той самий масив щоразу. */
  capture(): Uint8Array;
  /** Комірка, у яку око бачить точку світу, або null, якщо точка поза кадром. */
  project(world: Vector3): { col: number; row: number } | null;
  dispose(): void;
}
export function createEye(ctx: ChapterContext, opts?: EyeOptions): Eye;
/** Яскравість камери з лінійних кольорів кадру: Y = 0,2126 R + 0,7152 G + 0,0722 B, витримка, гама 1/2,2. */
export function lumaFromPixels(src: Uint16Array | Uint8Array, format: 'half' | 'byte', exposure: number, out: Uint8Array, cols?: number): void;   // cols типово 128
export const EYE_COLS = 128, EYE_ROWS = 96;

// shared/screen/screen.ts
export interface Screen {
  readonly object: Mesh;               // прямокутник екрана; ставиться на якір монітора
  power: number;                       // 0 — темне скло … 1 — увімкнено
  show(luma: Uint8Array): void;        // 128·96 значень; текстура оновлюється лише тут
  readonly luma: Uint8Array;           // те, що екран показує зараз
  dispose(): void;
}
export function createScreen(opts: { width: number; height: number }): Screen;

// shared/yard/index.ts
export type RouteStop = 'yard' | 'kitchen' | 'hallway' | 'far-room' | 'cellar';
export interface Yard {
  readonly root: Group;
  readonly anchors: Readonly<Record<
    'lens' | 'cameraAntenna' | 'monitor' | 'monitorScreen' | 'monitorAntenna' | 'wicket' | 'cat' | 'garageGate' | 'cable'
    | 'shedWall' | 'nook', Object3D>>;   // cat — біла цятка на лобі; shedWall, nook і поле catAt додає до типу й до mountYard C3a — B13 їх ще не оголошує
  dusk: number;                        // 0 ранній вечір … 1 ніч
  wicket: number;                      // хвіртка в полі зору камери: −1…1, 0 — зачинена
  garageGate: number;                  // 0…1 (іде з AirState.gate)
  tray: number;                        // 0…1 (іде з AirState.tray)
  screenLight: number;                 // 0…1: світло екрана на кухню; mountWorld пише сюди power × середня яскравість / 255
  catAt: number;                       // 0…1 уздовж паркану, типово 0,5 (черга 3, C3a)
  monitorAt(route: number, nudge: number): void;
  /** Те, чого камера у дворі бачити не повинна (стенди, щуп, мапа, підписи). */
  readonly hidden: Object3D[];
  update(dt: number, t: number): void; // кіт, гойдалка, ліхтар
}
export const YARD_SHOTS: Readonly<Record<'both' | 'yard' | 'pole' | 'window' | 'screen' | 'antenna' | 'route' | 'top', Shot>>;
export function screenShot(route: number): Shot;      // екран монітора зблизька там, де він зараз; YARD_SHOTS.screen = screenShot(1)
export function mountYard(ctx: ChapterContext, opts?: { dusk?: number }): Yard;

// shared/world/index.ts
export interface WorldOptions { link?: 'auto' | 'sync' | 'off'; seed?: number; dusk?: number }
export interface RadioWorld {
  readonly yard: Yard; readonly eye: Eye; readonly link: Link | null; readonly screen: Screen;
  /** Стан лінії. Кроки пишуть сюди, модель читає щокадру моделі. */
  readonly line: FmLinkState;
  probe: ProbeRequest | null;
  readonly meters: Meters | null;
  readonly probeData: ProbeData | null;
  /** Останній кадр камери (128·96), яким живилася модель. */
  readonly luma: Uint8Array;
  resetLine(): void;                   // повертає line до DEFAULT_STATE
  update(dt: number, t: number): void;
}
export function mountWorld(ctx: ChapterContext, opts?: WorldOptions): RadioWorld;

// shared/whereami/index.ts
export interface WhereAmIOptions {
  labels: { title: string; stops: readonly [string, string, string, string, string]; depth: readonly [string, string, string] };
  route: () => number; nudge: () => number; depth: () => 0 | 1 | 2;     // подвір'я · стенд · під лупою
}
export function whereami(ctx: ChapterContext, opts: WhereAmIOptions): CustomSpec;    // лише вид плану (П21)
export function routeSlider(o: { label: string; stops: readonly string[]; from?: 0 | 1; value?: number }): SliderSpec;   // id 'route', from…4, крок 0,01
export function nudgeSlider(o: { label: string; unit: string }): SliderSpec;                                              // id 'nudge', −0,15…0,15, крок 0,005
export function whereAt(route: number, nudge: number): { x: number; y: number };                                          // місце монітора на плані
```

`shared/world/index.ts` також віддає назовні `DEFAULT_STATE`, типи моделі (`FmLinkState`, `Meters`, `ProbeRequest`, `ProbeData`, `TapId`, `ProbeView`, `ChannelNo`), `YARD_SHOTS`, `screenShot`, `RouteStop`: пісочниця в `_dev` може імпортувати лише `@radio/shared/**`. Щуп сцени (черга 3) зветься `mountProbe` — щоб не плутати з `createProbe` моделі.

`mountWorld` публікує для перевірок `ctx.qa.expose('radio-world', …)`:

```ts
{ mode: 'worker' | 'sync' | 'off', frames: number, fps: number, modelMs: number,
  meters: Meters | null, screenHash: string /* FNV-1a 32 біти шістнадцятково */,
  screenMean: number, screenNoise: number /* середній модуль різниці сусідніх комірок у рядку */,
  eye: { format: 'half' | 'byte', passes: number, lastMs: number, lastCalls: number } }
```

На сторінці з `?freeze` світ створює лінію в режимі `sync` (фоновий потік для зупинених кадрів не потрібен), тож `mode` там — `'sync'`; `frames` рахує показані екрани, і живі, і зупинені.

Мірило швидкості читаємо з часу моделі, а не з `fps`: на цій машині кадр сцени триває 75–97 ms, і `fps` упирається в малювання. «≥ 10 кадрів моделі за секунду» означає `modelMs ≤ 100` у фоновому потоці; оцінка для телефона — час одного кадру моделі в основному потоці під чотирикратним сповільненням не більш як 250 ms.

### Подорож тому — `volume.json`

Лінійка (`axis.floors`, знизу вгору): `basics` «основи» 0 · `camera` «камера» 1 · `transmitter` «передавач» 2 · `air` «повітря» 3 · `receiver` «приймач» 4 · `screen` «екран» 5 · `road` «уся дорога» 6. `axis.label` «Станція», `axis.hint` «Де ми на дорозі картинки», `axis.range` «від камери до екрана».

Групи (id · назва · шар): `prologue` «Пролог» prologue · `basics` «Основи» path · `picture` «Дорога картинки» path · `practicum-analog` «Практикум» practicum · `numbers` «Дорога чисел» path · `practicum-digital` «Практикум» practicum · `branches` «Гілки» branch · `engineering` «Інженерні гілки» branch · `labs` «Лабораторії» branch.

Подорож — 37 записів у цьому порядку (`id` · група · батько · хвилини · позначка лінійки). Назви — з проєкту II §1, §3, §4 дослівно, з апострофом `’`; практикуми — без слова «Практикум.» на початку.

| № | id | група | parent | хв | floor |
|---|---|---|---|---|---|
| 1 | `prologue` | prologue | — | 5 | road |
| 2 | `field` | basics | — | 8 | basics |
| 3 | `current` | basics | — | 8 | basics |
| 4 | `wave` | basics | — | 9 | basics |
| 5 | `antenna-size` | engineering | wave | 8 | basics |
| 6 | `lines` | picture | — | 10 | camera |
| 7 | `carrier` | picture | — | 9 | transmitter |
| 8 | `air` | picture | — | 9 | air |
| 9 | `select` | picture | — | 7 | receiver |
| 10 | `tank` | engineering | select | 10 | receiver |
| 11 | `cable` | engineering | select | 8 | receiver |
| 12 | `shift` | picture | — | 10 | receiver |
| 13 | `synth` | engineering | shift | 10 | receiver |
| 14 | `slope` | picture | — | 7 | receiver |
| 15 | `budget` | engineering | slope | 11 | receiver |
| 16 | `arrow` | picture | — | 8 | receiver |
| 17 | `angle` | picture | — | 7 | receiver |
| 18 | `fm-depth` | engineering | angle | 10 | receiver |
| 19 | `sdr` | engineering | angle | 10 | receiver |
| 20 | `raster` | picture | — | 9 | screen |
| 21 | `tv` | branches | raster | 13 | screen |
| 22 | `lab-tube` | labs | raster | 10 | screen |
| 23 | `sat` | branches | raster | 10 | screen |
| 24 | `colour-sound` | branches | raster | 11 | screen |
| 25 | `build-analog` | practicum-analog | — | 12 | road |
| 26 | `lab-bench` | labs | build-analog | 12 | road |
| 27 | `compress` | numbers | — | 10 | camera |
| 28 | `packets` | numbers | — | 7 | transmitter |
| 29 | `points` | numbers | — | 9 | air |
| 30 | `codes` | engineering | points | 10 | air |
| 31 | `many` | numbers | — | 7 | receiver |
| 32 | `one-sum` | engineering | many | 8 | receiver |
| 33 | `cliff` | numbers | — | 8 | screen |
| 34 | `sat-digital` | branches | cliff | 7 | screen |
| 35 | `build-digital` | practicum-digital | — | 10 | road |
| 36 | `lab-digital` | labs | build-digital | 12 | road |
| 37 | `lab-yard` | labs | build-digital | 9 | road |

Хвилини гілок проєкт не задає; тут вони пораховані з кількості кроків (≈ 1,6 хв на крок) і уточнюються, коли гілки проєктуватимуться. Сума хвилин не-гілок — 169.

### Ворота черги

Кожна черга закінчується завданням-воротами з однаковим ядром:

```bash
# прелюдія, потім:
git branch --show-current                          # main
cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..   # з черги 2 тести моделі йдуть хвилини: цей рядок — у фоні (run_in_background), висновок — за останніми рядками
python3 tools/content/doccheck.py --all            # закінчується рядком «doccheck: ALL GREEN»
python3 docs/volumes/radio/check.py                # закінчується рядком «radio check: OK»; немає документа — це проблема, а не пропущене правило
python3 docs/volumes/radio/test_check.py           # OK
node tools/site/build.mjs --volume radio           # закінчується рядком «PASS site smoke»
git status --short                                 # порожньо, крім того, що йде в коміт
git log --first-parent --no-merges 63fd42c..HEAD --format=%B | grep -ciE 'co-authored-by|generated with|claude\.ai'   # 0
```

Від черги 2 до ядра додаються дві перевірки зразків еталона (вони потребують numpy і scipy, тому в `pages.yml` їх немає):

```bash
python3 tools/ref-models/radio/fm_chain.py --check app/src/volumes/radio/sim/core/__fixtures__          # fm_chain: 8 fixture(s) up to date
python3 tools/ref-models/radio/link_budget.py --site app/src/volumes/radio/sim/core/site.json \
        --check app/src/volumes/radio/sim/core/__fixtures__                                              # link_budget: 2 fixture(s) up to date
```


---

## Покажчик завдань

Завдання лежать у чотирьох файлах додатків; порядок виконання — зверху вниз. Кожна черга закінчується воротами й надсиланням у `origin/main`.

### Черга 1. Каркас, сайт, документи — `2026-11-18-radio-pilot/batch-1.md`

| № | Завдання | Виконавець |
|---|---|---|
| A1 | Архів старого плану й розділ у `README.md` | Opus |
| A2 | Каркас тому `radio`: `volume.json`, `volume.ts`, `chapters.ts`, тест подорожі | Opus |
| A3a | Власна перевірка тому `check.py` | Opus |
| A3b | Документи «у формі проєкту»: `VOLUME.md`, `PATH.md`, `PATH-ledger.md` | Fable |
| A4 | Реєстр термінів, дозволені написи, правила тексту | Fable |
| A5 | `VISUAL.md` — візуальна мова тому й план подвір'я в метрах | Fable |
| A7 | Профіль сайту `tools/site` | Opus |
| A6 | `PATH-NOTES.md` — формат і рушій, як їх перевіряють інструменти | Opus |
| A8 | Публікація: `.github/workflows/pages.yml` | Opus |
| A9 | Ворота черги 1, надсилання, перевірка сайту | Opus |

### Черга 2. Модель сигналу — `2026-11-18-radio-pilot/batch-2-model.md`

| № | Завдання | Виконавець |
|---|---|---|
| B2 | Основа: `standard.ts`, `units.ts`, `rng.ts`, `dsp.ts`, тест чистоти | Fable |
| B3 | Еталон, перша частина: `fm_chain.py` | Fable, окремий агент |
| B4 | `video.ts` — кадр у сигнал і назад | Fable |
| B5 | `fm.ts` — модулятор, обмежувач, два детектори | Fable |
| B6a | Подвір'я числами (`site.json`) й еталон бюджету лінії | Fable, окремий агент |
| B6b | `site.ts`, `channel.ts` — промені, рівні, шум антени | Fable |
| B7 | `rf.ts`, `interferers.ts`, `spectrum.ts` | Fable |
| B8 | `probe.ts` — відведення і три вигляди | Fable |
| B9a | Еталон усього ланцюга | Fable, окремий агент |
| B9b | `fm-link.ts` — увесь ланцюг і крайні стани | Fable |
| B9c | «Виходить із моделі», звірка з еталоном, числа у звіт | Fable |
| B10 | Швидкість моделі | Fable |

### Черга 2. Світ — `2026-11-18-radio-pilot/batch-2-world.md`

Іде поруч із моделлю: B1a і B1b — першими в черзі (рішення 24); B12 — після B1b; B11 — після B9b; B13 — після B6b і B12; B15 — після B13; B14 — після B11 і B13; B16 — після B14, B15 і B10; B17 — ворота всієї черги 2, останнім.

| № | Завдання | Виконавець |
|---|---|---|
| B1a | Око камери й екран | Opus |
| B1b | Пісочниця ока й рішення про додатковий прохід | Opus |
| B11 | Зв'язок із моделлю: `shared/link` | Opus |
| B12 | Предмети світу: `shared/models` | Fable |
| B13 | Подвір'я: `shared/yard` | Fable |
| B14 | Світ: `shared/world` | Opus |
| B15 | Мініатюра «де ми»: `shared/whereami` | Opus |
| B16 | Пісочниця «живий екран» і виміри | Opus |
| B17 | Ворота черги 2, надсилання, звіт власникові | Opus |

### Черга 3. Пілот — `2026-11-18-radio-pilot/batch-3.md`

| № | Завдання | Виконавець |
|---|---|---|
| C1 | Сценарії `prologue.md` і `lines.md` | Fable; читають фізик і новачок |
| C2 | Щуп і стрічка: `shared/probe` | Opus |
| C3a | Подвір'я для пілота: місце кота і два якорі | Opus |
| C3b | Стенд камери, бігунці, копія екрана | Opus; знімки приймає Fable |
| C3c | Мапа дороги | Opus; знімки приймає Fable |
| C4 | Глава `prologue` | Opus |
| C5 | Глава `lines` | Opus |
| C6 | Телефон і планшет | Opus |
| C7 | Знімки, аудит кадру, читання | Opus; судять два свіжі агенти |
| C8 | Проба глави `arrow` у пісочниці | Fable задумує, Opus будує |
| C9 | Ворота черги 3, сайт, показ власникові | Opus |
