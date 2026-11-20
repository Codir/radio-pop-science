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
how its heat gathers, and when it burns. E1-5 adds time: capacitors of three kinds, the transient (`Transient`) with
a fixed step, a lamp whose filament warms in time, parts that burn (and electrolytic capacitors that bulge) in time,
and a sine source for the oracle. Transistors and the amplifier come with E1-6.

## Units and conventions

- **SI everywhere:** V, A, Ω, W, F, s, Hz. No prefixes in numbers: 4.7 kΩ is `4700`, 100 nF is `100e-9`.
- **Node 0 is the ground.** Nodes are numbered by the board, `0 … nodes − 1`; a node that no pin uses costs nothing
  (it is left out of the matrix and reads 0 V), so the board may give every row of its sockets a number.
- **Pins** of a part come in the order of the catalog (`PARTS[key].pins`): `['plus', 'minus']`, `['a', 'b']`,
  `['ccw', 'wiper', 'cw']`, `['anode', 'cathode']`. An electrolytic capacitor has `['plus', 'minus']`, a ceramic or
  film one `['a', 'b']`.
- **Readings** (`PartReading`): `u` — the voltage from the first pin to the second; `i` — the current into the part
  through its first pin; `p` — the power the part takes, the sum over its pins of voltage × current into the pin.
  A resistor has `p = u·i > 0`. A battery that feeds a circuit has the current coming *out* of its plus pin, so its
  `i` and `p` are negative: a 9 V battery on 100 Ω reads `u` 8.867 V, `i` −88.67 mA, `p` −0.786 W. A diode or an
  LED reads from anode to cathode: forward, `u` and `i` are positive. A meter on the stand shows the magnitude; the
  sign says which way the current goes.
- **Settings** (`PartInstance.setting`): a pot — the share of its track from `ccw` to the wiper, 0…1 (0 is the knob
  turned fully counter-clockwise; 0.5 when absent; outside 0…1 it is held to the range). A switch — 0 open, 1
  closed (from 0.5 up counts as closed; open when absent). A sine source — its frequency in Hz (its catalog `hz` when
  absent, never below 0). Other parts ignore it.
- **A capacitor's reading:** `i` is the current into its first pin — what flows through its ESR, the leak's and the
  capacitance's together; `u` is the voltage on its pins, the ESR's drop included; `p` is `u·i`, positive while it
  charges. Its charge is in the state (`volts`, the voltage across the capacitance alone).

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

`solveDC(net | circuit, { state?, maxIterations?, time? }) → DcSolution` (`time`: the moment whose sources it holds
steady — a sine gives its value then; 0 when absent, where a sine gives 0 V; a capacitor is open but for its leak):

| Field | What it is |
|---|---|
| `ok` | `true` when the circuit has a single solution and the model found it |
| `reason` | when `ok` is false: `'singular'` — the matrix has no single solution (two ideal sources side by side, an ideal source with both pins in one row); `'no-convergence'` — Newton's iterations did not settle, not even with the sources stepped up from zero. Never an exception, never `NaN`: `v` and every reading are then zeros |
| `v` | `Float64Array` of node voltages by node number |
| `parts` | `{ [id]: { u, i, p } }` for every part; a burnt part reads `i` 0 and `p` 0 and the voltage across its gap, a bulged capacitor what its leak of 1 kΩ carries |
| `status` | `{ [id]: { condition, load } }` for every part: `'ok'`, `'warm'`, `'hot'`, `'burnt'` or `'bulged'`, and the share of its limit it is under (see Limits) |
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
| `bulged` | an electrolytic capacitor bulged: every later solve with this state takes it as a leak of 1 kΩ without capacitance (see Capacitors); nothing mends it either |
| `kelvin` | a lamp: its filament's temperature, written by every good solve (the steady one; room temperature when dark or burnt) and by every step of the transient |
| `volts` | a capacitor: the voltage across its capacitance — its charge over its capacitance — written by every good solve (charged: its steady voltage) and by every step of the transient; 0 once it bulged |

`levelOf(memory, kind, otherwise)` and `keepLevel(memory, kind, level)` read and write a part's level: `volts` of a
capacitor, `kelvin` of a lamp.

