/**
 * Home screen of a volume in the DOM (twin of `hud/home.ts`, model `hud/model/home.ts`): kicker, headline, subtitle
 * and lead from the volume manifest over its journey map drifting in "attract" mode (or the lobby's bare
 * backdrop), «Продовжити» for a returning reader, «Почати подорож» / «Почати спочатку», «Мапа», «Бібліотека» while
 * the library level is shown, the size chips; an empty volume shows its `emptyNote` instead. At the foot, set apart,
 * the way to the volumes kept aside or back to the front door (`home-aside.ts`, DECISIONS §60).
 */
import { contentKey } from '@/content';
import { asideLinks, enterVolume } from '@/hud/home-aside';
import type { HomeStage } from '@/hud/home';
import type { Journey } from '@/hud/journey';
import { homeModel, homeStart } from '@/hud/model/home';
import type { Overlay } from '@/hud/shell';
import type { IconName } from '@/ui3d';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';
import { setRich } from '../core/rich';
import { blurInside } from '../overlays/modal';

const btn = (name: string, label: string, ic: IconName, cls: string, after = false): HTMLButtonElement =>
  h(
    `button.btn.${cls}`,
    { type: 'button', 'data-ui': name },
    after ? null : icon(ic),
    h('span', null, label),
    after ? icon(ic) : null,
  );

/** Reveal from `dy` units (y up) after `delay` s, as `revealAll` of the WebGL kit. */
function rise(el: HTMLElement, dy: number, delay: number): void {
  const p = presence(el);
  p.conceal({ instant: true });
  p.reveal({ dy, scale: 1, delay });
}

export function domHome(dom: DomHud, journey: Journey, stage: HomeStage): Overlay {
  const { hud } = dom;
  const { store, library } = hud.engine;
  const volume = journey.volume;
  const m = homeModel(journey, library.showsLibrary(volume.id));
  const title = h('h1.hm-title');
  setRich(title, m.headline);
  const resume = btn('home-resume', 'Продовжити', 'next', 'primary.lg', true);
  resume.addEventListener('click', () => hud.close());
  const start = btn('home-start', 'Почати подорож', 'play', 'primary.lg');
  const startLabel = start.querySelector('span')!;
  let startAction = (): void => hud.open('map');
  start.addEventListener('click', () => startAction());
  const mapBtn = btn('home-map', 'Мапа', 'map', 'lg');
  mapBtn.addEventListener('click', () => hud.open('map'));
  const libBtn = m.library ? btn('home-library', 'Бібліотека', 'book', 'lg') : null;
  libBtn?.addEventListener('click', () => hud.open('library'));
  const facts = m.facts.map((f) =>
    h(
      f.kind === 'scale' ? 'span.chip.scale' : 'span.chip',
      null,
      f.icon ? icon(f.icon) : icon('ruler'),
      f.text,
    ),
  );
  const parts = (
    [
      m.kicker ? h('p.kicker.hm-kicker', null, m.kicker) : null,
      title,
      m.tagline ? h('p.hm-tagline', null, m.tagline) : null,
      m.lead ? h('p.hm-lead', null, m.lead) : null,
      ...(m.empty
        ? [m.note ? h('p.chip.hm-note', { 'data-ui': 'home-empty' }, icon('clock'), m.note) : null]
        : [h('div.hm-actions', null, resume, start, mapBtn, libBtn), h('div.hm-facts', null, ...facts)]),
    ] as (HTMLElement | null)[]
  ).filter((p): p is HTMLElement => p !== null);
  const col = h('div.hm-col', null, ...parts);
  const links = asideLinks(hud, volume).map((l) => {
    const b = btn(l.name, l.label, l.icon, 'ghost');
    b.addEventListener('click', () => enterVolume(hud, l.volume));
    return b;
  });
  const aside = links.length
    ? h('nav.hm-aside', { 'data-ui': 'home-aside', 'aria-label': 'Інші томи' }, ...links)
    : null;
  const root = h(
    'div.hm-root',
    { 'data-ui': 'home', hidden: true, tabindex: -1 },
    h('div.hm-veil', { 'aria-hidden': 'true' }),
    col,
    aside,
  );
  root.classList.toggle('bare', m.bare);
  dom.layers.modal.append(root);
  const shown = presence(root);

  return {
    fullscreen: true,
    open() {
      const s = store.get();
      const chapters = library.registry(volume.id)?.chapters ?? [];
      const st = homeStart(s.progress.visited, s.lastIn, volume.id, chapters);
      // returning readers continue where they stopped; first-time readers start the journey on the map
      resume.hidden = !st.seen;
      startLabel.textContent = st.startLabel;
      const first = st.first;
      startAction = st.seen && first ? () => hud.goto(contentKey(first)) : () => hud.open('map');
      stage.setAttract(true);
      shown.reveal({ dx: 0, dy: 0, scale: 1, duration: 0.5 });
      // the column rises in one by one, the foot row comes down (the WebGL home's `revealAll`)
      parts.forEach((p, i) => rise(p, -22, i * 0.07));
      if (aside) aside.querySelectorAll<HTMLElement>('button').forEach((b, i) => rise(b, 12, i * 0.07));
      // focus leaves the hidden step chrome; Tab reaches the first action (no ring on a button not chosen yet)
      root.focus({ preventScroll: true });
    },
    close() {
      stage.setAttract(false);
      blurInside(root);
      shown.conceal({ dx: 0, dy: 30, scale: 1 });
    },
  };
}
