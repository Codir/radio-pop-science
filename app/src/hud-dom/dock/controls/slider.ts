/**
 * Slider (WebGL twin `ui3d/widgets/slider.ts`): a styled native `<input type=range>` over a glowing rail, chunky
 * knob, value bubble while dragging. The input runs in a 0…1000 position space; values come from the pure
 * `slider-scale.ts` (linear / log, `step`, `stops`, `snaps`), so a real pointer drag lands on the same value as on
 * the WebGL slider. Keys: ←/→/↑/↓ one step (Shift ×10), PgUp/PgDn ×10, Home/End — `nudge` as in WebGL. Wheel:
 * adjusts while the slider has focus, or when the dock around it cannot scroll; otherwise it scrolls the dock.
 * Driving an animation (UI_API §3.3): `onInput(value, how)` tells a drag (follow) from a jump or a step (ease);
 * `ui.patch(id, { current })` draws the animation's own position as the fill while the thumb shows the target.
 */
import { fmtUnit } from '@/content/format';
import type { SliderSpec } from '@/hud/step-ui-types';
import { sfx } from '@/ui3d';
import { nudge, tToValue, valueToT, type SliderScale } from '@/ui3d/widgets/slider-scale';
import { h, setClass, setStyle, setText } from '../../core/dom';
import { setRich } from '../../core/rich';
import { uid, type DomControl } from './types';

const STEPS = 1000;

