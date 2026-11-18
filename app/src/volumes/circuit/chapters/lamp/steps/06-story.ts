/**
 * `lamp/story` — «Перша мить». The slider «Час» of `flow/push`, continued: four equal stretches 0 · 1 ns · 1 µs · 1 ms ·
 * 0,1 s (`parts/story-path.ts`). Its position is the moment AND the camera's place, both ways, no cut:
 * (1) the switch closes, the amber push of the field runs from its contacts round the loop both ways and meets
 * itself (as `flow/push`), the camera turning toward the lamp; (2) the lens comes onto the coil and the camera goes
 * into it: the filament's atoms (tungsten's cooler shade), the free electrons already shifting all together;
 * (3) the atoms tremble more and more, the coil still dark; (4) the camera comes back out, the coil runs up the
 * incandescence scale (`filamentAfterClick`, yellow-white at ≈ 0,05 s), its light floods the board, the camera
 * stands on the stand plan. Goal: the slider at its end for a second.
 */
import { col } from '@/style';
import { LOOP, STAGE_POST, SWITCH, filamentAfterClick } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { cameraRail } from '../parts/rail';
import {
  COIL_POSE,
  MARKS,
  STORY_STOPS,
  atomsHeat,
  lensOn,
  railAt,
  secondsAt,
  waveFront,
  waveLight,
  windowOpen,
} from '../parts/story-path';
import { createHits } from '@circuit/shared/copper/hits';
import { emptyPose, mixPose } from '../parts/lens-keeper';
import { sayMoment } from '../parts/story-words';

const HOLD = 1;
/** The camera's follow of its place on the rail: natural frequency (1/s) and top speed (rail stops per second). */
const OMEGA = 7;
const V_MAX = 1.6;
const GLIDE = 0.35;
/** The whole track never glides faster than this (s): a click on the far end is a calm flight, not a jump. */
const CROSS = 6;
const FOLLOW = 0.05;
/** The window onto the filament: copper units across the glass, the electrons' cage. */
const SPAN = 14;
const LEASH = 1.7;

