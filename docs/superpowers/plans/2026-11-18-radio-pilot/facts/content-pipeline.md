# Content pipeline of the path format — facts for the radio plan

Repository `/home/pilot/tmp/radio-science-pop`, HEAD `63fd42c` (branch `main`). Everything below was read or run in this
session (2026-11-18). Paths are repo-relative. Python on this machine: `Python 3.12.3`; `node` on PATH: `v22.22.2`.
Nothing tracked was changed (`git status --short` empty before and after).

Pipeline in one line:

```
docs/volumes/<v>/chapters/<id>.md + chapters/_terms.md      (hand-written; volume.json plans the journey)
  → tools/content/path_format.py   parse (structural problems)
  → tools/content/path_check.py    budgets, term order, register, Latin words   (doccheck group `path`)
  → tools/content/path_export.py   docs/volumes/<v>/chapters/_export/<id>.json  (everything, guidance too)
                                   app/src/volumes/<v>/content/generated/<id>.json + <id>.manifest.json  (on-screen subset)
                                   docs/volumes/<v>/INDEX.md, GLOSSARY.md
  → app: chapters/<id>/index.ts imports <id>.manifest.json; chapters/<id>/content.ts imports <id>.json via defineContent()
```

What was read completely: `tools/content/{path_format,path_check,path_export,test_path_format,chapters,doccheck,terms_check,typography}.py`,
`regen.sh`, `terms_allowlist.tsv`, `docs/CONTENT_EXPORT.md`, `docs/DECISIONS.md`, `docs/volumes/circuit/{VOLUME,COPY_STYLE,PATH-ledger}.md`,
`check.py`, `chapters/{_terms,prologue,wire,build}.md`, all of `docs/volumes/_path/**`, the design doc. Read in part (headings + the
sections quoted): `PATH.md`, `PATH-NOTES.md`, `REUSE.md`, `VISUAL.md`, `chapters/charge.md`, `docs/VOLUMES.md`, `docs/API_CHANGES.md`.
Only the entry points were read of the classic-format tools (`export_content.py`, `export_runtime.py`, `build_index.py`,
`build_glossary.py`, `copy_check.py`, `xref_check.py`, `simple_check.py`, `simple_layer.py`, `hotspot_ids.py`, `export.schema.json`):
for a path volume each of them either delegates to `path_export` or prints `not applicable` (see §4). There is **no README** in
`tools/content/`.

Documents the code points to that **do not exist in this copy**: `docs/PATH_FORMAT.md` (named in `path_format.py:2`,
`path_check.py:2-3`, `path_export.py:2`, `VOLUMES.md:184`), `docs/VOLUME_STRUCTURE.md`, `docs/AGENT_GUIDE.md`, `docs/MOBILE.md`,
`docs/HUD_DOM.md`, `docs/briefs/`, `docs/reports/`, `docs/requests/`, `docs/ideas/`, `docs/audits/`, top-level `qa/`.
`docs/` holds only: `API_CHANGES.md ARCHITECTURE.md CONTENT_EXPORT.md DECISIONS.md ENGINE_API.md FX_API.md KIT_API.md LIBRARY.md
STYLE_GUIDE.md THIRD_PARTY.md UI_API.md VOLUMES.md superpowers/ volumes/`. So the parser, the checker and the two sandboxes are the
only definition of the format here.

---

## 1. Chapter script grammar

File: `docs/volumes/<volume>/chapters/<chapter-id>.md`, one per journey entry of `volume.json`. A chapter is "written" when the file
exists (`chapters.py:76-77`: `CHAPTER_IDS` = journey ids that have a document; `PLANNED` = every journey id). There is **no front
matter and no header field block** — only the H1.

### 1.1 Regexes (`tools/content/path_format.py:12-18`)

