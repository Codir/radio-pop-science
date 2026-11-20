# `sim/core` — the circuit model of the volume «Радіоелектроніка»

Everything on the stand that shines, warms, burns, sounds or shows on a meter is computed here from the circuit
that is on the board now. The board builds a `Netlist` — plain data: nodes and the parts between them — and the
model solves it by modified nodal analysis (the design, `docs/superpowers/specs/2026-11-20-electronics-volume-design.md`
§5). The model knows nothing of three.js and the board knows nothing of matrices.

The model is pure TypeScript. It imports nothing from the engine, three.js or the DOM and never reads a clock, a
timer or chance, so the same code runs in a worker, on the main thread and in the tests. `__tests__/purity.test.ts`
keeps this by reading the text of every file under `sim/` (comments too). The rest of the volume uses only what
`index.ts` exports.

What E1-3 gives: the linear parts, the operating point (`solveDC`), the checks of the shape of a circuit
(`topology.ts`), and the comparison with ngspice. E1-4 adds the nonlinear parts — diodes, LEDs of five colours, an
incandescent lamp — with Newton's iterations at the operating point, and the limits of every part: how loaded it is,
how its heat gathers, and when it burns. Time and capacitors come with E1-5, transistors and the amplifier with E1-6.

## Units and conventions

- **SI everywhere:** V, A, Ω, W (later F and s). No prefixes in numbers: 4.7 kΩ is `4700`.
- **Node 0 is the ground.** Nodes are numbered by the board, `0 … nodes − 1`; a node that no pin uses costs nothing
  (it is left out of the matrix and reads 0 V), so the board may give every row of its sockets a number.
- **Pins** of a part come in the order of the catalog (`PARTS[key].pins`): `['plus', 'minus']`, `['a', 'b']`,
  `['ccw', 'wiper', 'cw']`, `['anode', 'cathode']`.
- **Readings** (`PartReading`): `u` — the voltage from the first pin to the second; `i` — the current into the part
  through its first pin; `p` — the power the part takes, the sum over its pins of voltage × current into the pin.
  A resistor has `p = u·i > 0`. A battery that feeds a circuit has the current coming *out* of its plus pin, so its
  `i` and `p` are negative: a 9 V battery on 100 Ω reads `u` 8.867 V, `i` −88.67 mA, `p` −0.786 W. A diode or an
  LED reads from anode to cathode: forward, `u` and `i` are positive. A meter on the stand shows the magnitude; the
  sign says which way the current goes.
- **Settings** (`PartInstance.setting`): a pot — the share of its track from `ccw` to the wiper, 0…1 (0 is the knob
  turned fully counter-clockwise; 0.5 when absent; outside 0…1 it is held to the range). A switch — 0 open, 1
  closed (from 0.5 up counts as closed; open when absent). Other parts ignore it.

## The netlist and the operating point

```ts
import { compile, createModelState, solveDC, type Netlist } from '@electronics/sim/core';

// 9 V → 1 kΩ → node 2 → 2 kΩ → ground; a 10 kΩ pot across the battery, its wiper on node 3, loaded by 4.7 kΩ
const net: Netlist = {
  nodes: 4,
  parts: [
    { id: 'B1', spec: 'battery-9v', pins: [1, 0] },
    { id: 'R1', spec: 'resistor-1k', pins: [1, 2] },
    { id: 'R2', spec: 'resistor-2k', pins: [2, 0] },
    { id: 'P1', spec: 'pot-10k', pins: [0, 3, 1], setting: 0.3 },
    { id: 'RL', spec: 'resistor-4k7', pins: [3, 0] },
  ],
};
const dc = solveDC(net);
dc.ok; // true
dc.v[2]; // 5.996 V (the battery's 1.5 Ω takes a little)
dc.v[3]; // 1.865 V: 3 kΩ of the track below the wiper, 4.7 kΩ beside them, 7 kΩ above
dc.parts.R1; // { u: 2.998, i: 0.002998, p: 0.008988 }
dc.issues; // [] — nothing open, shorted or in the air (without RL the wiper would be `floating`, see Topology)

// a stand compiles once and solves on every change of a knob: the matrix is allocated once per circuit
const circuit = compile(net);
const state = createModelState(); // one per stand
net.parts[3]!.setting = 0.8;
solveDC(circuit, { state });
```

An LED, its light, and what happens without its resistor (the limits and the heat: below):

