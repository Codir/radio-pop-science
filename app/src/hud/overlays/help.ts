/**
 * Help overlay: how to control the course with a mouse, by touch and from the keyboard.
 */
import { Icon, Label, Panel, TEXT_COLOR, UI, UiNode, rgba, type IconName, type Painter } from '@/ui3d';
import { helpModel } from '../model/help';
import type { Hud, Overlay } from '../shell';
import { createModal } from './modal';

class KeyCap extends UiNode {
  constructor(text: string) {
    super({ pad: [3, 9], minW: 34, align: 'center', dir: 'col' });
    this.add(new Label(text, { font: 'mono', size: UI.text.caption, nowrap: true, align: 'center' }));
  }
  override paint(p: Painter): void {
    p.rect(0, -1.5, this.bw, this.bh, { r: 7, fill: rgba('slate', 0.9) });
    p.rect(0, 1, this.bw, this.bh - 3, { r: 7, fill: rgba('bg.indigo'), border: rgba('mist', 0.5), bw: 1 });
  }
}

function line(keys: readonly string[], text: string): UiNode {
  return new UiNode({
    dir: 'row',
    align: 'center',
    gap: 10,
    width: 'fill',
    children: [
      new UiNode({ dir: 'row', gap: 4, width: 112, wrap: true, children: keys.map((k) => new KeyCap(k)) }),
      new Label(text, { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.3 }, { width: 'fill' }),
    ],
  });
}

function section(
  icon: IconName,
  title: string,
  rows: readonly (readonly [readonly string[], string])[],
): UiNode {
  return new Panel({
    variant: 'inset',
    width: 'fill',
    gap: 10,
    pad: [14, 16],
    blocks: false,
    children: [
      new UiNode({
        dir: 'row',
        align: 'center',
        gap: 10,
        children: [
          new Icon(icon, 24, 'cyan'),
          new Label(title, { font: 'display', size: UI.text.h3, nowrap: true }),
        ],
      }),
      ...rows.map(([k, t]) => line(k, t)),
    ],
  });
}

export function createHelp(hud: Hud): Overlay {
  return createModal(hud, {
    title: 'Керування',
    icon: 'help',
    width: 1040,
    fresh: true, // the device may have changed (a tablet got a keyboard, emulation was switched)
    build(body) {
      const model = helpModel(hud.engine.device, hud.volume);
      const all = model.sections.map((x) => section(x.icon, x.title, x.rows));
      if (model.touchFirst) {
        body.add(new UiNode({ dir: 'col', gap: 14, width: 'fill', children: all }));
        return;
      }
      const cols = new UiNode({ dir: 'row', gap: 14, wrap: true, width: 'fill', align: 'start' });
      const w = hud.metrics.width > 1100 ? 318 : 'fill';
      for (const s of all) {
        s.width = w;
        cols.add(s);
      }
      body.add(cols);
      if (model.note)
        body.add(
          new Label(
            model.note,
            { size: UI.text.small, color: TEXT_COLOR.dim, lineHeight: 1.4 },
            { width: 'fill' },
          ),
        );
    },
  });
}
