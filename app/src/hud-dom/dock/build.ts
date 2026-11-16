/**
 * Builds the DOM controls of a step's dock or board (WebGL twin `hud/dock-build.ts`, same semantics): one widget
 * per `ControlSpec`, named `ctl-<id>`, wired to the binding's value store; grouping and order from the shared
 * model (`hud/model/controls.ts`); `visible` fades and gives the room back, `disabled` and live patches apply per
 * frame; `chart` / `custom` controls are D4's DOM widgets (`chartWidget`, `customWidget`).
 */
import { arrangeControls, slotOf, type ControlSlot } from '@/hud/model/controls';
import { controlDefault, notifyChange, type StepUiBinding } from '@/hud/step-ui';
import type { ControlSpec, DomHost, DomWidget, When } from '@/hud/step-ui-types';
import { chartWidget } from '../charts';
import { h } from '../core/dom';
import { presence } from '../core/motion';
import { customWidget } from '../custom';
import { domGauge } from './controls/gauge';
import { domButton, domNote, domSegmented, domToggle } from './controls/inputs';
import { domReadout, domStats } from './controls/readout';
import { domSlider } from './controls/slider';
import { domTable } from './controls/table';
import type { DomControl, Value } from './controls/types';

export interface BuiltDom {
  /** Body entries in display order (single controls and rows). */
  body: HTMLElement[];
  /** Buttons: the dock's sticky action row; the board's last row. */
  actions: HTMLElement[];
  /** Per-frame work while on screen. */
  tick: ((t: number) => void)[];
  push(id: string, value: Value): void;
  repatch(id: string): void;
  flash(id: string): void;
  /** The column's layout pass, after the width is set and before the budget measures. */
  layout(): void;
  /** The step is left: dispose per-entry widgets, detach the cached custom widgets. */
  leave(): void;
}

const holds = (w: When): boolean => (typeof w === 'function' ? w() : w);

/**
 * `visible` of a control (the WebGL `bindVisible` semantics): fade out, then give the room back (`hidden`), fade in
 * with a short rise. Unlike the core helper it asks for a layout pass at both moments, so the column's budget follows
 * within the same engine frame — under the QA clock (`__app.step`) a `ResizeObserver` would only report on the next
 * real frame, after a test has already located the controls.
 */
export function bindShown(el: HTMLElement, when: When | undefined, relayout: () => void, dy = -6): ((t: number) => void) | null {
  if (when === undefined) return null;
  const p = presence(el);
  if (!holds(when)) p.conceal({ instant: true });
  return () => {
    const on = holds(when);
    if (on === p.shown) return;
    if (on) p.reveal({ dy, scale: 0.98 });
    else p.conceal({ dy, scale: 0.98, onDone: relayout });
    relayout();
  };
}

/**
 * `customs` collects the custom widgets shown in this chapter (the column disposes them when the chapter is
 * left; they survive step changes, as the WebGL nodes do).
 */
export function buildDomControls(
  binding: StepUiBinding,
  controls: readonly ControlSpec[],
  opts: { where: 'dock' | 'board'; reset?: boolean; host: DomHost; customs: Set<DomWidget>; relayout: () => void },
): BuiltDom {
  const built = new Map<string, DomControl>();
  const tick: ((t: number) => void)[] = [];
  const placed: { slot: ControlSlot; item: HTMLElement }[] = [];
  const leave: (() => void)[] = [];
  const change = (c: ControlSpec) => (value: Value) => notifyChange(binding, c.id, value, c);

  const widget = (c: ControlSpec, stored: Value | undefined): DomControl => {
    const patch = binding.patches.get(c.id);
    switch (c.type) {
      case 'slider':
        return domSlider(c, typeof stored === 'number' ? stored : c.value, patch?.label ?? c.label, change(c));
      case 'toggle':
        return domToggle(c, typeof stored === 'boolean' ? stored : (c.value ?? false), patch?.label ?? c.label, change(c));
      case 'segmented':
        return domSegmented(c, typeof stored === 'string' ? stored : (c.value ?? c.items[0]?.id ?? ''), patch?.label ?? c.label, change(c));
      case 'button':
        return domButton(c, patch?.label ?? c.label);
      case 'readout':
        return domReadout(c, opts.host);
      case 'stats':
        return domStats(c, c.columns ?? (opts.where === 'board' ? 3 : 2));
      case 'gauge':
        return domGauge(c);
      case 'table':
        return domTable(c, opts.relayout);
      case 'note':
        return domNote(c, opts.relayout);
      case 'chart': {
        const w = chartWidget(c);
        return { el: w.el, tick: (t) => w.update?.(t), dispose: () => w.dispose?.() };
      }
      case 'custom': {
        const w = customWidget(c, opts.host);
        if (!w) {
          // a `node`-only custom (the WebGL fallback is not drawn in the DOM column; chapter-check flags the warning)
          return { el: h('p.dk-fallback', null, `Віджет «${c.id}» ще не має 2D-версії`) };
        }
        opts.customs.add(w);
        const update = c.update;
        return { el: w.el, tick: (t) => (update?.(t), w.update?.(t)), dispose: () => w.el.remove() };
      }
    }
  };

  for (const c of controls) {
    binding.onScreen.set(c.id, c);
    if (opts.reset) {
      const d = controlDefault(c);
      if (d !== undefined) binding.values.set(c.id, d);
    }
    const w = widget(c, binding.values.get(c.id));
    built.set(c.id, w);
    if (!w.el.dataset.ui) w.el.dataset.ui = `ctl-${c.id}`;
    const vis = bindShown(w.el, c.visible, opts.relayout);
    if (vis) tick.push(vis);
    const off = c.disabled;
    const setDisabled = w.setDisabled;
    if (setDisabled) {
      const apply = (): void => setDisabled(binding.patches.get(c.id)?.disabled ?? (off === undefined ? false : holds(off)));
      apply();
      if (off !== undefined) tick.push(apply);
    }
    if (w.tick) tick.push(w.tick);
    if (w.dispose) leave.push(w.dispose);
    placed.push({ slot: slotOf(c), item: w.el });
  }

  const layout = arrangeControls(placed, opts.where);
  const body = layout.body.map((g) =>
    g.kind === 'one' ? g.item : h(`div.dk-group.dk-${g.kind}`, null, ...g.items),
  );
  return {
    body,
    actions: layout.actions,
    tick,
    push: (id, v) => built.get(id)?.set?.(v),
    repatch(id) {
      const w = built.get(id);
      const p = binding.patches.get(id);
      if (!w || !p) return;
      w.patch?.(p);
      if (p.disabled !== undefined) w.setDisabled?.(p.disabled);
    },
    flash: (id) => built.get(id)?.flash?.(),
    layout: () => built.forEach((w) => w.layout?.()),
    leave: () => leave.forEach((fn) => fn()),
  };
}
