# `tools/site` — профіль сайту

Профіль сайту — це продакшн-збірка `app/`, у якій лишено один том, і той показаний як окремий курс: без
бібліотеки й без кнопок до інших томів. Так збирається сайт https://codir.github.io/radio-pop-science/ (том
`radio`). Дерево репозиторію збірка не змінює: усе відбувається в тимчасовій копії `app/`.

## Що робить профіль і чого не чіпає

`build.mjs` копіює `app/` у тимчасовий каталог (без `node_modules`, `dist`, `.vite`; `node_modules` копії —
посилання на `app/node_modules`) і змінює в копії рівно три речі:

1. З `src/volumes/` вилучено всі томи, крім обраного, разом зі службовими `_demo`, `_dev`, `_path`.
2. `src/volumes/library.json` = `{ "title": null, "defaultVolume": "<том>" }` — без `legacyVolume`.
3. У `src/volumes/<том>/volume.json` поле `status` стає `published`: том-чернетку без `?debug` рушій не реєструє.

Решта — як у репозиторії: `tsconfig.json`, `vite.config.ts`, `index.html`, платформа й тести лишаються без змін.
Далі в копії йдуть `tsc -p tsconfig.json --noEmit` і `vite build --outDir <out> --emptyOutDir` (обидва з
`app/node_modules/.bin/`), а потім перевірка в браузері (`smoke.mjs`). Збірку в `tools/site/dist` git не бачить:
її ховає наявне правило `dist/` у `.gitignore`.

## Команди

Усі команди — з кореня репозиторію, у Node 24 (прелюдія або `source tools/site/qa-env.sh`).

### `build.mjs` — зібрати й перевірити

```bash
node tools/site/build.mjs --volume radio
#   [--out tools/site/dist] [--sub radio-pop-science] [--port 5391] [--no-smoke] [--keep-work]
```

Перший рядок — `site: volume radio (draft → published); removed from the copy: _demo _dev _path circuit electricity`,
останній — `PASS site smoke`, вихід 0 (10–20 с). `--no-smoke` лише збирає; `--keep-work` лишає робочу копію й
друкує її шлях (див. «Робоча копія»). Тому немає — `site: app/src/volumes/<том>/volume.json is missing`, вихід 1.
Ще до копії `build.mjs` відмовляє (рядок `site: …`, вихід 1), якщо `volume.json` тому в дереві має інший `id` чи
поле `aside` або якщо порт перевірки зайнятий (`port 5391 on 127.0.0.1 is not free: EADDRINUSE …`; з `--no-smoke`
порт не потрібен). Тож через зайнятий порт у `--out` не лягає збірка, якої не бачив браузер. `tsc` і `vite` мають
по 10 хвилин: завислий інструмент збірка зупиняє, і це провал, а не вічне очікування.
Для перевірок глав будь-який інший том можна зібрати в окремий каталог:
`node tools/site/build.mjs --volume circuit --out "$HOME/.cache/radio-pop-science/site-circuit"`.

### `smoke.mjs` — перевірити сайт у браузері

```bash
node tools/site/smoke.mjs --dist tools/site/dist --volume radio [--sub radio-pop-science] [--port 5391]
node tools/site/smoke.mjs --dist tools/site/dist --serve [--port 5391]
node tools/site/smoke.mjs --url https://codir.github.io/radio-pop-science/ --volume radio
```

- `--dist … --volume …` роздає збірку під `/<sub>/` так, як GitHub Pages роздає сайт проєкту (поза підшляхом —
  404, запасної сторінки немає), і відкриває її в Chrome без вікна.
- `--dist … --serve` лише роздає — для `tools/qa/*.mjs --base http://127.0.0.1:5391/radio-pop-science/`.
  Зупиняє Ctrl+C або `site_stop` (див. `qa-env.sh`).
- `--url <адреса зі скісною рискою в кінці>` нічого не роздає, а перевіряє вже розданий сайт — локальний
  сервер чи опублікований. Кожен запит сторінки мусить лишатися під цією адресою.

