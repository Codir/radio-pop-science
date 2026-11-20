# Recon E3 · SYNTHESIS — one electronics chapter end to end: script → content → code → bench → QA → site

Read-only synthesis, 2026-11-20, against `main` at **`7e97cc7`** (E1-4 landed since the four maps were written at
`2707887`). Inputs: `recon-E3/{script,code,qa,prior}.md`, `recon-E2/SYNTHESIS.md` §0–§1 (+ §2.5, §3.4–3.6, §5, §6 for
what the bench plan promises), the design `docs/superpowers/specs/2026-11-20-electronics-volume-design.md`, the
constraints `.superpowers/sdd/2026-11-20-electronics/global-constraints.md`, `batch-E1.md`. Every claim this file
leans on was re-opened in the source (list in §0.2).

Short forms: `E/` = `app/src/volumes/electronics/`, `D/` = `docs/volumes/electronics/`, `C/` = `app/src/volumes/circuit/`,
`S/` = `C/shared/stage/`, `T/` = `tools/content/`, `E2§x` = `recon-E2/SYNTHESIS.md` §x. «L12-30» = lines 12–30.
Verdicts: **COPY** · **COPY+ADAPT** · **USE** (platform API) · **REF** (read the pattern) · **NEW** · **SKIP**.

---------------------------------------------------------------------------------------------------------------------

## 0. In one screen

