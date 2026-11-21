# Chapter `electronics/resistor` — «Навіщо схемі деталь, яка лише заважає струму?»

Script: `docs/volumes/electronics/chapters/resistor.md` (all reader text from `content/generated/resistor.json`,
captions by position — `__tests__/manifest.test.ts`). World: the volume's bench (`@electronics/shared/**`: the room,
the board, the parts, the hand, the multimeter, the model of the circuit, the magnifier's dive, the resistor's carbon
film inside). First frame: the shot `stand`, three jumpers on the board, the red LED in the tray, the switch open;
last frame: the shot `meter`, the amplifier on the board with the meter in the gap of its LED's branch.

## Files

| File | What |
| --- | --- |
| `scene.ts` · `chapter.ts` | orchestrator: the stand → seven step modules → `stage.define` + `stepUi.define`; the param `meter` (the multimeter slides in, 0.6 s); the door of `inside` flies home before the next step's shot; the dock's switch toggle follows `bench.closed` |
| `stand.ts` | `mountBench` once, the magnifier's door into a part with its lens keeper and the ladder «де ми» (`benchLadder`), the names under the pointer (`naming`, set by each step) |
| `parts/boards.ts` | every step's board as data (`FLASH`, `LIMIT`, `OHM`, `loopWith`, `LAW`, `AMP`), the rows of the goals and their windows (`WINDOWS`) |
| `parts/goals.ts` | rows of sockets, rows in any order, the tally of readings held 1 s |
| `parts/policy.ts` | what the hand may take in a step and the names it shows (`HandPolicy`) |
| `parts/names.ts` | names under the pointer of what a step keeps in place (a jumper, an LED, the amplifier's parts, the meter's case): an invisible twin of the part's `hit`, only where a pointer hovers |
| `parts/dock.ts` · `parts/meter.ts` | a phone's dock: the tray's buttons and the battery's switch; the multimeter's dial switch and readout |
| `steps/01-flash.ts` … `07-amp.ts` | the steps |
| `qa/interactions.mjs` · `qa/helpers.mjs` | every goal by real pointer input (mouse or touch), the readers, the closing card; helpers copied from the bench's sandbox (`REUSE.md`) |

## Steps

| Step | Reader does → goal | Notes |
| --- | --- | --- |
| `flash` | the LED from the tray (phone: the dock's «червоний») anode into 9ae, cathode into 10ae, closes the switch (phone: the dock's toggle) → the LED burnt in place with the switch closed, 1 s after | the model gives 0,929 A, burnt on the 4th frame of 1/60 s; the bench's one wisp; no flip (from the tray the LED comes anode to the left) |
| `limit` | the 330 Ω from the tray into the gap 5ae–9ae, closes the switch → LED 21,0 … 21,5 mA, whole, 2 s | a new LED1 every entry (`bench.preset`) |
| `ohm` | «Ω» (dock), probes on the live loop read «—»; R1 whole out of the loop onto free sockets; probes on each resistor's rows → «330,0 Ω», «1,000 kΩ», «4,700 kΩ» each 1 s | the «—» on a live circuit is the bench meter's rule (`BenchModel.powered`, task E3-6, plan E3 decision 5) |
| `inside` | drags «Глибина» to its end (the lens onto R1, the camera through the ring: floor `inside`), switches «Резистор» 330 Ω / 10 kΩ → 1 s with each value down inside | the film (`shared/inside`): turns 3,54 → 6,5, the electrons' speed from the model's current (29 × slower); three callouts at `film.anchor` points; the switch puts a new R1 under the same id (`bench.preset`), the door follows it |
| `law` | three resistors from the tray, one at a time, into the gap → «8,986 mA», «4,497 mA», «2,998 mA» each 1 s | the meter on «A» with its probes put by the step (e9, −9) once it stands in its place; the formula card `I = U / R` (a dock note) with the takeaway |
| `share` | «V» (dock), the probes on the LED, the resistor, the rails → «1,960 V», «7,008 V», «8,968 V» each 1 s | three callouts name the places and go when their reading counted |
| `amp` | (a) «V» on R1 (2,2 kΩ) → 6,582 … 6,592 V 1 s; (b) J11 out, «A» in its rows → 2,990 … 2,998 mA 1 s and the meter's current the LED's | «Нові деталі» (a dock button) while a part is burnt or bulged puts the step's board back; callout «резистор 2,2 kΩ» over R1 until both halves |

Every step puts its own board on entry with fresh parts (`bench.preset`: what it takes off is forgotten), sets the
switch, the tray, the meter's dial and probes, the hand's policy and the names; a deep link (`?freeze`) lands on that
state, and `flash` starts with no LED and the switch open, so nothing burns before the reader acts.

