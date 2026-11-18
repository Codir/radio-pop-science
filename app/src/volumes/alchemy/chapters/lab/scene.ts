/**
 * Scene of the chapter `lab`: one scene for all 12 steps. One game session holds the state; entering a step
 * starts its quest (or the free lab), the atom on stage follows every event of the session, the dock
 * (`parts/dock.ts`) is where the game is played and the board carries the nuclide chart. The event animations
 * arrive in the following tasks.
 */
import { defineScene, type StepSpec } from '@/engine/api';
import { stepUi } from '@/hud';
import { ionSymbol } from '@alchemy/sim/core';
import { nextVisit } from '@alchemy/sim/lab';
import { STEP_IDS, type StepId } from './chapter';
import { createAtomView } from './parts/atom-view';
import { announce, chartState, stepSpec, type Lab } from './parts/dock';
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
  const ui = stepUi(ctx);
  const lab: Lab = { ctx, ui, session, atom };

  // an entry shows its start itself (at once on a deep link): the run it begins is not an event to animate
  let entering = false;
  session.on((e) => {
    // the payload, not `session.state`: a queued event may be older than the session
    if (e.type === 'reset' && !entering) atom.show(e.state, false);
    else if (e.type === 'turn') atom.show(e.after, false);
    announce(lab, e);
  });

  ctx.stage.define(
    Object.fromEntries(
      STEP_IDS.map((id): [StepId, StepSpec] => [
        id,
        {
          show: [atom.group],
          camera: 'lab',
          enter(info) {
            entering = true;
            try {
              session.enter(id);
            } finally {
              entering = false;
            }
            // a deep link or the chapter entry shows the start at once; a step change lets the atom rebuild itself
            atom.show(session.state, info.instant);
          },
        },
      ]),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, stepSpec(lab, id)])));

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
      ...chartState(lab),
    };
  });
  ctx.qa.probe('lab.nucleus', atom.anchors.nucleus);
  ctx.qa.probe('lab.plate', atom.anchors.plate);

  return {
    update(dt, t) {
      session.update(dt);
      atom.setCountdown(session.countdown === null ? null : session.countdown / FLEETING_DELAY_S);
      atom.update(dt, t);
    },
  };
});
