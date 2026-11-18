/**
 * The start picker of the free lab (plan decision 11): «Новий старт» turns the dock into a choice of a new start —
 * two sliders, the element (the 84 that occur in nature) and one of its natural isotopes with its share in
 * nature, then «Взяти як старт» or «Скасувати». While the choice is open the dock offers nothing else (`dock.ts`
 * hides the tools, the projectile choice, the electron counter, «Нейтралізувати» and «Почати знову»); the card and
 * the board stay. A take is a new run from that nuclide (`Session.startFrom`), the same as «Почати звідси» on the
 * board for a natural nuclide picked on the chart.
 *
 * The choice lasts one visit and is never saved: «Скасувати» and every new run (an entry of a step, «Почати
 * знову», a take — the dock's `reset`) close it. It opens on the current nuclide when nature has it, else on ¹H;
 * a new element moves the isotope slider to its most abundant isotope.
 *
 * The isotope slider counts in the list of all 288 natural nuclides, its range being the element's run in that
 * list: two elements never share a value, so the WebGL slider — which repaints its caption only when its value
 * changes — always names an isotope of the element shown above it. An element with one natural isotope gets a
 * one-value range and a disabled slider: a fixed caption, and the dock keeps its height while the element slider
 * is dragged across it.
 */
import type { ControlSpec } from '@/hud';
import { elementByZ, elementName, getNuclide, naturalNuclides, nuclideKey, nuclideSymbol } from '@alchemy/sim/core';
import type { Nuclide, NuclideRef } from '@alchemy/sim/core';
import { L } from '../labels';
import { abundanceText } from './chart-model';
import type { Lab } from './dock';

/** Every nuclide found in nature, by Z, then by A (the isotope slider's values are indices into it). */
const NATURAL: readonly Nuclide[] = naturalNuclides();
const BY_Z = new Map<number, Nuclide[]>();
for (const x of NATURAL) {
  const list = BY_Z.get(x.z);
  if (list) list.push(x);
  else BY_Z.set(x.z, [x]);
}

/** The 84 elements that have a nuclide in nature, by Z (the element slider's values are indices into it). */
export const NATURAL_Z: readonly number[] = [...BY_Z.keys()];

/** The natural isotopes of element `z`, by A; none for an element nature does not have (Tc, Pm, Z > 92). */
export function naturalIsotopes(z: number): readonly Nuclide[] {
  return BY_Z.get(z) ?? [];
}

/** A nuclide nature has (only these can be a new start). */
export function isNatural(ref: NuclideRef): boolean {
  const abundance = getNuclide(ref.z, ref.n)?.abundance;
  return abundance !== null && abundance !== undefined;
}

/** `index` rounded into 0…count − 1 (anything not a number: 0). */
const clamp = (index: number, count: number): number =>
  Number.isFinite(index) ? Math.min(Math.max(Math.round(index), 0), count - 1) : 0;

/** «Au · Аурум (золото)»: the element at `index` of `NATURAL_Z` (an index outside is clamped). */
export function elementCaption(index: number): string {
  const z = NATURAL_Z[clamp(index, NATURAL_Z.length)]!;
  return `${elementByZ(z)?.symbol ?? '?'} · ${elementName(z)}`;
}

/** «¹⁹⁷Au · 100 %»: isotope `index` of the natural isotopes of `z` (an index outside is clamped); '' for none. */
export function isotopeCaption(z: number, index: number): string {
  const list = naturalIsotopes(z);
  if (list.length === 0) return '';
  const x = list[clamp(index, list.length)]!;
  return `${nuclideSymbol(x.z, x.n)} · ${abundanceText(x.abundance ?? 0)}`;
}

/** Where the natural isotopes of `z` start in `NATURAL`. */
const firstOf = (z: number): number => NATURAL.indexOf(naturalIsotopes(z)[0]!);
const mostAbundant = (z: number): Nuclide =>
  naturalIsotopes(z).reduce((best, x) => ((x.abundance ?? 0) > (best.abundance ?? 0) ? x : best));

/** The element the element slider is on. */
const chosenZ = (lab: Lab): number => NATURAL_Z[clamp(lab.ui.value<number>('pick-element'), NATURAL_Z.length)]!;

