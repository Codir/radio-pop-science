# Recon E3 — chapter script format and content pipeline (path volumes)

Scope: how `docs/volumes/electronics/chapters/<id>.md` must be written so that `tools/content` accepts it, what it
turns into, and what the app reads. Read-only survey of the tree at `2707887` + working copy, 2026-11-20.
`docs/PATH_FORMAT.md` and `docs/VOLUME_STRUCTURE.md` are referenced everywhere but **absent from this mirror**:
the code below is the spec. `docs/CONTENT_EXPORT.md` describes the classic format almost only (path is one line, :137).

## 0. Verdicts

| Question | Verdict |
|---|---|
| Is `electronics` seen by the tools today? | **No.** `docs/volumes/electronics/` does not exist. `path_check --volume electronics` prints `volume electronics has no documents yet (docs/volumes/electronics/chapters): nothing to do`, exit 0; `--all` skips it (chapters.py:37-42). |
| Formulas in «Висновок» / «Підписи» / «Докладніше» | **Accepted by the tools**; only «Текст» is policed (path_check.py:114). Caveats: no `·` inside a caption (it splits captions), Latin words outside backticks need the allowlist, «Докладніше»-only words banned in Висновок/Підписи too. |
| Formulas in «Дія», «Думка», «Підказки», hook/know/now/bridge | **Not blocked by any tool** — policy only. Hints are rendered as plain text (backticks would show). |
| Where the app content comes from | `export_runtime.py` → `path_export.runtime_main` → `app/src/volumes/<v>/content/generated/<id>.json` + `<id>.manifest.json`. |
| Volume-specific `docs.checks` (ngspice oracle) in doccheck | **Not run for path volumes** (doccheck.py:252-270 ignores them; only classic `main` runs them, :236). |
| Cyrillic unit check («9 В»), mixed-script, straight quotes, panel 450 chars | Classic-only (doccheck.py:122-195); **not applied** to path volumes. |
| copy_check / terms_check / xref_check / simple_check / hotspot ids / export.schema.json | Classic-only (`run_volumes(main)` without `path=` → "not applicable"). |

## 1. Pipeline map (path format)

| Tool | Entry | Path-mode function | Reads | Writes |
|---|---|---|---|---|
| `tools/content/chapters.py` | — | `use_volume` :45-77, `run_volumes` :129-149 | `app/src/volumes/<v>/volume.json`, `library.json` | — |
| `tools/content/path_format.py` | library | `parse_chapter` :92, `parse_register` :190 | `chapters/<id>.md`, `chapters/_terms.md` | — |
| `tools/content/path_export.py` | library | `export_chapter` :102, `runtime` :126, `render_index` :166, `render_glossary` :183, `sync` :203, `_main` :230 | parsed docs | see below |
| `tools/content/export_content.py` | :883-885 | `PX.export_main` | docs | `docs/volumes/<v>/chapters/_export/<id>.json` (deletes stale `^[^_].*\.json$`) |
| `tools/content/export_runtime.py` | :359-361 | `PX.runtime_main` | docs (re-parsed, **not** `_export/`) | `app/src/volumes/<v>/content/generated/<id>.json`, `<id>.manifest.json` (deletes **any** other `*.json` there) |
| `tools/content/build_index.py` | :132-134 | `PX.index_main` | docs + volume.json | `docs/volumes/<v>/INDEX.md` |
| `tools/content/build_glossary.py` | :158-160 | `PX.glossary_main` | docs + register | `docs/volumes/<v>/GLOSSARY.md` |
| `tools/content/path_check.py` | :234-235 | `main` :219 | docs + register + allowlists | stdout |
| `tools/content/typography.py` | :273-274 (`path=main`) | `process` :183 | `CHAPTER_IDS + EXTRA_DOCS` (not `_terms.md`) | rewrites docs with `--write` |
| `tools/content/doccheck.py` | :279-280 | `main_path` :252-270 | runs the above with `--check` + `app/scripts/font-coverage.mjs` | stdout |
| `tools/content/regen.sh` | :8-12 | index → glossary → export → runtime → `doccheck … \| tail -24` | | (does **not** run typography `--write`) |

Paths come from `chapters.use_volume` (:54-61): `EXPORT_DIR` :56, `GENERATED_DIR` :57, `INDEX_PATH` :58,
`GLOSSARY_PATH` :59, `VOLUME_ALLOWLIST = docs/volumes/<v>/terms_allowlist.tsv` :61. Path volumes: `CHAPTER_IDS` =
journey ids **that have a file** (:74-77); `PLANNED` = all journey ids (branches included).

