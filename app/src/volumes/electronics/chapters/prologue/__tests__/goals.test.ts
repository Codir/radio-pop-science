/**
 * The goals' pure maths (`parts/goals.ts`) and the dock's (`parts/dock.ts`): the run of `quiet` and its crest, the
 * visits of `stand` with the half of the goal it calls, the step's crest from the first sample of its board, and when
 * the line «Звук вимкнено…» shows.
 */
import { describe, expect, it } from 'vitest';
import { HOLD, IDS, WINDOWS } from '../parts/boards';
import { soundOff, stepCrest } from '../parts/dock';
import { createRun, createTally, createVisits, type StandFrame } from '../parts/goals';

const F = 1 / 60;
const frames = (seconds: number): number => Math.round(seconds * 60);

describe('quiet: a run of 3 s and its crest', () => {
  it('counts once the run has lasted 3 s with its crest within the window; a break starts it again', () => {
    const run = createRun(HOLD.quiet, ...WINDOWS.quiet);
    for (let k = 0; k < frames(2); k++) run.feed(true, 0.055, F);
    run.feed(false, 0.055, F);
    expect(run.held).toBe(0);
    expect(run.crest).toBe(0);
    for (let k = 0; k < frames(2.9); k++) run.feed(true, 0.055, F);
    expect(run.done).toBe(false);
    for (let k = 0; k < frames(0.2); k++) run.feed(true, 0.055, F);
    expect(run.done).toBe(true);
  });

  it('a crest below the window waits; one above it never counts (another board than the player straight on)', () => {
    const low = createRun(HOLD.quiet, ...WINDOWS.quiet);
    for (let k = 0; k < frames(3.5); k++) low.feed(true, 0.04, F);
    expect(low.done).toBe(false);
    low.feed(true, 0.052, F);
    expect(low.done).toBe(true);
    const high = createRun(HOLD.quiet, ...WINDOWS.quiet);
    for (let k = 0; k < frames(4); k++) high.feed(true, k === 30 ? 0.3 : 0.055, F);
    expect(high.done).toBe(false);
  });
});

describe('stand: the visits of a part out and back', () => {
  const rules = { led: IDS.led, ledSeconds: HOLD.led, silent: WINDOWS.silent, silentSeconds: HOLD.silent, back: HOLD.back };
  const feed = (v: ReturnType<typeof createVisits>, f: StandFrame, seconds: number) => {
    for (let k = 0; k < frames(seconds); k++) v.feed(f, F);
  };
  const whole: StandFrame = { out: null, whole: true, crest: 0.8 };

  it('the LED out 1,5 s and a part that silenced the speaker, each counted after 1 s of the whole board', () => {
    const v = createVisits(rules);
    expect(v.call(IDS.pot)).toBeNull();
    feed(v, { out: 'LED1', whole: false, crest: 0.8 }, 1.6);
    expect(v.open).toMatchObject({ id: 'LED1' });
    feed(v, whole, 0.5);
    expect(v.led).toBe(false); // not back for 1 s yet
    feed(v, whole, 0.6);
    expect(v.led).toBe(true);
    expect(v.call(IDS.pot)).toBe(IDS.pot);
    // Q1 out: the crest falls under 5 mV after its knock, 1 s in a row
    feed(v, { out: 'Q1', whole: false, crest: 2.8 }, 0.6);
    feed(v, { out: 'Q1', whole: false, crest: 0.0002 }, 1.1);
    feed(v, whole, 1.1);
    expect(v.mute).toBe(true);
    expect(v.done).toBe(true);
    expect(v.call(IDS.pot)).toBeNull();
    expect(v.counted.map((x) => x.id)).toEqual(['LED1', 'Q1']);
  });

  it('too short, not silent, or taken again before the board was whole for 1 s: not counted; the LED is called first', () => {
    const v = createVisits(rules);
    feed(v, { out: 'LED1', whole: false, crest: 0.8 }, 1.2);
    feed(v, whole, 1.1);
    expect(v.led).toBe(false);
    expect(v.call(IDS.pot)).toBe(IDS.led);
    // R1 out: the speaker plays on — counted as a visit, neither half
    feed(v, { out: 'R1', whole: false, crest: 0.9 }, 2);
    feed(v, whole, 1.1);
    expect(v.mute).toBe(false);
    // P1 out, silent 1 s — then taken again within 0,5 s of its return: that visit is lost
    feed(v, { out: 'P1', whole: false, crest: 0.0001 }, 1.2);
    feed(v, whole, 0.5);
    feed(v, { out: 'C1', whole: false, crest: 0.9 }, 0.3);
    feed(v, whole, 1.1);
    expect(v.mute).toBe(false);
    // the board not the entry's (the key differs): the return does not count
    feed(v, { out: 'R5', whole: false, crest: 0.0001 }, 1.2);
    feed(v, { out: null, whole: false, crest: 0.0001 }, 2);
    expect(v.mute).toBe(false);
    feed(v, whole, 1.1);
    expect(v.mute).toBe(true);
    // a silent LED counts for the LED only
    const w = createVisits(rules);
    feed(w, { out: 'LED1', whole: false, crest: 0 }, 2);
    feed(w, whole, 1.1);
    expect([w.led, w.mute]).toEqual([true, false]);
  });
});

describe('riddle: the tally of three rows', () => {
  it('each row 2 s in a row, any order; a row left early starts again', () => {
    const t = createTally(['battery', 'player', 'speaker'] as const, HOLD.riddle);
    for (let k = 0; k < frames(1.5); k++) t.feed('player', F);
    t.feed(null, F);
    for (let k = 0; k < frames(2.05); k++) t.feed('speaker', F);
    for (let k = 0; k < frames(2.05); k++) t.feed('battery', F);
    expect(t.all()).toBe(false);
    for (let k = 0; k < frames(2.05); k++) t.feed('player', F);
    expect(t.counted).toEqual(['speaker', 'battery', 'player']);
    expect(t.all()).toBe(true);
  });
});

describe('the dock: the step’s crest and the line about the sound', () => {
  it('the crest from the first sample of the step’s board on, at most 0,5 s back; 0 before', () => {
    const asked: number[] = [];
    const peak = (s: number) => (asked.push(s), 0.9);
    expect(stepCrest(null, 0, 24000, 0.5, peak)).toBe(0);
    expect(stepCrest(48000, null, 24000, 0.5, peak)).toBe(0);
    expect(stepCrest(48000, 48000, 24000, 0.5, peak)).toBe(0);
    expect(stepCrest(48000 + 2400, 48000, 24000, 0.5, peak)).toBe(0.9);
    expect(stepCrest(96000, 48000, 24000, 0.5, peak)).toBe(0.9);
    expect(asked).toEqual([0.1, 0.5]);
    expect(stepCrest(96000, 0, 24000, 0.5, () => null)).toBe(0);
  });

  it('shows while the output is off or waits for the gesture, or the engine’s sound is off or at 0', () => {
    const on = { audio: true, volume: 0.8 };
    expect(soundOff('running', on)).toBe(false);
    expect(soundOff('suspended', on)).toBe(false);
    for (const state of ['off', 'waiting', null] as const) expect(soundOff(state, on)).toBe(true);
    expect(soundOff('running', { audio: false, volume: 0.8 })).toBe(true);
    expect(soundOff('running', { audio: true, volume: 0 })).toBe(true);
  });
});
