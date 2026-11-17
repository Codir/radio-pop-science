/**
 * Declarative step UI — what a chapter scene hands to `stepUi(ctx).define({...})`. The HUD lays the controls
 * out in the control dock (and the optional board), shows / hides them with the step and cleans up; chapters
 * never place panels.
 */
import type { Object3D, Vector3 } from 'three';
import type { TweenScope } from '@/engine/api';
import type { ColorLike } from '@/style';
import type { ChartApi, ChartProps, GaugeZone, IconName, SliderScale, UiNode } from '@/ui3d';

/**
 * A condition re-evaluated every frame while the step is on screen (keep it cheap: read `ui.value(…)` or a
 * flag of your model). Hidden things fade out and give their space back; `false` hides permanently.
 */
export type When = boolean | (() => boolean);

interface Base {
  /** Unique within the chapter; `ui.value(id)` / `ui.set(id, v)` address the control by it. Node name `ctl-<id>`. */
  id: string;
  /** Tooltip with a longer explanation. */
  hint?: string;
  /** Show the control only while this holds (animated). Default: always. */
  visible?: When;
  /** Grey the control out while this holds (inputs only). */
  disabled?: When;
}

export interface SliderSpec extends Base, SliderScale {
  type: 'slider';
  label: string;
  value: number;
  unit?: string;
  digits?: number;
  format?: (value: number) => string;
  marks?: readonly { value: number; label: string }[];
  onChange?: (value: number) => void;
  /**
   * How the reader moved it (DOM interface; UI_API §3.3 «a slider that scrubs an animation»): `drag` — the thumb
   * is being dragged, follow it directly; `jump` — a click / tap on the track, ease to the new value; `step` —
   * a key or the wheel, ease. Called after `onChange` with the same value. The WebGL slider does not call it.
   */
  onInput?: (value: number, how: 'drag' | 'jump' | 'step') => void;
}

export interface ToggleSpec extends Base {
  type: 'toggle';
  label: string;
  value?: boolean;
  onChange?: (value: boolean) => void;
}

export interface SegmentedSpec extends Base {
  type: 'segmented';
  label?: string;
  /** Item nodes are named `ctl-<id>:<item id>`. Labels that do not fit shrink, then wrap to two rows. */
  items: readonly { id: string; label: string }[];
  value?: string;
  onChange?: (id: string) => void;
}

export interface ButtonSpec extends Base {
  type: 'button';
  label: string;
  icon?: IconName;
  primary?: boolean;
  onClick: () => void;
}

export interface ReadoutSpec extends Base {
  type: 'readout';
  label: string;
  unit?: string;
  digits?: number;
  format?: (value: number) => string;
  /** Polled every frame while the step is on screen. Give `get` (a number) or `text` (a string). */
  get?: () => number;
  /** Text value instead of a number («з втратами», «LFP»), polled every frame. */
  text?: () => string;
  /** Colour by value (e.g. a status colour); for text readouts the argument is NaN. */
  color?: (value: number) => ColorLike;
}

export interface GaugeSpec extends Base {
  type: 'gauge';
  kind?: 'radial' | 'linear';
  label: string;
  min: number;
  max: number;
  unit?: string;
  digits?: number;
  zones?: readonly GaugeZone[];
  get: () => number;
}

export interface ChartSpec extends Base {
  type: 'chart';
  chart: ChartProps;
  // method syntax on purpose: callbacks typed `(chart: Chart) => …` stay assignable (parameter bivariance)
  /** Called once when the chart is created (fill static curves). */
  init?(chart: ChartApi): void;
  /** Called every frame while visible (push live samples, move markers). `t` = engine time in seconds. */
  update?(chart: ChartApi, t: number): void;
}

/** What the DOM interface hands a `custom.dom` factory (docs/HUD_DOM.md §8). */
export interface DomHost {
  /** Tweens on the engine clock (morphs, reveals); QA freezes this clock, so screenshots stay deterministic. */
  readonly tweens: TweenScope;
  /** Reduced motion is on (setting or `prefers-reduced-motion`): jump instead of animating. */
  reducedMotion(): boolean;
}

/** A widget of the DOM interface: an element plus its per-frame tick and clean-up. */
export interface DomWidget {
  readonly el: HTMLElement;
  /** Called every frame while the step is on screen, after `CustomSpec.update`. `t` = engine time, seconds. */
  update?(t: number): void;
  /** Called when the chapter is left (a widget only detached when its step is left). */
  dispose?(): void;
}

export interface CustomSpec extends Base {
  type: 'custom';
  /**
   * Any widget tree built with `@/ui3d` — drawn by the WebGL interface (`?hud=gl`); it is detached, not
   * disposed, when the step is left. Under `?hud=dom` a kit chart node (`HeatMap`, `RadarChart`) gets a DOM
   * twin automatically; any other node needs `dom`.
   */
  node: UiNode;
  /**
   * The same widget for the DOM interface (`?hud=dom`), built once on first show; lifetime like `node`. Name its
   * controls `data-ui="ctl-<id>:<item>"` like the WebGL buttons so tests find both.
   */
  dom?: (host: DomHost) => DomWidget;
  update?: (t: number) => void;
}

/** A table of strings (key–value lists, comparison tables, run results). */
export interface TableSpec extends Base {
  type: 'table';
  /** Column headers; omit for a key–value list. */
  head?: readonly string[];
  /** Rows of cells; a function is polled every frame (the table repaints only when a cell changed). */
  rows: readonly (readonly string[])[] | (() => readonly (readonly string[])[]);
  /** Highlight one row (e.g. the chemistry selected in a segmented control); -1 / undefined = none. */
  highlight?: () => number;
  /** Column alignment, default: first column left, the rest right. */
  align?: readonly ('left' | 'right' | 'center')[];
}

