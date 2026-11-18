/**
 * DOM system row (top-right, desktop shells; WebGL twin `hud/system.ts`): «Бібліотека» (only while the library
 * level is shown), «Мапа», glossary, sound, fullscreen (only where the browser allows it), settings, help, «Почати з нуля»; on touch
 * shells only «Мапа» and «Меню» are shown. «Мобільна версія» closes the row while a phone or tablet shows the
 * desktop shell by the reader's choice («Версія для комп'ютера»).
 */
import type { Hud } from '@/hud/shell';
import type { IconName } from '@/ui3d';
import { h, setClass } from '../core/dom';
import { icon, setIcon } from '../core/icons';

export interface DomSystem {
  readonly el: HTMLElement;
  /** The library button follows the library level (called on a volume change). */
  onVolume(): void;
}

function button(name: string | null, ic: IconName, tip: string, label: string | null, onClick: () => void): HTMLButtonElement {
  const b = h(
    `button.btn${label ? '' : '.icon'}`,
    { type: 'button', 'data-ui': name, 'data-tip': tip, 'aria-label': label ? null : tip },
    icon(ic),
    label ? h('span', null, label) : null,
  );
  b.addEventListener('click', onClick);
  return b;
}

export function createDomSystem(hud: Hud): DomSystem {
  const { engine } = hud;
  const { store } = engine;
  const library = button('sys-library', 'book', 'Усі томи (L)', 'Бібліотека', () => hud.open('library'));
  const sound = button('sys-sound', 'soundOn', 'Звук', null, () => store.updateSettings({ audio: !store.get().settings.audio }));
  // a label, but on a phone held upright only its icon fits (touch.css): the name must not depend on the label
  const mobile = button('sys-mobile', 'touch', 'Мобільна версія', 'Мобільна версія', () => store.updateSettings({ deskShell: false }));
  mobile.setAttribute('aria-label', 'Мобільна версія');
  const full = engine.canFullscreen
    ? button('sys-fullscreen', 'fullscreen', 'На весь екран (F)', null, () => engine.toggleFullscreen())
    : null;
  const el = h(
    'div.kd-system',
    { role: 'toolbar', 'aria-label': 'Мапа, глосарій і налаштування', 'data-ui': 'system' },
    library,
    button('sys-map', 'map', 'Мапа подорожі (M)', 'Мапа', () => hud.open('map')),
    button('sys-glossary', 'glossary', 'Глосарій', null, () => hud.open('glossary')),
    sound,
    full,
    button('sys-settings', 'settings', 'Налаштування', null, () => hud.open('settings')),
    button('sys-help', 'help', 'Довідка', null, () => hud.open('help')),
    // wipe everything the app keeps in the browser, after a confirmation (overlays/reset.ts, engine/reset.ts)
    button('sys-reset', 'resetView', 'Почати з нуля', null, () => hud.open('reset')),
    // touch shells: the map and this one menu (`hud-dom/touch/menu.ts`) stand for the whole row (touch.css)
    button('sys-menu', 'menu', 'Меню', null, () => hud.open('menu')),
    // the way back from «Версія для комп'ютера» on a phone or tablet; shown only there (root `kd-desk-forced`, touch.css)
    mobile,
  );
  store.subscribe(
    (s) => s.settings.audio,
    (on) => {
      setIcon(sound.firstElementChild as HTMLElement, on ? 'soundOn' : 'soundOff');
      // the WebGL button is «selected» while the sound is off
      setClass(sound, 'selected', !on);
      // a toggle button named «Звук»: pressed while the sound is on
      sound.setAttribute('aria-pressed', String(on));
    },
    { immediate: true },
  );
  if (full)
    document.addEventListener('fullscreenchange', () =>
      setIcon(full.firstElementChild as HTMLElement, document.fullscreenElement ? 'fullscreenExit' : 'fullscreen'),
    );
  const onVolume = (): void => void (library.hidden = !hud.libraryLevel);
  onVolume();
  return { el, onVolume };
}
