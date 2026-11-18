# Spec requirements — «Радіо · Від електрона до екрана», work batches 1–3

- Source: `docs/superpowers/specs/2026-11-17-radio-volume-design.md` (877 lines, read completely in this run). `L123` = line 123 of that file.
- Repository state checked: `main` at `63fd42c` («Злиття з upstream: рушій і том «Електричний струм» станом на 18.11.2026 (a87c714)»); remotes `origin = git@github.com:Codir/radio-pop-science.git`, `upstream = https://github.com/NikoSkakun/tech.git`.
- Code references are repo-relative `file:line`. Everything quoted in «…» or in a block quote is copied from the doc; everything marked **[GAP]** is something the doc does not fix; **[REPO]** marks a fact verified in the repository, not in the doc.
- The doc's own status line (L3-5): «проєкт на затвердження власника тому (17.11.2026). Після затвердження з нього роблять план робіт і документи тому у формі проєкту (`docs/volumes/radio/VOLUME.md`, `PATH.md`, `PATH-ledger.md`, `VISUAL.md`). До затвердження нічого не будується.»
- Batch table of the doc (L789-801), rows 1–3 verbatim:

> | Черга | Що робимо | Що бачить власник |
> |---|---|---|
> | 1. Каркас і сайт | каркас тому з усією подорожжю; профіль сайту; GitHub Pages; документи тому у формі проєкту (`VOLUME.md`, `PATH.md` з повними таблицями кроків, реєстр, `VISUAL.md`); архів старого плану; запис формату, як його перевіряють інструменти (якщо документів формату не додано) | сайт із мапою всіх глав «у планах»; документи |
> | 2. Модель і світ, перша частина | спершу око камери додатковим проходом (рішення 24) і його виміри; ланцюг частотної модуляції з каналом і щупом, еталон, тести; фоновий потік і запасний шлях; подвір'я, екран, мініатюра «де ми»; виміри швидкості проти мірила | звіт із числами; у пісочниці — живий екран, що сніжить за стіною |
> | 3. Пілот | пролог і глава `lines`, доведені до еталона; паралельно — проба найкрутішої сходинки шляху (глава `arrow`) у пісочниці, без показу на сайті | **показ і рішення власника: чи це еталон** |

Sections 7 and 8 (surprises, open questions) are appendices beyond the six requested headings.

---

## 1. Batch 1 requirements

Scope (L791): «каркас тому з усією подорожжю; профіль сайту; GitHub Pages; документи тому у формі проєкту (`VOLUME.md`, `PATH.md` з повними таблицями кроків, реєстр, `VISUAL.md`); архів старого плану; запис формату, як його перевіряють інструменти (якщо документів формату не додано)». Owner sees: «сайт із мапою всіх глав «у планах»; документи».

### 1.1 Numbered requirements

| # | Requirement | Doc line |
|---|---|---|
| R1.1 | Volume id is `radio`, name «Радіо · Від електрона до екрана», built on the `tech` engine in the format «шлях» «(як пілотний том `circuit`)», published as a separate site that shows only this volume. | L100 (decision 1), L1 |
| R1.2 | Only these paths are added or touched: `app/src/volumes/radio/**` (new), `docs/volumes/radio/**` (new; old plan moves to `docs/volumes/radio/plan48/` «із позначкою «архів»»), `tools/ref-models/radio/**` (new), `tools/site/**` (new), `.github/workflows/pages.yml` (new), `app/tsconfig.json` — «один рядок `@radio/*`» («додаток, якого вимагає рушій»), `README.md` — «розділ на початку: що це за копія і де сайт», `docs/superpowers/**` (new). | L541-550 |
| R1.3 | Volume directory layout is the tree at L604-619 (pasted in 1.2 below): `volume.json`, `volume.ts`, `chapters.ts`, `chapters/<id>/` (`index.ts, scene.ts, content.ts, steps/, parts/, qa/, __tests__/`), `sim/core/`, `sim/<глава>/`, `shared/`, `content/generated/`. | L604-613 |
| R1.4 | `volume.json`: «формат «шлях», лінійка із сімома позначками, уся подорож наперед»; `status: "draft"`; accent `sky` («колір несної»). | L606, L559, L621 |
| R1.5 | `volume.ts` carries «вісь, емблеми, тема»; `chapters.ts` exists. | L607-608 |
| R1.6 | Groups go in journey order with neutral names that use no not-yet-introduced terms: «Пролог», «Основи» (глави 1–3), «Дорога картинки» (4–12), «Практикум» (після аналогового фіналу), «Дорога чисел» (13–17), «Практикум» (після цифрового фіналу), plus three groups of the branch layer — «Гілки», «Інженерні гілки», «Лабораторії». | L621-624 |
| R1.7 | Every branch and lab has a `parent` and stands in the journey after it: branches «одразу після своєї глави шляху»; `lab-tube` — child of `raster` «одразу після гілки `tv`»; `lab-bench` — child of practicum `build-analog`; `lab-digital` and `lab-yard` — children of practicum `build-digital`. | L624-627 |
| R1.8 | Labs are chapters of the branch layer with question titles, because the engine treats only branch-layer chapters as optional and does not count them in «лишилося». | L422, L627-628, L834-835 |
| R1.9 | Ruler has seven marks: «уся дорога» (пролог і практикуми), «основи», «камера», «передавач», «повітря», «приймач», «екран»; chapters 13–17 pass the five stations a second time (same marks). | L201, L628-629, L843-844 |
| R1.10 | The whole journey is in `volume.json` from batch 1: 20 path-layer entries (prologue, 17 chapters, 2 practicums), 13 branches, 4 labs = 37 entries; ids, titles, minutes and marks as in table 1.3. | L213-236, L373-441 |
| R1.11 | From batch 1 `volume.json` gives branches their parent chapters and the map draws them alongside; only if the platform change (decision 25) has not arrived by batch 9 do branches and labs temporarily move to the tail of the journey without parents, reached through «Див. також». | L637-639 |
| R1.12 | In the repository tree the volume stays a draft because the engine's library check demands exactly one published volume in the main flow and that is `circuit`; locally the volume opens at `#/radio/<глава>/<крок>` with `?debug`. | L558-560, L171, L841 |
| R1.13 | Site profile = one script in `tools/site/` that does the same locally and in GitHub Actions: (1) copies `app/` to a temporary directory; (2) leaves only `radio` in `src/volumes/` (electricity volumes and service sandboxes are not in the build); (3) writes `library.json` with `defaultVolume: "radio"` and sets the volume's `status: "published"`; (4) builds (`vite build`); (5) opens the build in a browser and checks: home page is the volume «Радіо», console without errors. | L562-568 |
| R1.14 | The site must look like a stand-alone course from batch 1: no library shelf, no button to other volumes; the map draws unbuilt chapters as «у планах · ≈ N хв». | L570-572, L209 |
| R1.15 | Site texts: `defaultVolume: radio`, «без полиці бібліотеки й кнопки старого тому; вхід — пролог». | L209 |
| R1.16 | `.github/workflows/pages.yml` runs on every push to `main`: install (Node 24, pnpm), checks on the full tree (типи, лінт, тести, документи), site-profile build, publish. | L574-575 |
| R1.17 | Site address is `https://codir.github.io/radio-pop-science/`; hosting is GitHub Pages; the one-time owner action is Settings → Pages → Source: GitHub Actions. | L576-577, L120, L872 |
| R1.18 | Volume documents «у формі проєкту»: `docs/volumes/radio/VOLUME.md`, `PATH.md` («з повними таблицями кроків»), `PATH-ledger.md` / «реєстр», `VISUAL.md`; the doc tree also lists `PATH-NOTES.md`, `terms_allowlist.tsv`, `chapters/<id>.md`, `chapters/_terms.md`, `plan48/`. | L3-5, L614-617, L791 |
| R1.19 | `VISUAL.md` of batch 1 holds «Композиція кадрів, ракурси, світло». | L811 |
| R1.20 | Volume documents go through the existing tools: `tools/content/regen.sh --volume radio` until `doccheck` says `ALL GREEN`. | L653-654 |
| R1.21 | The volume's own `terms_allowlist.tsv` lists the abbreviations and Latin labels: FM, QPSK, QAM, OFDM, PLL, LDPC, PAL, SECAM, I, Q, and the notation `angle(…conj…)`. | L517, L654-655 |
| R1.22 | The three old documents (`CURRICULUM.md`, `VOLUME.md`, `NOTES.md` in `docs/volumes/radio/`) move to the archive `docs/volumes/radio/plan48/`; the 48-chapter plan is not built and stays «архівом ідей для майбутніх гілок». | L74, L523, L544, L617, L842 |
| R1.23 | `README.md` gets a section at the beginning about this copy and where the site is; `docs/LIBRARY.md` is a platform document and is not touched. | L523, L549, L842 |
| R1.24 | If the owner has not added the format documents (decision 26), batch 1 writes «запис формату, як його перевіряють інструменти» and works from what the tools check: `tools/content/path_*.py`, the documents and built chapters of `circuit`, sandbox `_path`, `COPY_STYLE.md` and `VISUAL.md`. | L647-651, L791 |
| R1.25 | Platform directories are not edited (list in 4.5); the engine is not changed in this repository. | L79-80, L552-556 |
| R1.26 | After the batch: verification, push to `main` (no separate permission needed), site updates, owner looks. | L121 (decision 22), L786-787 |
| R1.27 | Batch 1 gate = Part III §7 (section 4.1 below) as far as it applies to a volume with no built chapter: types, lint, unit tests, build; `path_check` and `doccheck` for the volume — `ALL GREEN`; site-profile build and its smoke check. | L766-779 |

Items the doc requires but assigns to no batch (they touch files created in batch 1):

| # | Requirement | Doc line |
|---|---|---|
| R1.28 | The list of external links (table 1.6) «живе в одному файлі, і перевірка звіряє його з главами `upstream` після кожного оновлення»; the button «У курсі про електрику» lives in `radio/shared/links`, opens the page in a new tab, is never obligatory, and is placed only for pages that already exist on the main course site. | L582-600, L738, L855 |
| R1.29 | The volume adds its own check through `volume.json`: a branch term does not appear on screen outside its branch; exception — `lab-tube` may use the terms of `tv`. Branch terms go into the same register table with type «шлях» and the step of their branch. | L641-645 |
| R1.30 | Entry from the main course (link in «Див. також» of `electricity/magnetism/maxwell` to the root of this site) is an edit in `tech` made by the owner there — not a task of this repository. | L579-580, L875-876 |

### 1.2 Directory tree (L604-619, verbatim)

> ```
> app/src/volumes/radio/
>   volume.json      формат «шлях», лінійка із сімома позначками, уся подорож наперед
>   volume.ts        вісь, емблеми, тема
>   chapters.ts
>   chapters/<id>/   index.ts, scene.ts, content.ts, steps/, parts/, qa/, __tests__/
>   sim/core/        модель сигналу й полів — чистий TypeScript без three.js, з тестами
>   sim/<глава>/     моделі однієї глави
>   shared/          один світ тому та його прилади (§6)
>   content/generated/
> docs/volumes/radio/
>   VOLUME.md  PATH.md  PATH-ledger.md  VISUAL.md  PATH-NOTES.md  terms_allowlist.tsv
>   chapters/<id>.md  chapters/_terms.md
>   plan48/          архів попереднього плану
> tools/ref-models/radio/   еталонні моделі на Python і їхні зразкові дані
> ```

### 1.3 Journey table for `volume.json`

All ids, titles, minutes and marks are parsed mechanically from the doc (L215-234, L373-397, L410-418, L435-441); titles are verbatim, including the straight apostrophes the doc uses. Group label and layer follow R1.6 (the assignment of the four thematic branches to «Гілки» is the obvious reading, the doc does not spell it out). Order follows R1.7 and L633 («після `raster` читач пішов би в `tv`, `lab-tube`, `sat`, `colour-sound`»); where one parent has several children with no stated order the doc's table order is used (`tank`, `cable`; `fm-depth`, `sdr`: see ambiguity A4).

