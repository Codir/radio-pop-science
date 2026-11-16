/**
 * Scene of the showcase «мідь у складеному світі»: `mountWorld` exactly as a chapter of `circuit` uses it, one
 * step per floor. The counter frame of `wire/restless` is set up the way the README of `shared/copper` says.
 */
import { defineScene } from '@/engine/api';
import { GATE_SHOT_X } from '@circuit/shared/copper/shots';
import { mountWorld } from '@circuit/shared/world';
import { WORLD_STEPS } from './index';

type StepId = keyof typeof WORLD_STEPS;
const CAMERA = ['stand', 'handover', 'copper-rows', 'copper-atom'] as const;

export default defineScene((ctx) => {
  const world = mountWorld(ctx);
  const { copper } = world;
  const ids = Object.keys(WORLD_STEPS) as StepId[];
  world.define(
    Object.fromEntries(
      ids.map((id) => {
        const s = WORLD_STEPS[id];
        const gate = 'gate' in s;
        return [
          id,
          {
            camera: gate ? 'copper-gate' : CAMERA[s.deep],
            params: { deep: s.deep, closed: s.closed, lens: s.deep > 0 ? 1 : 0 },
          },
        ];
      }),
    ),
  );
  ctx.qa.expose('copper', () => ({
    deep: world.deep,
    depth: copper.depth,
    lamp: copper.lamp,
    drift: copper.sim.drift,
    marked: copper.marked,
    left: copper.sim.gate.left,
    right: copper.sim.gate.right,
  }));
  let wantMark = false;
  return {
    enterStep(id, info) {
      world.enterStep(id, info);
      const gate = 'gate' in WORLD_STEPS[id as StepId];
      const g = copper.sim.gate;
      g.on = gate;
      g.x = GATE_SHOT_X;
      g.left = g.right = 0;
      // lamp off: no drift, and the wire's own balance keeps the counts together; lamp on: the drift shows
      g.balance = gate && WORLD_STEPS[id as StepId].closed === 0 ? 1 : 0;
      copper.gate.shown = gate ? 1 : 0;
      copper.marked = -1;
      wantMark = gate;
    },
    update(dt, t) {
      if (wantMark && copper.marked < 0 && copper.depth > 0.95) copper.markNearest();
      world.update(dt, t);
      // the reference for the hand-over: the stand's own core at the same pose, the copper world not drawn
      if ('standOnly' in WORLD_STEPS[ctx.stage.current as StepId]) copper.group.visible = false;
    },
  };
});
