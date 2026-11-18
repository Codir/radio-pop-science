import { describe, expect, it } from 'vitest';
import { NBSP } from '@/content';
import type { ButtonSpec, ControlSpec, SliderSpec, StepUiApi } from '@/hud';
import { EMPTY_PROGRESS } from '@alchemy/sim/lab';
import type { StepId } from '../chapter';
import { L } from '../labels';
import type { Lab } from '../parts/dock';
import { Session } from '../parts/session';
import {
  NATURAL_Z, elementCaption, endPicking, isNatural, isotopeCaption, naturalIsotopes, pickerControls, pickerState, picking,
} from '../parts/start-picker';

/** A lab with a real session (in the free lab) and a step UI that keeps values and slider ranges as the HUD does. */
function makeLab() {
  const values = new Map<string, number>();
  const ranges = new Map<string, { min: number; max: number }>();
  const ui = {
    value: (id: string) => values.get(id),
    set: (id: string, v: number) => values.set(id, v),
    patch: (id: string, p: { min?: number; max?: number; value?: number }) => {
      const r = ranges.get(id) ?? { min: NaN, max: NaN };
      ranges.set(id, { min: p.min ?? r.min, max: p.max ?? r.max });
      if (p.value !== undefined) values.set(id, p.value);
    },
  } as unknown as StepUiApi<StepId>;
  const session = new Session({ random: () => 0.5, load: () => EMPTY_PROGRESS, save: () => undefined });
  session.enter('free');
  const lab = { ui, session } as unknown as Lab;
  // the dock closes the picker on every new run (`announce`); here the test does it
  session.on((e) => {
    if (e.type === 'reset') endPicking(lab);
  });
  const controls = pickerControls(lab);
  for (const c of controls) if (c.type === 'slider') values.set(c.id, c.value);
  const find = <T extends ControlSpec>(id: string): T => controls.find((c) => c.id === id) as T;
  const press = (id: string): void => find<ButtonSpec>(id).onClick();
  /** The reader moves the element slider (a gesture: the value, then `onChange`). */
  const chooseElement = (z: number): void => {
    const i = NATURAL_Z.indexOf(z);
    values.set('pick-element', i);
    find<SliderSpec>('pick-element').onChange!(i);
  };
  const captions = (): [string, string] => [
    find<SliderSpec>('pick-element').format!(values.get('pick-element')!),
    find<SliderSpec>('pick-isotope').format!(values.get('pick-isotope')!).replaceAll(NBSP, ' '),
  ];
  return { lab, session, values, ranges, controls, find, press, chooseElement, captions };
}

const holds = (w: ControlSpec['visible'] | ControlSpec['disabled']): boolean =>
  typeof w === 'function' ? w() : w !== false;
const shown = (controls: readonly ControlSpec[]): string[] => controls.filter((c) => holds(c.visible)).map((c) => c.id);

