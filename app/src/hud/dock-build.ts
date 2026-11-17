/**
 * Control widgets of the dock and the board: turns a step's `ControlSpec`s into widgets named `ctl-<id>`, wires
 * them to the binding's value store, applies live patches, and returns what must run every frame (readouts,
 * gauges, live charts, `visible` / `disabled` predicates).
 */
import {
  Button,
  Chart,
  Chip,
  Gauge,
  Label,
  Readout,
  Slider,
  StatGrid,
  TEXT_COLOR,
  Table,
  Tabs,
  Toggle,
  UI,
  UiNode,
  conceal,
  isRevealed,
  reveal,
} from '@/ui3d';
import { fmtUnit } from '@/content';
import type { ColorLike } from '@/style';
import type { StepUiBinding } from './step-ui';
import { controlDefault, notifyChange } from './step-ui';
import { arrangeControls, slotOf, type ControlSlot } from './model/controls';
import type { ControlSpec, When } from './step-ui-types';

export interface BuiltControls {
  /** Content groups in display order (empty when nothing is declared). */
  body: UiNode[];
  /** Buttons: the dock pins them in a sticky action row; the board shows them last. */
  actions: UiNode[];
  /** Per-frame work (polling, predicates). */
  tick: ((t: number) => void)[];
  /** Push a programmatic value into the widget of control `id`. */
  push(id: string, value: number | boolean | string): void;
  /** Re-apply the binding's live patch of control `id`. */
  repatch(id: string): void;
  /** Flash the button `id` (scripted press). */
  flash(id: string): void;
}

/** Evaluate a `When`. */
export const holds = (w: When | undefined): boolean =>
  w === undefined ? true : typeof w === 'function' ? w() : w;

/** Animated show / hide of a node bound to a predicate; the layout is redone when it changes. */
export function bindVisible(
  node: UiNode,
  when: When | undefined,
  relayout: () => void,
  opts: { dy?: number } = {},
): ((t: number) => void) | null {
  if (when === undefined) return null;
  if (!holds(when)) {
    node.visible = false;
    node.opacity = 0;
  }
  return () => {
    const on = holds(when);
    if (on === isRevealed(node)) return;
    if (on) reveal(node, { dy: opts.dy ?? -6, scale: 0.98 });
    else conceal(node, { dy: opts.dy ?? -6, scale: 0.98, onDone: relayout });
    relayout();
  };
}

type Out = number | boolean | string;

/** A wrapping row of controls. */
function group(children: UiNode[], props: { gap: number; align?: 'start' | 'end' | 'center' }): UiNode {
  return new UiNode({ dir: 'row', wrap: true, width: 'fill', ...props, children });
}

/** Groups take no room (and no gap) while every member is hidden. */
function autoHide(groups: readonly UiNode[]): (t: number) => void {
  return () => {
    for (const g of groups) {
      const any = g.children.some((c) => c.visible);
      if (any !== g.visible) g.visible = any;
    }
  };
}

/**
 * Build the widgets of `controls`. `where` decides the default layout: in the dock sliders come first and
 * buttons go to the sticky action row; on a board the declared order is kept.
 */
