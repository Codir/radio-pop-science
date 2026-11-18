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
});
