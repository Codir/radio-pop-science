/**
 * ScaleRuler — the vertical scale 10⁻² … 10⁻¹⁸ m that lives at the left edge through the whole chapter and
 * counts powers of ten while the camera dives (chapter document, «Наскрізна візуальна ідея»). A HUD widget
 * (`hudLayer` in the DOM interface, `hudSurface` in the WebGL one), so it is never blurred and hides under the
 * map like the rest of the HUD.
 */
import type { ChapterContext } from '@/engine/api';
import { fmtScale } from '@/content';
import { domKit, hudLayer } from '@/hud';
import { Label, UiNode, hudSurface, lit, rgba, type Painter } from '@/ui3d';
import { L } from '../labels';

const TOP_EXP = -2;
const BOTTOM_EXP = -18;
const HEIGHT = 400;
const TRACK_X = -26;

/** Distance of an exponent's tick from the top edge of the ruler, units. */
function offset(e: number): number {
  return 66 + ((TOP_EXP - e) / (TOP_EXP - BOTTOM_EXP)) * HEIGHT;
}

class RulerNode extends UiNode {
  /** Current scale as log₁₀(metres); may be fractional while flying. */
  exp = -10;
  private readonly value: Label;
  private shown = '';

  constructor() {
    super({ name: 'scale-ruler', width: 84, height: HEIGHT + 86, dir: 'stack' });
    this.add(
      new Label(
        L.ruler.title,
        { size: 14, color: 'steel', nowrap: true },
        { float: { ax: 0.5, ay: 0, py: 0 } },
      ),
    );
    this.value = new Label(
      '',
      { font: 'mono', size: 19, color: 'white', nowrap: true, reserve: 12 },
      {
        float: { ax: 0.5, ay: 0, py: 0, dy: 22 },
      },
    );
    this.add(this.value);
    for (let e = TOP_EXP; e >= BOTTOM_EXP; e -= 4) {
      const label = new Label(
        fmtScale(e).replace(/\s*m$/, ''),
        { font: 'mono', size: 14, color: 'steel', nowrap: true },
        {
          float: { ax: 0.5, ay: 0, px: 0, py: 0.5, dx: -14, dy: offset(e) },
        },
      );
      this.add(label);
    }
    this.sync();
  }

  /** Refresh the numeric label when the rounded exponent changes, and repaint the marker. */
  sync(): void {
    const text = fmtScale(Math.round(this.exp));
    if (text !== this.shown) {
      this.shown = text;
      this.value.text = text;
    }
    this.repaint();
  }

  override paint(p: Painter): void {
    const y = (e: number): number => this.bh / 2 - offset(e);
    const accent = rgba('cyan');
    // dark backing so the scale stays readable over bright scenes (grain mosaic, lattice)
    p.panel(0, 0, this.bw + 12, this.bh + 20, { fill: rgba('bg.void', 0.42), r: 18 });
    p.line(TRACK_X, y(TOP_EXP), TRACK_X, y(BOTTOM_EXP), 2, { fill: rgba('slate', 0.7) });
    for (let e = TOP_EXP; e >= BOTTOM_EXP; e--) {
      const major = (TOP_EXP - e) % 4 === 0;
      const near = Math.max(0, 1 - Math.abs(e - this.exp));
      p.line(TRACK_X - (major ? 9 : 5), y(e), TRACK_X + (major ? 9 : 5), y(e), major ? 2 : 1.4, {
        fill: near > 0 ? lit(accent, 1 + near) : rgba(major ? 'mist' : 'steel', major ? 0.8 : 0.55),
      });
    }
    const e = Math.min(Math.max(this.exp, BOTTOM_EXP), TOP_EXP);
    p.circle(TRACK_X, y(e), 13, {
      fill: lit(accent, 1.7),
      border: rgba('white', 0.9),
      bw: 1.5,
      glow: 14,
      glowAlpha: 0.55,
    });
    p.line(TRACK_X + 9, y(e), TRACK_X + 20, y(e), 2, { fill: lit(accent, 1.4) });
  }
}