Every path entry point takes `--check` (exit 1 when a file would change) and `--volume <id>` / `--all`
(default: `library.json → defaultVolume` = `circuit`). `--check` still `os.makedirs` the output dir (path_export.py:205).

### Command outputs (verified on circuit/radio)
```
path_check:   [warning: <msg>]* [error: <msg>]* then
              path[circuit]: 9 chapter document(s), 47 step(s), 21 register term(s) — ok | N error(s)
export etc.:  path export[circuit]: 9 chapter(s), up to date | N file(s) out of date | N file(s) written
              (structural failure: "path: <problem>" lines, then "path export: N structural problem(s)", exit 1)
typography:   typography: all documents are normalised | typography: N document(s) need normalisation (--check)
              <file> lines changed: N nested-quote blocks: N … ; typography: N document(s) rewritten (--write)
doccheck:     <path_check output>, then per group "  typography  ok — <last line>" (index, glossary, export,
              runtime, fonts), then "doccheck[circuit]: ALL GREEN | N check group(s) FAILED", and with
              run_volumes: "doccheck: ALL GREEN | FAILED"; multi-volume runs prefix "── volume <id>".
fonts line:   OK: every character is in every web font stack (9 WOFF2 faces)
unit tests:   python3 tools/content/test_path_format.py  → "Ran 8 tests … OK"
```
Warnings never fail. `doccheck` path groups: `path`, `typography`, `index`, `glossary`, `export`, `runtime`, `fonts`.

## 2. Chapter document grammar (`path_format.py`)

Pre-pass: every `<!-- … -->` is deleted before parsing (:30, :96) — fact notes may live in a trailing HTML comment
(circuit puts «Примітки щодо фактів» there), and inline comments inside fields are fine.

**H1** (first non-blank line, :98-103): `# <id> — <chapter question>` — regex :12
`^# ([A-Za-z0-9_][A-Za-z0-9_-]*) — (.+?)\s*$` (em dash with spaces); `<id>` must equal the file name.

**H2 sections** (:20-22, exact names, this order, each at most once; unknown → error; order checked :155-157):

| H2 | key | Content rule | On screen |
|---|---|---|---|
| `## Питання з життя` | hook | all non-blank lines joined by spaces (:113, :127) | opening card of step 1 |
| `## Що ми вже знаємо` | know | joined lines | opening card |
| `## Кроки` | steps | only `### …` steps; any non-blank line before the first step → error (:149-152) | — |
| `## Нитка глави` | thread | joined lines | guidance only (export, not runtime) |
| `## Що ми тепер знаємо` | now | numbered lines `N. text` (:16); continuation lines must start with **3 spaces** (:119); anything else → error | closing card |
| `## Місток` | bridge | joined lines | closing card |
| `## Підписи глави` | labels | every `«…»` in the section (:123-125) | `[0]` = «start over» button at the journey's end |

Required sections by layer (path_check.py:83-87): prologue = hook, steps, bridge (and **no** know/now);
practicum = steps only; path and branch = hook, know, steps, thread, now, bridge. Layer = `groups[].layer` of the
chapter's group in volume.json (path_export.py:27-37).

**Step heading** (:14): `### <n>. \`<step-id>\` — <title>` — `n` = 1,2,3… consecutive (:165); id kebab-case
`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` (:17), unique in the chapter (:167).

**Field lines** (:15, :54-78): `- **<Name>:** <inline text>` — colon *inside* the bold. Value forms:
- inline: text after the label; continuation lines indented **2 spaces** → joined with spaces → a string;
- paragraphs: no inline text, then items `  - <paragraph>` (2 spaces + `- `), item continuation indented **4 spaces**
  → a list of strings;
- inline **and** items → error; repeated field → error; unknown field name → error; blank lines are ignored; any
  other line (`---`, tables, fences, 2-space line after items started) → `stray line` error.
- `—`, `-` or empty = "none" for list-like fields (:34).

### Step fields (FIELDS :24-27, REQUIRED :29)