```ts
import { advanceHeat, createModelState, ledLumens, PARTS, solveDC, type LedSpec, type Netlist } from '@electronics/sim/core';

const state = createModelState();
const board: Netlist = {
  nodes: 3,
  parts: [
    { id: 'B1', spec: 'battery-9v', pins: [1, 0] },
    { id: 'R1', spec: 'resistor-330', pins: [1, 2] },
    { id: 'D1', spec: 'led-red', pins: [2, 0] },
  ],
};
let dc = solveDC(board, { state });
dc.parts.D1; // { u: 1.960, i: 0.02124, p: 0.04163 }
dc.status.D1; // { condition: 'warm', load: 0.708 } — 21 mA of its 30 mA
ledLumens(PARTS['led-red'] as LedSpec, dc.parts.D1!.i); // 0.01826 lm

board.parts[1] = { id: 'J1', spec: 'jumper', pins: [1, 2] }; // a wire instead of the resistor
dc = solveDC(board, { state });
dc.status.D1; // { condition: 'hot', load: 31.0 } — 0.93 A
advanceHeat(state, board, dc, 0.1); // ['D1']: it burnt within this tenth of a second
dc = solveDC(board, { state });
dc.parts.D1!.i; // 0 — a gap now
dc.issues; // [{ kind: 'open', part: 'B1' }]
```

`solveDC(net | circuit, { state?, maxIterations? }) → DcSolution`:

| Field | What it is |
|---|---|
| `ok` | `true` when the circuit has a single solution and the model found it |
| `reason` | when `ok` is false: `'singular'` — the matrix has no single solution (two ideal sources side by side, an ideal source with both pins in one row); `'no-convergence'` — Newton's iterations did not settle, not even with the sources stepped up from zero. Never an exception, never `NaN`: `v` and every reading are then zeros |
| `v` | `Float64Array` of node voltages by node number |
| `parts` | `{ [id]: { u, i, p } }` for every part; a burnt part reads `i` 0 and `p` 0 and the voltage across its gap |
| `status` | `{ [id]: { condition, load } }` for every part: `'ok'`, `'warm'`, `'hot'` or `'burnt'`, and the share of its limit it is under (see Limits) |
| `iterations` | how many times the matrix was factored: 1 for a linear circuit, Newton's iterations otherwise (those of the source steps included) |
| `sourceSteps` | how many steps of the sources the solve took: 0 when Newton's iterations settled at once |
| `issues` | what is wrong with the shape of the circuit (below); the numbers are valid all the same |

A malformed netlist is a `RangeError` that names the fault: a number of nodes that is not a whole number ≥ 1, an
empty or repeated id, a key the catalog has not, a wrong number of pins, a node out of range, a setting that is not
a finite number (checked again at every solve, since a compiled circuit reads the settings of its netlist live).

`compile(net)` checks the netlist, numbers the unknowns and allocates the matrix once. A compiled circuit follows
the settings of its netlist; any other change of the netlist (a part added, a pin moved) needs a new `compile`.

**The state** (`createModelState()`) is what the model remembers between solves, one object per stand and never a
variable of a module: two copies of a chapter side by side at a chapter boundary hold two. It outlives a netlist.
It holds the node voltages of the last good solve (`v`) and, by part id, the memory of every part (`parts`, a `Map`;
`memoryOf(state, id)` makes an entry cold and whole the first time):

| `PartMemory` | What it is |
|---|---|
| `heat` | how warm the part is, as a share of its limit (`advanceHeat`, see Limits) |
| `burnt` | the part burnt: every later solve with this state leaves it out — a gap. Nothing mends it; the stand that puts a new part in its place deletes the entry (`state.parts.delete(id)`) |
| `kelvin` | a lamp: its filament's temperature, written by every good solve (the steady one; room temperature when dark or burnt) |

The transient (E1-5) adds the charge of the capacitors there.

**Where Newton's iterations start.** A compiled circuit solved before starts from its own last solution, its
junctions too: a stand that compiles once and solves on every turn of a knob settles in two or three iterations
(the red LED with 330 Ω: 4 iterations from cold, 2 again). Otherwise every junction starts at its knee of
conduction, as SPICE does, and the other nodes at the state's `v` when it has as many nodes, else at zero.
`maxIterations` (default `MAX_ITERATIONS`, 100 — the ITL1 of SPICE) bounds one go of the iterations and each source
step.

## Topology: what the model says about the shape of a circuit

| `kind` | When | Fields |
|---|---|---|
| `open` | a source whose terminals the rest of the circuit does not join (a gap, an open switch): no current flows through it | `part` |
| `short` | a source whose terminals are joined by wires alone — jumpers, closed switches, or both legs in one row; the current is E / (r + wires) | `part` |
| `floating` | pins of a part in rows no other part touches (never the ground): a leg in the air. A pot whose wiper is left unconnected counts too: `{ kind: 'floating', part: 'P1', pins: ['wiper'] }`, while its track still carries current | `part`, `pins` (names) |
| `ungrounded` | nodes in use with no path to the ground for direct current; the model ties `nodes[0]` to the ground by `TIE_OHMS` (1 GΩ) and solves on — no current flows through the tie | `nodes` |