```python
H1 = re.compile(r'^# ([A-Za-z0-9_][A-Za-z0-9_-]*) — (.+?)\s*$')
H2 = re.compile(r'^## (.+?)\s*$')
STEP = re.compile(r'^### (\d+)\. `([^`]+)` — (.+?)\s*$')
FIELD = re.compile(r'^- \*\*([^*]+?):\*\*\s*(.*)$')
NUMBERED = re.compile(r'^(\d+)\. (.*)$')
STEP_ID = re.compile(r'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$')
REF = re.compile(r'^`([^`\s]+)`$')
```

- H1 = first non-empty line: `# <chapter-id> — <title>` (em dash U+2014 with spaces); the id must equal the file id
  (`path_format.py:98-103`). The title is the chapter's question.
- `<!-- … -->` comments (multi-line too) are removed before parsing (`path_format.py:30,95-96`): circuit puts
  «Примітки щодо фактів» in one comment at the end of every chapter (`prologue.md:161-183`, `wire.md:172-192`).
- Text between the H1 and the first `##` is silently ignored (section is `None`; verified in memory).

### 1.2 Sections (`path_format.py:20-22`) — exact spelling, fixed order

| `## ` heading | key | content | required for layer (`path_check.py:83-87`) |
|---|---|---|---|
| `Питання з життя` | `hook` | prose, lines joined with a space | prologue, path, branch |
| `Що ми вже знаємо` | `know` | prose | path, branch; **forbidden in a prologue** |
| `Кроки` | `steps` | `###` step blocks only | every layer |
| `Нитка глави` | `thread` | prose (guidance, never on screen) | path, branch |
| `Що ми тепер знаємо` | `now` | numbered lines `1. …`, continuation lines indented 3 spaces | path, branch (exactly 3, one sentence each); **forbidden in a prologue**; a practicum may have any number (`build.md:128-134` has 4) |
| `Місток` | `bridge` | prose | prologue, path, branch |
| `Підписи глави` | `labels` | `«…» · «…»` (every `«…»` is one caption) | optional; `build.md:136-137`: `«Почати з початку»` |

Required sets, verbatim: `need = {'prologue': ['hook', 'steps', 'bridge'], 'practicum': ['steps']}.get(layer, ['hook', 'know', 'steps', 'thread', 'now', 'bridge'])`.
Any other `##` heading → `unknown section`; a repeated one → `section … repeated`; wrong order → `sections out of order`.
A practicum may still carry «Нитка глави», «Що ми тепер знаємо», «Місток», «Підписи глави» — the parser accepts them, the
checker does not require or check them, the export keeps them.

The layer of a chapter is the `layer` of its group in `volume.json` (`path_export.py:27-37`; `LAYERS = ('prologue', 'path', 'branch', 'practicum')`, default `path`).

### 1.3 Step heading and fields

Step heading: ``### <n>. `<step-id>` — <step title>`` — `n` counts from 1 without gaps, the id is kebab-case Latin and unique in
the chapter (`path_format.py:161-168`). Inside the «Кроки» section nothing may stand before the first step.

Field line: `- **<Label>:** text`. Continuation lines of inline text are indented **2 spaces**. A field may instead be a list
of paragraphs: `  - paragraph` (2 spaces + `- `), continuation lines indented **4 spaces**. Mixing inline text and list items is an
error. Blank lines inside a step are ignored. (`path_format.py:54-78`.)

Labels (`path_format.py:24-27`) and what the checker demands (`REQUIRED = ['idea', 'text', 'action', 'takeaway', 'goal', 'terms', 'more']`, `path_format.py:29`):

| Label (exact) | export key | required | shape / rule |
|---|---|---|---|
| `Думка` (practicum, lab: `Завдання`) | `idea` | yes | one paragraph, exactly one sentence, ≤ 32 words (warning > 25) |
| `Текст` | `text` | yes | inline paragraph or 1–2 list paragraphs; ≤ 90 words in total (warning > 80); no `` ` `` and none of `= ≈ × ÷ √ ^` |
| `Дія` | `action` | yes | one paragraph |
| `Висновок` (practicum, lab: `Перевірка`) | `takeaway` | yes | one paragraph |
| `Ціль` | `goal` | yes | builder guidance: the machine-checkable condition after which the takeaway shows; not on screen, not term-checked |
| `Нові терміни` | `terms` | yes | names from `_terms.md`, separated by `,` or `·`; `—` = none; ≤ 2 |
| `Докладніше` | `more` | yes, **except in a prologue** (`path_check.py:97-98`) | inline paragraph or list of paragraphs; `—` = empty |
| `Підказки` | `hints` | no | list items or one inline; at most 2 (after 15 s and 40 s) |
| `Підписи` | `labels` → `captions` | no | inline, items separated by ` · `; each item `«A»` (always shown), `«A» → «B»` (A until the takeaway, B from it), `→ «B»` (appears at the takeaway). List items are **not** accepted here (verified: error `caption … is not «A», «A» → «B» or → «B»`) |
| `Згадати` | `recall` | no | step refs in backticks separated by `,`: `` `step` `` (same chapter), `` `chapter/step` ``, `` `volume/chapter/step` `` (`full_step`, `path_format.py:226-230`); must be an **earlier** step of a chapter that has a document |
| `Бачимо` | `see` | no | builder guidance (scene, camera, `VISUAL.md` §§); inline or list; exported, never on screen |
| `Позначки` | dropped | no | accepted and discarded — DECISIONS §60 x (`path_format.py:27-28`) |
| `Чесно` | dropped | no | accepted and discarded — DECISIONS §60 x |

`Завдання`/`Перевірка` are plain aliases of `Думка`/`Висновок` in **any** layer (`path_format.py:24-25`); all the same checks apply.
Any other label → `unknown field «…»`. A missing required field is reported with the **export key**, e.g. `lines/cell: field «goal» missing`.

Field usage in the nine circuit chapters (47 steps): `Текст`, `Дія`, `Ціль`, `Підказки`, `Нові терміни`, `Докладніше`, `Бачимо` — 47;
`Підписи` — 46; `Думка`+`Завдання` — 43+4; `Висновок`+`Перевірка` — 43+4; `Згадати` — 32. `Позначки` / `Чесно` — 0 (also 0 in `_path`).

### 1.4 How terms, actions, goals and «Докладніше» are written

- **New term**: named in `Нові терміни` by its register name (`атом`); it must occur (by the register regex) in «Текст» or
  «Висновок» of that step. Nothing is marked by hand: `path_export.mark_terms` (`path_export.py:64-82`) wraps the first match in
  `**…**` in the runtime text (first in «Текст», else in «Висновок») and records `marks[] {text, term}`. A hand-written
  `**слово**` in «Текст»/«Висновок» is allowed only on a new term of that step and then wins over the first match.
- **Order**: the register form of a term may not match any on-screen text positioned before its introducing step (§3).
- **Action**: one imperative line in «Дія»; the same action is described inside «Текст».
- **Goal**: «Ціль» states the condition in builder language, with dwell times («щонайменше 2 s»); the builder implements it as
  `StepUiSpec.goal?: When` (`docs/API_CHANGES.md:573`).
- **«Докладніше»**: numbers, units, names, dates; international units and `×`, `≈` are allowed there (`wire.md:101`: «8,5×10²²»).
  Latin words are still checked against the allowlist.
- **Captions**: every word the scene shows comes from «Підписи» in script order; scenes address them by index
  (`app/src/volumes/circuit/chapters/wire/content.ts`: `caption(step, i)`, pinned by `wire/__tests__/manifest.test.ts`), so
  reordering «Підписи» breaks scene code.

### 1.5 Layer differences

| | prologue | path | branch | practicum |
|---|---|---|---|---|
| sections required | hook, steps, bridge | hook, know, steps, thread, now, bridge | same as path | steps |
| sections forbidden | know, now | — | — | — |
| title ends with `?` | yes | yes | yes | no (`build`: «Зберіть коло самі») |
| steps | `prologueSteps` 4–5 | `chapterSteps` 4–8 | 4–8 | not limited |
| «Докладніше» | optional | required | required | required |
| new terms | none (`the prologue introduces N term(s)`) | type «шлях», ≤ 6 per chapter | type «шлях», ≤ 6 | type «практикум» only; not counted |
| «Що ми тепер знаємо» | forbidden | exactly 3 one-sentence lines | exactly 3 | free (not checked) |
| bridge must end with the next question | yes | yes | no (section still required) | no (optional section) |
| step labels in circuit | Думка / Висновок | Думка / Висновок | (no branch chapter exists anywhere yet) | Завдання / Перевірка |

"Next question" = title of the next journey entry that is not a branch (`path_export.next_chapter`, `path_export.py:51-57`); taken
from the document if it exists, else from `volume.json → journey[].title`. Comparison is `norm(bridge).endswith(norm(title))`
with lower-casing and all punctuation removed (`path_check.py:35-36,139-141`). `drain.md:166-168` ends «…зберіть коло самі.»
before the practicum.

### 1.6 Worked example — `docs/volumes/circuit/chapters/wire.md:13-35` (verbatim)

```markdown
### 1. `atoms` — Ряди атомів
- **Думка:** Мідь у дроті складається з однакових крихітних частинок — атомів, що стоять рівними рядами.
- **Текст:** Поверніться лупою до рядів кульок і тепер роздивіться їх без поспіху. Метал дроту — мідь, і вся
  вона, від кінця до кінця, складена з таких кульок. Вони однакові, стоять рівними рядами, і кожна тримається
  свого місця. До іскорок між ними ми ще дійдемо. Торкніться будь-якої кульки. Таку частинку називають атомом.
- **Дія:** Спустіться лупою до рядів кульок і торкніться однієї.
- **Висновок:** Суцільного металу немає: мідь — це рівні ряди однакових атомів.
- **Ціль:** Повзунок глибини стоїть у кінці (позначка «ряди кульок»; лупа на ближньому дроті), читач
  торкнувся однієї кульки, і її підсвічено.
- **Підказки:**
  - Покладіть лупу на дріт і ведіть повзунок глибини до кінця — до рядів кульок.
  - Торкніться будь-якої кульки в найближчому ряду.
- **Підписи:** «Глибина» · «стенд» · «усередині дроту» · «ряди кульок» → «ряди атомів» · → «атом»
- **Нові терміни:** атом
- **Докладніше:** Між центрами сусідніх атомів міді — 0,26 nm (нанометра), тобто чверть мільйонної частки
  міліметра. Поперек волосини їх стало б у ряд близько трьохсот тисяч. Рівні ряди, якими стоять атоми,
  називають кристалічною ґраткою. З атомів складається не лише мідь, а все довкола: повітря, вода, цей екран
  і ви самі. Видів атомів відомо трохи більше сотні, і мідь — один із них.
- **Згадати:** `prologue/dive`
- **Бачимо:** `VISUAL.md` §3 (проліт крізь лупу, мініатюра «де ми») і §6 (атоми: рівні ряди, три ряди у
  фокусі; вільні цятки між ними снують, але цей крок про них мовчить). Та сама сцена й той самий шлях лупи,
  що в `prologue/dive`. Остання позначка повзунка глибини підписана «ряди кульок», доки читач не дійшов висновку; відтоді
  — «ряди атомів», а над обраною кулькою з’являється підпис «атом» (§8).
```

Chapter frame around the steps (`wire.md:1-11,158-170`): `# wire — З чого зроблений дріт?` / `## Питання з життя` / `## Що ми вже знаємо`
/ `## Кроки` / … / `## Нитка глави` / `## Що ми тепер знаємо` (`1.` `2.` `3.`) / `## Місток` (ends «Наступне питання: що тримає
електрон біля ядра?») / fact-notes comment. Other references: prologue — `prologue.md` (4 steps, two-paragraph «Текст» at `:40-46`);
practicum — `build.md` (`Завдання`/`Перевірка`, `## Підписи глави`); a bare same-chapter recall — `flow.md:93` (`` `count` ``);
the smallest valid chapters — `docs/volumes/_path/chapters/_sandbox-path.md`, `_sandbox-flow.md`; the unit-test fixture —
`tools/content/test_path_format.py:16-44`.

---

## 2. `_terms.md` grammar

File `docs/volumes/<v>/chapters/_terms.md`; missing file → `_terms.md: missing (<path>)` and exit 1 as soon as `chapters/` exists
(`path_format.py:238-243`). Parser: `parse_register`, `path_format.py:190-223`.

Only three H2 headings are tables (`path_format.py:193-194`); every other H2 (circuit: `## Слова, які читач уже має`) and all prose
are ignored:

| `## ` heading (exact) | key | cells | columns as written in circuit |
|---|---|---|---|
| `Терміни шляху` | `terms` | 5 | `Термін \| Форми \| Крок \| Тип \| Картка` |
| `Слова лише для «Докладніше»` | `more` | 3 | `Слово \| Форми \| Картка` |
| `Чого на шляху немає` | `banned` | 2 | `Тема \| Форми` |

- A data row is a line that starts with `|` **and contains a backtick**; header and `|---|` rows are skipped for that reason.
- Cells are split on unescaped `|`; `\|` is a literal pipe, so regex alternation is written `\|`
  (`_terms.md:17`: `` `\bізолятор\w*\|\bізоляці\w*` ``).
- **Форми**: a Python regex in backticks, compiled `re.IGNORECASE | re.UNICODE`, applied with `.search` to on-screen text. It must
  catch every case form and nothing else (`_terms.md:13`: `` `\bяд(?:ро\|ра\|ру\|ром\|рі\|ер)\b` ``; `:18`: `` `\bзаряд(?!к)\w*\|\bзаряджен\w*` ``).
- **Крок**: `` `chapter/step` `` (or `` `volume/chapter/step` ``). A bare `` `step` `` crashes the checker with `IndexError`
  (`path_check.py:149-150`; verified in memory).
- **Тип**: exactly `шлях` or `практикум` — nothing else (`path_format.py:216-217`). Branch terms are `шлях`.
- **Картка**: the on-screen card of the term (step term card, glossary). Cards are not checked for term order, banned words or
  Latin words; `typography.py` does not touch `_terms.md`.
- A name may appear once across «Терміни шляху» + «Слова лише для „Докладніше“» (`«…» listed twice`).

How order is checked (`path_check.py:53-73,144-192`):

- Position of a step = `journey index × 1000 + step number`. Chapter `title`, `hook`, `know` sit at `index×1000 + 0.5`
  (before step 1); `bridge` and `now` at `index×1000 + 999`. A term introduced in a planned chapter without a document sits at that
  chapter's first step.
- Checked texts ("units", `path_check.py:64-73`): chapter title, hook, know, bridge, now lines; per step title, idea, text, action,
  takeaway, hints, captions. **Not** checked: «Докладніше», «Нитка глави», «Ціль», «Бачимо», «Підписи глави», term cards.
- A term form found in a unit positioned before the introducing step → error. In the introducing step itself every field may use it.
- Every `more` and `banned` form found in any unit → error. So "banned" is enforced on on-screen text only, not in «Докладніше».
- Each step's `Нові терміни` must equal the register rows that name that step; the introducing chapter must be in the journey; if
  that chapter has a document the step must exist.
- Branches: a branch chapter is an ordinary journey entry, so its terms are "later" for everything before it in `journey[]` and
  freely usable by everything after it. Nothing restricts a branch term to its branch.

---

## 3. Checks and budgets

### 3.1 BUDGETS (`tools/content/path_check.py:26-27`)

```python
BUDGETS = dict(chapterSteps=(4, 8), prologueSteps=(4, 5), chapterTerms=6, stepTerms=2, ideaWords=(25, 32),
               textWords=(80, 90), nowLines=3)
```

| key | value | meaning in code |
|---|---|---|
| `chapterSteps` | (4, 8) | steps of a path / branch chapter, inclusive; practicum exempt |
| `prologueSteps` | (4, 5) | steps of a prologue |
| `chapterTerms` | 6 | terms of type «шлях» introduced by one chapter |
| `stepTerms` | 2 | names in one step's «Нові терміни» |
| `ideaWords` | (25, 32) | **warning above 25, error above 32**; no lower bound |
| `textWords` | (80, 90) | **warning above 80, error above 90**; no lower bound |
| `nowLines` | 3 | lines of «Що ми тепер знаємо» (path, branch) |

Overrides per volume: `volume.json → "path": { "budgets": { … } }` (`path_check.budgets()`, `:47-50`); only `_path` uses it
(`"chapterSteps": [2, 8], "prologueSteps": [2, 5]`). Word count: `len(re.sub(r'[—–]', ' ', s).split())` (a non-breaking space
separates words). Sentence count: `len(re.findall(r'[.!?…](?=\s|$)', s.strip()))`.

Measured on circuit's 47 exported steps: idea 5–23 words (mean 15.0); text 23–74 (mean 50.1); action 4–12; takeaway 9–42;
«Докладніше» 28–100; hints always 2; captions 0–15.

### 3.2 Structural problems (parser) — they stop all further checks (`path_check.py:220-223`)

| where | exact text | line |
|---|---|---|
| H1 | `%s: H1 must be «# %s — <питання глави>»` | `path_format.py:101` |
| section | `%s: unknown section «%s»` · `%s: section «%s» repeated` · `%s: sections out of order (%s)` | `:136` `:138` `:157` |
| steps | `%s: text before the first step: «%s»` | `:151` |
| now | `%s: «Що ми тепер знаємо» expects numbered lines, got «%s»` | `:122` |
| step | `%s: step id must be kebab-case Latin` · `%s: step number %d, expected %d` · `%s: duplicate step id` | `:164` `:166` `:168` |
| field | `%s: unknown field «%s»` · `%s: stray line «%s»` · `%s: field «%s» repeated` · `%s: field «%s» has both inline text and paragraphs` | `:65` `:76` `:48` `:50` |
| captions | `%s: caption «%s» is not «A», «A» → «B» or → «B»` | `:179` |
| register | `_terms.md: missing (%s)` · `_terms.md: «%s» row has %d cells, expected %d` · `_terms.md: «%s»: bad form regex (%s)` · `_terms.md: «%s»: type must be «шлях» or «практикум»` · `_terms.md: «%s» listed twice` | `:241` `:205` `:210` `:217` `:222` |

### 3.3 `path_check.py` errors (printed `error: …`) and warnings (`warning: …`)

| rule | exact text | line |
|---|---|---|
| required sections by layer | `%s: section «%s» missing` | `:85` |
| prologue has no know / now | `%s: a prologue has no «%s»` | `:87` |
| title is a question (not practicum) | `%s: the title is not a question` | `:89` |
| steps per chapter | `%s: %d steps (budget %d–%d)` | `:92` |
| required fields | `%s: field «%s» missing` | `:97` |
| idea / action / takeaway one paragraph | `%s: «%s» is one paragraph` | `:101` |
| «Текст» ≤ 2 paragraphs | `%s: «Текст» has %d paragraphs (at most 2)` | `:103` |
| idea: one sentence ≤ 32 words | `%s: idea is %d sentence(s), %d words (one sentence ≤ %d)` | `:106` |
| idea > 25 words (warning) | `%s: idea has %d words (≈ %d)` | `:109` |
| text ≤ 90 words | `%s: main text has %d words (≤ %d)` | `:111` |
| text > 80 words (warning) | `%s: main text has %d words (≈ %d)` | `:113` |
| formula sign in «Текст» (`FORMULA = re.compile(r'[=≈×÷√^]\|`')`, `:28`) | `%s: main text has a code span or a formula sign` | `:115` |
| bold only on new terms («Текст», «Висновок») | `%s: «**%s**» is not a new term of this step (only new terms are marked)` | `:118` |
| hints ≤ 2 | `%s: %d hints (at most 2: after 15 s and after 40 s)` | `:121` |
| terms per step | `%s: %d new terms (budget %d)` | `:123` |
| term exists | `%s: term «%s» is not in _terms.md` | `:126` |
| term type vs layer | `%s: term «%s» of type «%s» in a %s chapter` | `:128` |
| prologue terms | `%s: the prologue introduces %d term(s)` | `:132` |
| terms per chapter | `%s: %d new terms (budget %d)` | `:134` |
| three lines | `%s: «Що ми тепер знаємо» has %d lines (%d)` · `%s: now %d is not one sentence` | `:137` `:138` |
| bridge | `%s: the bridge does not end with the next question «%s»` | `:141` |
| register → journey | `_terms.md: «%s» is introduced in %s — no such chapter in the journey` · `… — no such step` | `:152` `:155` |
| step terms = register | `%s/%s: new terms %s ≠ register %s` | `:163` |
| term used where introduced | `%s/%s: introduces «%s» but neither «Текст» nor «Висновок» uses it` | `:168` |
| sentence starts with the new term (warning) | `%s/%s: a sentence starts with the new term «%s» (phenomenon first, name after)` | `:170` |
| recall | `%s/%s: «Згадати» → unknown step %s` · `%s/%s: «Згадати» → %s is not an earlier step` · warning `%s/%s: «Згадати» into another volume (%s) is not checked` | `:177` `:179` `:175` |
| term before its step | `%s: «%s» used before %s — “%s”` | `:185` |
| «Докладніше»-only or banned word on screen | `%s: «%s» is not allowed in on-screen text — “%s”` | `:189` |
| singular address (warning; list `SINGULAR`, `:29-32`) | `%s: address the reader as «ви» — “%s”` | `:192` |
| Latin words (units + «Докладніше») | `%s: Latin word «%s» is not in the allowlist (§54)` | `:203` |
| allowlist file | `%s:%d: expected word, kind (%s), explanation, reason` · `%s:%d: duplicate entry %s` · `%s:%d: abbreviation %s has no Ukrainian explanation` | `terms_check.py:178` `:182` `:184` |

Summary line: `path[%s]: %d chapter document(s), %d step(s), %d register term(s) — %s` with `ok` or `N error(s)` (`:228-230`).
Warnings never change the exit code. The docstring's `--selftest` flag (`path_check.py:14`) has no code behind it.

Not checked by any tool: «Нитка глави»; «Ціль»; «Бачимо»; term cards; whether a step really has an interaction; formula signs
outside «Текст»; words in «Докладніше» other than Latin ones; that the H1 title equals `volume.json → journey[].title`.

### 3.4 Where the word lists live

- Banned words and «Докладніше»-only words: the tables of `docs/volumes/<v>/chapters/_terms.md` (§2). No other list.
- Singular-address words: `SINGULAR`, `path_check.py:29-32` (warning).
- Latin allowlist: global `tools/content/terms_allowlist.tsv` (466 entries) + optional `docs/volumes/<v>/terms_allowlist.tsv`
  (`chapters.py:21,61`; `terms_check.load_allowlist`, `terms_check.py:156-169`). No volume has one today.
  Row format: `word<TAB>kind<TAB>explanation<TAB>reason`, exactly 4 cells; `kind` ∈ `abbr | mark | name | symbol`
  (`terms_check.py:153`); `reason` non-empty; `explanation` is `—` unless `abbr`; `#` lines are comments.
  **A word may be listed only once across both files** → `docs/volumes/<v>/terms_allowlist.tsv:<n>: duplicate entry <word>`.
  For a path volume only membership matters; the "first mention `пояснення (ABBR)`" rule of `terms_check.check_chapter` is never
  run (`terms_check.py:337` has no `path=`).
- Exempt without an entry (`terms_check.py:108-136,197-201`): everything inside `` `code` ``; `UNITS` (`:114-117`, e.g. `V mV kV A mA
  W mW kW Hz kHz MHz GHz Ω s ms μs ns m mm cm km dB`); compounds whose `/`·`·` parts are all units (`V/m`, `km/s`); single letters;
  roman numerals; `[A-Za-zØ]\d+`; tokens with sub/superscript digits.
- Probed with the real functions: **not allowed today** — `dBm`, `bit/s`, `Mbit/s`, `kbit/s`, `nW`, `angle`, `conj`, `QPSK`, `QAM`,
  `OFDM`, `PLL`, `LDPC`, `PAL`, `SECAM`. **Already allowed** — `FM` (`terms_allowlist.tsv:134`, `FM	mark	—	діапазон радіо`),
  `Wi-Fi` (`:199`), `I`, `Q`, `I/Q`, `E`, `B`, `V/m`, `MHz`, `GHz`, `mW`, `dB`, `μs`, `ns`, `kHz`, `Ω`. An entry `Mbit` makes
  `Mbit/s` pass (compound rule).

### 3.5 Honesty marks now

- DECISIONS §60 x (`docs/DECISIONS.md:447-451`, owner, 2026-11-17): «прибирай надписи "спрощена модель", "не в масштабі" і блок
  "чесно про картинку". це все зайве» — "The reader's step panel shows neither the honesty marks nor the «Чесно про картинку» note —
  in every volume, both interfaces. … (path format: the fields become optional, never required); their text is not moved into the
  main text. Earlier rules requiring them are superseded." (This supersedes DECISIONS §5, `:22-23`.)
- Tools: `'Позначки': '-honesty', 'Чесно': '-note'` and `# «-» fields are accepted and dropped` (`path_format.py:27-28`); dropped at
  `:170`; test `test_path_format.py:73-78`. There is **no list of mark names** anywhere in `tools/content`; nothing validates them.
- Export and runtime carry no honesty field (`path_export.py:108-113,137`); `app/src/content/types.ts:121-139` (`PathStep`) has none.
- Interface: `app/src/hud-dom/step/path-body.ts:7` «(no honesty chips or «Чесно про картинку» — DECISIONS §60 x)»;
  `app/src/hud/step-ui-types.ts:187-192,261-262` "no interface renders it any more … New steps do not declare it";
  `docs/UI_API.md:267-270`; `docs/volumes/circuit/VISUAL.md:434` «Позначки чесності — скасовано»; `COPY_STYLE.md:35-36`.
- What circuit does instead: the caveat is a sentence of «Докладніше» (`wire.md:127-128`: «…його тут сповільнено в сотні мільйонів
  мільйонів разів») or an ordinary scene caption in «Підписи» (`wire.md:49`: «ядро збільшено»).

### 3.6 `docs/volumes/circuit/check.py` (plan-level checker, not part of doccheck)

Reads `PATH.md`, `PATH-ledger.md`, `REUSE.md` next to itself. `Usage: check.py [--root DIR] [--no-reuse] [--selftest]`.
`BUDGET = dict(step_terms=2, chapter_steps=(4, 8), chapter_terms=6, total_steps=(40, 55), idea_words=32)` (`:14`).
Chapter heading it recognises: `HEAD = re.compile(r'^## (Пролог|Глава \d+|Практикум)\. (.+?) — `([\w-]+)`\s*$')` (`:16`) — no
branch heading. Checks and texts: `ledger: «…» is introduced in unknown step …`; `…: new terms […] ≠ ledger […]`;
`…: N new terms (budget 2)`; `…: idea is N sentence(s), N words`; `…: no row in REUSE.md`; `…: N steps (budget 4–8)`;
`…: N new terms (budget 6)`; `…: rhythm incomplete (hook / know / thread / three lines)`; `…: the prologue introduces N term(s)`;
`…: the bridge does not contain the next question «…»`; `…: map says (…), path has (…)`; `…: «…» used before … — “…”`;
`…: «…» is not allowed in the main text — “…”`; `REUSE.md: unknown step …`; `REUSE.md: …: verdict «…»` (allowed: `як є`,
`переробити`, `нове`); `total steps N (budget 40–55)`. Unlike `path_check` it also term-checks «Нитка глави».
Run now: `OK: 0 errors`, `--selftest` → `selftest: OK — both planted faults caught`.

### 3.7 Volume-declared extra checks

`volume.json → docs.checks = [[name, path from the repo root, args…]]` is read **only** in `doccheck.main()` (classic format,
`doccheck.py:235-236`). `doccheck.main_path()` (`:252-270`) runs a fixed list: `path_check.main()`, then `typography`, `index`,
`glossary`, `export`, `runtime`, `fonts`. A path volume's `docs.checks` is never executed. Only `electricity` declares any.
`docs.extra` (extra documents for `typography.py`, `chapters.py:68`, `typography.py:236`) does work for a path volume.

### 3.8 The other doccheck groups of a path volume

- `typography` — `typography.py --check` on the chapter documents + `docs.extra` (not `_terms.md`). Fails if a file would change.
  Rules (`typography.py:4-17`): `'` inside a word → `’`; `µ` (U+00B5) → `μ` (U+03BC); `...` → `…`; ` - ` → ` — `; `-5` → `−5`;
  `"…"` → `«…»`, nested → `„…“`; U+00A0 between a number and a listed unit and in thousands groups. Probed: `64 µs` → `64 μs`
  (with NBSP), `2,4 GHz`, `0,03 V/m`, `10 mW`, `75 Ω`, `2 хв` get NBSP; `−54 dBm`, `12 Mbit/s`, `5 см`, `16 с` do not.
  Fix with `--write`.
- `index`, `glossary`, `export`, `runtime` — generated files equal a fresh run.
- `fonts` — `node app/scripts/font-coverage.mjs --volume <v>` (needs `app/node_modules`, `fontkit` 3.0.0). Path fields it reads
  (`font-coverage.mjs:56-63`): `{hook,know,bridge}`, `now.*`, `next.title`, `steps.*.{idea,text,action,takeaway}`, `steps.*.more.*`,
  `steps.*.recall.*.title`, `steps.*.terms.*.{name,card}`, `glossary.*.{name,card}`, plus `title`. Because `text` is an array in a
  path export the pattern yields nothing for it (verified on `wire.json`: 18 strings for 6 steps); hints and captions are not listed.
  So characters used only in «Текст», «Підказки» or «Підписи» are not glyph-checked.

---

## 4. Commands

All tools: pure standard library (`chapters.py:10`), run from anywhere, take `--volume <id>` (default `library.json → defaultVolume`
= `circuit`) or `--all`; an unknown id → `unknown volume 'radio' (no app/src/volumes/radio/volume.json)`, exit 1. There is no
per-chapter mode for a path volume: the unit is the volume.

| purpose | command | exit / output |
|---|---|---|
| check the scripts of one volume | `python3 tools/content/path_check.py --volume radio` | 0 ok, 1 on any error; warnings printed, exit unchanged |
| write normalised typography | `python3 tools/content/typography.py --write --volume radio` | rewrites `chapters/<id>.md` in place |
| export for builders | `python3 tools/content/export_content.py --volume radio` | writes `docs/volumes/radio/chapters/_export/<id>.json` |
| runtime content for the app | `python3 tools/content/export_runtime.py --volume radio` | writes `app/src/volumes/radio/content/generated/<id>.json` and `<id>.manifest.json` |
| index / glossary | `python3 tools/content/build_index.py --volume radio` · `python3 tools/content/build_glossary.py --volume radio` | write `docs/volumes/radio/INDEX.md`, `GLOSSARY.md` |
| any of the four, read-only | add `--check` | exit 1 and `N file(s) out of date` when a file would change |
| everything generated + gate, one volume | `tools/content/regen.sh --volume radio` | index, glossary, export, runtime, then `doccheck.py --volume radio \| tail -24`; `set -euo pipefail` |
| gate, one volume | `python3 tools/content/doccheck.py --volume radio` | last lines `doccheck[radio]: ALL GREEN` / `doccheck: ALL GREEN`, exit 0; else `N check group(s) FAILED`, exit 1 |
| gate, every volume with documents | `python3 tools/content/doccheck.py` (README: `… --all`) | run now: all four volumes green, exit 0 |
| tools' own tests | `python3 tools/content/test_path_format.py` (8 tests, OK) · `test_hotspot_ids.py` (9) · `test_simple_layer.py` (10) | `unittest`; exit 0 |
| circuit plan check | `python3 docs/volumes/circuit/check.py` | `OK: 0 errors` |

Baseline output today: `path[circuit]: 9 chapter document(s), 47 step(s), 21 register term(s) — ok`;
`path[_path]: 2 chapter document(s), 4 step(s), 3 register term(s) — ok`.

Behaviour that matters for a new volume:

- `volume_ids()` (`chapters.py:37-42`) lists a volume only if `docs/volumes/<id>/chapters/` is a directory **and**
  `app/src/volumes/<id>/volume.json` exists; then plain `doccheck.py` includes it.
- No `chapters/` directory: every tool prints `volume radio has no documents yet (docs/volumes/radio/chapters): nothing to do`, exit 0.
- `volume.json` keys the tools read: `id` (must equal the directory), `title`, `format`, `axis.label`, `axis.floors[] {id,label,value}`,
  `groups[] {id,label,layer}`, `journey[] {id,group,title,minutes,floor,parent}`, optional `order`, `docs.extra`, `path.budgets`.
- Scratch simulation (copy of the tools, synthetic `radio/volume.json`, not in the repo): with only `chapters/_terms.md` the
  check prints `path[radio]: 0 chapter document(s), 0 step(s), 4 register term(s) — ok`; `regen.sh --volume radio` writes
  `INDEX.md` (every planned chapter, each line ending `· документа ще немає`) and `GLOSSARY.md` (empty tables) and creates empty
  `_export/` and `content/generated/`. A prologue with 4 steps, no «Докладніше» and a `Позначки` field passed. A recall into a
  chapter without a document failed with `«Згадати» → unknown step radio/field/charge`.
- `path_export.sync` deletes stale files: in `_export/` every `*.json` not starting with `_`, in `content/generated/` **every**
  `*.json` that is not a current chapter's (`path_export.py:203-219,238,244`).
- Running the tests through `pytest` leaves a git-ignored `tools/content/__pycache__/`; running them as scripts does not.

How the app picks it up (`app/src/volumes/circuit/chapters/wire/`):

```ts
// index.ts
import meta from '../../content/generated/wire.manifest.json';
export default defineChapter({ id: 'wire', order: meta.order, group: 'path', ...manifestText(meta), axisValue: meta.axisValue, … load: () => import('./scene') });
// content.ts
import raw from '../../content/generated/wire.json';
const content = defineContent(raw);
```

Types: `PathStep`, `PathChapter` in `app/src/content/types.ts:121-157`. Tests that pin the link: `chapters/wire/__tests__/manifest.test.ts`
(manifest step ids/titles = generated content; captions by index), `app/src/volumes/_path/__tests__/content.test.ts`.
The closing card of a chapter is built for any layer when `now` or `bridge` is non-empty (`app/src/hud/model/path-step.ts:91-98`).

---

## 5. Export JSON schema

No JSON Schema covers the path export (`export.schema.json` is the classic format). The shape is `path_export.export_chapter`
(`path_export.py:102-123`), `SCHEMA = 1`.

Top-level keys: `schemaVersion, format, volume, id, title, layer, group, order, parent, floor, axisValue, minutes, hook, know, thread,
now, bridge, labels, next, steps, glossary`. Step keys: `id, title, idea, text[], action, takeaway, terms[] {name, card}, more[],
recall[] {target, title}, hints[], captions[] {text, until?|at?}, goal, see` (`see` is a string or a list).
Glossary rows: `{name, card, kind: 'path'|'practicum'|'more', step: 'volume/chapter/step'|null}` — the chapter's own terms plus the
«Докладніше»-only words its «Докладніше» blocks use.

`docs/volumes/circuit/chapters/_export/wire.json`, abridged (long strings cut by me with `…`; steps 2–6 and middle glossary rows omitted):

```json
{
  "schemaVersion": 1, "format": "path", "volume": "circuit", "id": "wire",
  "title": "З чого зроблений дріт?",
  "layer": "path", "group": "path", "order": 2, "parent": null,
  "floor": "ряди атомів", "axisValue": 1, "minutes": 10,
  "hook": "Дріт у пальцях гладенький і суцільний. А проте крізь нього якось проходить те, що запалює лампочку. Невже кріз…",
  "know": "Ліхтарик — це батарейка, лампочка, вимикач і два дроти; усередині дроту — ряди кульок, між якими снують іскорк…",
  "thread": "Суцільний метал? → ні, ряди атомів → а що в атомі? → ядро й електрони → …",
  "now": [
    "Дріт складається з атомів: у кожному важке ядро тримає легкі електрони.",
    "У міді зовнішні електрони вільні й безладно снують між атомами по всьому дроту.",
    "Мідь, де вільні електрони є, — провідник, а пластик, де їх немає, — ізолятор."
  ],
  "bridge": "Ядро тримає свої електрони, навіть не торкаючись їх. Що це за притягання — і чи можна ним зрушити вільні елект…",
  "labels": [],
  "next": { "id": "charge", "title": "Що тримає електрон біля ядра?" },
  "steps": [
    {
      "id": "atoms", "title": "Ряди атомів",
      "idea": "Мідь у дроті складається з однакових крихітних частинок — атомів, що с…",
      "text": ["Поверніться лупою до рядів кульок і тепер роздивіться їх без поспіху. …"],
      "action": "Спустіться лупою до рядів кульок і торкніться однієї.",
      "takeaway": "Суцільного металу немає: мідь — це рівні ряди однакових атомів.",
      "terms": [{ "name": "атом", "card": "Крихітна частинка, з яких складається все довкола. У міді однакові ато…" }],
      "more": ["Між центрами сусідніх атомів міді — 0,26 nm (нанометра), тобто чверть …"],
      "recall": [{ "target": "circuit/prologue/dive", "title": "Углиб дроту" }],
      "hints": ["Покладіть лупу на дріт і ведіть повзунок глибини до кінця — до рядів к…", "Торкніться будь-якої кульки в найближчому ряду."],
      "captions": [
        { "text": "Глибина" }, { "text": "стенд" }, { "text": "усередині дроту" },
        { "text": "ряди кульок", "until": "takeaway" }, { "text": "ряди атомів", "at": "takeaway" }, { "text": "атом", "at": "takeaway" }
      ],
      "goal": "Повзунок глибини стоїть у кінці (позначка «ряди кульок»; лупа на ближн…",
      "see": "`VISUAL.md` §3 (проліт крізь лупу, мініатюра «де ми») і §6 (атоми: рів…"
    }
  ],
  "glossary": [
    { "name": "атом", "card": "Крихітна частинка, з яких складається все довкола. …", "kind": "path", "step": "circuit/wire/atoms" },
    { "name": "кристалічна ґратка", "card": "Рівні ряди, якими стоять атоми в металі …", "kind": "more", "step": null }
  ]
}
```

Other real values: prologue — `"layer": "prologue"`, `"know": ""`, `"now": []`; practicum `build` — `"layer": "practicum"`, `"hook": ""`,
`"bridge": ""`, `"now"` 4 lines, `"labels": ["Почати з початку"]`, `"next": null`, glossary row `"kind": "practicum"`.

Runtime file `content/generated/<id>.json` (`path_export.runtime`, `:126-159`): keys `volume, id, title, group, path, steps, glossary`.
`path` = `{layer, hook, know, now, bridge, next, minutes, labels?}`. Step = `{id, title, panel[] (paragraphs of «Текст» with the new
term wrapped in **…**), terms[] {international, ukrainian, name, definition}, path {idea, action, takeaway, more[], marks[] {text, term},
recall?, hints?, captions? (only when some caption is timed)}, labels[] (caption texts in order)}`. **Not in the runtime file**:
`goal`, `see`, `thread`. Manifest `<id>.manifest.json`: `{volume, id, title, subtitle (= first step title), axisLabel, axisValue,
group, parent, order, format: "path", layer, minutes, steps[] {id, title, blurb (= idea)}}`.

---

## 6. Volume documents (`docs/volumes/circuit/`)

| file | purpose | structure (headings) | who keeps it current / status in the file | read by a tool |
|---|---|---|---|---|
| `VOLUME.md` (107 lines) | charter («Статут») | `1. Назва (три варіанти)` · `2. Обіцянка` · `3. Читач` · `4. Що читач уміє після тому` · `5. Правило необхідності й межі` · `6. Вісь подорожі і що показує карта` · `7. Наскрізна нитка` · `8. Загадка тому` | written by agent `V7-circuit-plan`; status «проєкт на розгляд власника»; owner rulings added as dated quotes | no |
| `PATH.md` (337) | the whole journey as a plan | `Карта шляху` (table `№ \| id \| Питання глави \| Поверх \| Кроків \| Нових термінів \| ≈ хв`) · one section per chapter ``## Пролог. … — `id` `` / ``## Глава N. … — `id` `` / ``## Практикум. … — `id` `` with `**Питання з життя.**`, `**Що ми вже знаємо.**`, the step table `id \| Одна думка \| Що робить читач \| Висновок \| Нові терміни \| Докладніше \| Джерело`, `**Нитка глави.**`, `**Що ми тепер знаємо.**` (1–3), `**Місток.**` · `Чесна фізика простими словами — п'ять рішень шляху` · `Де сценарії свідомо відступили від цього шляху` | planner; «Що змінено …» blocks at the top; after building: «Таблиці вище — план. … (вони — контракт); там, де сценарій відступив від рядка таблиці, діє сценарій» (`PATH.md:316-317`), one line per deviation | `check.py` only |
| `PATH-ledger.md` (70) | plan-level term register | `1. Терміни шляху (20)` (`№ \| Термін \| Форми \| Крок \| Тип \| Пояснення одним рядком`) · `2. Слова, які читач уже має` · `3. Слова лише для «Докладніше»` · `4. Чого на шляху немає зовсім` | planner; superseded in practice by `chapters/_terms.md` («перенесено з `PATH-ledger.md` без змін», `_terms.md:3`) | `check.py` only |
| `chapters/_terms.md` (68) | the register the pipeline uses; term cards | §2 above; plus prose `Слова, які читач уже має` | script writers: «їх остаточно формулює той, хто пише сценарій відповідної глави» (`_terms.md:5-6`) | **yes** (required) |
| `chapters/<id>.md` | chapter scripts — the contract for builders | §1 above | script writer; owner rulings quoted inside «Бачимо» | **yes** |
| `chapters/_export/<id>.json` | generated export | §5 | generated — never edited (DECISIONS §49) | checked |
| `INDEX.md` (114), `GLOSSARY.md` (48) | generated step index and glossary | `# <volume title> — покажчик кроків`, ``## N. `id` — title``, line `<layer> · <floor> · ≈ N хв[ · документа ще немає]`, table `Крок \| Назва \| Думка`; `# … — довідник`, `## Терміни шляху`, `## Слова з «Докладніше»` | generated | checked |
| `COPY_STYLE.md` (60) | voice of the text | `1. Речення й текст кроку` · `2. Як вводиться термін` · `3. Як звучить дія` · `4. Як звучить висновок` · `5. «Докладніше» й підказки` · `6. Чого уникаємо` · `7. Приклади` | derived from the prologue and `wire` by `C-circuit-1`; «наступні глави пишуться так само» | no |
| `VISUAL.md` (456) | visual direction and frame audit | `1. Мірило еталонного кадру` · `2. Один світ…` · `3. Поверхи й камера` · `4. Смислові кольори тому` · `5. Героїчні сцени глав і нові сцени` (5.1–5.8) · `6. «Усередині міді»…` · `7. Де збудовані сцени не дотягують…` · `8. Панель, підписи, позначки` · `9. Чек-лист аудитора кадру` | planner / visual author; cited by section from every «Бачимо» | no |
| `PATH-NOTES.md` (205) | companion: build order, platform gaps, owner questions, facts | `1. Що змінено…` · `2. Як застосовано правило необхідності` · `3. Що будувати першим` · `4. Чого бракує платформі` · `5. Питання до власника` · `6. Суперечність із docs/LIBRARY.md §3…` · `7. Що інші томи візьмуть із цього` · `8. Факти: що перевірено, а що ні` · `9. Самоперевірка читанням` · `10. Зміни 16.11…` · `11. Відкладено власником` | planner | no |
| `REUSE.md` (137) | what is taken from built `electricity` chapters | `1. Вердикти` · `2. Крок за кроком` · `3. Не беремо` · `4. Нові сцени й моделі` | planner; circuit-specific | `check.py` only |
| `check.py` (204) | plan checker | §3.6 | — | — |

Not present in circuit: `terms_allowlist.tsv`, `CURRICULUM.md`.

What a new path volume needs from day one **for the tools to be green**: `app/src/volumes/<v>/volume.json` with the journey;
`docs/volumes/<v>/chapters/` containing `_terms.md`; the generated `INDEX.md` and `GLOSSARY.md` committed (doccheck compares them
with a fresh run); `terms_allowlist.tsv` as soon as a Latin word outside the global list reaches a script. Everything else in the
table is review material, not tool input.

State of `docs/volumes/radio/` now: `CURRICULUM.md` (4543 lines), `NOTES.md` (461), `VOLUME.md` (415) of the old 48-chapter plan;
no `chapters/`; no `app/src/volumes/radio/`. No code or tool references these three files.

---

## 7. Rules of the text (review only — no tool enforces them)

Sources: `docs/volumes/circuit/COPY_STYLE.md`, `VISUAL.md §8`, DECISIONS §54, §57, §60, §6, §32.

**Address and voice**
- «до читача на ви» (DECISIONS §60 n, `:374-375`): «ви» lower case in every text of the volume and the interface. Tool: warning only.
- «Спокійна, точна й тепла людина показує іншій дорослій людині річ, яку сама любить. Не вчитель і не рекламник»; «ми» only when
  really going together (`COPY_STYLE.md:6-7`).
- No questions to the reader, no quizzes, no "guess first" in ordinary modes, practicum included (DECISIONS §60 q, `:394-400`).

**Sentence and step text** (`COPY_STYLE.md:9-15`)
- «Речення коротке: у середньому 9–10 слів, найдовше — до 20. Одне речення — одна дія чи одне спостереження.»
- «Текст кроку — 25–60 слів (межа 80), один абзац. Порядок: навіщо дивимося → що зробити → на що дивитися. Відповіді текст не каже:
  її каже висновок.»
- First sentence hooks onto the previous step's takeaway. A question in the text only if this step's action answers it.
- «Числа, імена, дати й одиниці — у „Докладніше“. Речення, без якого читач нічого не втратить, викреслюємо.»
- Step title up to six words; panel text up to 80 words; at most three captions in the scene at once (`VISUAL.md:425-431`).

**Introducing a term** (`COPY_STYLE.md:17-22`)
- Thing under a working word first, then a touch, then the name — last sentence of the text or in the takeaway: «Таку частинку
  називають атомом». Forms «…називають X», «це X». A sentence never starts with the new term (after a colon neither).
- After the introduction the working word disappears; stitch old to new once: «це й були іскорки в дроті».
- At most two names per step; in the scene the name becomes a caption at the moment of the takeaway (`→ «…»`).

**Action** (`COPY_STYLE.md:24-27`): one imperative line on «ви», 5–10 words, verb first; the thing is named exactly as its caption
on screen and the end is stated («до кінця»).

**Takeaway** (`COPY_STYLE.md:29-32`): one or two sentences the reader would say; forms «X є, а Y немає», «не А, а Б», colon as
«тобто»; no praise, no retelling; may leave a question to the next step.

**«Докладніше» and hints** (`COPY_STYLE.md:34-37`): two to four sentences, a number and a comparison with something familiar; no
«Чесно про картинку» paragraph. Hint 1 (15 s) says where the thing is; hint 2 (40 s) what to do with it and what to watch. No reproach.

**Avoid** (`COPY_STYLE.md:39-43`): «дивовижно», «неймовірно», «це просто», «відчуйте різницю», the exclamation mark; «розглянемо»,
«як відомо», «запам'ятайте», «таким чином», «варто зазначити», «цікаво, що»; convenient untruths; register words before their step;
«здійснює», «відбувається процес», «даний», «за допомогою».

**Terms and Latin** (DECISIONS §54, `:152-176`): plain Ukrainian term alone; no «English — українська» pairs; an international
abbreviation only where needed, first as «українське пояснення (ABBR)»; named laws in Ukrainian; symbols and units international.
Labels authored in chapter code follow the same rule (§54 h).

**Numbers and units**
- DECISIONS §60 u (`:434-437`, "orchestrator's reading … to be confirmed by the owner", written for `circuit`): everyday lengths and
  times with Ukrainian signs (мм, см, м, с, хв, год) in captions and spelled out in running text; electrical units international
  (V, A, Ω, W). Same in `VISUAL.md:432-433`. Seen in scripts: captions «2 хв 16 с», «5 см», «6 мм», «0,3 A»; text «шість
  міліметрів»; «Докладніше» «0,26 nm», «1 600 km/s»; «Ціль» «2 s».
- Decimal comma; thousands with a (non-breaking) space; `×10ⁿ` (DECISIONS §3, `:15-16`); Greek `μ`, never `µ` (§32, `:93`);
  apostrophe `’`; quotes «…» with „…“ inside (§18, §43). `typography.py` enforces these in the chapter scripts only.
- Superlatives and volatile figures carry a year, «станом на 2025 р.» (DECISIONS §6, `:24-25`).

**Honesty**: no marks and no note (§60 x); a simplification is said in «Докладніше» or is a scene caption.

**Mobile** (DECISIONS §57 a, `:189-191`): everything the reader must read or operate lives in the HUD; text in the 3D world is
limited to short labels.

**Facts**: sources and «перевірити» notes live in the trailing `<!-- Примітки щодо фактів … -->` comment of each script.

---

## Mismatches between the design doc and this subsystem

Design doc = `docs/superpowers/specs/2026-11-17-radio-volume-design.md`.

1. **Honesty marks.** Design `:131-133` lists the marks and says «Це перевіряють `tools/content/path_check.py` і `doccheck.py`»;
   `:466-498` assigns a mark to almost every simplification; `:478`, `:678-679`, `:739` put «спрощена модель» on every step with a
   screen and say «перелік позначок в інструментах фіксований»; `:394` writes one into a step. Code: no list exists, the fields are
   dropped (`path_format.py:27-28`), no interface renders marks (`path-body.ts:7`, `step-ui-types.ts:187-192`), and DECISIONS §60 x
   (`DECISIONS.md:447-451`) removes them "in every volume, both interfaces".
2. **Budgets read as ranges.** Design `:129-130` «Думка кроку — 25–32 слова, текст — 80–90 слів», `:810` «Остаточні тексти кроків
   (80–90 слів)». Code `path_check.py:26-27,105-113`: warning above 25 / error above 32, warning above 80 / error above 90, no minimum.
   `COPY_STYLE.md:11`: «Текст кроку — 25–60 слів (межа 80)». Circuit: ideas mean 15 (max 23), texts mean 50 (max 74).
3. **Volume's own check.** Design `:643-645` «том додає власну перевірку (рушій дозволяє додаткові перевірки у `volume.json`)».
   `doccheck.py:235-236` reads `docs.checks` only for classic volumes; `main_path` (`:252-270`) ignores it.
4. **Allowlist content.** Design `:517`, `:654-655` put «FM, QPSK, QAM, OFDM, PLL, LDPC, PAL, SECAM, I, Q, angle(…conj…)» into the
   volume's `terms_allowlist.tsv`. `FM` is already global (`terms_allowlist.tsv:134`) → `duplicate entry FM` (`terms_check.py:181-182`).
   `I`, `Q` need no entry. Missing from the design's list although the design uses them as caption units (`:450`) and in
   «Докладніше» (`:287`, `:363`), both of which are Latin-checked: `dBm`, `bit/s`, `Mbit/s`, `nW`.
5. **Micro sign and apostrophes.** Design `:450` lists «µs»; the file has 16 `µ` (U+00B5), 0 `μ`, 119 straight apostrophes.
   DECISIONS §32 (`:93`) and `typography.py:7,64` require `μ` and `’` in scripts; `typography --check` fails otherwise.
6. **Circuit is no longer "prologue and wire only".** Design `:597-599`. This copy has 9 scripts, 9 exports, 9 runtime pairs and 9
   chapter directories for circuit, including the practicum `build`.
7. **Volume document list.** Design `:614-617` omits the generated `INDEX.md` / `GLOSSARY.md` (doccheck groups `index`, `glossary`)
   and plans no `COPY_STYLE.md`, though `:651`, `:778`, `:810` rely on «COPY_STYLE» — the only one is circuit's. It keeps both
   `PATH-ledger.md` and `chapters/_terms.md`; the tools read only the latter.
8. **"Nowhere" words.** Design `:463-464` «Чого немає ніде». The tool applies the banned table to on-screen units only — not to
   «Докладніше», term cards, «Нитка глави» (`path_check.py:64-73,186-189`).
9. **Practicum bridge.** Design `:517` «містка практикум у форматі не має». The format does not require one, but the parser accepts
   «Місток» in a practicum, the export carries `bridge` and `next` (next non-branch chapter), and the panel builds a closing card for
   any layer when `now` or `bridge` is non-empty (`path-step.ts:91-98`).
10. **Pilot before chapters 1–3.** Design `:527-531`, `:793`. `lines` may use terms of `field`/`current`/`wave` (they are earlier in
    the journey) but may not «Згадати» their steps until those scripts exist (`path_check.py:176-177`); every bridge depends on the
    exact `journey[].title` of the next planned chapter.
11. **Format documents.** Design `:647-651` says they are missing and the owner adds them (decision 26, `:125`). After merge
    `63fd42c` they are still absent.

Confirmed as the design says: register types are only «шлях» / «практикум» and branch terms count against the chapter budget of 6
(`:641-643`); the prologue needs no «Докладніше» (`:244`); `regen.sh --volume radio` exists and ends in doccheck (`:653`);
`volume.json` may list the full journey before any script exists; labs as branch-layer chapters need a question title and 4–8 steps (`:422`).
