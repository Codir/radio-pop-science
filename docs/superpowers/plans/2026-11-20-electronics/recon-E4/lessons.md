# Recon E4 — what batch E3 taught (rules for the E4 plan)

Scope: every E3 finding that forced a fix round, classified, with the rule that would have prevented it, phrased as a
checklist line. Targets: the E4 chapters `divider`, `capacitor`, `capacitor-kinds`, `filter` (PATH.md:399-698).

Sources. Task reports `.superpowers/sdd/2026-11-20-electronics/task-E3-{0..8}-report.md`. Workflow journals, cited by
JSON line (1-based) of `~/.claude/projects/-home-pilot-tmp-radio-science-pop/6f49b650-2d89-4787-a334-6133ca3f9efa/subagents/workflows/`:
- **J1** = `wf_d1bfc74f-0ce/journal.jsonl`: scripts E3-0…E3-4.
- **J2** = `wf_ba84dbd2-120/journal.jsonl`: chapters E3-6 `resistor`, E3-7 `resistor-pick`.
- **J3** = `wf_b6d2fb4f-757/journal.jsonl`: chapter E3-8 `meter`. Fix round 1 was still running, so its diff in
  `/home/pilot/tmp/rsp-e2` is uncommitted.

E3-5 ran in the clone's workflow, which is not among these journals; it is taken from its report. E3-9 has not started.
Code refs are main-tree paths, except `rsp-e2@7ad47b1:…`, which is the clone at E3-8's head.

Roles in the rules: **S** script writer · **B** chapter builder · **Q** chapter QA script · **P** plan/controller.

## 1. Ledger

| Task | Fix rounds | Reviewer crit/imp/spec | Reader crit/imp | New breakage from a fix | Reviewer verdict |
|---|---|---|---|---|---|
| E3-0 register | 0 | 0/0/0 (J1:5) | none run | – | Approved |
| E3-1 prologue script | **3** | 0/2/1 (J1:10) | 0/4 (J1:11) | #1, #2 (J1:15, J1:19) | Needs fixes |
| E3-2 meter script | 2 | 0/4/0 (J1:28) | **2**/5 (J1:29) | #1 (J1:33) | Needs fixes |
| E3-3 resistor script | 1 | 0/0/0 (J1:42) | 0/4 (J1:43) | – | **Approved** |
| E3-4 resistor-pick script | 2 | 0/0/0 (J1:52) | 0/4 (J1:53) | #1 (J1:57) | **Approved** |
| E3-5 bench pilot (clone) | 1 | 2 spec (task-E3-5-report.md:150-210) | – | – | – |
| E3-6 resistor chapter | **3** | 0/3/2 (J2:6) | 0/6 (J2:7) | #2 (J2:15); #1 left one finding open (J2:11) | Needs fixes |
| E3-7 resistor-pick chapter | 1 | 0/1/1 (J2:27) | 0/2 (J2:24) | – | Needs fixes |
| E3-8 meter chapter | ≥ 1, open | 0/0/0 (J3:6) | 0/4 (J3:7) | – | **Approved** |

- The three journals hold 12 completed fix rounds. **5 of the 12 introduced a new defect**, each time in content the
  fix itself added.
- About 45 unique findings needed a fix, after merging reviewer and reader duplicates. Counts per class follow.

## 2. Classes

### 2.1 Script physics and numbers — 11 (the largest class)

The findings were E3-1 ×4, E3-2 ×4, E3-3 ×1, E3-4 ×1 and E3-6 ×1.

Examples:
- **A fixture number under the wrong condition.** The script said «ручка на 0,1: тиша — вимкнений підсилювач
  пропускає до динаміка 45 μV». 45 μV is the full-knob fixture; the model gives 4,14 μV at 0,1 (J1:10, J1:11).
- **One run stated as a law** (E3-1, round 3). «смужка сходить до 0,00 V за 2–4 s» came from one switch-opening after
  1 s of play. The reviewer's sweep gave 0,95…5,95 s, and a non-monotonic relight up to 0,23 V (J1:19). The claim
  converged only after a sweep of 32–64 opening moments per knob step, with a check bound «не раніше як за 7 s»
  (J1:21, J1:23).
- **A new readout with no transient described.** The gauge «Хвиля на динаміку», added in fix round 1, flashes 3,51 V
  for ≈ 0,6 s at switch-on (C2 charging through 8 Ω). A check expecting 0,19…0,30 V would fail (J1:15).
- **A model artifact taught as physics.** «лінія до нуля не впаде … бо деталі підсилювача живляться із власного
  запасу заряду». That happens only with an ideal probe; a 1 MΩ input reads 0,014 V. The reader rated it critical
  (J1:29).
- **Wrong direction.** «Найнижчий бас … відстає»: a high-pass makes it lead, +46° at 41 Hz (J1:28, J1:29).
- **A predicate with no margin.** The wave goal was −0,28…+0,29 V against the model's −0,2791…+0,2890 V, and the
  model gives 0,293 V at 48 kHz (J1:28, J1:29).
