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
import { MOTION } from '@/style/motion';
import { createNavGlide } from './nav-glide';

/** How the held-back bar comes in (seconds; `rise` in HUD units from below). */
export const REVEAL = { delay: 0.12, fade: 0.5, slide: 0.55, rise: 14 } as const;

export interface DomNavigator {
  readonly el: HTMLElement;
  onChapter(m: ChapterManifest): void;
  onLayout(m: HudMetrics): void;
  /** Per frame: follow the free area the step column leaves (its inset is known only after the layout pass). */
  update(): void;
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
  const glide = createNavGlide(hud, el, nextLabel);
  /** Set at once rather than glide: unseen, reduced motion, or the window itself changed. */
  let resized = true;
  let seen: { w: number; h: number; layout: HudMetrics['layout'] } = { w: 0, h: 0, layout: 'wide' };
  const instant = (): boolean =>
    resized || el.inert || fade.o <= 0.001 || document.documentElement.classList.contains('kd-reduced');
  prev.addEventListener('click', () => void nav.prev());
  next.addEventListener('click', () => void nav.next());

  const sync = (): void => {
    const pos = nav.position;
    if (!manifest || !pos || pos.volumeId !== manifest.volume || pos.chapterId !== manifest.id) return;
    const i = manifest.steps.findIndex((s) => s.id === pos.stepId);
    setText(counter, `${i + 1} / ${manifest.steps.length}`);
    prev.disabled = !nav.canPrev;
    next.disabled = !nav.canNext;
    glide.label(i === manifest.steps.length - 1 && nav.canNext ? 'Далі: наступний розділ' : 'Далі', instant());
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
  // (the camera's free area does not jump) and takes no pointer or focus meanwhile; then it rises a little and
  // fades in on the engine clock (deterministic under `?freeze`). The fade starts slowly — a fast-starting one
  // read as «at once» next to the lamp's flash (the owner, 2026-11-17). Its own `translate`, not `transform`:
  // the CSS positions the bar with `transform`.
  const fade = { o: 1, y: 0 };
  const apply = (): void => {
    setStyle(el, 'opacity', fade.o >= 1 ? '' : fade.o.toFixed(3));
    setStyle(el, 'visibility', fade.o <= 0.001 ? 'hidden' : '');
    setStyle(el, 'translate', fade.y <= 0.01 ? '' : `0 calc(${fade.y.toFixed(2)} * var(--u))`);
  };
  let tweens: { kill(): void }[] = [];
  const gate = (held: boolean): void => {
    el.inert = held;
    setClass(el, 'held', held);
    for (const t of tweens) t.kill();
    tweens = [];
    if (held) {
      fade.o = fade.y = 0;
      return apply();
    }
    if (fade.o >= 1) return apply();
    const reduced = document.documentElement.classList.contains('kd-reduced');
    if (!reduced && fade.o <= 0.001) fade.y = REVEAL.rise;
    apply();
    const t = hud.host.tweens;
    tweens = [
      t.to(
        fade,
        { o: 1 },
        {
          duration: reduced ? 0.2 : REVEAL.fade,
          delay: reduced ? 0 : REVEAL.delay,
          ease: 'sine.inOut',
          onUpdate: apply,
        },
      ),
      t.to(
        fade,
        { y: 0 },
        {
          duration: reduced ? 0.01 : REVEAL.slide,
          delay: reduced ? 0 : REVEAL.delay,
          ease: MOTION.panel.ease,
          onUpdate: apply,
        },
      ),
    ];
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
      if (m.cssWidth !== seen.w || m.cssHeight !== seen.h || m.layout !== seen.layout) resized = true;
      seen = { w: m.cssWidth, h: m.cssHeight, layout: m.layout };
    },
    update() {
      // centred in the area the step column leaves free on wide screens (as hud/navigator.ts). Read here, not in
      // `onLayout`: the shell sets the insets after the regions' `onLayout`, so a value read there is one layout
      // pass old — the bar then sat centred on the whole screen and jumped by half the column at the next
      // relayout, e.g. the first «Далі» (F-navbar-glide)
      const m = hud.metrics;
      const shift = m.layout === 'wide' ? -(hud.engine.hud.insetFractions().right * m.cssWidth) / 2 : 0;
      glide.shift(shift, instant());
      resized = false;
    },
  };
}
