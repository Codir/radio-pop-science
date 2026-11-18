/**
 * `charge/signs` — «Два види заряду». Back from the lens to the table: four charged spheres, two «−» and two
 * «+», the first marks on particles in the volume. The reader slides them over the table; the nearest pair shows
 * its arrows (∝ 1 / d²). Goal: each kind of pair — «−» «−», «+» «+», «+» «−» — brought closer than two diameters
 * (there the arrows are at least twice as long as at 2√2 diameters), in any order.
 */
import { Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { BALLOON_REST, SPHERES } from '../layout';
import { createSpheres, SPHERE_R } from '../parts/spheres';
import type { RubState } from '../parts/rub-state';

/** Closer than this (centre distance in diameters) counts as «зведено». */
const MET = 2;
/** How far the spheres may be slid from the middle of their place (world units). */
const BOUNDS = { x: 3.4, z: 2.1 };

type Kind = 'minus' | 'plus' | 'mixed';

export const signsStep =
  (rub: RubState): StepFactory =>
  ({ ctx, world, reached, reach }) => {
    const spheres = createSpheres(SPHERES);
    ctx.root.add(spheres.group);
    const here = (): boolean => ctx.stage.current === 'signs';
    let landed = false;
    let present = 0;
    let since = 0;
    let held = -1;
    let hovered = -1;
    const met = new Set<Kind>();
    const hit = new Vector3();
    const up = new Vector3(0, 1, 0);
    const plane = new Vector3(0, SPHERE_R, 0);
    const grabOffset = new Vector3();
    const kindOf = (i: number, j: number): Kind => {
      const a = spheres.balls[i]!.sign;
      const b = spheres.balls[j]!.sign;
      return a !== b ? 'mixed' : a < 0 ? 'minus' : 'plus';
    };
    spheres.balls.forEach((ball, i) => {
      ctx.qa.probe(`sphere-${i}`, () => ball.pos.clone());
      ctx.input.register(ball.pick, {
        cursor: 'grab',
        enabled: () => (here() && landed && present > 0.95) || held === i,
        hover: (over) => {
          ball.hover = over ? 1 : 0;
          if (over) hovered = i;
          else if (hovered === i) hovered = -1;
        },
        dragStart: (e) => {
          held = i;
          const p = e.planePoint(up, plane, hit);
          grabOffset
            .copy(ball.pos)
            .sub(p ?? ball.pos)
            .setY(0);
        },
        drag: (e) => {
          const p = e.planePoint(up, plane, hit);
          if (!p) return;
          p.add(grabOffset);
          p.x = Math.min(Math.max(p.x, SPHERES.x - BOUNDS.x), SPHERES.x + BOUNDS.x);
          p.z = Math.min(Math.max(p.z, SPHERES.z - BOUNDS.z), SPHERES.z + BOUNDS.z);
          p.y = SPHERE_R;
          // the others are solid: the sphere in hand stops at touching
          for (const [j, o] of spheres.balls.entries()) {
            if (j === i) continue;
            const d = p.distanceTo(o.pos);
            if (d < SPHERE_R * 2.04)
              p.sub(o.pos)
                .setLength(SPHERE_R * 2.04)
                .add(o.pos);
          }
          ball.pos.lerp(p, 0.9);
        },
        dragEnd: () => {
          held = -1;
        },
      });
    });
    ctx.qa.expose('signs', () => ({
      met: [...met],
      gap: spheres.gap,
      pair: spheres.pair,
      force: spheres.force,
      at: spheres.balls.map((b) => [+(b.pos.x - SPHERES.x).toFixed(2), +(b.pos.z - SPHERES.z).toFixed(2)]),
    }));
    // the term labels go over the «−» and the «+» that lie farthest apart, above them: never over a sphere
    const farthest = (): [Vector3, Vector3] => {
      let best: [Vector3, Vector3] = [spheres.balls[0]!.pos, spheres.balls[1]!.pos];
      let d = -1;
      for (const m of spheres.balls.filter((x) => x.sign < 0))
        for (const q of spheres.balls.filter((x) => x.sign > 0))
          if (m.pos.distanceTo(q.pos) > d) [d, best] = [m.pos.distanceTo(q.pos), [m.pos, q.pos]];
      return best;
    };
    const above = (sign: 1 | -1) => (): Vector3 =>
      farthest()
        [sign < 0 ? 0 : 1].clone()
        .add(new Vector3(0, sign < 0 ? SPHERE_R * 3.4 : 0, sign < 0 ? 0 : SPHERE_R * 4.2));
    const hoverAt = (): Vector3 => {
      const b = spheres.balls[held >= 0 ? held : Math.max(hovered, 0)]!;
      return b.pos.clone().add(new Vector3(0, SPHERE_R * 1.25, 0));
    };
    const hoverSign = (): 1 | -1 => spheres.balls[held >= 0 ? held : Math.max(hovered, 0)]!.sign;

    return {
      spec: world.table('charge-spheres', { cameraMove: { duration: 2 } }),
      ui: {
        goal: () => reached('signs'),
        callouts: [
          {
            anchor: hoverAt,
            text: () => caption('signs', hoverSign() < 0 ? 0 : 1),
            side: 'up',
            visible: () => here() && !reached('signs') && (held >= 0 || hovered >= 0),
          },
          {
            anchor: above(-1),
            text: caption('signs', 2),
            side: 'up',
            visible: () => here() && reached('signs'),
          },
          {
            anchor: above(1),
            text: caption('signs', 3),
            side: 'down',
            visible: () => here() && reached('signs'),
          },
        ],
      },
      enter(info: StepInfo) {
        landed = info.instant;
        met.clear();
        held = -1;
        if (info.instant) present = 1;
        rub.hand.home = BALLOON_REST;
        rub.hand.constrain = null;
        rub.hand.enabled = () => false;
      },
      leave() {
        held = -1;
        rub.hand.home = null;
      },
      update() {
        spheres.focus = held;
        // every pair that is close counts, not only the one with arrows
        for (let i = 0; i < 4; i++)
          for (let j = i + 1; j < 4; j++)
            if (spheres.balls[i]!.pos.distanceTo(spheres.balls[j]!.pos) < MET * 2 * SPHERE_R)
              met.add(kindOf(i, j));
        if (met.size === 3 && held < 0 && !reached('signs')) reach('signs');
      },
      tick(dt, t) {
        const on = here();
        since = on ? since + dt : 0;
        landed ||= on && !ctx.camera.moving;
        // the spheres arrive while the camera comes in (one after another) and leave the same way
        present = Math.min(Math.max(present + (on && (landed || since > 1.1) ? dt : -dt) / 0.9, 0), 1);
        spheres.shown = present;
        spheres.group.visible = present > 0.002;
        if (spheres.group.visible) spheres.update(dt, t);
      },
    };
  };
