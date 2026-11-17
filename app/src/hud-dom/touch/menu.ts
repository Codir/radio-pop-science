/**
 * The menu of the touch shells in the DOM (WebGL twin `hud/touch/menu.ts`): on a phone or tablet the row of system
 * buttons collapses into «Мапа» and this one menu — «Версія для комп'ютера» (first), library (at the library level),
 * map, glossary, sound, fullscreen where the browser has it, settings, help, title screen, «Почати з нуля». D5's modal frame (focus, Esc, scrim); on touch
 * shells touch.css hangs it under the menu button as a popover. Rebuilt on every open: the sound state, the
 * fullscreen API and the library level may have changed.
 */
import type { OverlayName } from '@/hud/context';
import type { IconName } from '@/ui3d';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { domModal, type DomModal } from '../overlays/modal';

export function domMenu(dom: DomHud): DomModal {
  const { hud } = dom;
  const { engine } = hud;
  dom.claim('overlay:menu');
  return domModal(dom, {
    name: 'menu',
    title: 'Меню',
    icon: 'menu',
    width: 380,
    fresh: true,
    build(body) {
      const item = (name: string, ic: IconName, label: string, onClick: () => void): HTMLButtonElement => {
        const b = h('button.btn.ov-menu-item', { type: 'button', 'data-ui': name }, icon(ic), h('span', null, label));
        b.addEventListener('click', onClick);
        return b;
      };
      const go = (overlay: OverlayName) => (): void => hud.open(overlay);
      const soundLabel = (on: boolean): string => (on ? 'Звук: увімкнено' : 'Звук: вимкнено');
      const audio = engine.store.get().settings.audio;
      const sound = item('menu-sound', audio ? 'soundOn' : 'soundOff', soundLabel(audio), () => {
        const on = !engine.store.get().settings.audio;
        engine.store.updateSettings({ audio: on });
        sound.replaceChildren(icon(on ? 'soundOn' : 'soundOff'), h('span', null, soundLabel(on)));
        sound.setAttribute('aria-pressed', String(on));
      });
      sound.setAttribute('aria-pressed', String(audio));
      const rows = [
        // first, so a phone held sideways shows it without scrolling the list: the desktop shell on this device
        // (`Settings.deskShell`); «Мобільна версія» in its system row leads back
        item('menu-desk', 'mouse', "Версія для комп'ютера", () => {
          hud.close();
          engine.store.updateSettings({ deskShell: true });
        }),
        hud.libraryLevel ? item('menu-library', 'book', 'Бібліотека', go('library')) : null,
        item('menu-map', 'map', 'Мапа подорожі', go('map')),
        item('menu-glossary', 'glossary', 'Глосарій', go('glossary')),
        sound,
        engine.canFullscreen
          ? item('menu-fullscreen', 'fullscreen', 'На весь екран', () => {
              hud.close();
              engine.toggleFullscreen();
            })
          : null,
        item('menu-settings', 'settings', 'Налаштування', go('settings')),
        item('menu-help', 'help', 'Довідка', go('help')),
        item('menu-home', 'home', 'Титульний екран', go('home')),
        item('menu-reset', 'resetView', 'Почати з нуля', go('reset')),
      ];
      body.append(h('nav.ov-menu-list', { 'aria-label': 'Меню' }, ...rows));
    },
  });
}
