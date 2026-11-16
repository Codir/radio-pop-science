# DECISIONS — cross-cutting conventions (orchestrator rulings)

Binding for all content, UI and chapter code. Collected from agents' notes/requests; newest at the bottom.
If a chapter document contradicts this file, this file wins and the document must be fixed.

## Notation & language

1. **Energy symbol.** Electrical energy and work are `W` (ISO/IEC 80000-6): `W = P·t`, `W = C·U²/2`, `W = L·I²/2`,
   `W = q·U`. `E` is reserved for electric field strength. Canonical physics formulas keep their usual form:
   `E = h·ν`, `E = m·c²`, band gap `E_g`, kinetic energy `E_k`. EMF is written `EMF` (symbol `ℰ` only inside
   formulas, introduced once).
2. **Voltage symbol** is `U` in formulas (IEC); `V` is the unit. In named quantities from datasheets the
   international labels are kept as-is: `V_oc`, `I_sc`, `V_mp`, `I_mp`, `V_DC`.
3. **Term rule** (CURRICULUM top): international term/abbreviation/symbol first at first mention in a chapter,
   then the Ukrainian equivalent; SI unit symbols in Latin; decimal comma in Ukrainian prose; thousands
   separated by a thin/non-breaking space; `×10ⁿ` for powers of ten.
4. **Ukrainian terminology** — one variant course-wide: «розподільні мережі», «сила струму»/«струм», «напруга»,
   «опір», «потужність», «трансформаторна олива», «магнітна індукція» (B), «автоматичний вимикач» (MCB),
   «ПЗВ» (RCD), «заземлення», «реклоузер», «СІП», «ОПН», «припливний», «мультиплікатор» (wind gearbox),
   «бозон Гіґґса». Chemical elements in the atom builder: nomenclature name + substance in brackets
   («Купрум (мідь)»); in prose — substance names (мідь, кремній, залізо).
5. **Honesty labels.** Any slowed-down, scaled or simplified visual/model carries an on-screen chip
   («сповільнено ×N», «не в масштабі», «спрощена модель»).
6. **Superlatives and volatile statistics** always carry a year («станом на 2025 р.»); where sources disagree,
   use a range and avoid "the largest in the world" unless undisputed.
7. **Maps.** Ukraine is shown in its internationally recognised borders; no front lines or damage imagery.

## Colour (additions to STYLE_GUIDE §2.2 — already merged there)

8. Warning state `amber` (`ui.warning`); magnet poles N `coral` / S `blue`; DC poles + `coral` / − `blue`;
   plant-type palette `plantType.*` (see STYLE_GUIDE). Transformer windings: primary `coral`-tinted copper,
   secondary `sky`-tinted copper. In-world SCADA screens may use the real dispatcher convention (red = closed /
   energised, green = open) only if a hotspot explains it.

## Models

9. **One frequency model** for `grid` and `plant-future`: АЧР (UFLS) starts at 49,0 Hz; FCR fully activated at
   ±200 mHz deviation within 30 s; normal band ±50 mHz; reference incident 3000 MW (Continental Europe).
10. **Shared simulation library.** Cross-chapter models (DC circuit MNA solver, grid frequency/swing model,
    PV I-V model and sun position, battery OCV/CC-CV/pack, SPWM/THD, hybrid-home 24 h energy flow, load
    profiles) live in `app/src/sim/` as pure, unit-tested TypeScript and are reused by chapters; chapter
    documents' control-point values are the test fixtures.

## Shared world

13. **One house.** The house in `home`, `distribution` (service entrance) and all four labs is the same
    cutaway house model from the kit («дім-лабораторія»), with the labs' shared fictional equipment: 440 W PV
    module «ЛМ-440», 6 kW hybrid inverter «ЛІ-6», 10,24 kWh LFP battery. Generic, never real brands.
14. Authors' reference implementations of the lab models (Python) are kept in `tools/ref-models/` as test
    oracles for the simulation library.

## Semiconductors (after review R1)

15. Depletion region = «збіднена область» everywhere (`matter`, `lab-pv`, `lab-inverter`).
16. Band diagrams: valence band `violet`, conduction band `sky`, band gap dark (`bg.deep`); electrons `cyan`,
    holes `coral` — identical in `matter` and `lab-pv`.
17. Built-in potential keeps its international label `V_bi` (same rule as `V_oc`, `I_sc` — DECISIONS §2).
18. Typography is normalised by script on all chapter documents after the reviews are merged (apostrophe ’,
    non-breaking space between number and unit and in thousands groups, «…» with „…“ inside).

## Structure

11. Chapter step counts in the design documents supersede the CURRICULUM outline (authors added/split steps).
12. Cross-references between chapters use chapter id + step id (``→ `grid/frequency-balance` ``); reviewers
    verify that the target exists.

## After reviews R3+

19. AVR: «AVR (automatic voltage regulator) — автоматичний регулятор напруги»; for large synchronous
    generators add once «(у великій енергетиці — АРЗ, автоматичний регулятор збудження)».
