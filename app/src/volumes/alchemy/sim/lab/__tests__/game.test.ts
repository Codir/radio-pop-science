import { describe, expect, it } from 'vitest';
import {
  autoDecay, chooseFragment, fireAt, isFleeting, knock, setElectrons, startGame, waitForDecay, waitRefusal,
} from '../game';

const at = (z: number, n: number) => startGame(z, n);

describe('game state', () => {
  it('counts moves only for transformations', () => {
    let t = fireAt(at(1, 0), 'n');
    expect(t.state).toMatchObject({ z: 1, n: 1, moves: 1, electrons: 1 });
    t = fireAt(t.state, 'n');
    t = waitForDecay(t.state, 0.5, 0);
    expect(t.event).toMatchObject({ type: 'decay', mode: 'b-', auto: false, to: { z: 2, n: 1 } });
    expect(t.state).toMatchObject({ z: 2, n: 1, moves: 3, electrons: 1 });           // 3He+: no electron added
    expect(t.state.elapsedSeconds).toBeCloseTo(388781328, -2);
    expect(t.state.history).toEqual([{ z: 1, n: 0 }, { z: 1, n: 1 }, { z: 1, n: 2 }, { z: 2, n: 1 }]);
    expect(fireAt(at(118, 176), 'ca48').state.moves).toBe(0);                        // bounce
    expect(setElectrons(at(6, 6), 3).state.moves).toBe(0);
    expect(autoDecay(at(4, 4), 0.5, 0).state).toMatchObject({ z: 2, n: 2, moves: 0 });
  });

  it('refuses to wait with a reason', () => {
    expect(waitForDecay(at(79, 118), 0.5, 0).event).toEqual({ type: 'refused', tool: 'wait', reason: 'stable' });
    expect(waitForDecay(at(82, 122), 0.5, 0).event).toMatchObject({ reason: 'notObserved' });
    expect(waitForDecay(setElectrons(at(4, 3), 0).state, 0.5, 0).event).toMatchObject({ reason: 'needsElectron' });
    expect(waitRefusal(at(79, 118))).toBe('stable');
    expect(waitRefusal(at(6, 8))).toBeNull();
  });

  it('uses up the captured electron and sheds the surplus', () => {
    const hg = waitForDecay(fireAt(at(80, 116), 'n').state, 0.5, 0);
    expect(hg.state).toMatchObject({ z: 79, n: 118, electrons: 79, shed: 0 });
    const anion = setElectrons(at(84, 126), 85).state;
    expect(waitForDecay(anion, 0.5, 0).state).toMatchObject({ z: 82, n: 124, electrons: 83, shed: 2 });
    expect(setElectrons(at(1, 0), 99).state.electrons).toBe(2);
    expect(setElectrons(at(1, 0), -5).state.electrons).toBe(0);
  });

  it('holds everything until a fragment is chosen', () => {
    const split = fireAt(at(92, 143), 'n');
    expect(split.event).toMatchObject({ type: 'fission', induced: true });
    expect(split.state).toMatchObject({ z: 92, n: 143, moves: 1, fissioned: true });
    expect(split.state.pending).not.toBeNull();
    for (const turn of [fireAt(split.state, 'n'), knock(split.state, 'n'), waitForDecay(split.state, 0.5, 0),
                        autoDecay(split.state, 0.5, 0), setElectrons(split.state, 0)]) {
      expect(turn.event).toMatchObject({ type: 'refused', reason: 'pending' });
      expect(turn.state).toBe(split.state);
    }
    const picked = chooseFragment(split.state, 'heavy');
    expect(picked.state).toMatchObject({ z: 56, n: 85, electrons: 56, pending: null, moves: 1, fissioned: true });
    expect(chooseFragment(picked.state, 'light').event).toMatchObject({ type: 'refused' });
    expect(isFleeting(split.state)).toBe(false);
  });

  it('takes the rare branch when the dice say so', () => {
    expect(waitForDecay(at(118, 176), 0.5, 0.95).event).toMatchObject({ type: 'fission', induced: false });
    expect(isFleeting(at(4, 4))).toBe(true);
    expect(isFleeting(at(6, 8))).toBe(false);
  });

  it('keeps the clock finite', () => {
    let s = at(83, 126);
    s = waitForDecay(s, 0.999999999, 0).state;
    expect(Number.isFinite(s.elapsedSeconds)).toBe(true);
  });

  it('knocks nucleons out and refuses when there is nothing to knock', () => {
    const t = knock(at(6, 6), 'n');
    expect(t.event).toMatchObject({ type: 'knockOut', what: 'n', to: { z: 6, n: 5 } });
    expect(t.state).toMatchObject({ moves: 1, electrons: 6 });
    const p = knock(setElectrons(at(6, 6), 7).state, 'p');
    expect(p.state).toMatchObject({ z: 5, n: 6, electrons: 6, shed: 1 });
    const h = at(1, 0);
    expect(knock(h, 'p').event).toEqual({ type: 'refused', tool: 'gamma-p', reason: 'noProduct' });
    expect(knock(h, 'p').state).toBe(h);
    expect(chooseFragment(h, 'heavy').event).toEqual({ type: 'refused', tool: 'fragment', reason: 'noProduct' });
  });
});
