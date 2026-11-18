import { describe, expect, it } from 'vitest';
import { ALL_TOOLS, EMPTY_PROGRESS } from '@alchemy/sim/lab';
import type { Progress } from '@alchemy/sim/lab';
import { Session } from '../parts/session';
import type { SessionEvent } from '../parts/session';

const make = (saved: Progress = EMPTY_PROGRESS, rolls: number[] = [0.5, 0]) => {
  let stored = saved;
  let i = 0;
  const session = new Session({ random: () => rolls[i++ % rolls.length]!, load: () => stored, save: (p) => { stored = p; } });
  return { session, stored: () => stored };
};

describe('Session', () => {
  it('resets a quest on every entry', () => {
    const { session } = make();
    session.enter('heavy-hydrogen'); session.fire('n');
    expect(session.state).toMatchObject({ z: 1, n: 1, moves: 1 });
    session.enter('radiocarbon');
    expect(session.state).toMatchObject({ z: 6, n: 6, moves: 0 });
    session.enter('heavy-hydrogen');
    expect(session.state).toMatchObject({ z: 1, n: 0, moves: 0 });
  });

  it('offers only the tools of the quest', () => {
    const { session } = make();
    session.enter('heavy-hydrogen');
    expect([session.allowed('n'), session.allowed('wait'), session.allowed('p'), session.allowed('gamma-n')]).toEqual([true, true, false, false]);
    const seen: SessionEvent[] = [];
    session.on((e) => seen.push(e));
    const before = session.state;
    session.fire('p');
    expect(session.state).toBe(before);
    expect(seen).toMatchObject([{ type: 'turn', event: { type: 'refused', tool: 'p', reason: 'noProduct' } }]);
    session.enter('free');
    expect(ALL_TOOLS.every((t) => session.allowed(t))).toBe(true);
  });

  it('completes a quest once and remembers the best', () => {
    const { session, stored } = make();
    const seen: SessionEvent[] = [];
    session.on((e) => seen.push(e));
    session.enter('heavy-hydrogen'); session.fire('n'); session.fire('n'); session.wait();
    expect(session).toMatchObject({ done: true, best: 3 });
    expect(seen.filter((e) => e.type === 'done')).toEqual([{ type: 'done', moves: 3, best: 3, improved: true }]);
    expect(stored().best).toEqual({ 'heavy-hydrogen': 3 });
    session.restart();
    expect(session).toMatchObject({ done: false, best: 3 });
    expect(session.state.moves).toBe(0);
  });

  it('lets a fleeting nucleus live two seconds', () => {
    const { session } = make();
    session.enter('star-forge'); session.fire('alpha');
    expect(session.state).toMatchObject({ z: 4, n: 4 });
    expect(session.countdown).toBeCloseTo(2, 6);
    session.update(1.9);
    expect(session.state.z).toBe(4);
    session.update(0.2);
    expect(session.state).toMatchObject({ z: 2, n: 2, moves: 1 });
    expect(session.countdown).toBeNull();
  });

  it('applies the shot, not the decay, when both fall into one frame', () => {
    const { session } = make();
    session.enter('star-forge'); session.fire('alpha'); session.update(1.99);
    session.fire('alpha'); session.update(0.5);
    expect(session.state).toMatchObject({ z: 6, n: 6, moves: 2 });
    expect(session.done).toBe(true);
  });

  it('drops the countdown and a pending fission when the step is left', () => {
    const { session } = make();
    session.enter('star-forge'); session.fire('alpha'); session.enter('uranium-chain'); session.update(5);
    expect(session.state).toMatchObject({ z: 92, n: 146, moves: 0 });
    expect(session.countdown).toBeNull();
    session.enter('fission'); session.fire('n');
    expect(session.state.pending).not.toBeNull();
    session.enter('fission');
    expect(session.state).toMatchObject({ z: 92, n: 143, pending: null, moves: 0 });
  });

  it('walks down from oganesson one countdown at a time', () => {
    const { session } = make();
    session.enter('superheavy'); session.fire('ca48');
    expect(session.done).toBe(true);
    session.update(2.1);
    expect(session.state).toMatchObject({ z: 116, n: 174, moves: 1 });
    expect(session.countdown).toBeCloseTo(2, 6);
  });

  it('keeps the free lab and the collection across sessions', () => {
    const first = make();
    first.session.enter('free'); first.session.fire('n');
    expect(first.stored().free).toMatchObject({ z: 1, n: 1 });
    expect(first.stored().discovered).toEqual(['1-0', '1-1']);
    const second = make(first.stored());
    second.session.enter('free');
    expect(second.session.state).toMatchObject({ z: 1, n: 1, moves: 1 });
  });

  it('starts the free lab only from a natural nuclide', () => {
    const { session } = make();
    session.enter('free');
    expect(session.startFrom(79, 118)).toBe(true);
    expect(session.state).toMatchObject({ z: 79, n: 118, moves: 0 });
    expect(session.startFrom(43, 56)).toBe(false);
    session.enter('sun');
    expect(session.startFrom(79, 118)).toBe(false);
  });

  it('plays on when saving fails', () => {
    const session = new Session({ random: () => 0.5, load: () => EMPTY_PROGRESS, save: () => { throw new Error('quota'); } });
    session.enter('free');
    expect(() => session.fire('n')).not.toThrow();
    expect(session.state.n).toBe(1);
  });

  it('plays on when loading fails', () => {
    const session = new Session({ random: () => 0.5, load: () => { throw new Error('denied'); }, save: () => {} });
    expect(session.progress).toEqual(EMPTY_PROGRESS);
    session.enter('free');
    expect(session.state).toMatchObject({ z: 1, n: 0 });
  });

  it('keeps a bare fleeting atom still until electrons return', () => {
    const saved: Progress = { ...EMPTY_PROGRESS, free: { z: 34, n: 32, electrons: 0, elapsedSeconds: 0, moves: 0 } };
    const { session } = make(saved);
    const seen: SessionEvent[] = [];
    session.on((e) => seen.push(e));
    session.enter('free');
    seen.length = 0;
    expect(session.countdown).toBeNull();
    const before = session.state;
    session.update(5);
    expect(session.state).toBe(before);
    expect(seen).toEqual([]);
    session.setElectrons(34);
    expect(session.countdown).toBeCloseTo(2, 6);
    session.update(2.1);
    expect(session.state).not.toMatchObject({ z: 34, n: 32 });
    expect(session.state.moves).toBe(0);
  });

  it('ignores a bad frame time', () => {
    const { session } = make();
    session.enter('star-forge'); session.fire('alpha');
    session.update(Number.NaN); session.update(-1); session.update(Number.POSITIVE_INFINITY);
    expect(session.countdown).toBeCloseTo(2, 6);
  });

  it('reports the energy of the latest transformation', () => {
    const { session } = make();
    session.enter('heavy-hydrogen');
    expect(session.lastQ).toBeNull();
    session.fire('n');
    expect(session.lastQ).not.toBeNull();
    session.restart();
    expect(session.lastQ).toBeNull();
  });

  describe('re-entrant listeners', () => {
    it('delivers every event in order when a listener acts', () => {
      const { session } = make();
      const a: string[] = [];
      const b: string[] = [];
      const name = (e: SessionEvent) => (e.type === 'turn' ? e.event.type : e.type);
      session.on((e) => { a.push(name(e)); if (e.type === 'turn' && e.event.type === 'fission') session.pickFragment('heavy'); });
      session.on((e) => b.push(name(e)));
      session.enter('fission'); session.fire('n');
      expect(a).toEqual(['reset', 'fission', 'fragment']);
      expect(b).toEqual(a);
    });

    it('emits done once and records the best even if a listener fires on the completing turn', () => {
      const { session, stored } = make();
      const seen: SessionEvent[] = [];
      let fired = false;
      session.on((e) => {
        seen.push(e);
        if (e.type === 'turn' && e.after.z === 2 && e.after.n === 1 && !fired) { fired = true; session.fire('n'); }
      });
      session.enter('heavy-hydrogen'); session.fire('n'); session.fire('n'); session.wait();
      expect(seen.filter((e) => e.type === 'done')).toEqual([{ type: 'done', moves: 3, best: 3, improved: true }]);
      expect(stored().best).toEqual({ 'heavy-hydrogen': 3 });
    });

    it('shows final values to a listener of the completing turn', () => {
      const { session } = make();
      const seen: [boolean, number | null][] = [];
      session.on((e) => { if (e.type === 'turn' && e.after.z === 2 && e.after.n === 1) seen.push([session.done, session.best]); });
      session.enter('heavy-hydrogen'); session.fire('n'); session.fire('n'); session.wait();
      expect(seen).toEqual([[true, 3]]);
    });

    it('queues events when a listener changes the step', () => {
      const { session } = make();
      const seen: string[] = [];
      let jumped = false;
      session.on((e) => {
        seen.push(e.type);
        if (e.type === 'turn' && !jumped) { jumped = true; session.enter('radiocarbon'); }
      });
      session.enter('heavy-hydrogen'); seen.length = 0;
      session.fire('n');
      expect(seen).toEqual(['turn', 'reset']);
      expect(session.step).toBe('radiocarbon');
      expect(session.state).toMatchObject({ z: 6, n: 6, moves: 0 });
    });

    it('delivers turn and done to every listener even if one throws, then rethrows', () => {
      const { session } = make();
      const first: string[] = [];
      const second: string[] = [];
      session.on((e) => { first.push(e.type); if (e.type === 'turn' && e.event.type === 'decay') throw new Error('boom'); });
      session.on((e) => second.push(e.type));
      session.enter('heavy-hydrogen'); session.fire('n'); session.fire('n');
      first.length = 0; second.length = 0;
      expect(() => session.wait()).toThrow('boom');
      expect(first).toEqual(['turn', 'done']);
      expect(second).toEqual(['turn', 'done']);
      session.restart();
      second.length = 0;
      session.fire('n'); // still usable
      expect(second).toEqual(['turn']);
    });

    it('does not call a listener removed during delivery', () => {
      const { session } = make();
      let second = 0;
      let off = (): void => {};
      session.on(() => off());
      off = session.on(() => { second++; });
      session.enter('free'); session.fire('n');
      expect(second).toBe(0);
    });
  });

  it('throws no dice for a refused wait and two, lifetime first, for a real one', () => {
    const calls: number[] = [];
    const roll = (values: number[]) => { let i = 0; return () => { const v = values[i++ % values.length]!; calls.push(v); return v; }; };
    const refused = new Session({ random: roll([0.5, 0]), load: () => EMPTY_PROGRESS, save: () => {} });
    refused.enter('heavy-hydrogen');
    refused.wait();
    expect(calls).toEqual([]);
    const og = new Session({ random: roll([0.5, 0.95]), load: () => EMPTY_PROGRESS, save: () => {} });
    og.enter('superheavy'); og.fire('ca48');
    og.wait();
    expect(calls).toEqual([0.5, 0.95]);
    expect(og.state.pending).not.toBeNull();   // 0.95 picked the fission branch, so the order was not swapped
  });

  it('emits reset for entry, restart and a successful startFrom only', () => {
    const { session } = make();
    const seen: string[] = [];
    session.on((e) => seen.push(e.type));
    session.enter('free');
    session.startFrom(79, 118);
    session.startFrom(43, 56);
    session.restart();
    expect(seen).toEqual(['reset', 'reset', 'reset']);
  });

  it('reports improved only when the best gets smaller', () => {
    const { session } = make();
    const done: SessionEvent[] = [];
    session.on((e) => { if (e.type === 'done') done.push(e); });
    for (let run = 0; run < 2; run++) {
      session.enter('heavy-hydrogen'); session.fire('n'); session.fire('n'); session.wait();
    }
    expect(done).toEqual([
      { type: 'done', moves: 3, best: 3, improved: true },
      { type: 'done', moves: 3, best: 3, improved: false },
    ]);
    expect(session.best).toBe(3);
  });

  it('saves an electron change in the free lab', () => {
    const { session, stored } = make();
    session.enter('free');
    session.setElectrons(0);
    expect(stored().free?.electrons).toBe(0);
  });

  it('leaves the state alone when a tool is fired during a fission choice', () => {
    const { session } = make();
    session.enter('fission'); session.fire('n');
    const state = session.state;
    session.fire('n');
    session.wait();
    expect(session.state).toBe(state);
    expect(session.state.moves).toBe(1);
  });
});
