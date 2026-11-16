/**
 * The small DOM kit a chapter needs to write a `custom.dom` widget or fill a `hudLayer` (exported from
 * `@/hud`, docs/UI_API.md §8): the element factory and write-on-change setters of the DOM core, an SVG
 * element factory and `observeUnits` — the element's size in HUD units, re-measured only on resize (never read
 * layout per frame, HUD_DOM §7). Styling comes from the platform's classes (`custom.css`, `base.css`); chapters
 * set colours through custom properties (`--c` …) and palette tokens (`var(--c-yellow)`).
 */
import type { Painter, ShapeStyle } from '@/ui3d/core/painter';
import { h, setClass, setStyle, setText } from '../core/dom';
import { applyAccent } from '../core/tokens';
import { cssColor, cssRgba } from '../charts/color';

export { h, setClass, setStyle, setText };

/**
 * Colours for SVG / canvas marks that look like the WebGL painter's: `color(token, alpha, lit)` (brightened
 * like `lit(rgba(token), k)`), `rgbaColor(rgba)` for a linear `Rgba` of `@/ui3d`.
 */
export { cssColor as color, cssRgba as rgbaColor };

/** Give an element (and its subtree) a tone: `--accent` / `--accent-rgb` from any palette token or colour. */
export const tone = applyAccent;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** `svg('line', { x1: 0, … })` — an SVG element with attributes (numbers rounded to 0.01). */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs))
    el.setAttribute(k, typeof v === 'number' ? String(Math.round(v * 100) / 100) : v);
  el.append(...children);
  return el;
}

/** The subset of the WebGL `Painter` a diagram needs — drawn by `Painter` itself or by `svgPainter`. */
export type ShapePainter = Pick<Painter, 'line' | 'circle' | 'rect'>;

/**
 * A `ShapePainter` that appends SVG shapes to `g`: the same calls (units, **y up**, origin where the caller puts
 * it) as a WebGL `paint(p)`, so one drawing function serves both interfaces. Borders stay inside the shape as
 * in the WebGL painter; `glow` becomes a drop shadow.
 */
export function svgPainter(g: SVGGElement): ShapePainter {
  const paint = (el: SVGElement, s: ShapeStyle): SVGElement => {
    el.setAttribute('fill', s.fill ? cssRgba(s.fill) : 'none');
    if (s.border && s.bw) {
      el.setAttribute('stroke', cssRgba(s.border));
      el.setAttribute('stroke-width', String(s.bw));
    }
    if (s.glow && s.border)
      el.style.filter = `drop-shadow(0 0 ${(s.glow / 2).toFixed(1)}px ${cssRgba([s.border[0], s.border[1], s.border[2], s.glowAlpha ?? 0.35])})`;
    g.append(el);
    return el;
  };
  return {
    line(ax, ay, bx, by, width, s) {
      const el = svg('line', { x1: ax, y1: -ay, x2: bx, y2: -by, 'stroke-width': width, 'stroke-linecap': 'round' });
      el.setAttribute('stroke', s.fill ? cssRgba(s.fill) : 'none');
      g.append(el);
    },
    circle(cx, cy, d, s) {
      paint(svg('circle', { cx, cy: -cy, r: Math.max(d / 2 - (s.border ? (s.bw ?? 0) / 2 : 0), 0) }), s);
    },
    rect(cx, cy, w, h, s) {
      const inset = s.border ? (s.bw ?? 0) / 2 : 0;
      const el = paint(svg('rect', { x: cx - w / 2 + inset, y: -cy - h / 2 + inset, width: w - 2 * inset, height: h - 2 * inset, rx: s.r ?? 0 }), s);
      // abutting opaque fills (a ribbon split into pieces) leave an anti-aliased hairline seam between them in SVG
      // (the WebGL mesh has none): a hairline stroke in the fill colour closes it
      if (s.fill && !s.border && (s.fill[3] ?? 1) >= 1) {
        el.setAttribute('stroke', cssRgba(s.fill));
        el.setAttribute('stroke-width', '0.6');
      }
    },
  };
}

/**
 * Call `onSize(width, height)` in HUD units now and whenever `el`'s box changes (layout, `--u`, text size).
 * Returns the function that stops observing.
 */
export function observeUnits(el: Element, onSize: (width: number, height: number) => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const ro = new ResizeObserver((entries) => {
    const r = entries[entries.length - 1]!.contentRect;
    if (r.width <= 0) return;
    const u = parseFloat(getComputedStyle(el).getPropertyValue('--u')) || 1;
    onSize(r.width / u, r.height / u);
  });
  ro.observe(el);
  return () => ro.disconnect();
}