- **A goal that the reader's history can make unreachable.** «До замикання слід — 0,00 V»: after any reopen, the
  ideal-probe rail sits at 8,30 → 1,47 V (J1:28).
- **Real-world claims extrapolated from the model:**
  - «Справжні рухаються значно повільніше»: drift in a carbon film is metres per second (J1:43).
  - «0,24 W … теплий і живе» at 0,97 of the rating (J1:53).
  - «Індекс — LED, як у паспортах» is false (J1:53, minor).
- **Arithmetic from the printed numbers.** «6,59 V / 2,2 kΩ ≈ 2,99 mA», which is really 2,995 (J2:6).

Rules:
- [ ] S: Every number in «Ціль», «Бачимо», «Висновок» and «Докладніше» names its condition: the knob, the switch
  history, `start('dc')` or `start('zero')`, tone or melody, and the instruments attached. A fixture number is used
  only under its fixture's condition.
- [ ] S: Sweep every number that depends on time after an event (switch, part out or in, knob, scale change). Sweep
  over the event's moment (the melody position) and the history before it. Give the range and a QA settling bound with
  margin. One run is never a range.
- [ ] S: For every readout, gauge or trace the script adds, describe its value at each event the step allows
  (closing, reopening, part out, part back), not only at steady state.
- [ ] S: «Ціль» holds the predicate only; model numbers go in a separate «Модель:» sentence. Bounds keep about 10×
  margin over the model's spread across sample rates and melody start. E3-2 settled on ±0,35 V and a crest ≥ 0,2 V
  against the model's 0,29 V and 0,244 V (J1:33). The predicate must hold for any order and history the reader can
  produce, and the script says what happens if the reader acts «too early».
- [ ] S: A stand idealisation (ideal probe, DC-only meter, compressed time, equal legs) is labelled as the stand's and
  never explained as physics. If it draws a false picture, ask for the bench change (§2.11) instead of explaining it.
- [ ] S: Every word of direction (випереджає/відстає, швидше/повільніше, росте/падає) has its formula or probe in the
  fact note.
- [ ] S: Every claim about real parts that is not a model number carries a source or «перевірити», and goes to the
  physics reader. Never transfer a model number to a real part.
- [ ] S: Recompute every division or product shown on screen from the rounded numbers as printed.
- [ ] S: Every probe behind `PATH-ledger.md` «Числа моделі» can be rerun from the ledger preamble: the netlist call,
  fs, start mode and duration (J1:10 spec issue, fixed in J1:15).
- [ ] S (E4): Derive every scope-visible number with the scope's 1 MΩ input on the probed node (`SCOPE_INPUT`, an
  E3-8 shared addition). The sandbox's RC check moved from 63,2 % to 62,95 % expected and 62,842 % measured at 1 s
  (task-E3-8-report.md:155-157). So PATH `capacitor/time` «63,10 %» and `capacitor/slow` «5,68 V через 1 s»
  (PATH.md:508, :517-518) must be re-probed with the probe attached.
- [ ] S (E4): Give numbers for the source the bench actually plays. `divider/volume` quotes «Тон 1 kHz» (PATH.md:444),
  but the bench plays the melody. E3-1 had to move `stand` from tone to melody numbers (J1:13, deviation 1).

### 2.2 Pedagogy — 7

The findings were E3-1 ×3, E3-2 ×2 (one of them new breakage), E3-4 ×1 and E3-6 ×1 (a cross-chapter collision filed
twice).

Examples:
- **The goal does not force what the takeaway claims.** In `stand` the goal was «any one part out ≥ 1,5 s», but the
  takeaway says «без декотрих грає далі: без лампочки „увімкнено“ лише гасне світло». 10 of the 14 parts the hand can
  take silence the amplifier, so most readers never see the second half (J1:11).
- **The text and the goal disagree.** The text says «Торкніться трьох зупинок», but the goal excluded the practicums
  (J1:10, J1:11).
- **Nothing visible changes.** In `quiet` the result was sound only; with sound off, the reader sees nothing (J1:11).
  The fix was a model-fed gauge plus a sound-off line (J1:15).
- **A formula before its quantity is seen.** `power` introduced P = U × I while U on the 1 kΩ was only asserted
  (J1:53). The reviewer had this as minor (J1:52).
- **A claim invisible at the display scale.** In `twice`, «у шістнадцять разів вища» with the input at 0,24 of a
  division (J1:29).
- **A hint path that reaches the goal where the lesson cannot be seen.** Hint 2 led to full knob and then
  0,02 V/div. Both traces clipped, and the goal still completed (J1:33).
- **A cross-chapter collision from a builder's deviation.** `resistor/amp` moved to R1 2,2 kΩ, which is the
  measurement and the conclusion of `resistor-pick/on` (J2:6). It took two rounds (§2.12).

