/**
 * The goals' pure maths (`parts/goals.ts`, `steps/03-flat.ts` `newest`) and the scope's words (`parts/scope.ts`): a
 * tally counts a state only after it held, a run in a row breaks on a frame without it, the wave's verdict waits for
 * its window, breaks on a quiet stretch or at the screen's edge and is done after its seconds, the newest points of a
 * roll are those of the last frame, and the chart's axes and the dock's items say the scale with the step's words.
 */
import { describe, expect, it } from 'vitest';
import { scopeSettings } from '@electronics/shared/instruments';
import { createHold, createTally, waveVerdict } from '../parts/goals';
import { newest } from '../steps/03-flat';
import { crestText, perDivision, scopeWords, timeText, voltsText } from '../parts/scope';

const plain = (s: string): string => s.replaceAll('\u00a0', ' ');

describe('a tally and a run', () => {
  it('a state counts once it held its seconds in a row; another state or none starts the count again', () => {
    const t = createTally<'a' | 'b'>(['a', 'b'], 1);
    for (let k = 0; k < 50; k++) t.feed('a', 1 / 60);
    t.feed('b', 1 / 60);
    expect(t.done('a')).toBe(false);
    for (let k = 0; k < 61; k++) t.feed('a', 1 / 60);
    expect(t.done('a')).toBe(true);
    for (let k = 0; k < 61; k++) t.feed('b', 1 / 60);
    expect(t.all()).toBe(true);
    expect(t.counted).toEqual(['a', 'b']);
  });

  it('a run breaks on a frame without its state and stays done once it held', () => {
    const h = createHold(2);
    for (let k = 0; k < 100; k++) h.feed(true, 1 / 60);
    h.feed(false, 1 / 60);
    expect(h.held).toBe(0);
    expect(h.done).toBe(false);
    for (let k = 0; k < 121; k++) h.feed(true, 1 / 60);
    expect(h.done).toBe(true);
    h.feed(false, 1 / 60);
    expect(h.done).toBe(true);
    h.reset();
    expect(h.done).toBe(false);
  });
});

describe('the wave’s verdict', () => {
  const rules = { need: 3, window: 2, crest: 0.2, edge: 0.35 };
  it('waits for its window, needs the crest in every window after it, never the edge, and is done after its seconds', () => {
    expect(waveVerdict(1, null, 0.1, rules)).toBe('go');
    expect(waveVerdict(2, 0.25, 0.28, rules)).toBe('go');
    expect(waveVerdict(2.5, 0.15, 0.28, rules)).toBe('broke');
    expect(waveVerdict(1, 0.2, 0.36, rules)).toBe('broke');
    expect(waveVerdict(3, 0.25, 0.29, rules)).toBe('done');
    expect(waveVerdict(3, null, 0.29, rules)).toBe('broke');
  });
});

describe('the newest points of a roll', () => {
  it('are those within the last seconds before its right edge; none when nothing is drawn', () => {
    const x = Float64Array.from([-4, -2, -0.05, -0.04, -0.01, 0]);
    const v = Float32Array.from([0, 1, 8.97, 8.99, 8.98, 8.981]);
    expect(newest(6, x, v, 1 / 30)).toEqual([Math.fround(8.98), Math.fround(8.981)]);
    expect(newest(6, x, v, 0.06)).toEqual([Math.fround(8.97), Math.fround(8.99)]);
    expect(newest(0, x, v, 1)).toBeNull();
  });
});

describe('the scope’s words', () => {
  const words = { volts: 'напруга, V', time: 'час, ms', division: 'на поділку', ch1: 'Перший щуп', ch2: 'Другий щуп' };

  it('say each division as the script does: «0,5 s», «20 ms», «2,5 V», «0,02 V» — the number and the unit from the code', () => {
    expect(plain(timeText(0.5))).toBe('0,5 s');
    expect(plain(timeText(0.02))).toBe('20 ms');
    expect(plain(timeText(0.005))).toBe('5 ms');
    expect(plain(timeText(0.001))).toBe('1 ms');
    expect(plain(voltsText(2.5))).toBe('2,5 V');
    expect(plain(voltsText(0.25))).toBe('0,25 V');
    expect(plain(voltsText(0.1))).toBe('0,1 V');
    expect(plain(voltsText(0.02))).toBe('0,02 V');
    expect(plain(perDivision(voltsText(0.02), 'на поділку'))).toBe('0,02 V на поділку');
  });

  it('put the division beside each axis’ caption; channel 1 on its own scale: each title its volts a division alone', () => {
    const flat = scopeWords({ ...words, time: 'час, s', ch2: '' });
    const s = scopeSettings({ display: 'roll', timePerDiv: 0.5, voltsPerDiv: 2.5 });
    expect(plain((flat.x as (s: unknown) => string)(s))).toBe('час, s · 0,5 s на поділку');
    expect(plain((flat.y as (s: unknown) => string)(s))).toBe('напруга, V · 2,5 V на поділку');
    expect(flat.y2).toBeUndefined();
    const twice = scopeWords({ ...words, own: true });
    const one = scopeSettings({ timePerDiv: 0.001, voltsPerDiv: 0.25 });
    const zoomed = scopeSettings({ timePerDiv: 0.001, voltsPerDiv: 0.25, channelVolts: [0.02, null] });
    // one scale: the left title says it all, the right one nothing
    expect(plain((twice.y as (s: unknown) => string)(one))).toBe('напруга, V · 0,25 V на поділку');
    expect((twice.y2 as (s: unknown) => string)(one)).toBe('');
    // channel 1 on its own: each title its volts a division alone
    expect(plain((twice.y as (s: unknown) => string)(zoomed))).toBe('0,25 V');
    expect(plain((twice.y2 as (s: unknown) => string)(zoomed))).toBe('0,02 V');
    expect(plain((twice.x as (s: unknown) => string)(zoomed))).toBe('час, ms · 1 ms на поділку');
  });

  it('a crest with three decimals, «—» with nothing to read', () => {
    expect(plain(crestText(0.0605))).toMatch(/^0,06[01] V$/);
    expect(plain(crestText(0.975))).toBe('0,975 V');
    expect(crestText(null)).toBe('—');
  });
});