- **Order of work per chapter:** register rows → script `D/chapters/<id>.md` → `typography --write` → `regen.sh`
  (generates `E/content/generated/<id>{,.manifest}.json` + `_export`, INDEX, GLOSSARY) → chapter code
  `E/chapters/<id>/` (copy the circuit `resistance`/`lamp` shape, never circuit's `prologue`) mounting the bench
  `mountBench(ctx, …)` → manifest test + pure tests → `qa/interactions.mjs` → `chapter-check` / `mobile-check` →
  site profile build with smoke. Registration is just the file `E/chapters/<id>/index.ts` (`E/chapters.ts` globs it).
- **Nothing for E3 exists yet.** `D/` is absent (E1-8 not landed: no PATH.md, ledger, `_terms.md`, `check.py`); `E/`
  has only `volume.json`, `volume.ts`, `chapters.ts`, `sim/core` (E1-3 + E1-4: resistors, pot, switch, jumper,
  speaker, earphone, batteries, 1N4148/1N4007, LED ×5, `lamp-6v`, limits/heat/burn). No `E/sim/board`, no
  `E/shared/**`, no Transient (E1-5), transistor/amplifier (E1-6), player/music (E1-7), sound (E1-9).
- **Scripts can start as soon as E1-8 lands** (they need PATH.md, PATH-ledger numbers, the register). **Chapter code
  needs E2 complete**: `resistor`/`resistor-pick` need E2-2…E2-8; `meter` adds E2-9 (scope, after E1-5, E1-7);
  `prologue` adds E2-10 (sound, after E1-7 + E1-9) and the E1-6 amplifier.
- **Formulas**: tools ban `= ≈ × ÷ √ ^` and backticks only in «Текст» (`T/path_check.py` L28, L114-115). «Висновок»,
  «Підписи», «Докладніше» may carry them; ≤ 1 new formula per step and only after the hands-on dependency is a
  review rule (global-constraints L9-11), not tool-enforced. In «Підписи» never use `·` (U+00B7 splits captions,
  `T/path_format.py` L176) — write `×` or `⋅` (U+22C5; both in the 3D font charset, `app/scripts/charset.mjs` L12, L38).
- **Biggest traps**: (1) term order — a chapter's own new terms may not appear in its title/hook/know, and a bridge
  ends with the next chapter's title, so `prologue` → «…напругу, струм і форму сигналу?» forbids registering
  напруга/струм/сигнал as path terms introduced in `meter`; (2) captions are positional — `«A» → «B»` takes two
  indexes; (3) chapter-check fails on any `console.warn`, > 4 hue families, > 350 draw calls; (4) smoke switches from
  «lobby» to «deep link to the first built chapter» the moment one chapter is registered.
- **Inside views E3 must build:** one — the carbon-film resistor for `resistor` (floor `inside`); E2-8 leaves only a
  placeholder cutaway. Sources: `S/bulb-close.ts` helix maths, `S/lamp-view.ts` cutter, `C/shared/copper/**` electron
  language. `resistor-pick` (floor `part`) needs a band-reading close-up, not an inside view.

### 0.1 Preconditions and their state at `7e97cc7`

| Needed by E3 | Producer | State | Checked |
|---|---|---|---|
| `D/{VOLUME,PATH,PATH-ledger,PATH-NOTES,REUSE}.md`, `D/check.py`, `D/test_check.py` | E1-8 (`batch-E1.md` L322-325) | absent | `ls docs/volumes` |
| `D/chapters/_terms.md` (register) | **not in E1-8's file list** (L322-325); E1-8's `check.py` may read it (radio's does, `docs/volumes/radio/check.py` L43, L152-172) | absent | — |
| `D/terms_allowlist.tsv` (NPN, PNP, BC547, SMD, ESR, …) | first script that needs it | absent | `T/terms_allowlist.tsv` L45 LED, L54 MOSFET only |
| `D/VISUAL.md` (board, part looks, band colours) | E2-1 | absent | — |
| `E/sim/board`, `E/shared/{bench,parts,hand,model,instruments,dive}` | E2-2…E2-9 | absent | `ls E/` |
| `E/shared/sound` + speaker | E1-9, E2-10 | absent | — |
| Transient, capacitors | E1-5 | absent | `ls E/sim/core` |
| BC547/2N3904, `sim/core/amplifier.ts` | E1-6 | absent | — |
| `music.ts`, player source in `PARTS` | E1-7 | absent | `parts.ts` has no player key |
| diode/LED/lamp/limits | E1-4 | **landed** (`7e97cc7`) | `E/sim/core/{diode,lamp,limits}.ts`, README L146-163, L251-256, L281-348 |

### 0.2 Spot-checks (claim → verified at)

Grammar regexes `T/path_format.py` L12-17, sections L20-21, fields L24-27, REQUIRED L29, caption item L33, list split
`[,·]` L84-88, caption split on `·` L176, `_terms.md: missing` L239-241 · budgets L26-27, FORMULA L28, layer sections
L83-87, title `?` L88-89, steps L90-92, formula ban L114-115, prologue 0 terms L131-132, «now» 3 lines L135-138, bridge
L139-141 (`T/path_check.py`) · `next_chapter` skips branches `T/path_export.py` L51-57 · `CHAPTER_IDS` = journey ids
with a file `T/chapters.py` L74-77 · `regen.sh` L8-12 has no typography `--write` · `typography.py` usage L23-24 ·
circuit `resistance/{index,content,chapter,scene}.ts` (index L14 `group: 'path'` hard-coded; scene L22-110) ·
`volumes.test.ts` L60-61 (group/parent equal to the plan) · `E/__tests__/journey.test.ts` L127-128 (no `seamless`) ·
runtime calls `stage.apply` (which runs the step's `enter`) then `hooks.enterStep` (`engine/runtime.ts` L605-606) ·
`stage.define` L393, `param` L360, params revert to initial on each entry L465-470, `validate` L415-426 ·
`hud-dom/step/path-body.ts`: takeaway reveal on goal L244, hints plain L248, closing card L88-121 with `path-next`
**disabled + tip «Ця глава ще готується» when the next chapter is not built** L104-111 · no platform consumer of
`path.captions` (`grep captions app/src` → `content/types.ts` only) · `note` control renders rich text
(`hud-dom/dock/controls/inputs.ts` L163-176 `setRich`) · slider `stops`/`snaps` (`ui3d/widgets/slider-scale.ts`
L5-18) · `journeyInset` + hard-coded board title 'Мапа тому' (`C/chapters/prologue/steps/map.ts` L9, L29) ·
chapter-check `--max-hues` default 4 L96/L191, leak skip L272, last line L335 · smoke opens the plain URL (no
`noaudio`/`debug`/`freeze`, `tools/site/smoke.mjs` L124), lobby/start checks L162-166, last line L189 ·
`qa-env.sh` L23-24 · lint chapter rules `app/eslint.config.js` L35-61, `chapter-boundary.js` L1-27 · resistor
tolerance is metadata only (`E/sim/core/parts.ts` L42-50, L375), `E12`/`E24` exported L341-345 · limits `WARM_LOAD`
0.5 L29, `loadOf` L53-59, `burnSeconds` L75-77 · `C/chapters/build/qa/interactions.mjs` L269 `e.text` bug ·
`lamp-view.ts` `capSections` L191, `createCutter` L206; `bulb-close.ts` `finePath` L79, `fineCoilGeometry` L96 ·
copper files import only `@/engine/api`, `@/fx`, `@/style`, three and siblings.

---------------------------------------------------------------------------------------------------------------------

## 1. The end-to-end recipe for one electronics chapter (builder's checklist)

### A. Before touching anything

- [ ] Prelude in every shell: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null; export
      COREPACK_ENABLE_DOWNLOAD_PROMPT=0` (global-constraints L62-64); for browser work `source tools/site/qa-env.sh`.
- [ ] Read: design §3.3 (formulas), §3.4 (safety), §8.1 (journey + amplifier thread L278-281); `D/PATH.md` section
      `## Глава N. <question> — \`<id>\`` (steps, terms, formula of each step, what is on the board); `D/PATH-ledger.md`
      (terms with their step, formulas, «Числа моделі»); `E/sim/core/README.md` (catalog L146-163, LEDs L251-256, lamp
      L281-304, limits L324-348); `D/VISUAL.md` (shots, looks); `E/shared/README.md` (bench API, readers).
- [ ] Look at the journey neighbours in `E/volume.json` L32-52: the previous **non-branch** chapter's bridge must end
      with this chapter's title; this chapter's bridge must end with the next non-branch title (branches `sensors`,
      `smd`, `rectifier`, `blinker`, `mosfet` are skipped).

### B. Register and allowlist (once per volume, then per chapter)

- [ ] `D/chapters/_terms.md` exists with exactly these H2s (others are ignored): `## Терміни шляху` (5 cells:
      `| Термін | \`regex\` | \`chapter/step\` | шлях\|практикум | Картка |`), `## Слова лише для «Докладніше»` (3 cells),
      `## Чого на шляху немає` (2 cells). A row without a backtick is silently skipped; write `\|` for regex
      alternation; the regex match is the span that gets bolded/linked; regexes are case-insensitive. Circuit-known
      words go into a prose `## Слова, які читач уже має` (ignored by tools) — **never** copy circuit's register (it
      bans конденсатор/напівпровідник/змінний струм and keeps світлодіод/ом/потужність «Докладніше»-only).
- [ ] Every Крок must be `chapter/step` (a bare `step` crashes `check_terms`). Rows for not-yet-written chapters are
      fine; once a chapter document exists, each step's «Нові терміни» must equal the register rows of that step.
- [ ] `D/terms_allowlist.tsv` (TAB: word, kind ∈ abbr|mark|name|symbol, explanation or `—`, reason) for every
      multi-letter Latin word outside backticks in on-screen fields **and «Докладніше»** (units, single letters, `E24`,
      `R₁`, `1N4148` are exempt). A word may be listed once across the global and volume files.

### C. Script `D/chapters/<id>.md` (path grammar — `T/path_format.py` is the spec; `docs/PATH_FORMAT.md` is absent)

```
# <id> — <question?>                       ← em dash with spaces; <id> = file name = journey id; practicum may omit «?»
## Питання з життя                          ← hook (lines joined)            required: prologue, path, branch
## Що ми вже знаємо                         ← know                           path/branch only (forbidden in prologue)
## Кроки                                    ← only ### steps inside
### 1. `step-id` — Назва кроку              ← n = 1,2,3…; id ^[a-z][a-z0-9]*(-[a-z0-9]+)*$, unique
- **Думка:** one sentence (≤ 32 words; > 25 warns)            practicum: «Завдання»
- **Текст:** ≤ 2 paragraphs, ≤ 90 words (> 80 warns); NO = ≈ × ÷ √ ^ `; **bold** only this step's new terms
- **Дія:** one paragraph (circuit style: 5–10 words, verb first, «ви»)
- **Висновок:** one paragraph; formula allowed: `I = U / R`   practicum: «Перевірка»
- **Ціль:** builder's goal predicate (not on screen) — make it a number QA can read
- **Нові терміни:** a, b | —                  ≤ 2 per step, ≤ 6 «шлях» per chapter, 0 in a prologue
- **Докладніше:** inline, or items «  - …» (4-space continuation); optional only in a prologue
- **Підказки:** ≤ 2 items (15 s / 40 s), rendered as PLAIN text (no formulas, no bold)
- **Підписи:** «A» · «A» → «B» · → «B»       ← separator U+00B7 only; «A»→«B» = two indexes
- **Згадати:** `step` | `chapter/step`        ← earlier steps of this volume only (no circuit links: not on the site)
- **Бачимо:** builder's brief (not on screen)
## Нитка глави                               ← thread (export only)       path/branch
## Що ми тепер знаємо                        ← exactly 3 lines «1. …», one sentence each, continuation 3 spaces (path)
## Місток                                    ← must END with the next non-branch chapter's title (punctuation-blind)
## Підписи глави                             ← only the volume end (`lab`): [0] = «start over»
<!-- fact notes with sources: stripped before parsing -->
```

- Inline field continuation: 2 spaces. Inline text and items together, a repeated field, an unknown field, `---`,
  tables or fences inside a step → error. A `###` in a non-step section is silently merged into its text.
- Units international (V, mA, Ω, kΩ, μF, W, Hz, s, ms), `μ` = U+03BC, apostrophe `’` U+2019, decimal comma, minus
  `−` U+2212 (a spaced ` - ` becomes ` — ` by typography outside code spans).
- Numbers only from `E/sim/core/README.md`, fixtures, or `PATH-ledger.md` «Числа моделі»; mark what the bench will
  show as «попередньо» until E2 confirms it (batch-E1 L352-353). Lamp burn-out seconds are a compression — never
  presented as real (sim README L291-294).
- Every «Ціль» becomes a reader-visible number: write it as «`<reader field>` reaches X» material, e.g. «режим V,
  червоний щуп у ряду `+`, чорний у ряду `−`, мультиметр показує 9 V (± 0,01 V)».

### D. Generate and gate the documents

```bash
python3 tools/content/typography.py --write --volume electronics      # regen does not run it
python3 tools/content/path_check.py --volume electronics
#   → [warning: …]* [error: …]*  path[electronics]: <n> chapter document(s), <m> step(s), <k> register term(s) — ok
tools/content/regen.sh --volume electronics                            # index → glossary → _export → runtime → doccheck
#   → … doccheck[electronics]: ALL GREEN
python3 tools/content/doccheck.py --all                                # → doccheck: ALL GREEN   (CI step, pages.yml L60)
python3 docs/volumes/electronics/test_check.py && python3 docs/volumes/electronics/check.py   # → electronics check: OK
```

Writes (all committed; CI's doccheck checks they are up to date): `D/INDEX.md`, `D/GLOSSARY.md`,
`D/chapters/_export/<id>.json`, `E/content/generated/<id>.json` (runtime: `steps[].panel`, `.labels`, `.path.{idea,
action, takeaway, more, marks, recall, hints, captions}`), `E/content/generated/<id>.manifest.json` (`title`,
`subtitle` = first step title, `axisValue` = floor value, `group`, `order`, `steps[{id, title, blurb}]`). `sync`
deletes any other `*.json` in `content/generated/`. Step «Ціль», «Бачимо», «Нитка» never reach the runtime.

### E. Chapter code `E/chapters/<id>/` (copy `C/chapters/resistance` / `lamp`; never `C/chapters/prologue`)

| File | Contents (signature) | Template |
|---|---|---|
| `index.ts` | `export default defineChapter({ id: '<id>', order: meta.order, group: meta.group, ...manifestText(meta), axisValue: meta.axisValue, theme: { accent: 'teal', sky: 'studio', mood: 'studio' }, load: () => import('./scene') })` with `meta` = `../../content/generated/<id>.manifest.json`. **No `parent`** on main chapters (generated `null` ≠ planned `undefined`, `volumes.test.ts` L61); branches add `parent: '<id>'`. | `C/chapters/resistance/index.ts` L1-19 (but its `group: 'path'` is wrong here) |
| `content.ts` | `defineContent(raw)` default; `caption(step: string, i: number): string` throwing `<id>: no caption i in step 's'` | `C/chapters/resistance/content.ts` L1-17 |
| `chapter.ts` | `STEP_IDS = [...] as const`, `StepId`, `Chapter { ctx; ui: StepUiApi<StepId>; stand: <Id>Stand; reached(s); reach(s); here(s) }`, `StepModule { spec: StepSpec; ui: StepUiSpec; enter?(info); leave?(); update?(dt, t); late?(dt, t) }`, `StepFactory`, module `sessionGoals` (the one sanctioned module state) | `C/chapters/resistance/chapter.ts` L12-46, `lamp/chapter.ts` (adds `late`) |
| `stand.ts` | the chapter's facade over the bench: `create<Id>Stand(ctx): { bench: Bench; door?; ladder?; shot(name); snap(); update(dt, t); late(dt, t) }` — calls `mountBench(ctx, { tray, meter, scope, sound })` **once**, registers chapter shots with `ctx.camera.shots`, owns chapter-only props (each a `glide`) | `C/chapters/resistance/stand.ts`, `lamp/world.ts` L41-60 |
| `scene.ts` | `defineScene((ctx) => …)`: stand → `stepUi(ctx)` **once** → all factories → `ctx.stage.define(...)` with `enter/leave` bound → `ui.define(...)` → `ctx.qa.expose('<id>', …)` + `'motion'` → hooks `{ enterStep(id, info) { if (info.instant) stand.snap(); }, update(dt, t) { steps[cur]?.update?.(dt, t); stand.update(dt, t); for each step late; stand.late(dt, t); } }`. No `leaveChapter` (not seamless; runtime plays its zoom). File name must be `scene.ts` (Vite chunk naming, `app/vite.config.ts` L65-66) | `C/chapters/resistance/scene.ts` L22-110 minus the border code L42-43, L77-104 |
| `steps/NN-<id>.ts` | `export const <camel>Step: StepFactory = ({ ctx, stand, ui, reached, reach, here }) => { …factory-time input/probes/exposes…; return { spec, ui, enter, leave, update } }` | `C/chapters/resistance/steps/03-shape.ts` L24-126 |
| `parts/*.ts` | chapter-local pure maps/props; shared by two chapters → `E/shared/<module>/` + REUSE row | `C/chapters/resistance/parts/glide.ts` |
| `__tests__/manifest.test.ts` | ids/titles = generated; `STEP_IDS` = generated ids; `it.each([[step, i, text], …])` over **every** caption index the code uses, compared after `.split(NBSP).join(' ')` | `C/chapters/lamp/__tests__/manifest.test.ts` L1-44 |
| `__tests__/<pure>.test.ts` | one per pure helper (formats, value ↔ visual maps); vitest env `node`, no WebGL | `C/chapters/lamp/__tests__/story-words.test.ts` |
| `README.md` | `# Chapter \`electronics/<id>\` — «<question>»`, script path, world, first/last frame, Files table, Steps table (reader does → goal; timings; caption timing), «Simplified / differs from the script», `## QA` command | `C/chapters/resistance/README.md` (34 l.) |
| `qa/interactions.mjs` + `qa/helpers.mjs` | §1.I | `C/chapters/resistance/qa/*`; helpers from E2-5's sandbox copy |

### F. Steps — anatomy and the board (per step module)

- [ ] `spec`: `{ camera: <shot name>, params: {…only registered params…} }`; unspecified params revert to initial on
      every entry. Give a camera on every step. `ctx.stage.define` throws on unknown params; the runtime throws when
      defined steps ≠ manifest steps.
- [ ] `ui: StepUiSpec`: `reset: true` where control defaults must return; `controls` (dock) — sliders (`stops` for
      E-series, `scale: 'log'`), `segmented` (meter mode), `readout` (`bench.meter.readout(id, caption(s, i))`, text
      readouts), `note` for a formula card (rich: a caption written as «`I = U / R`»); `board: { title: caption(...),
      size, children: [bench.scope.chart('scope', { ch1: caption(...), ch2: caption(...) })] }`; `callouts` with
      `visible: () => here(s) && …`; `goal: () => reached(s)`. Every label, mark label, tooltip, callout and board
      title is `caption(step, i)`; unit symbols (`'V'`, `'U, V'`, `'t, ms'`) may be literals. Formulas render in
      callouts, dock labels, readouts, notes — **not** in slider mark labels or board titles (plain text there).
- [ ] `enter(info)`: reset per-visit state; `stand.bench.preset(parts, leads, info.instant ? 0 : s)` with **fresh
      ids** (or `forget` damage) so a burnt part from the last visit does not reappear; set `hands.policy`; instruments
      `shown` glides; anything with travel uses `info.instant ? 0 : seconds`. Chapter entry is `instant: true, from:
      null` even when arriving from the previous chapter.
- [ ] `update(dt)`: `if (!here(s)) return;` timers by `dt` (never `setTimeout`, `Date.now`, `performance.now`,
      `Math.random` — lint in `chapters/**`); goal: `held = cond ? held + dt : 0; if (held >= HOLD && !reached(s))
      reach(s)` where `cond` reads **model/bench numbers** (`bench.meter.value`, `bench.model.reading(id).i`,
      `bench.model.status(id)`, `bench.state` legs).
- [ ] Camera flights / world moves the step starts must begin on the first `update` frame, not in `enter` (the
      world's `enterStep` runs after it, runtime L605-606).
- [ ] Captions «→ X»: `visible: () => here(s) && reached(s)`; «A» → «B»: A `!reached(s)`, B `reached(s)` (the HUD does
      not apply caption timing).
- [ ] QA hooks at factory time: `ctx.qa.probe('<thing>', Vector3 getter)` for every target a script must touch;
      `ctx.qa.expose('<step-id>', () => ({ …goal inputs… }))`. Names never `electronics-*` (bench readers) and a step
      id never equals the chapter id (both would be reader names).

### G. Bench mount (what the chapter takes from E2; names provisional until `E/shared/README.md` exists)

`mountBench(ctx, opts?: { tray?, meter?, scope?, sound?, link? }): Bench` (E2§1.2 L228-256) — `group`, tilted `frame`,
`layout`/`state` (board as data), `view.socketWorld(id)`, `fixed` (BAT+SW 9 V fixed to the rails, SPK/PLAYER/LAMP on
plug leads, E2§3.4 L579-590), `parts`, `hands` (+ `policy`), `tray.set(items)`, `model` (`reading`, `rowVolts`,
`status`, `heat`, `set(id, setting)`, `forget`, `still`), `meter` (`mode`, `value`, `text`, `readout(id, label)`),
`scope` (`chart(id, labels)`, `sweepVersion`, `timePerDiv`, `mode`), `tools` (lens), `flying`, `preset(parts, leads?,
seconds?)`, `clear(seconds?)`, `snap()`, `update(dt, t)`, `late(dt, t)`. Dive: `partDoor(ctx, bench, partId) → Door
{ rail, lens(t), rim(t), glass(t), cut(t) }`, `partLensPose`, `floorAt` (E2§1.7 L409-424) + `floorLadder(ctx, { floor
})` from `@/hud-dom/journey` (USE). Bench QA readers: `electronics-bench`, `-board`, `-motion`, `-meter`, `-scope`,
`-sound`, `-model`. Volts are honest: 9 V battery has 1.5 Ω (divider 1 k/2 k → 5.997 V), wires/closed switch 1 mΩ.

### H. Inside view (only for floors `inside` / `atoms`)

- [ ] The part's cutaway is driven by `door.cut(t)` (E2-8 exposes it); the camera rides `door.rail`; the ladder reads
      `part` past 0.5 and `inside` past 1. Everything inside is a **model output** (electron speed ∝ `reading(id).i`,
      glow ∝ `heat(id)`), never a free animation. Shared between chapters → `E/shared/inside/<part>.ts` + REUSE row
      (copies from circuit only; `electricity` is REF unless the owner allows, E2 Open Q15). Details in §3.3.

### I. Tests and QA

```bash
cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..   # main checkout only; in a worktree whose
#   node_modules link to the main one: node node_modules/vitest/vitest.mjs run <file>  (never pnpm there)
source tools/site/qa-env.sh                                                 # QA_ALLOW_SOFTWARE=1, QA_OUT, shims
# serve (background): site profile  X=~/.cache/radio-pop-science/site-electronics
node tools/site/build.mjs --volume electronics --out "$X" --sub radio-pop-science/electronics   # → PASS site smoke
site_serve 5393 "$X"; B=http://127.0.0.1:5393/radio-pop-science/        # or full tree: (cd app && pnpm build && pnpm preview --port 5377 --strictPort)
node tools/qa/chapter-check.mjs electronics/<id> --base $B --skip perf --out "$QA_OUT/E3"
#   → last line: PASS electronics/<id> — report: <out>/electronics-<id>/report.json
node tools/qa/mobile-check.mjs electronics/<id> --base $B --profiles pp --skip perf --out "$QA_OUT/E3-m-<id>"
#   → mobile-check electronics/<id>: PASS — 0 failure(s), <w> warning(s), <n> note(s) · <out>/mobile-report.json
node app/src/volumes/electronics/chapters/<id>/qa/interactions.mjs --base $B --out "$QA_OUT/E3-<id>-i"           # 1280x720
node app/src/volumes/electronics/chapters/<id>/qa/interactions.mjs --base $B --touch --size 390x844 --out …       # phone
#   → PASS electronics/<id> — <n> checks (1280x720) | FAIL electronics/<id> — <k> of <n> checks (…)   (proposed; exit 1)
env -u QA_ALLOW_SOFTWARE node tools/qa/chapter-check.mjs electronics/<id> --port 5377 --out "$QA_OUT/E3-perf"  # GPU perf, one run at a time
site_stop 5393
```

- Always the full id `electronics/<id>` (short `prologue`/`build` resolve to circuit). Always `--out`. Long runs in the
  background, one at a time (≈ 30 s per 4 steps with `--skip perf` in software; an interaction script ≤ 2.5 min).
- `chapter-check` gates: console clean (**warn fails too**), deep link per step lands exactly, draw calls ≤ 350,
  triangles ≤ 1.5 M, hue families ≤ 4 (`--max-hues`), Text3D ≥ 16 px-eq at 1280×720, HUD text ≥ 15 units, no HUD
  region overlap, nothing off screen, sequential + random/spam navigation, leaks (skipped silently with no other
  chapter), DPR 2 only with `--sizes all|--dpr2`, perf ≤ 8 ms unless `--skip perf`, no third-party request.
- Interaction script (one per chapter): header `#!/usr/bin/env node` + `/* global process, console, window, document,
  getComputedStyle */`; imports `'../../../../../../../tools/qa/lib.mjs'` (7 × `../`), `next-chapter.mjs`,
  `sheet-tab.mjs`; boot `openApp(page, appUrl(base, { route: 'electronics/<id>/<first-step>', freeze: 0 }))`, then
  `__app.pause()` and only `advance(page, s)`; first step: press `[data-ui="path-opening"] button`; per step:
  `check('no takeaway before the goal')`, reach the goal with real pointer input (`__ui.locate('ctl-<id>')`,
  `__app.locate('<probe>')`, `pointer(page, touch).path([...])`; `sheetTab(page, 'controls')` on phones), `advance(≥
  0.35)` (legs seat on arrival), assert `[data-ui="path-takeaway"]` shown and the reader numbers; open
  `[data-ui="path-more"]` once; follow every `[data-ui="path-recall"]` and `path-back`; continuity via `strides(page,
  'motion', s)`; last step → `closingCard()` = 3 lines + bridge; `[data-ui="path-next"]` **enabled** if the next
  chapter is built, else `disabled` with `data-tip`; console: `appErrors` with `level === 'error'`, detail
  `e.message` (not `e.text`).
- Reviewer shots: chapter-check's `sheet-<W>x<H>.jpg` (pre-goal states) + the script's `--out` goal snaps → `tools/qa/
  sheet.sh <dir>/sheet-goals.jpg --cols 3 --tile 640 --title "electronics/<id> — goals" <dir>/*-goal.jpg`; single states
  `node tools/qa/shot.mjs electronics/<id>/<step> --size 1280x720 --out "$QA_OUT/E3/<id>-<step>.jpg"`. Assert
  numbers, never pixels.

### J. Site smoke (changes behaviour with the first registered chapter)

- With ≥ 1 built chapter, `smoke.mjs` no longer accepts the lobby (`home-empty` + «Перші глави — в роботі»): it needs
  `home-start`/`home-resume` and a deep link `#/electronics/<listChapters()[0].id>/<its first step>` that keeps the hash
  and lands (L164-170). `listChapters()[0]` = lowest journey `order` among **built** chapters (prologue once built).
- Smoke opens the **plain** URL (no `noaudio`, `freeze`, `debug`), SwiftShader, real clock, 60–90 s budgets, zero
  `console.error` (warnings pass), every request < 400 **under the sub-path** (worker chunks, fonts, audio). The
  sound module must not create an `AudioContext` before `ctx.gesture`; the model worker URL must resolve under
  `/radio-pop-science/electronics/`.
- CI (`.github/workflows/pages.yml` L80-86) builds and smokes the electronics profile on every push to `main`: a
  registered but unfinished chapter goes live on push. Register `index.ts` only in the commit that passes §1.I.

### K. Commit (controller pushes at batch end)

Ukrainian plain sentences, **no AI notes of any kind** (global-constraints L51-53; owner memory), explicit paths in
`git add` (script, `_terms.md`, allowlist, INDEX, GLOSSARY, `_export/<id>.json`, generated JSON ×2, chapter dir,
shared additions, REUSE rows), `git log -1 --format=%B` afterwards; never `pnpm format`, never `--force`. Another
process commits to `main` concurrently: `regen.sh` rewrites INDEX/GLOSSARY/all generated JSON of the volume, so
script commits must be serialised (one regen + commit at a time).

### L. Suggested E3 batch shape (default)

E3-0 register + allowlist (+ PATH.md fixes the scripts need) → E3-1…4 scripts `prologue`, `meter`, `resistor`,
`resistor-pick` (each: brief §2.1; a reader checks physics/pedagogy/language) → E3-5 shared additions for the pilot
(§3.5: `inside/film.ts`, `bench/presets.ts`, band reader, E-series helper, speaker look) → E3-6…9 chapters in the order
`resistor`, `resistor-pick`, `meter`, `prologue` (least to most dependent; each: brief §2.2) → E3-10 batch gates,
site, report. Push once all four pass (smoke then targets `prologue`).

---------------------------------------------------------------------------------------------------------------------

## 2. Brief templates

### 2.1 «Write the script of chapter `<id>`»

```
## E3-<n>. Сценарій глави `<id>` — «<question>»
Виконавець: Opus 5.5, високе зусилля. Результат читає незалежний читач (фізика, педагогіка, мова).

Читати: design §2, §3.3, §3.4, §8.1; global-constraints «Зміст і мова», «Безпека»; D/PATH.md «Глава <N> … — `<id>`»;
D/PATH-ledger.md (терміни, формули, «Числа моделі»); D/chapters/_terms.md; E/sim/core/README.md (Catalog L146-163,
LEDs L251-256, Limits L324-348); D/VISUAL.md (ракурси) and E/shared/README.md (what the bench can do — «Ціль»/«Бачимо»
must be buildable); circuit models: docs/volumes/circuit/chapters/resistance.md (path chapter), prologue.md (prologue),
docs/volumes/circuit/COPY_STYLE.md, docs/volumes/radio/COPY_STYLE.md; recon-E3/SYNTHESIS.md §1.C, §3 (this chapter).

Файли: create D/chapters/<id>.md; edit D/chapters/_terms.md (rows «Терміни шляху» with Крок `<id>/<step>`, «Докладніше»
words), D/terms_allowlist.tsv (Latin words), D/PATH.md + D/PATH-ledger.md where the script changes a step id, a term
step or a formula (same commit; check.py compares them); generated: D/INDEX.md, D/GLOSSARY.md,
D/chapters/_export/<id>.json, E/content/generated/<id>.json, <id>.manifest.json.

Правила:
- grammar §1.C; layer <prologue|path>: <4–5 | 4–8> steps; <0 | ≤ 6> terms, ≤ 2 per step;
- formulas only in «Висновок», «Підписи», «Докладніше»; ≤ 1 new formula per step, after the reader saw the dependency on
  the bench; no `·` inside «Підписи» (use ×); hints plain;
- no term before its step anywhere on screen (title, hook, know, captions, bridge, now); this chapter's new terms never
  in its own title/hook/know; bridge ends with «<next non-branch title>»;
- every number from the model/ledger (cite in the closing <!-- --> fact notes); safety: ≤ 9 V, burn-outs as a mistake's
  consequence, no smoke/fire recipes;
- every «Ціль» is a predicate on numbers the bench exposes (meter value, part current/status, board legs); every
  «Підписи» item is a word the scene shows (control labels, marks, callouts, tooltips, board titles, unit words) —
  list them in scene order; captions with formulas only where they render rich (callouts, notes, readout labels);
- no recall into `circuit` (not on the electronics site): say it in words.

Перевірки (all must hold):
  python3 tools/content/typography.py --write --volume electronics
  python3 tools/content/path_check.py --volume electronics   → «path[electronics]: … — ok», no new warnings unexplained
  tools/content/regen.sh --volume electronics                → «doccheck[electronics]: ALL GREEN»
  python3 tools/content/doccheck.py --all                    → «doccheck: ALL GREEN»
  python3 docs/volumes/electronics/test_check.py && python3 docs/volumes/electronics/check.py → «electronics check: OK»
  grep -nP '\x{00B5}|\x{00B7}(?=[^«]*»)' D/chapters/<id>.md   → nothing in captions (µ never; · not inside «…» of Підписи)
  self-review table in the report: step · Ціль as a number · captions with indexes · formula (field) · new terms

Коміт (явні шляхи, без приміток про ШІ): «Сценарій глави «<question>» тому «Радіоелектроніка»: <одне речення>».
Звіт: steps table, terms, formulas, captions per step with indexes, open questions with defaults.
```

### 2.2 «Build chapter `<id>` from its script»

```
## E3-<n>. Глава `<id>` на стенді
Виконавець: Opus 5.5, високе зусилля. Після — огляд коду й огляд знімків (sheet-*.jpg) незалежним читачем.

Читати: D/chapters/<id>.md (the truth: every «Ціль», «Бачимо», «Підписи»), E/content/generated/<id>.json;
E/shared/README.md (bench API, readers); D/VISUAL.md; recon-E3/SYNTHESIS.md §1.E–J, §3 (<id>); circuit templates
C/chapters/resistance/{index,content,chapter,scene,stand}.ts, steps/03-shape.ts, __tests__/manifest.test.ts, qa/*.

Файли: E/chapters/<id>/{index.ts, content.ts, chapter.ts, scene.ts, stand.ts, steps/NN-<step>.ts…, parts/*.ts,
__tests__/manifest.test.ts, __tests__/<pure>.test.ts, README.md, qa/interactions.mjs, qa/helpers.mjs}; shared
additions only under E/shared/<module>/ with tests and a REUSE row (D/REUSE.md: звідки, що змінено).

Правила: §1.E–H; no Ukrainian in code (comments English); every word = caption(step, i) pinned by the manifest test;
stepUi once; no module state but sessionGoals; no timers/clock/random in chapters; nothing that glows, heats, burns,
moves electrons, sounds or draws a trace without a model number behind it; deep links: every enter honours
info.instant and rebuilds the board with fresh ids; budgets ≤ 350 draw calls, ≤ 4 hue families per deep-link frame,
Text3D ≥ 16 px-eq at 1280×720, HUD text ≥ 15 units, touch targets ≥ 44 px (phone).

Перевірки:
  cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build              → all green
  python3 tools/content/doccheck.py --all → «doccheck: ALL GREEN»; D/check.py → «electronics check: OK»
  chapter-check electronics/<id> --skip perf --out …                          → «PASS electronics/<id> — report: …»
  mobile-check electronics/<id> --profiles pp --skip perf --out …              → «mobile-check electronics/<id>: PASS — 0 failure(s) …»
  qa/interactions.mjs (1280x720) and (--touch --size 390x844)                  → «PASS electronics/<id> — <n> checks …»
  GPU perf: env -u QA_ALLOW_SOFTWARE chapter-check … (record the worst step ms; > 8 ms → report, owner decides)
  node tools/site/build.mjs --volume electronics --out … --sub radio-pop-science/electronics → «PASS site smoke»
  goal-state contact sheet + chapter-check sheets attached to the report

Коміт: «Глава «<question>» тому «Радіоелектроніка»: <що читач робить на стенді одним реченням>».
Звіт: steps (reader does → goal → numbers seen), readers/probes, captions used, draw calls/hues per step, perf,
deviations from the script («Simplified» section of README), open questions with defaults.
```

---------------------------------------------------------------------------------------------------------------------

## 3. The pilot chapters: needs beyond the bench plan, and the inside views

### 3.0 What the bench plan already promises (E2, after E2-10)

Board as data 17 × 12 sockets, rows → nodes, `−` = ground (E2-2) · room, base, breadboard, fixed BAT+SW 9 V, player,
speaker, lamp on plug leads (E2-3, E2-5) · part models with bands from `resistorBands(ohms, tol)`, cap codes, LED ×5,
TO-92, pot, speaker, player, lamp; `setLook(load, heat, status, light)` (E2-4) · two gestures (carry part, re-seat
leg/lead/probe), tray with unlimited supply, battery switch (E2-5) · model driver (compile on key change, solve on
setting change, one `ModelState`, `advanceHeat` on engine time) + multimeter V/A/Ω with `text()` readouts (E2-6) · LED
and lamp light from model current, heat by load, burn latched until replaced, one wisp on burn (E2-7) · lens dive stand
→ part → inside with a **placeholder** resistor cutaway, `door.cut`, floor ladder (E2-8) · scope sweep/roll, trigger,
min/max decimation, HUD chart + 3D `createScope`, held-page `still` (E2-9) · speaker → `SoundOut`, pacing by the audio
clock (E2-10). Readers `electronics-{bench,board,motion,meter,scope,sound,model}`.

### 3.1 `prologue` — stand · layer prologue · 4–5 steps · 0 terms · no know/now · «Докладніше» optional

Thread (design L278): the player is barely audible straight into the speaker; what to put between them? Probable steps
(PATH.md decides): `quiet` (player → speaker directly) · `stand` (the bench, the tray, the battery) · `loud` (the
finished amplifier on the same board plays) · `map` (the journey). Bridge ends with «Як побачити напругу, струм і форму
сигналу?».

| Gap | Why the plan does not cover it | Proposed build (default) | Test |
|---|---|---|---|
| P1 amplifier as a board preset | E1-6 gives a node-level `Netlist` (`sim/core/amplifier.ts`), the bench needs `PresetPart[]` with sockets + lead sockets | NEW pure data `E/sim/board/presets.ts` (`AMPLIFIER_PRESET`), reused by `amplifier`, `build` | `netlistOf(preset)` has the same node partition as E1-6's netlist; DC node volts equal within 1e-9 |
| P2 loudness visible without sound | QA always runs `noaudio`; plan keeps audio out of readers; DC reading of a music source is 0 | speaker cone excursion from the model's speaker voltage (block RMS / sweep min-max) in `E/shared/parts/speaker.ts`; reader field `rms` (from model samples, not from audio) | RMS of `quiet` < RMS of `loud` by the model's gain (number from E1-6 README) |
| P3 music needs time | player (E1-7), Transient (E1-5), link (E1-9) are hard dependencies | none in E3; if E1-7's verdict is «loop», the scope/cone show the precomputed loop | — |
| P4 journey map in a step | circuit's `map.ts` hard-codes 'Мапа тому' (L29); 11 path stops is a long goal | copy the `journeyInset` idea (USE `@/hud-dom/journey`), board title from a caption; goal = 3 stops opened | manifest test pins the caption |
| P5 term-free words | captions/tooltips are on-screen units; parts are introduced later | tooltips «деталі», «плеєр», «динамік», «батарейка»; never резистор/світлодіод/конденсатор/транзистор/мультиметр/осцилограф (if registered later) | `path_check` |
| P6 first gesture | `SoundOut` starts on `ctx.gesture`; deep links have no gesture | first step's goal is a click (play/switch); text says sound starts on touch | interactions: click → `electronics-sound` counters move (live run without `noaudio`, optional) |

Inside view: none. Hue budget: the finished amplifier shows LED «увімкнено» + teal + cyan grips — keep ≤ 4.

### 3.2 `meter` — stand · path (group `tools`) · ≤ 6 terms · the bridge chapter of LIBRARY §3

Thread: the oscilloscope shows the music as a wave. Probable steps: `volts` (probes on `+`/`−` rails: 9 V; recall of
voltage as words) · `amps` (meter in series in a gap of LED + resistor) · `ohms` (a lone resistor) · `flat` (scope on
the battery: a flat line) · `wave` (scope on the player: music as a wave; two channels). Terms (candidates, ledger
decides): мультиметр, щуп, осцилограф, осцилограма. The title holds напругу/струм/сигнал → those must not be path terms
introduced in `meter` or later (§4 G1).

| Gap | Proposed build (default) | Test |
|---|---|---|
| M1 Ω mode semantics conflict in the plan: E2§1.5 L350 «`null` … 'ohm' on a live circuit» vs E2§5.1 L710-712 «sources removed, in-circuit values as a real meter» | `—` while the probed island holds a closed battery switch or a plugged player (teaches «Ω only de-energised»); otherwise the sources-removed solve | `meter.test.ts`: live → '—'; switch open → value |
| M2 ammeter across the battery = honest short, no fuse (E2 Open Q8) | script must not teach a fuse; battery warms (never burns) | — |
| M3 no AC volts mode (E2§5.1 L713-714) | the multimeter never reads music; «форма сигналу» is the scope's | — |
| M4 scope controls labelled | `segmented` time/div items as unit strings (`'1 ms'`, `'20 ms'`) or captions; series labels from captions | manifest test |
| M5 a gap for the ammeter | the step's preset leaves one jumper out (`leads`/parts preset); the reader's two probes close it | interactions: `electronics-meter.value` ≈ model current of the loop |
| M6 3D meter dial following `mode` | optional (plan: DMM body, LCD optional) | — |

Inside view: none. Numbers (sim README): open battery 9.000 V; red LED + 330 Ω → 21.2 mA; divider 1 k/2 k → 5.997 V.

### 3.3 `resistor` — floor `inside` · path · ≤ 6 terms · first formula `I = U / R`

Probable steps: `flash` (an LED straight on the battery: burns in 0.07 s — honest flash) · `limit` (a resistor in series:
the LED lights, ≈ 20 mA) · `inside` (lens into the resistor: film and its groove) · `ohm` (swap values, watch the
ammeter → «Висновок» `I = U / R`) · optionally `heat`. Terms: резистор, **світлодіод** (design L274-276: the LED is
needed here; `led` then cannot introduce it), ом (ledger decides). Bridge ends with «Як підібрати резистор?» (`sensors`
skipped).

| Gap | Proposed build (default) | Test |
|---|---|---|
| R1 **inside view of a carbon-film resistor** (E2-8 has a placeholder only) | NEW `E/shared/inside/film.ts` (shared: `resistor-pick` burnt-film dive, `sensors`, `smd` later): `createFilm(part: PartModel, opts) → { group; turns(ohms); cut(t); flow(amps); heat(share); burnt(on); update(dt, t); dispose }` — ceramic rod, carbon film with grains (instanced), helical trim groove, end caps, leads, lacquer with bands cut away by `door.cut`; cyan electrons along the remaining strip with speed from `reading(id).i`, warm glow from `heat(id)` | pure `filmTurns(ohms)` monotone + bounded; geometry Box3 inside the part; draw calls ≤ 8 for the whole view |
| R2 swap a value in place | chapter `parts/value.ts`: on change `bench.preset([{ id: nextId, spec: resistorKey(v), legs }])`, `forget(old)`; bands rebuild from the key | ids never reused; reading follows within one frame |
| R3 value picker | slider `{ scale: 'log', stops: E24 values 100 Ω…10 kΩ }` (`E24` from `@electronics/sim/core`) with mark captions; tray carry stays possible | stop list test |
| R4 the burn moment | step starts with the switch open (SW default open); deep link at `freeze=3` must show an intact LED | chapter-check frame + reader `status` = ok before the click |
| R5 term order | «резистор»/«світлодіод» not in this chapter's title/hook/know; captions of step k may use only terms of steps ≤ k | `path_check` |
| R6 floor ladder | USE `floorLadder(ctx, { floor: () => floorAt(rail.position) })` | interactions: ladder text `inside` at the end of the dive |

Sources for R1 (all copy-clean: platform deps + siblings): `S/bulb-close.ts` `finePath` L79, `fineCoilGeometry` L96
(helix via `TubeGeometry`) → the groove; `S/lamp-view.ts` `capSections` L191 + `createCutter` L206-255 (clipping-plane
wedge with capped sections) → the cutaway; `S/battery-section.ts` Relief/paint L98-136 → section faces;
`C/shared/copper/{electron-sim 326, electrons 193, streaks 113, run 54, hits 143, joule 16, haze 105}.ts` → electrons,
streaks, hit flashes, heat (parameterise `layout.ts`, README L142-143 names `layout.ts` + `lattice.ts` as the two
places); REF only: `electricity/chapters/matter/parts/scatter-crystal.ts` (disorder), `C/shared/world/window.ts`
(stencil portal — needed only for an atoms floor, not here). Honesty note for «Докладніше»/«Бачимо»: the number of
turns is a drawing of «more groove → longer, narrower path → more Ω», not a real part's geometry.

### 3.4 `resistor-pick` — floor `part` · path · formulas `R = (U − U_LED) / I` and `P = U × I` in different steps

Probable steps: `bands` (read the colour code in the close-up) · `series` (why 330 and 470, not 352: E12/E24) · `calc`
(the LED resistor: 9 V, red 1,95 V at 20 mA → 352 Ω → nearest in the series; ammeter confirms) · `power` (`P = U × I`:
330 Ω carries 0,149 W of 0,25 W, «warm») · `burn` (100 Ω across 9 V: 0,786 W, load 3,14 → burns after ≈ 3,8 s; 75 Ω:
1,04 W, 2,8 s) · `tolerance` (gold band = 5 %). Bridge ends with «Як резистори ділять напругу?» (`smd` skipped); the
closing card's «Далі» is **disabled** until `divider` is built (path-body L104-111).

| Gap | Proposed build (default) | Test |
|---|---|---|
| K1 band reader | pure `bandAt(xLocal, model): number \| null` (band index from the hit point on the body; `PartModel` has one `hit`) + a HUD `table` of the code (colour names are captions; digits/multipliers numbers) | `bandAt` table test; `resistorBands` already tested in E2-4 |
| K2 close-up readable and within 4 hues | VISUAL band tokens (no black/grey/gold/silver in the palette: derived, E2§1.3 L284) ; LED off during band steps; body muted | chapter-check hues; if unavoidable, record `--max-hues 5` for this chapter as a deviation |
| K3 nearest series value | pure `nearestInSeries(ohms, 'E12' \| 'E24')` in `E/shared/parts/code.ts` (catalog keys from `resistorKey`) | 352.5 → 330/360 (E24), 330/390 (E12) |
| K4 power readout | `readout` with `text: () => fmtSI(reading(id).p, 'W')` + rating caption 0,25 W | reader `p` = model |
| K5 tolerance | the model uses nominal values exactly (`tolerance` is metadata, `parts.ts` L49-50, L375): **no measured 4,62 kΩ** | — (script states it through the band only) |
| K6 power ratings | only 0,25 W on the path (0,5/1 W are branch parts, design §5.2): «choose a bigger body» is «Докладніше» | — |
| K7 5-band (1 %) code | not planned (catalog 5 % only): 4 bands only | — |
| K8 heat lens | E2 skips `B/thermal-warm.ts` (Open Q12): heat shows on the part; an optional dive into the burnt film reuses R1's `burnt(true)` | — |

Inside view: none required; part-floor close-up = E2-8 `partLensPose`. Optional band magnifier = `C/chapters/build/
parts/magnifier.ts` L76 (stencil twins; E2§2.7 SKIP «until a band-reading magnifier is wanted»).

### 3.5 Cross-cutting additions for E3 (one owner: task E3-5)

| Item | Where | Notes |
|---|---|---|
| Formula card | none new: `note` control with a caption «`I = U / R`» (rich, `inputs.ts` L163-176) or a 3D callout | never in slider marks / board titles |
| Board presets with fresh ids + `forget` | E2 `preset()` contract | if `preset` reuses ids, a burnt part survives «Назад» (E2§3.6 L617) |
| Stage params / `define` wrapper | E2 plan names none | chapters call `ctx.stage.define` with `camera` + params the bench registers (list them in `E/shared/README.md`) |
| Chapter QA helpers | copy `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs` into each `qa/` | a chapter never imports another chapter; `_dev` is deleted by the site profile |
| Per-part shots | `partLensPose(bench, id)`, `partDoor` stops from the part's board pose | phones need `fit` on every shot |

### 3.6 Inside views of the whole path (for planning; E3 builds only the first)

| Chapter (floor) | View | Best source | Verdict |
|---|---|---|---|
| `resistor` (inside) | carbon film, helical groove, electrons | `S/bulb-close.ts`, `S/lamp-view.ts`, `C/shared/copper/**` | **NEW** (E3) |
| `capacitor` (inside) | plates, dielectric, field, charge flow | `electricity/chapters/charge-field/parts/{capacitor 50, cap-circuit 46}.ts` | REF/COPY+ADAPT (needs owner OK: REUSE names circuit/radio only) |
| `capacitor-kinds` (part) | ceramic disc/MLCC layers, film box, electrolytic oxide + vent | `electricity/chapters/lab-inverter/parts/components.ts` `addCan` L80, `lc-rig.ts` | mostly NEW |
| `diode` (atoms) | Si lattice, dopants, p-n junction | `electricity/chapters/matter/parts/{pn-block 48, si-sheet 118, dopants 35, diamond 16}.ts` + `C/shared/world/window.ts` | COPY+ADAPT (same OK); re-derive barrier from `sim/core/diode.ts` |
| `led` (inside) | chip, dome, photons by colour | `matter/parts/dev-diode-led.ts` `createLed` L77 | COPY+ADAPT |
| `transistor` (inside) | NPN emitter/base/collector, TO-92 | nothing bipolar in the repo | NEW |

---------------------------------------------------------------------------------------------------------------------

## 4. Risks, gotchas, open questions

### 4.1 Risks

1. **Dependency stack.** The «easy» chapters are the most dependent: `prologue` needs E1-5, E1-6, E1-7, E1-9, E2-9,
   E2-10 and P1; `meter` needs E1-5, E1-7, E2-9. Mitigation: build `resistor` → `resistor-pick` → `meter` →
   `prologue`; scripts in journey order; push only when all four pass.
2. **Term order kills titles and bridges** (G1). Mitigation: E3-0 decides the register against all 19 titles before any
   script; a probe run of `path_check` with draft scripts.
3. **Colour discipline vs subject.** Band close-ups and LED rows exceed 4 hue families easily. Mitigation: VISUAL
   tokens, LEDs off in band steps, recorded per-chapter `--max-hues 5` only as a last resort.
4. **Draw calls.** Bench (≈ 200 planned with the room) + film inside view + electrons + scope can pass 350.
   Mitigation: instanced grains/electrons, film view ≤ 8 calls, hide the bench's far items when inside.
5. **Worker/audio on the Pages sub-path** — first worker on the site; smoke runs the plain URL in SwiftShader with a real
   clock. Mitigation: smoke the profile locally before push; lazy `AudioContext` after gesture.
6. **Concurrent regeneration.** Every script commit rewrites INDEX/GLOSSARY/all generated JSON; parallel script tasks
   collide. Mitigation: serialise regen + commit.
7. **Script ↔ code drift.** Positional captions; a reorder silently relabels the scene. Mitigation: manifest test lists
   every index the code uses; scripts change captions only with the code.
8. **Honesty of visual mappings** (film turns ↔ ohms, cone ↔ RMS, electron speed ↔ current). Mitigation: each mapping a
   pure tested function from a model number, named as a simplification in README and «Докладніше».
9. **Phones.** Probes and legs at P ≈ 15–20 px in the stand shot. Mitigation: closer `board` shot, whole-part carry,
   `mobile-check pp` in acceptance.

### 4.2 Gotchas

1. **G1 term positions.** Position = journey index × 1000 + step; title/hook/know at +0.5, bridge/now at +999. A term may
   not appear on screen before its step: a chapter's own new terms can never be in its title/hook/know; the prologue's
   bridge (≈ 999) carries `meter`'s title, so напруга/струм/сигнал cannot be terms introduced in `meter`; `capacitor`'s
   title holds «конденсатор» (E4 problem: introduce it in `divider`'s last step, or keep it a plain word). Captions are
   on-screen units too.
2. **Prologue:** zero terms, no know/now, 4–5 steps; «Ціль» still required; its words cannot name any later-registered
   part (P5).
3. **`·` (U+00B7) splits «Підписи»**, `,`/`·` split «Нові терміни»/«Згадати»; captions cannot contain `«`/`»`.
4. **«A» → «B» is two indexes**; timing is data only — the scene implements `!reached`/`reached`.
5. **Hints are plain text**; «Текст» is policed for formulas; «Дія», «Думка», hook, now, bridge are not policed at all —
   keep formulas out of them by review.
6. **Typography** inserts NBSP between number and unit (tests compare with `.split(NBSP).join(' ')`), turns ` - ` into
   ` — ` outside code spans (write `−` U+2212), `µ` → `μ`, `...` → `…`. `regen.sh` does not run it; doccheck `--check` does.
7. **Latin outside backticks** in on-screen fields and «Докладніше» needs the allowlist (BC547, NPN, SMD, ESR fail
   today; `LED`, `MOSFET`, units, single letters, `E24`, `1N4148` pass).
8. **«Докладніше»-only words** are banned in Висновок/Підписи/Підказки; if «ом» is such a word, a caption «Ом» fails —
   write `Ω`.
9. **No `docs.checks`, no Cyrillic-unit/mixed-script/450-char checks** for path volumes; `D/check.py` is the only place
   for volume rules (μ, apostrophe, banned topics).
10. **Font coverage skips** «Текст», hints, captions: a missing glyph in a 3D caption shows up only at run time as a
    `console.warn` → chapter-check FAIL. ×, ⋅, Ω, ≈, −, μ, ⎓, subscripts are in the charset.
11. **`group: meta.group`, no `parent`** on main chapters; circuit's `group: 'path'` is wrong here (`volumes.test.ts`).
12. **`stepUi(ctx)` once**; DOM dock/board rebuilt every step entry (chart `init` refills from scene state); control ids
    are chapter-wide.
13. **Step `enter` runs before `enterStep`**; entry is `instant` even from the previous chapter; params revert on entry.
14. **Short ids resolve to circuit** in tools (`prologue`, `build`); mobile-check names its out dir by the short id →
    collides with circuit runs: separate `--out`.
15. **Any `console.warn` fails chapter-check**; circuit's harness filters warnings out of its own check and has the
    `e.text` bug (L269).
16. **Leak check silently skips** with one built chapter (site profile); the full tree leaves to another volume.
17. **`QA_ALLOW_SOFTWARE=1`** (qa-env) disables the NVIDIA assertion: unset it for perf numbers.
18. **Deep links show the opening card** on a first step and hide takeaways before goals: chapter-check sheets are
    pre-goal by construction; goal states come from the interaction script.
19. **The closing card's «Далі» is disabled** (tip «Ця глава ще готується») when the next chapter is not built — assert
    that, not navigation, for `resistor-pick` → `divider`.
20. **Burnt damage lives by part id for the mount**: re-entering a step with the same preset id shows the part still
    burnt; `?freeze=3` deep links simulate 3 s — a preset with the switch closed burns an LED before the screenshot.
21. **Bench numbers**: battery 1,5 Ω (5,997 V, not 6), `lamp-6v` on the bare 9 V battery burns in 2,1 s — a lamp step
    needs a series resistor whose own power exceeds 0,25 W at ≈ 0,1 A (hand estimate: 33 Ω ≈ 0,31 W, load ≈ 1,2 →
    burns after ≈ 15–20 s; verify with `solveDC` + `burnSeconds`): avoid the lamp in E3 or use `battery-4aa` (not in
    `BENCH_FIXED`).
22. **Tolerance is not modelled per instance**; only 0,25 W resistors on the path; 4-band code only.
23. **Generated files are committed and checked by CI**; `sync` deletes stray JSON in `content/generated/`.
24. **H1 vs journey title** are not compared by tools, but `journey.test.ts` pins `volume.json` titles and `D/check.py`
    compares PATH.md with `volume.json`: change all three in one commit, or keep the H1 identical.
25. **Registering `index.ts` publishes on the next push** (CI builds and smokes the profile); smoke then demands the
    deep link into the lowest-order built chapter.
26. **Recon docs referenced in code are absent** (`docs/PATH_FORMAT.md`, `HUD_DOM.md`, `MOBILE.md`): the code is the spec.

### 4.3 Open questions (each with the default E3 proceeds on)

1. **Circuit's known words** (напруга, струм, опір, заряд, енергія, ампер, вольт) — terms or known words? Default:
   known words in a prose `## Слова, які читач уже має`; no cards; usable anywhere.
2. **«сигнал», «динамік», «плеєр», «підсилювач»** — terms? Default: plain words (the amplifier chapter introduces its
   own narrower terms); otherwise the prologue cannot speak about its own premise.
3. **«світлодіод»** — introduced in `resistor` (default, design L274-276) or kept a plain word until `led`? Default:
   `resistor/<limit step>`; `led` introduces its own terms (колір/напівпровідник per ledger).
4. **Who creates `_terms.md`** if E1-8 does not? Default: E3-0, before any script; E1-8's `check.py` rule 3 (if copied
   from radio) must then pass in the same commit.
5. **Ω on a live circuit** (M1). Default: `—` while a closed battery or a plugged player is in the probed island.
6. **Formula sign for products** in captions/Висновок. Default: `×` in «Підписи» (cannot be `·`), `·` allowed in
   Висновок/Докладніше — or `×` everywhere for consistency (recommended).
7. **Film or metal film** for the inside view. Default: carbon film (beige body, 5 % gold band = the catalog).
8. **Inside views from `electricity`** (E2 Open Q15). Default for E3: not needed (film is NEW); for E4–E6 ask the owner
   via PATH-NOTES with the default «COPY+ADAPT with REUSE rows».
9. **Interaction-script contract.** Default: one `qa/interactions.mjs` per chapter, last line `PASS electronics/<id> —
   <n> checks (<size>)` / `FAIL electronics/<id> — <k> of <n> checks (…)`, exit 1 on failure; helpers copied from the
   bench sandbox.
10. **Acceptance sizes and perf.** Default: chapter-check default size (1920×1080 + forced 1280×720 layout) with
    `--skip perf` under software, plus one GPU perf run recorded (gate 8 ms reported, not blocking until the owner
    decides); `mobile-check --profiles pp`; `--sizes all` at the batch gate only.
11. **Browser target.** Default: the site profile (published, sub-path, no `?debug`); the full tree only for perf.
12. **Smoke asserting the worker** (`mode === 'worker'`, E2 risk 6) is not in `tools/site/smoke.mjs`. Default: assert it
    in `prologue`'s interaction script on the site profile (live page section), leave smoke untouched.
13. **Prologue map goal.** Default: 3 stops opened (11 path stops is too long for a 5-minute prologue).
14. **Amplifier preset owner** (P1). Default: E3-5 writes `E/sim/board/presets.ts` (pure, purity-tested) from E1-6's
    netlist; `amplifier`/`build` reuse it.
15. **Lamp on the bench in E3.** Default: unused in the pilot chapters (G21); revisit when `battery-4aa` joins
    `BENCH_FIXED` or a step needs it.
