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
incandescent lamp — with Newton's iterations at the operating point, and the limits of every part: how loaded it is, how
its heat gathers, and when it burns. E1-5 adds time: capacitors of three kinds, the transient (`Transient`) with a fixed
step, a lamp whose filament warms in time, parts that burn (and electrolytic capacitors that bulge) in time, and a sine
source for the oracle. E1-6 adds the bipolar transistor — NPN BC547B, 2N3904 and BC337-25, PNP BC557B, 2N3906 and
BC327-25 — and the amplifier of the volume (`amplifier.ts`): the netlist the stand builds in the chapter `amplifier`,
which ngspice checks at rest, playing a tone from a whisper to past clipping, switched off and with its battery the
wrong way round; the player's test tone (a sine behind an internal resistance) drives it. E1-7 adds the volume's own
melody (`music.ts`) and the player that plays it (`player`), the model playing it in blocks at the audio rate, and the
measure of its speed (`__tests__/speed.bench.ts`) — with what made it fast enough: Newton's iterations of a moment start
where the last two moments point and stop by a rule of their own, a linear circuit keeps the factors of its matrix, and
the factorization skips the zeros (The melody and the player; Speed).

## Units and conventions

- **SI everywhere:** V, A, Ω, W, F, s, Hz. No prefixes in numbers: 4.7 kΩ is `4700`, 100 nF is `100e-9`.
- **Node 0 is the ground.** Nodes are numbered by the board, `0 … nodes − 1`; a node that no pin uses costs nothing
  (it is left out of the matrix and reads 0 V), so the board may give every row of its sockets a number.
- **Pins** of a part come in the order of the catalog (`PARTS[key].pins`): `['plus', 'minus']`, `['a', 'b']`,
  `['ccw', 'wiper', 'cw']`, `['anode', 'cathode']`, `['collector', 'base', 'emitter']`. An electrolytic capacitor has
  `['plus', 'minus']`, a ceramic or film one `['a', 'b']`.
- **Readings** (`PartReading`): `u` — the voltage from the first pin to the second; `i` — the current into the part
  through its first pin; `p` — the power the part takes, the sum over its pins of voltage × current into the pin.
  A resistor has `p = u·i > 0`. A battery that feeds a circuit has the current coming *out* of its plus pin, so its
  `i` and `p` are negative: a 9 V battery on 100 Ω reads `u` 8.867 V, `i` −88.67 mA, `p` −0.786 W. A diode or an
  LED reads from anode to cathode: forward, `u` and `i` are positive. A meter on the stand shows the magnitude; the
  sign says which way the current goes.
- **Settings** (`PartInstance.setting`): a pot — the share of its track from `ccw` to the wiper, 0…1 (0 is the knob
  turned fully counter-clockwise; 0.5 when absent; outside 0…1 it is held to the range). A switch — 0 open, 1
  closed (from 0.5 up counts as closed; open when absent). A sine source (the player's test tone too) — its frequency
  in Hz (its catalog `hz` when absent, never below 0). The player — its amplitude in V (its catalog `amplitude`, 0.3 V,
  when absent, never below 0: at 0 it is stopped). Other parts ignore it.
- **A capacitor's reading:** `i` is the current into its first pin — what flows through its ESR, the leak's and the
  capacitance's together; `u` is the voltage on its pins, the ESR's drop included; `p` is `u·i`, positive while it
  charges. Its charge is in the state (`volts`, the voltage across the capacitance alone).
- **A transistor's reading:** `i` is the collector current (into the collector: positive for an NPN that conducts,
  negative for a PNP, whose collector current comes out); `u` is V(collector) − V(base); `p` the power it turns into
  heat, Vce·Ic + Vbe·Ib. Its base current is the current of the part on its base (a base resistor's `i`), or
  `transistorAt` at its junction voltages; Vce is the difference of two node voltages.

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
| `player-tone` | `sine` | plus, minus | 0.3 V amplitude behind 32 Ω (`ohms`), 1 kHz unless its setting gives another frequency | — | the plan's player (batch E1, task E1-6: 0.3 V amplitude, 32 Ω) playing a tone: the input of the amplifier's tests and of their oracle; the player with its melody is `player` |
| `player` | `player` | plus, minus | the volume's melody (`music.ts`, within ±1) times 0.3 V (`amplitude`, the setting when given) behind 32 Ω (`ohms`) | — | the plan's player (batch E1, task E1-7: the melody × the amplitude, 0.3 V by default, behind 32 Ω): what the stand's player plays (The melody and the player) |
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
| `transistor-bc547b`, `transistor-bc557b` | `transistor` (`polarity` npn, pnp) | collector, base, emitter | IS 23.9 fA, BF 294.3, BR 7.946, VAF 63.2 V; IS 38.34 fA, BF 344.4, BR 14.84, VAF 21.11 V | 100 mA, 0.5 W | Philips' SPICE library and datasheets: Transistors, below |
| `transistor-2n3904`, `transistor-2n3906` | `transistor` (npn, pnp) | collector, base, emitter | IS 6.734 fA, BF 416.4, BR 0.7371, VAF 74.03 V; IS 1.41 fA, BF 180.7, BR 4.977, VAF 18.7 V | 200 mA, 0.625 W | Fairchild's datasheets and their SPICE models: Transistors, below |

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

## Transistors (`transistor.ts`)

The DC part of SPICE's bipolar transistor: the Gummel–Poon model of ngspice-42 (`src/spicelib/devices/bjt/bjtload.c`,
`bjttemp.c`) with four parameters — the saturation current IS, the forward and reverse current gains BF and BR, the
forward Early voltage VAF — and every other one at its default: NF = NR = 1; no series resistances RB, RC, RE; no
recombination currents ISE, ISC (which lower β at small currents); no high injection IKF, IKR (which lowers β at large
ones); no VAR; no capacitances and transit times. With these defaults Gummel–Poon is the transport form of Ebers–Moll
with the Early effect, the plan's model. In the frame of an NPN, with Vbe and Vbc the voltages of its two junctions:

| Current | Formula |
|---|---|
| the junctions | Ibe = IS·(e^(Vbe/Vt) − 1), Ibc = IS·(e^(Vbc/Vt) − 1); below −3·Vt SPICE's cubic −IS·(1 + (3·Vt / (e·V))³), as a diode's |
| into the collector | Ic = (Ibe − Ibc)·(1 − Vbc/VAF) − Ibc/BR − GMIN·Vbc |
| into the base | Ib = Ibe/BF + Ibc/BR + GMIN·(Vbe + Vbc) |
| into the emitter | −(Ic + Ib) |

