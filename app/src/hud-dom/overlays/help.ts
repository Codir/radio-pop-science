/**
 * DOM help «Керування» (twin of `hud/overlays/help.ts`, content from `hud/model/help.ts`): sections of key caps
 * (`<kbd>`) and what they do, as a definition list — touch-first on a coarse pointer, else mouse, touch, keyboard
 * side by side with the journey map's line under them. Rebuilt on every open: the device may have changed.
 */
import { helpModel } from '@/hud/model/help';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { domModal, type DomModal } from './modal';

export function domHelp(dom: DomHud): DomModal {
  const { hud } = dom;
  return domModal(dom, {
    name: 'help',
    title: 'Керування',
    icon: 'help',
    width: 1040,
    fresh: true,
    build(body) {
      const model = helpModel(hud.engine.device, hud.volume);
      const sections = model.sections.map((s) =>
        h(
          'section.ov-help-part',
          null,
          h('h3.ov-help-title', null, icon(s.icon, 'ov-help-icon'), s.title),
          h(
            'dl.ov-keys',
            null,
            ...s.rows.flatMap(([keys, text]) => [
              h('dt', null, ...keys.map((k) => h('kbd', null, k))),
              h('dd', null, text),
            ]),
          ),
        ),
      );
      body.append(h(model.touchFirst ? 'div.ov-help.stack' : 'div.ov-help', null, ...sections));
      if (model.note) body.append(h('p.ov-help-note', null, model.note));
    },
  });
}
