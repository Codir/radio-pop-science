/**
 * Scene of the bench's sandbox (`index.ts` holds its words): `mountBench` and its shots. Steps:
 *   room  — the main shot `stand` (on a phone the bench makes it `phone`: the field of sockets only);
 *   board — the field of sockets close (`board`), where the board's print can be read;
 *   meter — the multimeter comes in from the left of the frame, shot `meter`; an empty board, the probes lying free
 *           by the meter (E2-6): they may be taken, the meter reads «—» until both are in sockets; the dial's switch
 *           `meter-mode` and the number `meter` are in the panel;
 *   scope — the oscilloscope (E2-9), shot `scope`: the amplifier of E1-6 (`AMPLIFIER_PRESET`) with a low-pass between
 *           the player and its volume control (`filterParts`: the player's plug in 17fj, R6 along the line h to 13fj,
 *           100 nF C4 to the ground row 15fj, J11 across the channel to the volume control's top 13ae; J2 moved to the
 *           line d and J1 to the ground row 15fj to make room), the switch closed; the probe of channel 1 in j17 (the player's signal, before the
 *           filter), of channel 2 in j13 (after it); a sweep of 2 ms and 0.1 V a division, triggered on channel 1; the
 *           panel's switch `filter` puts 1, 4.7 or 10 kΩ in R6 (a new board: the model starts again); the board chart
 *           `scope-scope` and the instrument's screen show the same samples;
 *   rc    — a capacitor charging (E2-9), shot `scope`: + rail → J1 → 3ae → 10 kΩ → 7ae → 100 μF → J2 → − rail (`RC`),
 *           the switch open; channel 1 in e3 (before the resistor), channel 2 in e7 (on the capacitor); a roll of
 *           0.5 s and 2 V a division with 0 V three divisions below the middle; the reader closes the switch (a tap on
 *           the slider, on a phone the dock's toggle) and τ = R·C = 1 s shows on channel 2 (the board chart `scope-rc`),
 *           with the scope's cursor at 63 % of 9 V on channel 2 (E4-S): its dashed line, and a marker where the trace
 *           crossed it that moves left with the roll;
 *   offset — the oscilloscope's offset (E4-S), shot `scope`: the amplifier (`AMPLIFIER_PRESET`), the switch closed;
 *           channel 1 in e5 (the supply behind the guard diode), channel 2 in −5 (the − rail, 0 V); a sweep of 50 ms
 *           and 0.05 V a division with 0 V 165 divisions below the middle: the screen 8.05 … 8.45 V, the − rail on its
 *           bottom edge (the board chart `scope-offset`);
 *   shot  — a single shot (E4-S), shot `scope`: + rail → J1 → 13ae → film 1 μF → 15ae → 10 kΩ across the channel →
 *           J2 → − rail (`SHOT`, the board of `filter/block`), the switch open; channel 1 in e13, channel 2 in e15; a
 *           sweep of 5 ms and 2 V a division, a division before the edge, triggered once on channel 2 rising through
 *           1 V (`auto` off): the reader closes the switch, and the jump caught stays — on a held page too (the board
 *           chart `scope-shot`);
 *   parts — one part of every kind of the model's catalog on the board and a row of resistors 1 Ω … 1 MΩ (`PARTS`),
 *           shot `board`: the tall parts at the far half — the LEDs, the pot, the three capacitors and the transistor —,
 *           the low ones at the near half, a jumper across the near half; every one a part of the circuit (the switch
 *           open);
 *   hand  — the reader's hand (E2-5), shot `stand`: an empty board, the tray (`TRAY`: three resistors and a jumper in
 *           front, two LEDs behind), the plugs of the speaker, the player and the lamp lying loose, the switch open;
 *           everything may be taken. On a phone the tray's slots are buttons of the dock (`tray-<key>`, VISUAL §9), and
 *           the battery's switch, which the shot `phone` leaves out, is the dock's toggle `battery-switch`;
 *   divider — the model on the bench (E2-6), shot `meter`: + rail → jumper → 3ae → 1 kΩ → 7ae → 2 kΩ → 11ae → jumper
 *           → − rail (`DIVIDER`), the battery's switch closed, the multimeter on the table in V, its probes free by it;
 *           everything may be taken, so the checks put the probes, take a jumper's end out for the A mode and turn the
 *           dial (`meter-mode`);
 *   led   — the light of the model (E2-7), shot `board`: three branches from rail to rail, 330 Ω and an LED each —
 *           red, green, blue (`LEDS`) — the switch closed; each LED glows by its current, the brightest three (all) light
 *           the board; everything may be taken;
 *   overload — 100 Ω straight between the rails (`OVERLOAD`), shot `stand` (the tray in it), the switch closed:
 *           ≈ 0.8 W on 0.25 W — it warms, burns after ≈ 3.8 s of the model's time with one wisp and stays a gap; a new
 *           100 Ω in the tray (on a phone the dock's button `tray-resistor-100`), set down in b9, closes the circuit again;
 *   lamp  — the lamp from the battery through 15 Ω + 15 Ω (`LAMP`), shot `stand`, the switch closed: ≈ 5.9 V on it,
 *           its filament's temperature from the model lights the room;
 *   bulged — an electrolytic the wrong way round (E2-9), shot `board`: + rail → J1 → 3ae → 100 μF / 6.3 V with its
 *           minus in 3ae and its plus in 4ae → J2 → − rail (`REVERSED`), the switch closed: 9 V against its 1 V the
 *           wrong way round, a load of 9 — the model bulges it after ≈ 1.2 s (E1-5), the bench lets one puff of steam
 *           out of its vent on that event, and it stays bulged until it is taken out;
 *   loupe — the magnifier as the door (E2-8, `shared/dive`), shot `board`: a 4.7 kΩ in a5 … a9 (`LOUPE`); the dock's
 *           slider `depth` 0 … 1 + LENS_LEG is the door's rail + LENS_LEG — a drag scrubs it, a click or a key glides
 *           in the flight's time (shorter with reduced motion), a tap on the resting lens lays it over the part; the
 *           ladder «де ми» shows the floor (`benchLadder`: the volume's floors, here in `_dev` too); everything may be
 *           taken while the camera is on the board's shot, nothing while it flies. Leaving the step, the rail flies
 *           back to the board's shot first, then the next step's camera takes over and the door is given up;
 *   film  — inside the resistor (E3-5, `shared/inside`), shot `board`: the red LED's loop (`LED_LOOP` of `sim/board`:
 *           J1, 330 Ω in b5 … b9, the LED in c9/c10, J2), the switch closed; the same door and slider as `loupe` lead
 *           into R1, whose floor `inside` is its carbon film — the groove cut for the value, the electrons at the model's
 *           current, the film's colour from the model's heat; the dock's switch `film-value` puts a 330 Ω or a 10 kΩ in
 *           R1's sockets (a new part under the same id, whole: the door follows it). Probes `film:film`, `film:groove`,
 *           `film:rod` — the callouts' points of the film;
 *   plates — inside an electrolytic (E4-I, `shared/inside/plates.ts`), shot `board`: the board of `capacitor/store`
 *           (the LED's loop, J3 + rail → 12ae, J4 13ae → − rail, C1 470 μF in c12/c13), the switch closed; the same door
 *           and slider lead into C1, cut in half: two plates, the insulator, the charges from the model's voltage across
 *           the capacitance, the electrons in the legs at its current. The dock's switch `plates-can` puts a 10, 100,
 *           470 or 1000 μF can in C1's sockets; the toggle `plates-switch` is the battery's switch and works while the
 *           camera is inside; the toggle `plates-flip` stands C1 the other way round (a new part, whole), and with the
 *           switch closed the model bulges it — the insulator cracked. Probes `plates:plus`, `plates:minus`,
 *           `plates:insulator` — the callouts' points;
 *   roll  — inside a film capacitor (E4-I, `shared/inside/roll.ts`), shot `board`: C1 1 μF in e8/e10 alone (the board of
 *           `capacitor-kinds/film`), the switch open; the door into C1, cut in half but for the corner by leg 1,
 *           whose face across the winding shows the turns: the roll of metallised film, its sprayed ends and the
 *           leads. Probes `roll:metal`, `roll:film` — the callouts' points;
 *   print — a part's print down at the part (E4-B, VISUAL §9's exception), shot `board`: C1, a ceramic disc of 100 nF,
 *           alone in e8/e10 (the board of `capacitor-kinds/ceramic`), the switch open; the same door and slider lead
 *           to it: on the floor `part` its code «104» reads by the desk's rule (≥ 16 px-equivalent) on a phone too —
 *           the bench's `PartEye.close` on the floors `part` and `inside` (`bench.atPart`); on the step's shot and on
 *           the floor `stand` of the flight a phone shows no print;
 *   timed — the bench in time (E4-T, `shared/model/timed.ts`), shot `board`: the board of `capacitor/store` with C1
 *           470 μF in c12/c13, the switch closed, the multimeter on V with its probes on the can's rows (d12, d13);
 *           `bench.timed`, so the LED's light, the meter and the door's plates show the board in time's last moment —
 *           opened, the switch leaves the LED fading as the can gives its charge. The dock: the time from the switch's
 *           opening to the LED's current below 1 mA (`timed-fade`, the board in time's threshold watch), the meter's
 *           number (`timed-meter`), the battery's switch (`timed-switch`, working while the camera is inside), the can
 *           (`timed-can`: 10, 100, 470 μF or none — a new board, started again from its operating point) and the same
 *           door and slider as `plates` into C1;
 *   sound — the speaker in sound (E2-10), shot `stand`: the player → a 10 kΩ pot as the volume control → the speaker
 *           (`VOLUME`: P1 in b17 … b13 — `ccw` on the ground row 17ae, J1 from it to the − rail, the wiper 15ae, `cw`
 *           13ae; the plugs `pl+` in c13, `pl-` in c17, `spk+` in c15, `spk-` in a17); the panel's slider `volume`
 *           is P1's setting, the knob follows it; at 0 the wiper is on the ground and the speaker silent. The bench is
 *           mounted with its option `sound`: the speaker plays in every step where it is in the circuit (`scope` too).
 * Every other step has an empty board and an empty tray, and the probes at rest. Readers: the bench's own
 * `electronics-bench` (sockets, rows, draw calls, the print shown), `electronics-board` (the parts and their legs, the
 * plugs, the settings, the netlist's key), `electronics-parts` (every model: where, draw calls, its print),
 * `electronics-hand` (what the hand holds, the preview, the lit rows), `electronics-motion` (the camera, what the hand
 * moves, the plugs — every frame), `electronics-model` (the circuit model: its key, solves, dcMs, readings) and
 * `electronics-meter` (the dial, the probes' sockets, the reading and the display's text), `electronics-scope` (the
 * model in time, the sweep, its points and hash, a held page's windows), `electronics-sound` (the sound output, the
 * speaker in the circuit, its blocks' levels and hash), `electronics-timed` (the board in time: on, its moment, starts,
 * its steps, the last moving frame's steps and cost, its watches, the cans' volts, its hash) and, in the steps with a
 * door,
 * `electronics-dive` (the door's rail, the floor, whether it flies, the cut); probes `socket:<id>` for every socket of
 * the board (`a1` … `j17`, `+1` … `+17`, `-1` … `-17`), the hand's `part:<id>`, `leg:<id>:<k>`, `tip:<id>:<k>`,
 * `lead:<name>`, `end:<name>`, `probe:<red|black|ch1|ch2>` (the grip on a probe's handle; its tip `end:<name>`),
 * `tray:<key>`, `switch`, and the door's `dive:end0`, `dive:end1`, `dive:ring-top`, `dive:ring-bottom`.
 */
