/**
 * `floorLadder(ctx, { floor })` — the «де ми» cue (docs/volumes/circuit/VISUAL.md §3): a small flat ladder of
 * the volume's floors (`volume.json → axis.floors`, top = the highest value) with the current one lit. The chapter
 * feeds it: `floor()` returns the id of the floor on screen, or null to hide the ladder (e.g. on the stand when
 * no dive is under way). Names come from `floorLabel` — a floor whose word the journey has not introduced yet
 * shows its plain name («ряди кульок»). Call `update()` from the scene's update.
 *
 *   const ladder = floorLadder(ctx, { floor: () => (world.floor > 0 ? world.floorId : null) });
 *   … update(dt, t) { ladder.update(); }
 *
 * The ladder is drawn by the DOM interface on a desk (lower left); on phones and tablets it is hidden — the
 * header's axis chip carries the floor there (it takes no scene area). Either way the floor is reported to the
 * header (`hud/where.ts`), also under `?hud=gl`. Flat: no 3D effects (DECISIONS §59 p).
 */
import { floorLabel, type ChapterContext } from '@/engine/api';
import { setWhere } from '@/hud/where';
import { hudLayer } from '../custom/layer';
import { h, setClass } from '../core/dom';
import './journey.css';

export interface FloorLadder {
  update(): void;
}

export function floorLadder(ctx: ChapterContext, opts: { floor: () => string | null }): FloorLadder {
  const volume = ctx.nav.volume;
  const floors = [...(volume?.journey.axis.floors ?? [])].sort((a, b) => b.value - a.value);
  if (!volume || floors.length === 0) return { update() {} };
  // the header's axis chip shows the same floor (`hud/where.ts`) — on a phone it is the whole cue
  const key = `${ctx.manifest.volume}/${ctx.manifest.id}`;
  ctx.onDispose(() => setWhere(key, null));
  const layer = hudLayer(ctx, 'floor-ladder-layer');
  if (!layer) {
    let last: string | null | undefined;
    return {
      update() {
        const id = opts.floor();
        if (id !== last) setWhere(key, (last = id));
      },
    };
  }
  const visited = (): Readonly<Record<string, readonly string[]>> => ctx.store.get().progress.visited;
  const rows = floors.map((f) =>
    h(
      'li.fl-row',
      { 'data-floor': f.id },
      h('span.fl-dot', { 'aria-hidden': 'true' }),
      h('span.fl-name', null, floorLabel(volume, f, visited())),
    ),
  );
  const el = h(
    'nav.kd.glass.fl',
    { 'data-ui': 'floor-ladder', 'aria-label': 'Де ми' },
    h('div.kicker', null, 'Де ми'),
    h('ol.fl-list', null, ...rows),
  );
  el.hidden = true;
  layer.append(el);
  let shown: string | null | undefined;
  return {
    update() {
      const id = opts.floor();
      if (id === shown) return;
      shown = id;
      setWhere(key, id);
      el.hidden = id === null;
      floors.forEach((f, i) => {
        const on = f.id === id;
        setClass(rows[i]!, 'on', on);
        if (on) rows[i]!.setAttribute('aria-current', 'location');
        else rows[i]!.removeAttribute('aria-current');
        // the reader may have reached the step that names a floor since the last change
        rows[i]!.lastElementChild!.textContent = floorLabel(volume, f, visited());
      });
    },
  };
}
