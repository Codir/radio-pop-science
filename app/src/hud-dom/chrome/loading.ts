/**
 * DOM loading pill (WebGL twin `createLoading` in `hud/hints.ts`): while the engine loads another chapter, a
 * pill above the navigator with a ring that spins, then fills with the reported progress. Quick loads (cached
 * chunks) never flash it: it appears only after 0.25 s. The spin runs on the engine clock.
 */
import type { Hud } from '@/hud/shell';
import { h, setStyle, setText } from '../core/dom';
import { presence } from '../core/motion';

/** Seconds before the pill shows at a same-frame border (longer than the walk to the border, ≈ 2.4 s). */
const QUIET_DELAY = 3;

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
  /** The next chapter is built (a quiet border then only waits for the walk to the border frame). */
  let loaded = false;
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
        // a same-frame border (`quiet`): the chapter on screen walks to the border while the next one loads — the
        // pill only if that loading still runs after the walk would have ended
        if (t.quiet) hud.host.tweens.delay(QUIET_DELAY, () => active && !loaded && p.reveal({ dy: -10 }));
        else hud.host.tweens.delay(0.25, () => active && p.reveal({ dy: -10 }));
      } else if (!loading && active) p.conceal({ dy: -6 });
      active = loading;
      loaded = loading && t.progress >= 1;
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
