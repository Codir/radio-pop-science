/**
 * Who owns the environment and the post stack. On the stand the light rig of `shared/stage` tunes the room
 * (moon, lamp) and the step's `post` (default `STAGE_POST.stand`, the chapter base) holds. Below the stand the
 * copper world's rig (`copperEnv`) and lens (`copperPost`) take over, and the state of the circuit reaches down as
 * light (`copper.lamp` = the filament's glow). Every change is a blend, never a jump, except on a deep link.
 */
import type { ChapterContext, PostOverrides } from '@/engine/api';
import type { CircuitStage } from '@circuit/shared/stage';
import type { Copper } from '@circuit/shared/copper/copper';
import { copperEnv, copperPost } from '@circuit/shared/copper/look';

export interface WorldLook {
  /** Re-assert the owner's look after the stage applied a step (it resets env and post on every entry). */
  assert(below: boolean, opts: { instant: boolean; standPost: PostOverrides }): void;
  /** Every frame: follow the floor and the lamp; blends when the owner changes. */
  update(below: boolean, copperDepth: number, standPost: PostOverrides): void;
}

export function createLook(
  ctx: ChapterContext,
  stand: CircuitStage,
  copper: Copper,
  scale: number,
): WorldLook {
  let owner: 'stand' | 'copper' | null = null;
  let tunedLamp = -1;
  let coreLens = true;

  /**
   * The stand's light rig owns the room; below the stand it yields the environment to `copperEnv` (it re-applies
   * itself whenever the environment differs from its own values — without yielding it would take the lower floors
   * back every frame, docs/requests/W2-circuit-copper.md §5b) and takes it back with a blend.
   */
  const room = (blend: number): void => stand.light.yieldEnv(false, blend);
  const below = (duration: number): void => {
    stand.light.yieldEnv(true);
    tunedLamp = stand.glow;
    ctx.env.tune(copperEnv(tunedLamp, copper.group), { duration });
  };
  const post = (depth: number, duration: number): void => {
    coreLens = depth < 0.5;
    ctx.post.apply(copperPost(depth, scale), duration > 0 ? { duration } : { instant: true });
  };

  return {
    assert(isBelow, { instant, standPost }) {
      owner = isBelow ? 'copper' : 'stand';
      if (isBelow) {
        below(instant ? 0 : 0.9);
        post(copper.depth, instant ? 0 : 0.9);
      } else {
        room(instant ? 0 : 0.9);
        ctx.post.apply(standPost, instant ? { instant: true } : { duration: 0.9 });
      }
    },
    update(isBelow, depth, standPost) {
      const want = isBelow ? 'copper' : 'stand';
      if (want !== owner) {
        owner = want;
        if (isBelow) {
          below(1.1);
          post(depth, 1.1);
        } else {
          room(1.1);
          ctx.post.apply(standPost, { duration: 1.1 });
        }
        return;
      }
      if (!isBelow) return;
      // the lamp switched up there: the light down here follows (the rig tunes in its own small steps)
      if (Math.abs(stand.glow - tunedLamp) > 0.04) below(0.4);
      // the core's lens (almost no depth of field) gives way to the rows' (deep) once the metal dissolves
      if (coreLens !== depth < 0.5) post(depth, 1.2);
    },
  };
}
