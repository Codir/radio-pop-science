/**
 * «Нові деталі» in the dock (the batch E3 lesson, `resistor/amp`, `meter/amps`; `capacitor-kinds/rated`, `reverse`):
 * after a step lets the reader burn a part or bulge a can, the button shows while something is burnt or bulged — a part
 * of the board, or a thing of the bench (the speaker, the lamp: outside `state.parts`) — and its press is the step's
 * own: it puts the step's board back, new and whole (`stand.board`: the bench forgets its things too), and sets what
 * the step sets on entry. The words are the step's caption.
 */
import type { ButtonSpec } from '@/hud';
import { BENCH_FIXED } from '@electronics/sim/board';
import type { Bench } from '../bench';

/** The dock's id of the button. */
export const FRESH_ID = 'fresh';

/** A part of the board or a thing of the bench is burnt or bulged (`model.part(id).condition`). */
export function damaged(bench: Bench): boolean {
  for (const id of [...bench.state.parts.keys(), ...BENCH_FIXED.map((f) => f.id)]) {
    const c = bench.model.part(id)?.condition;
    if (c === 'burnt' || c === 'bulged') return true;
  }
  return false;
}

/** The button: shown while the step is on screen (`here`) and something is damaged; `reseat` is the step's board. */
export function freshButton(bench: Bench, label: string, here: () => boolean, reseat: () => void): ButtonSpec {
  return { type: 'button', id: FRESH_ID, label, visible: () => here() && damaged(bench), onClick: reseat };
}
