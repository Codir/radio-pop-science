/**
 * DOM loading pill (WebGL twin `createLoading` in `hud/hints.ts`): while the engine loads another chapter, a
 * pill above the navigator with a ring that spins, then fills with the reported progress. Quick loads (cached
 * chunks) never flash it: it appears only after 0.25 s. The spin runs on the engine clock.
 */
import type { Hud } from '@/hud/shell';
import { h, setStyle, setText } from '../core/dom';
import { presence } from '../core/motion';

export interface DomLoading {
  readonly el: HTMLElement;
  update(dt: number): void;
}

export function createDomLoading(hud: Hud): DomLoading {
  const ring = h('span.kd-spin', { 'aria-hidden': 'true' });
  const text = h('span', null, 'Завантаження розділу…');
  const pill = h('div.kd.card.kd-loading', { 'data-ui': 'loading' }, ring, text);
  pill.hidden = true;
  // the host centres the pill; the pill's own transform is its reveal / conceal
  const el = h('div.kd-loading-host', { role: 'status' }, pill);
  const p = presence(pill);
  let active = false;
  let spin: number | null = 0;
  hud.engine.store.subscribe(
    (s) => s.transition,
    (t) => {
      const loading = t.phase === 'loading';
      if (loading && !active) {
        const title = t.to ? hud.engine.library.chapter(t.to)?.title : undefined;
        setText(text, title ? `Завантаження: ${title}…` : 'Завантаження розділу…');
        spin = 0;
        setStyle(ring, '--p', '25%');
        hud.host.tweens.delay(0.25, () => active && p.reveal({ dy: -10 }));
      } else if (!loading && active) p.conceal({ dy: -6 });
      active = loading;
      if (loading && t.progress > 0.02) {
        spin = null;
        setStyle(ring, 'transform', '');
        setStyle(ring, '--p', `${(Math.min(t.progress, 1) * 100).toFixed(1)}%`);
      }
    },
  );
  return {
    el,
    update(dt) {
      if (!active || spin === null) return;
      spin += dt * 4.2;
      setStyle(ring, 'transform', `rotate(${spin.toFixed(3)}rad)`);
    },
  };
}