A PNP is the same with every voltage and current reversed. In the forward active region (Vbe about 0.6–0.75 V, the
collector junction the wrong way round) Ic = BF·Ib·(1 + Vcb/VAF): the collector current is BF times the base current,
a little more as the collector rises (the Early effect). Saturated — both junctions forward, a switch that is on — the
collector takes less than BF·Ib and keeps a few tens of millivolts; cut off (Vbe near 0) only GMIN and IS leak,
picoamperes. At the node voltages ngspice prints for the samples this formula gives the current its probe measures
within 1e-6 (`spice.py --selftest`; the TypeScript test within 1e-4, ngspice's own tolerance on the node voltages).

`transistorAt(params, vbe, vbc, out)` gives the currents and their four slopes (`TransistorPoint`);
`transistorVcrit(params)` the knee Vcrit = Vt·ln(Vt / (√2·IS)): 0.708 V for BC547B, 0.696 V BC557B, 0.741 V 2N3904,
0.781 V 2N3906, 0.694 V BC337-25, 0.669 V BC327-25. In the matrix a transistor adds no unknowns: its stamp is the
linearization of its collector and base currents around the guess — transconductances controlled by Vbe and Vbc
(`Stamper.transconductance`) and the rest as a current. Newton's iterations limit the step of both junction voltages as
ngspice does (`pnjlim` with Vt and Vcrit), and a solve from nothing starts the base–emitter junction at Vcrit and the
base–collector one at 0 V (ngspice's MODEINITJCT). From cold the samples settle in 12 iterations (seven transistors in
their regions), 24 (the switch) and 8 (the amplifier at rest). 2000 random boards of up to seven parts — transistors
with their legs anywhere among batteries, LEDs, diodes, resistors and jumpers — all settle; seven end one go of 100
iterations by the noise rule (a group that only junction leakage and GMIN hold to the ground while amperes flow inside
it, as in Diodes and LEDs) and one board without a transistor steps its sources.

ngspice gives every transistor a substrate junction (ISS = 0: only GMIN across it) from the ground to the collector
of an NPN (vertical) or the base of a PNP (lateral). A discrete transistor has no substrate: the oracle's decks tie it
to the node that junction faces, which takes it out, and the rest of the decks is the formula above.

**The catalog** (sources read 20.11.2026):

| Key | The maker's SPICE model | IS | BF | BR | VAF | Limits: the maker's datasheet |
|---|---|---|---|---|---|---|
| `transistor-bc547b` | Philips Semiconductors, «SPICE Parameter Library for PHILIPS' Low Frequency Small Signal Transistors» (`phil_bjt.lib`, revision 1.0, 21 Nov 1996, for MicroSim PSpice), `.MODEL QBC547B/PLP NPN` | 23.9 fA | 294.3 | 7.946 | 63.2 V | IC 100 mA, Ptot 500 mW: Philips «BC546; BC547 NPN general purpose transistors», product specification 2004 Nov 25 (hFE of BC547B 200–450 at 2 mA) |
| `transistor-bc557b` | the same library, `.MODEL QBC557B/PLP PNP` | 38.34 fA | 344.4 | 14.84 | 21.11 V | −100 mA, 500 mW: Philips «BC556; BC557 PNP general purpose transistors», 1999 Apr 15 (hFE 220–475) |
| `transistor-2n3904` | Fairchild Semiconductor, datasheet «2N3904 / MMBT3904 / PZT3904», 2001 Rev A, «Spice Model» | 6.734 fA | 416.4 | 0.7371 | 74.03 V | IC 200 mA, PD 625 mW, the same datasheet |
| `transistor-2n3906` | Fairchild, «2N3906 / MMBT3906 / PZT3906», 2001 Rev A, «Spice Model» | 1.41 fA | 180.7 | 4.977 | 18.7 V | −200 mA, 625 mW, the same datasheet |
| `transistor-bc337-25` | Philips' `phil_bjt.lib` (above), `.MODEL QBC337-25/PLP NPN` | 41.3 fA | 292.4 | 23.68 | 145.7 V | IC 500 mA: Philips «BC337; BC337A; BC338 NPN general purpose transistors» (1999), «high current (max. 500 mA)»; 625 mW: Multicomp «BC327, BC337 Series» (Farnell, 2006: PD 625 mW, IC 800 mA, ICM 1 A) |
| `transistor-bc327-25` | Philips' BC327-25 as LTspice's `standard.bjt` carries it («mfg=Philips», «Icrating=500m»; `phil_bjt.lib` has no BC327) | 108 fA | 385.7 | 20.57 | 31.29 V | −500 mA, as its complement BC337 and LTspice's «Icrating=500m»; 625 mW: onsemi «BC327», January 2024 Rev. 2 (PD 625 mW, IC −800 mA), and the Multicomp series above |

Philips' library was read from the KiCad SPICE library on GitHub (`kicad-spice-library/KiCad-Spice-Library`,
`Models/uncategorized/spice_complete/phil_bjt.lib`); LTspice's `standard.bjt` has the same BC547B and BC557B
(«mfg=Philips»). Nexperia, Philips' successor, refused this machine (HTTP 403), as for 1N4148. Fairchild's datasheets
were read from CERN's copies (`sy-dep-epc-lpc.web.cern.ch`, «2N3904 Transistor (FAIRCHILD).pdf» and «2N3906 Transistor
(FAIRCHILD).pdf»); the 2N3904 one prints `Ise=6.734` without the f of femto, which the same model in PSpice's eval.lib
(`Q2N3904`) has. A BC547B with IS 7.049 fA, BF 374.6, VAF 62.79 V circulates as well (on forums, as an ORCAD model of
BC546B); its source could not be traced to a maker, so the maker's own library was taken.

BC337-25 and BC327-25, the output pair of the amplifier (fix round 1 of E1-6: 2N3904 and 2N3906 passed their 200 mA
there, The amplifier below), come from the same Philips library and from LTspice's `standard.bjt` (read from LTwiki's
copy, «Standard.bjt», and from the KiCad library's `Models/Transistor/BJT/BJT.lib`: the same lines). Nexperia's
datasheets refused this machine (HTTP 403), so the 500 mA is Philips' «high current (max. 500 mA)» as a datasheet
archive quotes the 1999 specification's features, with LTspice's «Icrating=500m» beside it; the 625 mW is that of
onsemi's BC327 datasheet and Multicomp's BC327/BC337 one (both read; both rate the collector for 800 mA continuous,
more than Philips: the catalog keeps the smaller). The makers' whole models, which only
`tools/ref-models/electronics/amplifier.py` runs, are in `spice.py` (`TRANSISTORS[key]['vendor']`); how far the model
is from them in the amplifier: The amplifier, below.

**Limits.** The collector current and the power, the plan's two: the datasheets' continuous IC and their Ptot at
25 °C. No voltage limit: the bench has 9 V at most against VCEO 40–45 V, and SPICE's model has no breakdown (a
base–emitter junction the wrong way round past its VEBO of 6 V is not modelled). `HEAT_SECONDS.transistor` = 5 s (the
decision of E1-6, as a diode's: a junction in a small package; a TO-92 on its leads, Rth(j-a) 200–250 K/W, warms
through in tens of seconds, so this is a compression like the others). A burnt transistor is a gap between all three
pins (a real one often shorts from the collector to the emitter; the gap is the decision of E1-6, as for every part).

## Limits (`limits.ts`)

**The load** (`loadOf(spec, reading)`) is the share of its limit a part is under: the largest of |p| / `powerW`,
|i| / `currentA`, |u| / `voltageV` and (−u) / `reverseV`, of the limits the part has. Resistors, the pot (its whole
track), the speaker, the earphone and the lamp have a power; LEDs, diodes and batteries a current; diodes a reverse
voltage too; capacitors a voltage either way, an electrolytic a reverse voltage too; transistors a collector current
and a power. The ideal sources, the sines (the player's tone too), the player, the switch and the jumper have none.

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
| `transistor` | 5 s | BC547B with 10 kΩ from the 9 V battery on its base and only 10 Ω in its collector takes 0.25 A and 1.53 W (load 3.07) and burns after 2.0 s; 2N3904 with 100 Ω on its base and its collector straight on the battery, 4.7 A, 0.22 s |
| `lamp` | 2 s | the 6 V lamp on the 9 V battery: 2.1 s |
| `battery` | 2 s | a short warms the battery to its load (6 for the 9 V one) in a few seconds; it never burns |

`advanceHeat(state, net, dc, seconds)` lets model time pass at an operating point: every limited part of the board moves
its heat toward its load in `dc.status`, a part that reaches 1 fails, and the ids of the parts that failed now come
back. The next solve with the state knows them — a burnt resistor, LED, diode, lamp or transistor is a gap (its reading
is the voltage across the gap, no current), a bulged capacitor a leak of 1 kΩ. In the operating point the stand calls it
once a frame with the frame's time. The transient takes the same step at every step of its own, with the load of that
moment: in time the heat is the load filtered by τ, so a part takes the mean of a load that swings faster than τ (a
rectifier's diode, at 50 Hz, its mean current; the amplifier's output pair, the mean of its half waves). `status` in
time is the load of the moment, so it may read `'hot'` for moments while the heat stays far below 1 — the amplifier
switched on, below: a transistor's power of the moment against its Ptot, which is a rating for the mean. Time runs
forward: a negative or infinite step is a `RangeError`.

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
moment: one solve for a linear circuit, Newton's iterations (`newton` of `dc.ts`) for a nonlinear one (how many, and
what makes them few: «Moments fast», below). The steps of integration go by the trapezoid; the first `EULER_STEPS` = 2 of them
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
sample. A stand that shows a response at high frequencies — a filter swept up to 10 kHz, the sound through a filter —
takes `substeps: 4` or more at 48 kHz, and eight at 24 kHz, the volume's rate (Speed: the same moments, 1/192 000 s
apart), and a page that quotes the response there takes ngspice's numbers or the model's with those substeps, not the
default's.