| Field | Key | Req. | Grammar / limits (path_check line) | Where it goes |
|---|---|---|---|---|
| **Думка** (practicum may write **Завдання**) | idea | yes | one paragraph (:99-101); exactly **1 sentence** (`[.!?…]` followed by space/end, :43-44) and ≤ **32 words** = error, > **25** = warning (:105-109) | manifest `steps[].blurb`, map/step lists, INDEX table; not in the panel |
| **Текст** | text | yes | ≤ **2 paragraphs** (:102-103); ≤ **90 words** error, > **80** warning (:110-113); **no** `= ≈ × ÷ √ ^` and **no backtick** (:28, :114); `**…**` only around the step's new terms (:116-119) | runtime `steps[].panel[]` (1–2 pages), rich text |
| **Дія** | action | yes | one paragraph | panel «Що зробити», rich |
| **Висновок** (practicum may write **Перевірка**) | takeaway | yes | one paragraph; `**…**` only new terms; formulas allowed by tools | panel «Висновок», shown when stepUi `goal` holds; rich (backticks → yellow mono) |
| **Ціль** | goal | yes | free text, not checked | guidance for the builder (`stepUi.goal`, step-ui-types.ts:271-275); export only |
| **Нові терміни** | terms | yes | names from `_terms.md`, separated by `,` or `·`; `—` none (:85-89, :171); ≤ **2** per step (:122) | term cards; marks in text |
| **Докладніше** | more | yes (**optional in a prologue**, :97-98) | inline or items; `—` = empty; no word limit; Latin-checked | collapsed «Докладніше», rich |
| **Підказки** | hints | no | items, or one inline hint; ≤ **2** (:120-121) | after 15 s / 40 s (path-step.ts:104), **plain text** (path-body.ts:248) |
| **Підписи** | labels | no | captions separated by `·`; each item `«A»` (always) · `«A» → «B»` (A until takeaway, B from it) · `→ «B»` (appears at takeaway) (:32-33, :176-185) | runtime `steps[].labels[]` (+ `path.captions` timing) |
| **Згадати** | recall | no | refs separated by `,`/`·`: `` `step` `` · `` `chapter/step` `` · `` `volume/chapter/step` `` (backticks optional, full_step :226-230) | «Згадайте: <title>» buttons |
| **Бачимо** | see | no | free text | guidance (export only) |
| **Позначки**, **Чесно** | dropped | no | accepted and discarded (DECISIONS §60 x) | — |

No field order is enforced. Word counts (`words` :39-40): split on whitespace after dashes → spaces; numbers and
unit symbols count; NBSP splits.

### Captions addressed from code
- Export keeps `captions: [{text, until?: 'takeaway', at?: 'takeaway'}]`; runtime `steps[].labels = [c.text …]`
  (path_export.py:144-147) and `path.captions` **only if** some caption has a timing.
- Index rule: `«A»` → 1 slot; `«A» → «B»` → 2 slots (A, then B); `→ «B»` → 1 slot. Example circuit
  `resistance/bumps`: `«позначений електрон» · «удар» · → «опір»` → `[0] позначений електрон, [1] удар, [2] опір`.
- Code pattern (copy for electronics): `app/src/volumes/circuit/chapters/resistance/content.ts:1-17` —
  `defineContent(raw)` from `../../content/generated/<id>.json` and `caption(step, i)` that throws on a missing
  index; scenes call `caption('balance', 0)` (steps/04-balance.ts:128). Test pattern
  `…/resistance/__tests__/manifest.test.ts:18-32` (`it.each([step, i, text])`, compares after `split(NBSP).join(' ')`).
- **Timing is not consumed by the platform**: no code reads `path.captions`; the chapter shows «B» at the takeaway itself.
- 3D `Label` parses rich markup by default (`app/src/ui3d/widgets/label.ts:101`), so a caption `` «`I = U / R`» ``
  would render as a formula; HUD hints do not.

## 3. Register `chapters/_terms.md` (parse_register :190-223) — how terms are declared

Only three H2 headings are read (:193-194); any other H2 (e.g. `## Слова, які читач уже має`) resets to "ignore".
A table row is parsed only if it starts with `|` **and contains a backtick** (:200) — a row without a backticked
regex is silently skipped. Cells split on unescaped `|`; write `\|` for regex alternation (:37-40).

| H2 | Cells | Columns |
|---|---|---|
| `## Терміни шляху` | 5 | Термін · Форми (`` `regex` ``) · Крок (`` `chapter/step` ``) · Тип (`шлях` \| `практикум`) · Картка |
| `## Слова лише для «Докладніше»` | 3 | Слово · Форми · Картка |
| `## Чого на шляху немає` | 2 | Тема · Форми |

