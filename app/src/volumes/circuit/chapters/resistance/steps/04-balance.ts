/**
 * `balance` — «Хто стримує найбільше». The wire is short again, the frame on the far wire shows «0,30 A». The lens
 * lies on the near wire as a window, with the hit strip on its rim (`shared/copper/hit-lens.ts`). The reader
 * carries it round the loop (`parts/lens-track.ts`: it sticks to the wire and settles on the parts and terminals):
 * over the wires and the switch the strip is barely there (≈ 2 %), over the battery a little more (≈ 4 %), over
 * the lamp it is full and pulses `orange`, and the glass is frosted (chapter 6 looks inside). Goal: a second each on
 * the wire from the minus, the wire from the plus, the switch and the lamp. 3.5 s after the takeaway the lens goes
 * back to its holder: the chapter ends on the stand shot with the lamp on.
 */
import { Mesh, MeshBasicMaterial, CircleGeometry, Quaternion, Vector3 } from 'three';
import { BATTERY, LOOP, boardToWorld, worldToBoard, type LensPose } from '@circuit/shared/stage';
import { createHitLens } from '@circuit/shared/copper/hit-lens';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { lensTrack, type Place, type Under } from '../parts/lens-track';
import { wireLensPose } from '../parts/poses';
import { glide } from '../parts/glide';

/** Seconds on each place the goal asks for, and the places. */
const DWELL = 1;
const GOAL_PLACES: readonly Place[] = ['minus', 'plus', 'switch', 'lamp'];
/** The strip's fill over each place (script: wires and switch ≈ 2 %, battery ≈ 4 %, the lamp full). */
const FILL = { wire: 0.02, battery: 0.04, lamp: 1 } as const;
/** Where the lens lies on entry: the near wire between the plus clamp and the switch. */
const START_X = (BATTERY.plusX + 1.12) / 2;
/** The lens: its size and lift over a wire, and over the lamp (it covers the globe there). */
const SCALE = 1.15;
const LAMP_SCALE = 1.55;
const LAMP_HEIGHT = 1.0;
/** How quickly the lens follows the hand along the track (s) and the most it may move along it per frame. */
const FOLLOW = 0.07;
const REACH = 0.06;
/** Seconds after the takeaway before the lens goes home. */
const HOME_AFTER = 3.5;
/** Seconds the strip's caption stays on entry. */
const NAME_FOR = 3;