**Where Newton's iterations start.** A compiled circuit solved before starts from its own last solution, its
junctions too: a stand that compiles once and solves on every turn of a knob settles in two or three iterations
(the red LED with 330 Ω: 5 iterations from cold, 2 again). Otherwise every junction starts at its knee of
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
| `ideal-ac-6v` | `sine` | plus, minus | 6 V amplitude, 50 Hz unless its setting gives another frequency, no internal resistance | — | the plan's sine for the rectifier (batch E1, task E1-5), and the generator of the filters' tests; the reference of the oracle in time — the bench never offers it: the safe adapter of the rectifier's branch (the design §3.4) is the decision of the task that builds that branch |
| `resistor-<code>` | `resistor` | a, b | every value of E24 from 1 Ω to 9.1 MΩ, and 10 MΩ: 169 parts; `series` E12 or E24; `tolerance` 0.05 | 0.25 W | values: IEC 60063 (E12, E24); key: the letter code of IEC 60062; 0.25 W and 5 % (gold band): the usual through-hole resistor of the kits, the design §5.2 |
| `pot-10k` | `pot` | ccw, wiper, cw | a linear track of 10 kΩ; each part of the track at least 1 mΩ | 0.2 W | Bourns PDB181 series, for example PDB181-K420K-103B: 10 kΩ, linear, 0.2 W (Digi-Key listing; datasheet bourns.com «PDB18») |
| `switch` | `switch` | a, b | open: no path; closed: 1 mΩ | — | the decision of this task (below) |
| `jumper` | `jumper` | a, b | 1 mΩ | — | the same |
| `speaker-8` | `speaker` | plus, minus | 8 Ω | 2 W | a 50 mm speaker such as Visaton K 50 WP 8 Ω: 2 W rated, 3 W maximum |
| `earphone-32` | `speaker` | plus, minus | 32 Ω | 0.1 W | a 32 Ω headphone such as beyerdynamic DT 770 PRO 32 Ω: 100 mW rated power handling (IEC 60268-7) |
| `diode-1n4148` | `diode` | anode, cathode | IS 4.352 nA, N 1.906, RS 0.6458 Ω, BV 110 V, IBV 100 μA; a leak of 5.827 GΩ across the part (`leakOhms`) | 0.2 A; 100 V reverse | Nexperia's SPICE model and datasheet, below |
| `diode-1n4007` | `diode` | anode, cathode | IS 14.3733 nA, N 1.80829, RS 41.4712 mΩ, BV 1100 V, IBV 10 A | 1 A; 1000 V reverse | Vishay's SPICE model and datasheet, below |
| `led-red`, `led-yellow`, `led-green`, `led-blue`, `led-white` | `led` | anode, cathode | fitted to the plan's forward voltage at 20 mA (below); BV 20 V, IBV 10 μA; rated 20 mA; `lumensPerAmp` | 30 mA | the plan's windows and limits; the light: Kingbright's datasheets, below |
| `lamp-6v` | `lamp` | a, b | 6 V · 0.1 A (60 Ω hot), cold 5.5 Ω, thermal time constant 50 ms | 0.7 W | the plan's decision and the choices below |
| `ceramic-100p`, `ceramic-1n`, `ceramic-10n`, `ceramic-100n` | `capacitor` | a, b | 100 pF, 1 nF (C0G), 10 nF, 100 nF (X7R); ESR 0.03 Ω; leak 10 GΩ | 50 V either way | the plan's values; the numbers: Capacitors, below |
| `film-100n`, `film-1u` | `capacitor` | a, b | 100 nF, 1 μF polyester; ESR 0.03 Ω; leak 10 GΩ and 1.25 GΩ | 63 V either way | WIMA MKS 2, below |
| `electrolytic-1u-16v` … `electrolytic-1000u-16v` (1, 10, 100, 470, 1000 μF), `electrolytic-100u-6v3` | `capacitor` | plus, minus | ESR from tan δ, leak from the leakage current: the table below | the rated voltage; 1 V the wrong way round | Nichicon VR and Vishay 048 RML, below |

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
the cathode; when the maker's model has one, a resistance across the whole part (`leakOhms`) carries the leakage
the wrong way round. The junction takes

| Region | Current |
|---|---|
| forward and slightly reverse, v ≥ −3·N·Vt | IS·(e^(v/(N·Vt)) − 1) |
| reverse, down to the knee | −IS·(1 + (3·N·Vt / (e·v))³) — SPICE's cubic; it meets the first at −3·N·Vt |
| breakdown, v < −knee | −IS·e^(−(knee + v)/(N·Vt)) |

and, as in every SPICE, `GMIN` = 1e-12 S across it (so a diode the wrong way round on 9 V lets IS + 9 pA through,
and what its leak takes).
`THERMAL_VOLTAGE` Vt = kT/q at `ROOM_KELVIN` = 300.15 K (27 °C, SPICE's TNOM) with ngspice's constants k =
1.38064852e-23 J/K and q = 1.6021766208e-19 C: 25.865 mV. The knee is BV moved down until the junction takes IBV at
−BV, by the fixed-point iteration of `diotemp.c` (to 1e-3 of IBV): 1N4148 109.515 V, 1N4007 1099.05 V, the red LED
18.56 V, the blue 17.79 V. No temperature dependence: the model's room is SPICE's 27 °C.

Newton's iterations limit the step of the junction voltage as ngspice's `DEVpnjlim` does (`pnjlim`): above
`vcrit` = N·Vt·ln(N·Vt / (√2·IS)) a rise of more than 2·N·Vt becomes logarithmic, and a fall below zero goes at most
to −v − 1 from a forward voltage v or to 2·v − 1 from a reverse one (around the knee in breakdown). Without it an
exponential overshoots by orders of magnitude from a poor guess. When the iterations still do not settle (in
`maxIterations`), the sources are stepped up from zero — first a quarter of their voltage, the step doubling while
each settles from the last and quartering when one does not — down to steps of 1e-6.

The iterations have settled, when no junction limited its step and the iteration did not start from nothing,
in one of three ways:

- **exact:** no unknown moved by more than 1e-9 of itself plus 1e-12 (V or A);
- **quiet:** the guess already satisfies the matrix linearized around it to the rounding — what is left of the rows
  at the guess is at most 16 machine epsilons (16 · 2.2e-16) of the largest row's terms, the backward error of the
  guess — and no voltage moved by more than SPICE's tolerance of the circuit's largest voltage (1e-3 of it plus
  1 μV), no current by more than 1e-3 of itself plus 1 pA;
- **noise:** a go of `maxIterations` ends with its last 20 iterations all quiet.

The last two are for a group of nodes that nothing but GMIN (1e-12 S) or the tie (1 GΩ) holds to the rest: a pair of
nodes off the ground row with 4 A flowing round them, an open loop of a cell, an LED and a lamp with a leg in the air
(the cell's Norton source carries 10 A inside the loop), reversed diodes in series. The rounding of those amperes
moves the potential of such a group at every solve — by microvolts against the tie, by millivolts against GMIN, by
tenths of a volt when a 1 mΩ jumper sits inside it — so its own step never shrinks, and a rule on the step alone
would never be met. Everything else settles to the rounding all the same, and the backward error says so: the
readings of the parts (`u`, `i`, `p`) agree with the same board on the ground row to 1e-9 and better. Only the
potential of such a group against the ground keeps that noise — on a board it hangs in the air. The test throws
3000 random boards of up to six rows and seven parts of the catalog together (legs in the air, both legs in one row,
shorted cells, loops off the ground row): every one settles, all but one within 50 iterations — that one, with a
jumper inside such a group, in one go of 100 by the noise rule.

Every sample of the oracle settles in 7–9 iterations from cold, an LED or a diode straight on the 9 V battery in
7–8, the lamp in 4. A junction with no path for current (a leg in the air) starts at its knee and comes down one
N·Vt per iteration, as in SPICE: about 30 iterations.

`forwardVoltage(params, amps)` is the voltage across the part at a forward current; `junctionOf`,
`junctionCurrent`, `pnjlim`, `limitJunction` are the pieces above.

**1N4148.** Nexperia's SPICE model (Nexperia is the former NXP standard-products business, Philips before it):
assets.nexperia.com/documents/spice-model/1N4148.txt, titled «1N4148 Nexperia High-speed diodes IFmax = 200mA VRmax
= 100V». It is a subcircuit — `.SUBCKT 1N4148 1 2`, `R1 1 2 5.827E+9`, `D1 1 2 1N4148`, `.MODEL 1N4148 D IS =
4.352E-9 N = 1.906 BV = 110 IBV = 0.0001 RS = 0.6458 CJO = 7.048E-13 VJ = 0.869 M = 0.03 FC = 0.5 TT = 3.48E-9` —
and its comment says of R1: «The resistor R1 does not reflect a physical device. Instead it improves modeling in
the reverse mode of operation.» The catalog takes R1 as `leakOhms`. Nexperia's server refused this machine (HTTP 403
from its CDN on 20.11.2026), so the text was read from the verbatim copy of NXP's `1N4148.prm` (its header: «NXP
Semiconductors, High-speed diodes, VRRM = 100V, IFRM = 450 mA, trr = 4ns») in the PySpice repository
(github.com/FabriceSalvaire/PySpice, `examples/libraries/diode/switching/1N4148.lib`); a web search of Nexperia's own
file shows the same numbers. The limits come from the maker's datasheet «1N4148; 1N4448 High-speed diodes» (NXP
product data sheet of 2004 Aug 10 under Nexperia's cover of February 2017, read from Digi-Key's copy): IF 200 mA
continuous, VRRM 100 V. The model gives 0.729 V at 10 mA (the datasheet: 1 V at most) and, the wrong way round,
5.9 nA at 9 V and 7.8 nA at 20 V (the datasheet: 25 nA at most at 20 V).