Regexes compile with `IGNORECASE | UNICODE` (:208); bad regex → error; a name twice across terms+more → error (:221-222).
Wrong cell count → error. Тип other than шлях/практикум → error.

Checks on the register (path_check.check_terms :144-192, positions :53-61 = journey index × 1000 + step number;
hook/know/title at +0.5, bridge/now at +999; a chapter without a document sits at its +1):
- the term's chapter must be in the journey (cross-volume steps are rejected); if that chapter has a document, the
  step must exist (:148-157). Register rows for chapters not yet written are fine.
- each step's «Нові терміни» set **equals** the register terms whose Крок is that step (`new terms […] ≠ register […]`, :158-163);
- every term a step introduces must match (regex) in its «Текст» or «Висновок» (:164-168); warning when a sentence
  starts with it (:169-171);
- **order**: any register term regex found in on-screen text at a position earlier than its step → error
  `«<term>» used before <v/ch/step> — “<match>”` (:180-185). On-screen units (:64-73): chapter title, hook, know,
  bridge, now lines, and per step title, idea, text, action, takeaway, hints, labels. Not scanned: Докладніше, Ціль,
  Бачимо, Нитка, Підписи глави;
- «Докладніше»-only words and «Чого на шляху немає» topics anywhere in those units → error (:186-189);
- singular address («ти», «натисни»…) → warning (:29-32, :190-192);
- per chapter: ≤ 2 terms per step, ≤ **6 `шлях` terms per chapter** (:133-134); prologue introduces none (:131-132)
  and any `практикум` term outside a practicum (or `шлях` inside one) → type error (:127-128).
- Latin words (check_latin :195-204): on-screen units **plus Докладніше**; code spans exempt; units / single letters
  / Roman numerals / `X123` exempt (terms_check.py:120-136); the rest must be in `tools/content/terms_allowlist.tsv` or
  `docs/volumes/<v>/terms_allowlist.tsv` (TAB-separated: word, kind ∈ abbr|mark|name|symbol, explanation(s) `|`-separated
  or `—`, non-empty reason; a word once across both — terms_check.py:156-185). The classic "abbreviation explained at
  first mention" rule is **not** applied in path volumes.

Export side: `mark_terms` (path_export.py:64-82) bolds the first regex match of each new term in Текст (else in
Висновок); a hand-written `**…**` that matches the term wins. The **regex match is the linked span**, so the form
regex must cover the whole phrase you want linked. Glossary per chapter (:114-118): the step's terms (kind
`path`/`practicum`, step address) + every «Докладніше» word used in this chapter's Докладніше (kind `more`, step null).
`GLOSSARY.md` has «Терміни шляху» and «Слова з «Докладніше»» tables.

## 4. Chapter-level checks (path_check.check_chapter :80-141)

- title ends with `?` unless practicum (:88-89);
- steps: prologue **4–5**, path/branch **4–8**, practicum unlimited (:26, :90-92);
- `Що ми тепер знаємо`: path/branch exactly **3** lines, each one sentence (:135-138); practicum unlimited; prologue forbidden;
- bridge (prologue and path only; not branch, not practicum) must **end with the next non-branch chapter's question**
  (lower-cased, punctuation stripped, :35-36, :139-141): next = next prologue/path/practicum journey entry
  (branches skipped, path_export.py:51-57), its title = its document's H1 if written, else `volume.json` title.
- Budgets can be overridden per volume: `volume.json → path.budgets` with keys `chapterSteps`, `prologueSteps`,
  `chapterTerms`, `stepTerms`, `ideaWords`, `textWords`, `nowLines` (:47-50; sandbox `_path` uses `chapterSteps [2, 8]`).

## 5. What the exporter writes

`_export/<id>.json` (export_chapter :102-123): `schemaVersion: 1`, `format: 'path'`, `volume`, `id`, `title`, `layer`,
`group`, `order` (1-based journey index, branches counted), `parent`, `floor` (floor label), `axisValue`, `minutes`,
`hook`, `know`, `thread`, `now[]`, `bridge`, `labels[]`, `next {id,title}|null`, `steps[] {id, title, idea, text[],
action, takeaway, terms[{name, card}], more[], recall[{target, title}], hints[], captions[], goal, see}`,
`glossary[{name, card, kind, step}]`. Not validated by `export.schema.json` (classic, v2).

