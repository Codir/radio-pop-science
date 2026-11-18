/**
 * Scene of the chapter `lab`: one scene for all 12 steps. One game session holds the state; entering a step
 * starts its quest (or the free lab), the dock (`parts/dock.ts`) is where the game is played and the board carries
 * the nuclide chart. The atom on stage shows what the session did, through the event animations: the emitter
 * (`parts/emitter.ts`: projectiles, γ quanta, bounces), the particles that leave or fall into the nucleus
 * (`parts/decay-fx.ts`) and the fission with its fragment choice (`parts/fission-view.ts`).
 *
 * The model has already changed when an event arrives; the animations only show it. Events wait in a queue and
 * play one after another, each from its own payload (never `session.state`). The atom switches to the event's
 * new state at the moment the animation reaches the nucleus, and the dock speaks then too (toast, status line,
 * sound — `announce`); refusals, electron changes and quest results have nothing to animate and speak as soon as
 * it is their turn. When more than two events are waiting (presses faster than the pictures) or the reader asked
 * for reduced motion, everything jumps to the final picture at once (`skip`). A new run (an entry, «Почати
 * знову») drops the queue and stops every animation, with no late callback; a deep-link entry shows its start at
 * once. The dock, the chart and `__app.read('lab')` follow the model itself, at the click.
 */
import { defineScene, type StepSpec } from '@/engine/api';
import { stepUi } from '@/hud';
import { ionSymbol } from '@alchemy/sim/core';
import { isFleeting, nextVisit, type GameState } from '@alchemy/sim/lab';
import { STEP_IDS, type StepId } from './chapter';
import { createAtomView } from './parts/atom-view';
import { createDecayFx } from './parts/decay-fx';
import { announce, chartState, hasEmitter, loaded, stepSpec, type Lab } from './parts/dock';
import { createEmitter, type EventFx } from './parts/emitter';
import { createFissionView } from './parts/fission-view';
import { FLEETING_DELAY_S, Session, type SessionEvent } from './parts/session';
import { loadProgress, saveProgress } from './parts/storage';
import { SHOTS } from './shots';

/** More events than this waiting behind the one on show: skip to the final picture. */
const MAX_WAITING = 2;

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

  const emitter = createEmitter(ctx);
  const decay = createDecayFx(ctx, atom);
  // a fragment picked in the scene is the same move as the dock's button (a choice already made does nothing)
  const fission = createFissionView(ctx, (which) => {
    if (session.state.pending !== null) session.pickFragment(which);
  });
  const fxs: readonly EventFx[] = [emitter, decay, fission];
  for (const fx of fxs) ctx.root.add(fx.group);
  const lab: Lab = { ctx, ui, session, atom, fx: { emitter: emitter.anchor, fission } };

  /** What the atom shows: the state of the last event that reached the nucleus. */
  let shown: GameState = session.state;
  const display = (state: GameState, instant: boolean): void => {
    shown = state;
    atom.show(state, instant);
  };

  /** Plays one event: the atom changes and the dock speaks when the animation reaches the nucleus. */
  function start(e: SessionEvent): void {
    if (e.type !== 'turn') {
      announce(lab, e);
      return;
    }
    const change = (): void => display(e.after, false);
    const tell = (): void => announce(lab, e);
    const both = (): void => {
      change();
      tell();
    };
    switch (e.event.type) {
      case 'capture':
      case 'knockOut':
        emitter.play(e, () => decay.play(e, both));
        break;
      case 'bounce':
        emitter.play(e, tell);
        break;
      case 'decay':
        decay.play(e, both);
        break;
      case 'fission': {
        // the nucleus becomes the drop (the atom steps aside) at the hit; the split is announced when it tears
        const split = (): void => {
          change();
          fission.play(e, tell);
        };
        if (e.event.induced) emitter.play(e, split);
        else split();
        break;
      }
      case 'fragment':
        fission.play(e, both);
        break;
      default:
        both(); // electrons, refusals: nothing flies
    }
  }

  const queue: SessionEvent[] = [];
  const busy = (): boolean => fxs.some((fx) => fx.busy);
  /** Starts waiting events while nothing plays. */
  function pump(): void {
    while (!busy() && queue.length > 0) start(queue.shift()!);
  }
  /** Everything on show and waiting, at once: final atom, plate, status and toasts, each event told once. */
  function rush(): void {
    do {
      for (const fx of fxs) fx.skip(); // a skipped impact may start the next part (emitter → decay / fission)
      while (!busy() && queue.length > 0) start(queue.shift()!);
    } while (busy());
  }

  // an entry shows its start itself (at once on a deep link): the run it begins is not an event to animate
  let entering = false;
  session.on((e) => {
    // the payload, not `session.state`: a queued event may be older than the session
    if (e.type === 'reset') {
      // a new run: nothing of the old one plays on, no late callback fires
      queue.length = 0;
      for (const fx of fxs) fx.play(e, () => undefined);
      if (!entering) display(e.state, false);
      announce(lab, e);
      return;
    }
    queue.push(e);
    if (queue.length > MAX_WAITING || ctx.reducedMotion) rush();
    else pump();
  });

  ctx.stage.define(
    Object.fromEntries(
      STEP_IDS.map((id): [StepId, StepSpec] => [
        id,
        {
          show: hasEmitter(id) ? [atom.group, emitter.device] : [atom.group],
          camera: 'lab',
          enter(info) {
            entering = true;
            try {
              session.enter(id);
            } finally {
              entering = false;
            }
            // a deep link or the chapter entry shows the start at once; a step change lets the atom rebuild itself
            display(session.state, info.instant);
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
      /** An event animation is playing or waiting (the model above is already final). */
      busy: busy() || queue.length > 0,
      ...chartState(lab),
    };
  });
  ctx.qa.probe('lab.nucleus', atom.anchors.nucleus);
  ctx.qa.probe('lab.plate', atom.anchors.plate);
  ctx.qa.probe('lab.emitter', emitter.anchor, { origin: true });
  ctx.qa.probe('lab.fragment.heavy', fission.anchors.heavy, { origin: true });
  ctx.qa.probe('lab.fragment.light', fission.anchors.light, { origin: true });

  return {
    update(dt, t) {
      session.update(dt);
      emitter.load(loaded(lab));
      emitter.nucleusRadius = fission.nucleusRadius = atom.coreRadius;
      for (const fx of fxs) fx.update(dt, t);
      pump();
      // the ring follows the countdown of the nucleus on stage: while the atom still shows a fleeting nucleus the
      // model has already left (a shot in flight), it holds; it goes when the atom moves on
      if (shown === session.state) atom.setCountdown(session.countdown === null ? null : session.countdown / FLEETING_DELAY_S);
      else if (!isFleeting(shown)) atom.setCountdown(null);
      atom.update(dt, t);
    },
  };
});
