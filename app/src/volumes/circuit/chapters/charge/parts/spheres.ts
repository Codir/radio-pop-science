/**
 * Four charged spheres on the table (`charge/signs`; VISUAL §5 «дві кулі зі стрілками», §7 `charge-field/coulomb`):
 * the size of the balloon, matte, two «−» (`cyan`) and two «+» (`coral`) — the first marks on particles in the
 * volume (VISUAL §4). The reader slides them over the table; the two that are nearest each other get a thick
 * `amber` arrow each, toward the other or away from it, its length ∝ 1 / d² (capped to stay in the frame).
 * Spheres keep where they are put (the table holds them). Each has an invisible pick ball and a soft contact shadow.
 */
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, Vector3 } from 'three';
import { createOrbs, ORB_STYLES, type OrbStyle } from '@/fx';
import { createArrow, type Arrow } from './arrow';

export const SPHERE_R = 0.46;
/** Arrow length at a distance of one diameter, and the cap. Length = K / (d / 2R)², so at 2 diameters it is K / 4. */
const ARROW_K = 3.2;
const ARROW_MAX = 1.25;
/** Arrows show for the nearest pair while it is closer than this (centre distance, in diameters). */
const SHOW_WITHIN = 3.2;
const SHOWN_FROM = 2.75;

const style = (sign: 1 | -1): OrbStyle => ({
  ...ORB_STYLES.blob,
  color: sign > 0 ? 'coral' : 'cyan',
  shade: sign > 0 ? 'coral.dark' : 'cyan.dark',
  selfLit: 0.12,
  intensity: 0.9,
  gloss: 0.08,
  rim: 0.6,
  glyph: sign > 0 ? 'plus' : 'minus',
  glyphColor: 'white',
  glyphSize: 0.5,
  shimmer: 0,
});

export function softShadow(rgb = '0,0,0'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, `rgba(${rgb},0.75)`);
  r.addColorStop(0.55, `rgba(${rgb},0.35)`);
  r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

export interface Ball {
  sign: 1 | -1;
  /** Centre on the table (y = radius), world. */
  pos: Vector3;
  pick: Mesh;
  hover: number;
}

export interface Spheres {
  group: Group;
  balls: Ball[];
  /** The sphere in the reader's hand (its arrows show), −1 = none. */
  focus: number;
  /** 0…1 presence (they grow in on entry and shrink away on leaving, one after another). */
  shown: number;
  /** The pair with arrows now (indices) and their centre distance in diameters. */
  readonly pair: readonly [number, number];
  readonly gap: number;
  /** Arrow length of each of the nearest pair now (world units). */
  readonly force: number;
  update(dt: number, t: number): void;
}

