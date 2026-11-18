import { Object3D, PerspectiveCamera, type InstancedBufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng, type ChapterContext } from '@/engine/api';
import type { Orbs } from '@/fx';
import { chooseFragment, fireAt, knock, setElectrons, startGame, waitForDecay, type GameState, type Turn } from '@alchemy/sim/lab';
import { createFissionDrop } from '@alchemy/shared/fission-drop';
import type { AtomView } from '../parts/atom-view';
import { createDecayFx, DECAY } from '../parts/decay-fx';
import { Clip, createEmitter, SHOT, type EventFx } from '../parts/emitter';
import { createFissionView, FISSION } from '../parts/fission-view';
import type { SessionEvent } from '../parts/session';

/** The little of the chapter context the animations use; registered pointer handlers are kept for the test. */
function makeCtx() {
  const handlers: { object: Object3D; click?: () => void; enabled?: () => boolean }[] = [];
  const ctx = {
    reducedMotion: false,
    random: new Rng(3),
    input: {
      register: (object: Object3D, h: { click?: () => void; enabled?: () => boolean }) => {
        handlers.push({ object, ...h });
        return () => undefined;
      },
    },
    camera: { camera: new PerspectiveCamera() },
  } as unknown as ChapterContext;
  return { ctx, handlers };
}

const turn = (before: GameState, t: Turn): SessionEvent => ({ type: 'turn', event: t.event, before, after: t.state });
const RESET: SessionEvent = { type: 'reset', state: startGame(1, 0) };

/** Plays `e` on `fx`, counting impacts; `run(seconds)` moves the engine clock in 1/60 s frames. */
function stage(fx: EventFx, e: SessionEvent) {
  let impacts = 0;
  let t = 0;
  fx.play(e, () => impacts++);
  return {
    impacts: () => impacts,
    run(seconds: number): void {
      for (let k = 0; k < Math.round(seconds * 60); k++) fx.update(1 / 60, (t += 1 / 60));
    },
  };
}

describe('Clip', () => {
  it('fires its impact once, at its moment; finish fires a pending one; a dropped one never fires', () => {
    let n = 0;
    const clip = new Clip(0.5, 1, () => n++);
    clip.advance(0.49);
    expect(n).toBe(0);
    clip.advance(0.02);
    clip.advance(0.3);
    clip.finish();
    expect(n).toBe(1);
    expect(clip.done).toBe(true);
    const dropped = new Clip(0.5, 1, () => n++);
    dropped.drop();
    dropped.finish();
    expect(n).toBe(1);
  });
});

describe('emitter', () => {
  const h1 = startGame(1, 0);

  it('a captured neutron reaches the nucleus after the flight, sinks in, and the emitter is free again', () => {
    const emitter = createEmitter(makeCtx().ctx);
    const s = stage(emitter, turn(h1, fireAt(h1, 'n')));
    s.run(SHOT.flight - 0.05);
    expect([s.impacts(), emitter.busy]).toEqual([0, true]);
    s.run(0.1);
    expect(s.impacts()).toBe(1);
    s.run(0.2);
    expect([s.impacts(), emitter.busy]).toEqual([1, false]);
  });

  it('a bounce turns at the nucleus (the moment it is told) and flies away; a γ quantum arrives later', () => {
    const h7 = startGame(1, 6);
    const emitter = createEmitter(makeCtx().ctx);
    const bounce = stage(emitter, turn(h7, fireAt(h7, 'n')));
    bounce.run(SHOT.flight + 0.02);
    expect([bounce.impacts(), emitter.busy]).toEqual([1, true]);
    bounce.run(SHOT.bounce);
    expect(emitter.busy).toBe(false);
    const pb = startGame(82, 126);
    const gamma = stage(emitter, turn(pb, knock(pb, 'p')));
    gamma.run(SHOT.gamma - 0.05);
    expect(gamma.impacts()).toBe(0);
    gamma.run(0.1);
    expect(gamma.impacts()).toBe(1);
  });

  it('has nothing to show for other events: their impact is at once', () => {
    const emitter = createEmitter(makeCtx().ctx);
    const s = stage(emitter, turn(h1, setElectrons(h1, 0)));
    expect([s.impacts(), emitter.busy]).toEqual([1, false]);
  });

  it('skip: the impact fires now, once; a reset drops it without firing', () => {
    const emitter = createEmitter(makeCtx().ctx);
    const skipped = stage(emitter, turn(h1, fireAt(h1, 'n')));
    emitter.skip();
    emitter.skip();
    skipped.run(1);
    expect([skipped.impacts(), emitter.busy]).toEqual([1, false]);
    const dropped = stage(emitter, turn(h1, fireAt(h1, 'n')));
    dropped.run(0.2);
    let resetImpact = 0;
    emitter.play(RESET, () => resetImpact++);
    dropped.run(1);
    expect([dropped.impacts(), resetImpact, emitter.busy]).toEqual([0, 1, false]);
  });
});