**1N4007.** Vishay's SPICE model (vishay.com/docs/89789/1n4007.txt, Thomatronik GmbH, SPICE3): `.model d1n4007 d is =
1.43733E-008 n = 1.80829 rs = 0.0414712 … bv = 1100 ibv = 10`. The limits: Vishay 1N4001 … 1N4007, document 88503,
revision 29.04.2020 — IF(AV) 1.0 A, VRRM 1000 V; VF 1.1 V at 1 A at most, the model gives 0.886 V. (A model with
`Is=7.02767n Rs=0.0341512 N=1.80803` circulates as well; its source could not be traced, so the maker's own was
taken.) CJO, TT and the rest of both models — the junction's capacitance and the time its charge takes to leave —
the model does not take, in time either (the decision of E1-5), and the oracle's decks leave them out too: 0.7 pF and
3.5 ns of 1N4148 do nothing a step of 1/48000 s could show, and in a rectifier at 50 Hz 1N4007's recovery of a few
microseconds is a thousandth of its half period.

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

**The thermal time constant** (`tauS`, the decision of E1-4: 50 ms, the lower end of the plan's 50–100 ms) sets
the filament's heat capacity in time: C·dT/dt = V²/R(T) − K·(T⁴ − T0⁴) with C = `tauS`·4·K·T_hot³
(`filamentCapacity`: 5.55e-5 J/K), so that a small change about the hot filament settles with `tauS`. An estimate: a
straight tungsten wire that is 60 Ω and radiates 0.6 W at 2160 K (emissivity ≈ 0.26) is about 20 μm thick and 30 mm
long, 0.18 mg; with 0.16 J/(g·K) that gives C ≈ 2.9e-5 J/K against 4·0.6 W / 2160 K ≈ 1.1e-3 W/K, about 26 ms. A real
filament is a coil, which hides part of its surface from radiating and so needs more wire for the same power, and it
sits on supports: twice the estimate is the plan's lower end.

**In time** (E1-5) the filament's temperature is the lamp's history. Over a step h the temperature at its end solves
(a·T − base + K·(T⁴ − T0⁴))·R(T) = V², with a = C/h and base = a·T_last by backward Euler, a = 2C/h and base =
a·T_last + Q_last by the trapezoid (Q the heat the filament was gaining, V²/R − K·(T⁴ − T0⁴)) — the steady filament is
the same equation with a = base = 0, solved by the same Newton's method held by bisection. Newton's iterations of the
circuit linearize it the same way (its slope dI/dV through dT/dV). A filament never cools below the room: only a
trapezoid step far longer than its time constant could ask that, and then it stays at the room.

So a cold lamp switched on draws the current of its cold filament: four AA cells through the closed switch give it
0.980 A at once, 9.85 times its steady 99.5 mA; the filament is half way there in 3 ms (cold, it takes 6.5 W and has
little to radiate: it warms with a time constant of about 2 ms), and the current is 0.320 A after 10 ms, 0.144 A after
50 ms, and within 5 %, 2 % and 1 % of its steady value after 131, 167 and 194 ms — 2.6, 3.3 and 3.9 time constants
(the last part of the way goes a little faster than `tauS`: as the filament warms, the power it takes falls, which
helps it settle). The plan asks for an inrush of more than five times the steady current and a settling within 3–5
time constants: the test takes the 2 % band.

**The limit** is 0.7 W, the power at 110 % of the rated voltage (0.695 W): a lamp maker's usual margin. At 6 V the
lamp is `warm` (load 0.86) and lives for ever; from the 9 V battery it takes 1.08 W (load 1.55), is `hot`, and burns
out after 2.1 s. That is a compression: a real lamp at 150 % of its voltage lives hours, not seconds — its life falls
as about the twelfth power of the voltage. The documents should not present those seconds as real.

## Capacitors (`capacitor.ts`)

A capacitor is its capacitance C behind its equivalent series resistance (ESR) — from the first pin to a node of its
own, the capacitance from there to the second pin — with a leak across the capacitance that carries its leakage
current. At the operating point the capacitance is open and what flows is the leak: 9 V through 10 kΩ into 100 μF
holds it at 8.965 V, the leak's 2.581 MΩ against the rest. Its `links` join its pins (the leak is a path for direct
current), so a capacitor never leaves a node in the air or a source open. In time, over a step h, the capacitance is
its companion — backward Euler: i = (C/h)·(v − v_last); the trapezoid: i = (2C/h)·(v − v_last) − i_last — and its
history is the voltage across the capacitance and the current through it at the last moment. Its current is read as
the leak's and the capacitance's (as SPICE reads a capacitor), which keeps a leakage current of a nanoampere to its
last digits where the ESR's drop would be the difference of two nearly equal voltages.

| Key | C | ESR | Leak | Rated | Leak × C |
|---|---|---|---|---|---|
| `ceramic-100p`, `ceramic-1n` (C0G), `ceramic-10n`, `ceramic-100n` (X7R) | 100 pF … 100 nF | 0.03 Ω | 10 GΩ | 50 V | ≤ 1000 s |
| `film-100n` | 100 nF | 0.03 Ω | 10 GΩ | 63 V | 1000 s |
| `film-1u` | 1 μF | 0.03 Ω | 1.25 GΩ | 63 V | 1250 s |
| `electrolytic-1u-16v` | 1 μF | 265.3 Ω | 5.277 MΩ | 16 V | 5.3 s |
| `electrolytic-10u-16v` | 10 μF | 26.53 Ω | 4.819 MΩ | 16 V | 48 s |
| `electrolytic-100u-16v` | 100 μF | 2.653 Ω | 2.581 MΩ | 16 V | 258 s |
| `electrolytic-470u-16v` | 470 μF | 0.5644 Ω | 886.9 kΩ | 16 V | 417 s |
| `electrolytic-1000u-16v` | 1000 μF | 0.2653 Ω | 457.1 kΩ | 16 V | 457 s |
| `electrolytic-100u-6v3` | 100 μF | 3.714 Ω | 1.479 MΩ | 6.3 V | 148 s |

**Electrolytic** (aluminium, wet electrolyte; the sources read 20.11.2026). The ESR is the one the makers derive from
the dissipation factor, ESR = tan δ / (2π·f·C) — Vishay BCcomponents, «048 RML, Aluminum Capacitors Radial Miniature
Long Life», document 28318, revision 15-Oct-03, «Equivalent series resistance (ESR): calculated from tan δmax and C_R:
ESR = tan δ / 2πfC_R» — with tan δ at 120 Hz of a general-purpose series that has every value of the catalog,
Nichicon's VR (85 °C, 6.3 … 450 V, 0.1 … 33 000 μF; datasheet read from a distributor's copy): 0.20 at 16 V, 0.28 at
6.3 V, rounded to four digits. The leak is the rated voltage over the leakage current Vishay's 048 RML allows after 5
minutes at the rated voltage, I_L5 ≤ 0.002·C_R·U_R + 3 μA (C in μF, U in V) — the long-term figure, as a part on the
bench has been at its voltage for minutes; after 1 minute the makers allow more (048 RML: 0.01·C·U + 3 μA, three times
as much for 100 μF on 16 V; VR: 0.03·C·U or 4 μA, eight times). Both are maxima — a good part leaks less — and the
leakage of a real one grows faster than its voltage near the rating; the model keeps a plain resistance (the decision
of E1-5). The plan's RC circuit, 9 V → 10 kΩ → 100 μF, then reaches 63.10 % of 9 V after R·C = 1 s (63.21 % for a
bare R·C), and the same 100 μF charged to 9 V is at 36.65 % of it after 1 s through 10 kΩ (36.79 %). The limits: the rated voltage either way and 1 V the wrong way round,
048 RML's «Reverse voltage U_rev ≤ 1 V» and the plan's numbers.

**Ceramic** — 50 V, the usual rating of the through-hole parts of a kit; C0G for 100 pF and 1 nF, X7R for 10 and
100 nF (the model takes no voltage or temperature dependence of either). **Film** — WIMA MKS 2, metallised polyester
(PET) in 5 mm pitch, 63 V (WIMA's catalogue, page 34, edition 03.26): its insulation resistance at +20 °C, measured at
50 V for 63 V parts, is at least 1×10⁴ MΩ for C ≤ 0.33 μF and at least 1250 s (MΩ·μF) for 0.33 μF < C ≤ 4.7 μF — 10 GΩ
and 1.25 GΩ. The ceramic parts take the same 10 GΩ, the «10 000 MΩ» that the specifications of radial ceramic
capacitors commonly give (some cap the larger values by 100 or 500 MΩ·μF instead: 1 or 5 GΩ for 100 nF — on the
bench an open circuit either way); that is the decision of E1-5, not one maker's number. Their ESR, 0.03 Ω, is the
decision of E1-5 too: the resistance of the plates and the leads, the order of the floor of the makers' impedance
curves near the self-resonance (MKS 2's curve for 0.1 μF bottoms out at a few hundredths of an ohm). The dielectric
loss, tan δ (MKS 2: ≤ 8·10⁻³ at 1 kHz; X7R typically ≤ 2.5 %), is an ESR that grows as the frequency falls; the model
does not take it — a constant ESR made of it would be tens of ohms at audio frequencies, where the real one is far less.

**Bulging** (the plan: an electrolytic over its rated voltage, or more than 1 V the wrong way round, is `hot` and in
time `bulged`; the decision of E1-5: what it becomes then). A bulged capacitor has vented: no capacitance is left, and
between its pins it is a leak of `BULGED_OHMS` = 1 kΩ — a gap with a large leak, a thousand times its healthy one (9 mA
on the 9 V battery). It keeps no charge (`volts` 0), stays `'bulged'` with load 0 and never heals; nothing in the
model makes smoke or a bang (the design §3.4). Its heat gathers as any part's with τ = 10 s (`HEAT_SECONDS.capacitor`,
the decision of E1-5: a compression, as for the lamp — a real electrolytic on 1.4 times its rating may take minutes to
vent): 100 μF / 6.3 V straight on the 9 V battery (load 1.43) bulges after 12.0 s, the wrong way round (load 9) after
1.2 s. The leakage of a real part grows steeply over its rating and the wrong way round, which is what heats it; the
model's leak stays the plain resistance above, and the load carries the overload instead. A ceramic or film capacitor
over its rating burns as any other part — a gap; on the bench (9 V at most against 50 V and 63 V) that never happens.

## Limits (`limits.ts`)

**The load** (`loadOf(spec, reading)`) is the share of its limit a part is under: the largest of |p| / `powerW`,
|i| / `currentA`, |u| / `voltageV` and (−u) / `reverseV`, of the limits the part has. Resistors, the pot (its whole
track), the speaker, the earphone and the lamp have a power; LEDs, diodes and batteries a current; diodes a reverse
voltage too; capacitors a voltage either way, an electrolytic a reverse voltage too. The ideal sources, the sine, the
switch and the jumper have none.

**The condition** (`conditionOf(load, damage)`): `'ok'` up to half the limit (`WARM_LOAD` 0.5), `'warm'` above it,
`'hot'` above the limit, `'burnt'` once the part burnt (`damage` true or `'burnt'`), `'bulged'` once an electrolytic
capacitor bulged. The red LED with 330 Ω from 9 V is warm (21.2 mA, load 0.71), and so is its resistor (0.149 W, load
0.60).

**Heat** (the decision of E1-4, a simple accumulation): a part warms toward its load as a body warms to its
steady temperature, dH/dt = (load − H) / τ, so H is how warm it is as a share of its limit. `heatStep(H, load,
seconds, τ)` is the exact step for a steady load. A part that can burn (`canBurn`: every part with limits but a
battery) fails when H reaches 1: never at a load up to 1, after `burnSeconds(load, τ)` = τ·ln(load / (load − 1))
from cold above it — quickly far over the limit, slowly just over it. It burns, or, a polar capacitor, bulges
(`failureOf(spec)`; `fail(memory, failure)` marks it). The time constants (`HEAT_SECONDS`, the decisions of E1-4 and,
for the capacitors, of E1-5):

| Kind | τ | For example |
|---|---|---|
| `resistor`, `pot`, `speaker` | 10 s | a 0.25 W resistor at 0.2 W never burns; at 1 W (75 Ω on the 9 V battery, 1.04 W) it burns after 2.8 s |
| `capacitor` | 10 s | 100 μF / 6.3 V on the 9 V battery bulges after 12.0 s, the wrong way round after 1.2 s; on 16 V it is warm for ever |
| `led` | 2 s | an LED straight on the 9 V battery takes 0.93 A (red) or 0.51 A (blue) and burns after 0.07 or 0.12 s: a flash |
| `diode` | 5 s | 1N4148 straight on the 9 V battery takes 3.7 A and burns after 0.28 s; 1N4007 5.2 A, 1.1 s |
| `lamp` | 2 s | the 6 V lamp on the 9 V battery: 2.1 s |
| `battery` | 2 s | a short warms the battery to its load (6 for the 9 V one) in a few seconds; it never burns |

`advanceHeat(state, net, dc, seconds)` lets model time pass at an operating point: every limited part of the board
moves its heat toward its load in `dc.status`, a part that reaches 1 fails, and the ids of the parts that failed now
come back. The next solve with the state knows them — a burnt resistor, LED, diode or lamp is a gap (its reading is
the voltage across the gap, no current), a bulged capacitor a leak of 1 kΩ. In the operating point the stand calls it
once a frame with the frame's time. The transient takes the same step at every step of its own, with the load of that
moment: in time the heat is the load filtered by τ, so a part takes the mean of a load that swings faster than τ (a
rectifier's diode, at 50 Hz, its mean current). Time runs forward: a negative or infinite step is a `RangeError`.

## The transient (`transient.ts`)

```ts
import { createModelState, Transient, type Netlist } from '@electronics/sim/core';

