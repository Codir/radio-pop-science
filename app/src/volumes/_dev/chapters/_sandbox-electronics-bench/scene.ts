/**
 * Scene of the bench's sandbox (`index.ts` holds its words): `mountBench` and its shots. Steps:
 *   room  — the main shot `stand` (on a phone the bench makes it `phone`: the field of sockets only);
 *   board — the field of sockets close (`board`), where the board's print can be read;
 *   meter — the multimeter's stand-in comes in from the left of the frame, shot `meter`;
 *   scope — the oscilloscope's stand-in comes in from behind on the right, shot `scope`;
 *   parts — one part of every kind on the board and a row of resistors 1 Ω … 1 MΩ (`PARTS`), shot `board`: the tall
 *           parts at the far half, the low ones at the near half, a jumper across the near half; the capacitors and the
 *           transistor (`SHOWN`) stand on the board outside the circuit until the model's catalog has them (E1-5, E1-6);
 *   hand  — the reader's hand (E2-5), shot `stand`: an empty board, the tray (`TRAY`: three resistors and a jumper in
 *           front, two LEDs behind), the plugs of the speaker, the player and the lamp lying loose, the switch open;
 *           everything may be taken. On a phone the tray's slots are buttons of the dock (`tray-<key>`, VISUAL §9).
 * Every other step has an empty board and an empty tray. Readers: the bench's own `electronics-bench` (sockets, rows,
 * draw calls, the print shown), `electronics-board` (the parts and their legs, the plugs, the settings, the netlist's
 * key), `electronics-parts` (every model: where, draw calls, its print), `electronics-hand` (what the hand holds, the
 * preview, the lit rows) and `electronics-motion` (the camera, what the hand moves, the plugs — every frame); probes
 * `socket:<id>` for every socket of the board (`a1` … `j17`, `+1` … `+17`, `-1` … `-17`), and the hand's `part:<id>`,
 * `leg:<id>:<k>`, `tip:<id>:<k>`, `lead:<name>`, `end:<name>`, `tray:<key>`, `switch`.
 */
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
import {
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
  // on a phone the tray is the dock's: a button per slot puts a new part in the hand over the board (VISUAL §9)
  ui.define({
    hand: {
      controls: TRAY.map((spec) => ({
        type: 'button' as const,
        id: `tray-${spec}`,
        label: trayLabel(spec) || buttonName(spec),
        visible: phone,
        onClick: () => void bench.hands.offer(spec),
      })),
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
  });
  return {
    enterStep(id, info) {
      if (id === 'parts') {
        bench.preset(PARTS);
        for (const s of SHOWN) bench.parts.show(s.id, s.make(), s.sockets);
      } else {
        bench.clear();
        for (const s of SHOWN) bench.parts.hide(s.id);
      }
      bench.tray.set(id === 'hand' ? TRAY : []);
      bench.closed = 0;
      bench.hands.policy = id === 'hand' ? { take: () => true, tooltip } : { take: () => false };
      if (info.instant) bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
    },
  };
});