Rules:
- [ ] S: For each clause of «Висновок», name the «Ціль» condition that makes the reader see it. No clause goes in
  without one.
- [ ] S: «Текст», «Дія», hints and «Ціль» accept the same set of actions. Whatever the text invites counts toward the
  goal.
- [ ] S: Every step shows a visible change driven by the model. A result that is only sound gets a visible readout and
  a line for when sound is off, waiting or muted.
- [ ] S: A formula appears only after the reader has seen each of its quantities on screen, in this step or in a step
  that «Згадайте» links to.
- [ ] S: A ratio or shape that the takeaway states must be readable at the step's display scale. Otherwise give
  readouts, or a scale control plus a goal condition that keeps both traces on screen. E3-2 settled on «ручка
  0,25…0,5» at 0,02 V/div (J1:35).
- [ ] S: Replay the hints in order against the predicate. Following them must end in a state where the takeaway is
  visible, not only one where the goal fires.
- [ ] P/B: Grep any deviation that changes a step's part, value or measurement against PATH.md: the part id, the
  value, and the «Нитка» of later chapters. The controller decides a collision before the next row starts (§2.12).

### 2.3 Language — 4, plus recurring minors

The findings were E3-2 ×2, E3-4 ×1 and E3-6 ×1.
- The axis captions were missing from «Підписи», and «U» appeared on screen before `resistor/law` (J1:29).
- «13,31 mA, тобто міліампера» has no number after «тобто» (J1:29).
- «резистори виготовляють рядом номіналів»: «рядом» is a Russianism here (J1:53).
- `limit` says «коротку перемичку, що вела до нього від шини «+», прибрано», but the picture still shows that jumper
  (J2:7). The script reviewer had flagged it as minor in E3-3 (J1:42), and it shipped anyway.

Recurring minors, each in at least two tasks:
- A part named by a colour that many share: «фіолетова перемичка» among about ten violet jumpers, which render blue in
  the room light (J2:7, J2:24; J3:7 measures J10 at hue 244°).
- «лампочка «увімкнено»» next to the bench's real lamp (J1:10, J3:7).
- «ручка» and «повзунок» for the same control (J1:11).
- Place words with no phone variant: «Осцилограф — праворуч позаду» (J1:29, J3:7).
- The tray called «порожній» in one step and «немає» in another (J1:10, J1:11, J1:53).

Rules:
- [ ] S: Scope steps list axis and scale captions in words in «Підписи» («напруга, V», «час, ms», «на поділку»). No
  quantity letter appears on screen before its step.
- [ ] S: The sentence that introduces a term reads naturally aloud, and the bold span is an idiomatic phrase.
- [ ] S: Name a part by its position or role, never by a colour another part on the board shares. Use one word for a
  control everywhere.
- [ ] S: Any text that names a place on the stand has a phone variant. On a phone the shot shows the board, and the
  instruments live in tabs.
- [ ] B: When the build changes which part or jumper is involved, re-read «Текст» and the hints against the picture.

### 2.4 Camera and framing — 3 (two from review, one from the builder's own QA)

- E3-6 round 2. The C3 can (470 μF at e2) covered J8 and R5's a2 leg in the `meter` shot, and 3 of 122 interaction
  checks failed. The builder added an own desk shot `amp` (J2:13). That shot had no `fit`, so on tablets the
  multimeter left the frame (J2:15).
- E3-8. In `meter` the C3 can hides J10 and all of row 1ae, where the black probe must go (J3:7).

Code:
- On phones and tablets, a shot without `fit` is cropped up to ×1,5 around its target
  (app/src/engine/camera/director.ts:91-100).
- The fix gave the shot a `fit` (app/src/volumes/electronics/chapters/resistor/steps/07-amp.ts:52-56).

Rules:
- [ ] S: For each step, «Бачимо» names what must be visible (the targets and the instrument), and builders test that
  list.
- [ ] B: Every target within about 3 sockets of the C3 can (e2) or the C2 can gets an own shot. Check it with
  `__app.locate(name).visible` (pattern: chapters/resistor/qa/interactions.mjs:98-103). E4 steps on the amplifier:
  `capacitor/reservoir`, `capacitor-kinds/amp`, `filter/coupling`, `filter/highs`.
- [ ] B: Every own Shot has a `fit` that holds the instrument, its probes at rest and the targets.
- [ ] P/Q: The gate includes `mobile-check --profiles tp,tl --only steps`. Plan decision 10 ran only `pp`
  (batch-E3.md:34-35), so the tablet regression was found only by a reviewer's own screenshots (J2:15).

### 2.5 Phone and touch — 6

The findings were E3-3 ×1, E3-4 ×2 (one of them new breakage), E3-6 ×1 and E3-8 ×2.
- **Touch target.** The band zone was about 22–25 px against 44 px (J1:53; 25 px measured,
  task-E3-7-report.md:142-143).
