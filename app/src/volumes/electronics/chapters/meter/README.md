# Chapter `electronics/meter` — «Як побачити напругу, струм і форму сигналу?»

Script: `docs/volumes/electronics/chapters/meter.md` (all reader text from `content/generated/meter.json`, captions
by position — `__tests__/manifest.test.ts`). World: the volume's bench (`@electronics/shared/**`) with its speaker in
sound: the room, the board with the prologue's amplifier (`AMPLIFIER_PRESET`), the hand, the multimeter, the
oscilloscope, the model of the circuit and the model in time. First frame: the shot `meter`, the amplifier quiet on
the board (the switch closed, the player stopped, the LED «on» lit), the multimeter «вимкнено»; last frame: the shot
`scope`, both of the scope's probes on the amplifier's input and its speaker, two waves on the board's chart.

## Files

| File | What |
| --- | --- |
| `scene.ts` · `chapter.ts` | orchestrator: the stand → six step modules → `stage.define` + `stepUi.define`; the params `meter` and `scope` (the instruments slide in and out, 0.6 s); the dock's toggles follow the switch and the player |
| `stand.ts` | the step stand of `@electronics/shared/steps` with sound (`createStepStand(ctx, { sound: true })`): the bench once with its speaker in sound; a step's board (`board`: `bench.preset`, the step's whole bench); the player — its level is the model's setting of `PLAYER` (`playing`, `play`), a tap on its box where the step lets it (`naming.tap`); the names under the pointer of the instruments' cases and the player (`naming`) |
| `parts/boards.ts` | the board (`AMP`), the supply jumper `J10`, the rows of the goals, the sockets a step puts a probe in, the player's level, the knob, the windows and the times of the goals |
| `parts/goals.ts` | the wave's verdict (`wave`); the rows, the tally and the run in a row are `@electronics/shared/steps`' |
| `parts/scope.ts` | every step's scale and display and how far back the crests of `twice` look; the chart's words (an axis' caption with its division: «2,5 V на поділку») and the crests' block (one `stats` block) are `@electronics/shared/steps`' (`scopeBoard`, `crestStats`) |
| `parts/shots.ts` | `amps`'s own shot (`AMPS_SHOT`) and the longer flight around it (`CAMERA_FLIGHT`) |
| `parts/marks.ts` | where the callouts stand: over the scope's screen (a phone: over channel 1's probe), over a socket, over a part on the board, over the switch |
| `steps/01-volts.ts` … `06-twice.ts` | the steps; the hand's rules with the probes by name (`handPolicy`), the dock (`meterSwitch`, `meterReadout`, `trayButtons`, `switchToggle`, `playerToggle`, «Нові деталі» `freshButton`, the knob's slider `knobSlider`) and the goals' maths come from `@electronics/shared/steps` (moved there in E3-10 from this chapter's copies, the button and the slider in E4-B; REUSE.md) |
| `qa/interactions.mjs` · `qa/helpers.mjs` | every goal by real pointer input (mouse or touch), the readers, the recalls, the closing card; helpers copied from the bench's sandbox (`REUSE.md`) |

## Steps

