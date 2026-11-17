/**
 * A toy balloon in the stand's world (VISUAL §5, chapter 2): a glossy `pink` rubber body a little taller than
 * wide, a `magenta` knot and a short curl of string. The group's origin is the centre of the body; the knot
 * points along `down` (local −Y), and `tilt` leans the whole balloon (a balloon lying on the table rests on its
 * side, one hanging from a thread hangs knot down). Charge is not drawn: «+» / «−» marks arrive with `signs`.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K } from '@/style';

/** Radius of the body (stand units, 1 ≈ 26 mm: a small party balloon at the stand's toy scale). */
export const BALLOON_R = 0.52;
/** The body is this much taller than wide. */
export const BALLOON_TALL = 1.12;

export interface Balloon {
  group: Group;
  /** The rubber body (pick target). */
  body: Mesh;
  /** 0…1 hover cue: a small swell. */
  hover: number;
  /** Lean of the balloon about the camera-facing axis, radians (0 = knot straight down). */
  tilt: number;
  /** Where the knot is, world space (for a thread). */
  knot(out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

export function createBalloon(name = 'balloon'): Balloon {
  const group = new Group();
  group.name = name;
  const lean = new Group();
  group.add(lean);
  const body = new Mesh(
    new SphereGeometry(BALLOON_R, 48, 32),
    K.toon({
      color: 'pink',
      gloss: 0.9,
      rim: 1.1,
      softness: 0.09,
      gradient: { bottom: 'magenta', top: 'pink.light', range: [-BALLOON_R, BALLOON_R] },
      emissive: 'pink',
      emissiveIntensity: 0.12,
    }),
  );
  body.name = `${name}:body`;
  body.scale.set(1, BALLOON_TALL, 1);
  body.castShadow = true;
  // a balloon narrows into its neck: a second, small sphere melts the body into the knot
  const neck = new Mesh(new SphereGeometry(BALLOON_R * 0.34, 24, 16), body.material);
  neck.position.y = -BALLOON_R * BALLOON_TALL * 0.82;
  neck.scale.set(1, 1.3, 1);
  const b = new Builder(`${name}-knot`);
  const ky = -BALLOON_R * BALLOON_TALL - 0.07;
  b.sphere(0.07, { at: [0, ky, 0], s: [1, 0.8, 1], seg: 14, c: 'magenta' });
  b.tube(
    [
      new Vector3(0, ky - 0.04, 0),
      new Vector3(0.05, ky - 0.13, 0.02),
      new Vector3(-0.03, ky - 0.22, -0.01),
      new Vector3(0.02, ky - 0.3, 0.01),
    ],
    0.012,
    { c: 'mist' },
  );
  const knot = b.build().group;
  knot.traverse((o) => (o.castShadow = false));
  lean.add(body, neck, knot);
  const knotAt = new Vector3(0, ky, 0);
  let swell = 0;
  const balloon: Balloon = {
    group,
    body,
    hover: 0,
    tilt: 0,
    knot: (out) => lean.localToWorld(out.copy(knotAt)),
    update(dt, t) {
      swell += (balloon.hover - swell) * Math.min(dt * 8, 1);
      const s = 1 + 0.045 * swell;
      lean.scale.setScalar(s);
      // rubber is never quite still: a slow breath of the skin
      body.scale.set(1 + 0.006 * Math.sin(t * 1.3), BALLOON_TALL, 1 + 0.006 * Math.sin(t * 1.3 + 1));
      lean.rotation.z = balloon.tilt;
    },
  };
  return balloon;
}