- **Control semantics** (a fix's own breakage). The dock `segmented` added for phones cannot start empty and ignores
  a tap on its current item, so the first band could not be chosen (J1:57). In code: the default is the first item
  (app/src/ui3d/widgets/tabs.ts:109; app/src/hud/step-ui.ts:107), and a tap on the current item returns early
  (tabs.ts:136; app/src/hud-dom/dock/controls/inputs.ts:77).
- **A missing dock word.** The phone tray button for `led-red` had no caption (J1:43).
- **Hover stuck after a touch.**
  - Symptom: the burnt LED's dark dome was washed cyan (J2:7).
  - Cause: the engine keeps the hover after touch-up (app/src/engine/input.ts:347, :654).
  - Fix: the hand never glows a part on touch (app/src/volumes/electronics/shared/hand/hands.ts:1270-1279).
- **Below the fold.**
  - The crest values of `twice` sat under the bottom navigation, with the waves in another tab (J3:7).
  - The band and tray buttons of `resistor-pick` were below the fold (task-E3-7-report.md:166-169).
- **Leg grips on a phone strand a jumper** (also §2.9 and §2.10) (J3:7).

Rules:
- [ ] B: Everything the goal needs a finger on is ≥ 44 px on 390×844, or has a dock button.
- [ ] B: An action that happens now is a `button`, which fires on every press. `segmented` is only for a persistent
  mode with a meaningful default.
- [ ] S: Every phone dock button (tray slot, band, control) has its word in «Підписи».
- [ ] B: The controls the goal needs, and the readouts the text compares, show at the default sheet height on 390×844
  (readouts first), or the text says where to look.
- [ ] B: No new shared visual reacts to hover on touch.

### 2.6 Frozen-shot content — 1, plus 3 minors

The finding:
- QA runs with `?freeze`, so every scope shot is the held window
  (rsp-e2@7ad47b1:app/src/volumes/electronics/shared/bench/index.ts:579).
- Its warm-up is `STILL.warmup` = max(0,2 s, 5 τ), rounded to 0,5 s
  (rsp-e2@7ad47b1:app/src/volumes/electronics/shared/model/driver.ts:180-193).
- For the amplifier the window therefore starts on beat 2 of bar 0, which is the bass's rest. No shot showed the
  «повільні широкі хвилі баса» that the step promises (J3:7).
- The running fix rounds the warm-up to a half bar, 1 s (uncommitted diff in rsp-e2).

The minors:
- A goal shot was taken after the goal state was undone (`calc`, J2:24).
- The hover tag «Чорний щуп» was left in a shot (J2:24).
- The contact sheets were older than the goal shots they collect (J2:7).

E4 consequence, from the code:
- The held window starts from the DC operating point (`t.start('dc')`,
  rsp-e2@7ad47b1:…/shared/model/driver.ts:423-436) and is capped at 2 s (`max: 2`, :189).
- So a frozen frame can never show a charge or discharge curve, the `filter/block` spike, the reservoir sag after C3
  comes out, or any switch event. It shows the settled state.

Rules:
- [ ] Q: For each step, state what the frozen shot must contain (a bass wave, a hat burst, a curve). Check it from
  the samples (for example the rms below 150 Hz) before trusting the picture.
- [ ] Q: Capture event-driven pictures (RC charge, spike, sag) live at a stated time after the event, or assert them
  from reader numbers. Never rely on a `?freeze` shot for them.
- [ ] Q: Snap goal shots at the goal state with the pointer moved off, then rebuild the sheets from that same run.

### 2.7 Callout anchors — 5

The findings were E3-6 ×3 and E3-7 ×2:
- The «вугільна плівка» dot sat on the end cap at 330 Ω, because the anchor fell outside the open film (J2:7).
- «керамічний стрижень» and «канавка» printed over each other at 10 kΩ on a phone. chapter-check's layout check
  looks only at deep-link entry, where the floor is `stand` (J2:7).
- On a phone the `share` callouts covered the d/e sockets of the probe rows (J2:7).
- In `on` the LED's dot landed on R1: the anchor was the hit box's top + 0,05, and the shot is oblique (J2:24).
- On a phone the LED tag covered R1 (J2:24).

Fix patterns in code:
- Anchor on the visible body: `onBody` (chapters/resistor-pick/steps/06-on.ts:54-69).
- Side chosen per device by a getter (06-on.ts:79-81).
- Tags hidden while a probe is held (chapters/resistor/steps/06-share.ts:67-68).
- Inside anchors clamped to the open span, with tests (shared/inside/film.ts:188-204).
- QA check that each dot's first hit is its own part (06-on.ts:116;
  chapters/resistor-pick/qa/interactions.mjs:547-550).

