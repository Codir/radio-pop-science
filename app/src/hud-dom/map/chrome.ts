/**
 * Chrome of the journey map in the DOM (`?hud=dom`): the title bar (ring, «Мапа подорожі», «Пройдено 1 з 9 глав ·
 * лишилося ≈ 68 хв»), «Уся подорож» (`map-overview`), «Закрити» (`map-close`), the gesture hint and the chapter
 * card. The world, the node labels (D6), the camera and the gestures stay the WebGL `JourneyMap`; this is its
 * `MapChrome` (`attachChrome`) and the overlay `map` that opens both. Scroll / zoom / keys are the map's own.
 */
import { chapterWords } from '@/hud/journey';
import type { JourneyMap, MapChrome } from '@/hud/map/map';
import { mapCard, type MapSummary } from '@/hud/model/map';
import type { Overlay } from '@/hud/shell';
import type { DomHud } from '../core/context';
import { h, setClass, setText } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';
import { blurInside } from '../overlays/modal';
import { mapCardEl } from './card';
import { ring } from './ring';

export function domMapChrome(dom: DomHud, map: JourneyMap): Overlay {
  const { hud } = dom;
  const words = chapterWords(map.journey.volume);
  const total = ring(50, 'map-ring');
  const line = h('p.mp-line');
  const bar = h(
    'header.kd.card.mp-bar',
    { 'data-ui': 'map-title' },
    total.el,
    h('div.mp-bar-text', null, h('h1.mp-title', null, 'Мапа подорожі'), line),
  );
  const button = (
    name: string,
    label: string,
    ic: 'expand' | 'close',
    tip: string,
    onClick: () => void,
  ): HTMLElement => {
    const b = h(
      `button.btn.mp-${name}`,
      { type: 'button', 'data-ui': `map-${name}`, 'data-tip': tip, 'aria-label': label },
      icon(ic),
      h('span.mp-btn-label', null, label),
    );
    b.addEventListener('click', onClick);
    return b;
  };
  const overview = button('overview', 'Уся подорож', 'expand', 'Показати весь шлях', () => map.select(-1));
  const close = button(
    'close',
    'Закрити',
    'close',
    `Повернутися до ${words[0] === 'глава' ? 'глави' : 'розділу'} (M або Esc)`,
    () => hud.close(),
  );
  const hint = h(
    'p.mp-hint',
    null,
    `Тягніть, щоб мандрувати шляхом · колесо — масштаб · ← → — сусідні ${words[1]} · Enter — увійти`,
  );
  const slot = h('div.mp-card-slot');
  const root = h(
    'div.mp-root',
    { 'data-ui': 'map-chrome', hidden: true, tabindex: -1, role: 'region', 'aria-label': 'Мапа подорожі' },
    bar,
    h('div.mp-actions', null, overview, close),
    slot,
    hint,
  );
  dom.layers.modal.append(root);
  const shown = presence(root);
  let card: HTMLElement | null = null;
  let last: MapSummary | null = null;

  const chrome: MapChrome = {
    refresh(sum: MapSummary) {
      total.set(sum.fraction, sum.label, `Пройдено: ${sum.label}`);
      last = sum;
      // a phone's title bar shares its row with the round close button: the short form there
      const m = hud.metrics;
      setText(line, m.shell !== 'desk' && m.width < 520 ? sum.short : sum.text);
    },
    card(node, currentStep) {
      const old = card;
      card = null;
      if (old) presence(old).conceal({ dx: 30, dy: 0, onDone: () => old.remove() });
      setClass(root, 'selected', node !== null);
      if (!node) return;
      const visited = hud.engine.store.get().progress.visited;
      const el = mapCardEl(mapCard(map.journey, node.chapter, visited, currentStep), {
        onStep: (stepId) => map.enter(node, stepId),
        onClose: () => map.select(-1),
      });
      el.hidden = true;
      slot.append(el);
      presence(el).reveal({ dx: 40, dy: 0 });
      card = el;
    },
  };
  map.attachChrome(chrome);
  hud.engine.hud.onResize(() => last && chrome.refresh(last));

  return {
    fullscreen: true,
    open() {
      map.open();
      shown.reveal({ dx: 0, dy: 0, scale: 1 });
      // keys belong to the map (arrows travel, Enter opens): focus leaves the hidden step chrome
      root.focus({ preventScroll: true });
    },
    close() {
      map.close();
      blurInside(root);
      shown.conceal({ dx: 0, dy: 0, scale: 1 });
    },
    key: (e) => map.key(e),
  };
}