The order: the issues of the sources in the order of the parts, then the floating pins in the order of the parts,
then the groups of ungrounded nodes by their lowest node. A burnt part is a gap for the topology too: an LED that
burnt across a battery leaves the battery `open`.

## Catalog (`PARTS`)

| Key | Kind | Pins | Numbers | Limits | Source of the numbers |
|---|---|---|---|---|---|
| `battery-9v` | `battery` | plus, minus | 9 V, internal 1.5 Ω, 6 cells | 1 A (it only warms, never burns) | the plan's decision (batch E1, task E1-3), from Energizer's data below; the limit: below |
| `battery-4aa` | `battery` | plus, minus | 6 V, internal 0.6 Ω, 4 cells | 3 A (the same) | the same |
| `battery-aa` | `battery` | plus, minus | 1.5 V, internal 0.15 Ω, 1 cell | 3 A (the same) | the same |
| `ideal-9v`, `ideal-5v` | `source` | plus, minus | 9 V or 5 V, no internal resistance | — | the reference of hand calculations and of the oracle (5 V for the LEDs and diodes of E1-4); the bench never offers them (batteries only, the design §3.4) |
| `resistor-<code>` | `resistor` | a, b | every value of E24 from 1 Ω to 9.1 MΩ, and 10 MΩ: 169 parts; `series` E12 or E24; `tolerance` 0.05 | 0.25 W | values: IEC 60063 (E12, E24); key: the letter code of IEC 60062; 0.25 W and 5 % (gold band): the usual through-hole resistor of the kits, the design §5.2 |
| `pot-10k` | `pot` | ccw, wiper, cw | a linear track of 10 kΩ; each part of the track at least 1 mΩ | 0.2 W | Bourns PDB181 series, for example PDB181-K420K-103B: 10 kΩ, linear, 0.2 W (Digi-Key listing; datasheet bourns.com «PDB18») |
| `switch` | `switch` | a, b | open: no path; closed: 1 mΩ | — | the decision of this task (below) |
| `jumper` | `jumper` | a, b | 1 mΩ | — | the same |
| `speaker-8` | `speaker` | plus, minus | 8 Ω | 2 W | a 50 mm speaker such as Visaton K 50 WP 8 Ω: 2 W rated, 3 W maximum |
| `earphone-32` | `speaker` | plus, minus | 32 Ω | 0.1 W | a 32 Ω headphone such as beyerdynamic DT 770 PRO 32 Ω: 100 mW rated power handling (IEC 60268-7) |
| `diode-1n4148` | `diode` | anode, cathode | IS 2.52 nA, N 1.752, RS 0.568 Ω, BV 100 V, IBV 100 μA | 0.3 A; 100 V reverse | the model of LTspice's `standard.dio` (onsemi) and the onsemi datasheet, below |
| `diode-1n4007` | `diode` | anode, cathode | IS 14.3733 nA, N 1.80829, RS 41.4712 mΩ, BV 1100 V, IBV 10 A | 1 A; 1000 V reverse | Vishay's SPICE model and datasheet, below |
| `led-red`, `led-yellow`, `led-green`, `led-blue`, `led-white` | `led` | anode, cathode | fitted to the plan's forward voltage at 20 mA (below); BV 20 V, IBV 10 μA; rated 20 mA; `lumensPerAmp` | 30 mA | the plan's windows and limits; the light: Kingbright's datasheets, below |
| `lamp-6v` | `lamp` | a, b | 6 V · 0.1 A (60 Ω hot), cold 5.5 Ω, thermal time constant 50 ms | 0.7 W | the plan's decision and the choices below |

`resistorKey(ohms)` gives the key of a value (`resistorKey(4700)` is `'resistor-4k7'`; a value the catalog has not
is a `RangeError`). The codes: `4R7` 4.7 Ω, `47` 47 Ω, `470` 470 Ω, `4k7` 4.7 kΩ, `47k`, `470k`, `4M7` 4.7 MΩ, `10M`.

