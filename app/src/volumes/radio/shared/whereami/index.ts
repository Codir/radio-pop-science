/**
 * The miniature «where are we» (`VISUAL.md` §3) and the two sliders that go with it. The plan only shows: the walls
 * of the house, the camera on the pole, the monitor's route, a dot where the monitor is, the name of the nearest stop,
 * the ±15 cm scale of «move the antenna» and three depth marks. The route and the nudge are moved by ordinary step
 * sliders next to it (P21: the engine has a real slider only in the step panel); their limits and steps live here
 * alone, in `routeSlider` and `nudgeSlider`, and a chapter adds its own `onChange`. Every word comes from the caller.
 */
import { fmtUnit } from '@/content';
import type { ChapterContext } from '@/engine/api';
import type { CustomSpec, SliderSpec } from '@/hud';
import { Label } from '@/ui3d';
import { SITE } from '@radio/sim/core';
import { buildWhereAmI } from './dom';
import { markerAt, nearestStop } from './model';

export interface WhereAmIOptions {
  /** The title, the names of the five stops (0 the yard … 4 the cellar) and of the three depths. */
  labels: {
    title: string;
    stops: readonly [string, string, string, string, string];
    depth: readonly [string, string, string];
  };
  route: () => number;
  nudge: () => number;
  /** 0 the yard · 1 the stand · 2 under the magnifier. */
  depth: () => 0 | 1 | 2;
}

/**
 * The miniature as a `custom` control of the step (id `whereami`): the plan for the DOM interface (`dom.ts`, built
 * once on first show) and, for the WebGL one, a label with the name of the nearest stop. Only a view (P21): no
 * slider on it. The getters are first read when the control is shown (a chapter may build this before it defines
 * the sliders). The context is part of the shared contract's signature; the plan needs nothing of it.
 */
export function whereami(_ctx: ChapterContext, opts: WhereAmIOptions): CustomSpec {
  const stopName = (): string => opts.labels.stops[nearestStop(opts.route())];
  const node = new Label('', { nowrap: true });
  return {
    type: 'custom',
    id: 'whereami',
    node,
    dom: () => buildWhereAmI(opts),
    update: () => {
      node.text = stopName();
    },
  };
}

/**
 * Where the monitor is on the plan (x to the east, y to the north, metres): `markerAt(SITE, …)` for the chapters and
 * sandboxes, which may not import the model.
 */
export function whereAt(route: number, nudge: number): { x: number; y: number } {
  const { x, y } = markerAt(SITE, route, nudge);
  return { x, y };
}

/**
 * The route slider: stops `from`…4 with step 0.01, a mark under each whole stop named by `stops` (one name per stop,
 * in order), starting at `value` (the kitchen by default). Its value reads as the name of the nearest stop.
 */
export function routeSlider(o: {
  label: string;
  stops: readonly string[];
  from?: 0 | 1;
  value?: number;
}): SliderSpec {
  const from = o.from ?? 0;
  if (o.stops.length !== 5 - from)
    throw new RangeError(
      `routeSlider: ${5 - from} stop names for the stops ${from}…4, not ${o.stops.length}`,
    );
  return {
    type: 'slider',
    id: 'route',
    label: o.label,
    min: from,
    max: 4,
    step: 0.01,
    value: o.value ?? 1,
    marks: o.stops.map((label, i) => ({ value: from + i, label })),
    format: (v) => o.stops[nearestStop(v) - from] ?? '',
  };
}

/** «Move the antenna»: −0.15…0.15 m with step 0.005 m, from 0; the value reads in whole centimetres with `unit`. */
export function nudgeSlider(o: { label: string; unit: string }): SliderSpec {
  return {
    type: 'slider',
    id: 'nudge',
    label: o.label,
    unit: o.unit,
    min: -0.15,
    max: 0.15,
    step: 0.005,
    value: 0,
    format: (v) => fmtUnit(Math.round(v * 100), o.unit),
  };
}