describe('decay particles', () => {
  const lent: number[] = [];
  const shells = new Object3D();
  shells.position.set(-2, 2, 0);
  const atom = {
    coreRadius: 0.5,
    anchors: { nucleus: new Object3D(), shells, plate: new Object3D(), countdown: new Object3D() },
    lendElectrons: (k: number) => lent.push(k),
  } as unknown as AtomView;

  it('β⁻: the nucleus changes as the electron leaves; the electron flies for a while', () => {
    const h3 = startGame(1, 2);
    const fx = createDecayFx(makeCtx().ctx, atom);
    const s = stage(fx, turn(h3, waitForDecay(h3, 0.5, 0.5)));
    expect([s.impacts(), fx.busy]).toEqual([1, true]);
    s.run(DECAY.fly + 0.05);
    expect(fx.busy).toBe(false);
  });

  it('electron capture: an outer electron is lent by the shells and the nucleus changes when it arrives', () => {
    const hg = startGame(80, 117);
    const t = waitForDecay(hg, 0.5, 0.5);
    expect(t.event.type === 'decay' && t.event.mode).toBe('ec');
    const fx = createDecayFx(makeCtx().ctx, atom);
    lent.length = 0;
    const s = stage(fx, turn(hg, t));
    expect([s.impacts(), lent]).toEqual([0, [1]]);
    s.run(DECAY.fall - 0.05);
    expect(s.impacts()).toBe(0);
    s.run(0.1);
    expect(s.impacts()).toBe(1);
  });

  it('flies every particle of the busiest event: β⁻ with four neutrons and four surplus electrons', () => {
    const before = startGame(3, 8);
    const after = { ...before, z: 4, n: 3, shed: 4 };
    const e: SessionEvent = {
      type: 'turn', before, after,
      event: { type: 'decay', mode: 'b-4n', from: { z: 3, n: 8 }, to: { z: 4, n: 3 }, seconds: 0.01, q: null, auto: false },
    };
    const fx = createDecayFx(makeCtx().ctx, atom);
    const s = stage(fx, e);
    s.run(0.3);
    const drawn = fx.group.children.filter((c) => c.name.startsWith('orbs:')).reduce((sum, c) => sum + (c as Orbs).instances, 0);
    expect([s.impacts(), drawn]).toEqual([1, 9]);
    s.run(1);
    expect(fx.busy).toBe(false);
  });

  it('a plain capture only flashes and holds nothing up; a reset drops a pending capture of an electron', () => {
    const h1 = startGame(1, 0);
    const fx = createDecayFx(makeCtx().ctx, atom);
    const plain = stage(fx, turn(h1, fireAt(h1, 'n')));
    expect([plain.impacts(), fx.busy]).toEqual([1, false]);
    const hg = startGame(80, 117);
    const s = stage(fx, turn(hg, waitForDecay(hg, 0.5, 0.5)));
    s.run(0.2);
    fx.play(RESET, () => undefined);
    s.run(1);
    expect([s.impacts(), fx.busy]).toEqual([0, false]);
  });
});