## Simplified / differs from the script

- **`amp` measures the LED's resistor 2,2 kΩ, not 470 Ω.** The script planned a gap at R5 (470 Ω) with its top leg in
  a free row X and a jumper to `top`, provisional on the layout of `AMPLIFIER_PRESET`. On the bench no such place
  exists: a search over every straight place of R5 with one leg on its node and the other in a free row, with one or
  two jumpers (straight or not), found none clear of the bodies of C3, C2, D1, Q2 and the neighbours' legs; and J8,
  which feeds R5's row, also carries the reservoir C3's leak (9,4 μA), so in its gap the meter would read 8,373 mA, 0,11 %
  above R5's current. The LED's branch has a clean gap: R1 from `e5` to `h5`, the violet J11 from `i5` to `i1`, the LED
  from `j1` to the − rail (at the board's left end, so its tall body hides at most J11's far end) — every part of
  the amplifier within 1e-4 of `AMPLIFIER_PRESET`'s point, no body, leg, jumper or plug where another part is
  (`__tests__/boards.test.ts`). The script's step `amp` (Текст, Висновок, Ціль, Підписи, Підказки, Докладніше,
  Бачимо, the fact notes) was rewritten for 2,2 kΩ: 6,587 V and 2,994 mA (the oracle `amplifier-op.json`: 6,59 V
  on 2,2 kΩ); `PATH.md` records it among the scripts' deviations, the ledger's run note says so. The gap jumper's id is
  `J11` (the amplifier has `J1` … `J10`), not the script's earlier `J1`. **Open (review of E3-6):** `resistor-pick/on`
  measures the same R1 (6,59 V, ≈ 3 mA) and asks why 2,2 kΩ, which `amp`'s «Докладніше» already answers; the
  controller or the owner chooses before E3-7 — `amp` back to 470 Ω (a gap in J8, the leak allowed for) or another
  resistor, or `resistor-pick/on` rewritten to build on the current measured here (`PATH.md`, the deviation line).
- **Names under the pointer of things the step keeps in place** (the script's «назви за наведенням» of jumpers, the
  LED in `limit`, the amplifier's parts, the multimeter): the bench's hand names only what it may take, so the chapter
  adds invisible twins of those parts' `hit` boxes (`parts/names.ts`). Only where a pointer hovers: on a touch screen a
  twin would take the taps meant for a grip beside it; there the names are the dock's and the panel's.
- **Ω on a live circuit shows «—»**: built in the bench's meter (`readMeter` asks `BenchModel.powered`, a small shared
  change with tests, plan E3 decision 5 as the controller ruled), since the merged E2-6 measured with the sources out.
- `inside`: the value switch is in the step (`bench.preset` of the loop with another R1 under the same id), not a
  `parts/value.ts`; the slider's marks are «стенд» and «усередині резистора» only (the script's captions).
- `amp` (b) reads the meter's current against the LED's (they are R1's): with the gap open nothing else flows there.
- `ohm`: the 330 Ω let go off the board (a phone: anywhere off it) would go to a tray the step does not have and be
  gone, the only 330 Ω with it; the step puts it back into the loop (`b5` … `b9`, new and whole: the step's board
  again, the other parts never move), so «330,0 Ω» stays within reach (review of E3-6; the script's «Бачимо» says so).
- `share`: the three callouts step aside while a probe is in the hand — on a phone «світлодіод» has room only below
  the LED, over the sockets of its rows the probe is aimed at.
- `inside`: the callouts' sides are fixed bands that cannot meet on a phone — «вугільна плівка» up, «канавка» left,
  «керамічний стрижень» down; `film.anchor` keeps the film's point a whole strip between the caps and a turn or so
  toward leg 1 from the groove's (`shared/inside/film.ts` `anchorX`).
- The hand (shared): a grip shows only on an end the step lets the hand take (on a touch screen too), and a finger
  leaves no glow on the body it touched (the engine keeps the last touched thing «under» the lifted finger).

## QA

```bash
node app/src/volumes/electronics/chapters/resistor/qa/interactions.mjs --base <url> --out <dir>             # 1280x720
node app/src/volumes/electronics/chapters/resistor/qa/interactions.mjs --base <url> --touch --size 390x844 --out <dir>
```

Frozen clock; starts on `electronics/resistor/flash`; last line `PASS electronics/resistor — <n> checks (<size>)`
(122 checks on a desk, 133 on a phone) or `FAIL … — <k> of <n> checks (…)`, exit 1. Goal snapshots
`<step>-goal-<size>.jpg` in `--out`.