| Step | Reader does → goal | Notes |
| --- | --- | --- |
| `volts` | «V» (dock), red in the + rail and black in the − rail → «8,980 V» 1 s; the other way round → «−8,980 V» 1 s (either first) | the model's 8,98002 V: the quiet amplifier takes 13,31 mA through the battery's 1,5 Ω; the hand takes the probes only |
| `amps` | J10 (the supply jumper, `+1` → `a1`) out — whole; «A», the probes in the + rail and 1ae → |I| 13,2 … 13,4 mA 1 s, the meter's current the battery's within 0,1 % | its own shot `amps` (from the left and in front: the reservoir C3 no longer hides J10 and 1ae); «Перемичка» over J10 while it is in the gap; the model's 13,3122 mA; with J10 in place the meter beside it takes half; across the rails an honest short (5,992 A, the battery warms); «A» from 5ae to the − rail burns D1 in 1,07 s — «Нові деталі» (a dock button while a part is burnt or bulged) puts the board back |
| `flat` | ch1 into the + rail, the switch closed while it is there (a phone: the dock's toggle) → from 0,5 s after the closing the newest samples of the roll within 8,975 … 8,985 V for 2 s | the roll: 0,5 s and 2,5 V a division; the scope's input of 1 MΩ: the open rail at 0,014 V; a closing before the probe is in does not count — «Вимикач батарейки» stands over the switch then (desk) |
| `wave` | a tap on the player (a phone: the dock's «Плеєр»), ch1 into the player's row 13ae → 3 s in a row: within ±0,35 V, each 2 s reaching 0,2 V, the meter on the same row under 1 mV | the meter's probes put by the step (`d13`, `-14`) once it stands on its place; sweeps of 5 ms and 0,1 V a division; the meter reads the operating point, «0,002 mV» |
| `notes` | «Час на поділку» on 20 ms for 3 s and on 1 ms for 3 s (either first), the player playing and ch1 on 13ae | the step puts ch1 in `d13` once the scope stands; 5, about 20 and about 60 sweeps a second at 20, 5 and 1 ms a division |
| `twice` | ch1 on the wiper's row 15ae, ch2 on the speaker's row 10ae (3 s together); «Гучність» ≤ 0,25 for 1 s, ≥ 0,5 for 1 s, and «Масштаб першого щупа» on 0,02 V a division for 1 s with the knob within 0,25 … 0,5 | one scale of 0,25 V on entry; channel 1's own scale on the chart's right axis; the crests «Вершина на вході», «Вершина на динаміку» over the last 0,5 s (about sixteen times), in the dock right under the slider as one `stats` block (the dock puts readouts after every block: under the scale's switch a phone's sheet at its height hid their numbers under the bottom navigation, review of E3-8); «вхід підсилювача» and «динамік» over their rows until a probe is in each, aside while a probe is in the hand |

Every step puts the amplifier on the board on entry with fresh parts (`bench.preset`: what it takes off is forgotten),
sets the switch, the player, the knob, the instruments' dial, scale and probes, the hand's policy and the names; a
deep link (`?freeze`) lands on that state. The goals read the bench's numbers: the multimeter's display, the model's
currents, the oscilloscope's trace (the roll's newest points) and its crests (`ScopeModel.peak`). The words «постійна
напруга», «змінна напруга» and «частота» stand over the scope's screen with the takeaway (a phone: over the probe).

## Simplified / differs from the script

- **Shared additions (E3-8), each small and tested:** the scope's input of 1 MΩ (`SCOPE_INPUT`, `oscilloscope.extra()`
  in the driver's `extra`: the script's `flat` asks for it so that a reopened switch drops the rail to 0,014 V instead
  of a slide an ideal probe would show); a channel's own V a division (`ScopeSettings.channelVolts`, channel 1 on the
  chart's right axis `y2`, the instrument's screen at the same scale: `twice`); a channel's crest over the last seconds
  shown (`ScopeModel.peak`: the readouts of `twice` and the wave's goal). The sandbox's `rc` check now expects the
  loaded RC (62,95 % of 9 V at 1 s).
- **The supply jumper is the preset's `J10`**, not the script's `J1` (the script's goal and «Бачимо» say so now): the
  landed `AMPLIFIER_PRESET` already feeds the amplifier from `+1` to `a1`, D1's anode row, through it alone.
- **`amps` has a button «Нові деталі»** (a caption added to the script): «A» elsewhere in the amplifier burns a part
  (D1 from 5ae to the − rail, 1,07 s); without it the step would be left with a dead amplifier until the reader left
  it (the same button as in `resistor/amp`).
- **The switch is called by its name, not by a cyan pulse**: the bench has no pulse for the battery's switch, so the
  callout «Вимикач батарейки» stands over it (desk; a phone has the dock's toggle) while it was closed before the
  probe went in.
- **The axes' titles of `twice` share the width over the chart**: with one scale the left one says it all («напруга, V
  · 0,25 V на поділку») and the right one nothing (its ticks are the same); with channel 1 on its own each says its volts
  a division alone, in its line's colour («0,25 V», «0,02 V»): two longer titles side by side overlap over the chart of
  a phone 360 px wide (seen on the shots).
- **The wave's goal reads the crests of the samples shown** (`peak` over 2 s and over the run), not each sweep: the same
  model numbers, every sample counted.
- **Names under the pointer** of the multimeter's and the oscilloscope's cases and of the player are the step stand's
  (`naming`), only where a pointer hovers; the probes' and the jumper's are the hand's (`handPolicy`).
- **The player's toggle in the dock and a tap on its box** both set the model's `PLAYER` level (0,3 V or 0); the tap
  only in `wave` (the script: the hand takes the probes alone in `notes` and `twice`).
- On a touch screen, as with a mouse, a grip shows only on an end the step lets the hand take (the shared hand since
  E3-6, here since the merge of E3-10): the amplifier's jumpers show none where a step takes nothing of the board.
- **`amps` has its own shot on a desk and a tablet** (`parts/shots.ts` `AMPS_SHOT`, registered under the name `amps`,
  the bench's `phone` on a phone): the multimeter and the board's left half from the left and in front (≈ 26° round,
  ≈ 48° to the table). In the bench's `meter`, seen from the front, the reservoir's tall can C3 (e2/d2) stood before
  J10, `+1` … `+3` and the row 1ae: J10 showed as a stub over its lid, the black probe's sockets not at all (review of
  E3-8). `__tests__/shot.test.ts` holds the sight lines beside the can and the `fit` sphere (tablets) around the
  multimeter, its probes, J10, the gap's sockets and the LED; 820 × 1180 and 1180 × 820 were looked at. The callout
  «Перемичка» stands over J10 while it is in the gap: every jumper of the amplifier is violet. The flights into `amps`
  and out of it into `flat`'s `scope` take 2,6 s (`CAMERA_FLIGHT`) instead of the engine's 1,8 s: the camera crosses
  the bench, and at 1,8 s it moved 0,46 a frame (the QA's limit is 0,35).
- **J10 is taken whole only** (the script said «whole or by an end»): its two grips cover the short jumper (on a touch
  screen they show all the time; on a desk, in the shot `amps`, the QA's press on its middle took an end too), and an
  end let go off the board lay stretched across the board instead of going to the tray (review of E3-8; the QA checks
  that J10 left both the board and its pending list).
- **A held page's scope opens its window on a half bar of the melody** (`shared/model/driver.ts` `STILL`, 1 s or 2 s,
  E3-8's review): at the old 0,5 s the bass rests, and every shot of the scope showed one high note without a bass.
  `__tests__/boards.test.ts` («notes») counts the waves below 150 Hz in that window: 8 … 22 at 20 ms, 2 … 8 at 5 ms.

## QA

```bash
node app/src/volumes/electronics/chapters/meter/qa/interactions.mjs --base <url> --out <dir>             # 1280x720
node app/src/volumes/electronics/chapters/meter/qa/interactions.mjs --base <url> --touch --size 390x844 --out <dir>
```

Frozen clock; starts on `electronics/meter/volts`; last line `PASS electronics/meter — <n> checks (<size>)`
(110 checks on a desk, 115 on a phone, 111 on a tablet: `--touch --size 820x1180` or `1180x820`, where the switch and
the player are tapped in the shot) or `FAIL … — <k> of <n> checks (…)`, exit 1. Goal snapshots
`<step>-goal-<size>.jpg` in `--out`.
