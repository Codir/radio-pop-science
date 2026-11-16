/**
 * DOM step navigator (bottom centre of the free area): previous / one segment per step / next.
 * Same behaviour as `hud/navigator.ts`; segments are real buttons with the step title as their name.
 */
import { fullChapterId, type ChapterManifest, type HudMetrics } from '@/engine/api';
import { isVisited } from '@/content';
import { navHidden, onNavGate } from '@/hud/nav-gate';
import type { Hud } from '@/hud/shell';
import { h, setClass, setStyle, setText } from '../core/dom';
import { icon } from '../core/icons';

export interface DomNavigator {
  readonly el: HTMLElement;
  onChapter(m: ChapterManifest): void;
  onLayout(m: HudMetrics): void;
  sync(): void;
}

export function createDomNavigator(hud: Hud): DomNavigator {
  const { nav, store } = hud.engine;
  let manifest: ChapterManifest | null = null;
  const prev = h(
    'button.btn.icon',
    {
      type: 'button',
      'data-ui': 'nav-prev',
      'data-tip': 'Попередній крок (←)',
      'aria-label': 'Попередній крок',
    },
    icon('prev'),
  );
  const nextLabel = h('span', null, 'Далі');
  const next = h(
    'button.btn.primary.md',
    { type: 'button', 'data-ui': 'nav-next', 'data-tip': 'Наступний крок (→)' },
    nextLabel,
    icon('next'),
  );
  const dots = h('ol.dots');
  const counter = h('div.nav-count', { 'aria-hidden': 'true' });
  const el = h(
    'nav.kd.card.nav',
    { 'data-ui': 'navigator', 'aria-label': 'Кроки розділу' },
    prev,
    h('div.nav-mid', null, dots, counter),
    next,
  );
  prev.addEventListener('click', () => void nav.prev());
  next.addEventListener('click', () => void nav.next());

  const sync = (): void => {
    const pos = nav.position;
    if (!manifest || !pos || pos.volumeId !== manifest.volume || pos.chapterId !== manifest.id) return;
    const i = manifest.steps.findIndex((s) => s.id === pos.stepId);
    setText(counter, `${i + 1} / ${manifest.steps.length}`);
    prev.disabled = !nav.canPrev;
    next.disabled = !nav.canNext;
    setText(nextLabel, i === manifest.steps.length - 1 && nav.canNext ? 'Далі: наступний розділ' : 'Далі');
    const visited = store.get().progress.visited;
    const key = fullChapterId(manifest);
    [...dots.children].forEach((li, k) => {
      const b = li.firstElementChild as HTMLElement;
      setClass(b, 'seen', isVisited(visited, key, manifest!.steps[k]!.id));
      setClass(b, 'on', k === i);
      if (k === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  };
  store.subscribe((s) => s.target, sync);
  store.subscribe((s) => s.progress, sync);

  // held back until the step's condition (stepUi `nav.hiddenUntil`, hud/nav-gate.ts): the bar keeps its place
  // (the camera's free area does not jump), fades in on the engine clock, and takes no pointer or focus meanwhile
  const fade = { o: 1 };
  const apply = (): void => {
    setStyle(el, 'opacity', fade.o >= 1 ? '' : fade.o.toFixed(3));
    setStyle(el, 'visibility', fade.o <= 0.001 ? 'hidden' : '');
  };
  let tween: { kill(): void } | null = null;
  const gate = (held: boolean): void => {
    el.inert = held;
    setClass(el, 'held', held);
    tween?.kill();
    tween = null;
    const reduced = document.documentElement.classList.contains('kd-reduced');
    if (held || document.documentElement.classList.contains('kd-freeze')) {
      fade.o = held ? 0 : 1;
      return apply();
    }
    tween = hud.host.tweens.to(
      fade,
      { o: 1 },
      { duration: reduced ? 0.12 : 0.6, ease: 'power1.out', onUpdate: apply },
    );
  };
  onNavGate(gate);

  return {
    el,
    sync,
    onChapter(m) {
      manifest = m;
      dots.replaceChildren(
        ...m.steps.map((s, i) => {
          const b = h('button.dot', {
            type: 'button',
            'data-tip': `${i + 1}. ${s.title}`,
            'aria-label': `Крок ${i + 1}: ${s.title}`,
          });
          b.addEventListener('click', () => void nav.goto(fullChapterId(m), s.id));
          return h('li', null, b);
        }),
      );
      // segment width as the WebGL stepper: half the screen shared by the steps, 22…44 units each
      const fit = Math.min(44, Math.max(22, (hud.metrics.width * 0.5) / Math.max(m.steps.length, 1)));
      setStyle(dots, '--seg', fit.toFixed(2));
      sync();
      gate(navHidden());
    },
    onLayout(m) {
      // centred in the area the step column leaves free on wide screens (as hud/navigator.ts)
      const shift = m.layout === 'wide' ? -(hud.engine.hud.insetFractions().right * m.cssWidth) / 2 : 0;
      setStyle(el, '--shift', `${shift.toFixed(1)}px`);
    },
  };
}