export const storyStep: StepFactory = ({ ctx, ui, world, lens, fly, flying, reached, reach }) => {
  const { stand, glow } = world;
  const copper = world.world.copper;
  const here = (): boolean => ctx.stage.current === 'story';
  const rail = cameraRail(ctx, STORY_STOPS);
  // chapter 5's hits: electrons of the filament running into its atoms — the atom flashes, the trembling spreads
  const hits = createHits(copper);
  hits.show = 0;
  const x = { target: 0, shown: 0, drag: false, told: -1 };
  const origin = glow.at(SWITCH.x, LOOP.near);
  const amber = col('amber');
  const tungsten = col('coral').lerp(col('sky'), 0.42);
  const copperColor = col('coral');
  const pose = emptyPose();
  let held = 0;
  /** The camera's place on its rail (stops) and its speed. */
  const cam = { p: 0, v: 0 };
  let landed = false;
  let mine = false;
  /** On the stand plan, before the first moment: the field's wave set up as `flow/push` left it, the lamp dark. */
  const arrive = (): void => {
    landed = true;
    cam.p = cam.v = 0;
    rail.snap(0);
    glow.origin = origin;
    glow.meet = origin + 0.5;
    glow.color.copy(amber);
    glow.wake = 0.22;
    glow.peak = 1.6;
    glow.edge = 0.018;
    glow.flow = 0;
    glow.front = 0;
    glow.intensity = 0;
  };
  const marks = MARKS.map((value, i) => ({ value, label: caption('story', i + 1) }));
  const format = (v: number): string =>
    v <= 0 ? caption('story', 1) : v >= 0.999 ? sayMoment(1e9, (i) => caption('story', i)) : sayMoment(secondsAt(v), (i) => caption('story', i));
  ctx.qa.expose('story', () => ({ landed, moving: ctx.camera.moving, flying: flying(), x: x.shown, seconds: secondsAt(x.shown), heat: stand.glow, rail: rail.position, held }));

  return {
    spec: {
      camera: 'stand',
      params: { closed: 0, lens: 0, lensCall: 0, window: 0, poles: 1 },
      post: STAGE_POST.stand,
    },
    ui: {
      reset: true,
      goal: () => reached('story'),
      controls: [
        {
          type: 'slider',
          id: 'time',
          label: caption('story', 0),
          min: 0,
          max: 1,
          value: 0,
          step: 0.001,
          marks,
          format,
          disabled: () => !landed,
          onChange: (v) => (x.target = v >= 0.985 ? 1 : v),
          onInput: (_v, how) => (x.drag = how === 'drag'),
        },
      ],
    },
    enter(info) {
      mine = true;
      x.target = x.shown = 0;
      x.drag = false;
      x.told = -1;
      held = 0;
      landed = false;
      lens.call = 0;
      lens.rim = 0;
      lens.glass = 1;
      world.lamp.cut = 0;
      copper.marked = -1;
      copper.sim.leash = LEASH;
      copper.sim.box.x = copper.sim.box.y = SPAN / 2 + LEASH + 0.3;
      world.world.window.span = SPAN;
      copper.lattice.color.copy(tungsten);
      if (info.instant) arrive();
      const holder = stand.tools.poses.holder;
      const along = () => mixPose(holder, COIL_POSE, lensOn(x.shown), 0.5, pose);
      if (info.instant) lens.snap(along);
      else lens.to(along, 1.4);
      if (!info.instant) fly('stand', 2.2);
      stand.setGlow(null);
    },
    leave() {
      rail.release();
      stand.setGlow(null);
      ctx.stage.setParam('window', 0, { instant: true });
    },
    update(dt) {
      if (!here()) return;
      // arriving, the lamp (lit in `handover`) cools by itself and the energy's glow melts; then the slider rules
      if (!landed && !flying() && !ctx.camera.moving) arrive();
      if (!landed) return;
      const gap = x.target - x.shown;
      const k = 1 - Math.exp(-dt / (x.drag ? FOLLOW : GLIDE));
      const most = dt / CROSS;
      x.shown += x.drag ? gap * k : Math.max(-most, Math.min(most, gap * k));
      if (Math.abs(x.shown - x.target) < 1e-4) x.shown = x.target;
      // the switch closes in the frame the time leaves 0 (the thumb's target counts)
      const t = x.target > 0 && x.shown === 0 ? Math.min(x.target, 1e-3) : x.shown;
      const closed = t > 0;
      if (closed !== stand.closed > 0.5) ctx.stage.setParam('closed', closed ? 1 : 0, { instant: true });
      stand.setGlow(closed ? filamentAfterClick(secondsAt(t)).heat : 0);
      glow.front = waveFront(t);
      glow.intensity = waveLight(t);
      copper.lattice.heat = atomsHeat(t);
      // the camera follows its place for this moment critically damped, speed-capped: a fast scrub never throws
      // it through the scene, and when the slider rests it settles exactly on the pose of that moment
      const goal = railAt(t);
      if (cam.v === 0 && Math.abs(goal - cam.p) < 1e-4) cam.p = goal;
      else {
        cam.v += (OMEGA * OMEGA * (goal - cam.p) - 2 * OMEGA * cam.v) * dt;
        cam.v = Math.max(-V_MAX, Math.min(V_MAX, cam.v));
        cam.p += cam.v * dt;
        if (Math.abs(goal - cam.p) < 1e-4 && Math.abs(cam.v) < 1e-3) {
          cam.p = goal;
          cam.v = 0;
        }
      }
      rail.place(cam.p);
      const w = windowOpen(cam.p);
      if (Math.abs(world.world.value('window') - w) > 1e-3) ctx.stage.setParam('window', w, { instant: true });
      if (Math.abs(x.shown - x.told) > 5e-4) ui.patch('time', { current: (x.told = x.shown) });
      // the end counts once the camera stands on the stand plan (script: «камера на плані „Стенд“»)
      held = landed && t >= 1 - 1e-4 && cam.v === 0 && cam.p === goal ? held + dt : 0;
      if (held >= HOLD && !reached('story')) reach('story');
    },
    late(dt) {
      if (!mine) return;
      rail.update(dt);
      // in the filament's window the free electrons hit its atoms, more often as it heats (shown only there)
      const inside = here() ? world.world.value('window') : 0;
      hits.show = inside;
      hits.flashRate = inside > 0 ? 1.5 + 4 * copper.lattice.heat : 0;
      hits.update(dt);
      // every electron of the filament shifts with the field from the first nanosecond, lamp lit or not yet
      if (here()) copper.sim.drift = stand.closed > 0.5 ? -0.06 : 0;
      if (!here()) {
        hits.show = 0;
        copper.lattice.color.copy(copperColor);
        copper.lattice.heat = 0;
        mine = false;
      }
    },
  };
};
