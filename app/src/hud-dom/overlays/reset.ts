/**
 * «Почати з нуля» — the confirmation behind the system bar's reset button (DOM interface only; the WebGL twin is a
 * press-twice button in its settings). D5's modal frame: scrim click, Esc and «Скасувати» cancel, focus starts on
 * the safe choice «Скасувати» and stays inside. «Скинути» wipes the app's browser state and reloads at the
 * beginning (`engine/reset.ts`).
 */
import { resetApp } from '@/engine/reset';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { domModal, type DomModal } from './modal';

export function domReset(dom: DomHud): DomModal {
  const { hud } = dom;
  let cancel: HTMLButtonElement | null = null;
  return domModal(dom, {
    name: 'reset',
    title: 'Почати з нуля',
    icon: 'resetView',
    width: 420,
    fresh: true,
    build(body) {
      const confirm = h(
        'button.btn.primary',
        { type: 'button', 'data-ui': 'reset-confirm' },
        icon('resetView'),
        h('span', null, 'Скинути'),
      );
      confirm.addEventListener('click', () => {
        confirm.disabled = true; // one wipe; the page reloads
        void resetApp(hud.engine.store);
      });
      cancel = h('button.btn', { type: 'button', 'data-ui': 'reset-cancel' }, h('span', null, 'Скасувати'));
      cancel.addEventListener('click', () => hud.close());
      body.append(
        h('p.ov-reset-text', null, 'Скинути весь поступ і налаштування? Усі томи почнуться спочатку.'),
        h('div.ov-reset-actions', null, cancel, confirm),
      );
    },
    focus: () => cancel,
  });
}
