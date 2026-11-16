/**
 * Chapter card of the DOM journey map (twin of `hud/map/card.ts`, model `mapCard` of `hud/model/map.ts`): the stop's
 * name («Глава 2» / the part of the volume), its question or title, the floor (a plain name until its word is
 * introduced), size and state chips, the steps as buttons (`map-step-<id>`, seen / current marked) and the way in
 * («Почати главу», «Продовжити», «Повернутися до кроку»). A planned chapter says it is still being prepared.
 */
import type { MapCardModel } from '@/hud/model/map';
import { h, setClass } from '../core/dom';
import { icon } from '../core/icons';
import { applyAccent } from '../core/tokens';
import { ring } from './ring';

export interface CardHooks {
  onStep(stepId: string): void;
  onClose(): void;
}

let serial = 0;

export function mapCardEl(m: MapCardModel, o: CardHooks): HTMLElement {
  const c = m.chapter;
  const titleId = `mp-card-${++serial}`;
  const r = ring(52, 'map-card-ring');
  r.set(
    m.done / Math.max(c.steps.length, 1),
    `${m.done}/${c.steps.length}`,
    `Переглянуто кроків: ${m.done} з ${c.steps.length}`,
  );
  const close = h(
    'button.btn.icon.sm.ghost.mp-card-close',
    {
      type: 'button',
      'aria-label': 'Закрити картку (Esc)',
      'data-tip': 'Закрити (Esc)',
      'data-ui': 'map-card-close',
    },
    icon('close'),
  );
  close.addEventListener('click', o.onClose);
  const steps = m.steps.map((s, i) => {
    const b = h(
      'button.mp-step',
      { type: 'button', 'data-ui': `map-step-${s.id}`, 'aria-current': s.current ? 'step' : null },
      h('span.mp-no', null, String(i + 1)),
      h('span.mp-step-title', null, s.title),
      s.current || s.seen ? icon(s.current ? 'target' : 'check', 'mp-mark') : null,
    );
    if (s.seen && !s.current) b.setAttribute('aria-label', `${i + 1}. ${s.title} (переглянуто)`);
    setClass(b, 'seen', s.seen);
    setClass(b, 'current', s.current);
    b.addEventListener('click', () => o.onStep(s.id));
    return h('li', null, b);
  });
  const action = m.action;
  const go = action
    ? h(
        'button.btn.primary.mp-go',
        { type: 'button', 'data-ui': 'map-go' },
        icon('play'),
        h('span', null, action.label),
      )
    : null;
  go?.addEventListener('click', () => o.onStep(action!.step));
  const el = h(
    'section.kd.card.mp-card',
    { 'aria-labelledby': titleId, 'data-ui': 'map-card' },
    h(
      'header.mp-card-head',
      null,
      c.real ? r.el : h('span.mp-planned-dot', { 'aria-hidden': 'true' }),
      h(
        'div.mp-card-names',
        null,
        h('p.kicker', null, m.kicker),
        h('h2.mp-card-title', { id: titleId }, m.title),
      ),
      close,
    ),
    h(
      'div.mp-facts',
      null,
      m.floor ? h('span.chip.scale', { 'data-tip': 'Поверх шкали' }, icon('ruler'), m.floor) : null,
      ...m.facts.map((f) => h('span.chip', null, f)),
    ),
    steps.length ? h('ol.mp-steps.kd-scroll', { 'aria-label': 'Кроки' }, ...steps) : null,
    go ?? h('p.mp-note', null, m.note ?? ''),
  );
  setClass(el, 'planned', !c.real);
  applyAccent(el, c.accent);
  return el;
}
