/**
 * The pole charges of the stand battery (VISUAL.md §5.2, chapter `battery`): `cyan` electrons gathered on the
 * minus cap and `coral` spots of lack on the plus — exaggerated and few. On the closed battery they sit around
 * the cap's rim and on the nub; when the section opens they move to the cut: a heap on the minus cap's cut
 * face and along the start of the pin (both are the minus), the spots on the steel of the plus end.
 *
 * Levels, not counts (the scale «бракує · порівну · забагато»): `surplus` / `lack` 0 = порівну … `mark` = what
 * the battery holds … 1. With `hold` the battery keeps them at `mark` itself — the «first moment» (from 0 the
 * level climbs to the mark in ≈ 5 s while the reaction thins out) and `battery/balance` (a clump pulled off the
 * minus cap: the reaction revives and restores the level in ≈ 3 s) — and reports how hard it reacts.
 */
import {
  type Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { BATTERY } from './layout';
import { SEC } from './battery-section';
import { seeded } from './battery-grains';
import { aliveOf, smooth } from './battery-react';

/** Electrons / spots drawn at level 1 (exaggerated and few, on purpose). */
export const POLE_DOTS = 16;
/** The level the battery holds by default (the mark on the scale). */
export const POLE_MARK = 0.75;
/** Restoring rate of `hold`, 1/s: from 0 to the mark within 5 % in ≈ 4.6 s, from ⅔ of it in ≈ 3 s. */
const RESTORE = 0.65;

interface Slot {
  closed: Vector3;
  open: Vector3;
  normal: Vector3;
  phase: number;
}

/** Slots around a ring of radius `r` at x0…x1, the first ones facing the viewer (angles about +x). */
function ringSlots(
  n: number,
  r: number,
  x0: number,
  x1: number,
  seed: number,
  open: (i: number) => Vector3,
): Slot[] {
  const rnd = seeded(seed);
  const face = Math.atan2(Math.cos(0.9), Math.sin(0.9));
  return Array.from({ length: n }, (_, i) => {
    const a = face + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.26 + (rnd() - 0.5) * 0.1;
    const normal = new Vector3(0, Math.cos(a), Math.sin(a));
    return {
      closed: normal
        .clone()
        .multiplyScalar(r)
        .setX(x0 + (x1 - x0) * rnd()),
      open: open(i),
      normal,
      phase: rnd() * 6.28,
    };
  });
}

/** The clump of electrons the reader pulls off the minus cap (`battery/balance`). */
export interface Clump {
  /** Invisible sphere over the heap on the minus cap: register it with `ctx.input` (follows the heap). */
  handle: Object3D;
  /** Take `share` of the electrons on the minus (default ½, at least 3): the level drops by that much at once. */
  grab(share?: number): void;
  /** Where the clump is pulled to (world); the electrons follow with a little lag each. */
  moveTo(world: Vector3): void;
  /** Let go: far from the cap (> 0.45 units) the clump melts away and true is returned; near it flows back. */
  release(): boolean;
  readonly held: boolean;
}

export interface Poles {
  surplus: number;
  lack: number;
  mark: number;
  hold: boolean;
  /** 0 … 1: a current flows (the circuit is closed): with `hold` the reaction keeps running at this rate. */
  current: number;
  /** How hard the reaction runs to keep the poles (`hold`), 0 … 1. */
  readonly drive: number;
  readonly surplusCount: number;
  readonly lackCount: number;
  clump: Clump;
  update(dt: number, t: number, cut: number, life: number): void;
}

export function createPoles(battery: Group, section: Group): Poles {
  section.updateMatrix();
  const toBattery = section.matrix;
  const onSection = (x: number, y: number, z = 0.022): Vector3 =>
    new Vector3(x, y, z).applyMatrix4(toBattery);
  const heap = (i: number): Vector3 => {
    // in the cut: on the minus cap's face (a column) and along the start of the pin through the seal
    if (i % 2 === 0) {
      const k = i / 2;
      return onSection(SEC.capX + 0.012, (k % 2 ? 1 : -1) * (0.02 + Math.floor(k / 2) * 0.05), 0.03);
    }
    const k = (i - 1) / 2;
    return onSection(-0.912 + Math.floor(k / 2) * 0.042, (k % 2 ? 1 : -1) * (SEC.pin + 0.017), 0.03);
  };
  const minus = ringSlots(POLE_DOTS, SEC.capR + 0.016, -0.972, -0.942, 3, heap);
  const plus = [
    ...ringSlots(8, SEC.nub + 0.012, 0.965, 1.03, 5, (i) =>
      onSection(SEC.nubTop - 0.009, (i / 7 - 0.5) * 0.17),
    ),
    ...ringSlots(8, BATTERY.radius * 0.94 + 0.01, 0.905, 0.945, 9, (i) =>
      onSection(0.94, (i % 2 ? 1 : -1) * (0.11 + 0.016 * i)),
    ),
  ];
  // alternate nub / shoulder, so a few spots already spread over both
  const lackSlots = Array.from({ length: POLE_DOTS }, (_, i) => plus[(i % 2) * 8 + (i >> 1)]!);

  const electrons = new InstancedMesh(
    new IcosahedronGeometry(1, 2),
    K.glow({ color: 'cyan', intensity: 2 }),
    2 * POLE_DOTS,
  );
  const lacks = new InstancedMesh(
    G.ring(1, 0.32, 20, 6),
    K.glow({ color: 'coral', intensity: 1.4, whiten: 0.2 }),
    POLE_DOTS,
  );
  for (const mesh of [electrons, lacks]) {
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    battery.add(mesh);
  }
  const handle = new Mesh(new IcosahedronGeometry(0.2, 1), new MeshBasicMaterial({ visible: false }));
  handle.name = 'battery:clump';
  battery.add(handle);

  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const up = new Vector3(0, 1, 0);
  const facing = new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
    .premultiply(section.quaternion);
  const put = (mesh: InstancedMesh, i: number, at: Vector3, r: number, rot = q.identity()): void => {
    mesh.setMatrixAt(i, m.compose(at, rot, s.setScalar(r)));
  };
  const hide = (mesh: InstancedMesh, i: number): void => {
    mesh.setMatrixAt(i, m.makeScale(0, 0, 0));
  };
  const homeOf = (i: number, open: number, t: number, out: Vector3): Vector3 => {
    const sl = minus[i]!;
    const w = 0.004 * Math.sin(t * 2.3 + sl.phase);
    return out
      .lerpVectors(sl.closed, sl.open, open)
      .addScaledVector(sl.normal, w * (1 - open))
      .setX(out.x + w);
  };

  // the clump: its dots (battery frame), their offsets from its centre, where it is pulled to
  const clumpDots: { at: Vector3; off: Vector3; lag: number }[] = [];
  const target = new Vector3();
  const homeCentre = new Vector3();
  let mode: 'none' | 'held' | 'melting' | 'back' = 'none';
  let fade = 0;
  let open = 0;
  let time = 0;
  let surplusCount = 0;
  let lackCount = 0;
  let drive = 0;
  const count = (v: number): number => Math.round(Math.min(Math.max(v, 0), 1) * POLE_DOTS);
  /** Size of dot `i` at a level: the dots of a changing level grow in and shrink away one after another. */
  const grow = (i: number, level: number): number => {
    const k = Math.min(Math.max(Math.min(Math.max(level, 0), 1) * POLE_DOTS - i, 0), 1);
    return k * k * (3 - 2 * k);
  };

  const clump: Clump = {
    handle,
    get held() {
      return mode === 'held';
    },
    grab(share = 0.5) {
      const have = count(poles.surplus);
      const n = Math.min(have, Math.max(3, Math.round(have * share)));
      if (n <= 0) return;
      clumpDots.length = 0;
      homeCentre.set(0, 0, 0);
      for (let i = have - n; i < have; i++) homeCentre.add(homeOf(i, open, time, p).clone());
      homeCentre.divideScalar(n);
      for (let i = have - n; i < have; i++) {
        const at = homeOf(i, open, time, new Vector3());
        clumpDots.push({ at, off: at.clone().sub(homeCentre), lag: 7 + 6 * (i % 4) });
      }
      target.copy(homeCentre);
      poles.surplus = Math.max(poles.surplus - n / POLE_DOTS, 0);
      mode = 'held';
    },
    moveTo(world) {
      if (mode === 'held') target.copy(battery.worldToLocal(p.copy(world)));
    },
    release() {
      if (mode !== 'held') return false;
      const far = target.distanceTo(homeCentre) > 0.45;
      mode = far ? 'melting' : 'back';
      fade = 1;
      return far;
    },
  };

  const poles: Poles = {
    surplus: 0,
    lack: 0,
    mark: POLE_MARK,
    hold: false,
    current: 0,
    get drive() {
      return drive;
    },
    get surplusCount() {
      return surplusCount;
    },
    get lackCount() {
      return lackCount;
    },
    clump,
    update(dt, t, cut, life) {
      time = t;
      open = smooth(0.2, 0.7, cut);
      if (poles.hold) {
        // the reaction refills the poles; it slows as the level nears the mark and stops there
        const gap = Math.max(poles.mark - poles.surplus, 0);
        poles.surplus += gap * (1 - Math.exp(-RESTORE * dt * Math.max(aliveOf(life), 0.15)));
        poles.lack = poles.surplus;
        drive = Math.min(1, (2.4 * gap) / Math.max(poles.mark, 1e-3) + poles.current);
      } else drive = 0;
      surplusCount = count(poles.surplus);
      lackCount = count(poles.lack);
      for (let i = 0; i < POLE_DOTS; i++) {
        const gs = grow(i, poles.surplus);
        if (gs > 0.001) put(electrons, i, homeOf(i, open, t, p), 0.019 * gs);
        else hide(electrons, i);
        const gl = grow(i, poles.lack);
        if (gl > 0.001) {
          const sl = lackSlots[i]!;
          const rot = q.setFromUnitVectors(up, sl.normal).slerp(facing, open);
          put(
            lacks,
            i,
            p.lerpVectors(sl.closed, sl.open, open),
            0.017 * gl * (1 + 0.08 * Math.sin(t * 1.7 + sl.phase)),
            rot,
          );
        } else hide(lacks, i);
      }
      // the clump follows the hand, melts away when let go far, or flows back and joins the heap
      if (mode === 'melting') fade = Math.max(fade - dt / 0.6, 0);
      if (mode === 'back' && clumpDots.every((d) => d.at.distanceTo(homeCentre) < 0.06)) {
        poles.surplus = Math.min(
          poles.surplus + clumpDots.length / POLE_DOTS,
          Math.max(poles.mark, poles.surplus),
        );
        clumpDots.length = 0;
      }
      if (mode === 'melting' && fade <= 0) clumpDots.length = 0;
      if (!clumpDots.length && mode !== 'held') mode = 'none';
      const goal = mode === 'back' ? homeCentre : target;
      for (let j = 0; j < POLE_DOTS; j++) {
        const d = clumpDots[j];
        if (!d || mode === 'none') {
          hide(electrons, POLE_DOTS + j);
          continue;
        }
        d.at.lerp(p.copy(goal).addScaledVector(d.off, mode === 'held' ? 0.8 : 1), 1 - Math.exp(-d.lag * dt));
        put(electrons, POLE_DOTS + j, d.at, 0.019 * (mode === 'melting' ? fade : 1));
      }
      // the handle sits on the heap (or on the clump while it is held)
      if (mode === 'held') handle.position.copy(target);
      else handle.position.copy(homeOf(Math.min(2, Math.max(surplusCount - 1, 0)), open, t, p));
      electrons.instanceMatrix.needsUpdate = true;
      lacks.instanceMatrix.needsUpdate = true;
    },
  };
  poles.update(0, 0, 0, 0);
  return poles;
}