Очікувану назву вкладки (заголовок тому: `subtitle`, якщо `"headline": "subtitle"`, інакше `title`) і рядок
вестибюля (`emptyNote`) перевірка бере з `app/src/volumes/<том>/volume.json`, а не зі збірки. Що перевіряє:

- кожен запит дістав відповідь і не вийшов за підшлях; у консолі й в `__app.errors()` немає помилок;
  застосунок запустився (заставка зникла, екрана аварії немає);
- єдиний том — обраний, опублікований, і він же головна сторінка; проста адреса відкриває його домашній екран
  з правильною назвою; дороги до бібліотеки чи іншого тому немає;
- том без глав показує вестибюль із рядком `emptyNote` (`home-empty`); том із главами — кнопку `home-start`
  або `home-resume`, а глибоке посилання на перший крок відкриває саме цей крок;
- посилання в том, якого тут немає, веде в обраний.

Без `<dist>/index.html` — одразу `site: <dist>/index.html is missing`, вихід 1, браузер не запускається. Зайнятий
порт чи Chrome, що не запускається, — рядок `FAILED site smoke: cannot serve …` або `FAILED site smoke: cannot start
Chrome …`, вихід 1. Кожне очікування сторінки має межу: завантаження й поява `__app` — 60 с, `__app.ready`,
`__app.settled()` і шрифти — по 90 с; завислий запуск закінчується рядком `FAILED site smoke`, а не чеканням без кінця.

### Змінні середовища

