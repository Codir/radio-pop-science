/**
 * Toggle, segmented control, button and status note of the dock / board (WebGL twins `ui3d/widgets/{toggle,
 * tabs,button,chip}.ts`). Real form semantics: `role=switch`, `role=radiogroup` of `role=radio` buttons with a
 * roving tab stop (←/→ move and select, like the WebGL tabs), `<button>`, `role=status` notes.
 */
import type { ButtonSpec, NoteSpec, SegmentedSpec, ToggleSpec } from '@/hud/step-ui-types';
import type { ColorLike } from '@/style/palette';
import { h, setClass } from '../../core/dom';
import { richFragment, setRich } from '../../core/rich';
import { icon } from '../../core/icons';
import { applyAccent } from '../../core/tokens';
import { uid, type DomControl } from './types';

export function domToggle(c: ToggleSpec, value: boolean, label: string, onChange: (v: boolean) => void): DomControl {
  const text = h('span.dk-toggle-label');
  const el = h(
    'button.dk-ctl.dk-toggle',
    { type: 'button', role: 'switch', 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint },
    h('span.dk-switch', { 'aria-hidden': 'true' }, h('i')),
    text,
  );
  let on = value;
  const show = (): void => el.setAttribute('aria-checked', String(on));
  el.addEventListener('click', () => {
    on = !on;
    show();
    // the region's delegated sound listener (chrome/sounds.ts) plays it after this handler
    el.dataset.sfx = on ? 'toggleOn' : 'toggleOff';
    onChange(on);
  });
  setRich(text, label);
  show();
  return {
    el,
    set(v) {
      on = Boolean(v);
      show();
    },
    setDisabled(off) {
      if (el.disabled !== off) el.disabled = off;
    },
    patch: (p) => p.label !== undefined && setRich(text, p.label),
  };
}

export function domSegmented(c: SegmentedSpec, value: string, label: string | undefined, onChange: (id: string) => void): DomControl {
  const capId = uid(c.id);
  const caption = label ? h('span.dk-label', { id: capId }) : null;
  const items = c.items.map((it) => {
    const b = h('button.dk-seg-item', { type: 'button', role: 'radio', 'data-ui': `ctl-${c.id}:${it.id}` }, richFragment(it.label));
    // the well is shared in proportion to each item's one-line width (≈ 9 units a character + 32 padding, as the
    // WebGL tabs measure it); never narrower than its label (min-width: max-content), so whole items wrap
    b.style.flexGrow = String(it.label.length * 9 + 32);
    return b;
  });
  const group = h('div.dk-seg', { role: 'radiogroup', 'data-keys': '', 'aria-labelledby': caption ? capId : null, 'aria-label': caption ? null : c.id }, ...items);
  const el = caption
    ? h('div.dk-ctl.dk-seg-wrap', { 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, caption, group)
    : group;
  if (caption) group.dataset.ui = `ctl-${c.id}:tabs`;
  else {
    group.dataset.ui = `ctl-${c.id}`;
    group.classList.add('dk-ctl');
    if (c.hint) group.dataset.tip = c.hint;
  }
  let current = value;
  const show = (): void =>
    items.forEach((b, i) => {
      const sel = c.items[i]!.id === current;
      b.setAttribute('aria-checked', String(sel));
      b.tabIndex = sel ? 0 : -1;
    });
  const pick = (id: string, focus: boolean): void => {
    const i = c.items.findIndex((it) => it.id === id);
    if (i < 0) return;
    if (focus) items[i]!.focus();
    if (id === current) return;
    current = id;
    show();
    onChange(id);
  };
  items.forEach((b, i) => b.addEventListener('click', () => pick(c.items[i]!.id, false)));
  group.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d || items.some((b) => b.disabled)) return;
    e.preventDefault();
    const i = c.items.findIndex((it) => it.id === current);
    const next = c.items[Math.min(Math.max(i + d, 0), c.items.length - 1)]!;
    pick(next.id, true);
  });
  // labels that do not fit their share first take the smaller type, then wrap (whole items) onto a second row.
  // Run by the column's layout pass (the width only changes there): one read (label widths, well width), then
  // writes — the fit is decided by arithmetic, not by reading the result back (no second forced layout).
  let compact = false;
  const layout = (): void => {
    const wellPx = group.clientWidth;
    if (wellPx === 0) return; // out of the layout (concealed, the sheet's other tab): keep the last
    const k = parseFloat(getComputedStyle(group).getPropertyValue('--u')) || 1;
    // label widths at the full size (17 units; measured at 15 while compact)
    const text = items.map((b) => {
      const r = document.createRange();
      r.selectNodeContents(b);
      return (r.getBoundingClientRect().width / k) * (compact ? 17 / 15 : 1);
    });
    const room = wellPx / k - 6; // inside the 3-unit padding
    // as the WebGL tabs: width ∝ the item's one-line width (label + padding + border). Flex starts every item at
    // its padding + border (floor) and shares the rest by grow, so grow = target − floor.
    const shares = (scale: number, floor: number): { sum: number; natural: number[] } => {
      const natural = text.map((w) => w * scale + floor);
      return { sum: natural.reduce((a, b) => a + b, 0), natural };
    };
    const full = shares(1, 34);
    const small = shares(15 / 17, 20);
    compact = full.sum > room;
    const pick = compact ? small : full;
    const floor = compact ? 20 : 34;
    items.forEach((b, i) => (b.style.flexGrow = Math.max((pick.natural[i]! * room) / pick.sum - floor, 0.01).toFixed(2)));
    setClass(group, 'compact', compact);
    setClass(group, 'wrapped', compact && small.sum > room);
  };
  if (caption) setRich(caption, label!);
  show();
  return {
    el,
    set: (v) => {
      current = String(v);
      show();
    },
    setDisabled(off) {
      for (const b of items) if (b.disabled !== off) b.disabled = off;
    },
    patch: (p) => caption && p.label !== undefined && setRich(caption, p.label),
    layout,
  };
}

