import { describe, expect, it, vi } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { bindingOf, stepUi, type StepUiBinding } from '../step-ui';

/** A chapter context with just what `stepUi` reads. */
function ctx(id: string): ChapterContext {
  return {
    manifest: { volume: 'test', id, steps: [{ id: 'a' }, { id: 'b' }] },
    onDispose: () => undefined,
  } as unknown as ChapterContext;
}

/** The hooks a view (the WebGL or the DOM dock) installs while its controls are on screen. */
function view(b: StepUiBinding): { push: ReturnType<typeof vi.fn>; repatch: ReturnType<typeof vi.fn>; flash: ReturnType<typeof vi.fn> } {
  const v = { push: vi.fn(), repatch: vi.fn(), flash: vi.fn() };
  Object.assign(b, v);
  return v;
}

describe('step-UI binding (what both docks implement)', () => {
  it('set: the widget follows, nothing is notified unless asked', () => {
    const ui = stepUi(ctx('set'));
    const changed = vi.fn();
    const own = vi.fn();
    ui.define({ a: { controls: [{ type: 'slider', id: 'R', label: 'R', min: 0, max: 10, value: 2, onChange: own }] } });
    ui.onChange('R', changed);
    const v = view(bindingOf('test/set')!);
    ui.set('R', 20);
    expect(ui.value('R')).toBe(10); // clamped to the range
    expect(v.push).toHaveBeenCalledWith('R', 10);
    expect(changed).not.toHaveBeenCalled();
    ui.set('R', 4, { notify: true });
    expect(own).toHaveBeenCalledWith(4);
    expect(changed).toHaveBeenCalledWith(4);
  });

  it('press: flash on screen, then the onClick', () => {
    const ui = stepUi(ctx('press'));
    const order: string[] = [];
    ui.define({ a: { controls: [{ type: 'button', id: 'go', label: 'Go', onClick: () => order.push('click') }] } });
    const v = view(bindingOf('test/press')!);
    v.flash.mockImplementation(() => order.push('flash'));
    ui.press('go');
    expect(order).toEqual(['flash', 'click']);
    expect(() => ui.press('nope')).toThrow();
  });

  it('patch: live label / range / disabled reach the view; a value outside the new range is clamped silently', () => {
    const ui = stepUi(ctx('patch'));
    const changed = vi.fn();
    ui.define({ a: { controls: [{ type: 'slider', id: 'U', label: 'U', min: 0, max: 5, value: 4 }] } });
    ui.onChange('U', changed);
    const b = bindingOf('test/patch')!;
    const v = view(b);
    ui.patch('U', { max: 3, label: 'U, NMC', disabled: true });
    expect(b.patches.get('U')).toEqual({ max: 3, label: 'U, NMC', disabled: true });
    expect(v.repatch).toHaveBeenCalledWith('U');
    expect(ui.value('U')).toBe(3);
    expect(v.push).toHaveBeenCalledWith('U', 3);
    expect(changed).not.toHaveBeenCalled();
  });

  it('values live across steps; defaults of every declared control', () => {
    const ui = stepUi(ctx('vals'));
    ui.define({
      a: { controls: [{ type: 'toggle', id: 't', label: 'T' }] },
      b: { controls: [{ type: 'segmented', id: 's', items: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }] }] },
    });
    expect(ui.value<boolean>('t')).toBe(false);
    expect(ui.value<string>('s')).toBe('x');
    expect(() => ui.define({ zz: {} } as never)).toThrow();
  });
});
