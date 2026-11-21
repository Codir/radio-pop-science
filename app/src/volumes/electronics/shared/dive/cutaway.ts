/**
 * The floor `inside` of a part (docs/volumes/electronics/VISUAL.md §7): which inner view the door opens on the part's
 * place, by the part's kind — a partial table, so a kind with no inner view yet stays whole on `inside`. Every view is
 * opened by one number `cut` 0 … 1 (`door.ts`) through the wedge of `shared/inside/wedge.ts`. E2-8's temporary cutaway
 * of the resistor (a quarter wedge with flat layers) gave way to the carbon film of batch E3 (`shared/inside/film.ts`).
 */
import { PARTS, type PartKind } from '@electronics/sim/core';
import { createFilm, type Cutaway } from '../inside';
import type { PartModel } from '../parts';

export { CLOSED, type Cutaway, type InsideState } from '../inside';

/** The kinds that have an inner view (a partial table: the next batches add theirs). */
const CUTAWAYS: Partial<Record<PartKind, (model: PartModel) => Cutaway>> = {
  resistor: (model) => createFilm(model),
};

/** The inner view of a part's model, or null for a kind that has none yet (it stays whole on `inside`). */
export function createCutaway(model: PartModel): Cutaway | null {
  const kind = Object.hasOwn(PARTS, model.key) ? PARTS[model.key]!.kind : null;
  const make = kind ? CUTAWAYS[kind] : undefined;
  return make ? make(model) : null;
}
