/**
 * Gauge of the dock / board (WebGL twin `ui3d/widgets/gauge.ts`): a radial dial (240° sweep centred on 12
 * o'clock, zone arcs, value arc, needle, hub) in SVG with DOM text, or a linear bar with zone strips and a marker.
 * Units are the SVG user units (the dial is drawn at its WebGL size, 132 units, and scaled by `--u`). Polled every
 * frame; writes only when the needle moves by a visible amount or the text changes.
 */
import { fmtUnit } from '@/content/format';
import type { GaugeSpec } from '@/hud/step-ui-types';
import { hex, type ColorLike } from '@/style/palette';
import { h, setStyle, setText } from '../../core/dom';
import { svg } from '../../custom/kit';
import { richEl } from '../../core/rich';
import type { DomControl } from './types';

/** Dial sweep: 240° centred on 12 o'clock (angles from 12 o'clock, clockwise). */
const START = (-120 * Math.PI) / 180;
const SWEEP = (240 * Math.PI) / 180;
const SIZE = 132;

/** SVG arc path on a circle of radius r around (cx, cy), from angle a0 over `sweep` (clockwise from 12 o'clock). */
function arcPath(cx: number, cy: number, r: number, a0: number, sweep: number): string {
  const p = (a: number): string => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  return `M ${p(a0)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${p(a0 + sweep)}`;
}

export function domGauge(c: GaugeSpec): DomControl {
  const radial = (c.kind ?? 'radial') === 'radial';
  const toT = (v: number): number => Math.min(Math.max((v - c.min) / (c.max - c.min || 1), 0), 1);
  const format = (v: number): string => fmtUnit(v, c.unit ?? '', c.digits !== undefined ? { digits: c.digits } : { maxDigits: 1 });
  const zoneOf = (t: number): ColorLike | undefined => {
    const v = c.min + (c.max - c.min) * t;
    return c.zones?.find((z) => v >= z.from && v <= z.to)?.color;
  };
  const value = h('output.dk-gauge-num');
  const cap = richEl('span', 'dk-cap', c.label);
  let last = { t: NaN, tone: undefined as ColorLike | undefined };
  let draw: (t: number) => void;
  let el: HTMLElement;
  if (radial) {
    const d = SIZE;
    const th = d * 0.085;
    const cx = d / 2;
    const cy = d / 2;
    const ring = (r: number, a0: number, sweep: number, w: number, cls: string): SVGPathElement =>
      svg('path', { d: arcPath(cx, cy, r, a0, sweep), 'stroke-width': w, class: cls, fill: 'none' });
    const zones = (c.zones ?? []).map((z) => {
      const p = ring(d / 2 - th / 2, START + SWEEP * toT(z.from), SWEEP * (toT(z.to) - toT(z.from)), th * 0.42, 'zone');
      p.style.stroke = hex(z.color);
      return p;
    });
    const fill = ring(d / 2 - th * 1.5 - th * 0.25, START, SWEEP, th * 0.5, 'fill');
    fill.setAttribute('pathLength', '1');
    const needle = svg('line', { x1: cx, y1: cy, x2: cx, y2: cy - (d / 2 - th * 1.6), class: 'needle' });
    const hub = svg('circle', { cx, cy, r: d * 0.055, class: 'hub' });
    const dial = svg(
      'svg',
      { viewBox: `0 0 ${d} ${d * 0.96}`, class: 'dk-dial', 'aria-hidden': 'true' },
      ring(d / 2 - th / 2, START, SWEEP, th, 'well'),
      ...zones,
      fill,
      needle,
      hub,
    );
    el = h('div.dk-ctl.dk-gauge.radial', { 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, dial, value, cap);
    // called only when the needle moved (`tick` compares), so plain writes
    draw = (t) => {
      fill.style.strokeDasharray = `${t.toFixed(4)} 1`;
      fill.style.opacity = t > 0.004 ? '' : '0';
      needle.style.transform = `rotate(${(((START + SWEEP * t) * 180) / Math.PI).toFixed(2)}deg)`;
    };
  } else {
    const fill = h('span.fill');
    const mark = h('span.mark');
    const zones = (c.zones ?? []).map((z) => {
      const s = h('span.zone');
      s.style.left = `${(toT(z.from) * 100).toFixed(2)}%`;
      s.style.width = `calc(${((toT(z.to) - toT(z.from)) * 100).toFixed(2)}% - 3 * var(--u))`;
      s.style.background = hex(z.color);
      return s;
    });
    const bar = h('div.dk-lbar', { 'aria-hidden': 'true' }, h('span.rail'), ...zones, fill, mark);
    el = h('div.dk-ctl.dk-gauge.linear', { 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, h('div.dk-head', null, cap, value), bar);
    draw = (t) => setStyle(bar, '--t', t.toFixed(4));
  }
  el.setAttribute('role', 'meter');
  el.setAttribute('aria-label', c.label);
  el.setAttribute('aria-valuemin', String(c.min));
  el.setAttribute('aria-valuemax', String(c.max));
  const tick = (): void => {
    const v = c.get();
    const text = format(v);
    setText(value, text);
    const t = toT(v);
    if (Math.abs(t - last.t) < 5e-4) return;
    el.setAttribute('aria-valuenow', String(v));
    el.setAttribute('aria-valuetext', text);
    const tone = zoneOf(t);
    if (tone !== last.tone) setStyle(el, '--tone', tone === undefined ? 'var(--accent)' : hex(tone));
    last = { t, tone };
    draw(t);
  };
  tick();
  return { el, tick };
}
