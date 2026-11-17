/**
 * The little figure with fluffy hair (VISUAL §5, chapter 2; STYLE_GUIDE: a very simple capsule figure, no face
 * detail). A toy in the stand's materials: `teal` sweater, `slate` legs, a round head. Its hair is 44 strands
 * in one geometry (`Strands`): at rest a soft mop standing a little off the scalp; a charged balloon pulls every
 * strand toward itself, the tip most, smoothly (each point follows its target with a short lag). A balloon in
 * contact pushes the strands aside. Local frame: origin on the table under the feet, +Y up, facing +Z.
 */
import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K, col } from '@/style';
import { Strands } from './strands';

const STRANDS = 110;
const POINTS = 8;
const LENGTH = 0.4;
/** Head centre and radius (local). */
export const HEAD = new Vector3(0, 1.84, 0);
const SKIN = col('orange.light').lerp(col('pink.light'), 0.3);
export const HEAD_R = 0.36;

export interface Figure {
  group: Group;
  /** The head with its hair (pick and probe target). */
  head: Mesh;
  /** World point that pulls the hair (the balloon's centre) and how hard (0 none … 1 charged and near). */
  attract: Vector3;
  pull: number;
  /** World point and radius of a body the strands cannot enter (the balloon; radius 0 = none). */
  pusher: Vector3;
  pushR: number;
  /** World point at the top of the hair (for captions and the lens spot). */
  crown(out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

export function createFigure(): Figure {
  const group = new Group();
  group.name = 'charge-figure';
  const b = new Builder('charge-figure');
  // short legs, one shoe on each (the shoe hugs the leg's foot), a round sweater, arms at the sides, a neck
  for (const x of [-0.13, 0.13]) {
    b.capsule(0.11, 0.46, { seg: 16, c: ['ink', 'slate'], at: [x, 0.33, 0] });
    b.sphere(0.125, { at: [x, 0.09, 0.05], s: [1, 0.66, 1.4], seg: 18, c: ['ink', 'slate'] });
  }
  b.capsule(0.37, 0.98, { seg: 28, c: ['teal.dark', 'teal'], at: [0, 1.0, 0] }); // sweater (length = whole height)
  b.ring(0.2, 0.07, { seg: 28, c: 'teal.light', at: [0, 1.45, 0] }); // collar
  for (const s of [-1, 1])
    b.capsule(0.1, 0.62, {
      seg: 14,
      c: ['teal.dark', 'teal'],
      at: [0.42 * s, 0.97, 0],
      rot: [0, 0, 0.2 * s],
    });
  for (const s of [-1, 1]) b.sphere(0.1, { at: [0.48 * s, 0.68, 0.02], seg: 14, c: SKIN });
  b.capsule(0.09, 0.06, { seg: 12, c: SKIN, at: [0, 1.53, 0] }); // neck
  const body = b.build().group;
  const head = new Mesh(
    new SphereGeometry(HEAD_R, 40, 28),
    K.toon({ color: SKIN, softness: 0.08, rim: 0.8, emissive: SKIN, emissiveIntensity: 0.1 }),
  );
  head.name = 'charge-figure:head';
  head.position.copy(HEAD);
  head.castShadow = true;
  // the face (STYLE_GUIDE: no more than this): two dot eyes and a small smile
  const ink = K.toon({ color: 'ink', softness: 0.2, highlight: 0, rim: 0 });
  const eyes = [-1, 1].map((s) => {
    const e = new Mesh(new SphereGeometry(0.036, 14, 10), ink);
    e.position
      .copy(HEAD)
      .add(new Vector3(0.115 * s, 0.03, 0).add(new Vector3(0, 0, 1).multiplyScalar(HEAD_R * 0.93)));
    e.scale.set(1, 1.25, 0.6);
    return e;
  });
  const smile = new Mesh(new TorusGeometry(0.075, 0.013, 8, 20, Math.PI * 0.62), ink);
  smile.position.copy(HEAD).add(new Vector3(0, -0.055, HEAD_R * 0.955));
  smile.rotation.set(-0.25, 0, Math.PI + Math.PI * 0.19);
  for (const m of [...eyes, smile]) m.castShadow = false;
  const strands = new Strands(STRANDS, POINTS, 0.027, 0.45);
  const hair = new Mesh(
    strands.geometry,
    K.toon({
      gradient: { bottom: 'orange.dark', top: 'orange', range: [1.7, 2.6] },
      softness: 0.12,
      rim: 1,
      emissive: 'orange',
      emissiveIntensity: 0.14,
    }),
  );
  hair.name = 'charge-figure:hair';
  hair.frustumCulled = false;
  hair.castShadow = true;
  group.add(body, head, ...eyes, smile, hair);

  // roots on the crown and the back and sides of the head, never over the face (+Z, below the brow)
  const roots: Vector3[] = [];
  for (let i = 0; roots.length < STRANDS; i++) {
    const y = 1 - (i + 0.5) / (STRANDS * 1.6);
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    const n = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (n.y < -0.1 || (n.z > 0.18 && n.y < 0.62) || (n.z > -0.2 && n.y < 0.2)) continue;
    roots.push(n);
  }
  // the rest shape of each strand: out of the scalp, curling softly down — a fluffy mop
  const rest = roots.map((n, i) => {
    // a fluffy puff: out of the scalp, the tips curling a little sideways and down (never a cap)
    const down = new Vector3(
      n.x + 0.35 * Math.sin(i * 1.7),
      -0.25,
      n.z + 0.35 * Math.cos(i * 1.7),
    ).normalize();
    const curl = 0.18 + 0.22 * (((i * 7) % 5) / 4);
    return Array.from({ length: POINTS - 1 }, (_, k) =>
      n
        .clone()
        .lerp(down, curl * (k / (POINTS - 2)))
        .normalize(),
    );
  });
  // a direction across each strand for its waves
  const wave = roots.map((n, i) => new Vector3(Math.cos(i * 2.1), 0, Math.sin(i * 2.1)).cross(n).normalize());
  const cur = roots.map((n) =>
    Array.from({ length: POINTS }, (_, k) =>
      n
        .clone()
        .multiplyScalar(HEAD_R + (k * LENGTH) / (POINTS - 1))
        .add(HEAD),
    ),
  );
  const local = new Vector3();
  const push = new Vector3();
  const p = new Vector3();
  const seg = new Vector3();
  const toward = new Vector3();
  let first = true;
  const figure: Figure = {
    group,
    head,
    attract: new Vector3(),
    pull: 0,
    pusher: new Vector3(),
    pushR: 0,
    crown: (out) => group.localToWorld(out.copy(HEAD).add(seg.set(0, HEAD_R + LENGTH * 0.35, 0))),
    update(dt, t) {
      group.worldToLocal(local.copy(figure.attract));
      group.worldToLocal(push.copy(figure.pusher));
      const pushR = figure.pushR / group.scale.x;
      const follow = first ? 1 : Math.min(dt * 9, 1);
      first = false;
      roots.forEach((n, i) => {
        p.copy(n)
          .multiplyScalar(HEAD_R * 0.96)
          .add(HEAD);
        cur[i]![0]!.copy(p);
        strands.set(i, 0, p);
        const sway = 0.05 * Math.sin(t * 1.7 + i * 1.3);
        const calm = 1 - Math.min(figure.pull, 1);
        for (let k = 1; k < POINTS; k++) {
          const w = (k / (POINTS - 1)) ** 0.8;
          toward.copy(local).sub(p).normalize();
          seg.copy(rest[i]![k - 1]!);
          seg.x += sway * w;
          // soft waves along every strand while nothing pulls it: fluffy, not spiky
          seg.addScaledVector(wave[i]!, 0.55 * calm * Math.sin(k * 1.35 + i * 0.9));
          seg.lerp(toward, Math.min(figure.pull * (0.55 + 0.45 * w), 0.97)).normalize();
          p.addScaledVector(seg, LENGTH / (POINTS - 1));
          // never into the head
          const dh = p.distanceTo(HEAD);
          if (dh < HEAD_R * 1.05)
            p.sub(HEAD)
              .multiplyScalar((HEAD_R * 1.05) / dh)
              .add(HEAD);
          // a balloon in contact presses the strands aside
          const db = p.distanceTo(push);
          if (pushR > 0 && db < pushR)
            p.sub(push)
              .multiplyScalar(pushR / Math.max(db, 1e-4))
              .add(push);
          const c = cur[i]![k]!;
          c.lerp(p, follow);
          strands.set(i, k, c);
        }
      });
      strands.commit();
    },
  };
  return figure;
}