Rules:
- [ ] B: The anchor is a point on the part's body facing the camera (`onBody`), never a point above the part.
- [ ] B: On cutaways and inside views, compute anchors for every variant the step can show (each value and size),
  keep them inside the exposed geometry, and unit-test each variant. E4: plates and insulator in
  `capacitor/inside`, the cut roll in `capacitor-kinds/film`.
- [ ] B: Choose sides per form factor. A tag never sits over sockets the step asks the finger for, and tags step
  aside while a probe is held.
- [ ] Q: Assert that each dot hits its own part (raycast) and that no tags overlap. Do this after every state change
  inside the step (value swap, dive), not only at deep-link entry.

### 2.8 Duplicated code across chapters — 1, plus 2 minors

The finding:
- `resistor-pick` copied `parts/{goals,policy,names,dock,meter}.ts` and `stand.ts` word for word from `resistor`:
  about 300 lines, and the goals copy had no tests (J2:27).
- The implementer cited «task context prefers chapter-local code», against recipe §1.E
  (task-E3-7-report.md:150-152).
- The fix is `shared/steps` (app/src/volumes/electronics/shared/steps/index.ts:7-13).

The minors:
- The boards.test helpers were copied from the shared tests (J2:6).
- The clone's `meter` is a third copy (rsp-e2@7ad47b1:app/src/volumes/electronics/chapters/meter/parts/goals.ts:1-6;
  J3:6).

Rules:
- [ ] B: Import `@electronics/shared/steps`: the goals maths and tally, hand policy, names, dock buttons, meter dock,
  depth slider and `createStepStand`. Only `HOLD` and the step boards stay in the chapter.
- [ ] B: Anything a second chapter needs from a first moves to `shared/<module>/` with its tests and a REUSE.md row,
  in the same commit.
- [ ] P: A brief's notes never contradict the recipe. If a parallel stream freezes shared files, the brief names
  which ones.
- [ ] P: Before the E4 chapters, merge the clone and switch `meter` to `shared/steps`.

### 2.9 Hand policy — 3, plus 1 shared with §2.5 and §2.10

- **The «A» mode burns amplifier parts.**
  - Problem: probes on `supply` and «−» burn D1 in 1,07 s (5,23 A); probes across R1 burn LED1 in 0,08 s. The hand
    cannot replace amplifier parts, so the step is stuck (J1:43).
  - Fix: the dock button «Нові деталі», shown only while something is burnt or bulged
    (chapters/resistor/steps/07-amp.ts:98-114, :156). E3-8 reused it (task-E3-8-report.md:160-161).
- **A dead end.**
  - Problem: `ohm` let the hand take R1 while the tray was empty. `toTray` removes a part that has no slot, and on a
    phone always (shared/hand/hands.ts:559-567). The goal could no longer be reached (J2:6).
  - Fix: the step re-seats R1 in `late` (chapters/resistor/steps/03-ohm.ts:103-110).
- **Grips on parts the policy forbids** (J2:7). Fixed: grips show only where `live(key)`
  (shared/hand/hands.ts:1266, :1293).
- **Leg policy on a phone.** J10's legs could be taken. An end dropped off the board leaves J10 stretched across the
  board, and the goal counts the gap as open
  (rsp-e2@7ad47b1:app/src/volumes/electronics/chapters/meter/steps/02-amps.ts:98; J3:7).
- **A hazard known in advance.** Removing D2 or D3 burns Q2 in 0,8 s (progress.md:53; J1:7).

Rules:
- [ ] S: For each step, list what the hand may take (whole parts, legs, probes, meter modes). From a sweep, give the
  model's outcome for every misuse the reader can reach: each takeable part out, the meter on «A» across every row
  pair, swapped parts. E3-3 ran 91 pairs × jumper in/out, 30 s each (J1:45).
- [ ] S/B: If any burn or bulge is reachable, the step gets «Нові деталі», with its caption in «Підписи» and a QA
  check.
- [ ] B: The step re-seats (or gives a tray slot to) any takeable part the tray has no slot for. It never lets the
  part vanish.
- [ ] B: On a phone, jumpers are taken whole. A leg released off the board never satisfies a goal: the goal reads the
  part's absence from both `parts` and `pending`.
- [ ] S: Locked parts (D2, D3) give visible feedback, not silence (J1:10, minor).

E4 hotspots:
- `capacitor/reservoir`: C3 comes out of a playing amplifier.
- `filter/coupling`: a jumper in place of C2 burns Q2 «за кілька секунд» (PATH.md:656-658).
- `filter/highs`: C2 is swapped.
- `capacitor-kinds/rated`, `capacitor-kinds/reverse`: the bulge is the lesson, so the recovery and re-entry must
  restore the part.
- `capacitor-kinds/amp`: if the meter offers «A», the E3-3 hazards apply.

### 2.10 QA script gaps (checks that passed while the picture was wrong) — 2, plus 1 shared, plus enablers

