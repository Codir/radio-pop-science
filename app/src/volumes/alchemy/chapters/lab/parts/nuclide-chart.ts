/**
 * The nuclide chart on the board («Карта нуклідів»), in both interfaces: the 15 × 11 window of the N × Z table
 * around the current nuclide (`chart-model.ts`), or the whole table («Уся карта»), with the marks — you are here
 * (a white ring), the goal (a `yellow` ring, the whole row for an element; an arrow at the edge when it lies
 * outside the window), the trail of the run (a thin `mist` line), the picked cell (a `cyan` outline) — and a
 * five-item legend beside it. Not discovered nuclides are dimmed to 0.35 of their colour.
 *
 * One hit target for the whole chart (single cells are far below 44 units): the cell comes from the pointer
 * position. A click only picks a nuclide (`onPick`); it never changes the game.
 *
 * WebGL: the window is painted by `Painter` layers (cells under, marks one layer up), the whole table is a
 * `DataTexture` on a quad (`MeshNode`), as in `ui3d/charts/heatmap.ts`. DOM: a canvas made with `domKit.h`, the
 * words and numbers are DOM text. One drawing function (`drawBase`, `drawMarks`) serves both through a `Pen`.
 * Nothing is redrawn unless the view, the full / window switch or the picked cell changed.
 */
import {
  DataTexture, Mesh, NearestFilter, Object3D, PlaneGeometry, RGBAFormat, SRGBColorSpace, ShaderMaterial,
  UnsignedByteType, Vector4,
} from 'three';
import { domKit, type DomHost, type DomWidget } from '@/hud';
import { col, type ColorLike } from '@/style';
import { fontData, layoutText } from '@/text';
import { MeshNode, UI, UiNode, rgba, type NodeProps, type Painter, type Rgba, type ShapeStyle } from '@/ui3d';
import { elementByZ, getNuclide, isotopesOf, nuclideSymbol, type NuclideRef } from '@alchemy/sim/core';
import { L } from '../labels';
import {
  FULL, KIND_COLOR, UNDISCOVERED, WINDOW, cellAt, fullChart, windowCells, windowOrigin, type Cell, type CellKind,
  type ChartView,
} from './chart-model';

export interface NuclideChartOptions {
  view(): ChartView;
  /** Show the whole table instead of the window. */
  full(): boolean;
  /** A cell was clicked: show that nuclide. */
  onPick(ref: NuclideRef): void;
  /** The picked nuclide, outlined on the chart; null — none. */
  picked(): NuclideRef | null;
}

