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
(`topology.ts`), and the comparison with ngspice. Diodes, LEDs, the lamp and the limits come with E1-4, time and
capacitors with E1-5, transistors and the amplifier with E1-6.

## Units and conventions

- **SI everywhere:** V, A, Ω, W (later F and s). No prefixes in numbers: 4.7 kΩ is `4700`.
- **Node 0 is the ground.** Nodes are numbered by the board, `0 … nodes − 1`; a node that no pin uses costs nothing
  (it is left out of the matrix and reads 0 V), so the board may give every row of its sockets a number.
- **Pins** of a part come in the order of the catalog (`PARTS[key].pins`): `['plus', 'minus']`, `['a', 'b']`,
  `['ccw', 'wiper', 'cw']`.
- **Readings** (`PartReading`): `u` — the voltage from the first pin to the second; `i` — the current into the part
  through its first pin; `p` — the power the part takes, the sum over its pins of voltage × current into the pin.
  A resistor has `p = u·i > 0`. A battery that feeds a circuit has the current coming *out* of its plus pin, so its
  `i` and `p` are negative: a 9 V battery on 100 Ω reads `u` 8.867 V, `i` −88.67 mA, `p` −0.786 W. A meter on the
  stand shows the magnitude; the sign says which way the current goes.
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

`solveDC(net | circuit, { state? }) → DcSolution`:

| Field | What it is |
|---|---|
| `ok` | `true` when the circuit has a single solution |
| `reason` | when `ok` is false: `'singular'` — the matrix has no single solution (two ideal sources side by side, an ideal source with both pins in one row). Never an exception, never `NaN`: `v` and every reading are then zeros |
| `v` | `Float64Array` of node voltages by node number |
| `parts` | `{ [id]: { u, i, p } }` for every part |
| `iterations` | how many times the matrix was factored: 1 for a linear circuit (Newton's iterations count here from E1-4) |
| `issues` | what is wrong with the shape of the circuit (below); the numbers are valid all the same |

A malformed netlist is a `RangeError` that names the fault: a number of nodes that is not a whole number ≥ 1, an
empty or repeated id, a key the catalog has not, a wrong number of pins, a node out of range, a setting that is not
a finite number (checked again at every solve, since a compiled circuit reads the settings of its netlist live).

`compile(net)` checks the netlist, numbers the unknowns and allocates the matrix once. A compiled circuit follows
the settings of its netlist; any other change of the netlist (a part added, a pin moved) needs a new `compile`.

**The state** (`createModelState()`) is what the model remembers between solves, one object per stand and never a
variable of a module: two copies of a chapter side by side at a chapter boundary hold two. It outlives a netlist.
Now it holds the node voltages of the last good solve (`v`), the first guess of Newton's iterations of E1-4; the
temperature of a lamp, the charge of the capacitors and the damage of parts are added there by E1-4…E1-6.

## Topology: what the model says about the shape of a circuit

| `kind` | When | Fields |
|---|---|---|
| `open` | a source whose terminals the rest of the circuit does not join (a gap, an open switch): no current flows through it | `part` |
| `short` | a source whose terminals are joined by wires alone — jumpers, closed switches, or both legs in one row; the current is E / (r + wires) | `part` |
| `floating` | pins of a part in rows no other part touches (never the ground): a leg in the air. A pot whose wiper is left unconnected counts too: `{ kind: 'floating', part: 'P1', pins: ['wiper'] }`, while its track still carries current | `part`, `pins` (names) |
| `ungrounded` | nodes in use with no path to the ground for direct current; the model ties `nodes[0]` to the ground by `TIE_OHMS` (1 GΩ) and solves on — no current flows through the tie | `nodes` |

The order: the issues of the sources in the order of the parts, then the floating pins in the order of the parts,
then the groups of ungrounded nodes by their lowest node.

## Catalog (`PARTS`)

| Key | Kind | Pins | Numbers | Limits | Source of the numbers |
|---|---|---|---|---|---|
| `battery-9v` | `battery` | plus, minus | 9 V, internal 1.5 Ω, 6 cells | — (a short warms it, E1-4) | the plan's decision (batch E1, task E1-3), from Energizer's data below |
| `battery-4aa` | `battery` | plus, minus | 6 V, internal 0.6 Ω, 4 cells | — | the same |
| `battery-aa` | `battery` | plus, minus | 1.5 V, internal 0.15 Ω, 1 cell | — | the same |
| `ideal-9v` | `source` | plus, minus | 9 V, no internal resistance | — | the reference of hand calculations and of the oracle; the bench never offers it (batteries only, the design §3.4) |
| `resistor-<code>` | `resistor` | a, b | every value of E24 from 1 Ω to 9.1 MΩ, and 10 MΩ: 169 parts; `series` E12 or E24; `tolerance` 0.05 | 0.25 W | values: IEC 60063 (E12, E24); key: the letter code of IEC 60062; 0.25 W and 5 % (gold band): the usual through-hole resistor of the kits, the design §5.2 |
| `pot-10k` | `pot` | ccw, wiper, cw | a linear track of 10 kΩ; each part of the track at least 1 mΩ | 0.2 W | Bourns PDB181 series, for example PDB181-K420K-103B: 10 kΩ, linear, 0.2 W (Digi-Key listing; datasheet bourns.com «PDB18») |
| `switch` | `switch` | a, b | open: no path; closed: 1 mΩ | — | the decision of this task (below) |
| `jumper` | `jumper` | a, b | 1 mΩ | — | the same |
| `speaker-8` | `speaker` | plus, minus | 8 Ω | 2 W | a 50 mm speaker such as Visaton K 50 WP 8 Ω: 2 W rated, 3 W maximum |
| `earphone-32` | `speaker` | plus, minus | 32 Ω | 0.1 W | a 32 Ω headphone such as beyerdynamic DT 770 PRO 32 Ω: 100 mW rated power handling (IEC 60268-7) |

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

## Modules

| Module | What it does |
|---|---|
| `netlist.ts` | `Netlist`, `PartInstance`, `GROUND`; `checkNetlist` and `checkSetting` (the `RangeError`s above) |
| `parts.ts` | The catalog `PARTS`, `E12`, `E24`, `resistorKey`, `WIRE_OHMS`; the types of the parts (`PartSpec`, one interface per kind); `behaviour(spec)` — how a kind of part sits in the matrix |
| `mna.ts` | The dense LU with partial pivoting (`createSystem`, `factor`, `solveFactored`); `compile` (unknowns: the nodes in use, then the currents of the parts that need one); the `Stamper` the parts write with; `assemble` (clear, stamp every part, tie) |
| `topology.ts` | `analyse` — the issues and the nodes to tie, by union–find over the links of the parts |
| `dc.ts` | `solveDC`, `DcSolution`, `PartReading` |
| `state.ts` | `ModelState`, `createModelState` |
| `index.ts` | the public entry |

## Adding a kind of part (E1-4…E1-6)

A kind is three things:

1. its spec interface in `parts.ts`, added to the union `PartSpec`, and its entries in `PARTS`;
2. a `Behaviour` (`parts.ts` for a linear kind, a module of its own for a nonlinear one, as `diode.ts`) and one more
   `case` in `behaviour(spec)`;
3. its numbers in the oracle's own catalog (`tools/ref-models/electronics/spice.py`) and its cases in `cases.py`.

A `Behaviour` says how many current unknowns the part adds (`branches`: an ideal source has one), whether it is a
source (`open` and `short` are checked for sources), which pins conduct direct current at a setting (`links`), whether
it is a wire at a setting (`wire`), its stamp (`stamp`, through the `Stamper`: `conductance(a, b, g)`,
`current(a, b, i)` — a current through the part from node `a` to node `b`, `voltage(plus, minus, branch, volts)`),
and the currents into its pins from a solution (`currents`). A nonlinear part stamps its linearization around the
guess of the iteration (a conductance and a current); the stamp interface grows the guess, the time step and the
part's state when E1-4 and E1-5 need them.

## Tests

```bash
cd app && pnpm vitest run src/volumes/electronics/sim                                 # the whole model
python3 tools/ref-models/electronics/spice.py --check                                 # are the samples fresh?
```

`__tests__/`: `purity` (the text of every file), `parts` (the catalog), `mna` (the LU and the stamps), `dc` (linear
circuits by hand: a divider, the batteries under load, a grid of five resistors, the pot at 0 / 0.5 / 1, a switch,
the speaker; the worked example above; a singular circuit; the state; malformed netlists), `topology` (open, short,
floating — a pot's free wiper among them — ungrounded), `oracle` (every sample of `__fixtures__/` against the
model: relative difference ≤ 1e-6 for every number, the smallest too, with no absolute allowance; where ngspice
gives an exact zero — the ground, a part behind an open switch — the model must give an exact zero).
The samples are written by `tools/ref-models/electronics/spice.py` from `cases.py` (its README); the model and ngspice
agree on them to 4e-10, the rounding of the samples.