export function buildControls(
  binding: StepUiBinding,
  controls: readonly ControlSpec[],
  opts: { where: 'dock' | 'board'; reset?: boolean; relayout: () => void },
): BuiltControls {
  const setters = new Map<string, (v: Out) => void>();
  const patchers = new Map<string, () => void>();
  const flashers = new Map<string, () => void>();
  const tick: ((t: number) => void)[] = [];
  // the widget calls the onChange of the spec that built it (an id may be declared in several steps)
  const change = (c: ControlSpec) => (value: Out) => notifyChange(binding, c.id, value, c);
  const board = opts.where === 'board';
  // grouping and order: `model/controls.ts` (shared with the DOM dock)
  const placed: { slot: ControlSlot; item: UiNode }[] = [];
  const place = (node: UiNode, slot: ControlSlot): void => void placed.push({ slot, item: node });
  const watch = (node: UiNode, c: ControlSpec, input: { disabled: boolean } | null): void => {
    node.name = `ctl-${c.id}`;
    const fn = bindVisible(node, c.visible, opts.relayout);
    if (fn) tick.push(fn);
    const off = c.disabled;
    if (input && off !== undefined) {
      input.disabled = holds(off);
      tick.push(() => {
        const patched = binding.patches.get(c.id)?.disabled;
        input.disabled = patched ?? holds(off);
      });
    }
    if (input)
      patchers.set(c.id, () => {
        const d = binding.patches.get(c.id)?.disabled;
        if (d !== undefined) input.disabled = d;
      });
  };
  const add = (c: ControlSpec): void => {
    binding.onScreen.set(c.id, c);
    if (opts.reset) {
      const d = controlDefault(c);
      if (d !== undefined) binding.values.set(c.id, d);
    }
    const stored = binding.values.get(c.id);
    const patch = binding.patches.get(c.id);
    switch (c.type) {
      case 'slider': {
        const w = new Slider({
          scale: c.scale,
          step: c.step,
          stops: c.stops,
          snaps: c.snaps,
          snapRange: c.snapRange,
          unit: c.unit,
          digits: c.digits,
          format: c.format,
          marks: c.marks,
          label: patch?.label ?? c.label,
          min: patch?.min ?? c.min,
          max: patch?.max ?? c.max,
          value: typeof stored === 'number' ? stored : c.value,
          tooltip: c.hint,
          onChange: change(c),
        });
        watch(w, c, w);
        setters.set(c.id, (v) => (w.value = Number(v)));
        const base = patchers.get(c.id);
        patchers.set(c.id, () => {
          base?.();
          const p = binding.patches.get(c.id);
          if (p?.label !== undefined) w.label = p.label;
          w.setRange(p?.min ?? c.min, p?.max ?? c.max);
        });
        place(w, slotOf(c));
        break;
      }
      case 'toggle': {
        const w = new Toggle({
          label: patch?.label ?? c.label,
          value: typeof stored === 'boolean' ? stored : c.value,
          tooltip: c.hint,
          onChange: change(c),
        });
        watch(w, c, w);
        setters.set(c.id, (v) => (w.value = Boolean(v)));
        place(w, slotOf(c));
        break;
      }
      case 'segmented': {
        const tabs = new Tabs({
          name: `ctl-${c.id}`,
          items: c.items,
          value: typeof stored === 'string' ? stored : c.value,
          onChange: change(c),
        });
        setters.set(c.id, (v) => (tabs.value = String(v)));
        const label = patch?.label ?? c.label;
        const caption = label ? new Label(label, { size: UI.text.small, color: TEXT_COLOR.dim }) : null;
        const node = caption
          ? new UiNode({ dir: 'col', gap: 4, width: 'fill', children: [caption, tabs] })
          : tabs;
        watch(node, c, tabs);
        if (node !== tabs) tabs.name = `ctl-${c.id}:tabs`;
        place(node, slotOf(c));
        break;
      }
      case 'button': {
        const w = new Button({
          label: patch?.label ?? c.label,
          icon: c.icon,
          variant: c.primary ? 'primary' : 'secondary',
          tooltip: c.hint,
          onClick: c.onClick,
        });
        watch(w, c, w);
        flashers.set(c.id, () => w.flash());
        place(w, slotOf(c));
        break;
      }
      case 'readout': {
        const text = c.text;
        const w = new Readout({
          label: c.label,
          unit: c.unit,
          digits: c.digits,
          format: c.format,
          value: c.get?.() ?? 0,
          text: text ? text() : undefined,
          chars: text ? Math.max(text().length + 2, 10) : undefined,
          duration: 0,
        });
        watch(w, c, null);
        const get = c.get;
        tick.push(() => {
          const v = get ? get() : NaN;
          if (text) w.setText(text());
          else w.setNow(v);
          if (c.color) w.color = c.color(v);
        });
        place(w, slotOf(c));
        break;
      }
      case 'gauge': {
        const w = new Gauge({
          kind: c.kind,
          label: c.label,
          min: c.min,
          max: c.max,
          unit: c.unit,
          digits: c.digits,
          zones: c.zones,
          value: c.get(),
          size: 132,
        });
        watch(w, c, null);
        tick.push(() => w.setNow(c.get()));
        place(w, slotOf(c));
        break;
      }
      case 'chart': {
        const w = new Chart(c.chart);
        watch(w, c, null);
        c.init?.(w);
        const update = c.update;
        if (update) tick.push((t) => update(w, t));
        place(w, slotOf(c));
        break;
      }
      case 'custom': {
        const update = c.update;
        if (update) tick.push(update);
        watch(c.node, c, null);
        place(c.node, slotOf(c));
        break;
      }
      case 'table': {
        const rows = c.rows;
        const w = new Table({
          head: c.head,
          rows: typeof rows === 'function' ? rows() : rows,
          cellAlign: c.align,
        });
        watch(w, c, null);
        let last = '';
        if (typeof rows === 'function' || c.highlight)
          tick.push(() => {
            if (typeof rows === 'function') {
              const next = rows();
              const key = next.map((r) => r.join('\u0001')).join('\u0002');
              if (key !== last) {
                last = key;
                w.setRows(next);
              }
            }
            if (c.highlight) w.highlight = c.highlight();
          });
        place(w, slotOf(c));
        break;
      }
      case 'stats': {
        const fmt = (it: (typeof c.items)[number]): string => {
          const v = it.get();
          return typeof v === 'string'
            ? v
            : fmtUnit(v, it.unit ?? '', it.digits !== undefined ? { digits: it.digits } : { maxDigits: 2 });
        };
        const w = new StatGrid({
          items: c.items.map((it) => ({ label: it.label, value: fmt(it), color: it.color?.() })),
          columns: c.columns ?? (board ? 3 : 2),
        });
        watch(w, c, null);
        tick.push(() => c.items.forEach((it, i) => w.set(i, fmt(it), it.color?.())));
        place(w, slotOf(c));
        break;
      }
      case 'note': {
        const read = (): string => (typeof c.text === 'function' ? c.text() : c.text);
        const tone = (): ColorLike | undefined => (typeof c.color === 'function' ? c.color() : c.color);
        const w = new Chip({
          kind: 'status',
          icon: c.icon ?? 'info',
          text: read(),
          color: tone(),
          maxWidth: 400,
          tooltip: c.hint,
        });
        watch(w, c, null);
        tick.push(() => {
          w.label = read();
          const t = tone();
          if (t !== undefined) w.color = t;
        });
        place(w, slotOf(c));
        break;
      }
    }
  };
  for (const c of controls) add(c);
  const layout = arrangeControls(placed, opts.where);
  const actions = layout.actions;
  const body = layout.body.map((g) =>
    g.kind === 'one'
      ? g.item
      : g.kind === 'toggles'
        ? group(g.items, { gap: 18 })
        : group(g.items, { gap: 22, align: 'end' }),
  );
  const groups = body.filter((n) => n.dir === 'row' && n.wrap && !n.name);
  if (groups.length) tick.push(autoHide(groups));
  return {
    body,
    actions,
    tick,
    push: (id, v) => setters.get(id)?.(v),
    repatch: (id) => patchers.get(id)?.(),
    flash: (id) => flashers.get(id)?.(),
  };
}
