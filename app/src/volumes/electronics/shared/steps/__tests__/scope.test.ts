/**
 * The oscilloscope in a step's panel (`scope.ts`): the chart's axes and the dock's items say the scale with the step's
 * words — the number and the unit from the code —, a crest with three decimals, and both channels' crests side by side
 * over a step's seconds, «—» while a probe is out.
 */
import { describe, expect, it } from 'vitest';
import type { Bench } from '../../bench';
import { scopeSettings } from '../../instruments';
import { crestStats, crestText, perDivision, scopeBoard, scopeWords, timeText, voltsText } from '../scope';

const plain = (s: string): string => s.replaceAll(' ', ' ');

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
});

describe('the crests', () => {
  it('a crest with three decimals, «—» with nothing to read', () => {
    expect(plain(crestText(0.0605))).toMatch(/^0,06[01] V$/);
    expect(plain(crestText(0.975))).toBe('0,975 V');
    expect(crestText(null)).toBe('—');
  });

  it('both channels side by side in one block, each over the step’s seconds of its samples', () => {
    const asked: [number, number][] = [];
    const peaks = [0.0493, null];
    const bench = {
      oscilloscope: {
        model: {
          peak: (channel: number, seconds: number) => {
            asked.push([channel, seconds]);
            return peaks[channel] ?? null;
          },
        },
      },
    } as unknown as Bench;
    const block = crestStats(bench, 'crests', ['input', 'speaker'], 0.5);
    expect(block).toMatchObject({ type: 'stats', id: 'crests', columns: 2 });
    expect(block.items.map((i) => i.label)).toEqual(['input', 'speaker']);
    expect(block.items.map((i) => plain(String((i.get as () => string)())))).toEqual(['0,049 V', '—']);
    expect(asked).toEqual([
      [0, 0.5],
      [1, 0.5],
    ]);
  });

  it('the step’s board: its title and the bench scope’s chart with the step’s words', () => {
    const charts: [string, unknown][] = [];
    const bench = {
      oscilloscope: { chart: (id: string, w: unknown) => (charts.push([id, w]), { type: 'chart', id }) },
    } as unknown as Bench;
    const board = scopeBoard(bench, 'scope', 'Осцилограф', {
      volts: 'V',
      time: 'ms',
      division: 'на поділку',
      ch1: 'Щуп',
      ch2: '',
    });
    expect(board).toMatchObject({ title: 'Осцилограф', size: 'md', children: [{ type: 'chart', id: 'scope' }] });
    expect(charts.map(([id]) => id)).toEqual(['scope']);
    expect(charts[0]![1]).toMatchObject({ ch1: 'Щуп', ch2: '' });
  });
});