- **An on-screen claim with no check.**
  - Problem: `ohm` «Докладніше» said the meter shows «—» on a live resistor. The landed driver read «330,0 Ω», and
    no check would have caught it (J1:43).
  - Fix: a QA check plus a shared rule (shared/model/driver.ts:337-350 `powered`;
    shared/instruments/meter-model.ts:79).
- **Recall links.**
  - Problem: only 3 of the chapter's «Згадайте» links were followed, and none across chapters (J2:6).
  - Fix: `recalls()` follows every step's list (chapters/resistor/qa/interactions.mjs:263).
- **A touch goal check that passed on a broken board.** `!open.gapClosed` passed while J10 lay stretched across the
  board (rsp-e2@7ad47b1:app/src/volumes/electronics/chapters/meter/qa/interactions.mjs:343-346; J3:7).
- **Content in a scrolling sheet.** mobile-check reported «offscreen 0» for readouts under the nav bar, because the
  sheet scrolls (J3:7).
- **Layout checked only at entry.** chapter-check's layout check runs only at deep-link entry, so it missed the
  10 kΩ callout overprint (J2:7).
- **No tablet run.** The chapter QA treats `--touch` as a phone (tray in the dock), so it cannot run on tablets
  (J2:17, J2:19).
- **Checks that read the DOM for WebGL content.**
  - WebGL callouts are not in the DOM, so DOM text checks found nothing; checks must read the step's exposed readers.
  - A wrong phone sheet tab was a silent no-op (task-E3-8-report.md:140-142).
- **Document tools.**
  - `path_check` leaves «Докладніше» out of its term-order check (tools/content/path_check.py:64-73).
  - It does not check unit signs such as Ω before «ом» (J1:3).

Rules:
- [ ] Q: Every on-screen statement about what the stand does («показує «—»», «згасає», «здувається») has a check.
- [ ] Q: Follow every recall link in the generated JSON. A link into an unbuilt chapter must stay inert with no
  console error.
- [ ] Q: Goal checks assert the board as data (where each relevant part is: `parts`, `pending`, legs) as well as the
  electrical outcome.
- [ ] Q: Add three visibility checks: every target the text names (`locate().visible`); each callout's dot on its own
  part; and, on the phone, every goal control and readout in the first viewport without scrolling.
- [ ] Q: Run the interactions at 390×844, plus a tablet branch with the tray on the table.
- [ ] S: Hand-check «Докладніше» against the register and the unit signs before committing (a tool gap).

### 2.11 Bench bugs and gaps — 2 from review, plus 7 found while building chapters

- **E3-5: `AMPLIFIER_PRESET` not delivered.**
  - The E2-M layout had 12 body overlaps, and `spk-` cannot reach the − rail.
  - A beam search with the real hit boxes found a layout with 10 jumpers.
  - Sources: task-E3-5-report.md:110-145, :155-190. The draw-call budget had been read too narrowly (:192-210).
- **Script layouts the board cannot hold.**
  - E3-3's gap jumper for R5: 644 placements searched, 0 clear (J2:13).
  - E3-2's J1 is the preset's J10 (task-E3-8-report.md:158-159).
- **Requirements parked in «Бачимо» as «попередньо — E2-9» never reached the bench task.**
  - These were the 1 MΩ scope input, per-channel V/div and the crest readouts (J1:33, outOfScope). E3-8 had to add
    all three as shared changes (task-E3-8-report.md:148-154).
  - Ω «—» on a live island (plan decision 5, batch-E3.md:27-28) was not in E2-6, so E3-6 added `powered`.
- **A geometry leak, +1 per bench mount.**
  - Cause: the tray's block was never disposed.
  - It was found only when a second chapter turned the leak check on (task-E3-7-report.md:127-136).
  - Fixed at shared/hand/tray.ts:255-263.
- **`bench.preset` keeps plugs it is not given, and seats parts before plugs.**
  - Effect: a RangeError on navigation (task-E3-6-report.md:102-104, :139-142).
  - Workaround: chapters clear first; `board()` = clear, then preset (shared/steps/stand.ts:72-75).
- **The touch hover glow and grips ignoring the policy** (§2.5, §2.9). Both were shared hand bugs that the first
  chapter brought to light.
- **Bench readings are DC only.**
  - `reading(id)` returns the DC solution (shared/model/driver.ts:224-232, :299-301). LED light uses it
    (shared/bench/index.ts:459-460), and so do the meter and heat.
  - The meter showed 0,002 mV on a playing player's row (J1:25).
  - E4 consequence: an LED fading after the switch opens (`capacitor/store`, `capacitor/capacity`), or a meter on a
    charging capacitor, will not follow the transient unless the bench gets a time-domain path for them.

Rules:
- [ ] P: Before scripts, list the bench capabilities each E4 step needs (readers, time-domain light and meter, inside
  views, loupe floors, scope modes). Assign each to a bench task with tests. «попередньо» in a script is not a
  request.