20. «відгалуження» (not «відпайка») for transformer taps; `p.u.`, `rpm`, `tan` as international notation.
21. Cross-chapter fixes requested by reviewers are collected from `docs/audits/review-R*.md` and applied in one
    reconciliation pass after all reviews are merged (agent `E1-reconcile`), together with the typography pass.
22. Grid-forming inverter = «мережоформувальний інвертор»; grid-following = «мережевідомий інвертор».
    Frequency nadir = «надир частоти (nadir) — найнижча точка провалу» (not «дно частоти»).
23. Non-breaking spaces between number and unit are used everywhere on-screen, including inline formulas.
24. **Shared lab equipment — battery side (one definition for all four labs).** Battery: LFP 16S, 51,2 V × 200 Ah =
    10,24 kWh, built from two 100 Ah modules in parallel; BMS continuous limit 200 A (1C), recommended 100 A (0,5C).
    Hybrid inverter «ЛІ-6»: 6 kW AC continuous, 12 kW peak for 10 s; battery port 135 A continuous (the limiting
    element, ≈ 6,9 kW DC), 250 A peak for 10 s; PV inputs 16 A operating / 20 A short-circuit per MPPT.
25. String inverter = «стрінговий інвертор»; PV string = «стрінг (ланцюжок модулів)». SPD = «ПЗІП (пристрій
    захисту від імпульсних перенапруг)»; «ОПН» only for HV surge arresters.
26. Steam parameters: «докритичні / надкритичні (SC) / ультранадкритичні (USC)»; pressure ratio = «ступінь
    підвищення тиску»; feedwater heater = «підігрівник»; CCS = «уловлювання та зберігання вуглецю».
27. Fuel cell = «паливна комірка» everywhere (avoids confusion with nuclear «тепловидільний елемент»).
28. Plant flexibility figures (ramp rate, minimum load, start-up time) are owned by the hub `plants/flexibility`;
    `grid` and the plant chapters quote the hub ranges (old vs modern units stated explicitly).
29. Every chart, lane, chip and map marker that encodes a plant type uses `plantType.*` (STYLE_GUIDE §2.2) in
    all plant chapters, `grid` and `plants`.
30. «лампа розжарення» (once: «або жарівка»); no-load = «неробочий хід» (first mention: «неробочий (холостий) хід»).
31. Named laws and scientists: first mention international-first («Ohm's law — закон Ома», «Maxwell's equations —
    рівняння Максвелла»), afterwards Ukrainian with normal declension; never Latin name + Ukrainian ending.
32. Greek mu `μ` (U+03BC) for micro and permeability, never the legacy micro sign `µ` (U+00B5).
33. Panel copy term order is always «**International term** — український відповідник» at first mention; the
    reconciliation pass converts any chapter still using the reverse order.
34. Duck curve = «качина крива (duck curve)»; FCR = «резерв підтримання частоти (FCR)»; black start = «пуск
    «з нуля» (black start)»; steam = «пара» (feminine). Grid-forming stays «мережоформувальний» (§22) — replace
    «мережоутворювальний» wherever it appears.
35. Run-of-river = «ГЕС на стоку (run-of-river)»; «руслова ГЕС» is a layout term and is not a synonym.
    Potential energy `E_p`, kinetic `E_k` (canonical mechanics symbols, like §1 exceptions).
36. Nuclear chapter colour code: nuclear energy / chapter accent / radioactivity marker `violet`
    (`plantType.nuclear`); core and pool glow `sky`→`white` (never `cyan`, which is the electron); neutrons
    `mist`→`steel`. Status frames on maps use `amber`, not pulsing `red`.
37. GSU = «блочний трансформатор (GSU)» (not «блоковий»). The reference 1000 MW unit generator is 24 kV, 26,7 kA
    everywhere (`generator-ac`, `transformer`, `transmission`, `home` finale, plant chapters).
38. Reactive / charging current is drawn as `sky` dashed pulses (token `flow.reactive`); reverse active power
    flow keeps the energy colour `yellow` with reversed chevrons — never a new hue.
39. Each chapter document ends with a «Перехресні посилання» section (chapter id + step id); builders turn
    them into in-app links.
40. «оливний трансформатор», «трансформаторна олива» (never «масляний»). Tidal range = «величина припливу»
    (not «амплітуда»); spring / neap tide = «сизигійний / квадратурний приплив».
41. Simulation fixtures are taken from the *reviewed* documents on `main` (reviewers changed several models:
    wind wake and shear, tidal barrage, coal efficiency, combined cycle, `plant-future` M4, hydro M2/M6,
    transformer Т1, `distribution` Р5/Р6/Р8, `lab-hybrid-home` self-sufficiency), never from authors' originals.

## After reconciliation E1 (proposals N1–N9 ruled)

42. (N1) Non-breaking spaces apply to on-screen copy; «Модель симуляції» and «Примітки щодо фактів» sections use
    plain spaces so fixtures stay grep-friendly.
