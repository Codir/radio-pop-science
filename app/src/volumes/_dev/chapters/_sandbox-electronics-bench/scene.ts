/**
 * Scene of the bench's sandbox (`index.ts` holds its words): `mountBench` and its shots. Steps:
 *   room  — the main shot `stand` (on a phone the bench makes it `phone`: the field of sockets only);
 *   board — the field of sockets close (`board`), where the board's print can be read;
 *   meter — the multimeter's stand-in comes in from the left of the frame, shot `meter`;
 *   scope — the oscilloscope's stand-in comes in from behind on the right, shot `scope`.
 * Readers: the bench's own `electronics-bench` (sockets, rows, draw calls, the print shown); probes `socket:<id>` for
 * every socket of the board (`a1` … `j17`, `+1` … `+17`, `-1` … `-17`).
 */
import { defineScene } from '@/engine/api';
import { mountBench } from '@electronics/shared/bench';

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
  });
  return {
    enterStep(_id, info) {
      if (info.instant) bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
    },
  };
});