import { Vector3 } from 'three';
import { fmtSI, fmtUnit } from '@/content';
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import {
  AMPLIFIER_PRESET,
  LED_LOOP,
  PARTS as CATALOG,
  mountBench,
  setSetting,
  trayLabel,
  type BenchShot,
  type HandKey,
  type PresetPart,
  type SocketId,
} from '@electronics/shared/bench';
import {
  LENS_LEG,
  benchLadder,
  floorAt,
  lensKeeper,
  partDoor,
  type Door,
} from '@electronics/shared/dive';
import {
  asFilm,
  asPlates,
  asRoll,
  type FilmAnchor,
  type PlatesAnchor,
  type RollAnchor,
} from '@electronics/shared/inside';
import { SANDBOX } from './index';
import {
  METER_MODES,
  type MeterMode,
  type ScopeProbeName,
  type ScopeSettings,
  type ScopeSetup,
} from '@electronics/shared/instruments';

/** Step `parts`: one part of every kind of the model's catalog that stands on the board. */
const PARTS: readonly PresetPart[] = [
  // the far half: the tall parts, so they hide nothing behind them
  { id: 'LED1', spec: 'led-red', at: 'a1' },
  { id: 'LED2', spec: 'led-yellow', at: 'a4' },
  { id: 'LED3', spec: 'led-green', at: 'a7' },
  { id: 'LED4', spec: 'led-blue', at: 'a10' },
  { id: 'LED5', spec: 'led-white', at: 'a13' },
  { id: 'P1', spec: 'pot-10k', at: 'd1', setting: 0.3 },
  { id: 'C1', spec: 'ceramic-100n', at: 'd7' },
  { id: 'C2', spec: 'film-100n', at: 'd11' },
  { id: 'C3', spec: 'electrolytic-470u-16v', at: 'a16' },
  { id: 'Q1', spec: 'transistor-bc547b', at: 'd15' },
  // the near half: the row of resistors 1 Ω … 1 MΩ, the two diodes, a jumper across the strips
  { id: 'R1', spec: 'resistor-1', at: 'f1' },
  { id: 'R2', spec: 'resistor-10', at: 'f7' },
  { id: 'R3', spec: 'resistor-100', at: 'f13' },
  { id: 'R4', spec: 'resistor-1k', at: 'h1' },
  { id: 'R5', spec: 'resistor-10k', at: 'h7' },
  { id: 'R6', spec: 'resistor-100k', at: 'h13' },
  { id: 'R7', spec: 'resistor-1M', at: 'j1' },
  { id: 'D1', spec: 'diode-1n4148', at: 'j7' },
  { id: 'D2', spec: 'diode-1n4007', at: 'j13' },
  { id: 'J1', spec: 'jumper', at: 'f6', o: 1 },
];

