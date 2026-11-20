/**
 * Scene of the bench's sandbox (`index.ts` holds its words): `mountBench` and its shots. Steps:
 *   room  — the main shot `stand` (on a phone the bench makes it `phone`: the field of sockets only);
 *   board — the field of sockets close (`board`), where the board's print can be read;
 *   meter — the multimeter's stand-in comes in from the left of the frame, shot `meter`;
 *   scope — the oscilloscope's stand-in comes in from behind on the right, shot `scope`;
 *   parts — one part of every kind on the board and a row of resistors 1 Ω … 1 MΩ (`PARTS`), shot `board`: the tall
 *           parts at the far half, the low ones at the near half, a jumper across the near half; the capacitors and the
 *           transistor (`SHOWN`) stand on the board outside the circuit until the model's catalog has them (E1-5, E1-6).
 * Every other step has an empty board. Readers: the bench's own `electronics-bench` (sockets, rows, draw calls, the
 * print shown), `electronics-board` (the parts and their legs) and `electronics-parts` (every model: where, draw calls,
 * its print); probes `socket:<id>` for every socket of the board (`a1` … `j17`, `+1` … `+17`, `-1` … `-17`).
 */
import { defineScene } from '@/engine/api';
import { mountBench, type PresetPart, type SocketId } from '@electronics/shared/bench';
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

export default defineScene((ctx) => {
  const bench = mountBench(ctx);
  // the instruments slide in and out with the steps that take them (VISUAL §2: 0.6 s)
  ctx.stage.param('meter', 0, { duration: 0.6, onChange: (v: number) => (bench.meter = v) });
  ctx.stage.param('scope', 0, { duration: 0.6, onChange: (v: number) => (bench.scope = v) });
  ctx.stage.define({
    room: { camera: 'stand' },
    board: { camera: 'board' },
    meter: { camera: 'meter', params: { meter: 1 } },
    scope: { camera: 'scope', params: { scope: 1 } },
    parts: { camera: 'board' },
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
      if (info.instant) bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
    },
  };
});
