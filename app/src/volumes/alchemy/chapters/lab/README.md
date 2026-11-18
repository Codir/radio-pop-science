# Chapter `alchemy/lab` — «Лабораторія перетворень»

The only chapter of the volume `alchemy`: one atom, a set of tools, eleven quests and a free lab — 12 steps in one
scene. Script: `docs/volumes/alchemy/chapters/lab.md` (all reader text comes from its generated export,
`content/generated/lab.json`). The rules of the game are the pure model `@alchemy/sim/lab` (README there); this
chapter only plays it and shows it.

## Files

| File | What |
|---|---|
| `index.ts` | manifest (eager, tiny: from `lab.manifest.json`), lazy scene; accent `violet`, `sky` / `mood` `micro` |
| `chapter.ts` | `STEP_IDS` = the model's `QUEST_IDS` + `free` |
| `content.ts` · `labels.ts` | runtime content; scene and control captions — those the document quotes in «Інтерактив» are read from the export with `doc(step, wording)` (a renamed button breaks the build, not the link to the text) |
| `shots.ts` | the one camera shot `lab` (atom at the origin, plate to its right, emitter lower left; `fit` for phones) |
| `scene.ts` | orchestrator: session → event queue → atom / animations / dock; `ctx.qa.expose('lab')`, probes |
| `parts/session.ts` | the game session: state, tools of the step, countdown of a fleeting nucleus (engine clock), quest result, saving |
| `parts/storage.ts` | the only code that touches `localStorage` (`alchemy:v1`); every failure is silent |
| `parts/text.ts` | numbers and events in words: half-lives over forty orders of magnitude, energies, decay names, the card, one line per event |
| `parts/atom-view.ts` | nucleus (`shared/nucleus.ts`) and shells (`shared/shell-atom.ts`), the name plate with the status badge, the wordless stability display (rest / restless / trembling with a `red` halo and the countdown ring) |
| `parts/emitter.ts` | the emitter device and what flies out of it (projectiles, γ quanta, bounces); also the shared animation contract `EventFx`, `Clip`, `Cluster` |
| `parts/decay-fx.ts` | everything that leaves or falls into the nucleus: α, β⁻ / β⁺, nucleons, evaporated neutrons, electron capture, surplus electrons; the flash |
| `parts/fission-view.ts` | the fission drop (`shared/fission-drop.ts`), the two hanging fragments with their pick rings |
| `parts/dock.ts` | the step UI of all twelve steps: card, projectile choice, electron counter (`shared/count-stepper.ts`), tools, chips, hotspots, callouts, the board; `announce` turns session events into toast / status line / sound |
| `parts/chart-model.ts` · `parts/nuclide-chart.ts` | the nuclide chart: what it shows (pure) and the widget in both interfaces (WebGL `custom` node and DOM canvas) |
| `parts/start-picker.ts` | the free lab's «Новий старт»: element and isotope sliders, «Взяти як старт» / «Скасувати» |
| `qa/interactions.mjs` · `qa/helpers.mjs` | the browser interaction test (below) |
| `__tests__/` | node tests: text, session, storage, dock, chart model, start picker, event animations, atom view, manifest |

## How it is put together

1. **Session.** `Session` holds the `GameState` and is the only thing that changes it. A step entry
   (`session.enter(step)`) starts a new run: the quest's start nuclide, or the saved free lab. The dock's buttons call
   `fire`, `knock`, `wait`, `pickFragment`, `setElectrons`, `neutralise`, `restart`, `startFrom`; each emits events
   — `reset` (a new run), `turn` (`{ event, before, after }`), `done` (`{ moves, best, improved }`). The countdown of
   a fleeting nucleus runs on `update(dt)` (engine clock, never `setTimeout`); dice come from
   `ctx.random.fork('visit:' + rolls)`, a counter in the saved progress, so every visit rolls differently and an
   empty storage (QA) rolls the same way every time.