/** A grid of big numbers with captions («86,4 Wh», «91,8 %»), 2–4 per row. */
export interface StatsSpec extends Base {
  type: 'stats';
  items: readonly {
    label: string;
    /** Number (formatted with `unit` / `digits`) or text. Polled every frame. */
    get: () => number | string;
    unit?: string;
    digits?: number;
    color?: () => ColorLike;
  }[];
  /** Cells per row. Default 3 (2 in the dock). */
  columns?: number;
}

/** A short status / notice line with an icon (conditional messages such as «Захист від шторму»). */
export interface NoteSpec extends Base {
  type: 'note';
  text: string | (() => string);
  icon?: IconName;
  color?: ColorLike | (() => ColorLike);
}

export type ControlSpec =
  | SliderSpec
  | ToggleSpec
  | SegmentedSpec
  | ButtonSpec
  | ReadoutSpec
  | GaugeSpec
  | ChartSpec
  | CustomSpec
  | TableSpec
  | StatsSpec
  | NoteSpec;

/** Kinds of the former honesty chips (DECISIONS §5, superseded by §60 x). */
export type HonestyKind = 'notToScale' | 'simplified' | 'illustrative';

/**
 * Former honesty chip of a step. Superseded by DECISIONS §60 x: no interface renders it any more; the type stays
 * only so volume 1's step declarations (content on hold) still compile. New steps do not declare it.
 */
export type HonestySpec =
  | HonestyKind
  | ({ visible?: When; text?: string } & (
      { slowed: number } | { sped: number } | { enlarged: number } | { kind: HonestyKind } | { text: string }
    ));

/** Where a world-anchored annotation points: an object (its origin), a fixed point, or a function. */
export type Anchor = Object3D | readonly [number, number, number] | (() => Vector3);

export interface CalloutSpec {
  anchor: Anchor;
  /** Label text (mini-markup allowed), international term first. A function is re-read every frame. */
  text: string | (() => string);
  color?: ColorLike;
  /** Preferred side of the label relative to the anchor. Default: automatic. */
  side?: 'left' | 'right' | 'up' | 'down';
  /** Objects that can hide the anchor: the callout fades while one of them is in front of it. */
  occluders?: readonly Object3D[];
  /** Show only while this holds (fades in / out in place — no off-screen anchor tricks). */
  visible?: When;
  /**
   * Importance on small screens (F5): phones show only the few most important callouts of a step (see
   * `docs/MOBILE.md`); lower number = more important. Default: the order of declaration, so list the callouts
   * that carry the step's point first. Desktops show all of them, as always.
   */
  priority?: number;
}

export interface HotspotSpec {
  anchor: Anchor;
  /**
   * Bind to a hotspot of the step's content: its index, its `id` (slug of the international name, e.g.
   * `'wind-turbine'`), its `international` name or its full `name`. Title and text then come from the content.
   */
  content?: number | string;
  /** Card title (when not bound with `content`); a `name` of a content hotspot still binds (legacy). */
  title?: string;
  text?: string;
  occluders?: readonly Object3D[];
  /** Called when the card opens (e.g. to move the camera closer). */
  onOpen?: () => void;
  /** Show only while this holds (fades in / out in place). */
  visible?: When;
}

/**
 * A board: the sanctioned place for a big chart, a results table or a stat grid that does not fit the dock.
 * The HUD lays it out (top-left on wide screens, above the bottom sheet otherwise), animates it with the step
 * and reports its area to the camera director like its own panels.
 */
export interface BoardSpec {
  title?: string;
  /**
   * Width hint: `sm` 380, `md` 520 (default), `lg` 680 px-eq; shrinks to the free width on small screens.
   * `fill` (DOM interface) — the step's subject is the board (the volume map of `prologue/map`): it takes the
   * free scene area between the spine and the step column, centred in it; its widgets grow with it (the WebGL
   * board treats it as `lg`).
   */
  size?: 'sm' | 'md' | 'lg' | 'fill';
  /** Charts, tables, stats, readouts, gauges, notes, buttons, custom nodes — top to bottom, readouts in rows. */
  children: readonly ControlSpec[];
  /** Show only while this holds. */
  visible?: When;
}

export interface StepUiSpec {
  controls?: readonly ControlSpec[];
  /** Ignored — no honesty chips are shown (DECISIONS §60 x); kept for volume 1's untouched declarations. */
  honesty?: readonly HonestySpec[];
  callouts?: readonly CalloutSpec[];
  hotspots?: readonly HotspotSpec[];
  board?: BoardSpec;
  /** One-line hint shown as a toast when the step is entered (what to try). */
  hint?: string;
  /** Restore control values to their declared defaults every time the step is entered. */
  reset?: boolean;
  /**
   * Path-format chapters (docs/PATH_FORMAT.md, field «Ціль»): the step's goal. The panel shows the takeaway once
   * this holds (polled per frame) and keeps it for the rest of the session; a step without `goal` shows its
   * takeaway at once.
   */
  goal?: When;
  /**
   * The step navigator stays hidden (no pointer, no focus, forward keys do nothing) until `hiddenUntil` first
   * holds — a predicate, or `'goal'` for the step's `goal` — then it is revealed smoothly (`hud/nav-gate.ts`).
   */
  nav?: { hiddenUntil: When | 'goal' };
  /**
   * The step panel's content held back on entry until this holds (e.g. a self-playing transition has finished:
   * no text to read mid-motion): the plate stays as a calm empty plate, then title and text fade in on the engine
   * clock; hint timers start then. Per visit; reduced motion shows the content at once (DOM interface).
   */
  panel?: { hiddenUntil: When };
}