**Heat in time.** After every step of `dt` (once a sample, whatever the `substeps`) the heat of every part moves toward
its load of that moment by the exact step of `limits.ts` (with e^(−dt/τ) computed once), and a part that reaches 1
fails at that step: 1 W in a 0.25 W resistor
(75 Ω on the 9 V battery) burns it at 2.756 s, as `burnSeconds` says to the millisecond; the red LED on the battery
burns after 0.066 s; an electrolytic bulges as in Capacitors. The next steps know it (a change on the board: Euler).

**Moments fast** (E1-7; the numbers of speed: Speed, below). Three things keep a moment cheap, and none changes what
the model computes beyond the last nanovolts:

- *A linear circuit keeps its factors.* Its matrix depends on the settings, the damage, the ties, the step and the
  method of integration only, so while none of them changes the transient stamps the right-hand side of each new moment
  alone (`assembleRight`: the same numbers, added in the same order, as `assemble` gives) and solves it with the
  factors it kept — the same numbers, bit for bit, as factoring every moment. An RC circuit takes two factorizations for
  a hundred steps (one for backward Euler's two, one for the trapezoid's 98), and two more after a knob is turned.
  `LinearSystem.factorizations` counts every factorization, so the transient knows when another one (an operating point
  of the same circuit, say) has taken the place of its own: it factors again, and nothing else changes (the test).
- *Newton's iterations start where the last two moments point:* v(t) + (v(t) − v(t − h)), the predictor of SPICE —
  from the third step of integration after a change on the board (the two before are the line's two points), and never
  in a step taken again in pieces. The guess is then off by about h²·v″, where the last moment is off by h·v′.
- *They stop by the transient's own rule* (`TRANSIENT_EXACTNESS`): no unknown moved by more than 1e-6 of itself plus
  1e-6 (V or A) — a thousandth of SPICE's RELTOL and its VNTOL — where the operating point asks for 1e-9 and 1e-12
  (`OPERATING_EXACTNESS`). Near the solution an iteration squares the error (every part stamps its exact slope), err' ≈
  C·err² with C up to 1/(2·Vt) ≈ 20 per volt for a junction, so the iteration that moved by at most 10 μV leaves an
  error of nanovolts — where the operating point's rule would ask for one iteration more, every moment, to see a step
  below a nanovolt. Against the moments solved by the operating point's rule from the last moment (the transient before
  E1-7), the amplifier playing ngspice's seven tones (`amplifier-v10` … `amplifier-off`) keeps every node within
  9.3e-10 V, and playing the melody for two seconds within 5.2e-10 V (the table below); its agreement with ngspice (The
  amplifier) is the same to the digits given there.

What they do to the amplifier playing the melody at half volume over two seconds (the mean number of factorizations a
moment, two at least: the first iteration of a go never counts as settled; in brackets, the largest difference of any
node from the first row, the rule before E1-7):

| Newton's iterations | 48 kHz | 24 kHz |
|---|---|---|
| start at the last moment, stop by the operating point's rule (before E1-7) | 3.93 | 4.21 |
| start on the predictor's line, stop by the operating point's rule | 3.60 (3.0e-11 V) | 3.99 (1.6e-11 V) |
| start at the last moment, stop by the transient's rule | 2.98 (5.1e-10 V) | 3.26 (8.2e-10 V) |
| start on the predictor's line, stop by the transient's rule (now) | 2.67 (5.2e-10 V) | 3.05 (5.7e-10 V) |

On the oracle's circuits in time every moment now takes two: the LED emptying 470 μF (at 0.1 ms) 2.00 against 3.00,
the rectifier (at 1/48000 s) 2.01 against 2.30, four at most against five; their agreement with ngspice is the same to
the digits given in Tests.

The rule of the transient makes one difference a test sees: the rollback of a step that fails in its second half
(«what a stand does with the transient») needs two iterations allowed, not three, to fail there.

Nothing in a step allocates: the matrix, the readings, the scratch of Newton's iterations and the copy of a step to
take again are made once per board; `run` writes into the stand's own arrays and keeps its list of what to record.

## The amplifier (`amplifier.ts`)

The thread of the volume: the amplifier the reader builds in the chapter `amplifier`, which plays the player into the
8 Ω speaker from the 9 V battery on three transistors (the plan: the simplest that really plays, three transistors at
most, a volume control, coupling capacitors, an LED «on» with its resistor and a diode against the battery the wrong
way round; why three where the design's §10 says one or two: «Why this circuit», below). `amplifierNetlist(options?)`
gives its netlist, a new object each time; `AMPLIFIER_NODES` names its nodes for the probe; `AMPLIFIER_ROLES` says what
every part does there and which chapter of its own kind explains it.

```ts
import { AMPLIFIER_NODES, amplifierNetlist, Transient } from '@electronics/sim/core';

const board = amplifierNetlist({ volume: 0.5 }); // switched on, the volume control in the middle, the tone of 1 kHz
const t = new Transient(board, { dt: 1 / 48000 });
t.start('dc'); // at rest: the tone gives 0 V at t = 0
t.v[AMPLIFIER_NODES.output]; // 3.771 V: near half the supply
t.parts.B1!.i; // −0.01331: 13.3 mA from the battery
const speaker = new Float32Array(2880);
t.run(2880, [{ node: AMPLIFIER_NODES.speaker, out: speaker }]); // 60 ms
// the last 20 ms of `speaker`: 1 kHz of 1.023 V amplitude on the 8 Ω speaker, 65 mW
board.parts.find((p) => p.id === 'VR1')!.setting = 0.9; // louder: 60 ms later, 2.73 V
```

`amplifierNetlist({ volume?, on?, reversed?, source? })`: `volume` the setting of the volume control (0.5 when
absent; 0 silent, 1 full), `on` the switch (closed when absent), `reversed` the battery with its plus on the ground row,
`source` the catalog key in the player's place (`player-tone` when absent; the player with its melody is E1-7's). The
nodes and parts (ids as on a schematic):