/** The natural nuclide the two sliders are on (the isotope slider read inside the element's run). */
function chosen(lab: Lab): Nuclide {
  const z = chosenZ(lab);
  const list = naturalIsotopes(z);
  return list[clamp(lab.ui.value<number>('pick-isotope') - firstOf(z), list.length)]!;
}

/** The caption of a value of the isotope slider (an index into `NATURAL`). */
function naturalCaption(value: number): string {
  const x = NATURAL[clamp(value, NATURAL.length)]!;
  return isotopeCaption(x.z, naturalIsotopes(x.z).indexOf(x));
}

/** The isotope slider on the run of `x`'s element, with `x` chosen. */
function showIsotopes(lab: Lab, x: Nuclide): void {
  const first = firstOf(x.z);
  lab.ui.patch('pick-isotope', { min: first, max: first + naturalIsotopes(x.z).length - 1, value: NATURAL.indexOf(x) });
}

/** The chapter instances whose choice is open (like the dock, per instance: a new one starts with it closed). */
const choosing = new WeakSet<Lab>();

/** The choice of a new start is on screen. */
export const picking = (lab: Lab): boolean => choosing.has(lab);

/** Closes the choice (the dock calls it for every new run). */
export function endPicking(lab: Lab): void {
  choosing.delete(lab);
}

/** What QA reads (`__app.read('lab')`): the choice is open, and the nuclide its sliders are on. */
export function pickerState(lab: Lab): { readonly picking: boolean; readonly choice: string | null } {
  if (!picking(lab)) return { picking: false, choice: null };
  const x = chosen(lab);
  return { picking: true, choice: nuclideKey(x.z, x.n) };
}

/**
 * The controls of the choice for the free lab's dock: the two sliders (the dock puts sliders first), a note under
 * the card that says what to do, and the buttons «Новий старт», «Взяти як старт», «Скасувати» (after the step's
 * own in the action row). The note also keeps the card from being the last row of the dock: the platform's DOM
 * table reaches 2 units below its row, and as the last row it made the dock scroll by 2 px at 1920×1080.
 */
export function pickerControls(lab: Lab): readonly ControlSpec[] {
  const { session, ui } = lab;
  const on = (): boolean => picking(lab);
  /** «Новий старт»: the sliders on the current nuclide when nature has it, else on ¹H. */
  const openChoice = (): void => {
    const { z, n } = session.state;
    const here = getNuclide(z, n);
    const x = here && isNatural(here) ? here : getNuclide(1, 0)!;
    ui.set('pick-element', NATURAL_Z.indexOf(x.z));
    showIsotopes(lab, x);
    choosing.add(lab);
  };
  // a scripted press (`ui.press`) does not look at `visible`: outside the choice the sliders hold stale values
  const take = (): void => {
    if (!on()) return;
    const x = chosen(lab);
    session.startFrom(x.z, x.n); // a new run: the dock's `reset` closes the choice
  };
  const cancel = (): void => {
    if (on()) endPicking(lab);
  };
  return [
    {
      type: 'slider',
      id: 'pick-element',
      label: L.free.element,
      hint: L.free.elementHint,
      min: 0,
      max: NATURAL_Z.length - 1,
      step: 1,
      value: 0,
      format: elementCaption,
      onChange: (v) => showIsotopes(lab, mostAbundant(NATURAL_Z[clamp(v, NATURAL_Z.length)]!)),
      visible: on,
    },
    {
      type: 'slider',
      id: 'pick-isotope',
      label: L.free.isotope,
      hint: L.free.isotopeHint,
      // ¹H and ²H until the choice opens
      min: 0,
      max: naturalIsotopes(1).length - 1,
      step: 1,
      value: 0,
      format: naturalCaption,
      visible: on,
      disabled: () => naturalIsotopes(chosenZ(lab)).length < 2,
    },
    { type: 'note', id: 'start-hint', text: L.free.hint, icon: 'info', color: 'mist', visible: on },
    {
      type: 'button',
      id: 'new-start',
      label: L.free.newStart,
      onClick: openChoice,
      visible: () => !on() && session.state.pending === null,
    },
    { type: 'button', id: 'take-start', label: L.free.take, onClick: take, visible: on },
    { type: 'button', id: 'cancel-start', label: L.free.cancel, onClick: cancel, visible: on },
  ];
}
