/**
 * The stage params every chapter of the composed world shares (names fixed, so steps of different chapters read
 * alike). Each writes one field of the stand; `deep` is read by the world itself every frame.
 */
import type { ChapterContext, Param } from '@/engine/api';
import type { CircuitStage } from '@circuit/shared/stage';

/** Param names a step may list in `params` (defaults in brackets). */
export type WorldParam =
  | 'closed' // the switch (0)
  | 'unfold' // the flashlight → the stand (1)
  | 'moon' // the cold key light (1)
  | 'charge' // the battery's life (1)
  | 'lens' // the magnifier: 0 in its holder, 1 over the near wire (0)
  | 'lensCall' // the resting ring calls «take me» (0)
  | 'snail' // the snail on the ruler (0)
  | 'ruler' // the ruler's ticks (0)
  | 'spark' // the marked spark's pin on the ruler (0)
  | 'poles' // plus/minus tint of the wires (0)
  | 'race' // the stand's two-lane race track with both racers; the lens beside it when in use (0)
  | 'window' // the lens as a window onto «ряди», on the stand only (0)
  | 'deep'; // the floor: 0 stand · 1 «жила» · 2 «ряди» · 3 «один атом» (0)

export interface WorldParams {
  deep: Param;
  lens: Param;
  window: Param;
  all: ReadonlyMap<WorldParam, Param>;
  /** `deep` at the end of the previous frame (where a step entry starts from). */
  deepBefore: number;
}

export function registerParams(ctx: ChapterContext, stand: CircuitStage): WorldParams {
  const { stage } = ctx;
  const all = new Map<WorldParam, Param>();
  const p = (name: WorldParam, initial: number, duration: number, set: (v: number) => void): Param => {
    const param = stage.param(name, initial, { duration, ease: 'power2.inOut', onChange: set });
    all.set(name, param);
    return param;
  };
  // the switch and the slider follow with the stand's own inertia: the param itself jumps
  p('closed', 0, 0.01, (v) => (stand.closed = v));
  p('unfold', 1, 2.4, (v) => (stand.unfold = v));
  p('moon', 1, 1.2, (v) => (stand.moon = v));
  p('charge', 1, 2.5, (v) => (stand.charge = v));
  const lens = p('lens', 0, 1.2, (v) => (stand.lens = v));
  p('lensCall', 0, 0.6, (v) => (stand.lensCall = v));
  p('snail', 0, 1.4, (v) => (stand.snail = v));
  p('ruler', 0, 0.9, (v) => (stand.ruler = v));
  p('spark', 0, 0.7, (v) => (stand.spark = v));
  p('poles', 0, 1.2, (v) => (stand.poles = v));
  p('race', 0, 1.2, (v) => (stand.race = v));
  const window = p('window', 0, 1.0, () => undefined);
  const deep = stage.param('deep', 0, { duration: 2, ease: 'sine.inOut' });
  all.set('deep', deep);
  return { deep, lens, window, all, deepBefore: 0 };
}