export interface ScaleRuler {
  /** Set the scale shown (log₁₀ m). Call every frame with the eased value. */
  set(exp: number): void;
}

/**
 * The same ruler in the DOM interface (`?hud=dom`): an SVG track (units 1:1 with the WebGL node) and DOM text
 * on a `hudLayer`; hidden outside the wide layout by the platform's `.kd-ruler` rule.
 */
function domRuler(layer: HTMLElement): ScaleRuler {
  const { h, svg, setText } = domKit;
  const W = 84;
  const H = HEIGHT + 86;
  const x = W / 2 + TRACK_X;
  const y = offset; // the SVG's y runs down from the top, like `offset`
  const track = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'track', 'aria-hidden': 'true' });
  track.append(svg('line', { x1: x, y1: y(TOP_EXP), x2: x, y2: y(BOTTOM_EXP), class: 'rail' }));
  const ticks: SVGLineElement[] = [];
  for (let e = TOP_EXP; e >= BOTTOM_EXP; e--) {
    const major = (TOP_EXP - e) % 4 === 0;
    const d = major ? 9 : 5;
    const t = svg('line', { x1: x - d, y1: y(e), x2: x + d, y2: y(e), class: major ? 'tick major' : 'tick' });
    ticks.push(t);
    track.append(t);
  }
  const pointer = svg('line', { x1: x + 9, x2: x + 20, y1: 0, y2: 0, class: 'pointer' });
  const dot = svg('circle', { cx: x, cy: 0, r: 6.5, class: 'dot' });
  track.append(pointer, dot);
  const value = h('span.value');
  const el = h('div.kd-ruler', { 'data-ui': 'scale-ruler' }, track, h('span.title', null, L.ruler.title), value);
  for (let e = TOP_EXP; e >= BOTTOM_EXP; e -= 4) {
    const label = h('span.mark', null, fmtScale(e).replace(/\s*m$/, ''));
    label.style.top = `calc(${offset(e)} * var(--u))`;
    el.append(label);
  }
  layer.append(el);
  let exp = Number.NaN;
  const sync = (next: number): void => {
    exp = next;
    setText(value, fmtScale(Math.round(exp)));
    const e = Math.min(Math.max(exp, BOTTOM_EXP), TOP_EXP);
    dot.setAttribute('cy', y(e).toFixed(2));
    pointer.setAttribute('y1', y(e).toFixed(2));
    pointer.setAttribute('y2', y(e).toFixed(2));
    ticks.forEach((t, i) => {
      const near = Math.max(0, 1 - Math.abs(TOP_EXP - i - exp));
      t.style.stroke = near > 0 ? `color-mix(in srgb, var(--c-cyan), white ${Math.round(near * 55)}%)` : '';
    });
  };
  sync(-10);
  return {
    set(next) {
      if (Math.abs(next - exp) >= 1e-3) sync(next);
    },
  };
}

export function createScaleRuler(ctx: ChapterContext): ScaleRuler {
  const layer = hudLayer(ctx, 'atom-ruler');
  if (layer) return domRuler(layer);
  const surface = hudSurface(ctx, 'atom-ruler');
  const node = new RulerNode();
  const holder = new UiNode({ dir: 'stack', width: 'fill', height: 'fill' });
  const place = (): void => {
    const m = ctx.hud.metrics;
    node.visible = m.layout === 'wide';
    // right of the HUD's chapter spine, vertically centred in the free column under the chapter header
    node.float = { ax: 0, ay: 0.5, px: 0, py: 0.5, dx: m.safeMargin + 60, dy: 24 };
    holder.relayout();
  };
  holder.add(node);
  surface.root.add(holder);
  place();
  ctx.onDispose(ctx.hud.onResize(place));
  return {
    set(exp) {
      if (Math.abs(exp - node.exp) < 1e-3) return;
      node.exp = exp;
      node.sync();
    },
  };
}
