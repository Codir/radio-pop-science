/**
 * `prologue/map` — «Одинадцять питань». The volume's own journey map inside the step (`journeyInset` of the platform:
 * the same stops, floors and minutes as «Мапа подорожі», the main line without the branches) on a board titled by the
 * caption «Мапа тому»; the stand stays behind it, pulled back and out of focus (`MAP_SHOT`, `MAP_POST`; a phone, whose
 * sheet holds the map and whose quality has no depth of field, keeps the bench's `phone`), the amplifier playing on.
 * The flight back from the scope's shot takes `MAP_FLIGHT` (the engine's 1,8 s crosses the bench too fast). A touch on
 * a stop opens its question and tells the step; the goal is three different stops opened, the prologue's own («ви тут»)
 * aside (plan decision 13 of batch E3).
 */
import { journeyInset } from '@/hud-dom/journey';
import { setSetting } from '@electronics/shared/bench';
import type { StepFactory } from '../chapter';
import { caption } from '../content';
import { AMP, IDS, KNOB } from '../parts/boards';
import { handPolicy } from '../parts/policy';
import { MAP_FLIGHT, mapShot, MAP_POST } from '../parts/shots';

const S = 'map';
/** How many stops ahead the reader opens. */
export const MAP_STOPS = 3;

export const mapStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const shoot = (): void => ctx.camera.shots({ [S]: mapShot(stand.phone()) });
  shoot();
  ctx.onResize(shoot);
  // the stops opened in this visit of the chapter (each counts once); the prologue's own is «ви тут»
  const opened = new Set<string>();
  const inset = journeyInset(ctx, {
    id: 'map-journey',
    onOpen: (id) => {
      if (id !== ctx.manifest.id) opened.add(id);
    },
  });
  ctx.qa.expose(S, () => ({ opened: [...opened], reached: reached(S) }));

  return {
    spec: { camera: S, cameraMove: { duration: MAP_FLIGHT }, params: { meter: 0, scope: 0 }, post: MAP_POST },
    ui: {
      board: { title: word(0), size: 'fill', children: [inset] },
      goal: () => reached(S),
    },
    enter() {
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, IDS.pot, KNOB.middle);
      bench.closed = 1;
      stand.play(true);
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      bench.oscilloscope.put({ ch1: null, ch2: null });
      bench.hands.policy = handPolicy(bench, { name: () => '' });
      stand.naming = { player: '', speaker: '', scope: '', tap: false };
    },
    late() {
      if (!here(S)) return;
      if (opened.size >= MAP_STOPS && !reached(S)) reach(S);
    },
  };
};
