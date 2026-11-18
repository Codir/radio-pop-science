/**
 * Scene of the chapter `lab`: one scene for all 12 steps. One game session holds the state; entering a step
 * starts its quest (or the free lab), and the atom on stage follows every event of the session. The tools, the
 * chart and the event animations arrive in the following tasks.
 */
import { defineScene, type StepSpec } from '@/engine/api';
import { ionSymbol } from '@alchemy/sim/core';
import { nextVisit } from '@alchemy/sim/lab';
import { STEP_IDS, type StepId } from './chapter';
import { createAtomView } from './parts/atom-view';
import { FLEETING_DELAY_S, Session } from './parts/session';
import { loadProgress, saveProgress } from './parts/storage';
import { SHOTS } from './shots';

export default defineScene(async (ctx) => {
  ctx.env.setScale(6);
  ctx.camera.shots(SHOTS);

  await ctx.breathe();
  const atom = createAtomView(ctx); // packs 296 nucleon slots once (≈ 30 ms)
  ctx.root.add(atom.group);

  // every visit draws other dice: the visit counter seeds the session's random numbers (plan decision 14)
  const progress = loadProgress();
  const rng = ctx.random.fork(`visit:${progress.rolls}`);
  saveProgress(nextVisit(progress));
  const session = new Session({ random: () => rng.next(), load: loadProgress, save: saveProgress });
  session.on((e) => {
    // the payload, not `session.state`: a queued event may be older than the session
    if (e.type === 'reset') atom.show(e.state, false);
    else if (e.type === 'turn') atom.show(e.after, false);
  });

  ctx.stage.define(
    Object.fromEntries(
      STEP_IDS.map((id): [StepId, StepSpec] => [
        id,
        {
          show: [atom.group],
          camera: 'lab',
          enter(info) {
            session.enter(id);
            // a deep link shows the start at once; a step change lets the atom rebuild itself
            atom.show(session.state, info.instant);
          },
        },
      ]),
    ),
  );

  ctx.qa.expose('lab', () => {
    const s = session.state;
    return {
      step: session.step,
      z: s.z,
      n: s.n,
      electrons: s.electrons,
      moves: s.moves,
      elapsed: s.elapsedSeconds,
      done: session.done,
      best: session.best,
      pending: s.pending !== null,
      countdown: session.countdown,
      discovered: session.progress.discovered.length,
      symbol: ionSymbol(s.z, s.n, s.electrons),
    };
  });
  ctx.qa.probe('lab.nucleus', atom.anchors.nucleus);

  return {
    update(dt, t) {
      session.update(dt);
      atom.setCountdown(session.countdown === null ? null : session.countdown / FLEETING_DELAY_S);
      atom.update(dt, t);
    },
  };
});