export const balanceStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { stage, world, hits } = stand;
  const lens = stage.tools.lens;
  const strip = createHitLens();
  lens.group.add(strip.group);
  const track = lensTrack();
  const stripShown = glide(0);
  const under: Under = { battery: 0, switch: 0, lamp: 0, place: 'plus' };
  const pose: LensPose = wireLensPose(START_X, LOOP.near, SCALE);
  const start = track.uOf(START_X, LOOP.near);
  let hand = start;
  let u = start;
  let held = false;
  let fill = FILL.wire;
  let frost = 0;
  let named = 0;
  let home = -1;
  let gone = false;
  /** The window is closed under the frost (it opens again as the glass clears). */
  let frosted = false;
  const dwell = new Map<Place, number>();
  const p = new Vector3();
  const up = new Vector3();
  const through = new Vector3();
  const hitPoint = new Vector3();
  const q = new Quaternion();
  const top = new Vector3();
  // the lens is taken anywhere on its glass or ring: an invisible disc a little larger than the ring
  const hit = new Mesh(
    new CircleGeometry(0.6, 32),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'resistance-lens-hit';
  lens.group.add(hit);
  const ready = (): boolean =>
    here('balance') && !world.flying && !gone && world.value('lens') > 0.99 && stripShown.value > 0.9;

  ctx.input.register(hit, {
    cursor: 'grab',
    enabled: ready,
    dragStart: () => (held = true),
    drag: (e) => {
      if (!held) return;
      up.set(0, 1, 0).applyQuaternion(stage.base.frame.getWorldQuaternion(q));
      boardToWorld(0, LOOP.y, 0, through);
      if (!e.planePoint(up, through, hitPoint)) return;
      worldToBoard(hitPoint, p);
      hand = track.nearest(p, hand, REACH * 2);
    },
    dragEnd: () => (held = false),
  });
  ctx.qa.probe('lens-hit', hit);
  for (const [name, x, z] of [
    ['place-minus', LOOP.left, 0],
    ['place-plus', LOOP.right, 0.3],
    ['place-switch', 1.56, LOOP.near],
    ['place-lamp', LOOP.right - 0.12, LOOP.far + 0.12],
    ['place-battery', BATTERY.x, LOOP.near],
  ] as const)
    ctx.qa.probe(name, () => boardToWorld(x, LOOP.y, z));
  // QA: 25 points round the loop from the lens's start, the electrons' way back to it (for drags along the loop)
  for (let k = 0; k <= 24; k++)
    ctx.qa.probe(`loop-${k}`, () => stage.base.frame.localToWorld(track.at(start - k / 24, new Vector3())));
  ctx.qa.expose('balance', () => ({
    u: Math.round(u * 1000) / 1000,
    place: under.place,
    fill: Math.round(fill * 1000) / 1000,
    frost: Math.round(frost * 100) / 100,
    dwell: Object.fromEntries([...dwell].map(([k, v]) => [k, Math.round(v * 10) / 10])),
    held,
    gone,
  }));

  const place = (dt: number): void => {
    u = u + (((((hand - u + 0.5) % 1) + 1) % 1) - 0.5) * (1 - Math.exp(-dt / FOLLOW));
    u = ((u % 1) + 1) % 1;
    const shown = track.sticky(u);
    track.under(shown, under);
    track.at(shown, p);
    const lamp = under.lamp * under.lamp * (3 - 2 * under.lamp);
    wireLensPose(p.x, p.z, SCALE + (LAMP_SCALE - SCALE) * lamp, 1.5, pose, p.y + (LAMP_HEIGHT - p.y) * lamp);
  };

  return {
    spec: { camera: 'stand', params: { deep: 0, closed: 1, lens: 1, window: 1, poles: 1 } },
    ui: {
      goal: () => reached('balance'),
      callouts: [
        {
          anchor: () => lens.group.localToWorld(top.set(0, 0.62, 0)),
          text: caption('balance', 0),
          side: 'up',
          visible: () => here('balance') && ready() && named < NAME_FOR,
        },
        {
          // on a phone the frame's own print would be under 14 px: its number stands in the interface instead
          anchor: () => stand.frameTop(new Vector3()),
          text: () => stand.frameText,
          side: 'up',
          visible: () =>
            here('balance') &&
            ctx.device.formFactor === 'phone' &&
            stand.frameText !== '' &&
            !reached('balance'),
        },
        {
          // the balance itself: what the whole circuit lets through
          anchor: () => boardToWorld(0, 0.9, -0.1, new Vector3()),
          text: caption('balance', 1),
          side: 'up',
          visible: () => here('balance') && reached('balance') && home > 0,
        },
      ],
    },
    enter(info) {
      held = false;
      named = 0;
      home = -1;
      gone = false;
      dwell.clear();
      frosted = false;
      hand = u = start;
      stand.thermoShown.go(0, info.instant ? 0 : 0.5);
      stand.heat.target = 0;
      stand.frameShown.go(1, info.instant ? 0 : 0.8);
      stand.window(info.instant);
      hits.flashRate = 1.2;
      place(0);
      world.lensPose = pose;
      stripShown.go(1, info.instant ? 0 : 1.2);
    },
    leave() {
      held = false;
      stripShown.go(0, 0.5);
      hits.flashRate = 0;
    },
    update(dt, t) {
      if (!gone) place(dt);
      if (ready()) named += dt;
      const fillWant =
        FILL.wire + (FILL.battery - FILL.wire) * under.battery + (FILL.lamp - FILL.wire) * under.lamp;
      fill += (fillWant - fill) * (1 - Math.exp(-dt / 0.35));
      // over the battery and the lamp the glass is frosted. The window onto the copper closes FIRST (quickly, while
      // the lens still lies over the wire beside the part), and the frost comes only as far as the window is shut:
      // no copper atom ever shows through the frost. Leaving, the frost clears first, then the window opens.
      const cover = Math.max(under.lamp, under.battery);
      frost += (cover - frost) * (1 - Math.exp(-dt / 0.15));
      if (here('balance') && !gone) {
        if (cover > 0.15 && !frosted) {
          frosted = true;
          ctx.stage.setParam('window', 0, { duration: 0.22 });
        } else if (cover < 0.08 && frost < 0.04 && frosted) {
          frosted = false;
          ctx.stage.setParam('window', 1, { duration: 0.3 });
        }
      }
      const glass = Math.min(frost, 1 - world.value('window'));
      if (ready()) {
        // a place counts while the lens lies there (in the hand or let go)
        dwell.set(under.place, (dwell.get(under.place) ?? 0) + dt);
        if (GOAL_PLACES.every((k) => (dwell.get(k) ?? 0) >= DWELL) && !reached('balance')) reach('balance');
      }
      if (reached('balance') && home < 0 && !gone) home = HOME_AFTER;
      if (home > 0 && (home -= dt) <= 0) {
        // the chapter's last frame: the lens back in its holder, the stand as the neighbours have it
        gone = true;
        held = false;
        stripShown.go(0, 0.8);
        ctx.stage.setParam('lens', 0, { duration: 1.6, ease: 'power2.inOut' });
        ctx.stage.setParam('window', 0, { duration: 0.8 });
      }
      strip.shown = stripShown.update(dt);
      strip.fill = fill;
      strip.frost = gone ? glass * strip.shown : glass;
      strip.light = 0.55 + 0.45 * stage.glow;
      strip.update(dt, t);
    },
  };
};