/** Step `hand`: the tray's kinds — the low ones go to its front row, the LEDs behind (the tray picks by size). */
const TRAY = ['resistor-1k', 'resistor-4k7', 'resistor-330', 'jumper', 'led-red', 'led-green'] as const;

/**
 * Step `divider`: + rail → jumper → 3ae → 1 kΩ → 7ae → 2 kΩ → 11ae → jumper → − rail. The middle row 7ae has a free
 * socket a7 for the red probe; the jumper J2 can give its place to the meter (the A mode).
 */
const DIVIDER: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
  { id: 'R1', spec: 'resistor-1k', at: 'b3' },
  { id: 'R2', spec: 'resistor-2k', at: 'c7' },
  { id: 'J2', spec: 'jumper', at: 'e11', to: '-11' },
];

/**
 * Step `led`: three branches from the + rail to the − rail, each a jumper → 330 Ω across the channel → an LED along
 * the line g → a jumper: red in columns 3–4, green in 8–9, blue in 13–14 (VISUAL §2: three colours lit at once).
 */
const LEDS: readonly PresetPart[] = (
  [
    [3, 'led-red'],
    [8, 'led-green'],
    [13, 'led-blue'],
  ] as const
).flatMap(([c, spec], k) => [
  { id: `J${2 * k + 1}`, spec: 'jumper', at: `+${c}`, to: `a${c}` },
  { id: `R${k + 1}`, spec: 'resistor-330', at: `b${c}`, o: 1 as const },
  { id: `LED${k + 1}`, spec, at: `g${c}` },
  { id: `J${2 * k + 2}`, spec: 'jumper', at: `j${c + 1}`, to: `-${c + 1}` },
]);

/**
 * Step `overload`: + rail → jumper → 9ae → 100 Ω along the line b → 13ae → jumper over the channel → − rail: ≈ 0.8 W on
 * 0.25 W. A new 100 Ω from the tray lands along a line too (`o` 0): set down in b9 it closes the circuit again.
 */
const OVERLOAD: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+9', to: 'a9' },
  { id: 'R1', spec: 'resistor-100', at: 'b9' },
  { id: 'J2', spec: 'jumper', at: 'e13', to: '-13' },
];

/**
 * Step `lamp` (VISUAL §4.6): + rail → the lamp → 3ae → 15 Ω across the channel → 3fj → 15 Ω → 7fj → jumper → − rail;
 * the lamp's plugs in +2 and a3 (within its leads' reach, on the left half).
 */
const LAMP: readonly PresetPart[] = [
  { id: 'R1', spec: 'resistor-15', at: 'b3', o: 1 },
  { id: 'R2', spec: 'resistor-15', at: 'g3' },
  { id: 'J1', spec: 'jumper', at: 'j7', to: '-7' },
];
const LAMP_LEADS = { lamp1: '+2', lamp2: 'a3' } as const;