- [ ] S: Before writing a new board layout into «Бачимо», especially on `AMPLIFIER_PRESET`, check it with the overlap
  and reach tests (`shared/bench/__tests__/presets.test.ts:161-178`) and the node partition. Use the preset's ids:
  J1…J10 are taken.
- [ ] B: Seat every step's board through `stand.board` (clear, then preset).
- [ ] B: Run the leak check with at least two chapters on the profile.

### 2.12 Process: not one of the listed classes, but it cost rounds

- **Fixes that broke something new.** 5 of the 12 fix rounds introduced a new defect, each in what the fix added
  (J1:15, J1:19, J1:33, J1:57; J2:15):
  - a new gauge (its thump);
  - a new time claim (the fade);
  - a new hint order (clipped traces);
  - a new control (`segmented`);
  - a new shot (no `fit`).
  - [ ] Rule: A fix that adds a number, readout, control, hint path or shot gets the full check of its kind: a
    sweep, the widget's semantics read in code, the hints replayed against the goal, or screenshots on pp, tp and tl.
- **An escalation stall.** E3-6 round 1 was told to stop and let the controller or owner choose between `amp` and
  `on`. Nobody chose, so round 2's implementer chose, citing the owner's «без питань» (J2:11, J2:13, J2:15).
  - [ ] Rule: The plan names who decides conflicts between rows, and when: the controller, before the next row
    starts. Reviewers do not hand a decision to a party who is not in the loop.
- **Out-of-scope reader text is never decided.** E3-1's `loud` «Висновок» says «Поки вимикач розімкнено, музики
  немає зовсім». It was flagged as false after a reopen in rounds 2 and 3 (J1:19, J1:23), and it is still in
  docs/volumes/electronics/chapters/prologue.md:61.
  - [ ] Rule: Every outOfScope item that touches reader text gets a controller ruling, recorded in the batch report.
- **Scripts written before the bench lands.** They leave «попередньо» marks that builders must reconcile (J1:7
  concerns; task-E3-8-report.md:167-169).
  - [ ] Rule: E4 scripts are written against the landed bench. Read `shared/README.md` and the presets first.

## 3. What took the most rounds, and why

1. **E3-1, the prologue script: 3 rounds** (J1:13-J1:23). Each round fixed a number and added a new time-dependent
   claim measured once:
   - the gauge's levels led to the thump;
   - «2–4 s» led to the 0,75…6,2 s spread and the relight.

   Root cause: transients were described from single runs (C2 charging into 8 Ω, the reservoir's fade, the melody's
   moment). The claims converged only with sweeps and a settling bound with margin. E4 is mostly transients, so this
   is its top risk.
2. **E3-6, the resistor chapter: 3 rounds, about 3 h** (agent meta 05:17 → last re-review 08:16).
   - Round 1 had 11 findings, 6 of them from the shot reader on phone pictures.
   - Round 2 went to a cross-chapter decision that had been escalated and left undecided.
   - Round 3 repaired round 2's new shot (no `fit`, tablets), which the `pp`-only gate could not see.
3. **E3-2 and E3-4: 2 rounds each.** Both second rounds were new breakage from the first fix: the hint order, and
   `segmented`.

E3-7 needed one round, but it was the largest structural fix (extracting `shared/steps`). It was caused by a brief
note that contradicted the recipe.

## 4. What the readers caught that the spec reviewer missed

Three times the reviewer approved with 0 important findings, and the reader then found 4 important ones: E3-3 (J1:42
against J1:43), E3-4 (J1:52 against J1:53) and E3-8 (J3:6 against J3:7).

Caught only by the script readers:
- Real-world physics on screen: the electron speed (J1:43) and «теплий і живе» (J1:53).
- Severity: the reader rated the ideal-probe artifact and «відстає» critical; the reviewer had them as important
  (J1:28 against J1:29).
- Goal against takeaway in `stand`, and the sound-only `quiet` (J1:11).
- A ratio invisible at its scale, plus the axis captions and «U» (J1:29).
- Language: «тобто міліампера» (J1:29) and «рядом номіналів» (J1:53).
- Phone: the touch size and the dock words (J1:53, J1:43).
- Bench risks: «A»-mode burns with no recovery, and the unguarded «—» (J1:43).

Caught only by the shot readers, in the chapters. Every picture and phone defect:
- the touch hover on the burnt LED, grips on forbidden parts, callouts overlapping or misplaced, callouts over probe
  sockets, and the wrong jumper named (J2:7);
- the LED's dot on R1, and the LED's tag over R1 (J2:24);
- C3 hiding J10; J10 stretched across the board on a phone while QA passed; the frozen window in the bass's rest;
  readouts under the nav (J3:7).

No spec reviewer looked at a picture. All of them listed the shot review under cannotVerify (J2:6, J2:27, J3:6).