2. **Event queue** (`scene.ts`). The model changes at the click; the scene shows it afterwards. Events wait in a
   queue and play one after another, each from its own payload (never `session.state`, which may be newer).
3. **Atom and animations.** A shot, a γ quantum or a fragment pick plays in the emitter / fission view; a decay in
   `decay-fx`. The atom switches to the event's `after` state at the moment the animation reaches the nucleus
   (`onImpact`), with a `yellow` flash.
4. **Dock and chart.** The card, the readouts, the chart and `read('lab')` follow the model itself, at the click
   (for up to ≈ 0.6 s the card can name the nuclide the atom is about to become). The toast, the status line and
   the sound wait for the picture (see «Accepted behaviours»).

## Accepted behaviours (a maintainer must know these)

- **Announcements fire when the atom changes.** A hit is announced when the projectile arrives, a γ knock-out when
  the γ arrives, a decay as the particle leaves, an electron capture when the electron reaches the nucleus, a
  fission when the drop tears (the atom steps aside already at the neutron's hit), a fragment pick when it reaches
  the centre, a bounce at the turn. Refusals, electron changes and the quest result have nothing to animate: they
  speak when it is their turn in the queue (at once when nothing plays), so the status line never runs ahead.
- **Skip rule.** When more than two events wait behind the one on show (`MAX_WAITING = 2`: presses faster than the
  pictures), or the reader asked for reduced motion, everything jumps to the final picture at once; each skipped
  event is still told once (atom, plate, status, toasts, sounds). A new run (an entry, «Почати знову», a new start)
  drops the queue and stops every animation; no late callback fires. A deep-link entry shows its start at once;
  later events animate as usual.
- **State-driven honesty chips.** Every step has all five chips: «спрощена модель», «не в масштабі», «час
  очікування пропущено», «ілюстративно», «нетривке ядро сповільнено: живе 2 s». The last two are always on only
  where the quest is about them (`illustrative`: `fission`, `superheavy`, `free`; slowed: `sun`, `star-forge`,
  `uranium-chain`, `superheavy`, `free`); elsewhere they appear once the run has met a fleeting nucleus (⁴H in
  `heavy-hydrogen`) or a fission (²³⁹Pu in `plutonium`), and stay until the next run.
- **Free lab, charged atom.** In `free` only, while the atom is charged, «Нейтралізувати» takes the place of «Почати
  знову»: seven buttons would need a fourth action row and the dock would scroll at 1280×720. Restart is one press
  away after neutralising (or via «Новий старт»). In the quests both buttons are shown.
- **The dock fits 1280×720 without scrolling.** So the readouts and the status line live on the board, the card's
  last row («Заряд і зв'язок») is the electron counter's caption and the projectile choice has its caption as a
  tooltip. While a fission waits for the fragment choice, the tools give way to a note under the card («Оберіть
  уламок: …» — in the scene or with a button), the two fragment buttons and «Почати знову»; while the free lab's start
  choice is open, only the choice is offered (two sliders, a note under the card, «Взяти як старт», «Скасувати»).
  The card is never the dock's last row: the platform's DOM table reaches 2 units below its row, and as the last row
  it made the dock scroll by 2 px at 1920×1080.
- **The card's «Ядро» row** reads status · main decay · half-life («Радіоактивне ядро · α-розпад · T½ 704 млн р.»,
  «Стабільне ядро»): the status word is there for a screen reader and for a phone (the plate under the atom is 3D
  text, small on a phone); a hyphenated decay name sits in the first line and «T½ …» is one unbreakable piece, so a
  row that wraps breaks at a space, never at «α-» / «розпад».
- **Board layout** («Карта нуклідів», top left): the chart (a 15 × 11 window of the N × Z table round the current
  nuclide, or «Уся карта»), the picked cell's line (only while a cell is picked), the «Уся карта» switch with the
  energy readout beside it, the collection («Відкрито елементів N / 118», «Відкрито нуклідів M / 3383»), the
  readouts of moves and elapsed time, the status line (latest event, or the quest result until the next run); in
  `free`, «Почати звідси» for a picked natural nuclide in the button row. Readouts and toggles that follow each other
  share a row; the order keeps the energy's long text out of the moves / time row (it overran the WebGL board) and
  keeps the whole board unscrolled at 1280×720 with a picked nuclide, «Почати звідси» and a two-line status.
- **Clicking a cell is information only.** It outlines the cell in `cyan` and shows its line on the board; every
  action has its twin in the dock (the start picker is the keyboard path to «Почати звідси»).
- **The quest result** is a 6-s toast plus the status line. The chapter takes its toasts away when it is disposed
  and as soon as a full-screen view (the volume home, the journey map, the library) covers the scene
  (`dismissWhenLeft`, every frame, reading `hud()?.overlay` of `@/hud`): the chapter stays loaded under those views,
  and a desktop HUD keeps toasts over them.
- **Colours** follow `docs/STYLE_GUIDE.md` §2.2.3.

## QA hooks

`window.__app.read('lab')` — the model, never the animation:
`step`, `z`, `n`, `electrons`, `moves`, `elapsed` (s), `done`, `best` (null in `free`), `pending` (a fragment
choice waits), `countdown` (s left for a fleeting nucleus, or null), `discovered` (count), `symbol` (ion symbol),
`busy` (an animation plays or waits), `chart` `{ n0, z0, cols, rows, grid }` (the window, and the cell grid as
fractions of the `ctl-chart` box — used to aim at a cell), `picked` (`'z-n'` or null), `picking` / `choice` (the
free lab's start choice).

Probes (`__app.locate(name)`): `lab.nucleus`, `lab.plate` (the name plate), `lab.emitter` (the device's collar),
`lab.fragment.heavy`, `lab.fragment.light` (the hanging fission fragments; not shown while there is nothing to pick).

Controls are found with `__ui.locate('ctl-<id>')`: `card`, `projectile` (`:n` … `:ca48`), `electrons`
(`:minus`, `:plus`), `fire`, `gamma-n`, `gamma-p`, `wait`, `neutral`, `restart`, `pick-heavy`, `pick-light`,
`fragment-hint`, `new-start`, `pick-element`, `pick-isotope`, `start-hint`, `take-start`, `cancel-start`; on the
board `chart`, `picked`, `full`,
`energy`, `collection`, `moves`, `elapsed`, `status`, `start-here`.

## QA

Build and start a server yourself (no QA tool starts one), then:

```bash
cd app && pnpm build && pnpm preview --port 5351     # in another terminal; then QA_PORT=5351
export QA_PORT=5351                                  # QA_ALLOW_SOFTWARE=1 on a machine without a working GPU
node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --size 1280x720 --hud dom   # also --hud gl, 1920x1080
node tools/qa/chapter-check.mjs alchemy/lab --sizes all --hud gl --out <dir>               # and --hud dom
node tools/qa/mobile-check.mjs alchemy/lab --out <dir>
pnpm vitest run src/volumes/alchemy                                                        # in app/
```

`qa/interactions.mjs` (exit 1 on any failed check or console error / warning; `--out <dir>` saves the dock of every
step and pictures in mid-action) drives every control with real pointer input on a frozen engine clock
(`?freeze`), reads the game only from `read('lab')`, and checks: each tool of each step with a visible
consequence, the dock fitting 1280×720 unscrolled, the card's «Ядро» row (status first; DOM: no line ends at a
hyphen), the board, the chart (window, goal, trail, a picked cell), the result toast gone on the volume home and the
map, the
event animations (the model changes at the click, nothing playing afterwards, a fragment picked in the scene,
a jump mid-fission, ten presses in one frame, reduced motion), every quest won from the dock, the free lab's new
start (dock and chart), a reload keeping the free lab and the collection, and a second browser context whose
`localStorage` throws. A fresh context has empty storage, so the dice fall the same way on every run.