export function createSpheres(centre: Vector3): Spheres {
  const group = new Group();
  group.name = 'charge-spheres';
  const signs: (1 | -1)[] = [-1, 1, -1, 1];
  // a rectangle of 3.5 × 3: every pair starts more than three diameters apart, before any arrow shows
  const start = [
    [-1.75, -1.5],
    [1.75, -1.5],
    [1.75, 1.5],
    [-1.75, 1.5],
  ];
  const tex = softShadow();
  const pickMat = new MeshBasicMaterial({ visible: false });
  const balls: Ball[] = signs.map((sign, i) => {
    const pos = new Vector3(centre.x + start[i]![0]!, SPHERE_R, centre.z + start[i]![1]!);
    const pick = new Mesh(new SphereGeometry(SPHERE_R * 1.15, 12, 8), pickMat);
    pick.name = `charge-sphere-${i}`;
    group.add(pick);
    return { sign, pos, pick, hover: 0 };
  });
  const minus = createOrbs({ kind: style(-1), count: 2, radius: SPHERE_R, halo: false });
  const plus = createOrbs({ kind: style(1), count: 2, radius: SPHERE_R, halo: false });
  const shadows = balls.map(() => {
    const m = new Mesh(
      new PlaneGeometry(SPHERE_R * 3.2, SPHERE_R * 3.2),
      new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = -1;
    group.add(m);
    return m;
  });
  const arrows: [Arrow, Arrow] = [createArrow(0.075, 0.32), createArrow(0.075, 0.32)];
  group.add(minus, plus, arrows[0].group, arrows[1].group);
  let pair: [number, number] = [0, 1];
  /** The pair the arrows are drawn on: a new nearest pair takes them only after they faded off the old one. */
  let drawn: [number, number] = [0, 1];
  let gap = Infinity;
  let force = 0;
  let shownForce = 0;
  let arrowsOn = 0;
  const d = new Vector3();
  const from = new Vector3();
  const spheres: Spheres = {
    group,
    balls,
    focus: -1,
    shown: 0,
    get pair() {
      return pair;
    },
    get gap() {
      return gap;
    },
    get force() {
      return force;
    },
    update(dt, t) {
      // the pair with arrows: the sphere in the hand and its nearest neighbour, else the nearest pair of all
      gap = Infinity;
      for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++) {
          if (spheres.focus >= 0 && i !== spheres.focus && j !== spheres.focus) continue;
          const g = balls[i]!.pos.distanceTo(balls[j]!.pos) / (2 * SPHERE_R);
          if (g < gap - 0.05 || (g < gap + 0.05 && pair[0] === i && pair[1] === j)) {
            gap = g;
            pair = [i, j];
          }
        }
      force = Math.min(ARROW_K / (gap * gap), ARROW_MAX);
      const same = drawn[0] === pair[0] && drawn[1] === pair[1];
      // arrows grow in as a pair comes near (never a stub popping up at the edge of the range)
      const near = Math.min(Math.max((SHOW_WITHIN - gap) / (SHOW_WITHIN - SHOWN_FROM), 0), 1);
      arrowsOn += ((same ? near : 0) - arrowsOn) * Math.min(dt * (same ? 8 : 14), 1);
      if (!same && arrowsOn < 0.03) drawn = [pair[0], pair[1]];
      let m = 0;
      let p = 0;
      balls.forEach((b, i) => {
        const k = Math.min(Math.max(spheres.shown * 1.6 - i * 0.2, 0), 1);
        const s = k * k * (3 - 2 * k) * (1 + 0.05 * b.hover) * (1 + 0.012 * Math.sin(t * 1.4 + i));
        b.pick.position.copy(b.pos);
        if (b.sign < 0) minus.setPosition(m++, b.pos.x, b.pos.y * s, b.pos.z, s);
        else plus.setPosition(p++, b.pos.x, b.pos.y * s, b.pos.z, s);
        shadows[i]!.position.set(b.pos.x, 0.006, b.pos.z);
        shadows[i]!.scale.setScalar(Math.max(s, 1e-3));
      });
      minus.commit();
      plus.commit();
      const [a, b] = [balls[drawn[0]]!, balls[drawn[1]]!];
      const dist = a.pos.distanceTo(b.pos) / (2 * SPHERE_R);
      const drawnForce = Math.min(ARROW_K / (dist * dist), ARROW_MAX);
      shownForce += (drawnForce - shownForce) * Math.min(dt * 12, 1);
      const like = a.sign === b.sign;
      [a, b].forEach((ball, k) => {
        const other = k === 0 ? b : a;
        // both arrows sit on the outer sides, so they never cross between close balls: alike — from the ball
        // away from the other; unlike — from outside, pushing the ball toward the other, its tip at the ball
        const length = Math.max(shownForce, 0.05);
        d.copy(other.pos).sub(ball.pos).setY(0).normalize();
        if (like) from.copy(ball.pos).addScaledVector(d.negate(), SPHERE_R * 1.08);
        else from.copy(ball.pos).addScaledVector(d, -(SPHERE_R * 1.08 + length));
        from.y = SPHERE_R * 1.05;
        const arrow = arrows[k]!;
        arrow.shown = arrowsOn * spheres.shown;
        arrow.set(from, d, length);
      });
    },
  };
  return spheres;
}
