import { describe, expect, it } from 'vitest';
import { clockFrom, holdFor } from '../clock';

describe('riddle: the true-time clock', () => {
  const clock = clockFrom('2 хв 16 с');
  it('prints seconds alone below a minute and minutes with seconds above', () => {
    expect(clock.format(0)).toBe('0 с');
    expect(clock.format(45.4)).toBe('45 с');
    expect(clock.format(136.4)).toBe('2 хв 16 с');
  });
  it('never prints a negative time', () => {
    expect(clock.format(-3)).toBe('0 с');
  });
});

describe('riddle: the goal holds after a second at the end', () => {
  it('needs the condition for the whole second and starts again when it breaks', () => {
    const hold = holdFor(1);
    expect(hold.update(true, 0.6)).toBe(false);
    expect(hold.update(false, 0.1)).toBe(false);
    expect(hold.update(true, 0.6)).toBe(false);
    expect(hold.update(true, 0.5)).toBe(true);
  });
});
