/**
 * Showcase scene: mounts the copper world exactly as a chapter of the volume `circuit` will and maps every
 * manifest step to one state of it (`states.ts`). No step logic beyond setting parameters.
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
// The library belongs to the volume `circuit`; this dev showcase is its only user outside that volume.

import { OUTER } from '@circuit/shared/copper/atom';
import { createCopper } from '@circuit/shared/copper/copper';
import { COPPER_LOOK_RADIUS, copperEnv, copperPost } from '@circuit/shared/copper/look';
import { mountAtHandover } from '@circuit/shared/copper/mount';
import { copperShots } from '@circuit/shared/copper/shots';

import { addInteraction } from './interact';
import { STATES, type StateId } from './states';

/** Seconds the sweep takes from depth 0 to depth 2 (and as long back). */
const SWEEP_HALF = 24;
/** Seconds at depth 0 before the sweep starts (the first frames after a deep link still settle). */
const SWEEP_HOLD = 1.5;

export default defineScene((ctx) => {
  const { stage, camera } = ctx;

  const copper = createCopper(ctx);
  ctx.root.add(copper.group);
  // exactly where the stand of `W1-circuit-stage` hands the reader over (its HANDOVER, 2026-11-16): the same
  // transform a chapter will use, so everything here is proven at that place, orientation and scale
  const scale = mountAtHandover(copper.group, {
    point: [0.99, 1.141, 1.549],
    view: [0, -0.66, -0.7513],
    axis: [1, 0, 0],
    coreRadius: 0.036,
  });
  ctx.env.setScale(COPPER_LOOK_RADIUS * scale);
  addInteraction(ctx, copper);

  camera.shots(copperShots(copper.group));
  const tween = { duration: 1.4, ease: 'power2.inOut' } as const;
  stage.param('shared', 1, { duration: 0.8, ease: 'power2.inOut', onChange: (v) => (copper.sim.shared = v) });
  stage.param('depth', 1, { ...tween, onChange: (v) => (copper.depth = v) });
  stage.param('lamp', 0, { duration: 0.9, ease: 'power2.inOut', onChange: (v) => (copper.lamp = v) });
  stage.param('apart', 0, { ...tween, onChange: (v) => (copper.atom.apart = v) });

  ctx.qa.expose('copper', () => ({
    depth: copper.depth,
    zoom: copper.space.scale.x,
    lamp: copper.lamp,
    gate: copper.sim.gate,
    selected: copper.lattice.selected,
    marked: copper.marked,
    held: copper.atom.held,
    freed: copper.atom.freed,
    atomsDrawn: copper.lattice.sites.length,
  }));
  // where things are on screen, for scripted pointer tests (`__app.locate`)
  const probe = new Vector3();
  ctx.qa.probe('nucleus', () => copper.space.localToWorld(probe.set(0, 0, 0)));
  ctx.qa.probe('neighbour-atom', () => copper.space.localToWorld(copper.lattice.positionOf(1, probe)));
  ctx.qa.probe('outer-electron', () => copper.space.localToWorld(copper.atom.electronPosition(OUTER, probe)));
  ctx.qa.probe('near-electron', () => copper.space.localToWorld(copper.atom.electronPosition(14, probe)));
  const hand = new Vector3();
  let wantMark = false;
  let sweeping = false;
  let sweepT = 0;
  const ids = Object.keys(STATES) as StateId[];
  stage.define(
    Object.fromEntries(
      ids.map((id) => {
        const s = STATES[id];
        return [
          id,
          {
            camera: s.camera,
            // the showcase has no stand above it: the room is just dark
            envTune: {
              ...copperEnv(s.lamp ?? 0, copper.group),
              top: 'bg.deep',
              mid: 'bg.void',
              bottom: 'bg.void',
              clouds: 0,
            },
            post: copperPost(s.sweep ? 1 : (s.depth ?? 1), scale),
            params: { depth: s.depth ?? 1, lamp: s.lamp ?? 0, apart: s.apart ?? 0, shared: s.shared ?? 1 },
          },
        ];
      }),
    ),
  );

  return {
    enterStep(id, info) {
      const s = STATES[id as StateId];
      copper.atom.reset();
      copper.atoms = s.atoms ?? Infinity;
      copper.marked = -1;
      copper.lattice.selected = s.selected ?? -1;
      copper.hero = s.hero ?? 0;
      wantMark = s.marked !== undefined;
      copper.look.x = s.look?.[0] ?? 0;
      copper.look.y = s.look?.[1] ?? 0;
      const g = copper.sim.gate;
      g.on = !!s.gate;
      g.x = -4.8;
      g.half = 3.3;
      g.left = g.right = 0;
      g.balance = s.gate ? 1 : 0; // no drift in this showcase: the counts keep within two
      copper.gate.shown = s.gate ? 1 : 0;
      if (s.hold) copper.atom.hold(s.hold.outer ? OUTER : s.hold.index, hand.fromArray(s.hold.to));
      sweeping = !!s.sweep;
      sweepT = -SWEEP_HOLD;
      if (s.play) {
        // the whole dive as one continuous move (the chapter will drive `depth` from its own wheel or flight)
        stage.setParam('depth', 1, { duration: 6, ease: 'sine.inOut' });
        info.scope.delay(3.2, () => camera.go('rows', { duration: 2.6 }));
        info.scope.delay(2.6, () => ctx.post.apply(copperPost(1, scale), { duration: 1.6 }));
        info.scope.delay(7, () => stage.setParam('depth', 2, { duration: 3, ease: 'sine.inOut' }));
        info.scope.delay(7, () => camera.go('atom', { duration: 3 }));
      }
      if (info.instant) copper.snap();
    },
    update(dt, t) {
      // mark the electron nearest to the middle of the frame as soon as the crowd is there
      if (wantMark && copper.marked < 0) copper.markNearest();
      // the sweep: depth runs 0 → 2 → 0 at a steady pace, the way a reader drags the chapter's scrubber
      if (sweeping) {
        sweepT += dt;
        const k = (Math.max(sweepT, 0) / SWEEP_HALF) % 2;
        copper.depth = 2 * (k < 1 ? k : 2 - k);
      }
      copper.update(dt, t);
    },
  };
});