Caught only by the reviewer (what to keep that seat for):
- the cross-chapter collision, and how deviations were recorded (J2:6);
- recall-link coverage (J2:6);
- the dead end, found by reading `toTray` (J2:6);
- code duplication against the recipe (J2:27);
- where the ledger's numbers came from (J1:10);
- in re-reviews: the tablet regression, seen on the reviewer's own screenshots (J2:15), and the widget semantics
  (J1:57).

- [ ] P: Keep both seats on every script and chapter task. The reader is the only seat that looks at pictures and
  checks real-world physics. No task counts as approved on the reviewer alone.

## 5. E4 hotspots: rules by step

| Step (PATH.md) | Rules that bite | Why |
|---|---|---|
| `divider/two`, `ratio` (:409-422) | 2.1 condition, 2.2 formula after seen | battery 1,5 Ω gives 8,99 V; `ratio` asks for a prediction before the probe |
| `divider/pot` (:423-429) | 2.3 one word for the control, 2.5 touch | knob or slider; pot target size on a phone |
| `divider/load` (:430-437) | 2.1 instrument loading | the meter on V draws no current; a scope probe adds 1 MΩ |
| `divider/volume` (:438-446) | 2.1 tone vs melody, 2.4 framing, 2.6 frozen | the bench plays the melody; the speaker lead lies over the pot (task-E3-5-report.md:242-244); a held window must contain music |
| `capacitor/store`, `capacity` (:471-500) | 2.11 DC-only light, 2.6, 2.1 sweep | the LED afterglow needs a time-domain path; the frozen frame cannot show it |
| `capacitor/inside` (:481-490) | 2.7 anchors per variant, 2.11 new view | new inside view; callouts on plates and insulator |
| `capacitor/slow`, `time` (:501-518) | 2.1 scope loading, 2.6, 2.1 margins | 63 % with 1 MΩ attached; curves only live; «two thirds» needs a robust predicate |
| `capacitor/reservoir` (:519-529) | 2.1 thumps and sweep, 2.9, 2.6 | C3 out and back in a playing amplifier; sag «в такт музиці» needs loud moments in the window |
| `capacitor-kinds/ceramic`, `film`, `electrolytic` (:554-579) | 2.5 touch, 2.3 naming, 2.7 | reading markings in the loupe; the cut roll |
| `capacitor-kinds/rated`, `reverse` (:580-599) | 2.9 recovery, 2.1 compressed time | bulge; capacitor heat tint against «Чесна фізика» is open (progress.md:69) |
| `capacitor-kinds/amp` (:600-607) | 2.4 C3/C2 occlusion, 2.9 «A» hazards | meter on all three electrolytics |
| `filter/block` (:631-638) | 2.6 spike never frozen, 2.1 loading | τ = 10 ms spike; probe on 10 kΩ |
| `filter/pass` (:639-647) | 2.2 visible at scale | two channels, «до» and «після» |
| `filter/coupling` (:648-659) | 2.4, 2.9 jumper for C2 burns Q2 | two probes on C2's legs |
| `filter/highs`, `lows` (:660-676) | 2.2 sound-only («слухати бас/хет»), 2.6 window content, 2.1 thumps on swap | needs a visible readout and a frozen window with bass or hat |
| `filter/tone` (:677-685) | 2.3 control naming, 2.2 formula after seen | pot plus `f = 1 / (2π × R × C)` |

## 6. Open items E4 inherits

- **Clone not merged.** E2-9, E2-10, E3-8 (fix round 1 running, uncommitted) and E3-9 are still outside main.
  `shared/steps` exists only in main, and the clone's `meter` has copies (§2.8).
- **Held-window warm-up.** The change to a half bar is pending in the clone's uncommitted fix (§2.6).
- **Tablets.** No tablet gate (batch-E3.md:34-35), and the chapter QA cannot run a tablet branch (J2:19).
- **`path_check` gaps.** It does not check «Докладніше» or unit signs (tools/content/path_check.py:64-73).
- **Prologue text.** `loud` «Висновок» is still false after a reopen
  (docs/volumes/electronics/chapters/prologue.md:61).
- **Capacitor heat tint.** It contradicts «Чесна фізика» and needs a VISUAL decision before `capacitor-kinds/rated`
  (progress.md:69).
- **LED at the phone edge.** The «увімкнено» LED is cut by the left edge on the phone shot of `resistor/amp`
  (progress.md:80).
- **Speaker ground.** `spk-` cannot reach the − rail, so it returns through a jumper (task-E3-5-report.md:141-145,
  :226-231).
- **D2/D3.** Removing either burns Q2 in 0,8 s. Every amplifier step locks them (progress.md:53).
- **DC-only readings.** LED, meter and heat do not follow transients (shared/model/driver.ts:299-301), which matters
  for `capacitor/store` and `capacitor/capacity`.
