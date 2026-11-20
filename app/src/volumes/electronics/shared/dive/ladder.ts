/**
 * The ladder «де ми» of the bench's floors (docs/volumes/electronics/VISUAL.md §7): the platform's `floorLadder`
 * (`@/hud-dom/journey`, lower left on a desk, the header's axis chip on a phone) with the floors of the volume
 * «Радіоелектроніка» (`volume.json` → `axis.floors`: `stand`, `part`, `inside`, `atoms`). A chapter of the volume gets
 * the platform's ladder as it is. A dev sandbox of the bench (`_dev`, whose own axis has no floors, so the platform's
 * ladder would stay empty there) gets the same ladder with the bench's volume's axis: the context it is built with
 * answers that volume as `nav.volume` — the one thing the ladder reads of the navigation. Call `update()` every frame.
 */
import type { ChapterContext } from '@/engine/api';
import { floorLadder, type FloorLadder } from '@/hud-dom/journey';
import type { FloorId } from './levels';

/** The volume whose axis the bench's floors are. */
export const BENCH_VOLUME = 'electronics';

export function benchLadder(ctx: ChapterContext, floor: () => FloorId | null): FloorLadder {
  const own = ctx.nav.volume;
  if (own?.journey.axis.floors.length) return floorLadder(ctx, { floor });
  const volume = ctx.nav.volumes.find((v) => v.id === BENCH_VOLUME);
  if (!volume) return floorLadder(ctx, { floor });
  const nav = Object.create(ctx.nav, { volume: { value: volume } }) as ChapterContext['nav'];
  const view = Object.create(ctx, { nav: { value: nav } }) as ChapterContext;
  return floorLadder(view, { floor });
}
