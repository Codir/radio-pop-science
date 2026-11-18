import { describe, expect, it } from 'vitest';
import { fireAt, startGame, waitForDecay } from '../game';
import {
  countDiscovered, discover, EMPTY_PROGRESS, nextVisit, parseProgress, PROGRESS_KEY, recordBest, restoreFree,
  saveFree, serializeProgress,
} from '../progress';

describe('saved progress', () => {
  it('survives garbage and foreign data', () => {                                  // Review Focus 1
    for (const bad of [null, '', 'not json', '42', '[]', 'null', '{"discovered":"x","best":7,"free":[]}'])
      expect(parseProgress(bad)).toEqual(EMPTY_PROGRESS);
    const mixed = JSON.stringify({ discovered: ['1-0', '999-1', 7, '2-0', '1-0'],
      best: { sun: 2, nope: 1, fission: 'x', radiocarbon: -3, plutonium: 2.5 },
      free: { z: 2, n: 0, electrons: 1, elapsedSeconds: 5, moves: 2 }, rolls: 'x', extra: true });
    expect(parseProgress(mixed)).toEqual({ discovered: ['1-0'], best: { sun: 2 }, free: null, rolls: 0 });
  });

  it('keeps the key stable', () => {
    expect(PROGRESS_KEY).toBe('alchemy:v1');
  });

  it('never lets Infinity through (1e999 parses to Infinity)', () => {
    const raw = '{"free":{"z":1,"n":0,"electrons":1e999,"elapsedSeconds":1e999,"moves":1e999},"rolls":1e999,"best":{"sun":1e999}}';
    const p = parseProgress(raw);
    expect(p.rolls).toBe(0);
    expect(p.best).toEqual({});
    expect(p.free).toEqual({ z: 1, n: 0, electrons: 2, elapsedSeconds: 0, moves: 0 });
    const state = restoreFree(p);
    for (const v of [state.electrons, state.elapsedSeconds, state.moves]) expect(Number.isFinite(v)).toBe(true);
  });

  it('round-trips and counts', () => {
    let p = discover(discover(discover(EMPTY_PROGRESS, 1, 0), 1, 1), 79, 118);
    expect(discover(p, 1, 0)).toBe(p);
    expect(discover(p, 999, 1)).toBe(p);
    expect(countDiscovered(p)).toEqual({ elements: 2, nuclides: 3 });
    p = recordBest(recordBest(recordBest(p, 'sun', 4), 'sun', 2), 'sun', 3);
    expect(p.best).toEqual({ sun: 2 });
    expect(recordBest(p, 'sun', 5)).toBe(p);
    expect(parseProgress(serializeProgress(nextVisit(p)))).toEqual({ ...p, rolls: 1 });
  });

  it('restores the free lab or falls back to ¹H', () => {
    expect(restoreFree(EMPTY_PROGRESS)).toEqual(startGame(1, 0));
    const played = waitForDecay(fireAt(startGame(80, 116), 'n').state, 0.5, 0).state;   // ¹⁹⁷Au, 2 moves
    const saved = saveFree(EMPTY_PROGRESS, played);
    expect(restoreFree(saved)).toMatchObject({ z: 79, n: 118, electrons: 79, moves: 2, pending: null });
    expect(restoreFree(saved).history).toEqual([{ z: 79, n: 118 }]);
    const splitting = fireAt(startGame(92, 143), 'n').state;                              // waits for a fragment choice
    expect(saveFree(saved, splitting)).toBe(saved);
    const hacked = parseProgress(JSON.stringify({ free: { z: 1, n: 0, electrons: 99, elapsedSeconds: -1, moves: 1e99 } }));
    expect(restoreFree(hacked)).toMatchObject({ z: 1, n: 0, electrons: 2 });
    expect(Number.isFinite(restoreFree(hacked).moves) && restoreFree(hacked).elapsedSeconds >= 0).toBe(true);
  });
});