export function domButton(c: ButtonSpec, label: string): DomControl {
  const text = h('span');
  const ic = c.icon ? icon(c.icon) : null;
  const el = h(`button.btn.dk-btn${c.primary ? '.primary' : ''}`, { type: 'button', 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, ic, text);
  el.addEventListener('click', () => c.onClick());
  setRich(text, label);
  let flip = false;
  return {
    el,
    setDisabled(off) {
      if (el.disabled !== off) el.disabled = off;
    },
    patch: (p) => p.label !== undefined && setRich(text, p.label),
    flash() {
      // two classes with the same keyframes: re-triggers without a layout read
      flip = !flip;
      setClass(el, 'flash-a', flip);
      setClass(el, 'flash-b', !flip);
    },
  };
}

/**
 * `relayout`: the text changed length (it may wrap differently; the budget follows in the same engine frame). A
 * live number that keeps its length («12,3 %» → «12,4 %») changes no line and costs no layout pass.
 */
export function domNote(c: NoteSpec, relayout: () => void): DomControl {
  const read = (): string => (typeof c.text === 'function' ? c.text() : c.text);
  const tone = (): ColorLike | undefined => (typeof c.color === 'function' ? c.color() : c.color);
  const text = h('span');
  const el = h('p.chip.multi.dk-note', { role: 'status', 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, icon(c.icon ?? 'info'), text);
  let last: ColorLike | undefined;
  let said = '';
  const tick = (): void => {
    const now = read();
    if (now !== said) {
      if (said && now.length !== said.length) relayout();
      said = now;
      setRich(text, now);
    }
    const t = tone();
    if (t !== undefined && t !== last) {
      last = t;
      applyAccent(el, t); // `.dk-note.toned` takes its tone from the local accent
      setClass(el, 'toned', true);
    }
  };
  tick();
  return { el, tick };
}