// the 9 V battery through a switch and 10 kΩ into 100 μF
const board: Netlist = {
  nodes: 4,
  parts: [
    { id: 'B1', spec: 'battery-9v', pins: [1, 0] },
    { id: 'S1', spec: 'switch', pins: [1, 2], setting: 0 },
    { id: 'R1', spec: 'resistor-10k', pins: [2, 3] },
    { id: 'C1', spec: 'electrolytic-100u-16v', pins: [3, 0] },
  ],
};
const state = createModelState(); // one per stand, as for solveDC
const t = new Transient(board, { dt: 1 / 48000, state });
t.start('dc'); // the operating point: the switch open, the capacitor empty
t.issues; // [{ kind: 'open', part: 'B1' }]
t.set('S1', 1); // the reader closes the switch: the next step takes it
const trace = new Float32Array(2048);
t.run(2048, [{ node: 3, out: trace }]); // 2048 steps, the capacitor's voltage after each
t.time; // 0.04267 s: 2048 / 48000
t.parts.C1; // { u: 0.378, i: 0.000862, p: 0.000326 } — the ESR's 2.3 mV in u
t.status.R1; // { condition: 'ok', load: 0.0297 }
state.parts.get('C1')!.volts; // 0.3757 V across the capacitance, kept for the next board
```

`new Transient(net, { dt, substeps?, state?, maxIterations? })` compiles the board (a malformed netlist is the same
`RangeError` as for `solveDC`; a step that is not a finite number above 0 is one too, and so are `substeps` that are
not a whole number from 1). `dt` is the time between two samples; each step of `dt` is `substeps` steps of integration
of `dt / substeps` (1 when absent: one step of integration a sample; why a stand may want more — «What the trapezoid
answers» below). Then:

| Member | What it does |
|---|---|
| `start(from)` | begins time at 0: `'dc'` from the operating point (every capacitor charged, every filament steady — `solveDC` with the state), `'zero'` from nothing (every capacitor empty, every filament at room temperature, the nodes at 0 V: a board just switched on), `'state'` from the charges and temperatures the state holds (empty and cold for a part it does not know). False with `reason` when the operating point has no solution |
| `step()` | one step of `dt`, in `substeps` steps of integration; false with `ok` false and `reason` (`'singular'`, `'no-convergence'`) when a moment of it has no solution — the board then stays at its last moment (the steps of integration already taken are undone) and the next step tries again. Before `start` it throws |
| `run(steps, probes?)` | `steps` steps; after step k it writes every probe's sample into `out[k]`: `{ node, out }` the node's voltage, `{ part, out }` the current into the part's first pin. Returns how many steps succeeded. A probe of a node or part the board has not, or an array shorter than `steps`, is a `RangeError` before any step |
| `set(id, setting)` | a knob, a switch, a sine's frequency: writes the setting into the netlist (a stand may write `part.setting` itself too); the next step takes it |
| `rebuild(net)` | a new board (a part put in or taken out): compiles it and carries over, by node number and by id, the node voltages, every capacitor's charge and filament's temperature, heat and damage (all from the state), and the guess of Newton's iterations; time runs on; the readings are those of the next step. A new part in place of a burnt one: delete the old entry from the state (`state.parts.delete(id)`), then `rebuild` (or `start`) |
| `time`, `v`, `parts`, `status`, `issues` | the moment of the last step (s), the node voltages, `{ id: { u, i, p } }`, `{ id: { condition, load } }`, the shape of the board — the same objects at every step, updated in place (new ones after `rebuild`) |
| `dt`, `substeps` | the step and how many steps of integration make it, as given |
| `state`, `memory(id)` | the stand's memory — heat, damage, `volts` of a capacitor, `kelvin` of a lamp, node voltages — written after every step; `memory(id)` is the entry of one part (every part on the board has one) |
| `ok`, `reason` | how the last step (or the start) went |

**The step** (the plan: a fixed step, the trapezoid, backward Euler after a jump). A capacitor and a lamp keep their
history; at every step of integration they stamp the companion of the step from it, and the matrix gives the next
moment: one solve for a linear circuit, Newton's iterations of the operating point (`newton` of `dc.ts`, the same
stopping rules) from the solution of the last step for a nonlinear one — two to three iterations a step on the
oracle's circuits, five at most. The steps of integration go by the trapezoid; the first `EULER_STEPS` = 2 of them
after `start` and after any change on the board (a setting, `rebuild`, a part that burnt or bulged) by backward Euler.
With `substeps` the moments of the steps of integration are counted from the start, so a transient of `dt` in
`substeps` gives, at every sample, the very numbers (bit for bit) of a transient of `dt / substeps` at every
`substeps`-th step; the test checks this at 4. One step of Euler would not do
(the decision of E1-5, where the plan said «the step after a change»): a part much faster than the step — 1 nF behind
1 kΩ is R·C = 1 μs against 20.8 μs — is left 1/(1 + h/R·C) short of its jump by one step of Euler, 4.6 % there, and
the trapezoid swings that remainder from one side to the other, shrinking it by less than a fifth a step (× −0.825):
a ringing of 3.8 % of the jump. After two steps of Euler 0.21 % is left, and the swing that follows stays under 0.2 %
and dies out (the test switches exactly that circuit on). The second step of Euler costs nothing that shows: a step
of Euler leaves an error of (h/R·C)²/2 of the jump in a slow part, 0.7 mV of 9 V at 80 steps per R·C. A step of
integration whose iterations do not settle is taken again in 2, 4, … 64 steps of Euler before the step of `dt` fails;
when it fails, everything goes back to the start of that step of `dt`, the steps of integration already taken in it
too.

**What the trapezoid answers.** A trapezoid with a fixed step h answers a sine of f exactly as the circuit itself
answers (1/(π·h))·tan(π·f·h) — the frequency warping of the bilinear transform. At 1/48000 s that is 100.0014 Hz for
100 Hz, 1001.4 Hz for 1 kHz and 11 724 Hz for 10 kHz, and there the model in one step of integration a sample is
ngspice's `.ac` to better than 10⁻⁸ (the samples `filters.json` hold both). Against `.ac` at the frequency itself, the
low-pass and the high-pass of 1 kΩ and 100 nF are then within 0.1 % at 100 Hz and 1 kHz and the high-pass within
0.34 % at 10 kHz; the low-pass at 10 kHz, far above its cut-off of 1.59 kHz, is 14.4 % low (0.1345 against 0.1572,
−1.35 dB): where a response falls steeply, the stretch of the frequency shows. Shorter steps of integration inside
each sample take it away — the stretch falls with the square of the step. Against `.ac` at the frequency itself, the
samples every 1/48000 s:

| `substeps` | low-pass, 10 kHz | high-pass, 10 kHz | worst at 100 Hz and 1 kHz |
|---|---|---|---|
| 1 (the default) | −14.4 % | +0.34 % | +0.10 % (high-pass, 1 kHz) |
| 2 | −3.5 % | +0.087 % | +0.026 % |
| 4 | −0.87 % | +0.022 % | +0.0064 % |
| 8 | −0.22 % | +0.0055 % | +0.0016 % |

The plan asks for the filters within 1 % of `.ac` at 100 Hz, 1 kHz and 10 kHz at 1/48000 s: `substeps: 4` meets it at
all six points (the test checks them), for four times the work of a sample. A sample of 1/48000 s in four steps is the
same, bit for bit, as four samples of 1/192 000 s (above), so nothing else changes. The default stays one step a
sample: the speed of the model at the audio rate is measured in E1-7, and a stand chooses there what it can afford. A
stand that shows a response at high frequencies — a filter swept up to 10 kHz, the sound through a filter — takes
`substeps: 4` or more, and a page that quotes the response there takes ngspice's numbers or the model's at
`substeps` ≥ 4, not the default's.

**Heat in time.** After every step of `dt` (once a sample, whatever the `substeps`) the heat of every part moves toward
its load of that moment by the exact step of `limits.ts` (with e^(−dt/τ) computed once), and a part that reaches 1
fails at that step: 1 W in a 0.25 W resistor
(75 Ω on the 9 V battery) burns it at 2.756 s, as `burnSeconds` says to the millisecond; the red LED on the battery
burns after 0.066 s; an electrolytic bulges as in Capacitors. The next steps know it (a change on the board: Euler).

Nothing in a step allocates: the matrix, the readings, the scratch of Newton's iterations and the copy of a step to
take again are made once per board; `run` writes into the stand's own arrays.

## Modules

| Module | What it does |
|---|---|
| `netlist.ts` | `Netlist`, `PartInstance`, `GROUND`; `checkNetlist` and `checkSetting` (the `RangeError`s above) |
| `parts.ts` | The catalog `PARTS`, `E12`, `E24`, `resistorKey`, `WIRE_OHMS`; the types of the parts (`PartSpec`, one interface per kind, `JunctionParams`, `Limits`, `Dielectric`); `Behaviour`, `FailedForm`, `Placement`, `Operating`; `behaviour(spec)` — how a kind of part sits in the matrix; the sine source |
| `mna.ts` | The dense LU with partial pivoting (`createSystem`, `factor`, `solveFactored`); `compile` (unknowns: the nodes in use, the parts' own nodes, then the currents of the parts that need one; the parts' memory and history; the scratch of the iterations); the `Stamper` the parts write with; `readSettings`, `updateSettings`; `assemble` (clear, stamp every part around a guess, leave the burnt ones out, stamp the bulged ones' failed form, tie); the damage codes `BURNT`, `BULGED` |
| `topology.ts` | `analyse` — the issues and the nodes to tie, by union–find over the links of the parts (a burnt part has none) |
| `dc.ts` | `solveDC` — one solve, or Newton's iterations with source stepping — `DcSolution`, `PartReading`, `DcOptions`, `MAX_ITERATIONS`; `newton` (one go of the iterations, which the transient takes at every step; `Go`, `newGo`), `readPart`, `damageIn`, `failureIn` |
| `diode.ts` | SPICE's junction: `ROOM_KELVIN`, `THERMAL_VOLTAGE`, `GMIN`, `junctionOf`, `junctionCurrent`, `pnjlim`, `limitJunction`, `forwardVoltage`, `ledLumens`, `diodeBehaviour` |
| `lamp.ts` | The tungsten filament, steady and in time: `TUNGSTEN_EXPONENT`, `filament`, `filamentCapacity`, `lampBehaviour` |
| `capacitor.ts` | The capacitor — ESR, capacitance, leak; its companion in time; its bulged form: `capacitorBehaviour`, `BULGED_OHMS` |
| `limits.ts` | `loadOf`, `conditionOf`, `WARM_LOAD`, `HEAT_SECONDS`, `heatStep`, `burnSeconds`, `limited`, `canBurn`, `failureOf`, `damageOf`, `fail`, `advanceHeat`; `Condition`, `Failure`, `PartStatus` |
| `transient.ts` | `Transient` with `TransientOptions`, `TransientStart`, `Probe`; `EULER_STEPS` |
| `state.ts` | `ModelState`, `PartMemory`, `createModelState`, `memoryOf`, `levelOf`, `keepLevel` |
| `index.ts` | the public entry |

## Adding a kind of part (E1-6 and later)

A kind is four things:

1. its spec interface in `parts.ts`, added to the union `PartSpec`, and its entries in `PARTS`;
2. a `Behaviour` (`parts.ts` for a simple linear kind, a module of its own otherwise, as `diode.ts`, `lamp.ts` and
   `capacitor.ts`) and one more `case` in `behaviour(spec)`;
3. its limits and, if it has any, its time constant in `HEAT_SECONDS` (`limits.ts`) — and, if it fails otherwise than
   by burning, its case in `failureOf` and its `failed` form;
4. its numbers in the oracle's own catalog (`tools/ref-models/electronics/spice.py`) and its cases in `cases.py`.

A `Behaviour` says how many current unknowns the part adds (`branches`: an ideal source has one), how many nodes of
its own (`inner`: a diode with RS has its junction, a capacitor the node between its ESR and its capacitance), how
many numbers it keeps between iterations (`memory`) and between the moments of the transient (`history`, whose first
number is the part's level: a capacitor's voltage, a filament's temperature), whether it is nonlinear (then the
operating point and every step take Newton's iterations), whether it is a source (`open` and `short` are checked for
sources), which pins conduct direct current at a setting (`links`), whether it is a wire at a setting (`wire`), how its
memory starts a solve (`start`), its stamp, the currents into its pins from a solution (`currents`), and, for a part
with a state in time, its history at an operating point (`settle`) and after a step (`accept`); `failed`, when it
fails otherwise than into a gap. The stamp writes through the `Stamper` — `conductance(a, b, g)`, `current(a, b, i)`
(a current through the part from node `a` to node `b`), `voltage(plus, minus, branch, volts)` — by node numbers, the
part's own nodes (`at.inner`) too; a conductance or a current from a node to itself (a part with both legs in one
row) is not stamped at all, since adding and taking away a jumper's 1000 S would round away the GMIN beside it. A part
stamps around the guess `op: Operating`: the node voltages `op.v`, the share `op.sources` a source gives (it
multiplies its voltage by it), `op.initial` (the first iteration from nothing: a junction linearizes at its memory),
`op.limited` (a part that limited its step sets it: the iterations go on), and the moment: `op.time` (a sine reads
it), `op.dt` (0 at the operating point; the step in time, when a part with a state stamps its companion from its
history) and `op.trapezoid` (the trapezoid, or backward Euler). A nonlinear part stamps its linearization: its slope
as a conductance and the current that makes up the rest.

## Tests

```bash
cd app && pnpm vitest run src/volumes/electronics/sim                                 # the whole model
python3 tools/ref-models/electronics/spice.py --check                                 # are the samples fresh?
```

`__tests__/`: `purity` (the text of every file), `parts` (the catalog, the published diodes, the fitted LEDs), `mna`
(the LU and the stamps; both legs in one row stamp nothing), `dc` (linear circuits by hand: a divider, the batteries
under load, a grid of five resistors, the pot at 0 / 0.5 / 1, a switch, the speaker; the worked example above; a
singular circuit; the state; malformed netlists), `topology` (open, short, floating — a pot's free wiper among them —
ungrounded), `diode` (the junction against SPICE's formulas in every region, the knee, `pnjlim`; the LEDs' windows
and light; an LED of each colour with 330 Ω from 9 V against ngspice — 21.24 mA red, 20.94 yellow, 20.65 green, 17.89
blue and white — within ± 3 %; an LED without a resistor: hot, burnt in under a second, then no current; diodes the
wrong way round under 1 μA; 1N4148 at 10 mA against ngspice within ± 2 %; the leak of its maker's model; warm starts,
source stepping, odd boards — a leg in the air, LEDs back to back, reversed diodes in series — groups that only GMIN
or the tie holds, 3000 random boards, and `no-convergence`), `lamp` (the catalog, 0.1 A at 6 V, the steady filament
against a bisection by hand at nine voltages, the lamp's law, 0.1 A ± 2 % from four AA cells, less than half the
power from 3 V, the state's temperature, the lamp's limit), `limits` (conditions, loads, the limits of the catalog,
heat in time, the 0.25 W resistor at 0.2 W for an hour and at 1 W, a burnt part as a gap, a shorted battery, two
stands), `capacitor` (the catalog — ESR and leak of the electrolytics from their makers' rules —, a capacitor at the
operating point, the loads by voltage, an electrolytic over its rating and the wrong way round: bulged after 12.0 and
1.2 s, then a leak of 1 kΩ, at the operating point too), `transient` (every sample in time against ngspice, the
plan's tolerances: the RC charge and discharge within 1 % at 20 moments with 63.2 % and 36.8 % ± 0.5 % after
R·C; the LED fed by 470 μF within 2 %; the rectifier's output, mean and ripple within 3 %; the filters sampled at
1/48000 s in four steps of integration within 1 % of `.ac` at 100 Hz, 1 kHz and 10 kHz, and in one step against
`.ac` where the trapezoid answers, within 1e-5 — the low-pass at 10 kHz then 14.4 % low, tested as such; halving the
step, under 0.1 %; the trapezoid's second order; no ringing after a stiff jump; the lamp's inrush; parts that burn in
time; the worked example above; start, run, set, rebuild, a failed step, `substeps` as the shorter step bit for bit
and a step that fails in its second step of integration undone whole), `oracle` (every sample of `__fixtures__/` at the
operating point against the model: relative difference ≤ 1e-6 for the linear samples and ≤ 1e-3 for the nonlinear
ones — the plan's tolerances — for every number, the smallest too, with no absolute allowance; where ngspice gives an
exact zero — the ground, a part behind an open switch — the model must give an exact zero; at most 50 iterations and
no source steps; and that every sample on disk is compared here or in `transient`). The samples are written by
`tools/ref-models/electronics/spice.py` from `cases.py` (its README); the model and ngspice agree on them to 4e-10
for the linear ones, the rounding of the samples, and to 1.6e-8 for the nonlinear ones, the tolerance to which both
sides settle — but for the power in the 1 kΩ before the reversed LED of `diode-reverse` (8.1e-20 W: 9 pA and 9 nV,
the difference of two nodes at 9 V), where the rounding of those nodes on either side leaves 8e-7. In time they agree
far inside the plan's tolerances: the RC curves to 3.2e-6, the LED's current to 3.9e-7, the rectifier's output to
9.5e-7 and its mean and ripple to 0.01 %, at the steps the tests take (1 ms, 0.1 ms, 1/48000 s; ngspice steps at
most 1 ms, 0.1 ms and 5 μs with its tolerances tightened).