/**
 * Step `scope`: the amplifier on the board with a low-pass between the player and its volume control — the step
 * `filter/lows` of PATH.md, E1-9's `filterBoard` (shared/sound/README.md, «The board»: a filter straight on the 8 Ω
 * speaker would not filter, and here, in front of the volume control, it does). The player's plug moves from the
 * volume control's top (13ae) to 17fj; R6 along the line h from 13fj to 17fj; C4, 100 nF, from 13fj to the ground row
 * 15fj (R4's, J4 to the − rail); J11 across the channel joins 13fj to 13ae. To make room, J2 (12ae to the wiper's 15ae)
 * moves to the line d, so that J11 has the line e (its arch passes 0.005 under the edge of the pot's case, which a
 * check of the boxes calls a touch), and J1 (17ae to the ground) goes across the channel to the ground row 15fj
 * instead of down the column 17 to the − rail, which would lie over the player's plug and R6's leg.
 */
const FILTER_VALUES = ['resistor-1k', 'resistor-4k7', 'resistor-10k'] as const;
const filterParts = (spec: string): readonly PresetPart[] => [
  ...AMPLIFIER_PRESET.parts.map((p) =>
    p.id === 'J2' ? { ...p, at: 'd12', to: 'd15' } : p.id === 'J1' ? { ...p, at: 'e17', to: 'f15' } : p,
  ),
  { id: 'J11', spec: 'jumper', at: 'e13', to: 'f13' },
  { id: 'R6', spec, at: 'h13' },
  { id: 'C4', spec: 'ceramic-100n', at: 'g13' },
];
const FILTER_LEADS: Readonly<Record<string, SocketId>> = { ...AMPLIFIER_PRESET.leads, 'pl+': 'g17' };

/** Step `rc`: + rail → J1 → 3ae → 10 kΩ along the line b → 7ae → 100 μF (plus c7, minus c8) → J2 → − rail. */
const RC: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
  { id: 'R1', spec: 'resistor-10k', at: 'b3' },
  { id: 'C1', spec: 'electrolytic-100u-16v', at: 'c7' },
  { id: 'J2', spec: 'jumper', at: 'e8', to: '-8' },
];
/** `rc`'s cursor (E4-S): 63 % of 9 V, the level `capacitor/time` marks. */
const RC_LEVEL = 0.632 * 9;
/**
 * Step `shot` (E4-S), the board of `filter/block`: + rail → J1 → 13ae → the film 1 μF (c13, c15) → 15ae → 10 kΩ across
 * the channel (e15 … i15) → J2 → − rail.
 */
const SHOT: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+13', to: 'a13' },
  { id: 'C1', spec: 'film-1u', at: 'c13' },
  { id: 'R1', spec: 'resistor-10k', at: 'e15', o: 1 },
  { id: 'J2', spec: 'jumper', at: 'j15', to: '-15' },
];

/**
 * Step `sound`: the player → a 10 kΩ pot as the volume control → the speaker, at the far right by the player and the
 * speaker (as the amplifier's volume control stands): P1 turned (`o` 2) in b17 (`ccw`), b15 (the wiper), b13 (`cw`);
 * the player's signal on `cw` (c13), its common, the speaker's minus and the pot's `ccw` on the ground row 17ae, which
 * J1 ties to the − rail; the speaker's plus on the wiper (c15). The knob at its top: 0.3 V behind 32 Ω into 8 Ω.
 */
const VOLUME: readonly PresetPart[] = [
  { id: 'P1', spec: 'pot-10k', at: 'b17', o: 2, setting: 1 },
  { id: 'J1', spec: 'jumper', at: 'e17', to: '-17' },
];
const VOLUME_LEADS = { 'pl+': 'c13', 'pl-': 'c17', 'spk+': 'c15', 'spk-': 'a17' } as const;

/** Step `bulged`: + rail → J1 → 3ae → 100 μF / 6.3 V the wrong way round (plus c4, minus c3: `o` 2) → J2 → − rail. */
const REVERSED: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
  { id: 'C1', spec: 'electrolytic-100u-6v3', at: 'c4', o: 2 },
  { id: 'J2', spec: 'jumper', at: 'e4', to: '-4' },
];

/** The oscilloscope's scale and probes of its steps (VISUAL §5.2: the step's, never picked by the scope). */
const SCOPES: Readonly<Record<string, { setup: ScopeSetup; probes: Record<ScopeProbeName, SocketId> }>> = {
  scope: {
    setup: { display: 'sweep', timePerDiv: 0.002, voltsPerDiv: 0.1, trigger: { channel: 0, level: null, slope: 1 } },
    probes: { ch1: 'j17', ch2: 'j13' },
  },
  rc: {
    setup: { display: 'roll', timePerDiv: 0.5, voltsPerDiv: 2, ground: -3, cursor: { volts: RC_LEVEL, channel: 1 } },
    probes: { ch1: 'e3', ch2: 'e7' },
  },
  // E4-S: the screen 8.05 … 8.45 V (`capacitor/reservoir`'s supply), the − rail far below it
  offset: {
    setup: { display: 'sweep', timePerDiv: 0.05, voltsPerDiv: 0.05, ground: -165, trigger: { channel: 0, level: null } },
    probes: { ch1: 'e5', ch2: '-5' },
  },
  // E4-S: `filter/block`'s single shot, a division before its edge
  shot: {
    setup: {
      display: 'sweep',
      timePerDiv: 0.005,
      voltsPerDiv: 2,
      ground: -2,
      pretrigger: 1,
      trigger: { channel: 1, level: 1, slope: 1, auto: false },
    },
    probes: { ch1: 'e13', ch2: 'e15' },
  },
};
/** Every plug the bench has, out: a step names those it puts in. */
const NO_LEADS: Readonly<Record<string, null>> = Object.freeze(
  Object.fromEntries(['spk+', 'spk-', 'pl+', 'pl-', 'lamp1', 'lamp2'].map((name) => [name, null])),
);

