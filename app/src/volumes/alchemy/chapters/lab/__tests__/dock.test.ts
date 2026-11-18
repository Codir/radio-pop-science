import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { NBSP } from '@/content';
import type { ChapterContext } from '@/engine/api';
import type {
  ButtonSpec, ControlSpec, CustomSpec, HonestySpec, NoteSpec, ReadoutSpec, SegmentedSpec, SliderSpec, StatsSpec, StepUiApi,
  StepUiSpec,
} from '@/hud';
import type { UiNode } from '@/ui3d';
import { ALL_TOOLS, EMPTY_PROGRESS, PROJECTILES, questById } from '@alchemy/sim/lab';
import { STEP_IDS, type StepId } from '../chapter';
import { L } from '../labels';
import type { AtomView } from '../parts/atom-view';
import { announce, chartState, stepSpec, type Lab } from '../parts/dock';
import { Session } from '../parts/session';
import { NATURAL_Z } from '../parts/start-picker';

interface Toast { readonly text: string; readonly tone?: string; readonly icon?: string; hidden: boolean }

/** A lab with a real session and a step UI that only records what it is asked to do. */
function makeLab() {
  const toasts: Toast[] = [];
  const values = new Map<string, string | number>();
  const ui = {
    define: () => undefined,
    value: (id: string) => values.get(id),
    set: (id: string, v: string | number) => values.set(id, v),
    onChange: () => undefined,
    press: () => undefined,
    patch: (id: string, p: { value?: number }) => {
      if (p.value !== undefined) values.set(id, p.value);
    },
    toast: (text: string, opts?: { tone?: string; icon?: string }) => {
      const t: Toast = { text, tone: opts?.tone, icon: opts?.icon, hidden: false };
      toasts.push(t);
      return () => { t.hidden = true; };
    },
  } as unknown as StepUiApi<StepId>;
  const anchor = new Object3D();
  const atom = { anchors: { nucleus: anchor, shells: anchor, plate: anchor, countdown: anchor }, counting: false } as unknown as AtomView;
  const session = new Session({ random: () => 0.5, load: () => EMPTY_PROGRESS, save: () => undefined });
  const fission = { anchors: { heavy: anchor, light: anchor }, middle: anchor, choosing: false, label: () => '' };
  const fx = { emitter: anchor, fission };
  const lab: Lab = { ctx: { onDispose: () => undefined } as unknown as ChapterContext, ui, session, atom, fx };
  session.on((e) => announce(lab, e));
  const specs = Object.fromEntries(STEP_IDS.map((id) => [id, stepSpec(lab, id)])) as Record<StepId, StepUiSpec>;
  return { lab, session, toasts, values, specs };
}

const holds = (c: ControlSpec): boolean => (typeof c.visible === 'function' ? c.visible() : c.visible !== false);
const control = <T extends ControlSpec>(spec: StepUiSpec, id: string): T | undefined =>
  [...(spec.controls ?? []), ...(spec.board?.children ?? [])].find((c) => c.id === id) as T | undefined;
const buttons = (spec: StepUiSpec): ButtonSpec[] =>
  (spec.controls ?? []).filter((c): c is ButtonSpec => c.type === 'button');
const shownButtons = (spec: StepUiSpec): string[] => buttons(spec).filter(holds).map((b) => b.id);
/** A chip by what it says: its kind, `slowed …`, or its own text. */
const chipName = (h: HonestySpec): string =>
  typeof h === 'string' ? h : 'slowed' in h ? `slowed ${h.slowed.toExponential()}` : 'kind' in h ? h.kind : (h.text ?? '');
/** The step's «сповільнено» or «ілюстративно» chip. */
const chip = (spec: StepUiSpec, which: 'slowed' | 'illustrative'): HonestySpec =>
  spec.honesty!.find((h) => chipName(h).startsWith(which))!;
