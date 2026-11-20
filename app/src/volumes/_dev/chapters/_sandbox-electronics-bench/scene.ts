/**
 * Scene of the bench's sandbox (`index.ts` holds its words): `mountBench` and its shots. Steps:
 *   room  — the main shot `stand` (on a phone the bench makes it `phone`: the field of sockets only);
 *   board — the field of sockets close (`board`), where the board's print can be read;
 *   meter — the multimeter comes in from the left of the frame, shot `meter`; an empty board, the probes lying free
 *           by the meter (E2-6): they may be taken, the meter reads «—» until both are in sockets; the dial's switch
 *           `meter-mode` and the number `meter` are in the panel;
 *   scope — the oscilloscope's stand-in comes in from behind on the right, shot `scope`;
 *   parts — one part of every kind on the board and a row of resistors 1 Ω … 1 MΩ (`PARTS`), shot `board`: the tall
 *           parts at the far half, the low ones at the near half, a jumper across the near half; the capacitors and the
 *           transistor (`SHOWN`) stand on the board outside the circuit until the model's catalog has them (E1-5, E1-6);
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
 *   bulged — the look of an electrolytic's state `bulged` (E1-5 gives it, E2-9 binds it), shot `board`: a whole can and
 *           a bulged one outside the circuit, one puff of steam out of its vent on entering.
 * Every other step has an empty board and an empty tray, and the probes at rest. Readers: the bench's own
 * `electronics-bench` (sockets, rows, draw calls, the print shown), `electronics-board` (the parts and their legs, the
 * plugs, the settings, the netlist's key), `electronics-parts` (every model: where, draw calls, its print),
 * `electronics-hand` (what the hand holds, the preview, the lit rows), `electronics-motion` (the camera, what the hand
 * moves, the plugs — every frame), `electronics-model` (the circuit model: its key, solves, dcMs, readings) and
 * `electronics-meter` (the dial, the probes' sockets, the reading and the display's text); probes `socket:<id>` for
 * every socket of the board (`a1` … `j17`, `+1` … `+17`, `-1` … `-17`), and the hand's `part:<id>`, `leg:<id>:<k>`,
 * `tip:<id>:<k>`, `lead:<name>`, `end:<name>`, `probe:<red|black>` (the grip on a probe's handle; its tip `end:red`,
 * `end:black`), `tray:<key>`, `switch`.
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import {
  PARTS as CATALOG,
  mountBench,
  trayLabel,
  type HandKey,
  type PresetPart,
  type SocketId,
} from '@electronics/shared/bench';
import { SANDBOX } from './index';
import { METER_MODES, type MeterMode } from '@electronics/shared/instruments';
import {
  RADIAL_Y,
  createCeramic,
  createElectrolytic,
  createFilm,
  createTransistor,
  type PartModel,
} from '@electronics/shared/parts';

/** Step `parts`: the circuit's own parts of the catalog. */
const PARTS: readonly PresetPart[] = [
  // the far half: the tall parts, so they hide nothing behind them
  { id: 'LED1', spec: 'led-red', at: 'a1' },
  { id: 'LED2', spec: 'led-yellow', at: 'a4' },
  { id: 'LED3', spec: 'led-green', at: 'a7' },
  { id: 'LED4', spec: 'led-blue', at: 'a10' },
  { id: 'LED5', spec: 'led-white', at: 'a13' },
  { id: 'P1', spec: 'pot-10k', at: 'd1', setting: 0.3 },
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

/** Step `parts`: the kinds the catalog gains in E1-5 and E1-6, shown on the board outside the circuit. */
const SHOWN: readonly { id: string; make: () => PartModel; sockets: readonly SocketId[] }[] = [
  { id: 'C1', make: () => createCeramic(100e-9), sockets: ['d7', 'd9'] },
  { id: 'C2', make: () => createFilm(100e-9), sockets: ['d11', 'd13'] },
  { id: 'C3', make: () => createElectrolytic(470e-6, 16), sockets: ['a16', 'a17'] },
  { id: 'Q1', make: () => createTransistor('transistor-bc547b'), sockets: ['d15', 'd16', 'd17'] },
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

/** Step `bulged`: two electrolytics outside the circuit, a whole one and one under the look of the state `bulged`. */
const CANS = { whole: ['a5', 'a6'], bulged: ['a10', 'a11'] } as const;

/** The steps whose circuit is on: the battery's switch closed. */
const LIVE: ReadonlySet<string> = new Set(['divider', 'led', 'overload', 'lamp']);
/** The steps where the reader may take everything. */
const FREE: ReadonlySet<string> = new Set(['hand', 'meter', 'divider', 'led', 'overload', 'lamp']);
/** Each step's circuit (every other step: an empty board) and its tray. */
const PRESETS: Readonly<Record<string, readonly PresetPart[]>> = {
  parts: PARTS,
  divider: DIVIDER,
  led: LEDS,
  overload: OVERLOAD,
  lamp: LAMP,
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
  const bench = mountBench(ctx);
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
  ui.define({ meter: { controls: meterControls }, divider: { controls: meterControls } });
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
  ui.define({
    hand: dock(TRAY),
    led: dock([]),
    overload: dock(TRAYS.overload ?? []),
    lamp: dock([]),
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
  ctx.stage.define({
    room: { camera: 'stand' },
    board: { camera: 'board' },
    meter: { camera: 'meter', params: { meter: 1 } },
    scope: { camera: 'scope', params: { scope: 1 } },
    parts: { camera: 'board' },
    hand: { camera: 'stand' },
    divider: { camera: 'meter', params: { meter: 1 } },
    led: { camera: 'board' },
    // the tray in the frame: the reader replaces the burnt part
    overload: { camera: 'stand' },
    lamp: { camera: 'stand' },
    bulged: { camera: 'board' },
  });
  const vent = new Vector3();
  return {
    enterStep(id, info) {
      const preset = PRESETS[id];
      if (preset) bench.preset(preset, id === 'lamp' ? LAMP_LEADS : undefined);
      else bench.clear();
      for (const s of SHOWN) {
        if (id === 'parts') bench.parts.show(s.id, s.make(), s.sockets);
        else bench.parts.hide(s.id);
      }
      for (const [name, sockets] of Object.entries(CANS)) {
        if (id !== 'bulged') {
          bench.parts.hide(`C-${name}`);
          continue;
        }
        const can = createElectrolytic(470e-6, 16);
        bench.parts.show(`C-${name}`, can, sockets);
        if (name !== 'bulged') continue;
        // the look of the state, and the one puff of steam out of its vent (VISUAL §4.8)
        can.setLook({ status: 'bulged' }, 0);
        can.bodyGroup.updateWorldMatrix(true, false);
        bench.smoke.puff(can.bodyGroup.localToWorld(vent.set(0, RADIAL_Y + can.size.h + 0.05, 0)), 'steam');
      }
      bench.tray.set(TRAYS[id] ?? []);
      bench.closed = LIVE.has(id) ? 1 : 0;
      // every step starts with the probes at rest by the meter and the dial on V
      bench.multimeter.put({ red: null, black: null });
      bench.multimeter.mode = 'V';
      ui.set('meter-mode', 'V');
      bench.hands.policy = FREE.has(id) ? { take: () => true, tooltip } : { take: () => false };
      if (info.instant) bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
      // the dock's toggle shows the switch as it is (a step sets it, a tap on the slider flips it)
      const on = bench.closed >= 0.5;
      if (ui.value<boolean>('battery-switch') !== on) ui.set('battery-switch', on);
    },
  };
});
