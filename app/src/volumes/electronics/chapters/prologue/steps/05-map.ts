/**
 * `prologue/map` — «Одинадцять питань». The volume's own journey map inside the step (`journeyInset` of the platform:
 * the same stops, floors and minutes as «Мапа подорожі», the main line without the branches) on a board titled by the
 * caption «Мапа тому»; the amplifier plays on. Where the board is drawn over the scene (the desktop shell) the stand
 * stays behind it, pulled back and out of focus (`MAP_SHOT`, `MAP_POST`); where the board is in the sheet's board tab
 * (a phone, a tablet) the scene beside the sheet is the bench's shot (`stand`, a phone's `phone`) with the bench's own
 * post, no blur of the step's — the step's post is applied on entry and on a resize (a rotation, the reader's desktop
 * shell), as the shot is. The flight back from the scope's shot takes `MAP_FLIGHT` (the engine's 1,8 s crosses
 * the bench too fast). A touch on a stop opens its question and tells the step; the goal is three different stops
 * opened, the prologue's own («ви тут») aside (plan decision 13 of batch E3).
 */
import { journeyInset } from '@/hud-dom/journey';
import { setSetting } from '@electronics/shared/bench';
import { handPolicy } from '@electronics/shared/steps';
import type { StepFactory } from '../chapter';
import { caption } from '../content';
import { AMP, IDS, KNOB } from '../parts/boards';
import { boardOnCanvas, MAP_FLIGHT, mapPost, mapShot } from '../parts/shots';

const S = 'map';
/** How many stops ahead the reader opens. */
export const MAP_STOPS = 3;

export const mapStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const shoot = (): void => ctx.camera.shots({ [S]: mapShot(ctx.device.formFactor) });
  shoot();
  ctx.onResize(() => {
    shoot();
    if (here(S)) ctx.post.apply(mapPost(ctx.device.formFactor), { duration: 0.4 });
  });
  // the stops opened in this visit of the chapter (each counts once); the prologue's own is «ви тут»
  const opened = new Set<string>();
  const inset = journeyInset(ctx, {
    id: 'map-journey',
    onOpen: (id) => {
      if (id !== ctx.manifest.id) opened.add(id);
    },
  });
  ctx.qa.expose(S, () => ({
    opened: [...opened],
    reached: reached(S),
    canvas: boardOnCanvas(ctx.device.formFactor),
    dof: ctx.post.params.dofAperture,
  }));

  return {
    spec: { camera: S, cameraMove: { duration: MAP_FLIGHT }, params: { meter: 0, scope: 0 } },
    ui: {
      board: { title: word(0), size: 'fill', children: [inset] },
      goal: () => reached(S),
    },
    enter(info) {
      ctx.post.apply(mapPost(ctx.device.formFactor), { instant: info.instant });
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, IDS.pot, KNOB.middle);
      bench.closed = 1;
      stand.play(true);
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.hands.policy = handPolicy(bench, { name: () => '' });
      stand.naming = { meter: '' };
    },
    late() {
      if (!here(S)) return;
      if (opened.size >= MAP_STOPS && !reached(S)) reach(S);
    },
  };
};