| Part | Key | Pins → nodes | Role (`AMPLIFIER_ROLES`) | Chapter |
|---|---|---|---|---|
| `B1` | `battery-9v` | plus `battery` (1), minus ground | all the energy the speaker gets comes from it | `prologue` |
| `S1` | `switch` | `battery` (1) → `switched` (2) | off, the battery gives nothing | `prologue` |
| `D1` | `diode-1n4007` | anode `switched` (2), cathode `supply` (3) | protection: a battery the wrong way round finds it shut | `diode` |
| `C3` | `electrolytic-470u-16v` | plus `supply` (3), minus ground | the reservoir: it gives the loud peaks their current at once | `capacitor` |
| `R1`, `LED1` | `resistor-2k2`, `led-red` | `supply` (3) → `led` (4) → ground | the light «on»: 3 mA are enough for a lamp that only says «on» | `resistor-pick`, `led` |
| `PL` | `player-tone` | plus `player` (5), minus ground | the player: 0.3 V at most behind 32 Ω | `prologue` |
| `VR1` | `pot-10k` | ccw ground, wiper `volume` (6), cw `player` (5) | the volume control: a divider that passes on a share of the signal | `divider` |
| `C1` | `electrolytic-10u-16v` | plus `coupled` (7), minus `volume` (6) | lets the music in, keeps the driver's 0.7 V of bias from the volume control | `filter` |
| `R2` | `resistor-1k5` | `coupled` (7) → `base` (8) | the input resistor: with R3 it caps the gain at R3/R2 ≈ 31; one driver cannot give the feedback that much to spare, so the gain is about 16 and follows the driver's β | `resistor` |
| `R3`, `R4` | `resistor-47k`, `resistor-18k` | `output` (12) → `base` (8) → ground | feedback: the output settles where R4's current and the driver's base current, both through R3, hold the base at 0.69 V — a loaded divider, not the unloaded one of the formula | `divider` |
| `Q1` | `transistor-bc547b` | collector `driver` (11), base `base` (8), emitter ground | the driver: a small current into its base controls the large one of its collector | `amplifier` |
| `R5` | `resistor-470` | `supply` (3) → `top` (9) | the driver's load: the current that opens the upper output transistor | `resistor` |
| `D2`, `D3` | `diode-1n4007` | `top` (9) → `middle` (10) → `driver` (11) | 1.24 V that keep both output transistors at the edge of opening: the current passes from one to the other without a gap | `diode` |
| `Q2` | `transistor-bc337-25` | collector `supply` (3), base `top` (9), emitter `output` (12) | pushes current from the supply into the speaker, 0.37 A at most of its 0.5 A | `transistor` |
| `Q3` | `transistor-bc327-25` | collector ground, base `driver` (11), emitter `output` (12) | pulls it back through the speaker to the ground | `transistor` |
| `C2` | `electrolytic-470u-16v` | plus `output` (12), minus `speaker` (13) | passes the music to the speaker, keeps the steady half supply off it | `filter` |
| `LS1` | `speaker-8` | plus `speaker` (13), minus ground | turns its current into sound | `prologue` |

**What ngspice says of it** (the samples `amplifier-*.json`; the model agrees within 3.6e-10 at rest and within 8.3e-5
playing — the amplitudes of every probed node, the waveform within 1.1e-4 of its swing — at one step of integration a
sample of 1/48000 s). At rest the supply after the protection diode is 8.337 V, the output 3.771 V, the base of the
driver 0.686 V; the driver takes 8.36 mA, the output pair 1.94 mA (the two diodes hold 1.24 V), the LED 2.99 mA: the
battery gives 13.31 mA, which an alkaline 9 V battery feeds **in silence** for about 44 hours (Energizer 522, form
522GL1019: about 600 mAh at 10 mA and 565 mAh at 25 mA to 4.8 V, read off its chart). Playing, it takes more: the
push-pull pair draws from the battery only what the speaker needs, so the battery's current grows with the volume.
Playing the tone (the distortion, THD — the harmonics up to the tenth against the tone — and the currents from
`tools/ref-models/electronics/amplifier.py`; the battery's mean current over the last 20 ms; the largest collector
current of each output transistor):

| Volume | The tone on the volume control | On the speaker | Gain | Power | THD | From the battery | Q2 / Q3 at the peaks |
|---|---|---|---|---|---|---|---|
| 10 % | 20.1 mV | 0.313 V | 15.59 | 6.1 mW | 1.9 % | 23.9 mA | 39 / 40 mA |
| 30 % | 41.7 mV | 0.671 V | 16.08 | 28 mW | 1.6 % | 37.9 mA | 83 / 85 mA |
| 50 % | 63.1 mV | 1.023 V | 16.22 | 65 mW | 1.5 % | 51.7 mA | 127 / 130 mA |
| 70 % | 97.4 mV | 1.579 V | 16.20 | 156 mW | 1.9 % | 73.7 mA | 194 / 200 mA |
| 80 % | 128.0 mV | 2.052 V | 16.03 | 263 mW | 2.7 % | 92.5 mA | 248 / 262 mA |
| 90 % | 182.1 mV | 2.732 V | 15.00 | 466 mW | 5.7 % | 120.5 mA | 316 / 330 mA |
| 95 % | 227.7 mV | 3.013 V | 13.23 | 567 mW | 11.2 % | 134.0 mA | 331 / 346 mA |
| 100 % | 294.8 mV | 3.203 V | 10.87 | 641 mW | 19.7 % | 145.4 mA | 326 / 368 mA |

