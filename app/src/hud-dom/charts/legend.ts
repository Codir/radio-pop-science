/**
 * DOM legend of the charts (the `ui3d` `Legend`): a swatch — dot, line, dashed line or box — and a caption
 * per item, wrapping in a row. Swatches are CSS boxes (colour by palette token, brightened like the WebGL one).
 */
import type { LegendItem } from '@/ui3d/widgets/legend';
import { h } from '../core/dom';
import { cssColor } from './color';

export function legendEl(items: readonly LegendItem[], cls = ''): HTMLElement {
  const el = h(`ul.kd-legend${cls ? `.${cls}` : ''}` as 'ul');
  for (const item of items) {
    const kind = item.swatch ?? 'line';
    const sw = h(`span.kd-swatch.${kind}` as 'span', { 'aria-hidden': 'true' });
    sw.style.setProperty('--sw', cssColor(item.color, 1, 1.15));
    el.append(h('li', null, sw, h('span', null, item.label)));
  }
  return el;
}