43. (N2) Nested quotes: „…“ inside «…». The «…» that delimit a panel page or hotspot text in the documents are
    delimiters, not copy — content is taken from the generated export (`docs/chapters/_export/<id>.json`), which
    strips delimiters and promotes inner quotes correctly; builders never retype or hand-copy Ukrainian text.
44. (N3) «спад напруги», «синхроноскоп», «швидкість зміни навантаження» (ramp rate), «чисте (залишкове)
    навантаження» (net load); BESS = «акумуляторна система накопичення енергії (СНЕ)», with one mention in
    `plant-future` that Ukrainian law calls it «установка зберігання енергії (УЗЕ)».
45. (N4) Symbols: half-life `T½`, solar constant `G_sc`, stored heat `W_th`; standard electrode potential `E°` and
    particle / level energies keep `E`.
46. (N5) Durations after a number: `s`, `min`, `h`; «доба», «рік», «р.» stay Ukrainian.
47. (N6) PV string = «стрінг» in running text too; «ланцюжок» only for cells inside a module / battery cell chains.
48. (N7) `docs/chapters/_shared-house.md` owns appliance nameplates, circuits and lab equipment;
    `lab-hybrid-home` §M2 owns the 24 h profiles.
49. (N8) `INDEX.md`, `GLOSSARY.md` and `_export/*.json` are generated, never hand-edited; `tools/content/doccheck.py`
    must be green before any change to `docs/chapters/` is merged.
50. (N9) Semiconductor colours: donor atoms (P) and n-region tint `teal`; acceptor atoms (B) and p-region tint
    `pink`; electrons `cyan`, holes `coral` (unchanged). Same in `matter`, `lab-pv`, `lab-inverter`.
51. The course has **25** chapter modules (12 on the main path incl. the `plants` hub, 9 plant types, 4 labs) and
    267 steps; earlier documents that say 26 are wrong.

## After Phase 2 (kit, UI, fx)

52. The shared house follows the kit model `cutawayHouse` (`docs/KIT_API.md`): a spine wall with six showcase
    rooms facing the cut; the storage room («комора») is a lab niche in the hall and the balcony is on the east
    wall. Where `_shared-house.md` or a chapter document describes the layout differently, the kit layout wins;
    device ids in the house equal the simulator ids.
53. Chapter text at runtime comes from `app/src/content/generated/<id>.json` (generated from the export) through
    `defineContent()`; UI through `stepUi(ctx)` (`docs/UI_API.md`); effects from `@/fx` (`docs/FX_API.md`);
    models from `@/kit` (`docs/KIT_API.md`); physics from `@/sim/<id>`.

## Term rule revised by the user (2026-11-13 evening) — supersedes §3 (term order), §31, §33 and the
## "international first" wording wherever it appears

54. **Terms are written in plain Ukrainian.** The earlier "international term first" principle is withdrawn:
    it made the copy read English-first. On screen (panel pages, titles, hotspot and callout names, chips,
    control labels, quiz, facts, misconceptions):
    a. Use the Ukrainian term alone: «кварки», «змінний струм», «напруга», «вітрова турбіна». No
       «English — українською» pairs, no English term in front, no English in parentheses by default.
    b. An international **abbreviation** stays only where there is a real need — it has no established Ukrainian
       equivalent and is what the learner will actually see on devices, datasheets and in apps (BMS, MPPT, PWM,
       LED, SOC, DoD, LFP, NMC, HVDC, IGBT, MOSFET, USB-PD, GaN …). Form at first mention in a chapter:
       Ukrainian explanation first, abbreviation in parentheses — «система керування батареєю (BMS)»; after
       that the abbreviation alone may be used.
    c. Where an established Ukrainian abbreviation exists (ПЗВ, АЕС, ТЕС, ГЕС, ГАЕС, ВЕС, СЕС, ЛЕП, ТП, ККД, ЕРС,
       КЗ, АПВ, АЧР, ОЕС, ПЗІП, СІП, ОПН, КВВП, ВВЕР), use it. Add the international one in parentheses once
       only if the learner meets it on real equipment or documents: «ПЗВ (на корпусі — RCD)», «змінний струм
       (AC)», «постійний струм (DC)».
    d. Named laws and scientists: Ukrainian only — «закон Ома», «рівняння Максвелла», «межа Беца».
    e. Proper names stay as they are (ENTSO-E, ITER, Schuko, Europlug, Type F); reactor/technology type codes
       follow (b)/(c): «водо-водяний реактор під тиском (PWR; у нас — ВВЕР)».
    f. **Unchanged:** symbols, formulas and units stay international (U, I, R, P, W, cos φ; V, A, Ω, W, kWh, Hz),
       with all typography rulings (§18, §23, §32, §42, §43, §46).
    g. Structured data keeps both forms: the «Терміни» lines, the «Глосарій розділу» tables and the hotspot
       name pairs in the documents still carry the international equivalent as data. The app **displays** the
       Ukrainian name (plus «(ABBR)» when the international form is an abbreviation kept under (b)/(c)); the
       glossary is sorted by the Ukrainian term and shows the international equivalent as a secondary line.
    h. Labels that builders author themselves in chapter code (callouts, console titles, button text) follow
       the same rule.