| Pos | № | id | Group label · layer | `parent` | Title (verbatim) | ≈ хв | Ruler mark | Steps | Doc line |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | `prologue` | «Пролог» · prologue | — | «Камера у дворі, екран на кухні. Що летить між ними?» | 5 | уся дорога | 4 | L215 |
| 2 | 1 | `field` | «Основи» · path | — | «Як гребінець тягне шерстинку, не торкаючись?» | 8 | Основи | 5 | L216 |
| 3 | 2 | `current` | «Основи» · path | — | «Чому біля дроту камери повертається компас?» | 8 | Основи | 5 | L217 |
| 4 | 3 | `wave` | «Основи» · path | — | «Як поле відривається від дроту й летить?» | 9 | Основи | 5 | L218 |
| 5 | — | `antenna-size` | «Інженерні гілки» · branch | `wave` | «Чому антена саме такої довжини?» | [GAP] | [GAP] | 5 | L410 |
| 6 | 4 | `lines` | «Дорога картинки» · path | — | «Як передати цілу картинку одним числом?» | 10 | Камера | 6 | L219 |
| 7 | 5 | `carrier` | «Дорога картинки» · path | — | «Як покласти сигнал на хвилю?» | 9 | Передавач | 5 | L220 |
| 8 | 6 | `air` | «Дорога картинки» · path | — | «Що стається з хвилею дорогою до кухні?» | 9 | Повітря | 5 | L221 |
| 9 | 7 | `select` | «Дорога картинки» · path | — | «Чому приймач відгукується не на всі хвилі одразу?» | 7 | Приймач | 4 | L222 |
| 10 | — | `tank` | «Інженерні гілки» · branch | `select` | «З чого зроблена електрична гойдалка?» | [GAP] | [GAP] | 6 | L411 |
| 11 | — | `cable` | «Інженерні гілки» · branch | `select` | «Чому до антени веде особливий кабель?» | [GAP] | [GAP] | 5 | L412 |
| 12 | 8 | `shift` | «Дорога картинки» · path | — | «Навіщо приймач переносить хвилю на нижчу частоту?» | 10 | Приймач | 6 | L223 |
| 13 | — | `synth` | «Інженерні гілки» · branch | `shift` | «Як приймач тримає опорну частоту?» | [GAP] | [GAP] | 6 | L413 |
| 14 | 9 | `slope` | «Дорога картинки» · path | — | «Як перетворити частоту знову на яскравість?» | 7 | Приймач | 4 | L224 |
| 15 | — | `budget` | «Інженерні гілки» · branch | `slope` | «Скільки хвилі доходить до кухні й скільки її треба?» | [GAP] | [GAP] | 7 | L414 |
| 16 | 10 | `arrow` | «Дорога картинки» · path | — | «Як записати хвилю числами?» | 8 | Приймач | 4 | L225 |
| 17 | 11 | `angle` | «Дорога картинки» · path | — | «Як прочитати частоту з чисел?» | 7 | Приймач | 4 | L226 |
| 18 | — | `fm-depth` | «Інженерні гілки» · branch | `angle` | «Чому хвиля ширша за гуляння своєї частоти?» | [GAP] | [GAP] | 6 | L415 |
| 19 | — | `sdr` | «Інженерні гілки» · branch | `angle` | «Як зробити приймач із самих чисел?» | [GAP] | [GAP] | 6 | L416 |
| 20 | 12 | `raster` | «Дорога картинки» · path | — | «Як із сигналу знову скласти картинку?» | 9 | Екран | 5 | L227 |
| 21 | — | `tv` | «Гілки» · branch | `raster` | «Як працював звичайний телевізор з антеною на даху?» | [GAP] | [GAP] | 8 | L373 |
| 22 | — | `lab-tube` | «Лабораторії» · branch | `raster` | «Чи можна намалювати картинку променем уручну?» | 10 | [GAP] | 4 (tasks, counted) | L441 |
| 23 | — | `sat` | «Гілки» · branch | `raster` | «Як картинка долітає з орбіти в тарілку?» | [GAP] | [GAP] | 6 | L383 |
| 24 | — | `colour-sound` | «Гілки» · branch | `raster` | «Де в сигналі ховаються колір і звук?» | [GAP] | [GAP] | 7 | L397 |
| 25 | — | `build-analog` | «Практикум» (1) · practicum | — | «Практикум. Проведіть картинку крізь подвір'я самі» | 12 | уся дорога | 4 | L228 |
| 26 | — | `lab-bench` | «Лабораторії» · branch | `build-analog` | «Що буде, якщо покрутити кожну ручку лінії?» | 12 | [GAP] | 5 (tasks, counted) | L435 |
| 27 | 13 | `compress` | «Дорога чисел» · path | — | «Чому друга камера не шле всі числа підряд?» | 10 | Камера (вдруге) | 6 | L229 |
| 28 | 14 | `packets` | «Дорога чисел» · path | — | «Як уберегти числа від помилок?» | 7 | Передавач (вдруге) | 4 | L230 |
| 29 | 15 | `points` | «Дорога чисел» · path | — | «Як покласти числа на хвилю?» | 9 | Повітря (вдруге) | 5 | L231 |
| 30 | — | `codes` | «Інженерні гілки» · branch | `points` | «Як код підходить до межі каналу?» | [GAP] | [GAP] | 6 | L417 |
| 31 | 16 | `many` | «Дорога чисел» · path | — | «Навіщо ділити потік між багатьма хвилями?» | 7 | Приймач (вдруге) | 4 | L232 |
| 32 | — | `one-sum` | «Інженерні гілки» · branch | `many` | «Як зробити багато хвиль одним обчисленням?» | [GAP] | [GAP] | 5 | L418 |
| 33 | 17 | `cliff` | «Дорога чисел» · path | — | «Чому одна камера сніжить, а друга раптом завмирає?» | 8 | Екран (вдруге) | 4 | L233 |
| 34 | — | `sat-digital` | «Гілки» · branch | `cliff` | «Чому супутникове телебачення стало цифровим?» | [GAP] | [GAP] | 4 | L391 |
| 35 | — | `build-digital` | «Практикум» (2) · practicum | — | «Практикум. Дві камери на одному подвір'ї» | 10 | уся дорога | 3 | L234 |
| 36 | — | `lab-digital` | «Лабораторії» · branch | `build-digital` | «Де саме обривається цифрова картинка?» | 12 | [GAP] | 4 (tasks, counted) | L437 |
| 37 | — | `lab-yard` | «Лабораторії» · branch | `build-digital` | «Куди на подвір'ї долітає картинка?» | 9 | [GAP] | 4 (tasks, counted) | L439 |

Lab nicknames and placement text (verbatim):

- `lab-bench` — «Стіл сигналу»; дитина практикуму `build-analog`; ≈ 12 хв (L435)
- `lab-digital` — «Цифровий пульт»; дитина практикуму `build-digital`; ≈ 12 хв (L437)
- `lab-yard` — «Подвір'я-пісочниця»; дитина практикуму `build-digital`, після `lab-digital`; ≈ 9 хв (L439)
- `lab-tube` — «Кінескоп на столі»; дитина `raster`, одразу після гілки `tv`, з підписом «після гілки про телевізор»; ≈ 10 хв (L441)

Totals stated by the doc (L236): «92 кроки (пролог 4, сімнадцять глав 81, два практикуми 7), 41 термін (0,51 на крок глави, як у `circuit`), ≈ 2 год 27 хв шляху й 22 хв практикумів»; «Гілки — 13 глав, 77 кроків (тематичні 25, інженерні 52) і 24 власні терміни; разом зі шляхом — 169 кроків і 65 термінів. Лабораторії (§4) — ще 4 необов'язкові глави, 17 завдань, ≈ 43 хв.» Recomputed from the table in this run: steps 4 + 81 + 7 = 92; minutes 5 + 142 = 147 (2 h 27) and 12 + 10 = 22; branch steps 25 + 52 = 77; lab minutes 12 + 12 + 9 + 10 = 43 — all consistent.

**[GAP]** The doc gives no `minutes` for any of the 13 branches (only step counts), no ruler mark (`floor`) for any branch or lab, no group ids, no `axis.label` / `hint`, no floor ids or numeric values, no `order`, no `emblem`, no `seamless`. See ambiguities A3–A6.

### 1.4 Groups (L621-624)

| Order | Label (verbatim) | Layer | Members |
|---|---|---|---|
| 1 | «Пролог» | prologue | `prologue` |
| 2 | «Основи» | path | chapters 1–3: `field`, `current`, `wave` |
| 3 | «Дорога картинки» | path | chapters 4–12: `lines` … `raster` |
| 4 | «Практикум» (після аналогового фіналу) | practicum | `build-analog` |
| 5 | «Дорога чисел» | path | chapters 13–17: `compress` … `cliff` |
| 6 | «Практикум» (після цифрового фіналу) | practicum | `build-digital` |
| 7 | «Гілки» | branch | `tv`, `sat`, `sat-digital`, `colour-sound` |
| 8 | «Інженерні гілки» | branch | `antenna-size`, `tank`, `cable`, `synth`, `budget`, `fm-depth`, `sdr`, `codes`, `one-sum` |
| 9 | «Лабораторії» | branch | `lab-bench`, `lab-digital`, `lab-yard`, `lab-tube` |

[REPO] Layer names the engine accepts: `'prologue' | 'path' | 'branch' | 'practicum'` (`app/src/engine/volume.ts:103-104`); group ids must be unique — `fail('duplicate group id')` (`app/src/engine/volume.ts:282-283`), so the two «Практикум» groups need two different ids.

### 1.5 The map ruler's seven marks

| # | Mark as written at L201 | As written at L629 | Used by |
|---|---|---|---|
| 1 | «уся дорога» | «уся дорога» | prologue and both practicums |
| 2 | «Основи» (підпис «з чого зроблена хвиля») | «основи» | chapters 1–3 |
| 3 | Камера | «камера» | `lines`; `compress` («Камера (вдруге)») |
| 4 | Передавач | «передавач» | `carrier`; `packets` («Передавач (вдруге)») |
| 5 | Повітря | «повітря» | `air`; `points` («Повітря (вдруге)») |
| 6 | Приймач | «приймач» | `select`, `shift`, `slope`, `arrow`, `angle`; `many` («Приймач (вдруге)») |
| 7 | Екран | «екран» | `raster`; `cliff` («Екран (вдруге)») |

L201 verbatim: «Лінійка має сім позначок: «уся дорога» (пролог і практикуми), «Основи» (глави 1–3, підпис «з чого зроблена хвиля») і п'ять станцій — Камера · Передавач · Повітря · Приймач · Екран; глави 13–17 проходять станції вдруге.» Author's call 12 (L843-844): «до «основ» і п'яти станцій додано «уся дорога» — для прологу й практикумів». The two tracks («перша камера» / «друга камера», after `compress/numbers` «аналогова лінія» / «цифрова лінія») are a drawing in the scene (`radio/shared/map`), not part of the ruler (L201, L736).

[REPO] A ruler mark is an `axis.floors[]` entry `{ id, label, value, plain?, namedAt? }` and `journey[].floor` must be one of those ids (`app/src/engine/volume.ts:90-100`, `:307-309`; `docs/VOLUMES.md` §7 table).

### 1.6 Home-screen texts

| `volume.json` field | What the doc fixes |
|---|---|
| `title` / `subtitle` | Only the combined name «Радіо · Від електрона до екрана» (L1, L100); the smoke check expects «головна сторінка — том «Радіо»» (L568). By the `circuit` precedent ([REPO] `app/src/volumes/circuit/volume.json:3-4`: title «Електричний струм», subtitle «Від атома до лампочки») this is title «Радіо», subtitle «Від електрона до екрана». |
| `headline`, `kicker`, `lead`, `emptyNote` | **[GAP]** — not in the doc. |
| what the home shows | «без полиці бібліотеки й кнопки старого тому; вхід — пролог» (L209); map of all chapters «у планах» (L791). |

[REPO] While no chapter is built, a published path volume shows the lobby home (names + `emptyNote`, nothing to start) over the map of planned chapters (`docs/VOLUMES.md:77-82` «A volume without chapters — the lobby», `:199-200`). So in batch 1 the site's home screen shows `emptyNote` if one is given.

### 1.7 Link targets to the main course (L586-595, verbatim; base `nikoskakun.github.io/tech`)

> | Крок тому | Сторінка `nikoskakun.github.io/tech` |
> |---|---|
> | `field/charge` | `#/circuit/charge` — що тримає електрон біля ядра |
> | `field/probe` | `#/electricity/charge-field` — заряд і поле докладно |
> | `current/push` | `#/circuit/battery` — що робить батарейка |
> | `current/flow` | `#/circuit/flow` — що тече в дроті |
> | `current/compass` | `#/electricity/magnetism/oersted` |
> | `current/change` | `#/electricity/magnetism/induction` |
> | `wave/free` | `#/electricity/magnetism/maxwell` |
> | гілка `tv`, крок про промінь і магніт | `#/electricity/magnetism/lorentz` |

Rules (L582-584, L597-600): the engine's «Див. також» knows only internal addresses; the volume adds the button «У курсі про електрику» in `shared/`; it opens a new tab; «Посилання ніколи не обов'язкові: том усе пояснює сам»; «Кнопку ставимо лише для сторінок, які на сайті основного курсу вже є.» Part II §0 (L209) names three of them with the target chapter questions: `field/charge` → «Що тримає електрон біля ядра?», `current/push` → «Що робить батарейка?», `current/flow` → «Що тече в дроті?». Decision 20 (L119): «посилання на них ведуть на `nikoskakun.github.io/tech`».

[REPO] All eight targets exist in this copy after the merge: `app/src/volumes/circuit/chapters/{charge,battery,flow}/index.ts`; steps `oersted`, `induction`, `maxwell`, `lorentz` in `app/src/volumes/electricity/content/generated/magnetism.manifest.json`; chapter `charge-field` in the same directory. The doc's sentence that the three `circuit` links «чекають» (L597-599) is stale — see surprise S4.

### 1.8 Volume documents and the tools that read them

| Document | Doc requirement | [REPO] what the tools demand |
|---|---|---|
| `docs/volumes/radio/VOLUME.md` | «у формі проєкту» (L4) | precedent `docs/volumes/circuit/VOLUME.md` («Статут»: §1 Назва … §8 Загадка тому); not parsed by tools |
| `docs/volumes/radio/PATH.md` | «з повними таблицями кроків» (L791) | precedent `docs/volumes/circuit/PATH.md`: «Карта шляху» + per chapter «Питання з життя», «Що ми вже знаємо», table `id \| Одна думка \| Що робить читач \| Висновок \| Нові терміни \| Докладніше \| Джерело`, «Нитка глави», «Що ми тепер знаємо», «Місток»; not parsed by tools |
| `PATH-ledger.md` / «реєстр» | L4, L791 | precedent `docs/volumes/circuit/PATH-ledger.md`; not parsed by tools |
| `chapters/_terms.md` | L616 | parsed by `tools/content/path_format.py:190-223`: H2 «Терміни шляху» (5 cells: term, forms regex in backticks, step, type «шлях»\|«практикум», card), «Слова лише для «Докладніше»» (3 cells), «Чого на шляху немає» (2 cells); missing file → `_terms.md: missing (…)` (`path_format.py:238-241`) |
| `chapters/<id>.md` | L616 | `path_format.py:12-29`; needed only for built chapters (batch 3) |
| `VISUAL.md` | L4, L791, L811 | precedent `docs/volumes/circuit/VISUAL.md` (§9 «Чек-лист аудитора кадру»); not parsed |
| `PATH-NOTES.md` | L615 | precedent `docs/volumes/circuit/PATH-NOTES.md`; not parsed |
| `terms_allowlist.tsv` | L615, L654-655 | read by `tools/content/terms_check.py:156-169`; TSV `word<TAB>kind<TAB>explanation<TAB>reason`, kinds `abbr \| mark \| name \| symbol`; «A word may be listed only once across both» lists |
| `plan48/` | L617 | — |

### 1.9 [REPO] Platform checks the skeleton meets on its first commit

| Check | Where |
|---|---|
| `defineVolume(identity, spec)` throws on: invalid id; `status` not in `published \| draft \| dev`; unknown `accent`; duplicate group id; journey id invalid or listed twice; unknown `group`; unknown `parent`; `format` not `classic \| path`; unknown group `layer`; a floor with only one of `plain` / `namedAt`; unknown `floor`; `minutes` not positive; axis without `max > min`, `tick > 0`, `majorEvery ≥ 1`; `headline` not `title \| subtitle`. | `app/src/engine/volume.ts:266-316` |
| «`$dir` is a well-formed volume»: `manifest.id` equals the directory; `chapters.ts` exists; title non-empty; headline is the title or the subtitle; `axis.format(axis.min) !== axis.format(axis.max)`; `axis.min ≤ axis.origin ≤ axis.max`. | `app/src/engine/__tests__/volumes.test.ts:34-45` |
| Every built chapter is in `volume.json → journey` with the same `group` and `parent`, and its `axisValue` lies inside the axis range. | `app/src/engine/__tests__/volumes.test.ts:47-64` |
| A non-dev volume has `"@<id>/*": ["./src/volumes/<id>/*"]` in `app/tsconfig.json → paths`. | `app/src/engine/__tests__/volumes.test.ts:66-73` |
| The list of volume directories is hard-coded — see surprise S1. | `app/src/engine/__tests__/volumes.test.ts:29-31` |
| `chapters.ts` is the same file in every volume: `export default import.meta.glob('./chapters/*/index.ts', { eager: true });` | `app/src/volumes/circuit/chapters.ts:6` |
| `volume.ts` precedent: `export default defineVolume(identity, { journey: { axis: { min, max, origin, tick, majorEvery, format, ascending }, layout }, glossary: { scope: 'volume' }, theme: { sky, mood } });` | `app/src/volumes/circuit/volume.ts:17-34` |

---

## 2. Batch 2 requirements

Scope (L792): «спершу око камери додатковим проходом (рішення 24) і його виміри; ланцюг частотної модуляції з каналом і щупом, еталон, тести; фоновий потік і запасний шлях; подвір'я, екран, мініатюра «де ми»; виміри швидкості проти мірила». Owner sees: «звіт із числами; у пісочниці — живий екран, що сніжить за стіною».

### 2.1 Signal model