**The batteries' internal resistance.** Energizer, «Alkaline Manganese Dioxide — Handbook and Application Manual»
(2018), p. 8: «The typical effective resistance of fresh Energizer® alkaline cylindrical batteries (using a 5 mA
stabilization drain followed by a 505 mA 100 millisecond pulse) will be approximately 150 to 300 milliohms,
depending on size.» The datasheet of the AA cell Energizer EN91 (IEC LR6, form EBC-1202M): «Nominal IR: 150 to 300
milliohms (fresh)». The plan takes for an AA cell the fresh 0.15 Ω at the bottom of that range, for four in series
4 × 0.15 = 0.6 Ω, and for the 9 V «Крона» (IEC 6LR61 — six small cells in series, the leading 6 of the name) 6 × 0.25
= 1.5 Ω, each small cell in the upper part of the range. A battery that runs down has more; the model keeps the fresh
value. The handbook and the EN91 datasheet were read on 20.11.2026; the pot, speaker and headphone numbers were taken
from distributors' and makers' listings on the same day.

**Wires: 1 mΩ** (`WIRE_OHMS`, the decision of this task). The design allows an ideal wire or a small resistance. An
ideal wire is an extra unknown, and a loop of ideal wires — two jumpers side by side, a jumper beside a closed
switch, both perfectly natural on a board — has no single solution. 1 mΩ is near enough to ideal (a jumper across the
9 V battery gives 9 / (1.5 + 0.001) A, within 0.07 % of E / r) and always solvable. The same 1 mΩ is the least part
of a pot's track, so a knob at its end never makes a zero resistance.

**The matrix.** `PIVOT_MIN` = 1e-13 S, the default `PIVTOL` of SPICE: a pivot smaller than this (or not a number)
makes the solve `singular`. `TIE_OHMS` = 1 GΩ — the air between two rows of a board — ties an ungrounded group.

**The batteries' limit** (the decision of this task) only says when a battery is `warm` or `hot`: a battery never
burns, a short only warms it (as in the volume `circuit`, chapter `build`). The limit is the round current at which
the battery's own resistance turns about 1.5 W into heat: 1 A in the 1.5 Ω of the 9 V battery, 3 A in the 0.15 Ω of
an AA cell (1.35 W) — for four cells too, each cell heating as one. A short gives 6 A (load 6) and 10 A (load 3.3);
the 8 Ω speaker straight on the 9 V battery takes 0.95 A, warm.

## Diodes and LEDs (`diode.ts`)

The DC part of SPICE's diode, level 1, at 27 °C, written after ngspice-42 (`src/spicelib/devices/dio/dioload.c`,
`diotemp.c`, `src/spicelib/devices/devsup.c`) so that the model and its oracle solve the very same equations. A
diode is a series resistance RS from the anode to a node of its own, the junction, and the junction from there to
the cathode. The junction takes

| Region | Current |
|---|---|
| forward and slightly reverse, v ≥ −3·N·Vt | IS·(e^(v/(N·Vt)) − 1) |
| reverse, down to the knee | −IS·(1 + (3·N·Vt / (e·v))³) — SPICE's cubic; it meets the first at −3·N·Vt |
| breakdown, v < −knee | −IS·e^(−(knee + v)/(N·Vt)) |