55. (replaces §25 and §47 on this point) PV string = «ланцюжок модулів»; at its first mention in a chapter:
    «ланцюжок модулів (стрінг)», because installers and inverter labels say "string". «стрінговий інвертор» stays
    as the established name of the product type. Glossary rows use «ланцюжок модулів».
56. Spelling: «ефект Ферранті». VSC = «перетворювач напруги (VSC)». Appliance names in the shared house are
    Ukrainian («Роутер і оптичний модем», «Світлодіодне освітлення»); device ids in code do not change.

## Mobile target (user decision, 2026-11-13 evening)

57. **Desktop stays exactly as built and planned; in addition the app adapts automatically to tablets and
    phones, portrait included.** Adaptation is done centrally by the engine and the HUD (form factor,
    layouts, quality tier, camera fit, touch), not by per-chapter special cases. Chapters make that possible by
    following the **mobile rules**:
    a. Everything a learner must read or operate lives in the HUD: step panel, control dock, `board`. Text
       in the 3D world is limited to short labels; consoles/cards in the world use the world-console preset
       (which re-homes to the HUD on phones) — never hand-built text panels.
    b. No hover-only information or action. Every interaction works with one finger; drag handles and
       tappable objects are ≥ 44 px on screen; nothing needs precision finer than ~24 px.
    c. Controls are declared through `stepUi` (no custom panels), most important control first.
    d. Camera shots declare what must stay in frame (subject bounds), so the director can re-frame for any
       aspect ratio; no shot may depend on a 16:9 window.
    e. Scenes honour the quality tier: particle counts through the tier budgets, kit `low`/detail options and
       optional set-dressing keyed to the tier, so a `mobile` tier can run them.
    f. No ad-hoc viewport or user-agent checks in chapters — only the engine's `device` state and HUD APIs.
    g. Mobile test profiles (phone portrait 390×844 and 360×800, phone landscape 844×390, tablet 820×1180 and
       1180×820, touch-only) join the standard QA once the mobile foundation (agent F5) lands; until then
       builders follow rules a–f and test on desktop sizes.

## Encyclopedia readiness (user decision, 2026-11-13 evening)

58. **The project is structured as a library of volumes («томи»); electricity is volume 1.** The user wants the
    option to grow the course into an interactive 3D encyclopedia (radio, microprocessors, geodesy and GNSS,
    cars, aircraft, the internet …) with the same depth. No second volume is being built now, but nothing in
    the architecture or the process may assume a single course:
    a. **Identity.** Every chapter belongs to a volume; the full id is `<volume>/<chapter>`, the step address is
       `<volume>/<chapter>/<step>`. Volume 1 is `electricity`. Routes are `#/<volume>/<chapter>/<step>`; the old
       two-part form redirects to `electricity`. Progress, settings scoped to content, glossary entries and
       cross-references use the full id.
    b. **Layout.** Shared platform code (engine, style, text, ui3d, hud, fx, kit, audio) is volume-agnostic.
       Volume-specific code and data live under one directory per volume: its manifest (title, accent, journey
       axis, order), chapters, simulations and generated content; its documents live under one directory
       per volume as well (curriculum, chapter scripts, exports, glossary, index). Tools take the volume as a
       parameter.
    c. **Navigation.** Above the per-volume «Мапа подорожі» sits a library level that lists volumes. While only
       one volume exists the library is skipped and the app opens that volume's map, exactly as today. The
       journey map takes its axis (for electricity: scale in metres), grouping and layout hints from the volume
       manifest, so another volume can use another axis (frequency, abstraction level, time).
    d. **Shared knowledge.** A chapter has one home volume; other volumes may link to it (cross-references
       already use full ids) and later list it as a guest node. Foundational chapters (`atom`, `matter`,
       `charge-field`) are expected to be shared.
    e. **Visual language.** The palette and the engine materials are global. The semantic colour code of
       STYLE_GUIDE §2.2 is the electricity volume's code plus a global core (interactive affordance, warning /
       ok / alarm, heat / cold); each new volume adds its own semantic table without redefining the core.
    f. **Process.** The production pipeline is per volume and repeatable: curriculum → chapter scripts → review
       → reconciliation → simulations → pilot chapters → chapter production → refinement → audits, with
       briefs parameterised by volume. `docs/VOLUMES.md` describes how to start a volume.
    g. **Naming.** «Від електрона до розетки» is the title of volume 1. The umbrella name of the library is a
       configuration value, to be chosen by the user when a second volume starts.

    **Implementation notes (agent M4-volumes; details in `docs/VOLUMES.md`, `docs/reports/M4-volumes.md`).**
    Paths named in earlier rulings moved with the volume: `docs/chapters/…` → `docs/volumes/electricity/chapters/…`,
    `docs/CURRICULUM.md` / `docs/GLOSSARY.md` → `docs/volumes/electricity/…`, `app/src/content/generated/<id>.json`
    → `app/src/volumes/electricity/content/generated/<id>.json`, `@/sim/<id>` → `@electricity/sim/<id>` (§53),
    `app/src/chapters/<id>` → `app/src/volumes/electricity/chapters/<id>`. Choices made while implementing:
    - volume 1: id `electricity`, title «Електроенергія», subtitle «Від електрона до розетки»
      (`app/src/volumes/electricity/volume.json`; `headline: "subtitle"` keeps the home screen and the splash
      as they were); the library title is `app/src/volumes/library.json → title` (null = that headline);
    - manifest fields `scaleLabel` / `scaleExp` became `axisLabel` / `axisValue` (the axis belongs to the volume);
    - the library level (library screen, volume name in the header, «Бібліотека» buttons, glossary scope
      switch) is shown only with more than one published volume — or inside a listed dev volume, so it can
      be tested; `?debug` alone does not change how volume 1 looks;
    - dev volumes: a directory name starting with `_` (`_demo`, `_dev`), status `dev`, registered only with
      `?debug`; a volume in the making uses status `draft`;
    - a short chapter id resolves in the current volume, then the default volume, then the others; a volume id
      must not equal a chapter id of the default volume;
    - simulations are per volume, `sim/core` included; a model needed by two volumes is promoted to the
      platform on request;
    - saved progress moved to the key `electricity:v2` (full chapter ids); the `v1` record is migrated once
      and left in place.