describe('fission view', () => {
  const u235 = startGame(92, 143);
  const split = fireAt(u235, 'n');
  const fission = turn(u235, split);
  const heavy = turn(split.state, chooseFragment(split.state, 'heavy'));

  it('the drop tears at its impact; the fragments then hang, named, waiting for a pick', () => {
    const view = createFissionView(makeCtx().ctx, () => undefined);
    const s = stage(view, fission);
    s.run(FISSION.tremble - 0.05);
    expect([s.impacts(), view.choosing, view.anchors.heavy.visible]).toEqual([0, false, false]);
    s.run(0.1);
    expect(s.impacts()).toBe(1);
    s.run(FISSION.tear + 0.2);
    expect([view.busy, view.choosing, view.anchors.heavy.visible, view.anchors.light.visible]).toEqual([false, true, true, true]);
    expect([view.label('heavy'), view.label('light')]).toEqual(['¹⁴¹Ba', '⁹²Kr']);
  });

  it('a click on a hanging fragment picks it; the picked one then becomes the atom and the pair leaves', () => {
    const { ctx, handlers } = makeCtx();
    const picks: string[] = [];
    const view = createFissionView(ctx, (which) => picks.push(which));
    const clickOn = (which: 'heavy' | 'light'): void => {
      const h = handlers.find((x) => x.object === view.anchors[which])!;
      if (h.enabled?.() !== false) h.click?.();
    };
    const s = stage(view, fission);
    clickOn('heavy'); // still trembling: nothing to pick yet
    s.run(2);
    clickOn('light');
    expect(picks).toEqual(['light']);
    const pick = stage(view, heavy);
    expect(view.choosing).toBe(false);
    pick.run(0.4);
    expect(pick.impacts()).toBe(0);
    pick.run(0.1);
    expect(pick.impacts()).toBe(1);
    pick.run(0.5);
    expect([view.busy, view.anchors.heavy.visible, view.label('heavy')]).toEqual([false, false, '']);
  });

  it('skip goes straight to the choice; a reset clears the fragments and drops the pending impact', () => {
    const view = createFissionView(makeCtx().ctx, () => undefined);
    const skipped = stage(view, fission);
    view.skip();
    expect([skipped.impacts(), view.busy, view.choosing]).toEqual([1, false, true]);
    view.play(RESET, () => undefined);
    expect([view.choosing, view.anchors.heavy.visible, view.label('light')]).toEqual([false, false, '']);
    const dropped = stage(view, fission);
    dropped.run(0.5);
    view.play(RESET, () => undefined);
    dropped.run(2);
    expect([dropped.impacts(), view.busy, view.choosing]).toEqual([0, false, false]);
  });
});

describe('fission drop', () => {
  /** Positions and sizes of a swarm's drawn orbs. */
  const orbs = (o: Orbs): { x: number; k: number }[] => {
    const inst = o.geometry.getAttribute('aInst') as InstancedBufferAttribute;
    return Array.from({ length: o.instances }, (_, i) => ({ x: inst.getX(i), k: inst.getW(i) }));
  };

  it('deals ²³⁵U + n into ¹⁴¹Ba (left) + ⁹²Kr (right) + 3 free neutrons', () => {
    const drop = createFissionDrop(118, 179);
    drop.deal({ z: 92, a: 236, heavy: { z: 56, a: 141 }, freed: 3 });
    expect([drop.protons.instances, drop.neutrons.instances, drop.freed.length]).toEqual([92, 144, 3]);
    drop.pose({ wobble: 0, stretch: 1, heavy: drop.centroids.heavy.clone().setX(-20), light: drop.centroids.light.clone().setX(20), split: 1 }, 0);
    const p = orbs(drop.protons);
    const n = orbs(drop.neutrons).filter((o) => o.k > 0);
    expect([p.filter((o) => o.x < 0).length, p.filter((o) => o.x > 0).length]).toEqual([56, 36]);
    expect([n.filter((o) => o.x < 0).length, n.filter((o) => o.x > 0).length]).toEqual([85, 56]);
    expect(drop.fragmentRadius.heavy).toBeGreaterThan(drop.fragmentRadius.light);
  });

  it('can fade one fragment while the other stays', () => {
    const drop = createFissionDrop(118, 179);
    drop.deal({ z: 92, a: 236, heavy: { z: 56, a: 141 }, freed: 3 });
    drop.pose({ wobble: 0, stretch: 1, heavy: drop.centroids.heavy.clone().setX(-20), light: drop.centroids.light.clone().setX(20), split: 1, scale: { heavy: 1, light: 0 } }, 0);
    const p = orbs(drop.protons);
    expect(p.filter((o) => o.k > 0).every((o) => o.x < 0)).toBe(true);
    expect(p.filter((o) => o.k > 0).length).toBe(56);
  });
});
