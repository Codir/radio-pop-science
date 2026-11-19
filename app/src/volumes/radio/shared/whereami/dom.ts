/**
 * The miniature «where are we» for the DOM interface (`custom.dom` of `whereami`, `VISUAL.md` §3), from top to bottom:
 * the title; the plan with the north up — the walls of the house (`steel`), the camera on the pole at `tx` (`sky`),
 * the monitor's route through its five stops (dashed `mist`) and the monitor's dot (`yellow`; hollow, with an outline,
 * in the cellar under the slab); the name of the nearest stop; the ±15 cm scale of «move the antenna», ticks only,
 * with a tick where the antenna is now; the three depth marks, the current one lit. No stylesheet of its own: the
 * plan sits in the platform's `.kd-diagram`, which stretches its one `<svg>` child over its height (`--h` units), and
 * every other size is inline in `var(--u)`. The DOM is written only when the route, the nudge or the depth changed;
 * nothing follows the pointer.
 */
import { type DomWidget, domKit } from '@/hud';
import { SITE } from '@radio/sim/core';
import type { WhereAmIOptions } from './index';
import { markerAt, nearestStop, planOf } from './model';

/** Height of the plan, units. */
const PLAN_H = 150;
/** Plan marks, metres: wall and route widths, the route's dashes, the camera's and the dot's radii, the outline. */
const MARK = { wall: 0.18, route: 0.1, dash: '0.45 0.3', camera: 0.45, dot: 0.55, ring: 0.18 } as const;
/** The nudge scale: its half-length, ticks and margin, mm (the slider's ±0.15 m); its box, units. */
const SCALE = { half: 150, tick: 50, pad: 10, width: 240, height: 18 } as const;
/** The scale's view, mm: as wide as the rail and its margins, as tall as the box's proportions give (24 mm). */
const VIEW_W = 2 * (SCALE.half + SCALE.pad);
const VIEW_H = (VIEW_W * SCALE.height) / SCALE.width;

/**
 * A number for an SVG attribute at full precision (`svg()` of the kit rounds to 0.01, and QA compares the dot's place
 * with `whereAt` to 1e-6).
 */
const num = (v: number): string => String(v);

export function buildWhereAmI(opts: WhereAmIOptions): DomWidget {
  const { h, svg, setText } = domKit;
  const plan = planOf(SITE);
  const [west, south, east, north] = plan.box;

  // the plan: (x, y) of the plan at (x, −y) of the SVG
  const map = svg('svg', {
    viewBox: [west, -north, east - west, north - south]
      .map((v) => num(Math.round(v * 1000) / 1000))
      .join(' '),
    'aria-hidden': 'true',
  });
  for (const w of plan.walls)
    map.append(
      svg('line', {
        x1: w.a[0],
        y1: -w.a[1],
        x2: w.b[0],
        y2: -w.b[1],
        'stroke-width': MARK.wall,
        'stroke-linecap': 'round',
        style: 'stroke: var(--c-steel)',
      }),
    );
  map.append(
    svg('polyline', {
      points: plan.route.map((p) => `${num(p.x)},${num(-p.y)}`).join(' '),
      fill: 'none',
      'stroke-width': MARK.route,
      'stroke-dasharray': MARK.dash,
      'stroke-linejoin': 'round',
      style: 'stroke: var(--c-mist)',
    }),
    svg('circle', { cx: plan.tx[0], cy: -plan.tx[1], r: MARK.camera, style: 'fill: var(--c-sky)' }),
  );
  const dot = svg('circle', { r: MARK.dot, 'stroke-width': MARK.ring, 'data-ui': 'ctl-whereami:dot' });
  map.append(dot);
  const diagram = h('div.kd-diagram', null, map);
  diagram.style.setProperty('--h', String(PLAN_H));

  const stop = h('div', {
    'data-ui': 'ctl-whereami:stop',
    style: 'font-size: calc(var(--t-body) * var(--u)); line-height: 1.3; color: var(--c-white)',
  });

  // the nudge scale, in mm: a rail, a tick every 5 cm (longer at 0 and the ends), the antenna's tick
  const scale = svg('svg', {
    viewBox: `${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`,
    'aria-hidden': 'true',
    style:
      `display: block; width: calc(${SCALE.width} * var(--u)); max-width: 100%; ` +
      `height: calc(${SCALE.height} * var(--u)); overflow: visible`,
  });
  const steel = 'stroke: var(--c-steel)';
  scale.append(
    svg('line', { x1: -SCALE.half, y1: 0, x2: SCALE.half, y2: 0, 'stroke-width': 2, style: steel }),
  );
  for (let mm = -SCALE.half; mm <= SCALE.half; mm += SCALE.tick) {
    const long = mm === 0 || Math.abs(mm) === SCALE.half;
    scale.append(
      svg('line', { x1: mm, y1: long ? -8 : -5, x2: mm, y2: long ? 8 : 5, 'stroke-width': 2, style: steel }),
    );
  }
  const pointer = svg('line', {
    y1: -11,
    y2: 11,
    'stroke-width': 4,
    'stroke-linecap': 'round',
    'data-ui': 'ctl-whereami:nudge',
    style: 'stroke: var(--c-yellow)',
  });
  scale.append(pointer);

  const depth = opts.labels.depth.map((label, i) =>
    h('span', { 'data-ui': `ctl-whereami:depth-${i}` }, label),
  );
  const depthRow = h(
    'div',
    {
      style:
        'display: flex; flex-wrap: wrap; gap: calc(4 * var(--u)) calc(16 * var(--u)); ' +
        'font-size: calc(var(--t-caption) * var(--u)); line-height: 1.3',
    },
    ...depth,
  );

  const el = h(
    'div',
    {
      'data-ui': 'ctl-whereami',
      style: 'display: flex; flex-direction: column; gap: calc(6 * var(--u)); width: 100%; min-width: 0',
    },
    h(
      'div',
      { style: 'font-size: calc(var(--t-small) * var(--u)); line-height: 1.42; color: var(--c-mist)' },
      opts.labels.title,
    ),
    diagram,
    stop,
    scale,
    depthRow,
  );

  let route = Number.NaN;
  let nudge = Number.NaN;
  let level = -1;
  const update = (): void => {
    const r = opts.route();
    const n = opts.nudge();
    const d = opts.depth();
    if (r !== route || n !== nudge) {
      const p = markerAt(SITE, r, n);
      dot.setAttribute('cx', num(p.x));
      dot.setAttribute('cy', num(-p.y));
      dot.style.cssText = p.below
        ? 'fill: none; stroke: var(--c-yellow)'
        : 'fill: var(--c-yellow); stroke: none';
      if (p.below) dot.setAttribute('data-below', 'true');
      else dot.removeAttribute('data-below');
      setText(stop, opts.labels.stops[nearestStop(r)]);
    }
    if (n !== nudge) {
      const mm = num(Math.min(SCALE.half, Math.max(-SCALE.half, n * 1000)));
      pointer.setAttribute('x1', mm);
      pointer.setAttribute('x2', mm);
      pointer.setAttribute('data-value', n.toFixed(3));
    }
    if (d !== level)
      depth.forEach((mark, i) => {
        if (i === d) mark.setAttribute('aria-current', 'true');
        else mark.removeAttribute('aria-current');
        mark.style.cssText = i === d ? 'color: var(--c-yellow); font-weight: 600' : 'color: var(--c-steel)';
      });
    route = r;
    nudge = n;
    level = d;
  };
  update();
  return { el, update };
}