describe('start picker', () => {
  it('lists what nature has', () => {
    expect(NATURAL_Z).toHaveLength(84);
    expect(NATURAL_Z[0]).toBe(1);
    expect(NATURAL_Z.at(-1)).toBe(92);
    expect(NATURAL_Z).not.toContain(43);
    expect(NATURAL_Z).not.toContain(61);
    expect(naturalIsotopes(50)).toHaveLength(10);
    expect(naturalIsotopes(79).map((x) => x.a)).toEqual([197]);
    expect(naturalIsotopes(92).map((x) => x.a)).toEqual([234, 235, 238]);
    expect(naturalIsotopes(43)).toEqual([]);
    expect(elementCaption(NATURAL_Z.indexOf(79))).toBe('Au · Аурум (золото)');
    expect(isotopeCaption(79, 0).replaceAll(NBSP, ' ')).toBe('¹⁹⁷Au · 100 %');
    expect(isotopeCaption(79, 7)).toBe(isotopeCaption(79, 0)); // індекс поза межами обрізається
  });

  it('keeps every caption readable at the edges', () => {
    expect(naturalIsotopes(1).map((x) => x.a)).toEqual([1, 2]);
    expect(elementCaption(-3)).toBe('H · Гідроген (водень)');
    expect(elementCaption(500)).toBe('U · Уран');
    expect(elementCaption(Number.NaN)).toBe(elementCaption(0));
    expect(isotopeCaption(92, 0).replaceAll(NBSP, ' ')).toBe('²³⁴U · 0,0054 %');
    expect(isotopeCaption(92, -1)).toBe(isotopeCaption(92, 0));
    expect(isotopeCaption(50, 9.4).replaceAll(NBSP, ' ')).toBe('¹²⁴Sn · 5,79 %');
    expect(isotopeCaption(43, 0)).toBe('');
    expect(isNatural({ z: 79, n: 118 })).toBe(true);
    expect(isNatural({ z: 79, n: 119 })).toBe(false);
    expect(isNatural({ z: 43, n: 55 })).toBe(false);
  });

  it('offers «Новий старт» outside the mode, then only the two sliders, the note, «Взяти як старт» and «Скасувати»', () => {
    const { lab, controls, press } = makeLab();
    expect(controls.map((c) => c.id)).toEqual(['pick-element', 'pick-isotope', 'start-hint', 'new-start', 'take-start', 'cancel-start']);
    expect(shown(controls)).toEqual(['new-start']);
    press('new-start');
    expect(picking(lab)).toBe(true);
    expect(shown(controls)).toEqual(['pick-element', 'pick-isotope', 'start-hint', 'take-start', 'cancel-start']);
    // the note says what to do, quoting the button
    expect((controls.find((c) => c.id === 'start-hint') as { text: string }).text).toContain(`«${L.free.take}»`);
    press('cancel-start');
    expect(picking(lab)).toBe(false);
    expect(shown(controls)).toEqual(['new-start']);
  });

  it('opens on the current nuclide when nature has it, on ¹H otherwise', () => {
    const { lab, session, press, captions } = makeLab();
    session.startFrom(79, 118);
    press('new-start');
    expect(captions()).toEqual(['Au · Аурум (золото)', '¹⁹⁷Au · 100 %']);
    expect(pickerState(lab)).toEqual({ picking: true, choice: '79-118' });
    press('cancel-start');
    session.fire('n'); // ¹⁹⁸Au: not in nature
    expect(session.state).toMatchObject({ z: 79, n: 119 });
    press('new-start');
    expect(captions()).toEqual(['H · Гідроген (водень)', '¹H · 99,99 %']);
    session.startFrom(1, 1);
    press('new-start');
    expect(captions()[1]).toBe('²H · 0,0145 %'); // the rarer isotope, because that is where the atom is
  });

  it('moves the isotope slider to the most abundant isotope of a new element, within that element', () => {
    const { lab, values, ranges, find, press, chooseElement, captions } = makeLab();
    const isotope = find<SliderSpec>('pick-isotope');
    press('new-start');
    chooseElement(50);
    expect(captions()).toEqual(['Sn · Станум (олово)', '¹²⁰Sn · 32,58 %']);
    const tin = ranges.get('pick-isotope')!;
    expect(tin.max - tin.min).toBe(9);
    expect(holds(isotope.disabled)).toBe(false);
    values.set('pick-isotope', tin.min); // the reader drags the isotope slider to its left end
    expect(captions()[1]).toBe('¹¹²Sn · 0,97 %');
    expect(pickerState(lab).choice).toBe('50-62');
    chooseElement(12);
    const magnesium = values.get('pick-isotope');
    expect(captions()[1]).toBe('²⁴Mg · 78,97 %');
    chooseElement(13); // one natural isotope: a range of one value, the slider is disabled
    expect(values.get('pick-isotope')).not.toBe(magnesium); // two elements never share a value
    expect(ranges.get('pick-isotope')!.min).toBe(ranges.get('pick-isotope')!.max);
    expect(holds(isotope.disabled)).toBe(true);
    expect(captions()).toEqual(['Al · Алюміній', '²⁷Al · 100 %']);
    chooseElement(92);
    expect(captions()[1]).toBe('²³⁸U · 99,27 %');
    expect(holds(isotope.disabled)).toBe(false);
  });

  it('takes the chosen nuclide as a new run and closes; «Скасувати» changes nothing', () => {
    const { lab, session, press, chooseElement } = makeLab();
    session.fire('n');
    session.fire('n'); // ³H, 2 moves
    session.setElectrons(0);
    press('new-start');
    chooseElement(79);
    press('cancel-start');
    expect(session.state).toMatchObject({ z: 1, n: 2, moves: 2, electrons: 0 });
    press('new-start');
    chooseElement(79);
    press('take-start');
    expect(session.state).toMatchObject({ z: 79, n: 118, moves: 0, electrons: 79, elapsedSeconds: 0 });
    expect(session.progress.discovered).toContain('79-118');
    expect(session.progress.free).toMatchObject({ z: 79, n: 118, moves: 0 });
    expect(picking(lab)).toBe(false);
    expect(pickerState(lab)).toEqual({ picking: false, choice: null });
  });

  it('ignores «Взяти як старт» and «Скасувати» pressed outside the choice (a scripted press skips `visible`)', () => {
    const { lab, session, press, chooseElement } = makeLab();
    session.fire('n');
    session.fire('n'); // ³H, 2 moves
    const before = session.state;
    const progress = session.progress;
    press('take-start'); // the sliders still hold ¹H: a take now would wipe the run
    press('cancel-start');
    expect(session.state).toBe(before);
    expect(session.progress).toBe(progress);
    expect(picking(lab)).toBe(false);
    press('new-start');
    chooseElement(79);
    press('cancel-start');
    press('take-start'); // closed again: the gold still on the sliders is not taken
    expect(session.state).toBe(before);
  });

  it('is not offered while a fission waits for the fragment choice', () => {
    const { session, controls } = makeLab();
    session.startFrom(92, 143); // ²³⁵U
    session.fire('n');
    expect(session.state.pending).not.toBeNull();
    expect(shown(controls)).toEqual([]);
    session.pickFragment('heavy');
    expect(shown(controls)).toEqual(['new-start']);
  });
});