/** Step `loupe`: the part the magnifier leads into, a 4.7 kΩ in a5 … a9. */
const LOUPE: readonly PresetPart[] = [{ id: 'R1', spec: 'resistor-4k7', at: 'a5' }];
/** The depth slider runs 0 … `DEPTH`; the door's rail position is the slider − `LENS_LEG`. */
const DEPTH = 1 + LENS_LEG;

/** Step `film`: the values the dock's switch puts in R1's sockets of the LED's loop (`LED_LOOP`). */
const FILM_VALUES = ['resistor-330', 'resistor-10k'] as const;
const filmBoard = (spec: string): readonly PresetPart[] =>
  LED_LOOP.parts.map((p) => (p.id === 'R1' ? { ...p, spec } : p));
/** Step `plates`: the cans the dock's switch puts in C1's sockets, and the board of `capacitor/store` with one. */
const PLATES_CANS = [
  'electrolytic-10u-16v',
  'electrolytic-100u-16v',
  'electrolytic-470u-16v',
  'electrolytic-1000u-16v',
] as const;
const platesBoard = (spec: string, flipped = false): readonly PresetPart[] => [
  ...LED_LOOP.parts,
  { id: 'J3', spec: 'jumper', at: '+12', to: 'a12' },
  { id: 'J4', spec: 'jumper', at: 'e13', to: '-13' },
  // the other way round: leg 0 (the plus) in row 13, toward the − rail
  flipped ? { id: 'C1', spec, at: 'c13', o: 2 } : { id: 'C1', spec, at: 'c12' },
];
/** Step `roll`: a film capacitor alone, as `capacitor-kinds/film` seats it. */
const ROLL_BOARD: readonly PresetPart[] = [{ id: 'C1', spec: 'film-1u', at: 'e8' }];
/** Step `print`: a ceramic disc of 100 nF alone, its code «104» toward the reader (`capacitor-kinds/ceramic`). */
const PRINT_BOARD: readonly PresetPart[] = [{ id: 'C1', spec: 'ceramic-100n', at: 'e8' }];
/**
 * Step `timed` (E4-T): the board of `capacitor/store` and `capacitor/capacity` — the LED's loop, J3 and J4 — with the
 * dock's can in C1's sockets c12/c13, or none; the multimeter's probes on the can's rows (d12, d13).
 */
const TIMED_CANS = ['electrolytic-10u-16v', 'electrolytic-100u-16v', 'electrolytic-470u-16v'] as const;
const TIMED_NONE = 'none';
const timedBoard = (can: string): readonly PresetPart[] =>
  can === TIMED_NONE ? platesBoard('').filter((p) => p.id !== 'C1') : platesBoard(can);
const TIMED_PROBES = { red: 'd12', black: 'd13' } as const;
/** The level of the LED's current the step's panel times after the switch (A): `capacitor/capacity`'s 1 mA. */
const TIMED_LEVEL = 1e-3;
/** The steps with the magnifier's door, and the part it leads into. */
const DOOR_PARTS: Readonly<Record<string, string>> = {
  loupe: 'R1',
  film: 'R1',
  plates: 'C1',
  roll: 'C1',
  print: 'C1',
  timed: 'C1',
};
const DOOR_STEPS: ReadonlySet<string> = new Set(Object.keys(DOOR_PARTS));

/** The steps whose circuit is on: the battery's switch closed. */
const LIVE: ReadonlySet<string> = new Set([
  'divider',
  'led',
  'overload',
  'lamp',
  'film',
  'plates',
  'timed',
  'scope',
  'offset',
  'bulged',
]);
/** The steps where the reader may take everything (with a door only while the camera is on the board's shot). */
const FREE: ReadonlySet<string> = new Set([
  'hand',
  'meter',
  'divider',
  'led',
  'overload',
  'lamp',
  'loupe',
  'film',
  'plates',
  'roll',
  'print',
  'timed',
  'scope',
  'rc',
  'offset',
  'shot',
  'bulged',
  'sound',
]);
/** Each step's circuit (every other step: an empty board) and its tray. */
const PRESETS: Readonly<Record<string, readonly PresetPart[]>> = {
  parts: PARTS,
  divider: DIVIDER,
  led: LEDS,
  overload: OVERLOAD,
  lamp: LAMP,
  loupe: LOUPE,
  film: filmBoard(FILM_VALUES[0]),
  plates: platesBoard('electrolytic-470u-16v'),
  roll: ROLL_BOARD,
  print: PRINT_BOARD,
  timed: timedBoard('electrolytic-470u-16v'),
  scope: filterParts(FILTER_VALUES[0]),
  rc: RC,
  offset: AMPLIFIER_PRESET.parts,
  shot: SHOT,
  bulged: REVERSED,
  sound: VOLUME,
};
/** The plugs each step puts in (every other plug out). */
const LEADS: Readonly<Record<string, Readonly<Record<string, SocketId>>>> = {
  lamp: LAMP_LEADS,
  scope: FILTER_LEADS,
  offset: AMPLIFIER_PRESET.leads,
  sound: VOLUME_LEADS,
};
/** Each step's shot (the bench's names). */
const CAMERAS: Readonly<Record<string, BenchShot>> = {
  room: 'stand',
  board: 'board',
  meter: 'meter',
  scope: 'scope',
  rc: 'scope',
  offset: 'scope',
  shot: 'scope',
  parts: 'board',
  hand: 'stand',
  divider: 'meter',
  led: 'board',
  // the tray in the frame: the reader replaces the burnt part
  overload: 'stand',
  lamp: 'stand',
  bulged: 'board',
  loupe: 'board',
  film: 'board',
  plates: 'board',
  roll: 'board',
  print: 'board',
  timed: 'board',
  sound: 'stand',
};
const TRAYS: Readonly<Record<string, readonly string[]>> = { hand: TRAY, overload: ['resistor-100'] };