export function domSlider(c: SliderSpec, value: number, label: string, onChange: (v: number) => void): DomControl {
  const range: SliderScale = {
    min: c.min,
    max: c.max,
    scale: c.scale,
    step: c.step,
    stops: c.stops,
    snaps: c.snaps,
    snapRange: c.snapRange,
  };
  const format =
    c.format ?? ((v: number) => fmtUnit(v, c.unit ?? '', c.digits !== undefined ? { digits: c.digits } : { maxDigits: 3 }));
  const id = uid(c.id);
  const input = h('input.dk-range', {
    type: 'range',
    id,
    min: 0,
    max: STEPS,
    step: 1,
    'data-keys': '',
    'data-tip': c.hint,
  });
  const name = h('label.dk-label', { for: id });
  const out = h('output.dk-value', { for: id, 'aria-hidden': 'true' });
  const bubble = h('span.dk-bubble', { 'aria-hidden': 'true' });
  const fill = h('span.dk-fill');
  const ticks = h('span.dk-ticks', { 'aria-hidden': 'true' });
  const track = h('div.dk-track', null, h('span.dk-rail'), fill, ticks, input, bubble);
  const el = h(
    'div.dk-ctl.dk-slider',
    { 'data-ui': `ctl-${c.id}` },
    h('div.dk-head', null, name, out),
    track,
  );
  const marks = c.marks ?? [];
  const markValues = [...marks.map((m) => m.value), ...(c.snaps ?? []), ...(c.stops ?? [])];
  const strip = marks.length ? h('div.dk-marks', { 'aria-hidden': 'true' }) : null;
  if (strip) el.append(strip);
  let current = tToValue(range, valueToT(range, value));

  /** Tick marks and mark captions follow the range (`ui.patch` may change it). */
  const placeMarks = (): void => {
    ticks.replaceChildren(
      ...markValues.map((v) => {
        const i = h('i');
        i.style.setProperty('--m', valueToT(range, v).toFixed(4));
        return i;
      }),
    );
    strip?.replaceChildren(
      ...marks.map((m) => {
        const t = valueToT(range, m.value);
        const s = h('span', null, m.label);
        // as the WebGL strip: anchored at 3 %…97 % of the width, pivot sliding with t (ends stay inside)
        s.style.setProperty('--m', t.toFixed(4));
        return s;
      }),
    );
  };
  const show = (): void => {
    const t = valueToT(range, current);
    input.value = String(Math.round(t * STEPS));
    setStyle(track, '--t', t.toFixed(4));
    const text = format(current);
    setText(out, text);
    setText(bubble, text);
    input.setAttribute('aria-valuetext', text);
  };
  const update = (v: number, notify: boolean, how: 'drag' | 'jump' | 'step' = 'step'): void => {
    const changed = v !== current;
    current = v;
    show();
    if (!changed) return;
    sfx(range.stops || range.snaps?.includes(v) ? 'snap' : 'slide');
    if (!notify) return;
    onChange(v);
    c.onInput?.(v, how);
  };
  const step = (count: number): void => update(nudge(range, current, count), true);

  // a press on the track makes the native range jump at once (one `input`), a drag then follows: the first input
  // after a press that lands away from the thumb is a jump (the chapter eases there), the rest is a drag
  let pressed = false;
  let atPress = 0;
  // grabbed while the scene still travels to an earlier target (`ui.patch(id, { current })` lags the thumb): the
  // inputs stay `jump` — the scene eases to the hand — until it has caught up; then the drag follows directly
  let scene: number | null = null;
  let catching = false;
  input.addEventListener('pointerdown', () => {
    pressed = true;
    atPress = valueToT(range, current);
    catching = scene !== null && Math.abs(scene - atPress) > 0.02;
  });
  for (const ev of ['pointerup', 'pointercancel'] as const) input.addEventListener(ev, () => (catching = false));
  input.addEventListener('input', () => {
    const t = input.valueAsNumber / STEPS;
    const how = catching || (pressed && Math.abs(t - atPress) > 0.04) ? 'jump' : 'drag';
    pressed = false;
    update(tToValue(range, t), true, how);
  });
  input.addEventListener('keydown', (e) => {
    const k = e.shiftKey ? 10 : 1;
    const map: Record<string, () => void> = {
      ArrowRight: () => step(k),
      ArrowUp: () => step(k),
      ArrowLeft: () => step(-k),
      ArrowDown: () => step(-k),
      PageUp: () => step(10),
      PageDown: () => step(-10),
      Home: () => update(tToValue(range, 0), true),
      End: () => update(tToValue(range, 1), true),
    };
    const fn = map[e.key];
    if (!fn || input.disabled) return;
    e.preventDefault();
    fn();
  });
  // the bubble shows while a pointer drags (CSS fades it out 0.35 s after the release, as the WebGL bubble)
  const drag = (on: boolean) => () => setClass(el, 'drag', on);
  input.addEventListener('pointerdown', drag(true));
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'] as const)
    input.addEventListener(ev, drag(false));
  track.addEventListener(
    'wheel',
    (e) => {
      if (input.disabled) return;
      const scroller = el.closest('.kd-scroll');
      const canScroll = scroller !== null && scroller.scrollHeight > scroller.clientHeight + 1;
      if (canScroll && document.activeElement !== input) return; // the dock scrolls
      e.preventDefault();
      step(e.deltaY > 0 ? -1 : 1);
    },
    { passive: false },
  );

  setRich(name, label);
  placeMarks();
  show();
  return {
    el,
    set: (v) => update(tToValue(range, valueToT(range, Number(v))), false),
    setDisabled(on) {
      if (input.disabled !== on) input.disabled = on;
      setClass(el, 'off', on);
    },
    patch(p) {
      if (p.label !== undefined) setRich(name, p.label);
      // where an animation driven by this slider is now: the fill shows it, the thumb stays at the target
      if (p.current !== undefined) {
        scene = valueToT(range, p.current);
        setStyle(track, '--c', scene.toFixed(4));
        if (catching && Math.abs(scene - valueToT(range, current)) < 0.02) catching = false;
      }
      const min = p.min ?? c.min;
      const max = p.max ?? c.max;
      if (min === range.min && max === range.max) return;
      range.min = min;
      range.max = max;
      placeMarks();
      update(tToValue(range, valueToT(range, Math.min(Math.max(current, min), max))), false);
    },
  };
}