59. **The interface is ordinary 2D web UI (HTML/CSS), not WebGL.** User, 2026-11-13 ≈23:55, verbatim: «Зараз в
    проекті є багато 2D UI. Наприклад, я зараз на першому кроці в Мікросвіті. Блок справа з інформацією (котрий
    починається з "Усе складається з атомів"), блок зліва вгорі з назвою розділу і кроку, сервісні і меню кнопки
    справа вгорі, шкала масштабу, перемикач кроків - все це варто робити в 2D звичайними веб браузерними
    техніками, і щоб текст виділявся. Зроби цю зміну для усієї системи.» This withdraws PLAN §1/§4 "UI integrated
    into the 3D scene (panels, buttons, sliders, charts are WebGL objects)".
    a. **Scope:** every piece of interface that is not part of the 3D world — header, step panel and its
       sections, system buttons and menus, scale spine, step navigator, dock controls, boards (charts, tables,
       readouts), tooltips, toasts, hotspot cards, the journey map's panels and cards, home, library, glossary,
       settings, help, loading screen, touch shells (F5). The 3D world (scenes, the journey map's world of
       platforms) stays WebGL.
    b. **Text:** selectable and copyable («щоб текст виділявся»), crisp at any DPR and browser zoom, real DOM
       text (screen readers, find-in-page, translation tools).
    c. **Look:** keep the style guide (palette tokens, fonts, panels, motion); the change is the technique, not a
       redesign. Desktop layout as now; phones/tablets per §57 with CSS.
    d. **Chapters do not change:** the declarative chapter API (`stepUi`, `board`, `visible`, `ctl-<id>`, hotspots,
       links) and the QA hooks (`__ui.*`) keep their meaning, so existing chapters and their interaction tests
       keep working. Anything a chapter must change is listed by the design and done by the platform.
    e. **Open for the design (D0):** in-scene labels and callouts anchored to 3D objects (DOM overlay vs WebGL),
       world consoles that are part of a prop, migration order, feature flag, framework choice. Decided by the
       orchestrator from D0's proposal; questions of taste go to the user.
    f. **Process (user, same message):** «Пам'ятай про те, що ти - оркестратор, планувальник і аудитор. Для
       кожної задачі запускай субагента на opus-5-5 high effort.»
    **Design settled (orchestrator, 2026-11-14, from D0-hud-dom's proposal; design `docs/HUD_DOM.md`).**
    g. **Technique:** `@/hud-dom`, vanilla TypeScript + CSS, no UI framework; one fixed layer `#kd-hud` over the
       canvas with five sub-layers (world, chrome, popups, modal, tip); plates take pointers, the rest passes to
       the scene.
    h. **Units and tokens:** CSS lengths are px-equivalent units × `--u` (= `HudMetrics.pxPerUnit`); colours, type
       scale, radii and motion are CSS variables generated from `@/style` and `UI`; no hard-coded colours.
    i. **Fonts and icons:** the same families as WOFF2 subsets served from the app origin (OFL, `THIRD_PARTY.md`);
       icons from the same definitions as CSS masks.
    j. **In-scene text:** callouts, hotspot markers and cards, journey-map labels and 3D tooltips become DOM,
       projected per frame; `Text3D` and world consoles stay WebGL; `hudSurface` is replaced by a DOM `hudLayer`.
       On phones a world console steps aside when the dock already shows the same value, else it gets an optional
       declarative spec, else it stays in the scene.
    k. **Charts:** Canvas2D for marks, DOM for all text; the chart API for chapters is unchanged; the platform
       ports the six custom chapter widgets and the atom scale ruler.
    l. **Motion:** choreography on the engine clock (deterministic QA); CSS transitions only for micro-interactions,
       off under `?freeze` and reduced motion.
    m. **Migration:** hybrid flag `?hud=dom|gl` (default `gl` until cut-over); work packages D1–D9
       (`docs/HUD_DOM.md` §16); D1 starts after F5-mobile is in `main`; the WebGL HUD is deleted only after the
       user has reviewed the before/after sheets.
    n. **Reading level:** the DOM step panel carries the «Просто / Докладно» switch; copy comes only from L1's
       selector (`docs/briefs/L-simple-level.md`).
    o. **Open taste questions for the user** (until answered, today's look is kept): Q2 scan band and animated
       grain on panels → static faint grain?; Q3 no perspective tilt on panels, only slight sideways parallax?;
       Q6 behaviour at 200 % browser zoom (Q3 settled by p below); Q8 wording when a step has no simple layer; Q9 calmer glow on DOM
       panels vs pushing it toward the WebGL bloom.
    p. **No 3D effects on 2D interface (user, 2026-11-14 ≈00:45, verbatim):** «ти намагався повторити мікро рухи
       HUD/UI за курсором. не треба цього робити. усе що справжнє 2D - не треба намагатись додати до нього ефекту
       3D». So the interface has no pointer parallax or any cursor-following micro-movement, no perspective tilt,
       no fake depth; it moves only when it changes state (reveal, conceal, transitions). This settles Q3 (no tilt
       and no parallax) and applies to the current WebGL HUD as well (its pointer parallax is removed). 3D effects
       stay where things are really 3D: the scenes and the journey map's world.

60. **Product vision, the pilot mini-volume and the model rule (owner, 2026-11-16).** Verbatim, in order:
    a. **Reader and form:** «якщо робити з цього прям повноцінну інтерактивну енциклопедію, нам потрібна чітка і
       зрозуміла структура. сервіс має бути розрахований в першу чергу на дорослу людину, котра хоче дізнатись як
       працюють ті чи інші речі, як влаштований всесвіт і усе що нас оточує. тому матеріал має бути дуже
       поступовим, плавним і структурованим.»
    b. **A new volume, polished:** «давай побудуємо новий том і будемо його дуже ретельно полірувати.»
    c. **The mini-volume:** «а як тобі ідея міні-тому про електричний струм? базово шлях від атому і електрона до
       працюючого ланцюжка з батарейкою і лампочкою», then: «поки що давай зосередимось тільки на цьому міні томі.
       … приступай. поки що зроби щоб готовий матеріал по тому з електроенергії був доступний по окремій кнопці
       десь окремо, а основний фокус зараз на пілотному міні-томі з батарейкою і лампочкою, котрий ми відполіруємо
       і візьмемо за еталон».
    d. **Models (supersedes §59 f and every earlier model rule):** «для планування і генерації моделей і візуалу ти
       можеш використовувати fable 5.2 high effort. А для реалізації усього іншого opus 5.5 high. Мені дуже
       важлива якість матеріалу і картинки.»
    e. **Orchestrator's reading (not the owner's words):** the mini-volume has the id `circuit` and the working
       title «Електричний струм · Від атома до лампочки»; direct current only (no magnetism, alternating current
       or semiconductors on its path); it is the reference («еталон») for the structure standard
       `docs/VOLUME_STRUCTURE.md` (path, branches, practicums, reference; proposal in
       `docs/ideas/encyclopedia-structure.md`), which stays a draft until the owner has seen it applied. All work
       on the chapters of `electricity` and on the plan of `computing` is paused; the built `electricity` volume
       stays reachable through a separate, clearly secondary button. One chapter is polished to the reference
       level before the next is built.
    f. **Fit the mini-volume to its real task (owner, same day, verbatim):** «тільки ж адаптуй цей міні-том під
       реальну задачу. я гадаю, що для пояснення базових принципів саме на прикладі батарейки і лампочки нам не
       потрібна деталізація про кварки і піони. чи потрібна?» Orchestrator's answer: not needed. **Necessity
       test** for the path of any volume: a step, term or scene is on the path only if the volume's finale cannot
       be explained without it; the rest goes to branches, «Докладніше» or other volumes. For `circuit`: nothing
       below the nucleus; no material is carried over from the built chapters merely because it exists.
    g. **Owner's answers to the plan questions 1–2 (2026-11-16, verbatim):** «1. Назва неважлива, але так, лишай поки
       таку. 2. Нехай ліхтариком ми почнемо, але його можемо анімовано розкласти на стенд.» So the working title
       «Електричний струм · Від атома до лампочки» stays for now; the volume opens with the flashlight, which is
       taken apart in an animation into a **stand** — a tidy demonstration layout of battery, lamp, switch and
       wires (orchestrator's reading: the stand replaces «деталі лягають на стіл» of `prologue/open`;
       `VISUAL.md` and the chapter scripts are to be written to this). Question 3 (incandescent lamp as the hero)
       was met with a question about whether such flashlights existed; questions 4–8 are open.
    h. **Stand on hold (owner, same day, verbatim):** «поки не перероблюй це під стенд. я спочатку хочу подивитись
       що вже є». Nothing in the plan (`PATH.md`, `VISUAL.md`) is changed toward the stand until the owner has
       looked at what exists and says how to proceed.
    i. **Stand confirmed (owner, same day, verbatim; cancels h):** «Все ж таки відміни мою відміну і зроби так, як
       було запропоновано: корпус розсувається, а батарейка, лампочка, вимикач і дроти стають охайним
       демонстраційним стендом, на якому далі йде весь том». The plan documents are revised to this by
       `V7-circuit-plan` (resumed).
    j. **One battery (owner, same day, verbatim):** «про дві батарейки не потрібно. просто примітивний ланцюг із
       однієї батарейки, вимикачем і лампочкою». The circuit of the volume always has exactly one battery, one
       switch and one lamp; the practicum task with two and three cells is removed and `resistance/balance` is
       reworked without a second battery (`V7-circuit-plan`).
    k. **Extensions (owner, same day, verbatim):** «а як тобі ідея зробити просто розширення до тому, такий собі
       додатковий матеріал, де ми і батарейок додамо (і розкажемо усі супутні нюванси), і лампочку на світлодіод
       замінимо?» and «ми можемо розказувати про напругу не через зміну дроту, а так як ти і хотів, але це вже
       буде як розширення». So the path keeps one battery and shows only what it can show; the two-battery
       demonstration of voltage and current opens the extension «Більше батарейок»; «Світлодіод замість лампочки»
       is a second extension. Extensions are parked in `PATH-NOTES.md`, not designed until the path is polished
       (orchestrator's reading of the order).
    l. **The whole battery cycle on the path (owner, same day, verbatim):** «так, давай проходити обов'язково увесь
       цикл. в першому міні-томі (без доповнення) має бути і сценарій із розрядженою батарейкою і усіма
       супутніми нювнсами». The path follows the battery from fresh to dead with one battery, one switch and one
       lamp; the discharged battery and its nuances are part of the path, not an extension (`V7-circuit-plan`).
    m. **Extensions postponed; execution starts (owner, same day, verbatim; narrows k):** «поки що забуваємо про
       розширення з кількома батарейками і світлодіодом і концентруємось лише на основі міні-тому. приступай до
       виконання». Orchestrator's reading: production of the base path starts after the plan revision; the plan
       questions the owner left unanswered (4–8) are taken with the planner's recommendations until the owner says
       otherwise — the reader is addressed as «ти»; the reference is the prologue plus chapter 1; `lamp/handover`
       stays on the path; `circuit` is the shared foundation of the library.
    n. **Address (owner, same day, verbatim):** «до читача на ви». The reader is addressed as «ви» (lower case)
       in every text of the volume and of the interface; this replaces the «ти» of the orchestrator's reading in m.
    o. **Public repository on hold (owner, same day, verbatim):** «поки нічого не пуш в репо tech, нехай усе буде в
       electricity». No pushes to the public mirror until the owner says otherwise; everything goes to the private
       repository only (ORCHESTRATOR §7 rule 8a).
    p. **First live review of the prologue (owner, 2026-11-16 ≈16:05, verbatim):** «Зроби сцену без світла трошечки
       світлішою, бо зараз дуже темно. перехід з 2 на 3 крок в пролозі дуже різкий, треба значно плавніше. прибери
       слайдер "Розкласти" з кроку 2. по суті, прибери крок 2. А на кроці 1 спочатку тримай прихованою панель із
       перемиканням кроків. А коли користувач натичне на вимикач і світло увімкнеться, тоді ця панель має плавно
       з'явитись. На поточному кроці 3 слайдер має бути плавним, тобто щоб замість програвання анімації на кожному
       з 3 кроків слайдера у нас "кадр" анімації відповідав положенню слайдера. але і якщо ми просто клікаємо на
       слайдер в якомусь місці, то анімація все ще має бути плавною до того місця. ключова ідея - що ми можемо
       посунути слайдер в будь-яку позицію і стан стенду буде заанімований/програний відповідно до положення
       слайдеру.» Orchestrator's reading: (1) the unlit scenes get slightly more ambient light; (2) the step `open`
       and its slider are removed — the flashlight unfolds into the stand by itself as one smooth transition from
       `click` to the next step; (3) on `click` the step navigator is hidden until the reader has switched the
       light on, then fades in; (4) the depth control of `dive` is a continuous slider: its position is the frame
       of the dive (scrubbing), and a click anywhere travels there smoothly; the same rule for every slider that
       drives an animation in the volume. The owner also asked for the orchestrator's opinion of the snail scene
       (given in the conversation; no change to it without the owner's word).
    q. **No questions to the reader (owner, 2026-11-16, verbatim):** «ніяких питань і квізів в звичайних режимах.
       користувач має лише керувати і спостерігати, а не відповідати на питання. тому твоя ідея з «Хто швидший:
       равлик чи іскорка?» - ні! Решту обговорень про равлика трохи згодом». Rule for every volume in the path
       format: in ordinary modes the reader controls and observes; no multiple-choice questions, no «guess first»,
       no quizzes. Applied at once: `VOLUME_STRUCTURE.md` §1; the practicum step `build/short` loses its «вгадати …
       вибрати відповідь із трьох» (orchestrator's reading: the practicum is an ordinary mode). The rest of the
       snail scene is to be discussed later; no change to it until then.
    r. **The snail scene (owner, 2026-11-16 ≈16:45, verbatim):** first «а якщо ми взагалі приберемо равлика? які ще є
       ідеї? це ж ти показуєш дрейф електронів?», then, after the orchestrator's options: «а як тобі ідея якщо у нас
       буде слайдер і його кінець це равлик вже дійшов кінця? тобто концептуально те що і було, тільки тепер
       користувач керує часом слайдером + так, щоб равлик повз уздовж дроту. що скажеш?» **This is an idea under discussion, NOT a decision** — the owner, minutes later: «ідея з позунком часу була
       на обговорення з тобою!». The orchestrator had wrongly dispatched it as a task and stopped the agents
       (C-circuit-1, W1-circuit-stage; their work is parked on their branches and must not be merged).
       The orchestrator's first reading of the idea, kept for the discussion only: `prologue/riddle` has one slider of time that scrubs the scene (§60 p
       rule); the snail crawls along the wire itself and the end of the slider is the snail reaching the end of
       that wire; on the same wire a glowing dot shows where one marked spark has got to (a few millimetres);
       the lamp shines throughout. No «Пустити» button, no separate ruler track, no pin, no lens, no clock, no
       «прискорено ×N» chip — the slider is the clock. Direction and length follow the real stand (electrons go
       from the battery's minus toward the lamp). `flow/snail` in chapter 4 is re-planned to the same device.
    s. **The time-slider idea, the owner's answers in the discussion (2026-11-16 ≈17:00, verbatim):** «1. Так, світло за
       рухом слайдера одразу вмикається. 2. покажи просто лупу на початку дроту і невелику шкалу в пару сантиметрів.
       от там і показуй дрейф. 3. хай метушиться. 4. повзунок тільки для равлика. але в кінці повзунка іскорка має
       все ж таки опинитись у крайньому положенні шкали (зроби її може не 2 см, а ту дистанцію, скільки воно реально
       пройде за цей час). 5. Так, рух електронів показуй в справжньому напрямку. покажи превью, якісь рендери, щоб я
       запевнився, що ти розумієш цю ідею». **Still not a decision to build the step:** the owner asked for a
       preview first. Orchestrator's reading for the preview: one slider of time; at 0 the lamp is off and it is
       on as soon as the slider leaves 0; the snail crawls along the wire in the electrons' true direction and
       the end of the slider is the snail at the end of the wire; the magnifier lies on the start of that wire
       with a short scale whose length is exactly what the spark really covers in that time (≈ 4.4 % of the
       snail's run); in the lens the sparks dart about, and the marked spark's drift carries it to the far end of
       the scale exactly at the end of the slider. A preview is built on a dev page only; the chapter stays as it is.
    t. **The time-slider snail scene is approved (owner, 2026-11-16 ≈20:25, verbatim):** «Мені подобається превʼю з
       равликом. Роби». The owner named no variant and did not answer the orchestrator's four questions, so the
       orchestrator's reading, open to correction: **variant B** of the preview `_dev/_sandbox-circuit-crawl`
       (the lens is a plain magnifier ≈ 3.5× over the wire's first centimetre with the 0 … 6 мм scale inside it)
       with the preview's values — one slider «Час» 0 … 2 хв 16 с, lamp on as soon as the slider leaves 0, the
       snail on its 13.64 cm lane beside the wire from the battery's minus toward the lamp, centimetre ticks and
       trail as shown. Consequences: `prologue/riddle` is rewritten and rebuilt on it (no «Пустити», no race
       track, no ×N clock, no question to the reader — §60 q); `flow/snail` in chapter 4 is re-planned to the
       same device; variant A and the old race tools leave the stage library once nothing mounts them.
    u. **Everyday units in `circuit` (orchestrator's reading, 2026-11-16, to be confirmed by the owner):** the
       approved preview prints «5 см», «6 мм», «2 хв 16 с». In this volume, lengths and times of everyday scale are
       written with Ukrainian unit signs (мм, см, м, с, хв, год) in captions and spelled out in running text;
       electrical units stay international as §54 f says (V, A, Ω, W). Volume 1 is not changed.
