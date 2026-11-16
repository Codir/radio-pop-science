/**
 * Readouts and stat grids of the dock / board (WebGL twins `ui3d/widgets/readout.ts`, `table.ts StatGrid`).
 * Polled every frame; the DOM is written only when the formatted string changes (HUD_DOM §7), numbers are
 * `tabular-nums` in a box reserved for the widest value, so a live value never re-lays the dock out.
 *
 * Count-up (STYLE_GUIDE §5): a value that jumps after holding still for a moment (a measurement, a preset)
 * counts up to its new value on the engine clock; a value that streams (changes every frame) is shown as is —
 * a count-up would only make it lag. Reduced motion: never.
 */
import { fmtUnit } from '@/content/format';
import type { DomHost, ReadoutSpec, StatsSpec } from '@/hud/step-ui-types';
import { hex, type ColorLike } from '@/style/palette';
import type { Tween } from '@/engine/tween';
import { h, setStyle, setText } from '../../core/dom';
import { richEl, setRich } from '../../core/rich';
import type { DomControl } from './types';

/** A value must have held this long (s) before a change counts up instead of jumping. */
const STEADY = 0.25;
const COUNT_UP = 0.45;

/** Colour writes only when the colour itself changes (`hex` is not free per frame). */
function colorWriter(el: HTMLElement): (c: ColorLike | undefined) => void {
  let last: ColorLike | undefined;
  return (c) => {
    if (c === undefined || c === last) return;
    last = c;
    setStyle(el, 'color', hex(c));
  };
}

export function domReadout(c: ReadoutSpec, host: DomHost): DomControl {
  const format =
    c.format ?? ((v: number) => fmtUnit(v, c.unit ?? '', c.digits !== undefined ? { digits: c.digits } : { maxDigits: 2 }));
  const text = c.text;
  const num = h('output.dk-num');
  const el = h('div.dk-ctl.dk-readout', { 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, richEl('span', 'dk-cap', c.label), num);
  const paint = colorWriter(num);
  // reserved width as the WebGL readout: the first value with every digit an 8, plus one more digit
  const first = text ? text() : format(c.get?.() ?? 0);
  if (text) {
    num.classList.add('text');
    setStyle(num, 'min-width', `${Math.max(first.length + 2, 10)}ch`);
  } else setStyle(num, 'min-width', `${`8${first.replace(/\d/g, '8')}`.length}ch`);

  const shown = { v: NaN };
  let target = NaN;
  let since = -Infinity;
  let tween: Tween | null = null;
  const write = (): void => setText(num, format(shown.v));
  const tick = (t: number): void => {
    if (text) {
      setRich(num, text());
      paint(c.color?.(NaN));
      return;
    }
    const v = c.get ? c.get() : NaN;
    paint(c.color?.(v));
    if (v === target || (Number.isNaN(v) && Number.isNaN(target))) return;
    const steady = t - since >= STEADY;
    since = t;
    const from = shown.v;
    target = v;
    tween?.kill();
    tween = null;
    if (steady && Number.isFinite(from) && Number.isFinite(v) && !host.reducedMotion()) {
      tween = host.tweens.to(shown, { v }, { duration: COUNT_UP, ease: 'power2.out', onUpdate: write });
      return;
    }
    shown.v = v;
    write();
  };
  tick(-Infinity);
  return { el, tick, dispose: () => tween?.kill() };
}

export function domStats(c: StatsSpec, columns: number): DomControl {
  const fmt = (it: StatsSpec['items'][number]): string => {
    const v = it.get();
    return typeof v === 'string' ? v : fmtUnit(v, it.unit ?? '', it.digits !== undefined ? { digits: it.digits } : { maxDigits: 2 });
  };
  const cells = c.items.map((it) => {
    const value = h('dd.dk-stat-num');
    return { it, value, paint: colorWriter(value), el: h('div.dk-stat', null, richEl('dt', 'dk-cap', it.label), value) };
  });
  const el = h('dl.dk-ctl.dk-stats', { 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, ...cells.map((x) => x.el));
  el.style.setProperty('--cols', String(columns));
  const tick = (): void => {
    for (const x of cells) {
      setText(x.value, fmt(x.it));
      x.paint(x.it.color?.());
    }
  };
  tick();
  return { el, tick };
}
