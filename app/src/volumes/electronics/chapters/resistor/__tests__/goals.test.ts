/** The goals' small maths (`parts/goals.ts`): rows of sockets, rows in any order, and the tally of held readings. */
import { describe, expect, it } from 'vitest';
import { createLayout } from '@electronics/sim/board';
import { HOLD, across, createTally, rowsOf, sameRows, within } from '../parts/goals';
import { kindOf } from '../parts/policy';

const layout = createLayout();

describe('rows of the goals', () => {
  it('gives the rows of sockets in their order, null with one out of a socket or off the board', () => {
    expect(rowsOf(layout, ['b5', 'e9'])).toEqual(['5ae', '9ae']);
    expect(rowsOf(layout, ['+3', 'j10', '-1'])).toEqual(['+', '10fj', '-']);
    expect(rowsOf(layout, ['b5', null])).toBeNull();
    expect(rowsOf(layout, ['z9'])).toBeNull();
  });

  it('matches two rows in any order; one row in each of two sides', () => {
    expect(sameRows(['9ae', '5ae'], ['5ae', '9ae'])).toBe(true);
    expect(sameRows(['5ae', '5ae'], ['5ae', '9ae'])).toBe(false);
    expect(sameRows(null, ['5ae', '9ae'])).toBe(false);
    expect(across(['10ae', '+'], ['+', '5ae'], ['-', '10ae'])).toBe(true);
    expect(across(['5ae', '+'], ['+', '5ae'], ['-', '10ae'])).toBe(false);
    expect(within(null, 0, 1)).toBe(false);
    expect(within(Number.NaN, 0, 1)).toBe(false);
    expect(within(0.5, 0, 1)).toBe(true);
  });

  it('names the kinds the chapter tells apart', () => {
    expect(kindOf('resistor-4k7')).toBe('resistor');
    expect(kindOf('led-red')).toBe('led');
    expect(kindOf('jumper')).toBe('jumper');
    expect(kindOf('diode-1n4007')).toBe('other');
  });
});

describe('the tally of held readings', () => {
  it('counts a reading once it held for its time in a row; another reading or none starts the time again', () => {
    expect(HOLD.reading).toBe(1);
    const t = createTally(['a', 'b'] as const, 1);
    for (let k = 0; k < 50; k++) t.feed('a', 1 / 60);
    expect(t.done('a')).toBe(false);
    t.feed(null, 1 / 60);
    expect(t.holding).toBe(0);
    for (let k = 0; k < 59; k++) t.feed('a', 1 / 60);
    expect(t.done('a')).toBe(false);
    t.feed('a', 1 / 60);
    expect(t.done('a')).toBe(true);
    // b interrupts nothing that counted; a counted stays counted
    for (let k = 0; k < 30; k++) t.feed('b', 1 / 60);
    t.feed('a', 1 / 60);
    for (let k = 0; k < 59; k++) t.feed('b', 1 / 60);
    expect(t.done('b')).toBe(false);
    t.feed('b', 1 / 60);
    expect(t.done('b')).toBe(true);
    expect(t.all()).toBe(true);
    expect(t.counted).toEqual(['a', 'b']);
    // a held frame (dt 0) adds nothing; reset forgets
    t.reset();
    for (let k = 0; k < 100; k++) t.feed('a', 0);
    expect(t.done('a')).toBe(false);
    expect(t.counted).toEqual([]);
  });
});
