# Volume anatomy — path-format volume (reference: `circuit`) and what a new volume `radio` needs

Repository: `/home/pilot/tmp/radio-science-pop` at commit `63fd42c` (working tree clean before and after this run).
All paths are repo-relative. Every statement comes from a file opened in this run; items marked **[probe]** were
additionally executed in a throw-away copy of the tree (never in the repository):

- full tree + probe volume: `/tmp/claude-1000/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/scratchpad/plan/understand/va-probe/repo`
- single-volume "site profile": `/tmp/claude-1000/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/scratchpad/plan/understand/va-probe/site`

Tool versions used by the probe: node `v22.22.2` (the machine's default; the design asks for Node 24), binaries from
`app/node_modules/.bin` (`vitest` 5.1.0, `tsc` 6.0.3, `vite` 8.3.8, `eslint` 10.14.0), `python3`.

Documents that code and docs refer to but that do **not exist in this copy**: `docs/PATH_FORMAT.md`,
`docs/VOLUME_STRUCTURE.md`, `docs/PLAN.md`, `docs/AGENT_GUIDE.md`, `docs/MOBILE.md`, `docs/HUD_DOM.md`, `docs/briefs/`,
`docs/requests/`, `docs/reports/`, `docs/ideas/`. `docs/CONTENT_EXPORT.md` exists but does not mention the path format.
`docs/volumes/radio/` exists and holds only the old plan: `CURRICULUM.md` (4543 lines), `NOTES.md`, `VOLUME.md` — there
is no `docs/volumes/radio/chapters/` and no `app/src/volumes/radio/`.

---

## 1. File set of a volume

### 1.1 `app/src/volumes/circuit/` (the reference)

| Path | Hand-written / generated | Who reads it |
|---|---|---|
| `volume.json` (38 lines) | hand-written data | `volume.ts` (import); `app/vite.config.ts:25-32` (`libraryTitle()` — only for the default volume); `tools/content/chapters.py:33-34,45-77` (`volume_meta`, `use_volume`); `tools/content/path_export.py:27-37` (`journey()`); `app/src/engine/__tests__/volumes.test.ts:12` (glob `../../volumes/*/volume.json`) |
| `volume.ts` (28 lines) | hand-written | `app/src/engine/discover.ts:20-23` (`import.meta.glob(['../volumes/*/volume.ts','!../volumes/_*/volume.ts'], { eager: true })`; dev volumes `'../volumes/_*/volume.ts'` lazy); `volumes.test.ts:11` |
| `chapters.ts` (6 lines, "Never edited … copy it when starting a volume") | copied verbatim | `discover.ts:24` (`import.meta.glob('../volumes/*/chapters.ts')`, lazy → chunk `volume-<id>`, `vite.config.ts:67-68`); existence asserted by `volumes.test.ts:38` |
| `chapters/<id>/index.ts` | hand-written | globbed by `chapters.ts` (`import.meta.glob('./chapters/*/index.ts', { eager: true })`); `volumes.test.ts:15` |
| `chapters/<id>/content.ts` | hand-written (5–17 lines) | `app/src/content/loader.ts:9` (`import.meta.glob('../volumes/*/chapters/*/content.ts')`, lazy); the chapter's own scene |
| `chapters/<id>/scene.ts` | hand-written | `index.ts` → `load: () => import('./scene')` (chunk `chapter-<volume>-<id>`, `vite.config.ts:65-66`) |
| `chapters/<id>/chapter.ts`, `world.ts`/`stand.ts`/`bench.ts`, `shots.ts`, `layout.ts`, `steps/NN-<step>.ts`, `parts/*.ts` | hand-written, chapter-private | the chapter's `scene.ts` only (lint `local/chapter-boundary`, `app/eslint-rules/chapter-boundary.js`) |
| `chapters/<id>/__tests__/*.test.ts` | hand-written | vitest (`vite.config.ts:79` `include: ['src/**/*.test.ts']`) |
| `chapters/<id>/qa/interactions.mjs`, `qa/helpers.mjs` (+ `qa/steps-b.mjs` in `lamp`) | hand-written Playwright scripts | run by hand: `node app/src/volumes/circuit/chapters/wire/qa/interactions.mjs --port 5286 [--size 1280x720] [--out <dir>]` (header of the file); import `tools/qa/lib.mjs`, `tools/qa/sheet-tab.mjs`, `tools/qa/next-chapter.mjs` |
| `chapters/<id>/README.md` | hand-written | people |
| `content/generated/<id>.json`, `<id>.manifest.json` (9 chapters × 2) | **generated** by `python3 tools/content/export_runtime.py --volume circuit` (part of `bash tools/content/regen.sh --volume circuit`) | `content.ts` imports `<id>.json`; `index.ts` imports `<id>.manifest.json`; tests import both |
| `shared/stage/**`, `shared/copper/**`, `shared/world/**` (+ `README.md`, `__tests__/`) | hand-written scene library of the volume | chapters of the volume via `@circuit/shared/...`; dev-volume chapters may import it too (`chapter-boundary.js:27` `showcase`) |

`circuit` has **no** `sim/` and no `fixtures/` directory; `electricity` has both. There is no `emblem.ts` in any `circuit`
chapter.

File sets of the three chapters asked for (`app/src/volumes/circuit/chapters/`):

| Chapter | Files |
|---|---|
| `prologue` | `index.ts` (17 l.), `content.ts` (5), `scene.ts` (157), `shots.ts` (11), `steps/{clock,dive,map,parts,riddle,switch,unfold}.ts`, `steps/__tests__/clock.test.ts`, `qa/{helpers,interactions}.mjs`, `README.md`. No `chapter.ts`, no `__tests__/manifest.test.ts`, no `parts/`. |
| `wire` | `index.ts` (18), `content.ts` (17, exports `caption(step, i)`), `chapter.ts` (46: `STEP_IDS`, `StepId`, `Chapter`, `StepModule`, `StepFactory`, `sessionGoals`), `scene.ts` (106), `world.ts` (75), `steps/01-atoms.ts … 06-plastic.ts`, `parts/{electron-proxies,proxies,ring}.ts`, `__tests__/manifest.test.ts`, `qa/{helpers,interactions}.mjs`, `README.md` |
| `charge` | as `wire` plus `layout.ts` (28); `steps/01-rub.ts … 06-shift.ts`; 15 files in `parts/`; `__tests__/manifest.test.ts`; `qa/…`; `README.md` |

Verbatim chapter manifest (`app/src/volumes/circuit/chapters/wire/index.ts:1-18`):

```ts
import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/wire.manifest.json';

export default defineChapter({
  id: 'wire',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
```

(`prologue/index.ts:12` uses `group: meta.group` instead of a literal.) Verbatim `content.ts`
(`prologue/content.ts:1-5`):

```ts
import { defineContent } from '@/content';
import raw from '../../content/generated/prologue.json';

export default defineContent(raw);
```

The per-chapter manifest test (`wire/__tests__/manifest.test.ts:7-13`) pins `manifest.steps` ids/titles and
`STEP_IDS` to `@circuit/content/generated/wire.json`.

### 1.2 `docs/volumes/circuit/`

| Path | Hand-written / generated | Who reads it |
|---|---|---|
| `chapters/<id>.md` (9 files) | hand-written, path format | `tools/content/path_format.py` (`parse_chapter`), via `path_export.py`, `path_check.py` |
| `chapters/_terms.md` | hand-written register (tables under `## Терміни шляху`, `## Слова лише для «Докладніше»`, `## Чого на шляху немає`) | `path_format.py:238-243` `load_register` — **required** once `chapters/` exists (`'_terms.md: missing (%s)'`) |
| `chapters/_export/<id>.json` | **generated**: `python3 tools/content/export_content.py --volume circuit` | `export_runtime.py` chain (in memory, same run), `app/scripts/font-coverage.mjs` |
| `INDEX.md`, `GLOSSARY.md` | **generated**: `build_index.py`, `build_glossary.py` (first line `<!-- Generated by tools/content/path_export.py … do not edit. -->`) | people; `--check` in doccheck |
| `VOLUME.md`, `PATH.md`, `PATH-ledger.md`, `PATH-NOTES.md`, `VISUAL.md`, `COPY_STYLE.md`, `REUSE.md` | hand-written | people (`PATH.md` vs `PATH-ledger.md`/`REUSE.md` by `check.py`) |
| `check.py` (204 lines) | hand-written, circuit-specific (`BUDGET … total_steps=(40, 55)`, heading regex `^## (Пролог\|Глава \d+\|Практикум)\. …`) | run by hand; **not** called by `doccheck.py` |
| `terms_allowlist.tsv` | optional; `circuit` has none | `tools/content/terms_check.py:156-162` (`load_allowlist`), used for path volumes by `path_check.py:195-204` (`check_latin`) |

`circuit` has no `CURRICULUM.md` (that is the classic format's file).

### 1.3 Dev volumes and how they stay out of production

| Dir | `volume.json` | Purpose (from the file headers) | Exclusion |
|---|---|---|---|
| `_path` | `status: "dev"`, `format: "path"`, `path.budgets`, `emptyNote`, 5 planned chapters of which 2 are built (`_sandbox-path`, `_sandbox-flow`) | "the path format … end to end on two short chapters … and a journey with a prologue and a practicum that are planned but not built" (`_path/volume.ts:2-5`). Has `shared/placeholder.ts`, `qa/nav-scrub.mjs`, `__tests__/{content,path-step}.test.ts` | manifest in a lazy glob (`discover.ts:23`), awaited only `if (opts.includeDev)` (`discover.ts:80-87`); `main.ts:45` passes `includeDev: flags.debug` |
| `_demo` | `status: "dev"`, classic format, title «Радіохвилі», 2 placeholder chapters | "so that the library always has a second volume to test with" (`_demo/volume.ts:2-5`); driven by `tools/qa/library-check.mjs` | same |
| `_dev` | `status: "dev"`, `listed: false`, `journey: []` | the `_sandbox-*` chapters of the platform (each `dev: true`); may import another volume's `shared/**` | same; additionally `dev: true` chapters are hidden without `?debug` (`registry.ts:47`) |

Rules: a dev volume is exactly "directory name starts with `_`" ⇔ `status: 'dev'` (`volume.ts:273-274`); dev volumes get
no `@<v>` alias (`vite.config.ts:16`, `volumes.test.ts:70`). Production check: `tools/qa/library-check.mjs:253`
`'production: only the published volumes are registered'`.

---

## 2. `volume.json` schema

Type: `VolumeIdentity` (`app/src/engine/volume.ts:21-78`); validated by
`defineVolume(identity: VolumeIdentity, spec: VolumeSpec): VolumeManifest` (`volume.ts:266-360`). Every error is thrown as
``defineVolume(<id>): <msg>``. Fields the TypeScript type does not list (`docs`, `path`, `groups[].part`) are read by the
Python tools only.

### 2.1 Fields

| Field | Type | Default / effect | Validation (exact message) |
|---|---|---|---|
| `id` | string | must equal the directory (`discover.ts:36-38`: ``volume id '…' must equal its directory name``) | `/^[A-Za-z0-9_][A-Za-z0-9_-]*$/` → `invalid volume id '<id>'` |
| `title` | string | short name: library card, header, glossary scope | — (test: non-empty, `volumes.test.ts:39`) |
| `subtitle` | string | the volume's own line | — |
| `headline` | `'title' \| 'subtitle'` | default `title`; manifest `headline` = that string (`volume.ts:321`) | `headline must be 'title' or 'subtitle'` |
| `kicker` | string | `''`; small caps line above the headline | — |
| `lead` | string | `''`; one or two sentences under the headline | — |
| `emptyNote` | string | `''`; home-screen line while no chapter is built | — |
| `order` | number | position in the library (`library.ts:66-68` sort by `order`, then id); also the order of `--all` in the tools | — |
| `accent` | string | accent token; volume card, planned chapters on the map (`journey.ts:122`), default of `theme.accent` | must be a key of `ACCENT` (`style/palette.ts:18-33`: `cyan teal green lime yellow amber orange coral red pink magenta violet blue sky`) → `unknown accent '<x>'` |
| `emblem` | string | default `'book'`; a `@/ui3d` icon name for the library card (falls back when unknown, `hud/library.ts:45`) | — |
| `status` | string | see 2.3 | `status must be one of published \| draft \| dev`; `a dev volume has status 'dev' and a directory name starting with '_' (and only a dev volume)` |
| `listed` | boolean | default `true`; `false` keeps a registered volume off the library screen; forced `false` for an aside volume (`volume.ts:328`) | — |
| `aside` | `{ label: string }` | `null`; published volume kept out of the main flow | `an aside volume is published and has a button label` |
| `format` | `'classic' \| 'path'` | default `'classic'` | `format must be 'classic' or 'path'` |
| `seamless` | boolean | default `false` (`identity.seamless === true`); chapter change inside the volume becomes a 0.3 s cross-fade when the outgoing scene supplied a border (`engine/runtime.ts:512-516`, `SceneHooks.leaveChapter` in `chapter.ts:141`) | — |
| `axis.label` | string | name of the header field in classic documents; ruler name | — |
| `axis.unit` | string | may be `''` | — |
| `axis.hint` | string | default = `axis.label`; tooltip of the axis chip | — |
| `axis.range` | string | default: with > 1 floors `` `${floors[0].plain ?? floors[0].label} … ${last.plain ?? last.label}` `` (array order, not value order), else `` `${format(min)} … ${format(max)}` `` (`volume.ts:337-341`); shown as the third chip of the home screen and of the library card | — |
| `axis.floors[]` | `{ id, label, value, plain?, namedAt? }` | default `[]`; ruler shows one long tick per floor with its name (`hud/map/layout.ts:63-66`) | `floor '<id>': 'plain' and 'namedAt' (chapter/step) go together` (both or neither; `namedAt` must have exactly one `/`) |
| `groups[]` | `{ id, label, short?, layer?, part? }` | `short` default = `label`; `layer` default `'path'`; `part` = title of the part in classic documents (`chapters.py:67`) | `duplicate group id`; `group '<id>': unknown layer '<x>'` (allowed: `prologue path branch practicum`); `a volume with chapters needs a group` (only when `journey` is non-empty) |
| `journey[]` | `PlannedChapter { id, group, parent?, title?, minutes?, floor? }` | journey order; `manifest.journey.planned` | `invalid chapter id '<id>' in journey`; `chapter '<id>' is listed twice in journey`; `chapter '<id>': unknown group '<g>'`; `chapter '<id>': unknown parent '<p>'` (parent must be another journey id); `chapter '<id>': unknown floor '<f>'`; `chapter '<id>': minutes must be positive` |
| `path.budgets` | object | tools only: overrides of `BUDGETS = dict(chapterSteps=(4, 8), prologueSteps=(4, 5), chapterTerms=6, stepTerms=2, ideaWords=(25, 32), textWords=(80, 90), nowLines=3)` (`tools/content/path_check.py:26-27,47-50`); `_path` uses `{ "chapterSteps": [2, 8], "prologueSteps": [2, 5] }` | — |
| `docs.extra` | string[] | tools only: extra documents `chapters/<name>.md` for `typography.py` (`chapters.py:68`) | — |
| `docs.checks` | `[[name, path from repo root, args…]]` | tools only: extra check groups — **run only for classic volumes** (`doccheck.py:236` is inside `main()`; `main_path()` `doccheck.py:252-270` has a fixed list) **[probe: a failing check in `docs.checks` of a path volume was never executed, `doccheck[radio]: ALL GREEN`]** | — |

Journey-entry semantics in a path volume:

| Entry field | Read by | Effect |
|---|---|---|
| `id` | everything | chapter id; a built chapter must be listed (`volumes.test.ts:57-59`: `… is not in volume.json → journey`), with the same `group` and `parent` (`volumes.test.ts:60-61`) |
| `group` | `Registry` (`registry.ts:43-44`), tools | layer of the chapter = layer of its group (`journey.ts:86-87`, `path_export.py:29,34`) |
| `parent` | `hud/journey.ts:66-70` | the chapter becomes a satellite of its parent on the map (`hud/map/layout.ts:101-120`: rows of up to five under the hub) and a "kid" on the spine (`hud/model/spine.ts:42`); exported as `parent` in the generated manifest |
| `title` | `journey.ts:110-111` | **the switch that makes planned chapters visible**: if no entry has a `title`, the HUD journey is just the built chapters; with titles, every titled entry is on the map |
| `minutes` | `journey.ts:104,126`, `journeyRemaining` | lengths; when any chapter has minutes the map summary switches to «Пройдено X з Y глав · лишилося ≈ N хв» and the home chip to «≈ N хв» |
| `floor` | `journey.ts:120-121`, `path_export.py:33-36` | height of a planned chapter (`floorValue(volume, p.floor) ?? axis.origin`); `axisLabel` (= floor `label`) and `axisValue` (= floor `value`) of the generated `<id>.manifest.json` |

No tool compares a journey entry's `title` with the H1 of the chapter's document: a built chapter shows the document's
title (generated manifest), a planned one the `volume.json` title; `next.title` prefers the document
(`path_export.py:57`: `docs[nid]['title'] if nid in docs else jn[nid]['title']`).

What `volume.ts` adds (`VolumeSpec`, `volume.ts:243-255`): `journey.axis { min, max, origin, tick, majorEvery, format(value), ascending: 'out' | 'in' }`
(error: `journey axis needs max > min, tick > 0, majorEvery ≥ 1`), `journey.emblems?` (group id → one of
`micro em plants grid home labs`, `hud/map/emblems.ts:54-116`; missing/unknown → the first, `micro`),
`journey.layout?: Partial<JourneyLayout>` (defaults `DEFAULT_MAP_LAYOUT = { dx: 196, dy: 34, dz: 110, rootRadius: 46, childRadius: 27, orbit: 152 }`),
`glossary?: { scope: 'volume' | 'library' }` (default `volume`), `theme: { sky, mood, accent? }`
(`sky`: `'micro' | 'studio' | 'day' | 'golden' | 'dusk' | 'night'`, `style/env/presets.ts:81`; `mood`: `'micro' | 'studio' | 'diorama'`,
`engine/pipeline/post-params.ts:102`), `fixtures?`.

Note: no platform code reads `VolumeManifest.theme`; the environment of a chapter is the chapter's own mandatory
`theme` (`chapter.ts:69`, `engine/runtime.ts:636,641`).

Further constraints enforced by `app/src/engine/__tests__/volumes.test.ts`:

- `:42` `expect(axis.format(axis.min)).not.toBe(axis.format(axis.max))` — with a floor-lookup `format`, floors must exist at both `axis.min` and `axis.max`;
- `:43-44` `axis.origin` within `[min, max]`; `:55-56` every built chapter's `axisValue` within `[min, max]`;
- `:66-73` a non-dev volume needs `"@<id>/*": ["./src/volumes/<id>/*"]` in `app/tsconfig.json → paths`;
- `:75-92` no planned chapter id of the default or the legacy volume may equal any volume id.

### 2.2 Worked example — `app/src/volumes/circuit/volume.json` (abridged values, full structure)

```json
{
  "id": "circuit",
  "title": "Електричний струм",
  "subtitle": "Від атома до лампочки",
  "order": 1,
  "accent": "amber",
  "emblem": "lightning",
  "status": "published",
  "format": "path",
  "seamless": true,
  "axis": {
    "label": "Поверх",
    "unit": "",
    "hint": "Де ми: від стенда до одного атома",
    "floors": [
      { "id": "atom", "label": "один атом", "value": 0, "plain": "одна кулька", "namedAt": "wire/atoms" },
      { "id": "rows", "label": "ряди атомів", "value": 1, "plain": "ряди кульок", "namedAt": "wire/atoms" },
      { "id": "part", "label": "деталь", "value": 2 },
      { "id": "stand", "label": "стенд", "value": 3 }
    ]
  },
  "groups": [
    { "id": "prologue", "label": "Пролог", "layer": "prologue" },
    { "id": "path", "label": "Шлях", "layer": "path" },
    { "id": "practicum", "label": "Практикум", "layer": "practicum" }
  ],
  "journey": [
    { "id": "prologue", "group": "prologue", "title": "Клацнув вимикач — і світло. Що сталося за цю мить?", "minutes": 4, "floor": "stand" },
    { "id": "wire", "group": "path", "title": "З чого зроблений дріт?", "minutes": 10, "floor": "rows" },
    { "id": "charge", "group": "path", "title": "Що тримає електрон біля ядра?", "minutes": 10, "floor": "atom" },
    … battery (7, part), flow (14, stand), resistance (7, rows), lamp (11, part), drain (9, part) …
    { "id": "build", "group": "practicum", "title": "Зберіть коло самі", "minutes": 10, "floor": "stand" }
  ]
}
```

`circuit` uses no `kicker`, `lead`, `headline`, `emptyNote`, `parent`, `branch` layer, `docs` or `path`. Its `volume.ts`
(`circuit/volume.ts:11-28`): axis `{ min: 0, max: 3, origin: 0, tick: 1, majorEvery: 1, format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '', ascending: 'out' }`,
`layout: { dx: 210, dy: 70 }`, `glossary: { scope: 'volume' }`, `theme: { sky: 'day', mood: 'diorama' }`.
The other examples of optional fields: `_path/volume.json` (`kicker`, `lead`, `emptyNote`, `path.budgets`),
`electricity/volume.json` (`headline: "subtitle"`, `aside`, `axis.range`, `groups[].part/short`, `parent`, `docs.extra`, `docs.checks`).

### 2.3 What `status` changes

| | `published` | `draft` | `dev` (dir `_…`) |
|---|---|---|---|
| Manifest module | eager, entry chunk | eager, entry chunk **[probe: the draft's `volume.json` strings are in `dist/assets/index-*.js`]** | lazy chunk, requested only with `?debug` |
| Registered in a session | always | only with `?debug` (`discover.ts:78`: `if (m && (m.status === 'published' \|\| opts.includeDev))`) | only with `?debug` (`discover.ts:80-87`) |
| Chapter chunks `volume-<id>-*.js`, `chapter-<id>-<ch>-*.js` | built, loaded on demand | built, never requested without `?debug` **[probe: `dist/assets/volume-radio-*.js` (45 bytes when no chapter) is emitted for a draft]** | built, never requested without `?debug` |
| Counts toward the library level | yes unless `aside` (`library.ts:76`) | no | no |
| Library chrome while inside it | only when `multi` | yes if `listed` (`library.ts:99-102`: `this.multi \|\| (volume !== undefined && volume.status !== 'published' && volume.listed)`) | yes if `listed` |
| Library card status line | `ТОМ n` | `ТОМ n · У РОЗРОБЦІ` (`hud/model/library.ts:52`) | same |
| `@<id>` alias | vite: automatic from the directory name (`vite.config.ts:14-18`); tsconfig line required by test | same as published | none |
| May be default / legacy volume | yes (must: `volumes.test.ts:80,84`) | no | no |

With `?debug`: draft and dev volumes are registered, `dev: true` chapters are visible, and every volume is loaded at
boot (`main.ts:45-48`). `?debug` sits in the query string, before the hash: `…/?debug#/radio/<chapter>/<step>`.

---

## 3. Planned vs built chapters

**Built** = the directory `app/src/volumes/<v>/chapters/<id>/` has an `index.ts` whose default export is a
`defineChapter({...})` manifest with `id` equal to the directory name. Checks at load (`discover.ts:53-64`, logged with
`console.error`, the chapter is skipped): ``[chapters] <path>: must `export default defineChapter({ … })` `` and
``manifest id '<id>' must equal its directory name '<dir>'``. `Registry` then throws for
``chapter '<id>' is bound to volume '<v>'``, ``duplicate chapter id '<id>'``, ``chapter '<id>' has unknown group '<g>'``
(`registry.ts:39-46`). `defineChapter` throws for an invalid id, zero steps, invalid or duplicate step id (`chapter.ts:86-98`).
A `dev: true` chapter is registered only with `?debug` — **except** when the volume has no other chapter:
`if (visible.length === 0) visible = [...manifests];` (`registry.ts:48-49`).

**Planned** = a `journey[]` entry with a `title` and no built chapter. In the HUD journey (`hud/journey.ts:112-128`) it
becomes a `JourneyChapter` with `real: false`, `steps: []`, `accent: volume.accent`, `axisLabel` = its floor's label,
`axisValue: floorValue(volume, p.floor) ?? volume.journey.axis.origin`, `layer` from its group, `minutes`.

How a planned chapter is drawn / behaves:

| Place | Behaviour | Code |
|---|---|---|
| Map platform | "a quiet slate platform with a faint rim"; ring colour `steel × 0.55`; no emblem | `hud/map/world.ts:129-137, 258-260` |
| Map label | dim title; under it `` `у планах · ≈${NBSP}${c.minutes}${NBSP}хв` `` or `'у планах'` | `hud/map/labels.ts:44-45, 107-111` |
| Map card | kicker `stopName()` («Глава 4», «Пролог», «Практикум», «Гілка»); chips `['≈ 10 хв', 'у планах']`; no button; note `'Ця глава ще готується.'` (classic: `'Цей розділ ще будується.'`) | `hud/model/map.ts:97-136`; `hud-dom/map/card.ts:84-88` |
| Enter / Enter key on the map | toast `` `«${c.title}» ще будується.` `` | `hud/map/map.ts:328-333` |
| Spine dot | same toast | `hud/model/spine.ts:55-56` |
| Closing card of the previous chapter | button `` `Далі: ${next.title}` `` disabled, tooltip `'Ця глава ще готується'` | `hud-dom/step/path-body.ts:104-111` |
| Journey inset in a step | meta `… · у планах` | `hud-dom/journey/inset.ts:80` |
| Registry / `nav.next()` | not present at all (the registry holds built chapters only) | `registry.ts` |

### 3.1 A volume with ZERO built chapters

Runtime chain: `Registry.chapters.length === 0` → `Nav.isEmpty` (`nav.ts:82-86`) → `Nav.start()` finds no position and
calls `toLobby` (`nav.ts:278-282`; with no lobby candidate it throws `'Nav: no chapters registered'`) → the route is
`#/` for the default volume, `#/<id>` otherwise (`nav.ts:89-99`) → `main.ts:71-76` hides the splash → the HUD lobby
listener opens `home` (`hud/index.ts:190-196`).

| What | With planned titled chapters (path volume) | With `journey: []` |
|---|---|---|
| Stage behind the home screen | the journey map in **attract** mode — built because `journey.chapters.length > 0` (`hud/index.ts:96,107-108`) | `BackdropStage`, the bare backdrop (`hud/home-stage.ts`) |
| Home screen (`hud/model/home.ts:36-65`, DOM view `hud-dom/map/home.ts:63-73`) | `empty: true`, `bare: false`: kicker (if any), headline, tagline (the subtitle when the headline is the title), lead (if any), chip `emptyNote` (`data-ui="home-empty"`, only when `emptyNote` is non-empty). **No** «Почати подорож», «Мапа», no fact chips | same, `bare: true` (names mid-screen) |
| Map in attract mode | platforms, stems, ruler bars only: "Hero mode for the home screen: no labels, no card, the camera drifts" (`hud/map/map.ts:38-39`); labels get presence 0 (`map.ts:520`) — so neither chapter titles, nor «у планах · ≈ N хв», nor ruler names are visible | — |
| Opening the map | not possible from the UI: key `M` → `if (engine.nav.lobby) return;` (`hud/shell.ts:156-158`), and the empty home has no «Мапа» button. `window.__ui.open('map')` (QA hook, `hud/debug.ts:164`) does open it; `Hud.close()` in the lobby returns to `home` (`hud/shell.ts:296-300`) | — |
| QA hooks | `window.__app.lobby()` → volume id (`engine/debug/api.ts:223`); `window.__app.listChapters('<v>')` → `[]` | same |
| Library card (only where the library screen exists) | `disabled: chapters.length === 0` ("A volume without built chapters cannot be entered yet", `hud/model/library.ts:27,70`) | same |

**[probe]** Models computed for a probe `radio` skeleton (37 journey entries: prologue + 17 chapters + 2 practicums in
five path/prologue/practicum groups, 13 branches + 4 labs in three `branch` groups with `parent`, 7 floors, minutes of
the design's table): `journey.chapters.length = 37`, `roots = 20`, `built = 0`; `homeModel → { empty: true, bare: false,
note: 'Том у роботі — …', headline: 'Радіо', tagline: 'Від електрона до екрана' }`; `journeyRemaining({}) →
{ chapters: 20, total: 20, minutes: 169, totalMinutes: 169 }`; `mapSummary.text = 'Пройдено 0 з 20 глав · лишилося ≈ 169 хв'`;
`layoutJourney → 37 nodes, 20 on the spine, 7 ticks`, satellites of `raster` = `tv, lab-tube, sat, colour-sound`.

**Does it build and pass?** **[probe, full tree + `app/src/volumes/radio/{volume.json,volume.ts,chapters.ts}` with `status: "draft"`, no chapters]**

| Command (from `app/`) | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` (`pnpm typecheck`) | exit 0 |
| `eslint src/volumes/radio --max-warnings 0` | exit 0 |
| `vite build` | passes; emits `assets/volume-radio-<hash>.js` |
| `vitest run` (`pnpm test`) without the tsconfig alias | 2 failures in `src/engine/__tests__/volumes.test.ts` (`:30` and `:71`) |
| `vitest run` with `"@radio/*": ["./src/volumes/radio/*"]` added to `app/tsconfig.json` | `Test Files 1 failed \| 145 passed (146)`, `Tests 1 failed \| 1602 passed (1603)` — the one failure is `volumes.test.ts:30`: `expect(volumes.map((v) => v.dir).sort()).toEqual(['_demo', '_dev', '_path', 'circuit', 'electricity'])` receives `…, "radio"` |
| `python3 tools/content/doccheck.py --volume radio`, `bash tools/content/regen.sh --volume radio` — no `docs/volumes/radio/chapters/` | `volume radio has no documents yet (docs/volumes/radio/chapters): nothing to do`, `doccheck: ALL GREEN`, exit 0 |
| same — empty `docs/volumes/radio/chapters/` | **FAIL**: `error: _terms.md: missing (…/docs/volumes/radio/chapters/_terms.md)`, `doccheck[radio]: 5 check group(s) FAILED` |
| same — `chapters/_terms.md` present, no chapter document | `path[radio]: 0 chapter document(s), 0 step(s), 2 register term(s) — ok`, `doccheck[radio]: ALL GREEN`; regen writes `docs/volumes/radio/INDEX.md` (all 37 planned chapters, each `… · документа ще немає`) and `GLOSSARY.md`, and creates empty `docs/volumes/radio/chapters/_export/` and `app/src/volumes/radio/content/generated/` |

So: with zero built chapters the build, typecheck and lint pass; the unit tests pass only after **both** the tsconfig
alias line and an edit of the hard-coded volume list in `app/src/engine/__tests__/volumes.test.ts:30`.

### 3.2 What the first built chapter needs

1. `docs/volumes/<v>/chapters/_terms.md` and `docs/volumes/<v>/chapters/<id>.md` (path format: H1 `# <id> — <питання>`; sections from `path_format.py:20-21` in this order: `Питання з життя`, `Що ми вже знаємо`, `Кроки`, `Нитка глави`, `Що ми тепер знаємо`, `Місток`, `Підписи глави`; step heading ``### N. `step-id` — Назва``; step fields from `path_format.py:24-27`, required `REQUIRED = ['idea', 'text', 'action', 'takeaway', 'goal', 'terms', 'more']` — `more` not required in a prologue, `path_check.py:97-98`).
2. `bash tools/content/regen.sh --volume <v>` → `docs/volumes/<v>/chapters/_export/<id>.json`, `app/src/volumes/<v>/content/generated/<id>.json` and `<id>.manifest.json`, `INDEX.md`, `GLOSSARY.md`; ends with `doccheck[<v>]: ALL GREEN`.
3. `app/src/volumes/<v>/chapters/<id>/index.ts`, `content.ts`, `scene.ts` (shapes in §1.1). `scene.ts` default-exports `defineScene(...)`.
4. No registration edit anywhere.

**[probe]** minimal `prologue` (4-step document → regen → the three files with `defineScene(() => undefined)`):
`tsc` exit 0, `eslint` exit 0, `vite build` emits `chapter-radio-prologue-<hash>.js` and `volume-radio-<hash>.js`,
`volumes.test.ts` 18 of 19 pass (the same `:30` failure). Generated `prologue.manifest.json` had `"order": 1`,
`"axisLabel": "уся дорога"`, `"axisValue": 0`, `"layer": "prologue"`, `"minutes": 5`, `"parent": null`; `prologue.json`
`path.next = {"id": "field", "title": "Як гребінець тягне шерстинку, не торкаючись?"}`.

Once one chapter is registered the lobby is gone ("nothing to switch", `docs/VOLUMES.md:82`): `#/` loads the first
step behind the home screen (`hud/index.ts:140-155`, `hud/landing.ts`), the home shows «Почати подорож» / «Мапа» and the
fact chips; `emptyNote` is no longer shown (`hud/model/home.ts:50`).

---

## 4. Registration and loading

```
src/volumes/<v>/volume.ts        ── glob (eager; `_*` lazy) ──► discover.ts → VolumeSource { manifest, chapters() }
src/volumes/<v>/chapters.ts      ── glob (lazy)  ──► chunk volume-<v>   ── on Library.load(<v>) ──► Registry
src/volumes/<v>/chapters/*/index.ts   (eager inside chapters.ts) → bindChapter(manifest, <v>)
src/volumes/<v>/chapters/*/content.ts ── glob (lazy, src/content/loader.ts) ──► loadContent('<v>/<chapter>')
src/volumes/<v>/chapters/*/scene.ts   ── manifest.load() ──► chunk chapter-<v>-<id>
```

- `discoverVolumes(opts: { includeDev: boolean }): Promise<VolumeSource[]>` (`discover.ts:74-89`); `LIBRARY_CONFIG` = `../volumes/library.json`.
- `new Library(sources, config, opts: RegistryOptions = {})` (`library.ts:57-77`); `load(volumeId): Promise<Registry>` (once, cached); `main.ts:46-48`: `new Library(volumes, LIBRARY_CONFIG, { includeDev: flags.debug })`, `if (flags.debug) await library.loadAll()`.
- A volume without `chapters.ts`: `[volumes] src/volumes/<id>/chapters.ts is missing (copy it from another volume)` and an empty chapter list (`discover.ts:47-50`).

Chapter manifest (`ChapterManifest`, `app/src/engine/chapter.ts:46-78`; authors write `ChapterSpec = Omit<ChapterManifest, 'volume'>`):

| Field | Type | Source in a path chapter |
|---|---|---|
| `volume` | string | filled by `bindChapter` at discovery |
| `id` | string | literal = directory name |
| `order` | number | `meta.order` = 1-based index of the entry in `volume.json → journey`, **branches included** (`path_export.py:32,34`) |
| `group` | string | literal or `meta.group`; must be a group of the volume and equal the journey entry's (`volumes.test.ts:60`) |
| `parent?` | string | must be exactly the journey entry's `parent` (`expect(chapter.parent).toBe(planned!.parent)`, `volumes.test.ts:61`) — the generated manifest carries `"parent": null`, the journey entry `undefined`, so `parent: meta.parent` would fail for a chapter without a parent |
| `title`, `subtitle`, `axisLabel`, `steps[{ id, title, blurb }]` | | `...manifestText(meta)` (`content/meta.ts:12-27`): `title` = H1 question, `subtitle` = first step's title, `axisLabel` = floor label, `blurb` = step «Думка» (`path_export.py:155-158`) |
| `axisValue` | number | `meta.axisValue` = the floor's `value` |
| `theme` | `{ accent, sky, mood }` | literal, mandatory |
| `load` | `() => Promise<{ default: SceneModule }>` | `() => import('./scene')` |
| `emblem?` | `() => Promise<{ default: () => Object3D }>` | optional `() => import('./emblem')` |
| `dev?` | boolean | sandbox chapters only |

Generated `<id>.manifest.json` keys (`ChapterMeta`, `content/types.ts:201-219`): `volume, id, title, subtitle, axisLabel,
axisValue, group, parent, order, format: "path", layer, minutes, steps[]`. Generated `<id>.json` keys: `volume, id, title,
group, path { layer, hook, know, now[], bridge, next { id, title } | null, minutes, labels? }, steps[] { id, title,
panel[], terms[], path { idea, action, takeaway, more[], marks[], recall?, hints?, captions? }, labels? }, glossary[]`.
There is **no `crossReferences`** in a path chapter's content.

Document → app, exact commands (run from the repository root; each tool also takes `--all`, default without a flag
is `library.json → defaultVolume` except doccheck, whose default is all volumes — `chapters.py:111-126`, `doccheck.py:274`):

```
bash tools/content/regen.sh --volume radio
  = python3 tools/content/build_index.py    --volume radio      → docs/volumes/radio/INDEX.md
    python3 tools/content/build_glossary.py --volume radio      → docs/volumes/radio/GLOSSARY.md
    python3 tools/content/export_content.py --volume radio --quiet → docs/volumes/radio/chapters/_export/<id>.json
    python3 tools/content/export_runtime.py --volume radio      → app/src/volumes/radio/content/generated/<id>.json, <id>.manifest.json
    python3 tools/content/doccheck.py       --volume radio | tail -24
python3 tools/content/path_check.py --volume radio              (doccheck group `path` alone)
```

- For a path volume all four generators call `tools/content/path_export.py` (`export_main / runtime_main / index_main / glossary_main`); the runtime files are computed from the documents in the same run, not read back from `_export/`.
- `--check` variants exit 1 when a file would change. doccheck for a path volume = `path_check.main()` + `typography`, `index`, `glossary`, `export`, `runtime`, `fonts` (`doccheck.py:252-270`); it does **not** run `xref`, `terms`, `simple`, `copy` or `docs.checks`.
- `sync()` deletes stale files: in `_export/` every `*.json` not starting with `_`; in `content/generated/` **every** `*.json` that is not an output (`path_export.py:238,244`) — nothing hand-written can live in `content/generated/`.
- A volume is seen by `--all` only if `docs/volumes/<id>/chapters` is a directory and `app/src/volumes/<id>/volume.json` exists (`chapters.py:37-42`). In a path volume the tools work on the planned chapters that have a document (`chapters.py:76-77`).

Unit tests that cover manifests:

| Test file | What it pins |
|---|---|
| `app/src/engine/__tests__/volumes.test.ts` | the list of volume directories (`:30`), well-formedness (`:34-45`), built chapters ⊂ plan with same group/parent and `axisValue` in range (`:47-64`), tsconfig aliases (`:66-73`), `library.json` (`:75-103`), `defineVolume` defaults and error messages (`:115-191`) |
| `app/src/engine/__tests__/nav.test.ts` | `Registry` order / `next` / `prev` / dev fallback (`:90-158`), `Library` (`:184-…`), `Nav` |
| `app/src/engine/__tests__/lobby.test.ts` | lobby of an empty default volume, aside volume, storage migration |
| `app/src/hud/map/__tests__/layout.test.ts` | `journeyFromManifests` with 0/1/2 built chapters, floors on the ruler, `journeyRemaining` with a `branch` group (`:125-140`) |
| `app/src/hud/model/__tests__/overlays.test.ts:108-127` | `mapSummary`, `stopName`, `mapCard` for planned chapters |
| `app/src/hud/__tests__/where.test.ts` | header axis chip with named floors |
| `app/src/volumes/_path/__tests__/{content,path-step}.test.ts` | generated path content and the path step model |
| `app/src/volumes/circuit/chapters/<id>/__tests__/manifest.test.ts` | per chapter: steps of the manifest = generated content |
| `tools/content/test_path_format.py` | the document parser |

---

## 5. Order and navigation

Registry order (`app/src/engine/registry.ts:51-79`):

```ts
    const byOrder = (a: ChapterManifest, b: ChapterManifest): number =>
      a.order - b.order || a.id.localeCompare(b.id);
    const roots: ChapterManifest[] = [];
    for (const m of visible) {
      this.byId.set(m.id, m);
      if (m.parent && visibleIds.has(m.parent) && m.parent !== m.id) {
        const list = this.childMap.get(m.parent) ?? [];
        list.push(m);
        this.childMap.set(m.parent, list);
      } else {
        roots.push(m);
      }
    }
    for (const list of this.childMap.values()) list.sort(byOrder);
    roots.sort(byOrder);
    const ordered: ChapterManifest[] = [];
    const visit = (m: ChapterManifest, depth: number): void => {
      if (depth > 8) throw new Error(`Registry: parent cycle at chapter '${m.id}'`);
      ordered.push(m);
      for (const child of this.childMap.get(m.id) ?? []) visit(child, depth + 1);
    };
    for (const r of roots) visit(r, 0);
    this.chapters = ordered;
    for (const m of ordered) {
      for (const s of m.steps) {
        this.linearIndex.set(`${m.id}/${s.id}`, this.linear.length);
        this.linear.push({ volumeId: volume.id, chapterId: m.id, stepId: s.id });
      }
    }
```

- A chapter whose parent is not built is a root (ordered by its own `order`).
- `next` / `prev` (`registry.ts:122-131`) are the neighbours in that one linear list of steps:

```ts
  next(pos: Position): Position | null {
    const i = this.linearIndex.get(`${pos.chapterId}/${pos.stepId}`);
    return i === undefined ? null : (this.linear[i + 1] ?? null);
  }
  prev(pos: Position): Position | null {
    const i = this.linearIndex.get(`${pos.chapterId}/${pos.stepId}`);
    return i === undefined || i === 0 ? null : (this.linear[i - 1] ?? null);
  }
```

- `Nav.next()` / `prev()` (`nav.ts:242-250`) go to `registry.next/prev` of the current target; `Nav.up()` (`nav.ts:253-259`) goes to the parent chapter's first step — **no HUD code calls `nav.up()`** (grep over `app/src`: only tests).
- The registry knows neither layers nor planned chapters: at the last step of a chapter, `next` is the first step of the next **built** chapter in that order — a built child (branch) of the chapter comes first; unbuilt chapters in between are skipped silently.
  **[probe]** built `prologue`, `raster`, `tv` (parent `raster`), `build-analog` → walk `prologue/w -> raster/a -> raster/b -> tv/t1 -> build-analog/p1`.

What the reader's controls do at a chapter's last step in a path volume (DOM HUD, the default — `engine/app.ts:53` `DEFAULT_HUD = 'dom'`):

| Control | Action | Code |
|---|---|---|
| Navigator «Далі» / keys `→`, `PageDown` on the last step (closing card not shown) | bring the closing card (`pathEnd.forward`) | `hud-dom/step/navigator.ts:72`, `hud/keys.ts:35-38`, `hud-dom/step/step-panel.ts:147-149` |
| Closing card button `` `Далі: ${next.title}` `` (`data-ui="path-next"`) | `hud.engine.nav.goto(next.id)` where `next` = `content.path.next`; disabled when that chapter is not built | `hud-dom/step/path-body.ts:104-111` |
| Navigator «Далі: наступний розділ» / `→` while the card is shown | `nav.next()` (registry order) | `hud-dom/step/navigator.ts:17,72,115-117`; `engine/app.ts:322` |
| Closing card with `next === null` | `«Кінець шляху»`, button `'Мапа подорожі'` (`data-ui="path-map"`), and — when the chapter has «Підписи глави» — a restart button to the volume's first step (`data-ui="path-restart"`) | `path-body.ts:95-103,121-122` |
| `←` / navigator back while the card is shown | back to the step (`pathEnd.back`) | `hud/keys.ts:30-33` |

`content.path.next` is computed by the exporter and **does skip branch-layer chapters** (`tools/content/path_export.py:51-57`):

```python
def next_chapter(cid, jn, docs):
    """The chapter the bridge leads to: the next prologue / path / practicum entry of the journey (branches skipped)."""
    ids = [c for c in C.PLANNED if jn[c]['layer'] != 'branch']
    if cid not in ids or ids.index(cid) + 1 >= len(ids):
        return None
    nid = ids[ids.index(cid) + 1]
    return dict(id=nid, title=docs[nid]['title'] if nid in docs else jn[nid]['title'])
```

For a branch chapter itself this returns `None` (its closing card is the «Кінець шляху» card). `path_check.py:139-141`
requires the bridge of a non-branch chapter to end with that next chapter's title (`the bridge does not end with the next question «…»`);
a practicum needs no bridge (`need = … 'practicum': ['steps']`, `path_check.py:83-84`).

`journeyRemaining` (`app/src/hud/journey.ts:143-162`):

```ts
  for (const c of journey.chapters) {
    if (c.layer === 'branch') continue;
    total++;
    const p = c.real ? chapterProgress(visited, c) : { fraction: 0 };
    if (p.fraction < 1) chapters++;
    if (c.minutes !== null) {
      minutes = (minutes ?? 0) + c.minutes * (1 - p.fraction);
      totalMinutes += c.minutes;
    }
  }
  return { chapters, total, minutes: minutes === null ? null : Math.round(minutes), totalMinutes };
```

Layers elsewhere: `stopName` (`hud/model/map.ts:60-72`) — `prologue → 'Пролог'`, `practicum → 'Практикум'`,
`branch → 'Гілка'`, `path → `` `Глава ${n}` `` counted over chapters of layer `path` only (several `path` groups number
through: **[probe]** `field` = «Глава 1» … `cliff` = «Глава 17», both practicums «Практикум», every lab «Гілка»).
`homeModel` counts `journey.chapters.length` — all layers (`hud/model/home.ts:41,52`).

**Answer to "is there now any handling that skips branch chapters on next or returns from a branch to its parent?"**
In the platform's navigation: no. `Registry.next()` / `Nav.next()` and therefore the navigator bar and the step keys walk
into a built child chapter. The only branch-aware pieces are (a) the exporter's `next_chapter` → the closing card's
own «Далі: …» button, (b) `journeyRemaining`, (c) the label «Гілка». Nothing returns from a branch to its parent
(`Nav.up()` exists, unused); the help text even drops the hub/satellite keys for path volumes
(`hud/model/help.ts:72`: `volume?.format === 'path' ? '' : ', ↓ ↑ — типи станцій і лабораторії'`).

---

## 6. Library

`app/src/volumes/library.json` today:

```json
{ "title": null, "defaultVolume": "circuit", "legacyVolume": "electricity" }
```

| Field (`LibraryConfig`, `library.ts:18-28`) | Meaning | Failure |
|---|---|---|
| `title: string \| null` | umbrella name; `null` → the default volume's headline (`library.ts:75`); also the page `<title>` / splash through `vite.config.ts:25-43` (`%LIBRARY_TITLE%`, `%LIBRARY_SUBTITLE%`, `%LIBRARY_DESCRIPTION%` in `app/index.html`) | — |
| `defaultVolume: string` | the front door (`#/`); default `--volume` of the content tools (`chapters.py:30`) | `Library: default volume '<id>' is not registered` (`library.ts:70`) — a draft is not registered without `?debug` |
| `legacyVolume?: string` | owner of pre-library links `#/<chapter>/<step>` and of `electricity:v1` data; default = the default volume | `Library: legacy volume '<id>' is not registered` (`library.ts:73`) |

Single-volume library at runtime (`library.ts:76,99-102`; `docs/VOLUMES.md:65-67`): `multi = false`,
`showsLibrary(id) = false` for a published volume → no library level: `#/` opens the default volume's home screen over
its map, no volume name in the header, no «Бібліотека» button (`home-library`, `sys-library`), no glossary scope
switch, key `L` does nothing (`hud/shell.ts:161-165`: `engine.library.listed.length > 1`). Buttons to other volumes
exist only for `aside` volumes (`hud/home-aside.ts:27-39`).
**[probe, `va-probe/site`: only `src/volumes/radio` left, `status: "published"`, `library.json` = `{ "title": null, "defaultVolume": "radio" }`]**
`tsc -p tsconfig.json --noEmit` exit 0; `vite build` passes, 12 files in `dist/assets`, `<title>Радіо</title>`;
`new Library([radio], { title: null, defaultVolume: 'radio' })` → `{ title: 'Радіо', multi: false, showsLibrary: false, legacyVolume: 'radio' }`;
keeping `legacyVolume: 'electricity'` throws `Library: legacy volume 'electricity' is not registered`.
`vitest run` in that profile: `Tests 10 failed | 279 passed (289)` — 3 in `volumes.test.ts`, 7 in
`lint-chapter-boundary.test.ts` (they name `electricity`, `circuit`, `_demo`, `_dev`) — the unit tests belong to the full tree.

Routes (`engine/router.ts:29-46`, `engine/nav.ts:268-308`):

| Address | Result |
|---|---|
| `#/` | last position if it is outside aside volumes, else the default volume's entry; the HUD opens `home` because the route has no chapter (`hud/index.ts:140-155`); empty default volume → lobby |
| `#/<volume>` | that volume where the reader left it, else its first step; empty volume → lobby (`#/` if it is the default) |
| `#/<volume>/<chapter>[/<step>]` | deep link; unknown step → the chapter's first step; address bar rewritten to the full form |
| `#/<chapter>[/<step>]` (first segment is not a registered volume id) | legacy link: looked up in the legacy volume, then the default, then the others |
| unknown target | the address of the current position (or lobby) is restored |

A draft volume is not a "volume id" for the parser without `?debug` (`Router` gets `(id) => library.has(id)`,
`engine/app.ts:255`), so `#/radio/…` without `?debug` is read as a legacy chapter link and falls back to the default volume.

Browser storage — one namespace for the whole app, not per volume:

| Key | Content | Code |
|---|---|---|
| `electricity:v2` | `{ v: 2, settings, progress: { visited: { '<volume>/<chapter>': [stepId…] } }, last: Position \| null, lastIn: { '<volume>': Position } }` | `engine/store.ts:139-157` ("The key keeps the project's code name as its namespace; it is not a volume id") |
| `electricity:v1` | pre-library record, migrated once into the legacy volume | `store.ts:163-179, 299-306` |
| `electricity:ui:v1:onboarded` | first-run hints seen | `hud/hints.ts:66` |
| `electricity:probe` | storage probe | `engine/app.ts:150` |

Reset «Почати з нуля» clears by prefix `APP_STORAGE_PREFIX = 'electricity:'` (`engine/reset.ts:10`). Per-volume data are
only the `'<volume>/…'` keys inside the one record. The keys carry no site or path component.

Links:

| Kind | Mechanism | Limits |
|---|---|---|
| «Згадайте» (path format, field «Згадати») | `PathRecall { target: 'volume/chapter/step', title }`; `RecallTrail.follow(target)` → `nav.open(target)` and a way back (`hud/recall.ts`) | must point to an **earlier** step of the same volume (`path_check.py:176-179`: `«Згадати» → unknown step …`, `… is not an earlier step`); into another volume only a warning `«Згадати» into another volume (…) is not checked` |
| «Див. також» (classic format) | `content.crossReferences[].targets` → link chips (`hud/model/links.ts`); other volumes are loaded on demand (`hud/shell.ts:396-403`); unbuilt target → dimmed chip `'Цей розділ ще будується'` | not available in path chapters: the path parser has no such section or field (`path_format.py:20-27`; unknown section → `unknown section «…»`, unknown field → `unknown field «…»`) and the runtime content has no `crossReferences` (`path_export.py:153-154`) |
| In code | `ctx.nav.goto('<chapter>', '<step>')`, `ctx.nav.open('<volume>/<chapter>/<step>')`, `ctx.nav.locate(address)` | targets must exist in this build |
| **External sites** | **none.** `grep -rnE "window\.open\|_blank\|noopener\|https?://"` over `app/src` finds no link code (only font `URL(...)` construction); `docs/ARCHITECTURE.md:12-13`: "No runtime network dependencies" | a volume has to build its own control |

---

## 7. Checklist: minimal new volume `radio`

### 7.1 Whole journey planned, no built chapter

Create:

| File | Content |
|---|---|
| `app/src/volumes/radio/volume.json` | `id: "radio"`, `title`, `subtitle`, `order`, `accent` (a key of `ACCENT`), `status`, `format: "path"`, `axis { label, unit, floors[] }`, `groups[]` (unique ids; `layer` per group), `journey[]` with `title`, `minutes`, `floor` (and `parent` where wanted) for every chapter; optional `kicker`, `lead`, `emptyNote`, `emblem`, `axis.hint`, `axis.range`, `seamless`, `path.budgets` |
| `app/src/volumes/radio/volume.ts` | `export default defineVolume(identity, { journey: { axis: { min, max, origin, tick, majorEvery, format, ascending }, layout? , emblems? }, glossary?, theme: { sky, mood } })` — `format(min) !== format(max)`, `origin` within range |
| `app/src/volumes/radio/chapters.ts` | byte-for-byte copy of `app/src/volumes/circuit/chapters.ts` |

Touch:

| File | Change | Enforced by |
|---|---|---|
| `app/tsconfig.json` → `compilerOptions.paths` | add `"@radio/*": ["./src/volumes/radio/*"]` | `volumes.test.ts:66-73` |
| `app/src/engine/__tests__/volumes.test.ts:30` | the expected directory list must include `'radio'` (sorted: `['_demo', '_dev', '_path', 'circuit', 'electricity', 'radio']`) | the test itself **[probe]** |

Not needed: any edit in `discover.ts`, `library.json` (stays `circuit` / `electricity` while `radio` is a draft),
`vite.config.ts` (alias derived from the directory).

Documents — two consistent states for the tools:

- no `docs/volumes/radio/chapters/` directory → every tool prints `volume radio has no documents yet (docs/volumes/radio/chapters): nothing to do`; or
- `docs/volumes/radio/chapters/_terms.md` (register; may already list terms of chapters that have no document — their chapter must be in the journey: `_terms.md: «…» is introduced in … — no such chapter in the journey`) → `bash tools/content/regen.sh --volume radio` writes `docs/volumes/radio/INDEX.md` and `GLOSSARY.md`, creates `chapters/_export/` and `app/src/volumes/radio/content/generated/` (both empty), `doccheck[radio]: ALL GREEN`.
- optional `docs/volumes/radio/terms_allowlist.tsv` (TSV `word<TAB>kind<TAB>explanation<TAB>reason`, a word may be listed only once across it and `tools/content/terms_allowlist.tsv`).

Verification commands for this state (from `app/` unless noted) and the results the probe got:

```
pnpm typecheck      # tsc -p tsconfig.json --noEmit                 → exit 0
pnpm lint           # eslint . --max-warnings 0                     → src/volumes/radio: exit 0
pnpm test           # vitest run                                    → green only with both edits above
pnpm build          # tsc -p tsconfig.json --noEmit && vite build   → dist/assets/volume-radio-<hash>.js
python3 tools/content/doccheck.py --volume radio     (repo root)    → doccheck[radio]: ALL GREEN
```

Runtime with `status: "draft"`: reachable only as `…/?debug#/radio` → lobby (`window.__app.lobby() === 'radio'`),
home with names + `emptyNote` over the attract-mode map; library chrome is shown inside it (listed non-published volume).

### 7.2 Plus one built chapter `<id>` (already an entry of `journey[]`)

Create:

| File | Hand-written / generated |
|---|---|
| `docs/volumes/radio/chapters/_terms.md` | hand-written (if not there yet) |
| `docs/volumes/radio/chapters/<id>.md` | hand-written |
| `docs/volumes/radio/chapters/_export/<id>.json` | generated by `bash tools/content/regen.sh --volume radio` |
| `app/src/volumes/radio/content/generated/<id>.json`, `<id>.manifest.json` | generated by the same command |
| `docs/volumes/radio/INDEX.md`, `GLOSSARY.md` | regenerated by the same command |
| `app/src/volumes/radio/chapters/<id>/index.ts` | hand-written: `defineChapter({ id: '<id>', order: meta.order, group: '<group of the journey entry>', [parent: '<parent of the journey entry>',] ...manifestText(meta), axisValue: meta.axisValue, theme: { accent, sky, mood }, load: () => import('./scene') })` |
| `app/src/volumes/radio/chapters/<id>/content.ts` | hand-written: `export default defineContent(raw)` (+ `caption(step, i)` as in `wire/content.ts`) |
| `app/src/volumes/radio/chapters/<id>/scene.ts` | hand-written: `export default defineScene((ctx) => …)` |
| by convention of `circuit`: `chapter.ts`, `steps/NN-<step>.ts`, `parts/`, `__tests__/manifest.test.ts`, `qa/{helpers,interactions}.mjs`, `README.md`; volume level: `shared/**`, `sim/**` | hand-written |

Registrations to touch: none (glob discovery). Conditions checked by the existing tests: the chapter is in `journey[]`
with the same `group` and `parent`; `axisValue` inside `[axis.min, axis.max]`; manifest id = directory name.

---

## Surprises (design doc `docs/superpowers/specs/2026-11-17-radio-volume-design.md` vs this copy)

1. **Adding the volume breaks a platform test.** Design L171 («дерево репозиторію збігається з `upstream`, його тести й перевірки лишаються зеленими»), L548 (the tsconfig line as the only "додаток, якого вимагає рушій") and L552-553 («Каталоги платформи (`app/src/engine`, …) у цьому репозиторії не редагуємо») vs `app/src/engine/__tests__/volumes.test.ts:30`: `toEqual(['_demo', '_dev', '_path', 'circuit', 'electricity'])`. [probe] With `app/src/volumes/radio/` and the alias line, `vitest run` = 1 failed / 1602 passed.
2. **Batch 1 does not show "a map of all chapters «у планах»".** Design L570-572 and L791 vs `hud/model/home.ts:38-50`, `hud-dom/map/home.ts:69-71` (empty home: names + `emptyNote`, no «Мапа»), `hud/shell.ts:156-158` (`M` ignored in the lobby), `hud/map/map.ts:38-39,520` (attract mode: no labels). With zero built chapters the planned journey is only visible as unlabeled slate platforms behind the home screen.
3. **Pilot = prologue + `lines` leaves a gap the closing card cannot cross.** Design L527-531, L793 vs `tools/content/path_export.py:51-57` and `path_check.py:139-141` (the prologue's bridge must end with the question of `field`, the next non-branch entry) and `hud-dom/step/path-body.ts:104-111` (button `Далі: <field title>` disabled, «Ця глава ще готується»). The navigator's «Далі: наступний розділ» (`nav.next()`, `registry.ts:123-126`) jumps from the prologue to `lines`.
4. **`docs.checks` is ignored for path volumes.** Design L643-645 («рушій дозволяє додаткові перевірки у `volume.json`») vs `tools/content/doccheck.py:236` (classic `main()` only) and `:252-270` (`main_path()`); [probe] a failing check never ran.
5. **Honesty marks are neither checked nor shown.** Design L131-133 («Це перевіряють `tools/content/path_check.py` і `doccheck.py`») and L739 («перелік позначок в інструментах фіксований») vs `tools/content/path_format.py:27-28`: `'Позначки': '-honesty', 'Чесно': '-note'` — "«-» fields are accepted and dropped: the honesty marks and «Чесно» note are not shown (DECISIONS §60 x)". No list of marks exists in `tools/content`.
6. **No «Див. також» in the path format.** Design L582 and the fallback of L638-639 («з глав на них ведуть «Див. також»») vs `path_format.py:20-27` (no such section/field), `path_export.py:153-154` (no `crossReferences` in the runtime content), `path_check.py:176-179` («Згадати» only to earlier steps).
7. **«Далі» and branches: two different behaviours already.** Design L631-635 is right about `Registry` (`registry.ts:66-73,123-126`), but the closing card's own button already skips branches (`path_export.py:51-57`, `path-body.ts:104-106`) while the navigator bar and keys do not (`hud-dom/step/navigator.ts:72`, `engine/app.ts:322`); a branch chapter's closing card is the end-of-journey card (`next: null`, `path-body.ts:95-103`).
8. **Labs as branch-layer chapters are labelled «Гілка»; the home chip counts them.** Design L422, L624-628, L737 vs `hud/model/map.ts:60-64` and `hud-dom/journey/inset.ts:49-53` (`branch: 'Гілка'`), and `hud/model/home.ts:41,52` (`journey.chapters.length`): [probe] home «37 глав» next to the map's «Пройдено 0 з 20 глав».
9. **The fact about `circuit` is stale.** Design L597-599 («у томі `circuit` збудовано тільки пролог і `wire`») vs nine chapter directories in `app/src/volumes/circuit/chapters/` and `volumes.test.ts:101` ("all nine chapters are built").
10. **Site `library.json` must not inherit `legacyVolume`.** Design L566 names only `defaultVolume: "radio"`; `library.ts:72-73` throws `Library: legacy volume 'electricity' is not registered` if the key stays. [probe]
11. **A draft volume ships in the full-tree build.** Design L558-560 vs `discover.ts:20-22` (eager glob excludes only `_*`): the draft's `volume.json` text is in the entry chunk and `volume-radio-*.js` / chapter chunks are emitted; only registration needs `?debug`. [probe]
12. **Sandbox placement has two traps.** Design L818-819 vs `registry.ts:48-49` (a volume whose only chapters are `dev: true` shows them without `?debug`) and `volumes.test.ts:57-59` (a chapter built inside a volume with a non-empty journey must be a journey entry); a sandbox in `_dev` may import only `shared/**` of another volume (`app/eslint-rules/chapter-boundary.js:27`), not its `sim/**`.
13. **Default `axis.range` text.** Design L201/L629 (seven marks, «уся дорога» first) vs `volume.ts:337-341`: without `axis.range` the home/library chip reads `<first floor> … <last floor>` in array order — [probe] «уся дорога … екран».
14. **`docs/volumes/radio/` is occupied but harmless to the tools.** Design L523/L544 (archive to `plan48/`): the directory has no `chapters/`, so `--all` skips it (`chapters.py:39-41`); creating an empty `chapters/` makes doccheck fail until `_terms.md` exists. [probe]
15. **Volume `theme` is unused; chapter word in the navigator.** `VolumeManifest.theme` has no reader (`engine/runtime.ts:636,641` use the chapter's); the DOM navigator says «Далі: наступний розділ» in path volumes too (`hud-dom/step/navigator.ts:17`).

## Open questions (not established from the files)

1. Values and ids of the seven floors and their vertical order on the ruler (the design names the marks, not numbers), and which floor a branch / lab takes.
2. `minutes` of the 13 branch chapters (the design gives minutes only for the path, the practicums and the labs).
3. Whether `radio` is meant to set `seamless: true`, `kicker`, `lead`, `emptyNote`, `headline`, `emblem`, `order` — none is stated in the design.
4. Whether editing `app/src/engine/__tests__/volumes.test.ts:30` is acceptable under the "platform directories are not edited" rule, or the owner changes that test upstream.
5. How the `?debug` draft looks in a browser (lobby home over the attract map, library chrome) — derived from code and model output here, not rendered.
6. Whether `tools/qa/*` accept a draft volume / a single-volume build without changes — outside this subsystem, not opened beyond `library-check.mjs:80-118,253`.
7. Content of the missing format documents (`docs/PATH_FORMAT.md`, `docs/VOLUME_STRUCTURE.md`): everything above about the format is taken from `tools/content/path_*.py` and the `circuit` documents.