A steady tone at half volume takes 52 mA from the battery, as much as variant A below takes all the time; music's
level is mostly far below its peaks, so with music B takes less than with a steady tone of the same peaks, but no
number of hours playing is given here: it depends on the music and the volume. Clipping sets in — the gain down to
90 % of its 15.59 on a small signal — with 0.207 V of the tone on the volume control, between 90 % and 95 % of the
knob: 0.52 W on the speaker in the model, 0.45 W with the makers' whole models. It clips the upper half first: at full
volume the speaker swings from +2.62 V to −2.95 V (whole models +2.41 V to −2.86 V), because near the top R5 has
little voltage left to feed the upper transistor's base. The speaker takes a third of its 2 W at full volume. The
reservoir C3 reads `'warm'` at rest: 8.3 V of its 16 V (load 0.52, the capacitors' rule of E1-5). Switched off, the
speaker gets 45 μV of the tone, 6600 times less than the volume control has: nothing amplifies. With the battery the
wrong way round, 14.4 nA leak through the protection diode and nothing behind it gets more than 13 mV the wrong way
round.

**Within the parts' ratings** (the decision of E1-6, fix round 1). Every part works within its maker's ratings at every
setting of the knob, so a stand and a chapter may show the whole range as normal use:

- the output pair passes 0.37 A at most at the peaks of the tone at full volume (0.36 A with the makers' whole
  models), three quarters of the 500 mA of BC337-25 and BC327-25; the model's heat — the load of the moment filtered
  over 5 s, so the mean load of a tone — settles at a third of the limit (0.33 and 0.31 at full volume, 0.35 at most,
  at 80 %): `'ok'`;
- switched on with every capacitor empty, the output rises to half the supply and charges C2 through the speaker:
  Q2 passes 0.44 A for a moment (0.41 A with the whole models; the test checks the model's), within its rating too;
- the model's `status` compares the power of the moment with Ptot, which is a rating for the mean: so it reads
  `'hot'` for moments while the heat stays below 0.05 — when the amplifier is switched on with its capacitors empty
  (the battery and D1 for the first 1.8 ms, the reservoir's inrush through the battery's 1.5 Ω; Q2 from 1.3 to
  2.3 ms; Q3 at moments between 25 and 56 ms) and, above 94 % of the knob, Q2 at one or two moments of the first
  period of the tone (0.63–0.64 W against 0.625 W). In steady playing no part reads `'hot'` at any setting. A stand
  that glows a part by its condition should glow it by its heat (the memory), as E1-6's report asked of E2.

The first output pair tried, the plan's 2N3904 / 2N3906 with two 1N4148, played the same but did not stay within its
ratings (its row in «Why this circuit»): its peaks passed 200 mA from 71 % of the knob (159 mW on the speaker; 82 %
and 170 mW with the whole models), `status` read `'hot'` at 13–15 % of the moments at 75 % of the knob and at 38–42 %
at full volume, and the switch-on drove 0.45 A through Q2, above 200 mA for 7 ms. Its makers' whole models also fell
far from the model near clipping (IKF of 67 and 80 mA: less than half the model's power at 10 % THD, 247 mW against
552 mW). BC337-25 and BC327-25 are the usual small output pair for an 8 Ω speaker, in TO-92 like the rest.

**Why this circuit** (the decision of E1-6; `amplifier.py` prints the numbers). The plan asked to compare at least two;
here are four, on the same supply and volume control:

| | A: one stage, the 32 Ω earphone | C: driver and one follower in class A, the 8 Ω speaker | D: push-pull pair without a driver, the 8 Ω speaker | B: driver and push-pull pair, the 8 Ω speaker (chosen) |
|---|---|---|---|---|
| transistors | 2N3904 | BC547B, BC337-25 | BC337-25, BC327-25 | BC547B, BC337-25, BC327-25 |
| parts but the supply, the LED and the volume control | 8 | 10 | 9 | 12 |
| gain at 1 kHz, volume at 10 % | 3.92 (THD 0.1 %) | 16.04 (THD 0.4 %) | 0.60 (THD 0.1 %) | 15.59 (THD 1.9 %) |
| power at 10 % THD | not reached: 17 mW at full volume (THD 6.8 %) | 12 mW | not reached: 2.5 mW at full volume (THD 2.8 %) | 545 mW (whole models 482 mW) |
| power with every transistor within its ratings | up to full volume | up to full volume | up to full volume | up to full volume |
| battery current at rest | 47.8 mA | 64.9 mA | 7.7 mA | 13.3 mA |
| hours of the 9 V battery in silence | 10 | under 7 (beyond the chart: 445 mAh at 50 mA) | 79 | 44 |
| battery current playing the tone, volume at 50 % | 47.8 mA (0.2 mW in the earphone) | 70.2 mA (23 mW) | 7.8 mA (0.0 mW) | 51.7 mA (65 mW) |

A is one common-emitter stage — a 2N3904 biased by 6.8 kΩ and 1 kΩ, 4.7 Ω in its emitter, 68 Ω in its collector and the
earphone through 470 μF, on the same supply and volume control. It is the easiest to explain — one transistor, one idea
— but it plays an earphone, not the speaker, at 17 mW at most, and being class A it keeps 44 mA flowing through its
collector whether it plays or not. In silence B's battery lasts about four times longer (44 hours against 10); playing a
steady tone at half volume B draws about as much as A (52 mA against 48 mA). With one or two transistors the 8 Ω speaker
is out of reach: C, B's driver with one BC337-25 following it in class A, must keep its emitter resistor's current
flowing all the time to pull the speaker down (65 mA, a battery for under 7 hours) and still reaches 10 % THD at 12 mW:
its 68 Ω (0.21 W of a 0.25 W resistor's rating, with 3.8 V on it) can pull only about 55 mA out of the speaker; D, B's
push-pull pair without a driver, gives the speaker current but no gain in voltage, 2.5 mW at full volume. B gives the
8 Ω speaker about half a watt (0.55 W in the model, 0.48 W with the whole models, at 10 % THD), takes the least
current at rest of the ones that play the speaker aloud, and adds three ideas, each in one part's sentence (the table
above): feedback from the output to the base (R3, R4), a push-pull pair that takes current from the supply only while
the speaker needs it (Q2, Q3), and two diodes that keep the pair at the edge of opening.

**Three transistors against the design's «1–2».** The design (§10) leaves the builders «1–2 транзистори, 9 V, динамік
8 Ω чи навушник 32 Ω»; the plan (E1-6) narrows it to the simplest that really plays the 8 Ω speaker and allows «не
більше трьох». Within one or two transistors only A plays aloud, and only an earphone; C and D show that on two the
speaker gets tens of milliwatts at best. B therefore takes the plan's third transistor: a departure from §10 that the
report of E1-6 records for the controller to ratify (its deviations), with this table as the evidence. The design's
speed floor (§5.5: an amplifier «на 1–2 транзисторах (≈ 10–15 вузлів)», at least real time) is about the size of the
board: B has 13 nodes. A quick measure in vitest on this machine (E1-6, fix round 1; E1-7 measures properly), one
second of the tone at 48 kHz from rest at half volume, in two sessions of three runs: B in 0.63–0.78 s, C (two
transistors, the same 13 nodes) in 0.44–0.48 s, B with the first pair in 0.69–0.76 s (three runs) — all faster than
real time, none at E1-7's 3×. E1-7's measure, after what it made faster: Speed.

B as it was tried while choosing (`amplifier.py`; the first output pair is in «Within the parts' ratings» above):

| B as tried while choosing | Battery at rest | 10 % | 30 % | 50 % | 70 % | Full volume |
|---|---|---|---|---|---|---|
| chosen | 13.3 mA | 6.1 mW, THD 1.9 % | 28 mW, THD 1.6 % | 65 mW, THD 1.5 % | 156 mW, THD 1.9 % | 641 mW, THD 19.7 % |
| no reservoir | 13.3 mA | 5.6 mW, THD 3.4 % | 26 mW, THD 2.9 % | 61 mW, THD 2.8 % | 147 mW, THD 3.1 % | 601 mW, THD 20.9 % |
| one diode 1N4148 | 23.3 mA | 6.8 mW, THD 0.9 % | 29 mW, THD 1.1 % | 67 mW, THD 1.3 % | 159 mW, THD 1.8 % | 642 mW, THD 19.9 % |
| the speaker to the supply | 13.2 mA | 11 mW, THD 2.0 % | 50 mW, THD 1.4 % | 116 mW, THD 1.2 % | 282 mW, THD 1.0 % | 990 mW, THD 24.2 % |

Without the reservoir capacitor the distortion is about twice as high. Two 1N4148, which held the first pair at 3.9 mA,
would hold BC337-25 / BC327-25, whose IS is larger, at 68 mA; two 1N4007 (the kind of the protection diode) give
1.24 V and 1.94 mA. One 1N4148 with one 1N4007 would keep the pair more open, 12 mA, and halve the distortion of a
whisper (0.9 % against 1.9 % at 10 % of the knob) for 10 mA more from the battery at rest; the two alike were kept for
the battery and for one kind of diode. With the speaker returned to the supply instead of the ground (which feeds the
driver's load from the speaker, a bootstrap) the amplifier gives more — 0.99 W at full volume, with less distortion —
but its peaks then reach 0.43 A, near the pair's 0.5 A, and the bootstrap is a fourth idea that one part's sentence
does not explain.

**The model's transistor against the makers' whole models** in B (`amplifier.py`, the same netlist with each
transistor's whole SPICE model):

| | The model (IS, BF, BR, VAF) | The makers' whole models | Difference |
|---|---|---|---|
| the output at rest | 3.771 V | 3.886 V | +3 % |
| battery current at rest | 13.31 mA | 13.55 mA | +2 % |
| the driver's collector current | 8.36 mA | 8.12 mA | −3 % |
| the output pair at rest | 1.94 mA | 2.42 mA | +25 % |
| gain at 1 kHz, volume at 10 % | 15.59 | 14.21 | −9 % |
| THD at 10 % / 50 % of the volume | 1.88 / 1.51 % | 1.69 / 1.09 % | |
| battery current playing, volume at 50 % | 51.7 mA | 48.4 mA | −6 % |
| clipping sets in: the tone on the volume control | 0.207 V | 0.211 V | +2 % |
| clipping sets in: the power on the speaker | 522 mW | 452 mW | −13 % |
| power at 10 % THD | 545 mW | 482 mW | −11 % |
| power at full volume | 641 mW | 564 mW | −12 % |
| the speaker at full volume, highest / lowest | +2.62 / −2.95 V | +2.41 / −2.86 V | |

At rest the two agree within a few per cent (the idle current of the pair within 25 %: it hangs exponentially on a few
millivolts between the diodes and the two junctions), the small-signal gain within 9 % (RE of 0.47 Ω in BC547B's whole
model and its NF of 1.008 lower the driver's gain), and near clipping within 13 %: the high injection that lowers β
(IKF) sets in at 0.9 and 0.36 A in BC337-25 and BC327-25, at or above the pair's 0.37 A. Both clip the upper half first.
A page that quotes the amplifier's power should say «about half a watt»: the model's 0.55 W at 10 % THD, the whole
models' 0.48 W.

**How much it leans on the driver's β.** BC547B's datasheet gives hFE 200–450 at 2 mA; B with the driver's BF moved
across that spread (the model, `amplifier.py`):

| The driver's β (BF) | The base at rest | R4's current | The driver's base current | The output at rest | R3 and R4 alone would put it at | Gain at 1 kHz, volume at 10 % |
|---|---|---|---|---|---|---|
| 200 | 0.684 V | 38.0 μA | 36.0 μA | 4.169 V | 2.469 V | 13.44 |
| 294.3 (the catalog) | 0.687 V | 38.1 μA | 27.3 μA | 3.771 V | 2.479 V | 15.59 |
| 450 | 0.689 V | 38.3 μA | 19.6 μA | 3.414 V | 2.488 V | 17.58 |

So two formulas a chapter might reach for give the wrong number here. The divider of R3 and R4 alone puts the output at
0.687 V × (47 + 18) / 18 = 2.48 V; it rests at 3.77 V, because the driver's base current (27 μA, 42 % of the 65.6 μA in
R3) also flows through R3's 47 kΩ and adds about 1.3 V. R3 / R2 = 31.3 is the gain the two resistors would set with a
driver of endless gain; one driver gives the feedback too little to spare, so the gain is 15.6 and moves with β from
13.4 to 17.6, as the rest point moves from 4.17 to 3.41 V. The roles of R2, R3 and R4 say this.

## The melody and the player (`music.ts`)

```ts
import { AMPLIFIER_NODES, amplifierNetlist, melodyAt, renderMelody, Transient } from '@electronics/sim/core';

melodyAt(0); // 0: silence at the start, so the operating point of a board with the player is its rest
melodyAt(1.0214375); // 0.98: the loudest moment of the loop (MELODY_PEAK)
const block = new Float32Array(2048);
renderMelody(48000, 0, 2048, block); // the first 2048 samples at 48 kHz, into the stand's own array (it comes back)
renderMelody(48000, 2048, 2048, block); // the next block: the same numbers as that stretch of one long render

// the amplifier playing it: the player in the test tone's place, in blocks of 2048 samples at 24 kHz
const t = new Transient(amplifierNetlist({ source: 'player', volume: 0.5 }), { dt: 1 / 24000 });
t.start('dc');
const sound = new Float32Array(2048); // the speaker's current: what a sound output plays
const scope = new Float32Array(2048); // the output's voltage: what a probe shows
const probes = [
  { part: 'LS1', out: sound },
  { node: AMPLIFIER_NODES.output, out: scope },
];
t.run(2048, probes); // 85 ms of sound; the next call goes on from there, into the same arrays, making nothing new
t.time; // 0.08533 s
```

The melody is the volume's own: its notes are written in `music.ts` and synthesised there — no recording, nobody
else's tune (the design §6.3) — with low notes and high ones in it, so that a filter on the board is heard. A loop of
`MELODY_SECONDS` = 8 s: four bars of 4/4 at 120 beats a minute in A minor, one chord a bar — Am, Fmaj7, Dm, E — in
five voices:

| Voice | Notes | Sound |
|---|---|---|
| bass | E1 … A2, 41.2–110 Hz; one figure of dotted eighths, sixteenths and eighths a bar | a sine with a quarter of its octave |
| chords | Am (A3 C4 E4), Fmaj7 (F3 A3 C4 E4), Dm (F3 A3 D4), E (G♯3 B3 E4), 175–330 Hz, struck on the off-beat of every beat | sines, each with a fifth of its third harmonic |
| melody | D5 … E6, 587 Hz – 1.32 kHz | a sine with its second (0.35) and third (0.25) harmonics: up to 3.96 kHz |
| kick | beats 1 and 3, and a push a sixteenth before the fourth beat of bars 2 and 4 | a tone falling from 120 Hz to 45 Hz, with a click of noise |
| snare, hi-hat | beats 2 and 4; every eighth, the off-beats louder | the noise of the generator: as it is for the snare (with a tone of 190 Hz), its differences — its high frequencies — for the hi-hat |

Every note swells in a straight line over its first milliseconds, fades as e^(−τ/decay) and falls to zero in a
straight line over its last tens of milliseconds: the melody is a continuous function of time, silent at its start and
at the turn of the loop, and any moment can be computed alone — the operating point (t = 0), a moment inside a step of
the transient, any sample of any block. The noise is the generator mulberry32 read by its index — its j-th number from
the seed 0x2F6B9E1D is a mix of the seed and j·0x6D2B79F5 — 48 000 numbers a second joined by straight lines: the
noise at a moment needs no number before it, and it repeats with the loop. No chance, no clock: the purity test reads
this file too.

Its numbers (the test checks them): within ±1, the loudest moment `MELODY_PEAK` = 0.98 at 1.0214 s (the third beat of
the first bar: the kick, the bass and the melody's E5 together; the gain of 0.8475 puts it there), sampled every
1/192 000 s; the RMS 0.271; of its RMS 0.77 below 150 Hz and 0.12 above 2 kHz (through two second-order Butterworth
sections each way, at 48 and at 24 kHz alike; a tone of 600 Hz has under 0.01 in either); continuous — at every
sixteenth, where notes begin and end, to its slope over two nanoseconds, and its largest step between neighbouring
samples halves with the sample (0.07 at 192 kHz: the snare's noise). Rendering it costs about 4 ms a second of sound
(«Speed»).

`melodyAt(t)` is the melody at the moment `t` (s), the loop repeating (and before 0 too). `renderMelody(fs,
startSample, n, out)` writes `n` samples at `fs` (Hz) into `out` — a `Float32Array` or a `Float64Array` of the stand's,
which comes back — the k-th at (startSample + k)/fs s: it allocates nothing, and blocks from any sample are, number for
number, one long render. A rate that is not a finite number above 0, a start that is not a whole number, or `n` not a
whole number from 0 to `out.length` is a `RangeError`.

**The player** (`player`, its own kind): the melody times its amplitude — the setting, 0.3 V when absent — behind
32 Ω, in the Norton form of a battery (the plan: «напруга = мелодія × амплітуда (0,3 V за замовчуванням) з внутрішнім
опором 32 Ω»). Straight on 10 kΩ it gives 0.3 V × the melody × 10 000 / 10 032 at every sample (the test: within 1e-7
V, the precision of a `Float32Array`); at the operating point 0 V; at the setting 0 it is stopped. Newton's iterations
solve one moment several times: the part keeps the melody of the last moment it was asked for.
`amplifierNetlist({ source: 'player' })` puts it in the amplifier. It has no case of the oracle: what it gives is
checked against `renderMelody`, and the circuits it drives are checked against ngspice with the tone `player-tone`.

**Playing in blocks.** A block is `run(n, probes)`: a stand asks for n samples — 2048 at 24 kHz are 85 ms, at 48 kHz
43 ms (the design: blocks of 50–100 ms) — with the probes it reads, the speaker's current for the sound and node
voltages for the scope, into its own arrays; the next call goes on from the last moment, and the blocks joined are one
long run (the test: six blocks of 2048 samples of the amplifier playing the melody, to the last bit). A run in blocks
makes nothing new: the transient's arrays, readings, matrix and state and the probes' arrays are the same objects block
after block (the test holds them by reference), and `run` keeps its list of what to record, growing it only for more
probes than it was ever given.

## Speed

The sound and the oscilloscope live only if the model computes the board at the audio rate faster than the sound plays
(the design §5.5, §6.3). The measure is `__tests__/speed.bench.ts` (`vitest bench`, after the radio volume's
`fm-link.bench.ts`: its name does not end in `.test.ts`, so `pnpm test` does not run it):

```bash
cd app && pnpm exec vitest bench src/volumes/electronics/sim --run --reporter verbose
```

It plays in blocks of 2048 samples, from the operating point and after a second of sound to warm up: the amplifier of
the volume with the melody at half volume (the probes: the speaker's current, the speaker's and the output's voltage)
and, beside it, an RC low-pass on the player (1 kΩ and 100 nF; the capacitor's and the player's voltage), at 48 000 and
24 000 samples a second, the low-pass at 48 kHz in four substeps too, and the melody alone. Each in five runs of a
second; a run's speed is seconds of sound per second of computing, the blocks a second (tinybench's mean throughput)
× 2048 / the rate. Node 24.22.3, vitest 5.1.0; an Intel Core i9-13900KS (eight cores to 5.6–6 GHz and sixteen of
4.3 GHz), one thread; the machine ran other work at the same time (load average 14 at the start of the run, 8 at its
end); 20.11.2026. The amplifier at 24 kHz is the case the bench asserts (median ≥ 3).

| Board | Rate (Hz) | The five runs | Min / median / max | Before E1-7: median (two runs) |
|---|---|---|---|---|
| amplifier, melody | 48 000 | 3.26 3.25 3.27 3.19 3.24 | 3.19 / **3.25** / 3.27 | 1.33; 1.31 |
| amplifier, melody | 24 000 | 5.15 5.34 5.59 5.40 5.45 | 5.15 / **5.40** / 5.59 | 2.34; 1.31 (0.95–2.37: a burst of other work) |
| RC low-pass | 48 000 | 54.7 53.5 53.6 53.0 52.6 | 52.6 / 53.5 / 54.7 | 25.9; 12.4 |
| RC low-pass | 24 000 | 104.7 105.2 105.0 105.0 105.8 | 104.7 / 105.0 / 105.8 | 49.5; 25.2 |
| RC low-pass, four substeps | 48 000 | 19.1 19.0 18.1 18.9 19.7 | 18.1 / 19.0 / 19.7 | —; 5.8 |
| the melody alone | 48 000 | 251 254 252 250 249 | 249 / 251 / 254 | 176; 184 (the same code) |

«Before E1-7» is the model of E1-6 with only the melody and the player added, measured by the same bench: once before
any change (load average 16) and once in one session with the final code (the before-run first, load 3 to 12). The
same in plain Node, without the test runner, on one core of 6 GHz (`taskset`), five runs of two seconds of sound:
the amplifier with the melody 3.09 at 48 kHz and 5.61 at 24 kHz; with the tone of 1 kHz, which takes more iterations
than the melody, 2.78 against 1.94 before at 48 kHz and 4.84 against 3.51 at 24 kHz.

**Live, at 24 000 samples a second** (the decision of E1-7, by the plan's rule: at least three times real time on this
machine at the chosen rate — the margin for a phone and a background thread). The amplifier playing the melody runs
5.4 times faster than it plays at 24 kHz: a block of 2048 samples, 85 ms of sound, takes about 16 ms. At 48 kHz it runs
3.25 times — over the floor on this machine, but with nothing to spare beyond it (3.11 in a run beside heavier work),
so 48 kHz is not the volume's rate. The loop computed beforehand (the design §6.3, the fallback) is not needed here;
whether a phone plays live is for E1-9 and E2 to measure — a phone four times slower than this core would still play
the amplifier at 1.35 times real time at 24 kHz. At 24 kHz the speaker hears up to 12 kHz: the melody's notes reach
4 kHz and its hi-hat beyond. A stand that shows a filter's response near 10 kHz takes `substeps` (What the trapezoid
answers): the same moments as 48 kHz in four substeps are 24 kHz in eight, and a linear board can afford them — the
RC low-pass plays at 105 times real time at 24 kHz in one step a sample.

What made it fast (each measured by the bench or the profiler of Node on the amplifier):

- **Fewer of Newton's iterations** (Moments fast): the predictor's line and the transient's rule of exactness, 3.93 →
  2.67 factorizations a moment at 48 kHz; every moment of the oracle's circuits in time now takes two.
- **No lookup of an import in a loop.** Under the test runner every read of an import is a lookup on the module's object
  (vitest warns: «accessed module export getters too many times»), and the transient read some for every part at every
  moment (`readPart`, `loadOf`, `conditionOf`, `checkSetting`) and the transistor at every iteration (`GMIN`,
  `THERMAL_VOLTAGE`, `pnjlim`). They are read once per module now (the radio volume's rule: no loop over samples reads an
  import): the amplifier at 48 kHz went from 1.84 to 2.76 under the test runner by this alone. A bundled build (the site,
  the worker) has no such lookup; the bench no longer prints the warning.
- **A factorization that skips the zeros** (`mna.ts`): 704 ns against 846 for the amplifier's 20 × 20 matrix (64 numbers
  that are not zero, 133 after the factorization), the same factors to the bit. The residual of the guess
  (`quietAt`, about 300 ns) is computed only when a step of Newton is not exact, from a copy of the rows kept before the
  factorization — the same answers as before.
- **A linear circuit keeps its factors** (Moments fast): the RC low-pass from 25.9 to 53.5 times real time at 48 kHz.

Tried and left out: a parabola through the last three moments as the predictor (2.62 iterations against the line's 2.67
with the melody: not worth a third array), SPICE's own RELTOL of 1e-3 as the transient's rule (2.19 iterations, but
nodes 1e-4 V away from the operating point's rule), skipping the zeros in the solve and the residual (no faster: the
branches cost what the products saved), and the rows under a pivot listed during its search (no faster). What remains:
the factorization (about 30 % of the time), the solve and the residual (about 20 %), the parts' stamps with their
exponentials (about 20 %); a sparse factorization that keeps its order of pivots from one iteration to the next would
take most of the first, but it needs to know when the pattern of the matrix changes — left for when a phone needs it.

## Modules

| Module | What it does |
|---|---|
| `netlist.ts` | `Netlist`, `PartInstance`, `GROUND`; `checkNetlist` and `checkSetting` (the `RangeError`s above) |
| `parts.ts` | The catalog `PARTS`, `E12`, `E24`, `resistorKey`, `WIRE_OHMS`; the types of the parts (`PartSpec`, one interface per kind, `JunctionParams`, `TransistorParams`, `Polarity`, `Limits`, `Dielectric`); `Behaviour`, `FailedForm`, `Placement`, `Operating`; `behaviour(spec)` — how a kind of part sits in the matrix; the sine source, ideal or behind its internal resistance; the player (`PlayerSpec`) |
| `mna.ts` | The dense LU with partial pivoting that skips the zeros (`createSystem`, `factor`, `solveFactored`; `LinearSystem.factorizations` counts the factorizations); `compile` (unknowns: the nodes in use, the parts' own nodes, then the currents of the parts that need one; the parts' memory and history; the scratch of the iterations); the `Stamper` the parts write with (conductance, current, transconductance, ideal source); `readSettings`, `updateSettings`; `assemble` (clear, stamp every part around a guess, leave the burnt ones out, stamp the bulged ones' failed form, tie) and `assembleRight` (the right-hand side alone, for factors kept); the damage codes `BURNT`, `BULGED` |
| `topology.ts` | `analyse` — the issues and the nodes to tie, by union–find over the links of the parts (a burnt part has none) |
| `dc.ts` | `solveDC` — one solve, or Newton's iterations with source stepping — `DcSolution`, `PartReading`, `DcOptions`, `MAX_ITERATIONS`; `newton` (one go of the iterations, which the transient takes at every step; `Go`, `newGo`; its rule of exactness `Exactness`, the operating point's `OPERATING_EXACTNESS`), `readPart`, `damageIn`, `failureIn` |
| `diode.ts` | SPICE's junction: `ROOM_KELVIN`, `THERMAL_VOLTAGE`, `GMIN`, `junctionOf`, `junctionCurrent`, `pnjlim`, `limitJunction`, `forwardVoltage`, `ledLumens`, `diodeBehaviour` |
| `lamp.ts` | The tungsten filament, steady and in time: `TUNGSTEN_EXPONENT`, `filament`, `filamentCapacity`, `lampBehaviour` |
| `capacitor.ts` | The capacitor — ESR, capacitance, leak; its companion in time; its bulged form: `capacitorBehaviour`, `BULGED_OHMS` |
| `limits.ts` | `loadOf`, `conditionOf`, `WARM_LOAD`, `HEAT_SECONDS`, `heatStep`, `burnSeconds`, `limited`, `canBurn`, `failureOf`, `damageOf`, `fail`, `advanceHeat`; `Condition`, `Failure`, `PartStatus` |
| `transient.ts` | `Transient` with `TransientOptions`, `TransientStart`, `Probe`; `EULER_STEPS`, `TRANSIENT_EXACTNESS` |
| `transistor.ts` | The bipolar transistor, the transport form of Ebers–Moll: `transistorAt`, `TransistorPoint`, `transistorVcrit`, `transistorBehaviour` |
| `amplifier.ts` | The amplifier of the volume: `amplifierNetlist`, `AmplifierOptions`, `AMPLIFIER_NODES`, `AMPLIFIER_ROLES`, `AmplifierRole` |
| `music.ts` | The volume's melody: `melodyAt`, `renderMelody`, `MELODY_SECONDS`, `MELODY_PEAK` |
| `state.ts` | `ModelState`, `PartMemory`, `createModelState`, `memoryOf`, `levelOf`, `keepLevel` |
| `index.ts` | the public entry |

## Adding a kind of part (E1-6 and later)

A kind is four things:

1. its spec interface in `parts.ts`, added to the union `PartSpec`, and its entries in `PARTS`;
2. a `Behaviour` (`parts.ts` for a simple linear kind, a module of its own otherwise, as `diode.ts`, `lamp.ts`,
   `capacitor.ts` and `transistor.ts`) and one more `case` in `behaviour(spec)`;
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
(a current through the part from node `a` to node `b`), `transconductance(a, b, p, q, g)` (a current g·(v(p) − v(q))
through the part from `a` to `b`: a transistor's collector current, which its junctions control), `voltage(plus,
minus, branch, volts)` — by node numbers, the part's own nodes (`at.inner`) too; a conductance or a current from a node
to itself (a part with both legs in one row) is not stamped at all, since adding and taking away a jumper's 1000 S
would round away the GMIN beside it, nor a transconductance from a node to itself or controlled by a node against
itself. A part
stamps around the guess `op: Operating`: the node voltages `op.v`, the share `op.sources` a source gives (it
multiplies its voltage by it), `op.initial` (the first iteration from nothing: a junction linearizes at its memory),
`op.limited` (a part that limited its step sets it: the iterations go on), and the moment: `op.time` (a sine reads
it), `op.dt` (0 at the operating point; the step in time, when a part with a state stamps its companion from its
history) and `op.trapezoid` (the trapezoid, or backward Euler). A nonlinear part stamps its linearization: its slope
as a conductance (a transistor: as transconductances) and the current that makes up the rest.

## Tests

```bash
cd app && pnpm vitest run src/volumes/electronics/sim                                 # the whole model
python3 tools/ref-models/electronics/spice.py --check                                 # are the samples fresh?
python3 tools/ref-models/electronics/amplifier.py                                     # the amplifier's tables
cd app && pnpm exec vitest bench src/volumes/electronics/sim --run --reporter verbose  # the speed (Speed)
```

`__tests__/`: `purity` (the text of every file), `parts` (the catalog, the published diodes, the fitted LEDs, the
player's tone and the player), `mna` (the LU and the stamps; both legs in one row stamp nothing; a transconductance), `dc` (linear
circuits by hand: a divider, the batteries under load, a grid of five resistors, the pot at 0 / 0.5 / 1, a switch, the
speaker; the worked example above; a
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
1.2 s, then a leak of 1 kΩ, at the operating point too), `transistor` (the catalog with the makers' numbers;
the formula against SPICE's equations in every region, the Early effect, the slopes against differences, the
formula at ngspice's node voltages within 1e-4; Vcrit and the start; both junctions limited by `pnjlim`, an NPN's and a
PNP's; a transistor driven hard from cold; 2000 random boards; the switch — BC547B, its base through 10 kΩ from 9 V,
the red LED with 330 Ω in its collector — against ngspice within ± 3 % (21.11 mA), and with its base on the ground
under 1 μA; a transistor over its limits burns into a gap), `amplifier` (the netlist of the stand is the one ngspice
solved; every node named and every part's role in a chapter of its kind; at rest every node within 1 % of ngspice;
the gain at 1 kHz on a small signal within 2 %; the output against the input at 50, 80, 90, 95 and 100 % of the
volume and the waveform within 3 %; where clipping sets in within 5 %; switched off, 45 μV; the battery the wrong way
round, under 1 μA; within its parts' ratings — at full volume the output pair's peaks 0.37 A, under three quarters
of its 0.5 A, its mean load under 0.4 and nothing `'hot'` after the first period, and switched on from empty
capacitors a surge of 0.44 A; the worked example above), `transient` (every sample in time against ngspice, the
plan's tolerances: the RC charge and discharge within 1 % at 20 moments with 63.2 % and 36.8 % ± 0.5 % after
R·C; the LED fed by 470 μF within 2 %; the rectifier's output, mean and ripple within 3 %; the filters sampled at
1/48000 s in four steps of integration within 1 % of `.ac` at 100 Hz, 1 kHz and 10 kHz, and in one step against
`.ac` where the trapezoid answers, within 1e-5 — the low-pass at 10 kHz then 14.4 % low, tested as such; halving the
step, under 0.1 %; the trapezoid's second order; no ringing after a stiff jump; the lamp's inrush; parts that burn in
time; the worked example above; start, run, set, rebuild, a failed step, `substeps` as the shorter step bit for bit
and a step that fails in its second step of integration undone whole; a linear board keeping the factors of its
matrix, and the amplifier playing the melody in fewer than three iterations a moment), `music` (the melody: two
renders bit for bit and blocks as one render, within ±1 from 24 to 192 kHz with its peak at 0.98, its bass below
150 Hz and its high notes above 2 kHz, silent at the start, looping every 8 s, continuous; the player: a source without
limits, the melody × its amplitude behind 32 Ω at every sample, its setting; the amplifier playing it in six blocks of
2048 samples as one long run, and a run in blocks that makes nothing new; the worked example above), `oracle` (every sample of `__fixtures__/` at the
operating point against the model: relative difference ≤ 1e-6 for the linear samples and ≤ 1e-3 for the nonlinear
ones — the plan's tolerances — for every number, the smallest too, with no absolute allowance; where ngspice gives an
exact zero — the ground, a part behind an open switch — the model must give an exact zero; at most 50 iterations and
no source steps; and that every sample on disk is compared here, in `transient` or in `amplifier`). The samples are
written by `tools/ref-models/electronics/spice.py` from `cases.py` (its README); the model and ngspice agree on them
to 4e-10 for the linear ones, the rounding of the samples, and to 1.6e-8 for the nonlinear ones, the tolerance to which
both sides settle — but for the power in the 1 kΩ before the reversed LED of `diode-reverse` (8.1e-20 W: 9 pA and 9 nV,
the difference of two nodes at 9 V), where the rounding of those nodes on either side leaves 8e-7. In time they agree
far inside the plan's tolerances: the RC curves to 3.2e-6, the LED's current to 3.9e-7, the rectifier's output to
9.5e-7 and its mean and ripple to 0.01 %, at the steps the tests take (1 ms, 0.1 ms, 1/48000 s; ngspice steps at
most 1 ms, 0.1 ms and 5 μs with its tolerances tightened). With transistors (their operating points too are solved by
ngspice with its tolerances tightened, `spice.py`): the seven transistors in their regions to 3.5e-10, the amplifier
at rest to 3.6e-10, the switch to 5.4e-5 — the current of the LED behind the transistor that is off, 8.3 pA, whose last
digits are the rounding of nodes at 9 V on either side; the amplifier playing to 8.3e-5 in the amplitudes and 1.1e-4
of the swing in the waveform at 1/48000 s; with the battery the wrong way round, where every node behind the protection
diode is a rounding of next to nothing, the diode's and the battery's current to 7e-5 (`amplifier` tests those).
