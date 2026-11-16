/**
 * Energy ribbon (Sankey diagram) of step 8 on the HUD board: the ribbon's width is power. The source's output
 * enters on the left; the `orange`/`red` branch that peels off downward is the heat lost in the cord, the
 * `yellow` remainder reaches the cottage. Widths are true to scale against `fullW` (the rated 2 kW).
 * Each stream carries its number (sent, arrived, heat), so the ribbon reads without the stats below it.
 */
import { fmtUnit } from '@/content';
import { domKit, type DomWidget } from '@/hud';
import type { ColorLike } from '@/style';
import { fontData, layoutText } from '@/text';
import { UI, UiNode, lit, rgba, type Painter } from '@/ui3d';

export class Sankey extends UiNode {
  private loadW = 0;
  private lossW = 0;
  private key = '';

  /** The DOM twin (`?hud=dom`): an SVG re-drawn on a value or width change. */
  private svgView: { g: SVGGElement; root: SVGSVGElement; width: number } | null = null;

  constructor(
    private readonly fullW: number,
    private readonly boxH = 150,
  ) {
    super({ width: 'fill', height: boxH });
  }

  set(loadW: number, lossW: number): void {
    const key = `${Math.round(loadW)}|${Math.round(lossW)}`;
    if (key === this.key) return;
    this.key = key;
    this.loadW = loadW;
    this.lossW = lossW;
    this.repaint();
    this.drawSvg();
  }

  /** The same ribbon for the DOM interface (`custom.dom`): SVG shapes and SVG text from the same `draw`. */
  dom(label: string): DomWidget {
    const { h, svg, observeUnits } = domKit;
    const g = svg('g');
    const root = svg('svg', {}, g);
    const el = h('div.kd-diagram.kd-sankey', { role: 'img', 'aria-label': label }, root);
    el.style.setProperty('--h', String(this.boxH));
    this.svgView = { g, root, width: 0 };
    const stop = observeUnits(el, (width) => {
      if (this.svgView) this.svgView.width = width;
      this.drawSvg();
    });
    return { el, dispose: stop };
  }

  private drawSvg(): void {
    const v = this.svgView;
    if (!v || v.width <= 0) return;
    const { svg, svgPainter, color } = domKit;
    v.root.setAttribute('viewBox', `${-v.width / 2} ${-this.boxH / 2} ${v.width} ${this.boxH}`);
    v.g.replaceChildren();
    this.draw(svgPainter(v.g), v.width, this.boxH, (text, x, y, side, c) => {
      const t = svg('text', {
        x,
        y: -y,
        'font-size': UI.text.body,
        'text-anchor': side === 'left' ? 'start' : 'end',
        'dominant-baseline': 'central',
      });
      t.style.fill = color(c);
      t.textContent = text;
      v.g.append(t);
    });
  }

  override paint(p: Painter): void {
    this.draw(p, this.w, this.h, (text, x, y, side, color) => {
      const l = layoutText(text, { font: 'mono', size: UI.text.body, anchorX: side, anchorY: 'middle' }, fontData());
      const c = rgba(color);
      p.text(l, x, y, 1, { base: c, accent: c, formula: c }, 1, 12);
    });
  }

  /** The ribbon in units, y up, origin at the centre of a `w` × `h` box; numbers through `label`. */
  private draw(
    p: domKit.ShapePainter,
    w: number,
    h: number,
    text: (text: string, x: number, y: number, side: 'left' | 'right', color: ColorLike) => void,
  ): void {
    const W = Math.min(w - 40, 440);
    const x0 = -W / 2;
    const x1 = W / 2;
    const xs = x0 + W * 0.42; // where the loss branch leaves
    const MAXT = h * 0.46; // ribbon thickness of the full rated power
    const scale = MAXT / this.fullW;
    const tLoad = Math.max(this.loadW * scale, 1.5);
    const tLoss = Math.max(this.lossW * scale, this.lossW > 0.5 ? 1.5 : 0);
    const tAll = tLoad + tLoss;
    const top = h / 2 - 34; // upper edge of the ribbon (the numbers sit above it)
    const yellow = lit(rgba('yellow'), 1.25);
    const loss = lit(rgba('orange'), 1.2);
    const red = lit(rgba('red'), 1.2);
    // trunk: both shares side by side (load on top, loss below), then the load runs on to the right
    p.rect((x0 + xs) / 2, top - tLoad / 2, xs - x0, tLoad, { fill: yellow });
    p.rect((xs + x1 - 12) / 2, top - tLoad / 2, x1 - 12 - xs, tLoad, { fill: yellow });
    // arrow head of the delivered power
    p.line(x1 - 14, top - tLoad / 2, x1 - 4, top - tLoad / 2, Math.max(tLoad * 0.55, 3), { fill: yellow });
    if (tLoss > 0) {
      p.rect((x0 + xs) / 2, top - tLoad - tLoss / 2, xs - x0, tLoss, { fill: loss });
      // the loss branch bends down in three strokes of the same thickness
      const y0 = top - tLoad - tLoss / 2;
      const bottom = -h / 2 + 10;
      const xm = xs + Math.min(46, (y0 - bottom) * 0.8);
      p.line(xs - 1, y0, xm, (y0 + bottom) / 2, tLoss, { fill: loss });
      p.line(xm, (y0 + bottom) / 2, xm + 6, bottom, tLoss, { fill: red });
    }
    // the input edge
    p.rect(x0 - 3, top - tAll / 2, 4, tAll + 6, { fill: rgba('white', 0.9), r: 2 });
    const label = (v: number, x: number, y: number, side: 'left' | 'right', color: ColorLike): void =>
      text(fmtUnit(v, 'W', { maxDigits: v < 10 ? 1 : 0 }), x, y, side, color); // as in the stats below
    const yText = h / 2 - 14;
    label(this.loadW + this.lossW, x0 - 3, yText, 'left', 'white');
    label(this.loadW, x1 - 4, yText, 'right', 'yellow');
    if (tLoss > 0) label(this.lossW, xs + 70, -h / 2 + 22, 'left', 'orange');
  }
}
