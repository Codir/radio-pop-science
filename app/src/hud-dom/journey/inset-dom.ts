/**
 * DOM form of `journeyInset` (inset.ts): floor names beside a plot of the journey (SVG path, round stop buttons
 * at the map's positions) and a card for the opened stop. A narrow widget turns the stops into a list — a CSS
 * container query (journey.css), not a ResizeObserver: a script that changes the widget's size from its own
 * resize notification makes a loop the browser reports as an error (B-circuit-prologue §6.4).
 */
import type { DomWidget } from '@/hud/step-ui-types';
import { h, setClass } from '../core/dom';
import { icon } from '../core/icons';
import type { InsetModel, JourneyInsetOptions } from './inset';
import './journey.css';

const SVG = 'http://www.w3.org/2000/svg';

export function buildDomInset(m: InsetModel, opts: JourneyInsetOptions): DomWidget {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ji-svg');
  const line = (cls: string, points: string): void => {
    const p = document.createElementNS(SVG, 'polyline');
    p.setAttribute('points', points);
    p.setAttribute('class', cls);
    svg.append(p);
  };
  for (const f of m.floors) line('ji-floor', `0,${f.y.toFixed(2)} 100,${f.y.toFixed(2)}`);
  line('ji-path', m.path);
  const floors = h(
    'div.ji-floors',
    { 'aria-hidden': 'true' },
    ...m.floors.map((f) => h('span.ji-floor-name', { style: `top:${f.y.toFixed(2)}%` }, f.name)),
  );
  const card = h(
    'div.ji-card',
    { 'aria-live': 'polite', 'data-ui': 'journey-card' },
    h('p.ji-prompt', null, 'Торкніться зупинки, щоб прочитати її питання.'),
  );
  const stops = m.stops.map((s) => {
    const c = s.chapter;
    const b = h(
      'button.ji-stop',
      {
        type: 'button',
        'data-ui': `journey-stop:${c.id}`,
        style: `left:${s.x.toFixed(2)}%;top:${s.y.toFixed(2)}%`,
        'aria-label': `${s.name}: ${c.title} (${s.meta})`,
      },
      h('span.ji-dot', null, s.mark || icon('hand')),
      h('span.ji-text', null, h('span.ji-q', null, c.title), h('span.ji-meta', null, s.meta)),
    );
    setClass(b, 'here', s.here);
    setClass(b, 'planned', !c.real);
    b.addEventListener('click', () => {
      for (const o of stops) setClass(o, 'selected', o === b);
      setClass(b, 'opened', true);
      card.replaceChildren(h('div.kicker', null, `${s.name} · ${s.meta}`), h('p.ji-title', null, c.title));
      opts.onOpen?.(c.id);
    });
    return b;
  });
  const el = h(
    'div.ji',
    { role: 'group', 'aria-label': 'Мапа тому' },
    h('p.ji-summary', null, icon('clock'), m.summary),
    h('div.ji-map', null, floors, h('div.ji-plot', null, svg, ...stops)),
    card,
  );
  return { el };
}