and, as in every SPICE, `GMIN` = 1e-12 S across it (so a diode the wrong way round on 9 V lets IS + 9 pA through).
`THERMAL_VOLTAGE` Vt = kT/q at `ROOM_KELVIN` = 300.15 K (27 °C, SPICE's TNOM) with ngspice's constants k =
1.38064852e-23 J/K and q = 1.6021766208e-19 C: 25.865 mV. The knee is BV moved down until the junction takes IBV at
−BV, by the fixed-point iteration of `diotemp.c` (to 1e-3 of IBV): 1N4148 99.525 V, 1N4007 1099.05 V, the red LED
18.56 V, the blue 17.79 V. No temperature dependence: the model's room is SPICE's 27 °C.

Newton's iterations limit the step of the junction voltage as ngspice's `DEVpnjlim` does (`pnjlim`): above
`vcrit` = N·Vt·ln(N·Vt / (√2·IS)) a rise of more than 2·N·Vt becomes logarithmic, and a fall below zero goes at most
to −v − 1 from a forward voltage v or to 2·v − 1 from a reverse one (around the knee in breakdown). Without it an
exponential overshoots by orders of magnitude from a poor guess. When the iterations still do not settle (in
`maxIterations`), the sources are stepped up from zero — first a quarter of their voltage, the step doubling while
each settles from the last and quartering when one does not — down to steps of 1e-6.

The iterations have settled when no unknown moved by more than 1e-9 of itself plus 1e-12 (V or A), or when two
iterations in a row moved no more than SPICE allows by default (1e-3 of the value plus 1 μV for a voltage, plus
1 pA for a current); in both cases no junction may have limited its step. The second rule is for nodes that
nothing but GMIN holds — diodes the wrong way round in series: next to a series resistance of 0.04 Ω, a conductance
of 1e-12 S lets the rounding of the solve move such a node by millivolts, and a tighter rule would never be met
there. Elsewhere Newton's quadratic convergence has by the second such iteration taken the step to about 1e-6 of
the value and the solution to about 1e-12. Every sample of the oracle settles in 6–8 iterations from cold, an LED
or a diode straight on the 9 V battery in 6–7, the lamp in 4. A junction with no path for current (a leg in the
air) starts at its knee and comes down one N·Vt per iteration, as in SPICE: about 30 iterations.

`forwardVoltage(params, amps)` is the voltage across the part at a forward current; `junctionOf`,
`junctionCurrent`, `pnjlim`, `limitJunction` are the pieces above.

**1N4148.** LTspice's `standard.dio`: `.model 1N4148 D(Is=2.52n Rs=.568 N=1.752 Cjo=4p M=.4 tt=20n Iave=200m
Vpk=75 mfg=OnSemi type=silicon)` (read from the copy in github.com/evenator/LTSpice-Libraries, `cmp/standard.dio`, on
20.11.2026). The line has no breakdown; BV 100 V and IBV 100 μA are the onsemi datasheet's (1N91x, 1N4x48 — 1N914/D
Rev. 6, September 2024: «Breakdown Voltage, IR = 100 μA: 100 V min»). The limits from the same datasheet: DC forward
current 300 mA, VRRM 100 V. The model gives 0.694 V at 10 mA (the datasheet: 1.0 V at most) and 2.5 nA the wrong way
round (25 nA at most at 20 V).

**1N4007.** Vishay's SPICE model (vishay.com/docs/89789/1n4007.txt, Thomatronik GmbH, SPICE3): `.model d1n4007 d is =
1.43733E-008 n = 1.80829 rs = 0.0414712 … bv = 1100 ibv = 10`. The limits: Vishay 1N4001 … 1N4007, document 88503,
revision 29.04.2020 — IF(AV) 1.0 A, VRRM 1000 V; VF 1.1 V at 1 A at most, the model gives 0.886 V. (A model with
`Is=7.02767n Rs=0.0341512 N=1.80803` circulates as well; its source could not be traced, so the maker's own was
taken.) CJO, TT and the rest of both lines are for the transient (E1-5): DC does not read them.

**LEDs.** No maker publishes SPICE models of generic 5 mm indicator LEDs, so they are fitted (the decision of this
task) to the plan's forward voltage at 20 mA: N and RS by the chip's family — N 2 and RS 6 Ω for the classic
GaAsP/GaP and GaP chips (red, yellow, green), N 3.5 and RS 10 Ω for InGaN (blue, and white, which is a blue chip under
a phosphor) — and IS so that the voltage at 20 mA falls in the middle of the window, IS = 20 mA / (e^((V − 20 mA·RS)
/ (N·Vt)) − 1), rounded to three digits:

| Key | IS | N | RS | V at 1 / 5 / 10 / 20 / 30 mA | Plan's window at 20 mA |
|---|---|---|---|---|---|
| `led-red` | 8.66e-18 A | 2 | 6 Ω | 1.681 / 1.788 / 1.854 / **1.950** / 2.031 V | 1.9–2.0 V |
| `led-yellow` | 1.25e-18 A | 2 | 6 Ω | 1.781 / 1.888 / 1.954 / **2.050** / 2.131 V | 2.0–2.1 V |
| `led-green` | 1.81e-19 A | 2 | 6 Ω | 1.881 / 1.988 / 2.054 / **2.150** / 2.231 V | 2.1–2.2 V |
| `led-blue`, `led-white` | 2.45e-16 A | 3.5 | 10 Ω | 2.639 / 2.824 / 2.937 / **3.100** / 3.237 V | 3.0–3.2 V |

The shape agrees with a maker's curves: Kingbright's WP7113 series gives 1.9 / 1.95 / 2.0 V typical at 10 mA for
its red, yellow and green (the model: 1.85 / 1.95 / 2.05 V). Every LED: rated 20 mA (`ratedA`), at most 30 mA (the
plan; Kingbright's GaP green allows 25 mA), and a breakdown at BV 20 V with IBV 10 μA — datasheets only promise
5 V the wrong way round (at most 10 μA there; the model lets 5 pA through), real chips break down well above that,
and 20 V keeps every battery of the bench (9 V at most) short of it. The LEDs are fitted, so their oracle checks the
solver, and the windows check the numbers.

**Light** is proportional to the forward current: `ledLumens(spec, amps)` = amps × `lumensPerAmp`, nothing the
wrong way round. The yield of each colour comes from Kingbright's 5 mm WP7113 datasheets (read 20.11.2026): the
typical luminous intensity at its test current, spread over the beam as Φ ≈ I·2π(1 − cos θ½) — a rough estimate
that only sets the colours against each other:

| Key | Kingbright part | Typical intensity | Viewing angle 2θ½ | `lumensPerAmp` |
|---|---|---|---|---|
| `led-red` | WP7113ID, GaAsP/GaP, red diffused | 40 mcd at 10 mA (CIE 127-2007) | 30° | 0.86 lm/A |
| `led-yellow` | WP7113YD, GaAsP/GaP, yellow diffused | 25 mcd at 10 mA | 30° | 0.54 lm/A |
| `led-green` | WP7113GD, GaP, green diffused | 30 mcd at 10 mA | 30° | 0.64 lm/A |
| `led-blue` | WP7113QBC/D, InGaN, water clear | 4500 mcd at 20 mA | 20° | 21 lm/A |
| `led-white` | WP7113QWC/D, InGaN, water clear | 3600 mcd at 20 mA | 20° | 17 lm/A |

The classic chips are some twenty to thirty times dimmer than InGaN at the same current; a stand that wants every
colour readable scales them as it likes, but the order holds.

## The lamp (`lamp.ts`)

A tungsten filament whose resistance grows with its temperature, R(T) = R_cold·(T / T0)^α with T0 = 300.15 K and
`TUNGSTEN_EXPONENT` α = 1.21, and which loses its heat by radiation alone, K·(T⁴ − T0⁴). α fits the resistivity of
tungsten — the table that hypertextbook.com quotes in «Resistivity of Tungsten» from T. W. Zerda, «Stefan Boltzmann
Law» (Texas Christian University, 2001): 5.65 μΩ·cm at 300 K, 24.93 at 1000 K, 56.67 at 2000 K, 73.91 at 2500 K,
92.04 at 3000 K — within 2.7 % from 300 to 3000 K and within 1 % above 2000 K.

The plan's lamp: 6 V · 0.1 A, so 60 Ω hot. The cold filament is 5.5 Ω (the decision of this task: 10.9 times less,
in the plan's 10–12). Then the hot filament is at T_hot = T0·(60 / 5.5)^(1/α) = 2163 K — a small low-power lamp —
and K = 0.6 W / (T_hot⁴ − T0⁴).

At the operating point the filament is steady: what it takes, V²/R(T), is what it radiates. `filament(spec, volts)`
finds that temperature (Newton's method held by bisection) and gives `{ kelvin, ohms, amps, watts }`; the circuit's
Newton iterations linearize this steady lamp like a diode (`lampBehaviour`), and every good solve writes the
temperature into the state. The steady lamp follows the classic law of incandescent lamps, the current about as
V^0.55, the power as V^1.55:

| Volts | 0.06 | 0.6 | 1.5 | 3 | 4.5 | 6 | 6.6 | 9 |
|---|---|---|---|---|---|---|---|---|
| Kelvin | 398 | 896 | 1271 | 1658 | 1937 | 2163 | 2243 | 2527 |
| Ohms | 7.7 | 20.6 | 31.5 | 43.5 | 52.5 | 60 | 62.7 | 72.4 |
| Milliamperes | 7.8 | 29.1 | 47.6 | 69.0 | 85.7 | 100 | 105.2 | 124.3 |
| Watts | 0.0005 | 0.017 | 0.071 | 0.207 | 0.386 | 0.600 | 0.695 | 1.118 |

From four AA cells (6 V behind 0.6 Ω) the lamp takes 99.5 mA; from two AA cells in series (3 V) 68.7 mA and 0.205 W,
a third of the power at 6 V. Radiation alone is a simplification that shows at low voltages: near room temperature
a filament radiates little, so the model's filament warms easily there (by 0.2 K at 1 mV, to 398 K at 60 mV), where
a real one also loses heat through its leads. An ohmmeter's small current still reads the cold 5.5 Ω (5.54 Ω at 1 mA).

**The thermal time constant** (`tauS`, the decision of this task: 50 ms, the lower end of the plan's 50–100 ms) is
for the transient (E1-5): C·dT/dt = V²/R(T) − K·(T⁴ − T0⁴) with C = `tauS`·4·K·T_hot³, so that a small change about
the hot filament settles with `tauS`. An estimate: a straight tungsten wire that is 60 Ω and radiates 0.6 W at
2160 K (emissivity ≈ 0.26) is about 20 μm thick and 30 mm long, 0.18 mg; with 0.16 J/(g·K) that gives
C ≈ 2.9e-5 J/K against 4·0.6 W / 2160 K ≈ 1.1e-3 W/K, about 26 ms. A real filament is a coil, which hides part of its
surface from radiating and so needs more wire for the same power, and it sits on supports: twice the estimate is
the plan's lower end.

**The limit** is 0.7 W, the power at 110 % of the rated voltage (0.695 W): a lamp maker's usual margin. At 6 V the
lamp is `warm` (load 0.86) and lives for ever; from the 9 V battery it takes 1.08 W (load 1.55), is `hot`, and burns
out after 2.1 s. That is a compression: a real lamp at 150 % of its voltage lives hours, not seconds — its life falls
as about the twelfth power of the voltage. The documents should not present those seconds as real.

## Limits (`limits.ts`)

**The load** (`loadOf(spec, reading)`) is the share of its limit a part is under: the largest of |p| / `powerW`,
|i| / `currentA` and (−u) / `reverseV`, of the limits the part has. Resistors, the pot (its whole track), the
speaker, the earphone and the lamp have a power; LEDs, diodes and batteries a current; diodes a reverse voltage too.
The ideal sources, the switch and the jumper have none.

**The condition** (`conditionOf(load, burnt)`): `'ok'` up to half the limit (`WARM_LOAD` 0.5), `'warm'` above it,
`'hot'` above the limit, `'burnt'` once the part burnt. The red LED with 330 Ω from 9 V is warm (21.2 mA, load
0.71), and so is its resistor (0.149 W, load 0.60).

**Heat** (the decision of this task, a simple accumulation): a part warms toward its load as a body warms to its
steady temperature, dH/dt = (load − H) / τ, so H is how warm it is as a share of its limit. `heatStep(H, load,
seconds, τ)` is the exact step for a steady load. A part that can burn (`canBurn`: every part with limits but a
battery) burns when H reaches 1: never at a load up to 1, after `burnSeconds(load, τ)` = τ·ln(load / (load − 1))
from cold above it — quickly far over the limit, slowly just over it. The time constants (`HEAT_SECONDS`, the
decision of this task):

| Kind | τ | For example |
|---|---|---|
| `resistor`, `pot`, `speaker` | 10 s | a 0.25 W resistor at 0.2 W never burns; at 1 W (75 Ω on the 9 V battery, 1.04 W) it burns after 2.8 s |
| `led` | 2 s | an LED straight on the 9 V battery takes 0.93 A (red) or 0.51 A (blue) and burns after 0.07 or 0.12 s: a flash |
| `diode` | 5 s | 1N4148 straight on the 9 V battery takes 3.9 A and burns after 0.4 s; 1N4007 5.2 A, 1.1 s |
| `lamp` | 2 s | the 6 V lamp on the 9 V battery: 2.1 s |
| `battery` | 2 s | a short warms the battery to its load (6 for the 9 V one) in a few seconds; it never burns |

`advanceHeat(state, net, dc, seconds)` lets model time pass at an operating point: every limited part of the board
moves its heat toward its load in `dc.status`, a part that reaches 1 burns, and the ids of the parts that burnt now
come back. The next solve with the state leaves them out — a burnt resistor, LED, diode or lamp is a gap (its
reading is the voltage across the gap, no current). In the operating point the stand calls it once a frame with the
frame's time; the transient (E1-5) runs the same step in its own time. Time runs forward: a negative or infinite
step is a `RangeError`.

## Modules

| Module | What it does |
|---|---|
| `netlist.ts` | `Netlist`, `PartInstance`, `GROUND`; `checkNetlist` and `checkSetting` (the `RangeError`s above) |
| `parts.ts` | The catalog `PARTS`, `E12`, `E24`, `resistorKey`, `WIRE_OHMS`; the types of the parts (`PartSpec`, one interface per kind, `JunctionParams`, `Limits`); `Behaviour`, `Placement`, `Operating`; `behaviour(spec)` — how a kind of part sits in the matrix |
| `mna.ts` | The dense LU with partial pivoting (`createSystem`, `factor`, `solveFactored`); `compile` (unknowns: the nodes in use, the parts' own nodes, then the currents of the parts that need one; the parts' memory; the scratch of the iterations); the `Stamper` the parts write with; `assemble` (clear, stamp every part around a guess, leave the burnt ones out, tie) |
| `topology.ts` | `analyse` — the issues and the nodes to tie, by union–find over the links of the parts (a burnt part has none) |
| `dc.ts` | `solveDC` — one solve, or Newton's iterations with source stepping — `DcSolution`, `PartReading`, `DcOptions`, `MAX_ITERATIONS` |
| `diode.ts` | SPICE's junction: `ROOM_KELVIN`, `THERMAL_VOLTAGE`, `GMIN`, `junctionOf`, `junctionCurrent`, `pnjlim`, `limitJunction`, `forwardVoltage`, `ledLumens`, `diodeBehaviour` |
| `lamp.ts` | The tungsten filament: `TUNGSTEN_EXPONENT`, `filament`, `lampBehaviour` |
| `limits.ts` | `loadOf`, `conditionOf`, `WARM_LOAD`, `HEAT_SECONDS`, `heatStep`, `burnSeconds`, `canBurn`, `advanceHeat`; `Condition`, `PartStatus` |
| `state.ts` | `ModelState`, `PartMemory`, `createModelState`, `memoryOf` |
| `index.ts` | the public entry |

## Adding a kind of part (E1-5, E1-6)

A kind is four things:

1. its spec interface in `parts.ts`, added to the union `PartSpec`, and its entries in `PARTS`;
2. a `Behaviour` (`parts.ts` for a linear kind, a module of its own for a nonlinear one, as `diode.ts` and
   `lamp.ts`) and one more `case` in `behaviour(spec)`;
3. its limits and, if it has any, its time constant in `HEAT_SECONDS` (`limits.ts`);
4. its numbers in the oracle's own catalog (`tools/ref-models/electronics/spice.py`) and its cases in `cases.py`.

A `Behaviour` says how many current unknowns the part adds (`branches`: an ideal source has one), how many nodes of
its own (`inner`: a diode with RS has its junction), how many numbers it keeps between iterations (`memory`), whether
it is nonlinear (then the operating point takes Newton's iterations), whether it is a source (`open` and `short`
are checked for sources), which pins conduct direct current at a setting (`links`), whether it is a wire at a
setting (`wire`), how its memory starts a solve (`start`), its stamp, and the currents into its pins from a solution
(`currents`). The stamp writes through the `Stamper` — `conductance(a, b, g)`, `current(a, b, i)` (a current through
the part from node `a` to node `b`), `voltage(plus, minus, branch, volts)` — by node numbers, the part's own nodes
(`at.inner`) too, around the guess `op: Operating`: the node voltages `op.v`, the share `op.sources` a source gives
(it multiplies its voltage by it), `op.initial` (the first iteration from nothing: a junction linearizes at its
memory) and `op.limited` (a part that limited its step sets it: the iterations go on). A nonlinear part stamps its
linearization: its slope as a conductance and the current that makes up the rest. The transient (E1-5) adds the
time step and the parts' state in time to the same guess.

## Tests

```bash
cd app && pnpm vitest run src/volumes/electronics/sim                                 # the whole model
python3 tools/ref-models/electronics/spice.py --check                                 # are the samples fresh?
```

`__tests__/`: `purity` (the text of every file), `parts` (the catalog, the published diodes, the fitted LEDs), `mna`
(the LU and the stamps), `dc` (linear circuits by hand: a divider, the batteries under load, a grid of five
resistors, the pot at 0 / 0.5 / 1, a switch, the speaker; the worked example above; a singular circuit; the state;
malformed netlists), `topology` (open, short, floating — a pot's free wiper among them — ungrounded), `diode` (the
junction against SPICE's formulas in every region, the knee, `pnjlim`; the LEDs' windows and light; an LED of each
colour with 330 Ω from 9 V against ngspice — 21.24 mA red, 20.94 yellow, 20.65 green, 17.89 blue and white —
within ± 3 %; an LED without a resistor: hot, burnt in under a second, then no current; diodes the wrong way round
under 1 μA; 1N4148 at 10 mA against ngspice within ± 2 %; warm starts, source stepping, odd boards — a leg in the
air, LEDs back to back, reversed diodes in series — and `no-convergence`), `lamp`
(the catalog, 0.1 A at 6 V, the steady filament against a bisection by hand at nine voltages, the lamp's law, 0.1 A
± 2 % from four AA cells, less than half the power from 3 V, the state's temperature, the lamp's limit), `limits`
(conditions, loads, the limits of the catalog, heat in time, the 0.25 W resistor at 0.2 W for an hour and at 1 W,
a burnt part as a gap, a shorted battery, two stands), `oracle` (every sample of `__fixtures__/` against the model:
relative difference ≤ 1e-6 for the linear samples and ≤ 1e-3 for the nonlinear ones — the plan's tolerances — for
every number, the smallest too, with no absolute allowance; where ngspice gives an exact zero — the ground, a part
behind an open switch — the model must give an exact zero; at most 50 iterations and no source steps).
The samples are written by `tools/ref-models/electronics/spice.py` from `cases.py` (its README); the model and ngspice
agree on them to 4e-10 for the linear ones, the rounding of the samples, and to 1.6e-8 for the nonlinear ones, the
tolerance to which both sides settle.