- `QA_CHROME` — шлях до Chrome, типово `/usr/bin/google-chrome`.
- `QA_CHROME_ARGS` — прапорці Chrome через пропуск. Замінюють типові прапорці програмного рендеру
  (SwiftShader через ANGLE: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader …`), тож
  відеокарта не потрібна.

Ці самі дві змінні читає `tools/qa/lib.mjs` (там `QA_CHROME_ARGS` замінює прапорці відеокарти).

## `qa-env.sh` — середовище для перевірок у браузері

```bash
source tools/site/qa-env.sh
```

Ставить Node 24 (nvm), `QA_ALLOW_SOFTWARE=1`, `QA_OUT` (типово `~/.cache/radio-pop-science/qa`, каталог
створюється) і, якщо `montage` у системі немає, кладе `tools/site/shims` на початок `PATH`. Без `$NVM_DIR/nvm.sh`
друкує в stderr, що Node лишився системним, а потрібен 24. Дві функції:

- `site_serve [порт] [каталог]` (типово 5391 і `tools/site/dist`) запускає `smoke.mjs --serve` відокремлено
  (журнал — `$QA_OUT/site-<порт>.log`), чекає відповіді 200 до 10 с і друкує адресу
  `http://127.0.0.1:<порт>/radio-pop-science/`. Зайнятий порт або каталог без `index.html` — відмова, код 1.
- `site_stop [порт]` зупиняє того, хто слухає порт: сервер `site_serve`, `pnpm preview` чи `pnpm dev`, запущені
  з `app/`, — і повертається, щойно порт вільний (чекає до 5 с). Сервер шукає за портом (`ss -ltnp`), бо `$!` і
  `pkill -f` тут не працюють. Програму поза цим репозиторієм не чіпає: якщо ні її робочий каталог, ні жоден
  аргумент не лежать у репозиторії чи в одному з його робочих дерев git (так буває із серверами інших проєктів
  або з копій у тимчасових каталогах), повідомляє про неї й повертає 1.

Обидва очікування — цикли всередині функцій, тож окремого `sleep` у команді не треба.

Перевірки глави по збірці профілю (так підуть перевірки глав тому; приклад — на готовому томі `circuit`). Разом
це близько двох хвилин, тож в оболонці агента команду запускають у фоні:

```bash
bash -c 'source tools/site/qa-env.sh; site_serve 5392 "$HOME/.cache/radio-pop-science/site-circuit" >/dev/null; B=http://127.0.0.1:5392/radio-pop-science/
  node tools/qa/chapter-check.mjs circuit/prologue --base $B --skip perf --out "$QA_OUT/site-circuit"; echo "exit $?"
  node tools/qa/mobile-check.mjs circuit/prologue --base $B --profiles pp --skip perf --out "$QA_OUT/site-circuit" | tail -1; site_stop 5392'
```

Очікувано: `PASS circuit/prologue — report: …/site-circuit/circuit-prologue/report.json`, `exit 0`, далі
`mobile-check circuit/prologue: PASS — 0 failure(s), …`. `--skip perf` потрібен, бо під програмним рендером кадр
триває 75–97 ms проти межі 8 ms.

### Замінники ImageMagick (`shims/`)

ImageMagick тут не встановлено, а `tools/qa/sheet.sh` збирає контактні аркуші командами `montage`, `identify` і
`mogrify`; без них `chapter-check` і `mobile-check` закінчуються помилкою `contact sheet failed`.
`shims/{montage,identify,mogrify}` — замінники на Pillow, що приймають рівно ті аргументи, які передає
`sheet.sh`. Їм потрібен Pillow у `/usr/bin/python3` (перевірка: `/usr/bin/python3 -c 'import PIL'`).
`qa-env.sh` ставить їх на `PATH` лише тоді, коли справжнього `montage` немає.

## Робоча копія: не запускати в ній pnpm і corepack

Робоча копія лишається після `--keep-work` або коли впали `tsc` чи `vite` (`site: … failed … (work copy kept: <шлях>)
— do not run pnpm or corepack in it`). Копію, яку не вдалося зробити до кінця, збірка вилучає сама. `node_modules`
робочої копії — посилання на справжній `app/node_modules`. pnpm 12, запущений у копії (`pnpm test`, `pnpm typecheck`
чи будь-що інше), спершу перев’язує `app/node_modules` на шлях копії, і після її вилучення `tsc`, `vite` й `vitest`
в `app/` уже не знаходять пакетів. Тому в копії `tsc` і `vite` кличуть із `app/node_modules/.bin/`, як це робить
сама збірка:

```bash
cd <робоча копія> && <корінь репозиторію>/app/node_modules/.bin/tsc -p tsconfig.json --noEmit
```

Якщо `app/node_modules` уже зіпсовано, його лагодить `(cd app && pnpm install --frozen-lockfile --offline)`:
сховище тепле, мережа не потрібна.

Модульні тести в копії профілю не запускаємо: тести платформи `engine/__tests__/volumes.test.ts` і
`engine/__tests__/lint-chapter-boundary.test.ts` спираються на повний набір томів, а тест тому
`volumes/radio/__tests__/journey.test.ts` чекає статусу `draft`, який профіль міняє на `published`, тож у копії частина
з них падає за побудовою (18.11.2026 — одинадцять тестів у цих трьох файлах). Модульні тести — справа повного дерева
(`cd app && pnpm test`).

## Дві поламки, які ловить лише браузер

Для обох `tsc` і `vite build` зелені, а читач бачить екран аварії «Не вдалося запустити посібник»:

| Помилка профілю | Рядок на екрані аварії |
|---|---|
| у `library.json` лишилося `legacyVolume` (наприклад, `"electricity"`) | `Library: legacy volume 'electricity' is not registered` |
| том лишився чернеткою (`"status": "draft"`) | `Library: default volume 'radio' is not registered` |

Тому збірка без перевірки в браузері (`--no-smoke`) ще не доводить, що сайт працює.

## Публікація

Сайт тому: https://codir.github.io/radio-pop-science/. Його збирає й публікує потік GitHub Actions `pages`
(`.github/workflows/pages.yml`).

**Одноразова дія власника:** Settings → Pages → Build and deployment → Source: **GitHub Actions**. Доки цього не
зроблено, падає крок `Pages settings`: `actions/configure-pages` сам Pages не вмикає, бо для цього потрібен інший
ключ, ніж `GITHUB_TOKEN`.

**Коли запускається:** на кожне надсилання в `main` і вручну (Actions → pages → Run workflow). Запуск, що вже йде,
новий не перериває, а чекає на нього.

**Що робить.** Робота `build` (`ubuntu-24.04`, Node 24, pnpm 12.18 через corepack) перевіряє повне дерево і збирає
сайт, робота `deploy` публікує зібране. Лише `deploy` має право писати в Pages (`pages: write`, `id-token: write`);
`build` тільки читає репозиторій. Кроки `build` по черзі:

| Крок | Що робить |
|---|---|
| `pnpm` | `corepack enable` (версію pnpm закріплено в `app/package.json`) |
| `Install` | `pnpm install --frozen-lockfile` в `app/` |
| `Types`, `Lint`, `Unit tests` | `pnpm typecheck`, `pnpm lint`, `pnpm test --testTimeout=30000` в `app/` |
| `Documents` | `python3 tools/content/doccheck.py --all`, `python3 docs/volumes/radio/test_check.py`, `python3 docs/volumes/radio/check.py` |
| `Pages settings` | `actions/configure-pages`: перевіряє, що Pages увімкнено, і дає підшлях сайту (`/radio-pop-science`) для `--sub` наступного кроку |
| `Site profile` | `node tools/site/build.mjs --volume radio --out "$RUNNER_TEMP/site" --sub radio-pop-science` (підшлях — з `Pages settings`): збірка з перевіркою в браузері |
| `actions/upload-pages-artifact` | пакує `$RUNNER_TEMP/site` для `deploy`; дерево репозиторію лишається чистим |

**Чому тести в потоці мають власну межу часу.** Машина GitHub має чотири ядра, тож довгі тести симуляцій ідуть на
ній у кілька разів довше, ніж на машині розробника: тест, якому тут досить 3,5 s, там не вкладається в межу vitest
5 s на тест (так упав перший запуск — `circuit/shared/copper/__tests__/counter.test.ts`). Тому в потоці кожен тест має
30 s. Місцевий `pnpm test` лишається зі звичайною межею.

Ні `.nojekyll`, ні `404.html`, ні `--base` сайтові не потрібні: маршрути застосунку живуть лише після `#`, тож
сервер дістає тільки запити `/radio-pop-science/` і статичних файлів під ним, а Vite збирає з `base: './'`.

### Якщо потік упав

Дивимося, який крок упав, і робимо рівно один запасний хід:

| Що впало | Що це означає | Що робимо |
|---|---|---|
| `Pages settings` | Власник іще не ввімкнув Pages. Це не дефект | Просимо власника ввімкнути Pages (див. вище) і натиснути «Re-run all jobs» на сторінці запуску. Порожніх комітів, щоб перезапустити потік, не робимо. Чергу закривають ворота без перевірки живого сайту, з відкритим рядком у звіті (`docs/superpowers/plans/2026-11-18-radio-pilot/batch-1.md`, A9, крок 6) |
| `Site profile`, а кроки до нього зелені | На машині GitHub не працює Chrome або WebGL2 | У команді кроку додаємо `--no-smoke`, а в цей розділ — рядок, що перевірка в браузері лишилася локальними воротами (див. правило нижче) |
| `actions/upload-pages-artifact@v5` або робота `deploy` | Найновіші версії дій Pages не працюють разом | Повертаємо попередні: `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v4` |
| `Install`, `Types`, `Lint`, `Unit tests` або `Documents` | Дерево на чистій машині поводиться інакше, ніж тут | Відтворюємо в чистому клоні (`git clone . "$(mktemp -d)"`), знаходимо причину й виправляємо її |

**Правило для `--no-smoke`.** Якщо в кроці `Site profile` стоїть `--no-smoke`, потік лише збирає сайт, а перевірка в
браузері лишається локальними воротами: перед надсиланням — `node tools/site/build.mjs --volume radio` (останній
рядок `PASS site smoke`), а після публікації — перевірка опублікованого сайту:

```bash
node tools/site/smoke.mjs --url https://codir.github.io/radio-pop-science/ --volume radio
```

**Чого в потоці немає.** Дві перевірки зразків еталона, що з’являться з чергою 2
(`tools/ref-models/radio/fm_chain.py --check …` і `tools/ref-models/radio/link_budget.py … --check …`), потребують
numpy і scipy. У потоці їх немає: вони стоять лише в локальних воротах черг.
