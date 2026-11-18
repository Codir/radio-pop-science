import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import type { ButtonSpec, ControlSpec, NoteSpec, ReadoutSpec, SegmentedSpec, StepUiApi, StepUiSpec } from '@/hud';
import { ALL_TOOLS, EMPTY_PROGRESS, PROJECTILES, questById } from '@alchemy/sim/lab';
import { STEP_IDS, type StepId } from '../chapter';
import { L } from '../labels';
import type { AtomView } from '../parts/atom-view';
import { announce, stepSpec, type Lab } from '../parts/dock';
import { Session } from '../parts/session';

interface Toast { readonly text: string; readonly tone?: string; readonly icon?: string; hidden: boolean }

/** A lab with a real session and a step UI that only records what it is asked to do. */
function makeLab() {
  const toasts: Toast[] = [];
  const values = new Map<string, string>();
  const ui = {
    define: () => undefined,
    value: (id: string) => values.get(id),
    set: (id: string, v: string) => values.set(id, v),
    onChange: () => undefined,
    press: () => undefined,
    patch: () => undefined,
    toast: (text: string, opts?: { tone?: string; icon?: string }) => {
      const t: Toast = { text, tone: opts?.tone, icon: opts?.icon, hidden: false };
      toasts.push(t);
      return () => { t.hidden = true; };
    },
  } as unknown as StepUiApi<StepId>;
  const anchor = new Object3D();
  const atom = { anchors: { nucleus: anchor, shells: anchor, plate: anchor } } as unknown as AtomView;
  const session = new Session({ random: () => 0.5, load: () => EMPTY_PROGRESS, save: () => undefined });
  const lab: Lab = { ctx: {} as ChapterContext, ui, session, atom };
  session.on((e) => announce(lab, e));
  const specs = Object.fromEntries(STEP_IDS.map((id) => [id, stepSpec(lab, id)])) as Record<StepId, StepUiSpec>;
  return { lab, session, toasts, values, specs };
}

const holds = (c: ControlSpec): boolean => (typeof c.visible === 'function' ? c.visible() : c.visible !== false);
const control = <T extends ControlSpec>(spec: StepUiSpec, id: string): T | undefined =>
  [...(spec.controls ?? []), ...(spec.board?.children ?? [])].find((c) => c.id === id) as T | undefined;
const buttons = (spec: StepUiSpec): ButtonSpec[] => (spec.controls ?? []).filter((c): c is ButtonSpec => c.type === 'button');
const shownButtons = (spec: StepUiSpec): string[] => buttons(spec).filter(holds).map((b) => b.id);
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
      ];
      expect(buttons(specs[step]).map((b) => b.id), step).toEqual(want);
      const choice = control<SegmentedSpec>(specs[step], 'projectile');
      if (projectiles.length > 1) expect(choice?.items, step).toEqual(projectiles.map((p) => ({ id: p.id, label: p.symbol })));
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

  it('carries the honesty chips of every step', () => {
    const { specs } = makeLab();
    const texts = (step: StepId) =>
      (specs[step].honesty ?? []).map((h) => (typeof h === 'string' ? h : 'slowed' in h ? `slowed ${h.slowed.toExponential()}` : h.text));
    expect(texts('heavy-hydrogen')).toEqual(['simplified', 'notToScale', L.honesty.waitSkipped]);
    expect(texts('fission')).toEqual(['simplified', 'notToScale', L.honesty.waitSkipped, 'illustrative']);
    expect(texts('star-forge')).toEqual(['simplified', 'notToScale', L.honesty.waitSkipped, 'slowed 1e+15']);
    expect(texts('free')).toEqual(['simplified', 'notToScale', L.honesty.waitSkipped, 'illustrative', 'slowed 1e+15']);
    const slowed = specs.sun.honesty!.find((h) => typeof h !== 'string' && 'slowed' in h) as { text: string };
    expect(slowed.text).toBe(`${L.honesty.fleeting} 2\u00a0s`);
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
});