const alwaysOn = (h: HonestySpec): boolean => typeof h === 'string' || h.visible === undefined;
const chipShown = (spec: StepUiSpec, which: 'slowed' | 'illustrative'): boolean => {
  const h = chip(spec, which);
  return alwaysOn(h) || (typeof h !== 'string' && (typeof h.visible === 'function' ? h.visible() : h.visible === true));
};
const statusOf = (spec: StepUiSpec): string | null => {
  const note = control<NoteSpec>(spec, 'status')!;
  return holds(note) ? (note.text as () => string)() : null;
};

describe('lab dock', () => {
  it('offers exactly the tools of each quest, and a projectile choice only when there is one to make', () => {
    const { specs } = makeLab();
    for (const step of STEP_IDS) {
      const tools = questById(step)?.tools ?? ALL_TOOLS;
      const projectiles = PROJECTILES.filter((p) => tools.includes(p.id));
      const want = [
        ...(projectiles.length > 0 ? ['fire'] : []),
        ...(['gamma-n', 'gamma-p', 'wait'] as const).filter((t) => tools.includes(t)),
        'neutral', 'pick-heavy', 'pick-light', 'restart',
        ...(step === 'free' ? ['new-start', 'take-start', 'cancel-start'] : []),
      ];
      expect(buttons(specs[step]).map((b) => b.id), step).toEqual(want);
      const choice = control<SegmentedSpec>(specs[step], 'projectile');
      const items = projectiles.map((p) => ({ id: p.id, label: p.symbol }));
      if (projectiles.length > 1) expect(choice?.items, step).toEqual(items);
      else expect(choice, step).toBeUndefined();
    }
  });

  it('makes the first of «Вистрілити», «Чекати», «γ: вибити протон» the main button', () => {
    const { specs } = makeLab();
    const primary = (step: StepId) => buttons(specs[step]).filter((b) => b.primary).map((b) => b.id);
    expect(primary('heavy-hydrogen')).toEqual(['fire']);
    expect(primary('uranium-chain')).toEqual(['wait']);
    expect(primary('lead-gold')).toEqual(['wait']);
    for (const step of STEP_IDS) expect(primary(step)).toHaveLength(1);
  });

  it('carries all five chips in every step; «сповільнено», «ілюстративно» always on where the quest is about them', () => {
    const { specs } = makeLab();
    const all = ['simplified', 'notToScale', L.honesty.waitSkipped, 'illustrative', 'slowed 1e+15'];
    const fleeting: StepId[] = ['sun', 'star-forge', 'uranium-chain', 'superheavy', 'free'];
    const fission: StepId[] = ['fission', 'superheavy', 'free'];
    for (const step of STEP_IDS) {
      expect(specs[step].honesty!.map(chipName), step).toEqual(all);
      const on = (c: string): boolean =>
        c === 'illustrative' ? fission.includes(step) : c.startsWith('slowed') ? fleeting.includes(step) : true;
      expect(specs[step].honesty!.filter(alwaysOn).map(chipName), step).toEqual(all.filter(on));
    }
    expect((chip(specs.sun, 'slowed') as { text: string }).text).toBe(`${L.honesty.fleeting} 2\u00a0s`);
  });

  it('shows «сповільнено» in heavy-hydrogen once ⁴H has appeared, until the next run', () => {
    const { session, specs } = makeLab();
    const slowed = () => chipShown(specs['heavy-hydrogen'], 'slowed');
    session.enter('heavy-hydrogen');
    expect(slowed()).toBe(false);
    session.fire('n');
    session.fire('n');
    expect(slowed()).toBe(false); // ³H is radioactive, not fleeting
    session.fire('n');
    expect(session.state).toMatchObject({ z: 1, n: 3 }); // ⁴H
    expect(slowed()).toBe(true);
    session.update(2.1); // it falls apart by itself…
    expect(session.state).not.toMatchObject({ z: 1, n: 3 });
    expect(slowed()).toBe(true); // …and the chip still explains why
    session.restart();
    expect(slowed()).toBe(false);
    for (const step of ['sun', 'star-forge', 'uranium-chain', 'superheavy', 'free'] as const) {
      expect(chipShown(specs[step], 'slowed'), step).toBe(true);
    }
  });

  it('shows «ілюстративно» in plutonium once a fission has happened', () => {
    const { session, specs } = makeLab();
    const illustrative = () => chipShown(specs.plutonium, 'illustrative');
    session.enter('plutonium');
    expect(illustrative()).toBe(false);
    session.fire('n'); // ²³⁹U
    session.wait(); // ²³⁹Np
    session.wait(); // ²³⁹Pu
    expect(session.state).toMatchObject({ z: 94, n: 145 });
    expect(illustrative()).toBe(false);
    session.fire('n'); // ²³⁹Pu splits into the fixed pair
    expect(session.state.pending).not.toBeNull();
    expect(illustrative()).toBe(true);
    session.pickFragment('light');
    expect(illustrative()).toBe(true);
    session.restart();
    expect(illustrative()).toBe(false);
    for (const step of ['fission', 'superheavy', 'free'] as const) {
      expect(chipShown(specs[step], 'illustrative'), step).toBe(true);
    }
  });

  it('lets go of a held «+» when a fission choice appears, and changes nothing while it is pending', () => {
    const { session, specs, toasts } = makeLab();
    const counter = control<CustomSpec>(specs.fission, 'electrons')!;
    let plus: UiNode | null = null;
    counter.node.walk((n) => {
      if (n.name === 'ctl-electrons:plus') plus = n;
    });
    session.enter('fission');
    counter.update!(0);
    (plus as UiNode | null)!.handlers!.press!({} as never); // «+» goes down and stays down
    session.fire('n');
    expect(session.state.pending).not.toBeNull();
    const shown = toasts.length;
    for (let t = 0.1; t <= 2; t += 0.1) counter.update!(t); // a held «+» would repeat 8 times a second
    expect(toasts.length).toBe(shown);
    expect(toasts.some((t) => t.text === L.refusal.pending)).toBe(false);
    session.pickFragment('heavy');
    expect(session.state.electrons).toBe(56);
    for (let t = 2.1; t <= 4; t += 0.1) counter.update!(t); // and it does not come back after the choice
    expect(session.state.electrons).toBe(56);
  });

  it('fires the chosen projectile, or the only one of the step', () => {
    const { session, specs, values } = makeLab();
    session.enter('sun');
    const fire = () => buttons(specs.sun).find((b) => b.id === 'fire')!.onClick();
    values.set('projectile', 'p');
    fire();
    expect(session.state).toMatchObject({ z: 1, n: 1, moves: 1 });
    values.set('projectile', 'he3');
    fire();
    expect(session.state).toMatchObject({ z: 3, n: 2, moves: 2 });
    values.set('projectile', 'he3'); // a choice left over from another step: the only projectile here is n
    session.enter('heavy-hydrogen');
    buttons(specs['heavy-hydrogen']).find((b) => b.id === 'fire')!.onClick();
    expect(session.state).toMatchObject({ z: 1, n: 1, moves: 1 });
  });

  it('gives way to the fragment choice while a fission is pending', () => {
    const { session, specs } = makeLab();
    const spec = specs.fission;
    session.enter('fission');
    expect(shownButtons(spec)).toEqual(['fire', 'wait', 'restart']);
    session.fire('n');
    expect(session.state.pending).not.toBeNull();
    expect(shownButtons(spec)).toEqual(['pick-heavy', 'pick-light', 'restart']);
    expect(holds(control(spec, 'electrons')!)).toBe(false);
    expect(holds(control(spec, 'card')!)).toBe(true);
    buttons(spec).find((b) => b.id === 'pick-heavy')!.onClick();
    expect(session.state).toMatchObject({ z: 56, n: 85, moves: 1, pending: null });
    expect(shownButtons(spec)).toEqual(['fire', 'wait', 'restart']);
  });

  it('never shows more than six buttons in the free lab: three rows of the action row at 1280×720', () => {
    const { session, specs } = makeLab();
    session.enter('free');
    expect(shownButtons(specs.free)).toEqual(['fire', 'gamma-n', 'gamma-p', 'wait', 'restart', 'new-start']);
    session.setElectrons(2);
    expect(shownButtons(specs.free)).toEqual(['fire', 'gamma-n', 'gamma-p', 'wait', 'neutral', 'new-start']);
    session.startFrom(92, 143); // ²³⁵U
    session.setElectrons(90);
    session.fire('n'); // a fission of an ion: the fragment choice, and «Почати знову» back
    expect(shownButtons(specs.free)).toEqual(['pick-heavy', 'pick-light', 'restart']);
    // the other steps keep «Почати знову» next to «Нейтралізувати»
    session.enter('superheavy');
    session.setElectrons(0);
    expect(shownButtons(specs.superheavy)).toEqual(['fire', 'wait', 'neutral', 'restart']);
  });

  it('shows «Нейтралізувати» only while the atom is charged', () => {
    const { session, specs } = makeLab();
    session.enter('heavy-hydrogen');
    expect(shownButtons(specs['heavy-hydrogen'])).not.toContain('neutral');
    session.setElectrons(0);
    expect(shownButtons(specs['heavy-hydrogen'])).toContain('neutral');
    buttons(specs['heavy-hydrogen']).find((b) => b.id === 'neutral')!.onClick();
    expect(session.state).toMatchObject({ electrons: 1, moves: 0 });
    expect(shownButtons(specs['heavy-hydrogen'])).not.toContain('neutral');
  });

  it('moves the charge row of the card under the electron counter and reads the board', () => {
    const { session, specs } = makeLab();
    session.enter('mercury-gold');
    const card = control<{ type: 'table'; rows: () => string[][] } & ControlSpec>(specs['mercury-gold'], 'card')!;
    expect(card.rows().map((r) => r[0])).toEqual([L.card.atom, L.card.makeup, L.card.nucleus]);
    const text = (id: string): string => {
      const readout = control<ReadoutSpec>(specs['mercury-gold'], id)!;
      return readout.text ? readout.text() : String(readout.get!());
    };
    expect([text('moves'), text('elapsed'), text('energy')]).toEqual(['0', '0\u00a0s', L.energy.unknown]);
    session.fire('n');
    expect(text('moves')).toBe('1');
    expect(text('energy')).toContain(L.energy.released);
  });

  it('announces every event: a toast and the status line; the result stays; a new run is quiet', () => {
    const { session, specs, toasts } = makeLab();
    const spec = specs['heavy-hydrogen'];
    session.enter('heavy-hydrogen');
    expect(toasts).toHaveLength(0);
    expect(statusOf(spec)).toBeNull();

    session.wait(); // ¹H is stable: refused
    expect(toasts.at(-1)).toMatchObject({ text: L.refusal.stable, tone: 'warning' });
    expect(statusOf(spec)).toBe(L.refusal.stable);

    session.fire('n');
    expect(toasts.at(-2)!.hidden).toBe(true); // the newer event replaces the older toast
    expect(toasts.at(-1)).toMatchObject({ tone: 'ok', hidden: false });
    session.setElectrons(0); // the counter is its own message: no toast
    expect(toasts.filter((t) => !t.hidden)).toHaveLength(1);

    session.setElectrons(1);
    session.fire('n');
    session.wait(); // ³H → ³He: the quest is won
    expect(toasts.at(-1)).toMatchObject({ icon: 'star', tone: 'ok', hidden: false });
    expect(toasts.at(-2)!.hidden).toBe(false); // the winning move stays readable next to the result
    const result = statusOf(spec);
    expect(result).toContain(L.quest.done);
    session.setElectrons(0);
    expect(statusOf(spec)).toBe(result);

    const before = toasts.length;
    session.restart();
    expect(toasts).toHaveLength(before);
    expect(toasts.every((t) => t.hidden)).toBe(true);
    expect(statusOf(spec)).toBeNull();
  });

  it('puts one nuclide chart on every board, then the picked line, the switch with the energy, the collection and the readouts', () => {
    const { specs } = makeLab();
    const chart = specs['heavy-hydrogen'].board!.children[0];
    for (const step of STEP_IDS) {
      const board = specs[step].board!;
      expect(board.title, step).toBe(L.chart.title);
      expect(board.children.map((c) => c.id), step).toEqual([
        // the switch and the energy share a row (a toggle and the readout after it)
        'chart', 'picked', 'full', 'energy', 'collection', 'moves', 'elapsed', 'status',
        ...(step === 'free' ? ['start-here'] : []),
      ]);
      expect(board.children[0], step).toBe(chart); // one node and one DOM widget for all twelve steps
    }
    expect(holds(control(specs.free, 'picked')!)).toBe(false); // nothing picked yet
    expect(holds(control(specs.free, 'start-here')!)).toBe(false); // so nothing to start from
  });

  it('offers «Новий старт» only in the free lab; while it is open, only the choice — until a take, a cancel or a new run', () => {
    const { lab, session, specs, values } = makeLab();
    const spec = specs.free;
    const press = (id: string): void => buttons(spec).find((b) => b.id === id)!.onClick();
    const shownControls = (): string[] => (spec.controls ?? []).filter(holds).map((c) => c.id);
    for (const step of STEP_IDS) if (step !== 'free') expect(control(specs[step], 'new-start'), step).toBeUndefined();
    session.enter('free');
    const idle = ['card', 'projectile', 'electrons', 'fire', 'gamma-n', 'gamma-p', 'wait', 'restart', 'new-start'];
    const choice = ['card', 'pick-element', 'pick-isotope', 'take-start', 'cancel-start'];
    expect(shownControls()).toEqual(idle);
    session.setElectrons(0); // a charged atom: «Нейтралізувати» takes the place of «Почати знову» (six buttons fit)…
    expect(shownControls()).toEqual([...idle.slice(0, 7), 'neutral', 'new-start']);
    press('new-start');
    expect(shownControls()).toEqual(choice); // …and gives way too
    press('cancel-start');
    expect(session.state).toMatchObject({ z: 1, n: 0, electrons: 0, moves: 0 });
    session.neutralise();
    expect(shownControls()).toEqual(idle);
    // any new run closes it: «Почати знову» (hidden meanwhile, but the session may restart), an entry, a take
    press('new-start');
    session.restart();
    expect(shownControls()).toEqual(idle);
    press('new-start');
    session.enter('sun');
    session.enter('free');
    expect(shownControls()).toEqual(idle);
    press('new-start');
    values.set('pick-element', NATURAL_Z.indexOf(79));
    control<SliderSpec>(spec, 'pick-element')!.onChange!(NATURAL_Z.indexOf(79));
    press('take-start');
    expect(session.state).toMatchObject({ z: 79, n: 118, moves: 0 });
    expect(shownControls()).toEqual(idle);
    expect(chartState(lab).picked).toBeNull();
  });

  it('counts the collection and follows the current nuclide with the window', () => {
    const { session, specs, lab } = makeLab();
    const counts = () => control<StatsSpec>(specs.radiocarbon, 'collection')!.items.map((it) => String(it.get()));
    session.enter('radiocarbon');
    expect(counts()).toEqual([`1${NBSP}/${NBSP}118`, `1${NBSP}/${NBSP}3383`]);
    const chart = control<CustomSpec>(specs.radiocarbon, 'chart')!;
    chart.update!(0);
    expect(chartState(lab)).toMatchObject({ chart: { n0: 0, z0: 1, cols: 15, rows: 11, grid: null }, picked: null });
    session.fire('n'); // ¹³C
    session.fire('n'); // ¹⁴C
    session.wait(); // ¹⁴N: a second element
    expect(counts()).toEqual([`2${NBSP}/${NBSP}118`, `4${NBSP}/${NBSP}3383`]);
    session.enter('lead-gold');
    chart.update!(0);
    expect(chartState(lab).chart).toMatchObject({ n0: 119, z0: 77 });
  });
});