| # | Requirement | Doc line |
|---|---|---|
| R2.1 | The batch starts with the camera-eye pass and its measurements. | L705, L792 |
| R2.2 | The model is pure TypeScript in `radio/sim/core/`, on typed arrays, without three.js and without access to time or randomness from outside: noise comes from a generator with a given seed; the same code runs in the worker, in the main thread and in tests. | L610, L657-661 |
| R2.3 | Models of one chapter live in `sim/<глава>/`; `sim/core/` is «модель сигналу й полів — чистий TypeScript без three.js, з тестами». | L610-611 |
| R2.4 | Chain 1 (FM, first camera): «рендер «очима камери» (≈ 128 × 96 комірок) → рядки із синхроімпульсами → частота несної → повітря (шум, до трьох променів з огинанням країв, чужі хвилі) → верхня полиця зі схилом і обведенням або числова з парами відліків і кутом → синхроімпульси з власним ритмом рядків → екран». | L193 |
| R2.5 | The receiver chain is the real one and the same for the whole volume: «широкий вхідний фільтр (усі чотири канали й роутер) → «підсилити» → «зсунути» (опорна хвиля нижча за канал) → фільтр каналу (нерухомий, ≈ 20 MHz, на зсунутій частоті) → обмежувач → частотний детектор → складання рядків». | L190, L829-830 |
| R2.6 | The whole band 2400–2483,5 MHz is modelled; foreign signals are synthesised only inside it, plus one strong wave outside it — the phone on the windowsill, ≈ 2,55 GHz; the model's amplifier has a ceiling and chokes on it without the input filter. | L197, L667, L847-848 |
| R2.7 | Module list (names fixed by the doc): `video`, `fm`, `rf`, `channel`, `am`, `digital`, `spectrum`, `probe`, `field` — table 2.2. | L663-673 |
| R2.8 | Reduced screen standard: 128 × 96 cells; frame = 100 lines (96 visible + 4 for the frame sync pulse), no fields; line parts in the real ratio 1,65 : 4,7 : 5,7 : 52; 128 cells per line instead of ≈ 570, so all model frequencies are reduced by the same factor (≈ 4,5); scales and counters show the real numbers. | L512, L675-678 |
| R2.9 | Ratios that must be preserved: line parts; deviation to signal width (гуляння до найшвидших змін сигналу); channel width to channel step; echo delay to channel width; margin to threshold. | L512, L675-677 |
| R2.10 | Yard echo delays (tens of ns) are stretched ≈ 4,5×; far reflections (µs) are not; the rule is a property of the ray, not of the chain: reflections within the yard (up to ≈ 100 ns) are stretched, far ones (from ≈ 0,3 µs) are not. | L512 |
| R2.11 | Microwave rhythm (half of each mains period, 10 ms of 20) and router packets are tied to the model's frame duration; the microwave band is about half the screen height. | L512 |
| R2.12 | Noise has two sources: main at the antenna (warm surroundings + the first amplifier's own noise); a second, weak one after the amplifier (noise of later blocks), ≈ 30 dB below the amplified antenna noise at full gain; the limiter has a minimum swing it works with. | L485, L510 |
| R2.13 | Channel model: attenuation with distance, walls, edge diffraction, up to three rays with delay; household interference — router (short wide bursts), microwave (sweeps in frequency, switches in step with the mains), one strong out-of-band wave (phone). A baking tray acts only right against the antenna. | L668, L484 |
| R2.14 | Garage gate: only the open leaf reflects toward the house; extra path 10 m, delay 33 ns, dips every 30 MHz, dead spots every 6 cm. | L506 |
| R2.15 | Receive side of `video`: sync-pulse search, own line rhythm with adjustment (the monitor keeps its own line rhythm, sync pulses only correct it), raster assembly. | L665, L328, L494 |
| R2.16 | `probe`: tap from any socket of the stand — time strip, frequency scale, rotating arrow; `spectrum`: fast Fourier transform for the frequency scale. | L671-672 |
| R2.17 | Angle detector formula: `angle(x[n]·conj(x[n−1]))·fs/2π`; white +72° per sample, sync pulse ≈ −77°, limit ±180° = ±10 MHz at 20 million pairs per second; smoothing filter 5,5 MHz. | L320-321, L509 |
| R2.18 | Ghosting does not come out of the FM chain: the same reflection gives dead spots and ripples (ghosting only in `tv`, batch 9). | L195, L487, L827-828 |
| R2.19 | All numbers of Part II §7 (pasted in 2.9) are the model's parameters; those marked «попередньо» are confirmed by the oracle in this batch for the first camera's line. | L180-181, L504 |

### 2.2 Modules (L663-673, verbatim) and the batch that first needs each

> | Модуль | Що робить |
> |---|---|
> | `video` | зменшений стандарт: кадр → рядки із синхроімпульсами (відношення частин рядка як у справжньому); на приймальному боці — пошук синхроімпульсів, власний ритм рядків із підстроюванням, складання растра |
> | `fm` | частотний модулятор; обмежувач; детектор на схилі розстроєного резонансного горба; детектор кута між сусідніми відліками; фільтр відеосигналу; для гілок — ширше гуляння частоти (`sat`), допоміжні несні кольору й звуку (`colour-sound`) |
> | `rf` | увесь діапазон 2400–2483,5 MHz (чотири канали) як пари чисел: вхідний фільтр, підсилювач зі стелею, зсув, фільтр каналу, проріджування, шум приймача |
> | `channel` | послаблення з відстанню, стіни, огинання країв, до трьох променів із запізненням; побутові завади — роутер (короткі широкі сплески), піч (ковзає частотою, вмикається в такт мережі) й одна сильна хвиля поза діапазоном (телефон); для гілки `sat` — дощ замість стін |
> | `am` | амплітудний ланцюг для гілки `tv`: частково зрізана бічна смуга, детектор обвідної, підстроювання підсилення за синхроімпульсами, растр кінескопа |
> | `digital` | просте стиснення (повні кадри й зміни, грубіший запис дрібниць); пакети з контрольним числом; код із семи бітів для навчання і згортковий код із перемішуванням для лінії; сузір'я з 4, 16, 64 точок; 64 піднесні з повтором кінця символу; відомі символи, вирівнювання, декодування; варіант на одній несній (`many/smear`, `sat-digital`) |
> | `spectrum` | швидке перетворення Фур'є для шкали частот |
> | `probe` | відведення з будь-якого гнізда стенда: стрічка в часі, шкала частот, обертова стрілка |
> | `field` | поля глав 1–3: заряд, петля біля дроту, злам поля від смикнутого заряду, прутик |

| Module | First needed (by the doc's batch table L789-801) |
|---|---|
| `video`, `fm` (modulator, limiter, slope detector, video filter), `rf`, `channel` (distance, walls, diffraction, rays), `probe` | batch 2 («ланцюг частотної модуляції з каналом і щупом») |
| `spectrum` | the frequency scale appears with `wave/rhythm` (L205) — batch 4; needed in batch 2 only if `probe`'s frequency-scale view is built there (ambiguity A8) |
| `fm` angle detector, numeric shelf | chapters `arrow`, `angle` — batch 7 (ambiguity A8) |
| `channel` interference: router, microwave | `air/crowd` — batch 5 (ambiguity A8) |
| `field` | chapters 1–3 — batch 4 |
| `digital` | batch 8 |
| `am`, `fm` variants for `sat` / `colour-sound`, rain in `channel` | batch 9 |

### 2.3 Python oracle and tests

| # | Requirement | Doc line |
|---|---|---|
| R2.20 | For each chain there is a Python model (numpy, scipy) in `tools/ref-models/radio/`; it writes sample data and the TypeScript tests compare their result with it. | L618, L681-682 |
| R2.21 | The angle detector is checked against the algorithm of the owner's working receiver, reproduced from its publicly known formula; no code and no recordings are taken from there; only that formula and the publicly known numbers of the standard come from it. | L118 (decision 19), L682-684 |
| R2.22 | Channel grid, permitted transmitter power and latency of digital cameras are checked against open sources. | L520, L684-685 |
| R2.23 | A separate group of tests proves the phenomena are not drawn («Тести на «виходить із моделі»») — list below. | L687-695 |

L689-695 verbatim, with the batch each test can first run in:

| Test (verbatim) | Batch |
|---|---|
| «крива «чистота картинки проти напруженості поля» має злам біля межі частотної модуляції» | 2 |
| «нижче певного рівня частка загублених синхроімпульсів різко росте, і рядки рвуться» | 2 |
| «у мертвій точці перемикання каналу повертає картинку» | 2 |
| «сходинки рівня (частина II, §7) збігаються з розрахунком» | 2 |
| «цифрова лінія переходить від «жодного втраченого пакета» до «втрачені всі» в межах 1–2 dB» | 8 |
| «частка помилок чотириточкового сузір'я без коду збігається з теорією» | 8 |
| «у ланцюзі `tv` запізнення відбиття на мікросекунду дає двійника на 2 % ширини екрана» | 9 |

### 2.4 Worker, fallback, screen (L708-718, verbatim)

> **Фоновий потік.** Модель живе у фоновому потоці (Web Worker). Основний потік надсилає стан сцени
> (маршрут монітора, ворота, канал, піч і роутер, налаштування блоків, сила передавача) і кадр камери;
> назад приходять кадр екрана, відведення для щупа й покази приладів. Якщо модель не встигає, вона бере
> найсвіжіший стан і пропускає старі.
>
> **Детермінований запасний шлях.** У режимі зупиненого кадру для перевірки, у тестах і там, де фонового
> потоку немає, та сама модель рахує потрібний кадр синхронно, з тим самим зерном шуму. Знімки повторюються
> біт у біт.
>
> **Екран.** Текстура, яку модель оновлює кожним своїм кадром. Режим «повільний екран» показує заповнення
> рядків. Якщо кадрів моделі менше, ніж кадрів сцени, це чесно підписано.

| # | Requirement | Doc line |
|---|---|---|
| R2.24 | The worker bridge lives in `radio/shared/link` («зв'язок сцени з моделлю: стан, фоновий потік, запасний синхронний шлях»). | L732, L752 |
| R2.25 | Main thread → worker: scene state (monitor route, gate, channel, microwave and router, block settings, transmitter power) and the camera frame; worker → main: screen frame, probe taps, instrument readings. | L708-710 |
| R2.26 | If the model cannot keep up it takes the freshest state and skips the old ones. | L710-711 |
| R2.27 | Deterministic fallback: in frozen-frame mode for checks, in tests and where there is no worker the same model computes the needed frame synchronously with the same noise seed; snapshots repeat bit for bit. | L713-715 |
| R2.28 | The screen is a texture the model updates with each of its frames; mode «повільний екран» shows the filling of lines; if there are fewer model frames than scene frames this is honestly captioned. | L717-718 |
| R2.29 | Message format of the worker is left to the builder. | L812-813 |

### 2.5 Speed bar

| # | Requirement | Doc line |
|---|---|---|
| R2.30 | Estimate: one frame of the reduced standard is hundreds of thousands of number pairs, tens of millions of operations; 10–25 model frames per second on a computer, fewer on a phone; exact numbers are taken in batch 2. | L720-722 |
| R2.31 | Bar (author's call 15): at least 10 model frames per second for one chain with the whole band on an ordinary computer, at least 4 on a phone — estimated here with a fourfold CPU slowdown; the real phone is measured by the owner at the pilot. | L722-724, L849-850 |
| R2.32 | When two chains are live each may compute half as often. | L724-725 |
| R2.33 | Below the bar: first one channel instead of the band in steps without neighbours and interference, and only if that is not enough — WebAssembly. | L725-726, L164 |
| R2.34 | On a phone the screen updates less often, with an honest caption («на телефоні — менше кадрів моделі з чесним підписом»). | L163, L517 |

### 2.6 Camera-eye extra render pass

L699-706 verbatim:

> **Око камери.** Друга камера сцени стоїть на місці камери у дворі й малює подвір'я в маленьку текстуру;
> раз на кадр моделі з неї читається яскравість. Тому гойднута хвіртка, кіт і картка перед об'єктивом
> потрапляють на екран без жодного окремого коду. Рушій дає главі рендерер і сцену, але його правила
> забороняють главі самій викликати малювання (`docs/ENGINE_API.md`, §4: «never call `render()`»). Власник
> дозволив томові виняток (рішення 24): один додатковий прохід у власну текстуру 128 × 96 усередині
> `radio/shared/screen`, зі збереженням і відновленням стану рендерера та з окремим обліком у перевірці
> швидкодії. Друга черга починається з цього проходу та його вимірів. Якщо він не вкладеться в межі
> перевірки кадру, запасний шлях — маленький програмний малювальник того самого виду на процесорі.

| # | Requirement | Doc line |
|---|---|---|
| R2.35 | Exactly one extra renderer pass into the volume's own 128 × 96 texture, inside `radio/shared/screen` — the allowed exception to «глава не викликає малювання» / «never call `render()`». | L123 (decision 24), L702-704, L863-864 |
| R2.36 | Renderer state is saved and restored; the pass is counted separately in the performance check. | L123, L704-705 |
| R2.37 | Luminance is read from the texture once per model frame. | L700 |
| R2.38 | A second scene camera stands at the place of the yard camera; gate, cat and card in front of the lens reach the screen with no separate code. | L699-701 |
| R2.39 | Fallback if the pass does not fit the frame-check limits: a small software rasteriser of the same view on the CPU. | L705-706 |
| R2.40 | How exactly to save/restore renderer state and how to count the extra pass in the performance check is left to the builder. | L814-815 |

[REPO] The rule the exception is from: `docs/ENGINE_API.md:159` — `| `renderer` | capabilities / render targets only; never call `render()` |` (section «## 4. Scene & `ChapterContext`», `docs/ENGINE_API.md:126`).

### 2.7 Shared world `shared/` (Part III §6, L745-762, verbatim)

> Один світ на весь том, як стенд у `circuit`. Глави не будують власних світів — вони ставлять камеру,
> відкривають кришки й показують прилади.
>
> | Частина | Що це |
> |---|---|
> | `yard` | діорама: стовп із двома камерами, хвіртка, паркан із котом, сарай, залізний гараж із воротами, гойдалка, велосипед із фарою, ліхтар, цегляний будинок у розрізі (кухня, коридор, дальня кімната, льох), монітор на підвіконні, піч і телефон, сусідське вікно з роутером; сутінки як числовий параметр; маршрут монітора; готові ракурси |
> | `stand` | стенди камери й монітора: полиці блоків із кришками та гніздами — верхня (справжній ланцюг приймача) і числова (у главах 13–17 на ній стоять блоки цифрової лінії) |
> | `link` | зв'язок сцени з моделлю: стан, фоновий потік, запасний синхронний шлях |
> | `screen` | екран монітора, око камери, «повільний екран», бігунець і його двійник |
> | `probe` | щуп із віконцем і трьома виглядами |
> | `scale` | шкала частот із вогником і горбами; стовпчик напруженості поля із зернистим дном |
> | `arrow` | обертова стрілка, дві тіні, площина сузір'я |
> | `radiovision` | поля й хвилі: електричне поле — `amber`, магнітне — `magenta`, несна — `sky`, тіні — `sky` і `violet`, біти — `lime`, шум — зерно `steel` |
> | `map` | мапа дороги з двома доріжками |
> | `whereami` | мініатюра «де ми»: малий план подвір'я й дому з повзунком маршруту монітора, повзунком «посунути антену» й позначкою глибини (подвір'я · стенд · під лупою); на телефоні — в доку |
> | `models`, `links` | предмети світу; кнопка зовнішнього посилання |
>
> Жодної логіки кроків у `shared/` немає: лише світ, прилади та їхні числові параметри.

| # | Requirement | Doc line |
|---|---|---|
| R2.41 | Parts named for batch 2: «подвір'я, екран, мініатюра «де ми»» = `yard`, `screen`, `whereami`, plus `link` («фоновий потік і запасний шлях»). | L792 |
| R2.42 | `yard` contents (L750): post with two cameras, gate (хвіртка), fence with the cat, shed, iron garage with gates, swing, bicycle with a headlight, lantern, brick house in section (kitchen, corridor, far room, cellar), monitor on the windowsill, microwave and phone, neighbour's window with the router; dusk as a numeric parameter; monitor route; ready camera angles. | L750 |
| R2.43 | World details from Part II §0 (L188): the second camera is switched off until chapter 13; garage gates are closed by default; the camera is fixed and looks at the cat on the fence, the gate (хвіртка) is also in view: pickets — fine detail, shed wall — white, dark nook — black; it is always the monitor that is carried; dusk deepens toward the finale; the lantern switches on at dusk and keeps the camera picture contrasty; both screens are black-and-white. | L188 |
| R2.44 | `screen`: monitor screen, camera eye, «повільний екран», the runner and its twin. | L753 |
| R2.45 | Permanent caption under the screen: «картинку обчислено · зменшено» (a scene caption, not a step mark). | L478, L678-679, L739 |
| R2.46 | `whereami`: small plan of the yard and house with the monitor-route slider, the slider «посунути антену» and a depth mark (подвір'я · стенд · під лупою); on a phone it sits in the dock; it is the volume's own device, not the engine's «драбина поверхів». | L201, L759, L853-854 |
| R2.47 | Monitor route is one slider «подвір'я → кухня → коридор → дальня кімната → льох» on the «де ми» miniature; the yard stretch is used only by `wave/catch` and `air/spread`; second slider «посунути антену», ±15 см in place. | L203 |
| R2.48 | Transmitter power is a continuous slider from 10 to 0,1 mW with marks 10, 1 and 0,1. | L203 |
| R2.49 | No step logic in `shared/`: only the world, the devices and their numeric parameters; chapters do not build their own worlds. | L745-746, L762 |
| R2.50 | Object models (camera, monitor, antenna, dish, kinescope, cat) live in `radio/shared/models`. | L741, L760 |
| R2.51 | New parts live in the volume's `shared/`; moving them to the platform is later, in separate commits, decided by the owner. | L115 (decision 16) |

Where each engine gap lives (L730-741, verbatim):

> | Бракує | Де живе зараз | Згодом |
> |---|---|---|
> | Фоновий потік для моделі | `radio/shared/link` | пропозиція до платформи |
> | Екран із живим растром, око камери | `radio/shared/screen` | пропозиція до платформи |
> | Щуп із трьома виглядами; шкала частот; обертова стрілка й сузір'я | `radio/shared/probe`, `scale`, `arrow` (де можна — на основі наявних осцилографа, стовпчиків спектра й стрілок із `fx/signals`) | пропозиція до платформи |
> | Хвиля, що летить; «радіозір» | `radio/shared/radiovision` (чотири вигляди хвилі з візуальної мови попереднього плану: стрічка, зріз поля, фронти, промені) | пропозиція до платформи |
> | Мапа з двома доріжками | лінійка рушія із сімома позначками; дві доріжки — малюнок у сцені (`radio/shared/map`) | — |
> | Шар лабораторій | глави шару гілок із назвами-питаннями: такі глави рушій уже вважає необов'язковими | окремий шар у форматі |
> | Зовнішні посилання | кнопка в `radio/shared/links` | зовнішні адреси в «Див. також» |
> | Позначка чесності для обчисленого екрана | перелік позначок в інструментах фіксований, тому на кроках з екраном стоїть «спрощена модель», а під самим екраном — постійний підпис сцени «картинку обчислено · зменшено» | окрема позначка в загальному переліку |
> | Довільний звук (щоб почути звукову несну) | проба в дев'ятій черзі: маленький програвач обчисленої петлі в `radio/shared/sound`, який слухається налаштування звуку рушія; якщо без правки платформи не виходить — звук лише видно на стрічці | програвання обчисленого звуку в платформі |
> | Моделі предметів: камера, монітор, антена, тарілка, кінескоп, кіт | `radio/shared/models` | до спільного набору предметів |

### 2.8 What is measured in batch 2 and which «попередньо» numbers get confirmed

| What | Doc line |
|---|---|
| Cost of the camera-eye pass (first task of the batch); fallback to a CPU rasteriser if it does not fit the frame check. | L705-706, L792 |
| Model speed against the bar: ≥ 10 model frames/s on a computer, ≥ 4 with a fourfold CPU slowdown (one chain, whole band). | L722-724 |
| «Числа з позначкою «попередньо» підтверджує еталонна модель: для лінії першої камери — у другій черзі робіт, межі цифрової лінії — у восьмій.» | L180-181 |
| Level steps: +10 dBm → подвір'я −54 → кухня −62 → коридор −70 → дальня кімната −78 → льох −88 dBm; threshold of the cheap monitor ≈ −80 dBm; dead spots up to 10 dB lower (one reflection with 10 extra metres gives at most 9,5 dB). | L203, L510 |
| Exact pair of the frequency deviation: sync ≈ −4,3 MHz, black ≈ −1,8, dark grey 0, white ≈ +4,0 MHz («у правилі ширини — 8,4; точна пара — попередньо»). | L508 |
| Expected picture by place: «подвір'я й кухня чисті, коридор — ледь зерно, дальня кімната — зерно з першими іскрами, льох — сніг»; a dead spot is visible on screen from the corridor onward or at 1 mW. | L203 |
| Correction rule: «Якщо оракул покаже дальню кімнату чистою чи кухню зернистою — пересуваємо стіни діорами, а не числа.» | L518 |
| The band is not changed after batch 2 («після другої черги його не міняємо»). | L520 |
| Deliverable: a report with numbers and, in a sandbox, a live screen that snows behind the wall. | L792 |

### 2.9 Numbers of the model — Part II §7 «Числа моделі» (heading L502, text L504-512, verbatim)

In the doc this section is a list of seven bullets, not a table; it is pasted whole.

> Попередні числа підтверджує оракул моделі.
>
> - **Частоти й канали.** Сітка 2414 / 2432 / 2450 / 2468 MHz (крок 18 MHz, сусідні перекриваються краями); вхідний фільтр 2400–2483,5 MHz; поза ним — хвиля телефона ≈ 2,55 GHz. Перша камера — на третьому каналі, друга типово на першому (2414 MHz), за два від першої; роутер — горб ≈ 20 MHz довкола 2437 MHz: накриває другий канал і нижній край третього (2440–2447 MHz, 7 MHz із 20), перший і четвертий від нього вільні; піч блукає між 2450 і 2470 MHz: з піччю без роутера чисті перший і другий канали, з роутером — лише перший, «на два вбік». Опорна хвиля нижча за канал; після зсуву — 35 MHz (насправді 70 або 480); фільтр каналу ≈ 20 MHz. Прутик 6 см, між гребенями 12,5 см. Ворота (у бік дому відбиває лише відчинена стулка): зайва дорога 10 м, запізнення 33 ns, провали що 30 MHz, мертві точки що 6 см.
> - **Рядок і кадр (справжні).** 64 µs = 1,65 + 4,7 (синхроімпульс) + 5,7 (поличка) + 52 (видима частина); 625 рядків, 25 кадрів, 50 півкадрів по 288 видимих; 15 625 рядків за секунду.
> - **Гуляння частоти й ширина каналу.** Синхроімпульс ≈ −4,3 MHz, чорне ≈ −1,8, темно-сіре — 0, біле ≈ +4,0 MHz від середини каналу; разом трохи більш як 8 MHz (у правилі ширини — 8,4; точна пара — попередньо). Найшвидші зміни сигналу — 5,5 MHz. Ширина ≈ 8,4 + 2 · 5,5 ≈ 19 MHz.
> - **Темпи відліків.** Одна справжня хвиля на 35 MHz (25–45 MHz): понад 90, у моделі ≈ 100 мільйонів відліків за секунду — лише показ `arrow/measure`. Після зсуву до нуля — 20 мільйонів пар за секунду: біле +72° за відлік, синхроімпульс ≈ −77°, межа ±180° = ±10 MHz. Згладжування — 5,5 MHz. З однією тінню блок «кут» читає лише темп тіні (як часто вона проходить нуль), без напрямку.
> - **Сходинки рівня (попередньо).** +10 dBm на передавачі → подвір'я −54 → кухня −62 → коридор −70 → дальня кімната −78 → льох −88 dBm; мертві точки — до 10 dB нижче (одне відбиття із зайвими 10 м дає щонайбільше 9,5 dB), на 10–20 dB — лише де стіна послабила пряму хвилю більше, ніж відбиту; сила передавача 1 і 0,1 mW опускає все на 10 і 20 dB. Шум ≈ −101 dBm у фільтрі каналу моделі (20 MHz); справжні модулі мають фільтр до 27 MHz (−100 dBm), бо несуть ще й звук. З власним шумом дешевого модуля 8–10 dB і межею частотної модуляції ще на ≈ 10 dB вище — ≈ −80 dBm. Шум дальших блоків — на ≈ 30 dB нижчий за підсилений шум антени при повному підсиленні; обмежувач має найменший розмах, із яким працює.
> - **Цифрова лінія.** 64 піднесні з кроком 312,5 kHz, із них зайнято 52 (48 із числами, 4 з відомими символами; середня й крайні порожні), тому ширина ≈ 17, а не 20 MHz; символ 3,2 µs + запас 0,8 µs, заповнений повтором кінця; сузір'я 4 / 16 / 64 точки; згортковий код із перемішуванням, корисних бітів 1/2, 2/3 або 3/4; 12–54 Mbit/s; повний кадр раз на секунду. Межі (попередньо): 4 точки з половиною перевірних бітів ≈ −86 dBm, 16 точок — від −81 до −77, 64 точки ≈ −71; обрив — 1–2 dB. Типовий режим другої камери — 4 точки, половина перевірних бітів (межа ≈ −86 dBm).
> - **Зменшений стандарт екрана.** 128 × 96 комірок; кадр — 100 рядків (96 видимих і 4 на кадровий синхроімпульс), без півкадрів; частини рядка у справжньому відношенні 1,65 : 4,7 : 5,7 : 52. У рядку 128 комірок замість ≈ 570, тому всі частоти моделі зменшено в те саме число разів (≈ 4,5); шкали й лічильники показують справжні числа. Запізнення відлуння подвір'я (десятки наносекунд) розтягнуто в ≈ 4,5 раза — збережено його відношення до ширини каналу. Далеких відбиттів (мікросекунди: `tv/ghost`, `lab-tube`, «далека стіна» в `lab-bench`) не розтягуємо: 1 µs лишається 2 % ширини екрана. Правило — властивість променя, а не ланцюга: відбиття в межах подвір'я (до ≈ 100 ns) розтягуємо, далекі (від ≈ 0,3 µs) — ні; тому ручка відбиття в `lab-bench` має два діапазони, «ворота» й «далека стіна», без плавного переходу між ними. Ритм печі (шле половину кожного періоду мережі, 10 ms із 20, — звідси смуга, а не суцільний сніг) й пакети роутера прив'язано до тривалості кадру моделі: смуга печі — близько половини висоти екрана. Цифрову лінію зменшено інакше: у кадрі 128 × 96 комірок замість 1280 × 720, тобто в 75 разів менше, тож і символів на кадр модель дає в 75 разів менше — ≈ 133 замість 10 000 (6,4–28,8 тисячі бітів на кадр проти 98 тисяч сирих): без стиснення картинка не вміщається й у моделі. Ширина каналу, 64 піднесні, запас і запізнення відлуння в `lab-digital` лишаються в спільному масштабі 4,5. Збережено відношення: гуляння до найшвидших змін сигналу, запізнення відлуння до ширини каналу, запас до межі, сирий потік до місткості каналу (184 до 12–54 Mbit/s).

### 2.10 Supporting text of Part II §0 that the batch-2 world and model must satisfy (verbatim)

World and hero (L188):

> **Світ і герой.** Одне вечірнє подвір'я-діорама: стовп біля хвіртки з двома камерами (друга до глави 13 вимкнена), паркан, сарай, залізний гараж із воротами (типово зачинені), гойдалка, велосипед із фарою, ліхтар над парканом; цегляний будинок у розрізі — кухня, коридор, дальня кімната, льох; на підвіконні монітор, поруч мікрохвильова піч і телефон; за парканом вікно сусіда з роутером. Камера нерухома й дивиться на кота на паркані, хвіртка теж у полі зору: штахети — дрібні деталі, стіна сараю — біле, темний закуток — чорне. Переносимо завжди монітор: картинка та сама, змінюється лише дорога. Лінія — 2,4 GHz, чотири канали. Оператор літає тільки вздовж дороги картинки або крізь лупу. Сутінки густішають до фіналу, коли екран стає головним світлом кухні; ліхтар вмикається в сутінках і тримає картинку камери контрастною до ночі. Обидва екрани чорно-білі; колір — лише в гілці `colour-sound`.

Screen rule (L190):

> **Правило екрана.** Екран показує рівно те, що видала модель лінії в поточному стані сцени. Сповільнені й ручні покази (бігунець пальцем, «повільний екран», сповільнена хвиля, «відліків за секунду») — лупа часу над лінією, яка тим часом біжить зі справжньою швидкістю; екрана вони не змінюють — його змінюють лише ручки самої лінії. У главах 0–6 монітор закритий; ззовні в нього одна ручка, «довжина рядка» (лише `lines/knit` і `lab-bench`). Перемикач каналу один на пару: монітор перемикається разом із камерою. Цей зв'язок розімкнено лише там, де опорну хвилю веде сам читач: у `shift/difference`, у `shift/fixed` (тут він уперше сам переводить монітор на інший канал) і в несправності `build-analog/fault`. У главі 4 на стенд розкладається камера, у главі 7 — монітор: блоки стоять на полиці, вихід кожного блока — гніздо для щупа. Верхня полиця — справжній ланцюг, той самий на весь том: широкий вхідний фільтр (усі чотири канали й роутер) → «підсилити» → «зсунути» (опорна хвиля нижча за канал) → фільтр каналу (нерухомий, ≈ 20 MHz, на зсунутій частоті) → обмежувач → частотний детектор → складання рядків. Непояснені блоки працюють під кришками; кришку й напис відкриває своя глава. З глави `arrow` стенд має другу, числову полицю. Вона відгалужується від гнізда після «підсилити» й має власні «зсунути» та фільтр каналу (під кришками — їх пояснила глава 8), далі два зсуви до нуля → «оцифрувати» → «кут» під кришкою (її знімає `angle`); обмежувача на ній немає. У главах 10–12 її опорна хвиля стоїть на каналі першої камери, і перемикач «схил / кут» вибирає, яка полиця живить екран. У главах 13–16 її опорна хвиля — на каналі другої камери, після «оцифрувати» стають блоки цифрової лінії, картинка — на малому екрані цієї полиці; великий екран далі живить верхня полиця з першою камерою (перемикача «схил / кут» на цей час немає). У `cliff` числова полиця дістає власні антену, вхідний фільтр і «підсилити» й складається в другий монітор на підвіконні: обидві полиці живі водночас, від антени до екрана.

Honest chain (L192-197):

> **Чесний ланцюг** — три ланцюги, кожен рахується відлік за відліком у фоновому потоці.
> 1. *Частотна модуляція* (перша камера): рендер «очима камери» (≈ 128 × 96 комірок) → рядки із синхроімпульсами → частота несної → повітря (шум, до трьох променів з огинанням країв, чужі хвилі) → верхня полиця зі схилом і обведенням або числова з парами відліків і кутом → синхроімпульси з власним ритмом рядків → екран.
> 2. *Цифровий* (друга камера): той самий рендер → стиснення → пакети → код із перемішуванням → сузір'я → 64 піднесні із запасом-повтором → те саме повітря → вхідні блоки числової полиці → початок пакета й різниця опорних хвиль за відомими символами → вирівнювання → найближча точка → виправлення → кадр.
> 3. *Амплітудний* (лише гілка `tv` та її лабораторія `lab-tube`): рядки → розмах несної (яскравіше — менший розмах, синхроімпульс — найбільший) → майже зрізана бічна смуга → повітря з далеким відбиттям → ті самі блоки вибору каналу → фільтр зі схилом на несній → автоматичне регулювання підсилення → обведення верхівок → кінескоп. Двоїння виходить із моделі саме тут — так виконано рішення 11; на лінії камери те саме відбиття чесно дає мертві точки й брижі.
>
> Змодельовано весь діапазон 2400–2483,5 MHz; чуже синтезується лише в ньому, плюс одна сильна хвиля поза ним — телефон на підвіконні, ≈ 2,55 GHz: підсилювач моделі має стелю й без вхідного фільтра захлинається нею (спробувати це можна в `lab-bench`).

The one honest path to snow (L203):

> **Єдиний чесний шлях до снігу.** Сходинки (попередні; передавач 10 mW): подвір'я за 20 м ≈ −54 dBm · кухня за цегляною стіною ≈ −62 · коридор ≈ −70 · дальня кімната ≈ −78 · льох або за залізним гаражем ≈ −88; межа дешевого монітора ≈ −80. Мертві точки — до 10 dB нижче там, де пряма й відбита хвилі пройшли крізь ті самі стіни (одне відбиття із зайвими 10 м дає щонайбільше 9,5 dB), і на 10–20 dB лише там, де стіна послабила пряму хвилю більше, ніж відбиту; на екрані мертву точку видно від коридору й далі або з силою передавача 1 mW. Тож подвір'я й кухня чисті, коридор — ледь зерно, дальня кімната — зерно з першими іскрами, льох — сніг. Маршрут «кухня → коридор → дальня кімната → льох» — у кожному кроці, що відносить монітор (`prologue/between`, `slope/snow`, `cliff/side`, `build-digital/reach`). Монітор носимо одним повзунком маршруту «подвір'я → кухня → коридор → дальня кімната → льох» на мініатюрі «де ми»; відрізок подвір'ям беруть лише `wave/catch` і `air/spread`, а в `build-analog/chain` монітор уже стоїть біля паркану. Коли монітор розкладено на стенд, стенд лишається в кадрі, а дім їде за ним. Для мертвих точок є другий повзунок — «посунути антену», ±15 см на місці. Друга чесна ручка — сила передавача: суцільний повзунок від 10 до 0,1 mW з мітками 10, 1 і 0,1, у дозволених межах (`air/noise`, `raster/lost`, `angle/noise`, `many/hole`, `cliff/why`, лабораторії). Інші кроки беруть двері, стіну, деко впритул до антени, мертву точку.

Always alive / phone rules (L205) and companions (L207):

> **Завжди живе:** кіт; екран із порахованою картинкою; стрічка щупа. Зі своїм терміном з'являються шкала частот із вогником (`wave/rhythm`), стовпчик «напруженість поля біля антени» (`air/spread`), його зернисте дно (`air/noise`). «Радіозір» (E — `amber`, B — `magenta`, несна — `sky`, тіні — `sky`/`violet`, біти — `lime`, шум — зерно `steel`) — вільний перемикач, на телефоні типово вимкнений; кроки, де відкриття — сама картина поля, вмикають його самі на будь-якому рівні якості (менше гребенів, та сама картина). Шкала частот має два масштаби, які перемикає сам крок: увесь діапазон і один канал (±10 MHz); у `shift/difference` вона одним рухом переходить до 0–100 MHz. На телефоні в кадрі водночас не більш як чотири блоки однієї полиці, полиця гортається вздовж дороги картинки; гніздо — це вихід блока: торкаємося блока, окремої цілі немає. У сцені лишаються екран і стрічка; шкала частот, стовпчик і перемикачі — в доку. Крок називає одне місце, куди дивитися; друге показує вставка.
>
> **Супутники.** **Щуп** із віконцем — як лупа в `circuit`: де торкнулися, там видно «одне число». Стрічка в часі є від прологу: на металі щуп показує її, у повітрі (глави 1–3) — вказівник поля, а від `current/compass` два вказівники (E — `amber`, B — `magenta`). Шкала частот із вогником — від `wave/rhythm`, віконце щупа на ній — від `carrier/channel`, обертова стрілка — від `arrow/shadow`. **Два бігунці** — цятка, що оббігає картинку в камері, та її двійник на екрані: мірило того, що кінці йдуть у ногу. **Біла цятка на лобі кота** — її ведемо крізь обидві лінії (`raster/story`, `cliff/story`).

---

## 3. Batch 3 requirements (pilot = prologue + chapter `lines`)

Scope (L793): «пролог і глава `lines`, доведені до еталона; паралельно — проба найкрутішої сходинки шляху (глава `arrow`) у пісочниці, без показу на сайті». Owner sees: «**показ і рішення власника: чи це еталон**».

### 3.1 Why these two (Part II §9 «Пілотна глава», heading L525, text L527-531, verbatim)

> **`lines` — «Як передати цілу картинку одним числом?»**, разом із прологом як її дверима (так `circuit` будував пролог і `wire`).
>
> - Пролог змушує зробити три речі, які бере кожна дальша глава: діораму, повний ланцюг частотної модуляції в закритому моніторі й живий екран зі щупом. Він знімає головний ризик платформи — фоновий потік і другий рендер — і доводить на телефоні, що сніг виходить із моделі: `prologue/between` уже йде чесним шляхом до льоху.
> - `lines` — перша глава, де кожен крок крутить нутрощі моделі: не та довжина рядка скошує кота, блок синхроімпульсів виймають і вставляють, у сигналі знаходять стіну й цятку. Читач дістає першу третину відповіді на загадку.
> - Обидва супутники — щуп і бігунці — проходять тут перевірку в одному світі. Глави 1–3 пілотом не беремо: вони не торкаються моделі; главу `arrow` варто паралельно прототипувати в пісочниці.

### 3.2 Prologue

Journey row (L215): id `prologue`, title «Камера у дворі, екран на кухні. Що летить між ними?», mark «уся дорога», 4 steps, new terms «—», ≈ 5 хв, «Без цієї глави не пояснити»: «загадку й мапу».

Heading line (L244): «**Пролог** (термінів і «Докладніше» немає; кажемо «прутик» і «число»)».

Notation of the doc (L242): «Запис: `id` — думка → дія й відкриття → Д: «Докладніше».» The doc gives one combined cell «дія й відкриття»; it gives no separate «Ціль» and no separate «Висновок».

| Step id | Думка (idea) | Дія й відкриття (what the reader does and discovers) | Ціль (goal) | Висновок (takeaway) | Нові терміни | «Докладніше» | Doc line |
|---|---|---|---|---|---|---|---|
| `prologue/watch` | Кіт іде парканом — і тієї ж миті екраном у кухні. | Увімкнути монітор, гойднути хвіртку: екран повторює. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | — (the prologue has no «Докладніше», L244) | L245 |
| `prologue/between` | Дроту немає, але щось летить: його можна заступити. | Притулити деко впритул до прутика — зерно; понести монітор у льох — сніг. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | — (the prologue has no «Докладніше», L244) | L246 |
| `prologue/one-number` | Прутик монітора щомиті віддає одне число, а на екрані — ціла картинка. | Торкнутися щупом прутика, вести повзунок «розтягнути час»: одна тремтлива крива. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | — (the prologue has no «Докладніше», L244) | L247 |
| `prologue/map` | Спершу з'ясуємо, з чого зроблена хвиля, а тоді пройдемо дорогу картинки з п'ятьма станціями двічі — для першої камери й для другої. | Торкнутися позначок мапи на обох доріжках. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | — (the prologue has no «Докладніше», L244) | L248 |

Hook / know / thread / now / bridge: **the doc gives none of these as text for the prologue.** What it does give:

- The riddle (L186): «Прутик монітора щомиті віддає одне-єдине число. Як крізь одне число пролазить ціла картинка?» «Ставиться в `prologue/one-number` — саме на прутику: поле в повітрі має напрям і силу, одне число дає лише прутик.»
- Thirds of the answer (L186): «картинку розпущено в часі (`lines/whole`), число сховане в частоті хвилі (`carrier/fm`), екран складає її назад за синхроімпульсами (`raster/story`). Розв'язок — `raster/answer` у главі 12».
- Volume thread, beginning (L238): «Що летить? → поле → чи передає воно зміни? → …».
- `prologue/between` goes the honest way to the cellar: route «кухня → коридор → дальня кімната → льох» is in every step that carries the monitor away (L203, L529).
- Map in the scene with two tracks named «перша камера» and «друга камера» (L201); the reader touches the marks on both tracks (L248).
- A strip in time exists from the prologue: on metal the probe shows it (L207); the probe with a window is «як лупа в `circuit`»: where you touch, there you see «одне число» (L207).
- [REPO] Tool rules for a prologue (`tools/content/path_check.py:83-87, :97-98, :131-132`): required sections «Питання з життя», «Кроки», «Місток»; no «Що ми вже знаємо» and no «Що ми тепер знаємо»; «Докладніше» not required; no path term may be introduced; the bridge must end with the next non-branch journey entry's title (`path_check.py:139-141`, `tools/content/path_export.py:51-57`) — for `prologue` that is `field`: «Як гребінець тягне шерстинку, не торкаючись?».

### 3.3 Chapter `lines`

Journey row (L219): № 4, id `lines`, title «Як передати цілу картинку одним числом?», mark «Камера», 6 steps, new terms «рядок, сигнал, кадр, синхроімпульс», ≈ 10 хв, «Без цієї глави не пояснити»: «першу третину відповіді».

Heading line (L271): «**4. `lines`** — камера розкладається на стенд: пластинка з комірками, бігунець.»

| Step id | Думка (idea) | Дія й відкриття (what the reader does and discovers) | Ціль (goal) | Висновок (takeaway) | Нові терміни | «Докладніше» | Doc line |
|---|---|---|---|---|---|---|---|
| `lines/cell` | Комірка камери перетворює світло на напругу: яскравіше — вище. | Торкатися щупом комірок: стіна — високо, темний закуток — низько. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | сотні тисяч комірок. | L272 |
| `lines/row` | Комірки одного ряду — рядка, — прочитані по черзі, дають напругу, що малює його яскравість у часі: сигнал. | Вести бігунець через паркан і кота: на стрічці зубці штахет і сходинка кота. | [GAP] not in the doc | [GAP] not in the doc as a separate text | рядок, сигнал | 52 µs. | L273 |
| `lines/frame` | Рядок за рядком уся картинка стає одним сигналом; повний прохід — кадр, двадцять п'ять за секунду. | Вести швидкість бігунця до справжньої: цятка зливається в суцільну картинку, стрічка — в один довгий сигнал. | [GAP] not in the doc | [GAP] not in the doc as a separate text | кадр | 625 рядків по 64 µs; 50 півкадрів по 288 видимих. | L274 |
| `lines/knit` | Щоб скласти картинку назад, екран мусить знати, де починається кожен рядок. | Вийняти з камери блок під кришкою без напису — кіт на екрані попливів; крутити «довжину рядка» на моніторі: кіт їде навскоси то в один бік, то в другий, і втримати його не вдається; двійник бігунця відстає. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | ціна похибки. | L275 |
| `lines/marks` | Тому перед рядком і кадром камера ставить позначку, нижчу за чорне, — синхроімпульс. | Вставити вийнятий блок назад: кіт стоїть; вийняти: пливе — на кришці з'являється напис. | [GAP] not in the doc | [GAP] not in the doc as a separate text | синхроімпульс | 1,65 + 4,7 + 5,7 + 52 ≈ 64 µs. | L276 |
| `lines/whole` | Яскравість і синхроімпульси разом — одне число в часі, і в ньому вся картинка. | Знайти щупом на кабелі синхроімпульс, стіну, цятку кота. | [GAP] not in the doc | [GAP] not in the doc as a separate text | — | штахети — зміни до 5,5 MHz. | L277 |

Hook / know / thread / now / bridge: **not given as text.** Material the doc gives:

- Volume thread around this chapter (L238): «→ хвиля, якщо гойдати швидко → що їй нести? → картинку, розпущену в сигнал → як покласти? → частотою →».
- First third of the answer to the riddle is delivered at `lines/whole` (L186, L530).
- «У главі 4 на стенд розкладається камера» (L190); «У главах 0–6 монітор закритий; ззовні в нього одна ручка, «довжина рядка» (лише `lines/knit` і `lab-bench`)» (L190).
- «Два бігунці — цятка, що оббігає картинку в камері, та її двійник на екрані: мірило того, що кінці йдуть у ногу» (L207); «Біла цятка на лобі кота» is led through both lines (L207) — `lines/whole` finds «цятку кота» with the probe.
- «Непояснені блоки працюють під кришками; кришку й напис відкриває своя глава» (L190) — `lines/knit` removes «блок під кришкою без напису», `lines/marks` puts it back and «на кришці з'являється напис».
- [REPO] Tool rules for a path chapter (`tools/content/path_check.py:83-85, :135-141`): sections «Питання з життя», «Що ми вже знаємо», «Кроки», «Нитка глави», «Що ми тепер знаємо» (exactly 3 numbered one-sentence lines), «Місток» ending with the next non-branch entry's title — for `lines` that is `carrier`: «Як покласти сигнал на хвилю?».

### 3.4 Terms these two chapters introduce, with their registry rows

Prologue: none (L215, L244). `lines` (L219, L446: «4: рядок, сигнал (`row`), кадр (`frame`), синхроімпульс (`marks`)»):

| Term | Introduced in | Forms regex | Type | Card text |
|---|---|---|---|---|
| рядок | `lines/row` | **[GAP]** | шлях (path chapter) | **[GAP]** |
| сигнал | `lines/row` | **[GAP]** | шлях | **[GAP]** |
| кадр | `lines/frame` | **[GAP]** | шлях | **[GAP]** |
| синхроімпульс | `lines/marks` | **[GAP]** | шлях | **[GAP]** |

The doc's register (Part II §5.1, L445-446) is a run-on list of term → step; it has no form regexes and no card texts ([REPO] both are required cells of `_terms.md`, `tools/content/path_format.py:193, :212-217`). Vocabulary rules that bind these two chapters (L448-450, verbatim extracts):

- «До свого кроку річ живе під робочим словом: «прутик» (антена), «число» (напруга, сигнал), «позначка» (синхроімпульс; лише до `lines/marks`), «віконце» й «горб» (фільтр), «перша» й «друга камера» (лінії).»
- «Після `lines/row` картинка, розпущена в рядки, — тільки «сигнал».»
- «елемент картинки всюди «комірка», місце в просторі — «місце».» «слід на стрічці — «крива», а не «лінія»» «місце на шкалі — «мітка», а не «позначка».»
- «Ужитий раз термін вживається знову: … «синхроімпульс» — усюди після `lines/marks`».
- Units: «побутові довжини й час — українськими знаками в підписах (мм, см, м, км, с, хв) і словами в тексті; радіо- й електричні величини — міжнародними (V, V/m, Hz, MHz, GHz, W, mW, dB, dBm, µs, ns, bit/s, Mbit/s).»
- Words only for «Докладніше» (L458) that the pilot's «Докладніше» may use: «піксель, півкадр, композитний, вольт…» (`lines/frame` Д uses «півкадрів»).
- Working words without introduction (L461) include: «камера, монітор, екран, передавач, приймач, генератор, щуп, стрічка, віконце, … бігунець, картка, … сніг, зерно, іскра, … комірка, … блок, полиця … доріжка мапи … мітка, крива, вставка».
- Terms of chapters 1–3 that `lines` uses before those chapters are built: `lines/cell` and `lines/row` use «напругу» (term «напруга», `current/push`, L446).

### 3.5 Honest-physics rows that bind the pilot (Part II §6, verbatim rows)

> | Спрощення | Де | Позначка й що кажемо чесно |
> |---|---|---|
> | Картинка на екрані | усі екрани | постійний підпис під екраном «картинку обчислено · зменшено» — це підпис сцени, а не позначка кроку; позначка кроку — «спрощена модель» (стандарт — §7); обидва екрани чорно-білі, хоч справжні камери кольорові |
> | Бігунець читає комірки | `lines/row` | «спрощена модель»: комірки збирають світло весь час |
> | Тінь за перешкодою | `prologue/between`, `air/walls` | модель рахує до трьох променів з огинанням країв; деко діє лише впритул до антени |
> | Лупа часу | `lines/row`, `lines/frame`, `carrier/knobs`, `arrow/measure`, `angle/noise` | «сповільнено ×N»: ручний чи сповільнений показ над лінією, яка біжить зі справжньою швидкістю; екрана він не змінює |

(«Лупа часу» lists `lines/row`, `lines/frame`; `prologue/one-number`'s slider «розтягнути час» is named a time magnifier at L190: «Сповільнені й ручні покази (бігунець пальцем, «повільний екран», сповільнена хвиля, «відліків за секунду») — лупа часу над лінією, яка тим часом біжить зі справжньою швидкістю; екрана вони не змінюють».) See surprise S2 on honesty marks.

### 3.6 Numbers the pilot's «Докладніше» and scenes use

| Step | Number (verbatim) | Confirmed by §7 |
|---|---|---|
| `lines/row` | «52 µs» | L507: «52 (видима частина)» |
| `lines/frame` | «двадцять п'ять за секунду»; «625 рядків по 64 µs; 50 півкадрів по 288 видимих» | L507 |
| `lines/marks` | «1,65 + 4,7 + 5,7 + 52 ≈ 64 µs» | L507 |
| `lines/whole` | «штахети — зміни до 5,5 MHz» | L508: «Найшвидші зміни сигналу — 5,5 MHz» |
| `prologue/between` | cellar ≈ −88 dBm → «сніг»; tray right against the rod → «зерно» | L203, L510, L484 |

### 3.7 Numbered requirements

| # | Requirement | Doc line |
|---|---|---|
| R3.1 | Build the prologue (4 steps, no terms, no «Докладніше») and chapter `lines` (6 steps, 4 terms) exactly on the ideas, actions and «Докладніше» of tables 3.2 and 3.3. | L244-248, L271-277 |
| R3.2 | The prologue must make three things every later chapter takes: the diorama, the full FM chain in the closed monitor, and the live screen with the probe. | L529 |
| R3.3 | The pilot must prove on a phone that snow comes out of the model (`prologue/between` goes the honest route to the cellar). | L529 |
| R3.4 | Every `lines` step turns the model's innards: a wrong line length skews the cat, the sync block is removed and reinserted, the wall and the dot are found in the signal. | L530 |
| R3.5 | Both companions — the probe and the runners — pass their test here in one world. | L531 |
| R3.6 | Chapters 1–3 are not part of the pilot; chapter `arrow` is prototyped in parallel in a sandbox and not shown on the site. | L531, L793 |
| R3.7 | Each chapter directory: `chapters/<id>/` with `index.ts, scene.ts, content.ts, steps/, parts/, qa/, __tests__/`; chapter documents `docs/volumes/radio/chapters/<id>.md` and `chapters/_terms.md`; generated content in `content/generated/`. | L609, L613, L616 |
| R3.8 | Format budgets: chapter title is a question; prologue 4–5 steps, chapter 4–8; at most 6 new terms per chapter and 2 per step; step idea 25–32 words, text 80–90 words; every step gives something to do by hand; no formulas and no quizzes on the path; one world. | L129-131 |
| R3.9 | Final step texts (80–90 words) and captions are written by the builder following `COPY_STYLE`; the doc fixes only idea, action and discovery. | L810 |
| R3.10 | A chapter imports only the platform and `sim/`, `content/`, `shared/` of its own volume; nothing is borrowed from `circuit`. | L137-138 |
| R3.11 | Scenes are deterministic: no wall clock and no randomness outside the engine, so that check snapshots repeat. | L139-140 |
| R3.12 | Phone layout rules: at most four blocks of one shelf in frame, the shelf scrolls along the picture's road; touching a block is touching its socket; the screen and the strip stay in the scene, the frequency scale, the bar and the switches go to the dock; a step names one place to look at, a second is shown by an inset; «Радіозір» is off by default on phones. | L205 |
| R3.13 | Each chapter passes the seven gates of Part III §7 (section 4.1), including an interaction test of the chapter and snapshots of all steps at computer, tablet and phone sizes taken on the site-profile build. | L766-779 |
| R3.14 | After it is built each chapter is read by an independent physics checker and an independent novice reader. | L804 |
| R3.15 | The real phone is measured by the owner at the pilot. | L724, L877 |
| R3.16 | Stop: after batch 3 the owner is shown the pilot and decides «чи це еталон»; nothing of batches 4–11 starts before that decision. | L70, L114 (decision 15), L793 |
| R3.17 | Every author's call of Part IV §2 «можна змінити до пілота без переробок». | L824 |

### 3.8 Definition of «доведені до еталона»

The doc contains **no single definition or checklist** of the reference level. It says only: «Пілотна глава, доведена до еталона, перш ніж будувати решту; решта — чергами з показом після кожної» (L70); decision 15 «одна пілотна глава до еталона» (L114); batch 3 ends with «показ і рішення власника: чи це еталон» (L793). What the doc ties to it:

| Criterion | Doc line |
|---|---|
| The seven verification gates of Part III §7. | L766-779 |
| Snapshot review «за чек-листом аудитора кадру з `circuit/VISUAL.md`» and reading the text aloud by the rules of `COPY_STYLE`. | L777-778 |
| Anti-goals: no drawn snow; no formula, quiz or question to the reader on the path; no «стіна»; no physical untruth for simplicity; no jamming / military; no divergence from `tech`. | L84-92 |
| Screen rule: the screen shows exactly what the line model produced in the current scene state. | L190 |
| The three proofs of R3.2–R3.5. | L529-531 |
| Independent physics checker and independent novice reader. | L804 |
| «так `circuit` будував пролог і `wire`» — the precedent the doc points to. | L527 |

[REPO] The precedent's own yardstick exists: `docs/volumes/circuit/VISUAL.md` §1 «Мірило еталонного кадру» (`:17`) and §9 «Чек-лист аудитора кадру» (`:438`); `docs/DECISIONS.md` §60 e: «One chapter is polished to the reference level before the next is built».

---

## 4. Cross-cutting requirements

### 4.1 Verification gates (Part III §7 «Перевірка», heading L764, text L766-782, verbatim)

> Кожна черга проходить те саме, що глави `circuit`:
>
> 1. типи, лінт, модульні тести, збірка;
> 2. тести моделі проти еталона на Python і тести «виходить із моделі» (§3);
> 3. `path_check` і `doccheck` для тому — `ALL GREEN`;
> 4. тест взаємодії кожної глави: пройти кроки, виконати дію, побачити наслідок;
> 5. знімки всіх кроків у розмірах комп'ютера, планшета й телефона наявними інструментами `tools/qa`
>    (тут — програмним рендером, із власним каталогом для результатів). Тести взаємодії й знімки йдуть по
>    збірці профілю сайту, а не по повному дереву: у повному дереві чернетка тому дістає рамку бібліотеки,
>    якої на сайті немає. Інструменти це вже вміють (`--base`, `--out`, `QA_ALLOW_SOFTWARE=1`); пісочниці
>    перевіряємо окремо в повному дереві;
> 6. перегляд знімків за чек-листом аудитора кадру з `circuit/VISUAL.md` і читання тексту вголос за
>    правилами `COPY_STYLE`;
> 7. збірка профілю сайту та її димова перевірка.
>
> Швидкодію на справжніх відеокартах і телефонах перевіряє власник у себе (рішення 18). Контактні аркуші
> знімків потребують ImageMagick; без нього знімки переглядаємо поодинці.

Commands the doc itself names: `tools/content/regen.sh --volume radio` (L653); `vite build` (L567); QA options `--base`, `--out`, `QA_ALLOW_SOFTWARE=1` (L775); `path_check`, `doccheck` → `ALL GREEN` (L132-133, L770). The doc gives no other command lines.

[REPO] Command forms found in files opened in this run (not in the doc):

| Gate | Command | Source |
|---|---|---|
| 1 | `cd app && pnpm typecheck && pnpm lint && pnpm test`; `pnpm build` (= `tsc -p tsconfig.json --noEmit && vite build`) | `README.md:39-43`, `app/package.json:9-14` |
| 3 | `python3 tools/content/doccheck.py --all`; `python3 tools/content/doccheck.py --volume <id>`; `python3 tools/content/path_check.py [--volume <id> \| --all] [--selftest]`; `tools/content/regen.sh --volume <id>` (prints the last 24 lines of doccheck) | `README.md:46`, `tools/content/doccheck.py:273-280`, `tools/content/path_check.py:14`, `tools/content/regen.sh:3-12` |
| 4–5 | `node tools/qa/chapter-check.mjs <v>/<chapter> --sizes all`; common options `--port`, `--base <url>`, `--size WxH`, `--q`, `--out <path>` (default out `/srv/electricity/qa/$QA_ID`); software rendering allowed only with `QA_ALLOW_SOFTWARE` set; Chrome from `QA_CHROME` or `/usr/bin/google-chrome` | `docs/VOLUMES.md:145-146`, `tools/qa/lib.mjs:3-10, :81, :136, :160` |
| 5 | contact sheets: `tools/qa/sheet.sh <out.jpg> [--cols N] [--tile WIDTH] [--title "text"] <img> [<img> …]` — calls `montage`, `identify`, `mogrify` (ImageMagick; not installed on this machine: `command -v convert montage magick` printed nothing) | `tools/qa/sheet.sh:4, :25-28`; L781-782 |
| library | `node tools/qa/library-check.mjs` — checks «exactly one published volume in the main flow» | `tools/qa/library-check.mjs:86` |

### 4.2 Format «шлях» (Part I §4.2, L129-133, verbatim)

> Назва глави — питання. Пролог — 4–5 кроків, глава — 4–8. Не більш як 6 нових термінів на главу і 2 на крок.
> Думка кроку — 25–32 слова, текст — 80–90 слів. Кожен крок дає щось зробити руками. Без формул і квізів на
> шляху. Один світ на весь том. Позначки чесності: «спрощена модель», «не в масштабі», «сповільнено ×N»,
> «прискорено ×N», «перебільшено», «станом на РРРР р.». Це перевіряють `tools/content/path_check.py` і
> `doccheck.py`.

### 4.3 Language and term rules

| Rule | Doc line |
|---|---|
| Reader: one curious adult without technical education, addressed as «ви»; reads one chapter at a time (7–10 minutes). | L43-44, L101 |
| «Мова: терміни простою українською; міжнародні позначення одиниць; абревіатура — лише коли справді треба і після українського пояснення.» | L112 (decision 13) |
| Depth in layers: path without formulas, collapsed «Докладніше» in every step, branch chapters, labs; no quizzes. | L32-33, L101 |
| Each path term is introduced in exactly one step (41 terms, list at L446); a term used once is used again (L448). | L445-448 |
| Working-word rules, the «Точка» / «комірка» / «місце» rule, shelf names «верхня» and «числова», «крива» not «лінія», «мітка» not «позначка», no words on «підсил-» on screen before `select/amplify`, no «на заваді». | L450 |
| Units: everyday lengths and time — Ukrainian signs in captions (мм, см, м, км, с, хв) and words in text; radio and electrical quantities — international (V, V/m, Hz, MHz, GHz, W, mW, dB, dBm, µs, ns, bit/s, Mbit/s). | L450, L838-839 |
| Narrow forms for the checker: «насиченн-» (не «насичен-»); «кольоров- різниц-»; «спалах-зразок» як одне слово; «I та Q»; «радіохвил-»; «аналогов- ліні-», «цифров- ліні-»; «стисненн-». | L450 |
| Words only for «Докладніше» (list); abbreviations FM, QPSK, QAM, OFDM, PAL, SECAM only there; PLL and LDPC on screen only in their branches after a Ukrainian explanation; «Амплітуда» is a narrow form that does not catch «амплітудну модуляцію». | L457-458 |
| Working words without introduction (list), including the block labels «впустити діапазон», «підсилити», «зсунути», «тримати канал», «зрізати верхівки», «частота → яскравість», «скласти рядки», «оцифрувати», «кут». | L460-461 |
| Never anywhere: the word «гребінець» about a wave on the strip; the word «поріг» about the FM threshold. | L463-464 |
| Never say (ten sentences): «хвиля втомлюється», «антена ловить картинку», «одне поле народжує інше», «магнітне поле діє, лише коли змінюється», «шум — це тремтіння електронів антени», «канал удвічі ширший за гуляння», «що ширше гуляння, то менше шуму», «частотна модуляція не має шуму», «поки хмарки не торкаються, помилок нуль», «цифра не боїться шуму». | L500 |
| Words awaiting the owner's ear: «розмах», «відлік», «обертова стрілка», «тіні I та Q», «символ», «сузір'я», «піднесна», «вогник», «вказівник поля», «контрольне число». | L522, L836-837 |

### 4.4 Sensitive topics and honesty

| Rule | Doc line |
|---|---|
| Anti-goal: «Навмисне глушіння, поради «як заважати», військові застосування, безпілотники. Завади — лише випадкові побутові: сусідський роутер, мікрохвильова піч, відбиття, стіни.» | L90-91, L111 (decision 12) |
| «Радіо навчаємо як принципи. Завади — тільки випадкові побутові. Сила передавача — в дозволених межах. Нічого про те, як заважати чужому зв'язку.» | L146-147 |
| Hero: household wireless camera and monitor; «Без дронів і військового.» | L102 (decision 3) |
| Nowhere: «Навмисного глушіння й способів заважати; безпілотників; військових застосувань; радіолокації; сили передавача понад дозволену.» | L464 |
| Transmitter 10 mW, 2,4 GHz, four channels 2414 / 2432 / 2450 / 2468 MHz; the power slider stays within the permitted range. | L122 (decision 23), L203 |
| Owner's working receiver may be read as a reference for the model; only publicly known parameters go into the course; no recordings of the air and no code of that project are copied anywhere. | L118 (decision 19), L682-684 |
| «Екран не бреше»: every picture on a screen in the scene really passed the line model sample by sample; snow, torn lines, dead spots and the digital cliff come from the model, not drawn. | L29-31, L110 (decision 11) |
| Anti-goal «Намальований сніг: ефект на екрані, якого не видала модель.» | L86 |
| Anti-goal «Фізична неправда заради простоти. Спрощення дозволені лише з чесною позначкою (частина II, §6).» | L89 |
| Honesty marks of the format: «спрощена модель», «не в масштабі», «сповільнено ×N», «прискорено ×N», «перебільшено», «станом на РРРР р.» — and per-step assignments in Part II §6 (L466-498). | L131, L466-498 |
| Screen rule (L190): slow and manual shows are a time magnifier over a line that keeps running at real speed; they do not change the screen — only the line's own knobs do. | L190 |
| Out of scope: colour and sound on the path (both screens black-and-white); audible sound not promised; radar, navigation, cellular, amateur radio. | L75-78 |

### 4.5 Repository rules

| Rule | Doc line |
|---|---|
| `Codir/radio-pop-science` is a copy of `tech` with history; `origin` — this repository, `upstream` — `NikoSkakun/tech`; the project adds files and changes existing ones as little as possible so that `upstream` updates merge without conflicts. | L119 (decision 20), L537-539 |
| Platform directories not edited in this repository: `app/src/engine`, `hud`, `hud-dom`, `kit`, `fx`, `ui3d`, `text`, `style`, `audio`, `content`, `tools/content`, `tools/qa`. | L552-553 |
| If a platform edit cannot be avoided it lives as a proposal in a separate branch `platform/<тема>` and does not reach `main` until the owner decides; meanwhile `main` makes do with `radio/shared` or waits for the change from `upstream`. | L553-556, L851-852 |
| Anti-goal: divergence from the original `tech` repository that would stop its updates from merging. | L92 |
| Electricity volumes are not in the site build; links to them lead to `nikoskakun.github.io/tech`. | L119 |
| Commit as work proceeds; push to `main` after every finished and verified batch without separate permission. | L121 (decision 22) |
| Environment: Node 24 and pnpm at user level; frame checks here with software rendering; performance is checked by the owner. | L117 (decision 18), L81-82, L781 |
| Agents: Fable 5.2 — planning, signal models, visual language; Opus 5.5 — chapter code, tests, checks. | L116 (decision 17), L803 |
| Engine rules: a chapter imports only the platform and its own volume's `sim/`, `content/`, `shared/`; volumes do not import each other; no wall clock and no randomness outside the engine. | L137-140 |
| The engine has no worker, no live-raster screen, no arbitrary sound, no external links, no lab layer, no two-track map — all closed inside the volume (Part III §5). | L141-142, L728-741 |

### 4.6 What the owner must do outside this repository (Part IV §4, heading L870, text L872-877, verbatim)

> - Увімкнути Settings → Pages → Source: GitHub Actions у `Codir/radio-pop-science` (перед першою чергою).
> - Додати документи формату (рішення 26) — бажано до плану робіт, найпізніше до пілота.
> - Змінити в платформі навігацію гілок (рішення 25) — до дев'ятої черги.
> - Додати в основному курсі посилання на цей сайт із кроку про хвилю Максвелла (частина III, §1) — коли
>   буде що показати.
> - Перевіряти швидкодію на справжніх відеокартах і телефонах після пілота й далі (рішення 18).

Timing relative to batches 1–3: Pages source — «перед першою чергою»; format documents — «бажано до плану робіт, найпізніше до пілота»; real-device performance — «після пілота й далі». [REPO] As of `63fd42c` the format documents are still absent: `docs/PATH_FORMAT.md`, `docs/VOLUME_STRUCTURE.md`, `docs/AGENT_GUIDE.md`, `docs/MOBILE.md`, `docs/HUD_DOM.md`, `docs/briefs/` do not exist (`ls docs` → `API_CHANGES.md ARCHITECTURE.md CONTENT_EXPORT.md DECISIONS.md ENGINE_API.md FX_API.md KIT_API.md LIBRARY.md STYLE_GUIDE.md THIRD_PARTY.md UI_API.md VOLUMES.md superpowers/ volumes/`).

### 4.7 Author's calls (Part IV §2, L822-855) that affect batches 1–3

Header (L824): «Це не рішення власника. Кожне можна змінити до пілота без переробок.»

| № | Call (verbatim core) | Batch it affects |
|---|---|---|
| 1 | «Лінія на 2,4 GHz, чотири канали — уже підтверджено власником (рішення 23).» | 2 |
| 2 | «Двоїння — лише в гілці про телевізор.» FM line gives dead spots and ripples. | 2 (model tests) |
| 3 | «Ланцюг приймача справжній: широкий вхідний фільтр → підсилювач → зсув → нерухомий вузький фільтр каналу → обмежувач → детектор.» | 2 |
| 5 | «Супутникова гілка — дві глави» (`sat` after the analogue finale, `sat-digital` after the digital one). | 1 (journey) |
| 6 | «Два практикуми — після кожного фіналу. Лабораторії — необов'язкові глави шару гілок із назвами-питаннями». | 1 (journey) |
| 7 | Words: «напруженість поля», «гуляння частоти», «обертова стрілка», «тіні I та Q», «відлік», «сузір'я», «піднесна», «вогник» на шкалі частот, «радіозір». | 1 (register), 3 |
| 8 | Units: everyday lengths and time in Ukrainian signs, radio quantities international, «як у `circuit`». | 1, 3 |
| 9 | «Пілот — пролог і `lines`.» | 3 |
| 10 | «Сайт збирається профілем, а в дереві репозиторію том лишається чернеткою.» | 1 |
| 11 | «Старий план радіо-тому переїздить в архів `plan48/`; у `README.md` з'являється розділ про цю копію.» | 1 |
| 12 | «Лінійка мапи має сім позначок». | 1 |
| 14 | «Телефон на підвіконні — єдина хвиля поза діапазоном». | 2 |
| 15 | «Мірило швидкості моделі: 10 кадрів моделі за секунду на комп'ютері, 4 — на телефоні». | 2 |
| 16 | «Пропозиції до платформи живуть в окремих гілках `platform/<тема>`». | 1–3 |
| 17 | «Мініатюра «де ми» — власний прилад тому». | 2 |
| 18 | «Кнопки-посилання на основний курс з'являються лише для сторінок, які там уже збудовано.» | 1 (list), later chapters |

Calls 4 (no separate «чому частота» step) and 13 (sound) do not touch batches 1–3.

---

## 5. Left to the builder (Part IV §1, heading L808, text L810-820, verbatim) with the batch each falls into

> - Остаточні тексти кроків (80–90 слів) і підписи — за `COPY_STYLE`; тут зафіксовано думку, дію й відкриття.
> - Композиція кадрів, ракурси, світло — у `VISUAL.md` першої черги.
> - Параметри обчислень: порядки фільтрів, темпи відліків моделі, формат повідомлень фонового потоку,
>   подробиці стиснення.
> - Око камери (рішення 24): як саме зберігати й відновлювати стан рендерера і як рахувати додатковий
>   прохід у перевірці швидкодії.
> - Покрокове проєктування інженерних гілок — у їхній черзі.
> - Пороги автоматичних перевірок кадрів.
> - Де живе пісочниця для проб (живий екран другої черги, проба глави `arrow`): службова сторінка поза
>   подорожжю тому, якої немає у збірці сайту.
> - Розміщення кнопки зовнішнього посилання на кроці та її вигляд.

| Item (first words) | Batch |
|---|---|
| «Остаточні тексти кроків (80–90 слів) і підписи — за `COPY_STYLE`» | 3 (prologue, `lines`); every later chapter batch |
| «Композиція кадрів, ракурси, світло — у `VISUAL.md` першої черги» | 1 |
| «Параметри обчислень: порядки фільтрів, темпи відліків моделі, формат повідомлень фонового потоку, подробиці стиснення» | 2 (filters, sample rates, worker messages); 8 (compression) |
| «Око камери (рішення 24): як саме зберігати й відновлювати стан рендерера і як рахувати додатковий прохід у перевірці швидкодії» | 2 |
| «Покрокове проєктування інженерних гілок — у їхній черзі» | 11 |
| «Пороги автоматичних перевірок кадрів» | 2 (first sandbox frames), 3 |
| «Де живе пісочниця для проб (живий екран другої черги, проба глави `arrow`): службова сторінка поза подорожжю тому, якої немає у збірці сайту» | 2 (live screen), 3 (`arrow`) |
| «Розміщення кнопки зовнішнього посилання на кроці та її вигляд» | first needed by `field/charge` — batch 4 |

Things the doc leaves open without listing them in Part IV §1 are collected in section 6 and in the **[GAP]** notes above.

---

## 6. Ambiguities (two possible implementations in batches 1–3)

| # | Where | Reading A | Reading B |
|---|---|---|---|
| A1 | `PATH.md` «з повними таблицями кроків» (L791) | Transcribe Part II §2 as it is: per step «думка → дія й відкриття → Д» (L242). | Use the `circuit` shape ([REPO] `docs/volumes/circuit/PATH.md:42-110`): per chapter «Питання з життя», «Що ми вже знаємо», table with separate «Висновок», «Нитка глави», «Що ми тепер знаємо», «Місток» — which means writing these for all 20 path entries in batch 1, although the doc fixes only idea, action and discovery (L810). |
| A2 | «реєстр» in batch 1 (L791) vs `chapters/_terms.md` (L616) | Batch 1 writes only the human register (`PATH-ledger.md`) and no `docs/volumes/radio/chapters/` directory: then [REPO] `doccheck --volume radio` prints «volume radio has no documents yet … nothing to do» and is trivially green (`tools/content/chapters.py:141-143`). | Batch 1 creates `chapters/_terms.md` with all 41 + 24 terms (form regexes and cards must then be authored now): [REPO] once `chapters/` exists `_terms.md` is mandatory (`tools/content/path_format.py:238-241`) and every register row must name a chapter of the journey (`tools/content/path_check.py:151-152`). |
| A3 | Ruler marks | Labels capitalised as in L201 and the path table («Основи», «Камера», …). | Lower case as in L629 («основи», «камера», …) — the `circuit` precedent is lower case ([REPO] `app/src/volumes/circuit/volume.json:16-19`). Also open: floor ids, numeric values and vertical order of the seven marks, which mark the 13 branches and 4 labs take, and where the caption «з чого зроблена хвиля» goes ([REPO] `AxisFloor` has no caption field, `app/src/engine/volume.ts:90-100`). |
| A4 | Journey order and groups (L621-627) | Branch-layer entries are interleaved in `journey` right after their parents while their three groups are listed last in `groups`. | Entries are listed group by group and placement comes only from `parent` ([REPO] the registry orders roots by `order` and visits children depth-first, `app/src/engine/registry.ts:51-72`). Also open: order among several children of one parent (`select` → `tank`, `cable`; `angle` → `fm-depth`, `sdr`; `raster` → `tv`, `lab-tube`, `sat`, `colour-sound` is stated only at L633); group ids, especially for the two «Практикум» groups. |
| A5 | Practicum titles (L228, L234) | Title with the prefix, as in the doc's table: «Практикум. Проведіть картинку крізь подвір'я самі». | Title without the prefix, as `circuit` does ([REPO] `app/src/volumes/circuit/volume.json:36`: «Зберіть коло самі», while `docs/volumes/circuit/PATH.md:284` says «Практикум. Зберіть коло самі»). |
| A6 | `minutes` of branches | Omit `minutes` for the 13 branches (the map then shows «у планах» without minutes, [REPO] `app/src/hud/map/labels.ts:111`). | Estimate minutes from step counts; the doc gives none (only labs: 12, 12, 9, 10 at L435-441). |
| A7 | Home-screen texts | Only title and subtitle; `kicker`, `lead`, `emptyNote` empty. | Write an `emptyNote` («Том у роботі — …») for batch 1, when no chapter is built and the home screen is the lobby ([REPO] `docs/VOLUMES.md` §3). The doc gives no text. |
| A8 | Extent of the FM chain in batch 2 (L792 «ланцюг частотної модуляції з каналом і щупом») | Only what the pilot needs: closed monitor with the upper shelf (slope detector), distance, walls, tray, route, sync and the line-length knob, time-strip probe. | The whole chain 1 of L193 with both readings («верхня полиця зі схилом і обведенням або числова з парами відліків і кутом»), the whole band with router, microwave and phone (L197, L667-668), `spectrum` and all three probe views (L672) — everything chapters 5–12 will need. |
| A9 | Shared parts in batch 2 (L792 «подвір'я, екран, мініатюра «де ми»») | Exactly `yard`, `screen`, `link`, `whereami` (+ `models` they need); `stand`, `probe` device, `map`, runners are built in batch 3 with the chapters that first use them. | The prologue's full kit (probe with window, map with two tracks) is also part of «світ, перша частина», since the sandbox must show «живий екран» and the pilot assumes the world exists. |
| A10 | Where the speed bar is measured | «на звичайному комп'ютері» = this machine, CPU-only model timing in Node/vitest and in the browser sandbox with 4× CPU throttling (L722-724). | Model speed in the real page including the camera-eye read-back — but here only software rendering is available (L81-82, L117), so the GPU part of the measurement is the owner's (L877). The doc does not define «звичайний комп'ютер». |
| A11 | Camera-eye resolution and read-back | Texture exactly 128 × 96 (L703), read once per model frame (L700). | «≈ 128 × 96 комірок» (L193) / «близько 128 × 96» (L675) leaves the size approximate; whether the extra pass renders every scene frame or only when the model asks for a frame is not said (L699-705 say one pass, counted separately). |
| A12 | Sandbox location (L818-819) | A dev sandbox chapter in the upstream dev volume, as `circuit` did ([REPO] `app/src/volumes/_dev/chapters/_sandbox-circuit-*`; a dev volume's chapter may import another volume's `shared/**`, `app/eslint-rules/chapter-boundary.js:9-10`) — but that adds files inside an upstream-owned directory. | A page inside `app/src/volumes/radio/` — but [REPO] every built chapter of a volume must be in its `volume.json` journey (`app/src/engine/__tests__/volumes.test.ts:57-59`), and the site profile would have to strip it. |
| A13 | Pilot seam prologue → `lines` (L527, L531) | Ship the two chapters as they will finally read: the prologue's bridge asks chapter 1's question and the closing card names `field`; `lines` assumes chapters 1–3 («напруга»). | Add temporary pilot wording. [REPO] The tools force reading A for the bridge (`tools/content/path_check.py:139-141`); the closing card's button to an unbuilt chapter is disabled with the tip «Ця глава ще готується» (`app/src/hud-dom/step/path-body.ts:104-111`); «Згадати» links into chapters without documents are errors (`path_check.py:172-179`). |
| A14 | Honesty marks on steps (L131, L466-498, L678-679, L739) | Write «Позначки» in the chapter documents and show «спрощена модель» on steps with a screen. | [REPO] The platform dropped them: the fields «Позначки» and «Чесно» are accepted and discarded (`tools/content/path_format.py:27-28`), `docs/DECISIONS.md:447-451` (§60 x). Only the scene caption «картинку обчислено · зменшено» can be shown, and whether §60 x also forbids it is the owner's call. |
| A15 | Smoke check of the site profile (L568) | A small script with `playwright-core` from `app` devDependencies and the system Chrome. | Reuse `tools/qa` tools with `--base` against `vite preview` of the profile build. The doc names neither; in GitHub Actions a browser must be provided either way. |
| A16 | CI checks «на повному дереві (типи, лінт, тести, документи)» (L574-575) | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `python3 tools/content/doccheck.py --all`. | The same plus gates 4–6 of L771-778 (interaction tests, snapshots) — L574-575 does not list them for CI, L766 says every batch passes them. |
| A17 | Link list file and its check (L599-600) | A data file in `radio/shared/links` plus a unit test that reads the chapters of the other volumes present in the full tree. | A script that compares against `upstream` (`git` ref or the live site). The doc says «перевірка звіряє його з главами `upstream` після кожного оновлення» without naming the mechanism or the batch. |
| A18 | Branch-term check (L641-645) | Register it in `volume.json → docs.checks`. | [REPO] `docs.checks` is read only by the classic-format `main()` of doccheck (`tools/content/doccheck.py:235-236`), not by `main_path()` (`:252-270`), so for a path volume it must run some other way (a vitest test in the volume, or a separate CI step). |
| A19 | Camera stand in `lines` (L271, L275-276) | The stand shows only what `lines` names: the plate with cells, the runner, one unlabelled block (the sync block) and the cable. | The stand already carries the camera's later blocks under covers (generator and antenna of chapter 5, L279), as the monitor's shelves do (L190 «Непояснені блоки працюють під кришками»). The doc lists the monitor's blocks in full but never the camera's. |
| A20 | «запис формату, як його перевіряють інструменти» (L791) | A document in `docs/volumes/radio/` describing the path format as enforced by `tools/content/path_*.py`. | A section of `PATH-NOTES.md` or of the plan. Location and name are not given. |
| A21 | `COPY_STYLE` (L651, L778, L810) | Use `docs/volumes/circuit/COPY_STYLE.md` as it is. | Write `docs/volumes/radio/COPY_STYLE.md`; the doc's tree (L614-617) lists no such file. |
| A22 | `seamless` in `volume.json` | `true`, as `circuit` («Один світ на весь том», L745). | Omit: the doc never mentions it, and [REPO] `seamless` makes chapters walk to a shared border frame (`docs/VOLUMES.md` §7), which the yard ↔ stand chapters would have to implement. |

---

## 7. Surprises — the doc against the repository (appendix)

| # | Doc says | Repository shows |
|---|---|---|
| S1 | L171: profile keeps the tree equal to `upstream`, «його тести й перевірки лишаються зеленими»; L552-553: `app/src/engine` is not edited; L574-575: CI runs the tests on the full tree. | `app/src/engine/__tests__/volumes.test.ts:29-31`: `expect(volumes.map((v) => v.dir).sort()).toEqual(['_demo', '_dev', '_path', 'circuit', 'electricity']);` — adding `app/src/volumes/radio/volume.ts` makes this platform test fail; it can only be fixed by editing a file in a platform directory. |
| S2 | L131-133: honesty marks «перевіряють `tools/content/path_check.py` і `doccheck.py`»; L739: «перелік позначок в інструментах фіксований, тому на кроках з екраном стоїть «спрощена модель»»; L678-679; whole §6 column «Позначка». | `docs/DECISIONS.md:447-451` (§60 x, owner, 2026-11-17): «прибирай надписи "спрощена модель", "не в масштабі" і блок "чесно про картинку". це все зайве» — «in every volume, both interfaces»; `tools/content/path_format.py:27-28`: fields «Позначки» / «Чесно» are «accepted and dropped»; `tools/content/test_path_format.py:73-78`; `docs/volumes/circuit/VISUAL.md:434`: «Позначки чесності — скасовано». `path_check.py` contains no list of marks. |
| S3 | L643-645: «том додає власну перевірку (рушій дозволяє додаткові перевірки у `volume.json`)». | `tools/content/doccheck.py:235-236` reads `volume.json → docs.checks` only inside `main()` (classic format); `main_path()` (`:252-270`), which runs for `"format": "path"`, has a fixed list and ignores `docs.checks`. The same holds for wiring the Python oracle into doccheck. |
| S4 | L597-599: «На 17.11.2026 у томі `circuit` збудовано тільки пролог і `wire`, тож посилання на `circuit/charge`, `circuit/battery` і `circuit/flow` чекають»; L651: «дві збудовані глави `circuit`». | After merge `63fd42c` all nine `circuit` chapters are built: `app/src/volumes/circuit/chapters/{prologue,wire,charge,battery,flow,resistance,lamp,drain,build}/index.ts`; `app/src/engine/__tests__/volumes.test.ts:101-102` («all nine chapters are built»); `git ls-tree upstream/gh-pages` lists `assets/chapter-circuit-{charge,battery,flow}-*.js` (site build `ba841a1`, 2026-11-18). |
| S5 | L654-655: the volume's `terms_allowlist.tsv` lists «FM, QPSK, QAM, OFDM, PLL, LDPC, PAL, SECAM, I, Q, запис angle(…conj…)». | `FM` is already in the global list (`tools/content/terms_allowlist.tsv:134`, kind `mark`) and a word listed in both files is reported as `duplicate entry` (`tools/content/terms_check.py:181-182`); single letters `I`, `Q` are exempt without an entry (`terms_check.py:128`). Running `terms_check.latin_words` in this run: `dBm`, `Mbit/s`, `bit/s`, `nW` are **not** exempt units (`terms_check.py:114-117`) and need allowlist entries although the doc treats them as plain units (L450); `angle`, `conj`, `fs/2` from the formula at L320 are flagged unless the formula stands in a code span (anything inside backticks is exempt, `tools/content/terms_allowlist.tsv:11-12`). |
| S6 | L201: mark «Основи» has «підпис «з чого зроблена хвиля»»; L622-623: two groups both named «Практикум». | `AxisFloor` is `{ id, label, value, plain?, namedAt? }` — no caption; `plain` is a temporary replacement name tied to `namedAt` (`app/src/engine/volume.ts:90-100, :301-306`). Group ids must be unique (`volume.ts:282-283`). |
| S7 | L242: a step is «думка → дія й відкриття → Д»; L810: only idea, action and discovery are fixed. | A chapter document needs per step `REQUIRED = ['idea', 'text', 'action', 'takeaway', 'goal', 'terms', 'more']` (`tools/content/path_format.py:29`; fields «Думка», «Текст», «Дія», «Висновок», «Ціль», «Нові терміни», «Докладніше»), a step title in `### N. `id` — <title>` (`path_format.py:14`), at most 2 hints, and per chapter «Питання з життя», «Що ми вже знаємо», «Нитка глави», «Що ми тепер знаємо» (3 lines), «Місток» (`tools/content/path_check.py:83-85, :135-141`). None of step titles, «Ціль», «Висновок», hints, captions, hook, know, thread, now, bridge is in the doc. |
| S8 | L445-464: register in five subsections (5.1 «Терміни шляху», 5.2 «Терміни гілок», 5.3 «Слова лише для «Докладніше»», 5.4 «Робочі слова без введення», 5.5 «Чого немає ніде»). | `_terms.md` is parsed only under the exact H2 names «Терміни шляху», «Слова лише для «Докладніше»», «Чого на шляху немає» (`tools/content/path_format.py:193-194`); rows under any other heading are ignored; every term row needs a regex of forms and a card text, which the doc does not give (only eight narrow forms at L450). |
| S9 | L527: the pilot is the prologue «як її дверима (так `circuit` будував пролог і `wire`)». | `wire` is chapter 1 of `circuit`, directly after its prologue; `lines` is chapter 4 of `radio`. With chapters 1–3 unbuilt: the prologue's closing card will offer the next planned chapter `field` as a disabled button with the tip «Ця глава ще готується» (`app/src/hud-dom/step/path-body.ts:104-111`); its «Місток» must end with `field`'s question (`tools/content/path_check.py:139-141`, `tools/content/path_export.py:51-57`); `lines` cannot «Згадати» steps of chapters 1–3 until their documents exist (`path_check.py:172-179`). |
| S10 | Titles and numbers are written with straight apostrophes (119 in-word occurrences, e.g. «подвір'я» L228, «подвір'ї» L234) and the micro sign U+00B5 (16 occurrences, e.g. «64 µs»). | The platform normalises on-screen copy to the typographic apostrophe U+2019 and Greek μ U+03BC (`tools/content/typography.py:6-7, :64-65`; `docs/DECISIONS.md:93`, §32); `doccheck` runs `typography.py --check` for path volumes (`tools/content/doccheck.py:258`). Strings copied from the doc need this normalisation. |
| S11 | L566: profile step 3 «пише `library.json` з `defaultVolume: "radio"`». | `app/src/volumes/library.json` also has `"legacyVolume": "electricity"`; the library throws `Library: legacy volume '…' is not registered` if that volume is absent (`app/src/engine/library.ts:72-73`). The profile must drop or repoint `legacyVolume` (it defaults to the default volume). |
| S12 | L116, L803: Fable 5.2 for planning, signal models and visual language; Opus 5.5 for chapter code. | `docs/DECISIONS.md:438-442` (§60 v, owner, 2026-11-17, in the merged upstream log): «тепер ти opus і можеш запускати тільки opus…» — «Supersedes §60 d … No Fable». It is written for the upstream orchestrator; whether it governs this repository is the owner's call. |
| S13 | L139-140, L659-661: no wall clock or randomness outside the engine. | Lint enforces this only for `src/volumes/*/chapters/**/*.ts` (`app/eslint.config.js:37, :54-60`); in `shared/` and `sim/` only `setInterval` is banned (`app/eslint.config.js:29-32`). Determinism of `radio/shared` and `radio/sim` must be guarded by the volume's own tests. |
| S14 | L117: «Node 24 і pnpm — у межах користувача». | In this run `node --version` → `v22.22.2`; `~/.nvm/versions/node/` holds `v22.22.2` and `v24.22.3`; there is no `.nvmrc`; `pnpm --version` → `12.21.0` while `app/package.json:43` pins `pnpm@12.18.0`. ImageMagick is absent (matches L781-782). numpy 2.5.1 and scipy 1.17.1 import under `python3` 3.12.3. |

Confirmed as written (no mismatch): `status: "draft"` semantics (`app/src/engine/volume.ts:14-18`); «exactly one published volume in the main flow» (`tools/qa/library-check.mjs:86`); «у планах · ≈ N хв» (`app/src/hud/map/labels.ts:111`); `regen.sh --volume <id>` (`tools/content/regen.sh:3-7`); QA options `--base`, `--out`, `QA_ALLOW_SOFTWARE` and that QA always opens the app with `?debug` (`tools/qa/lib.mjs:5-8, :103, :160`); the alias rule for a non-dev volume (`app/src/engine/__tests__/volumes.test.ts:66-73`; `app/vite.config.ts:14-18` derives the vite alias from the directory name); `never call render()` (`docs/ENGINE_API.md:159`); budgets 4–8 / 4–5 steps, 6 / 2 terms, idea ≤ 32 words (warning above 25), text ≤ 90 (warning above 80) (`tools/content/path_check.py:26-27`); register types only «шлях» / «практикум» (`tools/content/path_format.py:216-217`); practicum needs no bridge (`path_check.py:83`); palette tokens `sky`, `amber`, `magenta`, `violet`, `lime` (`app/src/style/palette.ts:18-33`) and neutral `steel` (`:38`); `app/src/fx/signals/` exists (`scope.ts`, `screen.ts`, `phasors.ts`, `waveforms.ts`); no `new Worker` and no `_blank` / `window.open(` call anywhere in `app/src` (grep in this run); the three old plan files in `docs/volumes/radio/` and the README / `docs/LIBRARY.md` rows about the old radio plan (`README.md:18`, `docs/LIBRARY.md:13`); `.github/`, `tools/site/`, `tools/ref-models/radio/`, `app/src/volumes/radio/` do not exist yet. All 85 path step ideas of the doc pass the checker's «one sentence, ≤ 32 words» rule (three are in the 26–32 warning band: `current/change` 30, `current/swing` 30, `arrow/still` 27); step ids and chapter ids all match the checker's id patterns.

---

## 8. Open questions (appendix)

1. Whether the owner accepts a one-line edit of the platform test `app/src/engine/__tests__/volumes.test.ts:30` (or another way to keep `pnpm test` green with `radio` in the tree) — S1.
2. Whether DECISIONS §60 x (no honesty badges, every volume) overrides the doc's step marks and the permanent screen caption «картинку обчислено · зменшено» — S2.
3. Texts for `kicker`, `lead`, `emptyNote`; which of title / subtitle is the home headline — 1.6.
4. Floor ids, values and order of the seven marks; marks and minutes of branches and labs; group ids; `axis.label` / `hint`; `order`, `emblem`, `seamless`, theme — 1.3, A3–A6, A22.
5. Whether `PATH.md` of batch 1 must contain hook / know / takeaway / thread / now / bridge for all 20 path entries — A1.
6. Whether `chapters/_terms.md` (forms and cards for 65 terms) is written in batch 1 or only for the pilot's terms in batch 3 — A2.
7. How far the FM chain and the shared world go in batch 2 — A8, A9.
8. Where the sandbox lives — A12.
9. What «звичайний комп'ютер» is for the speed bar and whether the 4× throttled measurement here is accepted as the phone estimate before the owner's real-device run — A10.
10. Whether the eight course links are now all live on `nikoskakun.github.io/tech` (the repository and the local `upstream/gh-pages` ref say the chapters are built; the live site was not opened in this run) — S4.
11. Whether the format documents of decision 26 will arrive before the pilot (absent at `63fd42c`).
12. Which agent-model rule applies in this repository — S12.