Runtime `content/generated/<id>.json` (runtime :126-159; types `app/src/content/types.ts:121-157`): `volume, id,
title, group, path {layer, hook, know, now, bridge, next, minutes, labels?}, steps[] {id, title, panel[] (text
paragraphs, terms bolded), terms[{international=ukrainian=name, definition=card}], path {idea, action, takeaway,
more[], marks[{text, term}], recall?, hints?, captions?}, labels?}, glossary[]`. Guidance (`goal`, `see`, `thread`)
is dropped.
Manifest `<id>.manifest.json` (:155-158): `volume, id, title, subtitle (= first step title), axisLabel (floor label),
axisValue, group, parent, order, format, layer, minutes, steps[{id, title, blurb = Думка}]`.

App consumption: `chapters/<id>/index.ts` → `defineChapter({ id, order: meta.order, group: meta.group,
...manifestText(meta), axisValue: meta.axisValue, theme, load: () => import('./scene') })` (circuit
`resistance/index.ts:28-36`; `manifestText` app/src/content/meta.ts:12-27); `content.ts` → `defineContent(raw)`
(app/src/content/define.ts:29-89). Registration of a chapter is the file `chapters/<id>/index.ts`
(`app/src/volumes/electronics/chapters.ts:6` globs `./chapters/*/index.ts`). HUD model `app/src/hud/model/path-step.ts:66-101`,
DOM `app/src/hud-dom/step/path-body.ts`: text :141, action :147, takeaway :151-156, recall :160-161 (label
`r.title || r.target`), more :167-171 — all via `prose()` = rich; hints :248 plain. Rich markup
(`app/src/text/rich.ts:1-15`, `markup.ts:12-17`): `**b**`, `_i_`, `` `formula` `` (mono, yellow; ≤ 28 chars never
wraps, markup.ts:20), `x^2`, `^{…}`, `_{…}`, `X_ab` → subscript, `{cyan:…}` colour, `\` escapes; number–unit space
made non-breaking.

## 6. Registering the electronics scripts — sequence

1. `app/src/volumes/electronics/volume.json` already has `"format": "path"`, 19 journey entries, groups with layers
   (prologue, path×5 groups, practicum, branch). Nothing else to register there.
2. Create `docs/volumes/electronics/chapters/` **with** `_terms.md` (the three H2 tables). The directory alone puts
   the volume into `--all` (chapters.py:37-42); without `_terms.md` every path tool fails with
   `_terms.md: missing (…)` (path_format.py:238-243).
3. Optional `docs/volumes/electronics/terms_allowlist.tsv` for Latin words the global list lacks.
4. Write `chapters/<id>.md` named exactly as the journey id (other names are silently ignored, chapters.py:76-77).
5. `python3 tools/content/typography.py --write --volume electronics` (regen.sh does not), then
   `tools/content/regen.sh --volume electronics` → `INDEX.md`, `GLOSSARY.md`, `_export/*.json`,
   `app/src/volumes/electronics/content/generated/*.json`, doccheck. Gate: `python3 tools/content/doccheck.py --all`
   (CI: `.github/workflows/pages.yml:60`).
6. App: `chapters/<id>/{index.ts, content.ts, …}` importing the generated files (`@electronics/*` alias exists in
   `app/tsconfig.json:24`).

Minimal skeleton that passes the parser (path chapter):
```
# resistor — Навіщо схемі деталь, яка лише заважає струму?
## Питання з життя / ## Що ми вже знаємо / ## Кроки
### 1. `step-id` — Назва
- **Думка:** … (one sentence)
- **Текст:** … (≤ 90 words, no = ≈ × ÷ √ ^ `)
- **Дія:** …
- **Висновок:** … `I = U / R` …
- **Ціль:** …
- **Підказки:**
  - …
  - …
- **Підписи:** «…» · → «…»
- **Нові терміни:** резистор
- **Докладніше:**
  - …
- **Згадати:** `meter/volts`
- **Бачимо:** …
## Нитка глави / ## Що ми тепер знаємо (1. 2. 3.) / ## Місток (ends with the next question)
```

## 7. Reference documents (structure only)

- `docs/volumes/circuit/chapters/*.md`: 9 scripts; steps per chapter prologue 4, wire 6, charge 6, battery 4, flow 8,
  resistance 4, lamp 6, drain 5, build 4. `resistance.md` (170 lines) = model path chapter (formulas only as words
  and «:» inside Докладніше/Бачимо); `prologue.md` (183) = no know/now, Докладніше inline, «Бачимо» as items;
  `build.md` (148) = practicum with Завдання/Перевірка, `практикум` term `коротке замикання`, 4-line «Що ми тепер
  знаємо», no Місток, `## Підписи глави` «Почати з початку». Fact notes in a closing `<!-- … -->`.
- `docs/volumes/circuit/chapters/_terms.md` (68): 21 path terms, «Слова, які читач уже має» (prose, ignored by
  tools), 14 «Докладніше» words, 4 banned-topic rows. `docs/volumes/radio/chapters/_terms.md` (108): 41 terms, no
  chapter docs yet, `_export/` empty — the model of "register first, scripts later". `docs/volumes/_path/chapters/`
  `_sandbox-path.md` (65) = smallest complete example (inline single hint, `→` caption).
- `circuit/COPY_STYLE.md` §1 sentence & step text (25–60 words, one paragraph), §2 introducing a term, §3 action
  (5–10 words, verb first), §4 takeaway (1–2 sentences), §5 Докладніше 2–4 sentences + hints 15 s/40 s, §6 avoid,
  §7 examples. `radio/COPY_STYLE.md` §1 from circuit, §2 units, §3 abbreviations/Latin, §4 working words, §5 never
  say, §6 caveats.
- `circuit/GLOSSARY.md`, `INDEX.md`: generated (`<!-- Generated by tools/content/path_export.py … -->`).
- `circuit/PATH.md` (337): status blockquotes, promise/reader/necessity/thread, «Карта шляху» table, per chapter
  `## Глава N. <question> — \`id\`` with hook, know, step table (id · Одна думка · Що робить читач · Висновок · Нові
  терміни · Докладніше · Джерело), thread, now, bridge. `PATH-NOTES.md` §1–11 (changes, necessity rule, build order,
  platform gaps, owner questions, facts, self-read). `PATH-ledger.md` §1 terms, §2 known words, §3 Докладніше
  words, §4 nowhere. `docs/volumes/circuit/check.py` checks PATH.md (not the scripts; not run by doccheck).

## Gotchas

1. **Titles and bridges vs term order.** Chapter titles are on-screen units at position +0.5 of their chapter, and
   every bridge ends with the next chapter's title. Probe (scratch, electronics volume.json, register `напруга` at
   `meter/volts`): prologue bridge ending «Як побачити напругу, струм і форму сигналу?» →
   `prologue: bridge: «напруга» used before electronics/meter/volts — “напругу”`. Same trap for: meter's own title
   (напруга/струм/сигнал introduced inside meter), prologue title «…динаміком?», capacitor title and divider's
   bridge («конденсатор»), filter's bridge → «діод», diode's bridge → «світлодіоди». Circuit's titles use only
   terms from earlier chapters.
2. **`·` splits captions** before parsing: `«P = U·I» · «лампа»` → two caption errors (probe). Use `×` (or write
   the formula without the dot) inside «Підписи»; `·` is fine in Висновок/Докладніше. `·` and `,` also split
   «Нові терміни» and «Згадати» (a term name with a comma cannot be introduced).
3. Typography (`--check` in doccheck) rewrites outside code spans: spaced ` - ` → ` — ` (a minus must be `−`
   U+2212), `-5` after space/«/= → `−5`, `...` → `…`, `µ` → `μ`, straight quotes → «» / „“, and inserts NBSP
   between a number and a unit (also inside code spans with spaces) — captions get NBSP (`«9 V»` → `«9 V»`),
   chapter tests must normalise. Path docs have no off-screen sections, so NBSP rules apply everywhere, comments
   included. `_terms.md` cards are **not** typography-checked.
4. Formula ban covers only «Текст» (`[=≈×÷√^]` or a backtick). `·`, `:`, `/`, `<`, `±` pass even there; Дія, Думка,
   Підказки, hook, know, now, bridge are not policed at all.
5. Hints render as plain text (no formulas, no bold). Takeaway/more/text/action/hook/know/now/bridge are rich: `_`,
   `^`, `{`, `*` are markup there — escape with `\` when literal.
6. `**…**` in Текст/Висновок only around the step's own new terms (`«**X**» is not a new term of this step`).
7. Latin outside backticks in on-screen fields **and Докладніше** must be allowlisted: NPN, PNP, hFE, SMD, RC,
   TO-92, MP3, BC547, Ohm are **not** allowed today (probe); LED, DC, AC, MOSFET, RMS, THD, USB, AA, IEC, GaN,
   InGaN, GaAs, AlGaInP, Ge, Si are. Units (V, mA, kΩ, μF, Hz, …), single letters (U, I, R), `E12`, `R₁` pass.
8. «Докладніше»-only words are banned in Висновок/Підписи/Підказки too (they are on-screen units) — e.g. if «ом»
   is a more-word, «Ом» in a formula caption fails; write Ω.
9. Register: Крок must be `chapter/step` (a bare `step` raises IndexError in check_terms :150); a row without any
   backtick is silently skipped; regexes are case-insensitive; the regex match is what gets bolded/linked.
10. Once a chapter document exists, its register rows must match real steps and «Нові терміни» exactly.
11. Prologue: «Докладніше» optional, no know/now, zero terms of any type. Practicum: bridge unchecked, `now`
    unlimited, closing card appears only if `now` or `bridge` exists (path-step.ts:91-92). `lab` is the last
    non-branch entry → `next = null` → its `## Підписи глави` `[0]` is the restart caption; branches also get
    `next = null` (closing card behaves like the journey's end).
12. Branches use the path budgets (4–8 steps, 3 «now» lines, hook/know/thread required); the design's "3–6 step
    branches" needs `path.budgets` or 4+ steps. Branch terms count as `шлях` and are "earlier" for later main
    chapters (positions follow journey order, branches included).
13. Idea must end with `.`/`?`/`!`/`…` followed by space or end: `…«так»` without a period = 0 sentences = error;
    `т. д.` = 2 sentences = error.
14. Layout traps: `Що ми тепер знаємо` continuation needs 3 spaces; field item continuation 4 spaces; `---`,
    tables, fences inside a step → stray line; a `###` line in a non-step section is silently merged into its text.
15. Captions `→` timing is data only — no platform consumer of `path.captions`; `«A» → «B»` takes two indexes.
16. Cross-volume «Згадати» (`circuit/resistance/bumps`) → warning `not checked`, export title `''`, button shows the
    raw address.
17. H1 title vs `volume.json` journey title is not compared by any tool (the map shows the journey title until the
    chapter is built; the previous bridge switches to the H1 once the doc exists).
18. `sync` deletes every `*.json` in `content/generated/` it did not produce, and non-underscore JSON in `_export/`.
19. Font coverage (font-coverage.mjs:55-63) skips path `steps.*.text` (a list), hints, captions and chapter labels —
    formula characters only in captions (Ω, ≈, ×, −, ₁) are unchecked.
20. `volume.json → docs.checks` and the classic checks (Cyrillic units, mixed script, panel 450) do not run for path
    volumes — the electronics `check.py` (batch E1-8) is the only place to enforce them.

## Open questions

1. Electronics register for words the reader has from `circuit` (напруга, струм, опір, заряд): list them as
   terms (then nothing before their step may use them — prologue bridge, meter title) or keep them as known words
   without cards? Needs the E1-8 `PATH-ledger.md` decision before E3 scripts.
2. Titles containing later terms (конденсатор in `capacitor`, діод/світлодіоди reached by bridges, «динамік»,
   «сигнал»): change titles in volume.json, introduce the word earlier, or narrow the form regex?
3. Formula captions: product sign `×` vs juxtaposition; wrap in backticks inside «…» (3D Label renders it as a
   formula) or plain?
4. Should `docs/volumes/electronics/check.py` add what the tools skip: no formula signs in Дія/Думка/Підказки/hook/
   now/bridge, Latin unit symbols only, «Підписи» formula count ≤ 1 per step, H1 = journey title?
5. Allowlist entries the pilot chapters will need (NPN/PNP/hFE/SMD/E-series/part numbers) — volume file or global?
6. Does E1-8 also create `chapters/_terms.md` (radio check.py rule 3 compares ledger and register)? Its file list
   does not name it, but E3 cannot start without it.
7. Practicum `build`/`lab`: closing card content («Що ми тепер знаємо», Місток to «Вільний стенд»), and the
   restart caption in `lab`'s `## Підписи глави`.
8. Who runs the ngspice oracle in the document gate, since `docs.checks` is not run for path volumes?
