import { beforeEach, describe, expect, it } from 'vitest';
import { gateHidden, navHidden, onNavGate, resetNavGate, tickNavGate } from '../nav-gate';
import type { StepUiSpec } from '../step-ui-types';

describe('step navigator held back until a condition (stepUi nav.hiddenUntil)', () => {
  beforeEach(resetNavGate);

  it('stays hidden until the predicate first holds, then for the rest of the session', () => {
    let lit = false;
    const spec: StepUiSpec = { nav: { hiddenUntil: () => lit } };
    expect(gateHidden(spec, 'v/c/click')).toBe(true);
    lit = true;
    expect(gateHidden(spec, 'v/c/click')).toBe(false);
    lit = false; // the lamp goes off again: the navigator stays
    expect(gateHidden(spec, 'v/c/click')).toBe(false);
    expect(gateHidden(spec, 'v/c/other')).toBe(true); // per step
  });

  it("'goal' follows the step's goal; no spec, no gate", () => {
    let done = false;
    const spec: StepUiSpec = { goal: () => done, nav: { hiddenUntil: 'goal' } };
    expect(gateHidden(spec, 'k')).toBe(true);
    done = true;
    expect(gateHidden(spec, 'k')).toBe(false);
    expect(gateHidden({ nav: { hiddenUntil: 'goal' } }, 'no-goal')).toBe(false);
    expect(gateHidden(undefined, 'x')).toBe(false);
    expect(gateHidden({ controls: [] }, 'x')).toBe(false);
  });

  it('the HUD tick tells listeners about changes only', () => {
    const heard: boolean[] = [];
    const off = onNavGate((h) => heard.push(h));
    tickNavGate(null, null);
    expect(navHidden()).toBe(false);
    expect(heard).toEqual([]);
    off();
  });
});
