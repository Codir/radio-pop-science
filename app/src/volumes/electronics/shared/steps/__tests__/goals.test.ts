/**
 * The goals' small maths (`goals.ts`): rows of sockets, rows in any order, the tally of held readings and a run of time
 * in a row.
 */
import { describe, expect, it } from 'vitest';
import { createLayout } from '@electronics/sim/board';
import { across, createHold, createTally, rowOf, rowsOf, sameRows, within } from '../goals';

const layout = createLayout();

describe('rows of the goals', () => {
  it('gives the rows of sockets in their order, null with one out of a socket or off the board', () => {
    expect(rowsOf(layout, ['b5', 'e9'])).toEqual(['5ae', '9ae']);
    expect(rowsOf(layout, ['+3', 'j10', '-1'])).toEqual(['+', '10fj', '-']);
    expect(rowsOf(layout, ['b5', null])).toBeNull();
    expect(rowsOf(layout, ['z9'])).toBeNull();
    // one socket's row (a probe's): null with it out or off the board
    expect(rowOf(layout, 'd13')).toBe('13ae');
    expect(rowOf(layout, '+4')).toBe('+');
    expect(rowOf(layout, null)).toBeNull();
    expect(rowOf(layout, 'z9')).toBeNull();
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
});

describe('the tally of held readings', () => {
  it('counts a reading once it held for its time in a row; another reading or none starts the time again', () => {
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

  it('takes its time from the chapter: 2 s needs twice the frames of 1 s', () => {
    const t = createTally(['a'] as const, 2);
    for (let k = 0; k < 119; k++) t.feed('a', 1 / 60);
    expect(t.done('a')).toBe(false);
    t.feed('a', 1 / 60);
    expect(t.done('a')).toBe(true);
    // a key the tally does not hold is never counted
    t.feed('z' as 'a', 5);
    expect(t.counted).toEqual(['a']);
  });
});

describe('a run of time in a row', () => {
  it('breaks on a frame without its state, is done once it held its seconds and stays done until reset', () => {
    const h = createHold(2);
    for (let k = 0; k < 100; k++) h.feed(true, 1 / 60);
    h.feed(false, 1 / 60);
    expect(h.held).toBe(0);
    expect(h.done).toBe(false);
    for (let k = 0; k < 119; k++) h.feed(true, 1 / 60);
    expect(h.done).toBe(false);
    h.feed(true, 1 / 60);
    expect(h.done).toBe(true);
    h.feed(false, 1 / 60);
    expect(h.done).toBe(true);
    // restart: the run counts again from 0, what held stays done; reset forgets it
    h.feed(true, 0.5);
    h.restart();
    expect(h.held).toBe(0);
    expect(h.done).toBe(true);
    h.reset();
    expect(h.done).toBe(false);
    // a held frame (dt 0) adds nothing
    for (let k = 0; k < 100; k++) h.feed(true, 0);
    expect(h.held).toBe(0);
  });
});