/** What `__app.read('lab').chart` reports: the shown window and where its cells are on screen. */
export interface ChartFrame {
  readonly n0: number;
  readonly z0: number;
  readonly cols: number;
  readonly rows: number;
  /** The cell grid as fractions of the control's box (`ctl-chart`), from its top-left corner; null before layout. */
  readonly grid: { readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null;
}

export interface NuclideChart {
  readonly node: UiNode;
  dom(host: DomHost): DomWidget;
  /** Call every frame (the `custom` control's `update`): redraws only when something it shows changed. */
  update(t: number): void;
  frame(): ChartFrame;
  /** Free the texture and the quad (the chapter is left). */
  dispose(): void;
}

/* ---------------------------------------------------------------------------------------------- geometry */

/**
 * Left gutter (element symbols), the legend column right of the grid (its gap included), room for the rings
 * above the grid and the N axis under it. The legend sits beside the grid, not under it: at 1280×720 the board
 * must show the chart, the picked line, the switch, the counters, the readouts and the status line unscrolled.
 */
const GUTTER = 30;
const LEGEND_W = 120;
const TOP = 6;
const AXIS = 22;
/** The board's content width on a desktop (`md` 520 − 2 × 20 padding): the cell size is set for it. */
const NOMINAL_WIDTH = 480;
const NOMINAL_CELL = (NOMINAL_WIDTH - GUTTER - LEGEND_W) / WINDOW.cols;
/** Height of the chart, units. */
const HEIGHT = Math.round(TOP + WINDOW.rows * NOMINAL_CELL + AXIS);
const GAP = 2;
const LABEL = UI.text.caption;
/** Legend rows: pitch and the swatch. */
const LINE = 18;
const SWATCH = 12;

/** A box in units, top-left origin, y down. */
interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

interface Geometry {
  readonly width: number;
  readonly height: number;
  /** Cell size of the window, and the window's grid. */
  readonly cell: number;
  readonly grid: Box;
  /** Pixel size of the whole table, and where it is drawn (in the same area as the grid). */
  readonly scale: number;
  readonly full: Box;
  /** Left edge of the legend column. */
  readonly legend: number;
}

function geometry(width: number): Geometry {
  const availW = Math.max(width - GUTTER - LEGEND_W, 10);
  const availH = HEIGHT - TOP - AXIS;
  const cell = Math.min(availW / WINDOW.cols, availH / WINDOW.rows);
  const gw = cell * WINDOW.cols;
  const gh = cell * WINDOW.rows;
  const scale = Math.min(gw / FULL.width, gh / FULL.height);
  const fw = scale * FULL.width;
  const fh = scale * FULL.height;
  const x = GUTTER + (availW - gw) / 2;
  const y = TOP + availH - gh;
  return {
    width,
    height: HEIGHT,
    cell,
    grid: { x, y, w: gw, h: gh },
    scale,
    full: { x: x + (gw - fw) / 2, y: y + gh - fh, w: fw, h: fh },
    legend: x + gw + 14,
  };
}

/* ------------------------------------------------------------------------------------------------ colours */

const fills = new Map<string, Rgba>();
/** Fill of a cell: the kind's colour, or the same colour at 0.35 of its (sRGB) brightness — as `fullChart`. */
function fillOf(kind: CellKind, discovered: boolean): Rgba {
  const key = `${kind}|${discovered}`;
  let hit = fills.get(key);
  if (!hit) {
    const c = col(KIND_COLOR[kind]);
    if (!discovered) c.convertLinearToSRGB().multiplyScalar(UNDISCOVERED).convertSRGBToLinear();
    hit = [c.r, c.g, c.b, 1];
    fills.set(key, hit);
  }
  return hit;
}

/** The marks: you are here, the goal, the trail, the picked cell, the window on the whole table. */
const MARK = {
  here: 'white',
  goal: 'yellow',
  trail: 'mist',
  picked: 'cyan',
  window: 'white',
} as const satisfies Record<string, ColorLike>;

/** The five legend entries (the rarer kinds share «інше»); a long caption breaks after « / ». */
const LEGEND: readonly { readonly lines: readonly string[]; readonly color: ColorLike }[] = [
  { label: L.chart.stableKind, color: KIND_COLOR.stable },
  { label: L.chart.betaMinus, color: KIND_COLOR['beta-'] },
  { label: L.chart.betaPlus, color: KIND_COLOR['beta+'] },
  { label: L.chart.alpha, color: KIND_COLOR.alpha },
  { label: L.chart.other, color: 'steel' as ColorLike },
].map((x) => ({ lines: x.label.split(/(?<=\/) /), color: x.color }));

/* ---------------------------------------------------------------------------------------------- drawing */

/** What both interfaces draw with: units, top-left origin, y down; `text` is centred on `y`. */
interface Pen {
  rect(cx: number, cy: number, w: number, h: number, s: ShapeStyle): void;
  circle(cx: number, cy: number, d: number, s: ShapeStyle): void;
  line(x0: number, y0: number, x1: number, y1: number, width: number, s: ShapeStyle): void;
  /** `align`: 0 — starts at x, 0.5 — centred, 1 — ends at x. */
  text(text: string, x: number, y: number, align: number, color: ColorLike, bold?: boolean): void;
  /** A caption on a dark plate, centred on (x, y). */
  tag(text: string, x: number, y: number, color: ColorLike): void;
}

/** What is on the chart now (rebuilt when the view, the switch or the pick changes). */
interface Picture {
  readonly view: ChartView;
  readonly full: boolean;
  readonly picked: NuclideRef | null;
  readonly n0: number;
  readonly z0: number;
  /** The cells of the window (empty in the full view). */
  readonly cells: readonly Cell[];
}

const centreX = (g: Geometry, col: number): number => g.grid.x + (col + 0.5) * g.cell;
const centreY = (g: Geometry, row: number): number => g.grid.y + (WINDOW.rows - row - 0.5) * g.cell;
const fullX = (g: Geometry, n: number): number => g.full.x + (n + 0.5) * g.scale;
const fullY = (g: Geometry, z: number): number => g.full.y + g.full.h - (z - 0.5) * g.scale;
const axisY = (g: Geometry): number => g.grid.y + g.grid.h + AXIS / 2 + 1;

/** The legend column: a swatch and a caption per kind, the names of the two axes at its foot. */
function drawLegend(pen: Pen, g: Geometry): void {
  let y = g.grid.y + LINE / 2;
  for (const item of LEGEND) {
    pen.rect(g.legend + SWATCH / 2, y, SWATCH, SWATCH, { r: 3, fill: rgba(item.color) });
    for (const line of item.lines) {
      pen.text(line, g.legend + SWATCH + 6, y, 0, 'mist');
      y += LINE;
    }
    y += 3;
  }
  const foot = g.grid.y + g.grid.h;
  pen.text(L.chart.axisZ, g.legend, foot - LINE * 1.5, 0, 'mist');
  pen.text(L.chart.axisN, g.legend, foot - LINE * 0.5, 0, 'mist');
}

/** The plate, the cells or nothing (the whole table is an image), the labels of both axes, the legend. */
function drawBase(pen: Pen, g: Geometry, pic: Picture): void {
  const area = pic.full ? g.full : g.grid;
  pen.rect(area.x + area.w / 2, area.y + area.h / 2, area.w + 6, area.h + 6, {
    r: UI.radius.inset,
    fill: rgba('bg.void', 0.35),
    border: rgba('slate', 0.7),
    bw: 1.2,
  });
  drawLegend(pen, g);
  if (pic.full) {
    for (const z of [20, 40, 60, 80, 100]) pen.text(String(z), g.full.x - 6, fullY(g, z), 1, 'mist');
    for (const n of [0, 50, 100, 150]) pen.text(String(n), fullX(g, n), axisY(g), 0.5, 'mist');
    return;
  }
  const size = g.cell - GAP;
  for (const c of pic.cells) {
    pen.rect(centreX(g, c.col), centreY(g, c.row), size, size, { r: 3, fill: fillOf(c.kind, c.discovered) });
  }
  const { center, goal } = pic.view;
  for (let row = 0; row < WINDOW.rows; row++) {
    const z = pic.z0 + row;
    const here = z === center.z;
    const color = here ? 'white' : goal?.kind === 'element' && goal.z === z ? MARK.goal : 'mist';
    pen.text(elementByZ(z)?.symbol ?? '', g.grid.x - 6, centreY(g, row), 1, color, here);
  }
  for (let col = 0; col < WINDOW.cols; col++) {
    const n = pic.n0 + col;
    if (n % 5 === 0) pen.text(String(n), centreX(g, col), axisY(g), 0.5, 'mist');
  }
}

/** Clip the segment a → b (cell coordinates) to the window; null when nothing of it is inside (Liang–Barsky). */
function clipToWindow(ax: number, ay: number, bx: number, by: number): [number, number, number, number] | null {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const edges: readonly [number, number][] = [
    [-dx, ax + 0.5], [dx, WINDOW.cols - 0.5 - ax], [-dy, ay + 0.5], [dy, WINDOW.rows - 0.5 - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [ax + t0 * dx, ay + t0 * dy, ax + t1 * dx, ay + t1 * dy];
}

const ring = (color: ColorLike, bw: number, glow: number): ShapeStyle => ({
  border: rgba(color),
  bw,
  glow,
  glowAlpha: 0.55,
});

/** Where the goal is: the nuclide, or the isotope of the goal element nearest to the current N (for the arrow). */
function goalTarget(pic: Picture): NuclideRef | null {
  const { goal, center } = pic.view;
  if (!goal || goal.kind === 'stableFragment') return null;
  if (goal.kind === 'nuclide') return { z: goal.z, n: goal.n };
  let best: NuclideRef | null = null;
  for (const x of isotopesOf(goal.z)) {
    if (!best || Math.abs(x.n - center.n) < Math.abs(best.n - center.n)) best = { z: x.z, n: x.n };
  }
  return best;
}

/** An arrow at the edge of the window toward a goal outside it, with the goal's name. */
function drawPointer(pen: Pen, g: Geometry, pic: Picture, target: NuclideRef): void {
  const { center, goal } = pic.view;
  const from = { x: centreX(g, center.n - pic.n0), y: centreY(g, center.z - pic.z0) };
  const to = { x: centreX(g, target.n - pic.n0), y: centreY(g, target.z - pic.z0) };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const inset = g.cell / 2;
  const box = { x0: g.grid.x + inset, x1: g.grid.x + g.grid.w - inset, y0: g.grid.y + inset, y1: g.grid.y + g.grid.h - inset };
  let t = 1;
  if (dx > 0) t = Math.min(t, (box.x1 - from.x) / dx);
  if (dx < 0) t = Math.min(t, (box.x0 - from.x) / dx);
  if (dy > 0) t = Math.min(t, (box.y1 - from.y) / dy);
  if (dy < 0) t = Math.min(t, (box.y0 - from.y) / dy);
  const ux = dx / len;
  const uy = dy / len;
  const tip = { x: from.x + t * dx + ux * inset * 0.8, y: from.y + t * dy + uy * inset * 0.8 };
  const style: ShapeStyle = { fill: rgba(MARK.goal) };
  pen.line(tip.x - ux * 22, tip.y - uy * 22, tip.x, tip.y, 3.2, style);
  pen.line(tip.x, tip.y, tip.x - ux * 10 - uy * 8, tip.y - uy * 10 + ux * 8, 3.2, style);
  pen.line(tip.x, tip.y, tip.x - ux * 10 + uy * 8, tip.y - uy * 10 - ux * 8, 3.2, style);
  const name = goal?.kind === 'element' ? (elementByZ(goal.z)?.symbol ?? '') : nuclideSymbol(target.z, target.n);
  const back = 44 + Math.abs(ux) * name.length * 3;
  const lx = Math.min(Math.max(tip.x - ux * back, g.grid.x + 28), g.grid.x + g.grid.w - 28);
  const ly = Math.min(Math.max(tip.y - uy * 40, g.grid.y + 14), g.grid.y + g.grid.h - 14);
  pen.tag(name, lx, ly, MARK.goal);
}

function drawWindowMarks(pen: Pen, g: Geometry, pic: Picture): void {
  const { view } = pic;
  const c = g.cell;
  // the trail: a thin line through the cells of the run, dots where it stopped
  const pts = view.trail.map((r) => ({ col: r.n - pic.n0, row: r.z - pic.z0 }));
  const trail: ShapeStyle = { fill: rgba(MARK.trail, 0.85) };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (a.col === b.col && a.row === b.row) continue;
    const s = clipToWindow(a.col, a.row, b.col, b.row);
    if (s) pen.line(centreX(g, s[0]), centreY(g, s[1]), centreX(g, s[2]), centreY(g, s[3]), 2.4, trail);
  }
  for (const cell of pic.cells) {
    if (cell.onTrail && !cell.here) pen.circle(centreX(g, cell.col), centreY(g, cell.row), 7, { fill: rgba(MARK.trail, 0.95) });
  }
  // the goal: a ring, the row of an element, or an arrow toward it
  const goalCells = pic.cells.filter((x) => x.goal);
  const target = goalTarget(pic);
  if (view.goal?.kind === 'element' && goalCells.length > 0) {
    const cols = goalCells.map((x) => x.col);
    const x0 = g.grid.x + Math.min(...cols) * c - 3;
    const x1 = g.grid.x + (Math.max(...cols) + 1) * c + 3;
    pen.rect((x0 + x1) / 2, centreY(g, goalCells[0]!.row), x1 - x0, c + 6, { r: 7, ...ring(MARK.goal, 2.6, 8) });
  } else if (view.goal?.kind === 'nuclide' && goalCells.length > 0) {
    const x = goalCells[0]!;
    pen.circle(centreX(g, x.col), centreY(g, x.row), c * 1.55, ring(MARK.goal, 3, 9));
  } else if (target) {
    drawPointer(pen, g, pic, target);
  }
  // you are here
  const here = pic.cells.find((x) => x.here);
  if (here) pen.circle(centreX(g, here.col), centreY(g, here.row), c * 1.22, ring(MARK.here, 3, 10));
  // the picked cell
  const p = pic.picked;
  if (p) {
    const pc = p.n - pic.n0;
    const pr = p.z - pic.z0;
    if (pc >= 0 && pc < WINDOW.cols && pr >= 0 && pr < WINDOW.rows) {
      pen.rect(centreX(g, pc), centreY(g, pr), c + 1, c + 1, { r: 5, border: rgba(MARK.picked), bw: 2.2 });
    }
  }
}

function drawFullMarks(pen: Pen, g: Geometry, pic: Picture): void {
  const { view } = pic;
  const s = g.scale;
  // where the window is
  const wx = g.full.x + pic.n0 * s;
  const wy = g.full.y + g.full.h - (pic.z0 - 1 + WINDOW.rows) * s;
  pen.rect(wx + (WINDOW.cols * s) / 2, wy + (WINDOW.rows * s) / 2, WINDOW.cols * s + 3, WINDOW.rows * s + 3, {
    r: 2,
    border: rgba(MARK.window, 0.7),
    bw: 1.4,
  });
  const trail: ShapeStyle = { fill: rgba(MARK.trail, 0.9) };
  for (let i = 1; i < view.trail.length; i++) {
    const a = view.trail[i - 1]!;
    const b = view.trail[i]!;
    if (a.z === b.z && a.n === b.n) continue;
    pen.line(fullX(g, a.n), fullY(g, a.z), fullX(g, b.n), fullY(g, b.z), 1.6, trail);
  }
  const goal = view.goal;
  if (goal?.kind === 'nuclide') {
    pen.circle(fullX(g, goal.n), fullY(g, goal.z), 15, ring(MARK.goal, 2.6, 7));
  } else if (goal?.kind === 'element') {
    const isotopes = isotopesOf(goal.z);
    if (isotopes.length > 0) {
      const x0 = g.full.x + isotopes[0]!.n * s - 3;
      const x1 = g.full.x + (isotopes[isotopes.length - 1]!.n + 1) * s + 3;
      pen.rect((x0 + x1) / 2, fullY(g, goal.z), x1 - x0, s + 7, { r: 4, ...ring(MARK.goal, 2, 6) });
    }
  }
  pen.circle(fullX(g, view.center.n), fullY(g, view.center.z), 13, ring(MARK.here, 2.6, 8));
  const p = pic.picked;
  if (p) pen.rect(fullX(g, p.n), fullY(g, p.z), s + 6, s + 6, { r: 2, border: rgba(MARK.picked), bw: 1.8 });
}

function drawMarks(pen: Pen, g: Geometry, pic: Picture): void {
  if (pic.full) drawFullMarks(pen, g, pic);
  else drawWindowMarks(pen, g, pic);
}

/** The nuclide under a point of the plot (units, top-left origin), or null. */
function pickAt(g: Geometry, pic: Picture, x: number, y: number): NuclideRef | null {
  if (pic.full) {
    const n = Math.floor((x - g.full.x) / g.scale);
    const z = Math.floor((g.full.y + g.full.h - y) / g.scale) + 1;
    const hit = getNuclide(z, n);
    return hit ? { z: hit.z, n: hit.n } : null;
  }
  const col = Math.floor((x - g.grid.x) / g.cell);
  const row = WINDOW.rows - 1 - Math.floor((y - g.grid.y) / g.cell);
  return cellAt(pic.view, col, row);
}

/* ------------------------------------------------------------------------------------------------- WebGL */

function textLayout(text: string, bold: boolean) {
  return layoutText(
    text,
    { font: bold ? 'bodyBold' : 'body', size: LABEL, anchorX: 'left', anchorY: 'top', lineHeight: 1.2, rich: false },
    fontData(),
  );
}

/** A WebGL layer of the plot: the cells and labels (`drawBase`) or, one layer up, the marks (`drawMarks`). */
class ChartLayer extends UiNode {
  constructor(
    private readonly draw: (pen: Pen, g: Geometry, p: Picture) => void,
    private readonly picture: () => Picture | null,
    props: NodeProps,
  ) {
    super(props);
  }

  override paint(p: Painter): void {
    const pic = this.picture();
    if (pic && this.bw > 0) this.draw(glPen(p, this.bw, this.bh), geometry(this.bw), pic);
  }
}

/** The `Pen` over a WebGL `Painter`: node-local coordinates have the origin at the box centre and y up. */
function glPen(p: Painter, w: number, h: number): Pen {
  const X = (x: number): number => x - w / 2;
  const Y = (y: number): number => h / 2 - y;
  const write = (text: string, x: number, y: number, align: number, color: ColorLike, bold: boolean): void => {
    const l = textLayout(text, bold);
    const c = rgba(color);
    p.text(l, X(x) - l.metrics.width * align, Y(y) + l.metrics.height / 2, 1, { base: c, accent: c, formula: c });
  };
  return {
    rect: (cx, cy, rw, rh, s) => p.rect(X(cx), Y(cy), rw, rh, s),
    circle: (cx, cy, d, s) => p.circle(X(cx), Y(cy), d, s),
    line: (x0, y0, x1, y1, width, s) => p.line(X(x0), Y(y0), X(x1), Y(y1), width, s),
    text: (text, x, y, align, color, bold = false) => write(text, x, y, align, color, bold),
    tag(text, x, y, color) {
      const l = textLayout(text, true);
      p.rect(X(x), Y(y), l.metrics.width + 12, l.metrics.height + 4, { r: 6, fill: rgba('bg.void', 0.9) });
      write(text, x, y, 0.5, color, true);
    },
  };
}

const VERTEX = /* glsl */ `
uniform vec4 uRect; // centre xy, size zw of the image in the holder's units
varying vec2 vUv;
varying vec2 vLocal;
void main() {
  vUv = uv;
  vLocal = uRect.xy + position.xy * uRect.zw;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( vLocal, 0.0, 1.0 );
}
`;
const FRAGMENT = /* glsl */ `
uniform sampler2D tMap;
uniform float uOpacity;
uniform vec4 uClip; // centre xy, half size zw in the holder's units; zw < 0: no clip (scroll views)
varying vec2 vUv;
varying vec2 vLocal;
void main() {
  if ( uClip.z >= 0.0 && ( abs( vLocal.x - uClip.x ) > uClip.z || abs( vLocal.y - uClip.y ) > uClip.w ) ) discard;
  vec4 c = texture2D( tMap, vUv );
  if ( c.a < 0.5 ) discard;
  gl_FragColor = vec4( c.rgb, uOpacity );
}
`;

/* -------------------------------------------------------------------------------------------------- DOM */

interface DomView {
  readonly frame: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly text: HTMLElement;
  /** The whole table, one pixel per nuclide (drawn scaled into the plot). */
  readonly image: HTMLCanvasElement;
  /** Width of the chart, units; CSS px per unit; device px per CSS px. */
  width: number;
  u: number;
  dpr: number;
  dirty: boolean;
}

/** The `Pen` over a Canvas2D context (units already scaled in) and a layer of DOM captions. */
function canvasPen(g: CanvasRenderingContext2D, text: HTMLElement, k: number): Pen {
  const { color, rgbaColor, h, setStyle } = domKit;
  const glow = (s: ShapeStyle): void => {
    if (!s.glow || !s.border) return;
    g.shadowColor = rgbaColor([s.border[0], s.border[1], s.border[2], s.glowAlpha ?? 0.35]);
    g.shadowBlur = s.glow * k;
  };
  const stroke = (s: ShapeStyle): void => {
    g.save();
    glow(s);
    g.lineWidth = s.bw!;
    g.strokeStyle = rgbaColor(s.border!);
    g.stroke();
    g.restore();
  };
  const caption = (cls: 'span.kd-axis-label' | 'span.kd-mark-label', words: string, x: number, y: number, align: number): HTMLElement => {
    const el = h(cls, null, words);
    setStyle(el, 'left', `calc(${x.toFixed(2)} * var(--u))`);
    setStyle(el, 'top', `calc(${y.toFixed(2)} * var(--u))`);
    setStyle(el, 'transform', `translate(${-align * 100}%, -50%)`);
    text.append(el);
    return el;
  };
  return {
    rect(cx, cy, w, hh, s) {
      const x = cx - w / 2;
      const y = cy - hh / 2;
      const r = s.r ?? 0;
      if (s.fill) {
        g.beginPath();
        g.roundRect(x, y, w, hh, r);
        g.fillStyle = rgbaColor(s.fill);
        g.fill();
      }
      if (s.border && s.bw) {
        const i = s.bw / 2;
        g.beginPath();
        g.roundRect(x + i, y + i, w - 2 * i, hh - 2 * i, Math.max(r - i, 0));
        stroke(s);
      }
    },
    circle(cx, cy, d, s) {
      if (s.fill) {
        g.beginPath();
        g.arc(cx, cy, d / 2, 0, Math.PI * 2);
        g.fillStyle = rgbaColor(s.fill);
        g.fill();
      }
      if (s.border && s.bw) {
        g.beginPath();
        g.arc(cx, cy, Math.max(d / 2 - s.bw / 2, 0), 0, Math.PI * 2);
        stroke(s);
      }
    },
    line(x0, y0, x1, y1, width, s) {
      if (!s.fill) return;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineWidth = width;
      g.lineCap = 'round';
      g.strokeStyle = rgbaColor(s.fill);
      g.stroke();
    },
    text(words, x, y, align, c, bold = false) {
      const el = caption('span.kd-axis-label', words, x, y, align);
      if (c !== 'mist') setStyle(el, 'color', color(c));
      if (bold) setStyle(el, 'font-weight', '700');
    },
    tag(words, x, y, c) {
      setStyle(caption('span.kd-mark-label', words, x, y, 0.5), 'color', color(c));
    },
  };
}

/* ------------------------------------------------------------------------------------------------ widget */

export function createNuclideChart(opts: NuclideChartOptions): NuclideChart {
  let pic: Picture | null = null;
  let dom: DomView | null = null;
  /** The discovered set the image was drawn for (the image only changes with it). */
  let imaged: ReadonlySet<string> | null = null;
  let image: Uint8Array | null = null;

  // ---- WebGL: the plot (cells, labels, legend) · the whole table on a quad · the marks one layer up
  const texture = new DataTexture(new Uint8Array(FULL.width * FULL.height * 4), FULL.width, FULL.height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = NearestFilter;
  const material = new ShaderMaterial({
    uniforms: {
      tMap: { value: texture },
      uOpacity: { value: 1 },
      uRect: { value: new Vector4(0, 0, 1, 1) },
      uClip: { value: new Vector4(0, 0, -1, -1) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(1, 1), material);
  quad.frustumCulled = false;
  // a plain Object3D: a Group would get its own sort group and draw over every other UI layer (heatmap.ts)
  const holder = new Object3D();
  holder.add(quad);

  const picture = (): Picture | null => pic;
  const plot = new ChartLayer(drawBase, picture, { dir: 'stack', width: 'fill', height: HEIGHT });
  const marks = new ChartLayer(drawMarks, picture, { float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill', layerUp: 1 });
  const field = new MeshNode(holder, { float: { ax: 0.5, ay: 0.5 }, width: 'fill', height: 'fill', visible: false });
  field.onPlace = (opacity) => {
    material.uniforms.uOpacity!.value = opacity;
    const g = geometry(plot.bw);
    const rect = material.uniforms.uRect!.value as Vector4;
    rect.set(g.full.x + g.full.w / 2 - plot.bw / 2, plot.bh / 2 - (g.full.y + g.full.h / 2), g.full.w, g.full.h);
  };
  plot.add(field, marks);
  plot.on({
    cursor: 'crosshair',
    tooltip: L.chart.hint,
    click: (e) => {
      const at = plot.localPoint(e);
      if (!at || !pic) return;
      const hit = pickAt(geometry(plot.bw), pic, at.x + plot.bw / 2, plot.bh / 2 - at.y);
      if (hit) opts.onPick(hit);
    },
  });

  // ---- DOM: a canvas for the cells, the image and the marks; every word and number is DOM text
  const drawDom = (): void => {
    const v = dom;
    if (!v || !pic || v.width <= 0) return;
    v.dirty = false;
    const g = v.canvas.getContext('2d');
    if (!g) return;
    const k = v.u * v.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, v.canvas.width, v.canvas.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    v.text.replaceChildren();
    const geo = geometry(v.width);
    const pen = canvasPen(g, v.text, k);
    drawBase(pen, geo, pic);
    if (pic.full) {
      g.imageSmoothingEnabled = false;
      g.drawImage(v.image, geo.full.x, geo.full.y, geo.full.w, geo.full.h);
    }
    drawMarks(pen, geo, pic);
  };
  /** The image of the whole table into the DOM's offscreen canvas (rows flipped: Z = 1 is the bottom row). */
  const putImage = (): void => {
    if (!dom || !image) return;
    const { width, height } = FULL;
    const data = new ImageData(width, height);
    for (let row = 0; row < height; row++) {
      data.data.set(image.subarray(row * width * 4, (row + 1) * width * 4), (height - 1 - row) * width * 4);
    }
    dom.image.getContext('2d')?.putImageData(data, 0, 0);
  };

  const buildDom = (_host: DomHost): DomWidget => {
    const { h, setStyle, observeUnits } = domKit;
    const canvas = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
    const text = h('div.kd-chart-text');
    const frame = h('div.kd-chart-frame', { role: 'figure', 'aria-label': L.chart.title, 'data-tip': L.chart.hint }, canvas, text);
    frame.style.setProperty('--h', String(HEIGHT));
    setStyle(frame, 'cursor', 'crosshair');
    const view: DomView = { frame, canvas, text, image: h('canvas'), width: 0, u: 1, dpr: 1, dirty: true };
    view.image.width = FULL.width;
    view.image.height = FULL.height;
    dom = view;
    putImage();
    const stop = observeUnits(frame, (w) => {
      // a resize: the backing store follows the CSS box in device pixels; layout is read here only
      view.width = w;
      view.u = frame.clientWidth / w || 1;
      view.dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(frame.clientWidth * view.dpr);
      canvas.height = Math.round(frame.clientHeight * view.dpr);
      drawDom();
    });
    frame.addEventListener('click', (e) => {
      if (!pic || view.width <= 0) return;
      const r = frame.getBoundingClientRect(); // on input only
      const hit = pickAt(geometry(view.width), pic, (e.clientX - r.left) / view.u, (e.clientY - r.top) / view.u);
      if (hit) opts.onPick(hit);
    });
    return {
      el: frame,
      update: () => {
        if (view.dirty) drawDom();
      },
      dispose: () => {
        stop();
        if (dom === view) dom = null;
      },
    };
  };

  return {
    node: plot,
    dom: buildDom,
    update() {
      const view = opts.view();
      const full = opts.full();
      const picked = opts.picked();
      if (pic && pic.view === view && pic.full === full && pic.picked === picked) return;
      const { n0, z0 } = windowOrigin(view.center);
      pic = { view, full, picked, n0, z0, cells: full ? [] : windowCells(view) };
      if (full && imaged !== view.discovered) {
        imaged = view.discovered;
        image = fullChart(view).rgba;
        (texture.image.data as Uint8Array).set(image);
        texture.needsUpdate = true;
        putImage();
      }
      field.visible = full;
      plot.repaint();
      marks.repaint();
      if (dom) dom.dirty = true;
    },
    frame() {
      const p = pic;
      const shown = p?.full
        ? { n0: 0, z0: 1, cols: FULL.width, rows: FULL.height }
        : { n0: p?.n0 ?? 0, z0: p?.z0 ?? 1, cols: WINDOW.cols, rows: WINDOW.rows };
      // the interface on screen: the DOM chart once it is laid out, otherwise the WebGL node
      const width = dom && dom.frame.isConnected && dom.width > 0 ? dom.width : plot.bw;
      if (!p || width <= 0) return { ...shown, grid: null };
      const g = geometry(width);
      const area = p.full ? g.full : g.grid;
      return { ...shown, grid: { left: area.x / width, top: area.y / HEIGHT, width: area.w / width, height: area.h / HEIGHT } };
    },
    dispose() {
      texture.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