/** The name of a part's kind with its value, from the sandbox's words and the code's numbers and units. */
function partName(spec: string): string {
  const kind = Object.hasOwn(CATALOG, spec) ? CATALOG[spec]!.kind : '';
  const names: Readonly<Record<string, string>> = SANDBOX.names.kinds;
  if (kind === 'led') {
    const color = spec.slice('led-'.length) as keyof typeof SANDBOX.names.leds;
    return `${names.led} · ${SANDBOX.names.leds[color] ?? ''}`;
  }
  const label = trayLabel(spec);
  return [names[kind] ?? '', label].filter(Boolean).join(' ');
}

/** A dock button with no value to show (VISUAL §9): an LED by its colour's name, a jumper by its kind's. */
function buttonName(spec: string): string {
  if (spec.startsWith('led-')) return SANDBOX.names.leds[spec.slice('led-'.length) as keyof typeof SANDBOX.names.leds];
  return partName(spec);
}

export default defineScene((ctx) => {
  // with the speaker in sound: the model in time plays the board through the volume's own output (E2-10)
  const bench = mountBench(ctx, { sound: true });
  const ui = stepUi(ctx);
  const phone = (): boolean => ctx.device.formFactor === 'phone';
  // the multimeter in the panel: the dial's switch and the number, a text readout (VISUAL §5.1)
  const meterControls = [
    {
      type: 'segmented' as const,
      id: 'meter-mode',
      label: SANDBOX.meter.mode,
      items: METER_MODES.map((m) => ({
        id: m,
        label: m === 'off' ? SANDBOX.meter.off : m === 'ohm' ? 'Ω' : m,
      })),
      value: 'V',
      onChange: (m: string) => (bench.multimeter.mode = m as MeterMode),
    },
    bench.multimeter.readout('meter', SANDBOX.meter.readout),
  ];
  ui.define({ meter: { controls: meterControls } });
  // on a phone the tray is the dock's: a button per slot puts a new part in the hand over the board; the switch, out
  // of the shot `phone`, is a toggle there bound to `bench.closed` (VISUAL §9)
  const dock = (tray: readonly string[]) => ({
    controls: [
      ...tray.map((spec) => ({
        type: 'button' as const,
        id: `tray-${spec}`,
        label: trayLabel(spec) || buttonName(spec),
        visible: phone,
        onClick: () => void bench.hands.offer(spec),
      })),
      {
        type: 'toggle' as const,
        id: 'battery-switch',
        label: SANDBOX.names.switch,
        value: false,
        visible: phone,
        disabled: () => bench.flying || !(bench.hands.policy?.take('switch') ?? true),
        onChange: (on: boolean) => (bench.closed = on ? 1 : 0),
      },
    ],
  });
  // the oscilloscope's board: its chart, the axes' titles with the scale on them (VISUAL §5.2), the step's channels
  const W = SANDBOX.scope;
  const scale = (value: number, unit: string): string => `${fmtSI(value, unit)}/${W.division}`;
  const scopeBoard = (step: keyof typeof W.channels) => ({
    title: W.board,
    size: 'md' as const,
    children: [
      bench.oscilloscope.chart(`scope-${step}`, {
        x: (s: ScopeSettings) => `t, ${s.unit} · ${scale(s.timePerDiv, 's')}`,
        y: (s: ScopeSettings) => `U, V · ${scale(s.voltsPerDiv, 'V')}`,
        ...W.channels[step],
        // `rc`: the dashed level of the scope's cursor (E4-S)
        ...(step === 'rc' ? { cursor: W.cursor } : {}),
      }),
    ],
  });
  ui.define({
    hand: dock(TRAY),
    // the divider: the meter, and the battery's switch in the dock (the checks open it for the Ω mode: a resistance is
    // measured without power)
    divider: { controls: [...meterControls, ...dock([]).controls] },
    led: dock([]),
    overload: dock(TRAYS.overload ?? []),
    lamp: dock([]),
    bulged: dock([]),
    rc: { ...dock([]), board: scopeBoard('rc') },
    offset: { ...dock([]), board: scopeBoard('offset') },
    shot: { ...dock([]), board: scopeBoard('shot') },
    scope: {
      controls: [
        ...dock([]).controls,
        {
          type: 'segmented' as const,
          id: 'filter',
          label: W.resistor,
          items: FILTER_VALUES.map((spec) => ({ id: spec, label: trayLabel(spec) })),
          value: FILTER_VALUES[0],
          onChange: (spec: string) => {
            bench.preset(filterParts(spec), { ...NO_LEADS, ...FILTER_LEADS });
            bench.closed = 1;
          },
        },
      ],
      board: scopeBoard('scope'),
    },
    // step `sound`: the volume control's knob is P1's setting; the knob in 3D follows it (plan decision 20)
    sound: {
      controls: [
        ...dock([]).controls,
        {
          type: 'slider' as const,
          id: 'volume',
          label: SANDBOX.sound.volume,
          min: 0,
          max: 1,
          step: 0.01,
          value: 1,
          format: (v: number) => `${Math.round(v * 100)} %`,
          onInput: (v: number) => void setSetting(bench.state, 'P1', v),
          onChange: (v: number) => void setSetting(bench.state, 'P1', v),
        },
      ],
    },
  });
  const specOf = (id: string): string => bench.state.parts.get(id)?.spec ?? '';
  /** The sandbox lets the reader take everything; the names under the pointer are its words. */
  const tooltip = (k: HandKey): string => {
    if (k === 'switch') return SANDBOX.names.switch;
    const [what, id = '', leg] = k.split(':');
    if (what === 'part') return partName(specOf(id));
    if (what === 'tray') return partName(id);
    if (what === 'lead') return SANDBOX.names.leads[id as keyof typeof SANDBOX.names.leads] ?? '';
    if (what === 'probe') return SANDBOX.names.probes[id as keyof typeof SANDBOX.names.probes] ?? '';
    if (what === 'leg')
      return specOf(id) === 'jumper' ? SANDBOX.names.end : `${SANDBOX.names.leg} ${Number(leg) + 1} · ${partName(specOf(id))}`;
    return '';
  };
  // the instruments slide in and out with the steps that take them (VISUAL §2: 0.6 s)
  ctx.stage.param('meter', 0, { duration: 0.6, onChange: (v: number) => (bench.meter = v) });
  ctx.stage.param('scope', 0, { duration: 0.6, onChange: (v: number) => (bench.scope = v) });
  const INSTRUMENTS: Readonly<Record<string, Record<string, number>>> = {
    meter: { meter: 1 },
    scope: { scope: 1 },
    rc: { scope: 1 },
    offset: { scope: 1 },
    shot: { scope: 1 },
    divider: { meter: 1 },
    timed: { meter: 1 },
  };
  ctx.stage.define(
    Object.fromEntries(
      Object.entries(CAMERAS).map(([id, camera]) => [id, { camera, params: INSTRUMENTS[id] }]),
    ),
  );

  // step `loupe` (E2-8): the door into R1, made on the step's entry and given up once its rail has let the camera go
  // after the step; the magnifier's keeper lays the lens while there is a door; the ladder «де ми» shows its floor
  let door: Door | null = null;
  const keeper = lensKeeper(bench.tools);
  const ladder = benchLadder(ctx, () => door?.floor ?? null);
  const here = (): boolean => DOOR_STEPS.has(ctx.stage.current ?? '');
  /** The door's rail rests on the board's shot with the lens in its holder. */
  const resting = (): boolean =>
    !!door && !door.rail.moving && door.rail.position <= door.rail.rail.min + 1e-6;
  let fill = -1;
  const depth = {
    type: 'slider' as const,
    id: 'depth',
    label: SANDBOX.loupe.depth,
    min: 0,
    max: DEPTH,
    value: 0,
    step: 0.005,
    // the floors where they begin on the slider (VISUAL §7)
    marks: [
      { value: 0, label: SANDBOX.loupe.floors.stand },
      { value: 1, label: SANDBOX.loupe.floors.part },
      { value: DEPTH, label: SANDBOX.loupe.floors.inside },
    ],
    format: (v: number) => SANDBOX.loupe.floors[floorAt(v - LENS_LEG)],
    disabled: () => !door?.ready && resting(),
    onChange: (v: number) => door?.travelTo(v - LENS_LEG),
    onInput: (v: number, how: 'drag' | 'jump' | 'step') => {
      if (how === 'drag') door?.rail.scrub(v - LENS_LEG);
    },
  };
  ui.define({
    loupe: { controls: [depth] },
    // step `film`: the same dive, and the value in R1's sockets — a new part under the same id, the door follows it
    film: {
      controls: [
        depth,
        {
          type: 'segmented' as const,
          id: 'film-value',
          label: SANDBOX.film.value,
          items: FILM_VALUES.map((spec) => ({ id: spec, label: trayLabel(spec) })),
          value: FILM_VALUES[0],
          onChange: (spec: string) => {
            bench.preset(filmBoard(spec));
            bench.closed = 1;
          },
        },
      ],
    },
    // step `plates`: the same dive into C1; the can in its sockets (a new part under the same id, the door follows
    // it, the switch as it was) and the battery's switch, which works while the camera is inside
    plates: {
      controls: [
        depth,
        {
          type: 'segmented' as const,
          id: 'plates-can',
          label: SANDBOX.plates.can,
          items: PLATES_CANS.map((spec) => ({ id: spec, label: trayLabel(spec) })),
          value: 'electrolytic-470u-16v',
          onChange: (spec: string) => {
            const closed = bench.closed;
            bench.preset(platesBoard(spec, ui.value<boolean>('plates-flip')));
            bench.closed = closed;
          },
        },
        {
          type: 'toggle' as const,
          id: 'plates-switch',
          label: SANDBOX.names.switch,
          value: true,
          onChange: (on: boolean) => (bench.closed = on ? 1 : 0),
        },
        {
          type: 'toggle' as const,
          id: 'plates-flip',
          label: SANDBOX.plates.flip,
          value: false,
          onChange: (on: boolean) => {
            const closed = bench.closed;
            bench.preset(platesBoard(ui.value<string>('plates-can'), on));
            bench.closed = closed;
          },
        },
      ],
    },
    roll: { controls: [depth] },
    print: { controls: [depth] },
    // step `timed` (E4-T): the bench counts the board in time; the readouts (the time from the switch's opening to the
    // LED's current below 1 mA, the meter on the can), the switch (it works while the camera is inside), the can in C1's
    // sockets (a new part, whole: the board starts again from its operating point) and the dive into it
    timed: {
      controls: [
        {
          type: 'readout' as const,
          id: 'timed-fade',
          label: SANDBOX.timed.fade,
          text: () => (fade === null ? '—' : fmtUnit(fade, 's', { digits: 4 })),
        },
        bench.multimeter.readout('timed-meter', SANDBOX.timed.meter),
        {
          type: 'toggle' as const,
          id: 'timed-switch',
          label: SANDBOX.names.switch,
          value: true,
          onChange: (on: boolean) => (bench.closed = on ? 1 : 0),
        },
        {
          type: 'segmented' as const,
          id: 'timed-can',
          label: SANDBOX.timed.can,
          items: [
            ...TIMED_CANS.map((spec) => ({ id: spec, label: trayLabel(spec) })),
            { id: TIMED_NONE, label: SANDBOX.timed.none },
          ],
          value: 'electrolytic-470u-16v',
          onChange: (spec: string) => {
            const closed = bench.closed;
            bench.preset(timedBoard(spec));
            bench.closed = closed;
            bench.multimeter.put(TIMED_PROBES);
          },
        },
        depth,
      ],
    },
  });
  // step `timed`: the moment the switch last opened (the board in time's), and the time from it to the LED's current
  // below 1 mA by the threshold watch — finer than a frame (10 μF: 11 ms); null until it fell after that opening
  let fade: number | null = null;
  let opened = Number.NaN;
  let wasClosed = false;
  const timedFade = (): void => {
    const timeline = bench.model.timeline;
    const watch = timeline.watch('LED1', TIMED_LEVEL);
    const closed = bench.closed >= 0.5;
    if (wasClosed && !closed) {
      opened = timeline.changed('SW');
      fade = null;
    }
    if (!closed && watch.fell >= opened) fade = watch.fell - opened;
    wasClosed = closed;
  };
  // the callouts' points of the film (checks): far below the bench while there is none
  const filmProbe = (name: FilmAnchor) => {
    const v = new Vector3();
    return (): Vector3 => {
      const film = asFilm(door?.cutaway ?? null);
      return film && film.open ? film.anchor(name, v) : v.set(0, -100, 0);
    };
  };
  for (const name of ['film', 'groove', 'rod'] as const) ctx.qa.probe(`film:${name}`, filmProbe(name));
  // the callouts' points of a capacitor's inside (checks)
  const platesProbe = (name: PlatesAnchor) => {
    const v = new Vector3();
    return (): Vector3 => {
      const plates = asPlates(door?.cutaway ?? null);
      return plates && plates.open ? plates.anchor(name, v) : v.set(0, -100, 0);
    };
  };
  for (const name of ['plus', 'minus', 'insulator'] as const) ctx.qa.probe(`plates:${name}`, platesProbe(name));
  const rollProbe = (name: RollAnchor) => {
    const v = new Vector3();
    return (): Vector3 => {
      const roll = asRoll(door?.cutaway ?? null);
      return roll && roll.open ? roll.anchor(name, v) : v.set(0, -100, 0);
    };
  };
  for (const name of ['metal', 'film'] as const) ctx.qa.probe(`roll:${name}`, rollProbe(name));
  // a tap on the resting magnifier lays it over the part: the slider glides to the end of its lens leg
  ctx.input.register(bench.tools.lens.group, {
    cursor: 'pointer',
    tooltip: SANDBOX.loupe.lens,
    enabled: () => here() && !!door?.ready && resting() && !bench.flying,
    click: () => {
      ui.set('depth', LENS_LEG);
      door?.travelTo(0);
    },
  });
  return {
    enterStep(id, info) {
      if (DOOR_STEPS.has(id)) {
        door?.dispose();
      } else if (door) {
        // leaving the dive: back to the board's shot first (the lens with it into its holder), then this step's shot
        door.home({ instant: info.instant, then: CAMERAS[id] });
      }
      // the board in time only where the step shows a can giving its charge (E4-T); a preset starts it again from
      // the board's operating point
      bench.timed = id === 'timed';
      const preset = PRESETS[id];
      if (preset) bench.preset(preset, { ...NO_LEADS, ...LEADS[id] });
      else bench.clear();
      // the oscilloscope: the step's scale and its probes, or its probes at rest
      const scope = SCOPES[id];
      if (scope) bench.oscilloscope.configure(scope.setup);
      bench.oscilloscope.put(scope?.probes ?? { ch1: null, ch2: null });
      if (id === 'scope') ui.set('filter', FILTER_VALUES[0]);
      bench.tray.set(TRAYS[id] ?? []);
      bench.closed = LIVE.has(id) ? 1 : 0;
      // every step starts with the probes at rest by the meter and the dial on V (`timed`: on the can's rows)
      bench.multimeter.put(id === 'timed' ? TIMED_PROBES : { red: null, black: null });
      bench.multimeter.mode = 'V';
      ui.set('meter-mode', 'V');
      bench.hands.policy = FREE.has(id) ? { take: () => true, tooltip } : { take: () => false };
      if (id === 'film') ui.set('film-value', FILM_VALUES[0]);
      if (id === 'plates') {
        ui.set('plates-can', 'electrolytic-470u-16v');
        ui.set('plates-flip', false);
      }
      if (id === 'timed') {
        ui.set('timed-can', 'electrolytic-470u-16v');
        fade = null;
        opened = Number.NaN;
        wasClosed = bench.closed >= 0.5;
      }
      if (id === 'sound') ui.set('volume', 1);
      if (DOOR_STEPS.has(id)) {
        door = partDoor(ctx, bench, DOOR_PARTS[id]!, { lead: 'board' });
        const d = door;
        keeper.call = 1;
        if (info.instant) keeper.snap(() => d.lens(d.rail.position));
        else keeper.to(() => d.lens(d.rail.position), 1.2);
        fill = -1;
      } else keeper.call = 0;
      if (info.instant) bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
      // the dock's toggle shows the switch as it is (a step sets it, a tap on the slider flips it)
      const on = bench.closed >= 0.5;
      if (ui.value<boolean>('battery-switch') !== on) ui.set('battery-switch', on);
      if (ctx.stage.current === 'plates' && ui.value<boolean>('plates-switch') !== on) ui.set('plates-switch', on);
      if (ctx.stage.current === 'timed') {
        if (ui.value<boolean>('timed-switch') !== on) ui.set('timed-switch', on);
        timedFade();
      }
      // the dive: the door after the bench (the parts stood on their legs), then the lens over everything
      if (door) {
        door.update(dt);
        const p = door.rail.position;
        const engaged = door.rail.engaged;
        keeper.rim = engaged ? door.rim(p) : 0;
        keeper.glass = engaged ? door.glass(p) : 1;
        keeper.late(dt, t);
        // the slider's fill is where the dive is (its thumb where the reader put it)
        if (here() && Math.abs(p + LENS_LEG - fill) > 0.002) ui.patch('depth', { current: (fill = p + LENS_LEG) });
        // back on the board's shot after the step: the door is given up, the bench lays the lens again
        if (!here() && !engaged) {
          door.dispose();
          door = null;
        }
      }
      ladder.update();
    },
  };
});
