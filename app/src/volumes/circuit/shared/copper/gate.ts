/**
 * The counter frame among the atoms (`wire/restless`; later `flow/count`): the same thin teal frame that sits
 * around the wire on the stand (VISUAL §5.7), seen from inside the copper — a window across the wire through
 * which electrons fly. It shows two numbers, how many went left and how many went right, right above itself.
 * The counting is done by the electron simulation (`sim.gate`); this is only the picture.
 */
import {
  CatmullRomCurve3,
  Group,
  Mesh,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { damp, toOverlay } from '@/engine/api';
import { K } from '@/style';
import { Text3D } from '@/text';
import type { ElectronSim } from './electron-sim';

/** The frame spans the slab the focus electrons live in (z), units. */
const Z = [-1.15, 3] as const;

export interface Gate {
  group: Group;
  /** 0…1 presence (pops in). */
  shown: number;
  /** Show the two numbers in the scene (about 32 px tall at 1280×720). Turn them off to label the counts from
   *  the interface instead, at `leftAnchor` / `rightAnchor`. */
  numbers: boolean;
  /** Where the two counts stand (children of `group`): anchors for interface labels. */
  leftAnchor: Object3D;
  rightAnchor: Object3D;
  update(dt: number): void;
}

export function createGate(sim: ElectronSim): Gate {
  const group = new Group();
  group.name = 'counter-frame';
  const frame = new Group();
  const glow = K.glow({ color: 'teal', intensity: 1.45, whiten: 0, keepHue: true });
  const glass = K.glass({ color: 'teal', opacity: 0.13, edgeOpacity: 0.32, specular: 0 });
  let tube: Mesh | null = null;
  let pane: Mesh | null = null;
  let builtHalf = -1;
  const build = (half: number): void => {
    if (tube) {
      frame.remove(tube);
      tube.geometry.dispose();
    }
    if (pane) {
      frame.remove(pane);
      pane.geometry.dispose();
    }
    // rounded rectangle in the YZ plane (the wire runs along X, the frame stands across it)
    const r = 0.45;
    const pts: Vector3[] = [];
    const corner = (cy: number, cz: number, a0: number): void => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        pts.push(new Vector3(0, cy + Math.cos(a) * r, cz + Math.sin(a) * r));
      }
    };
    corner(half - r, Z[1] - r, 0);
    corner(-half + r, Z[1] - r, Math.PI / 2);
    corner(-half + r, Z[0] + r, Math.PI);
    corner(half - r, Z[0] + r, Math.PI * 1.5);
    tube = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(pts, true, 'catmullrom', 0.1), 160, 0.07, 8, true),
      glow,
    );
    pane = new Mesh(new PlaneGeometry(Z[1] - Z[0] - 0.1, 2 * half - 0.1), glass);
    pane.rotation.y = Math.PI / 2;
    pane.position.z = (Z[0] + Z[1]) / 2;
    frame.add(tube, pane);
    builtHalf = half;
  };
  const label = (anchorX: 'left' | 'right'): Text3D => {
    const t = new Text3D('0', {
      font: 'display',
      size: 46,
      color: 'white',
      anchorX,
      anchorY: 'bottom',
      billboard: true,
      screenSpace: true,
      rich: false,
    });
    toOverlay(t);
    return t;
  };
  const left = label('right');
  const right = label('left');
  group.add(frame, left, right);
  const ringGeometry = new RingGeometry(0.36, 0.44, 40);
  ringGeometry.rotateY(Math.PI / 2); // in the plane of the frame
  const rings = Array.from({ length: 5 }, () => {
    const material = K.glow({ color: 'teal', intensity: 0, whiten: 0.2, keepHue: true });
    const mesh = new Mesh(ringGeometry, material);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, material, age: 1 };
  });
  let next = 0;
  const size = new Vector3();
  let shown = 0;
  let beat = 0;
  let seen = 0;
  const counted = { left: 0, right: 0 };
  const bump = { left: 0, right: 0 };
  const gate: Gate = {
    group,
    shown: 0,
    numbers: true,
    leftAnchor: new Object3D(),
    rightAnchor: new Object3D(),
    update(dt) {
      const g = sim.gate;
      shown = damp(shown, gate.shown, 9, dt);
      group.visible = shown > 0.01;
      if (!group.visible) return;
      if (g.half !== builtHalf) build(g.half);
      group.position.set(g.x, g.y, 0);
      frame.scale.setScalar(shown);
      // every crossing: the frame blinks and a ring opens on the pane where the electron went through
      if (g.left + g.right !== seen) {
        seen = g.left + g.right;
        beat = 1;
        if (g.last >= 0) {
          const ring = rings[next++ % rings.length]!;
          ring.mesh.position.set(0, sim.pos[3 * g.last + 1]! - g.y, sim.pos[3 * g.last + 2]!);
          ring.age = 0;
        }
      }
      beat = damp(beat, 0, 7, dt);
      glow.intensity = 1.45 + 0.9 * beat;
      for (const ring of rings) {
        ring.age += dt / 0.45;
        ring.mesh.visible = ring.age < 1;
        ring.mesh.scale.setScalar(0.35 + 1.1 * Math.sqrt(Math.min(ring.age, 1)));
        ring.material.intensity = 1.6 * (1 - ring.age) ** 2;
      }
      // the two counts stand over the frame's top, each on its own side, at the depth of the frame's middle
      const top = g.half + 0.4;
      const mid = (Z[0] + Z[1]) / 2;
      gate.leftAnchor.position.set(-0.85, top, mid);
      gate.rightAnchor.position.set(0.85, top, mid);
      left.position.copy(gate.leftAnchor.position);
      right.position.copy(gate.rightAnchor.position);
      left.visible = right.visible = gate.numbers && shown > 0.6;
      // a count that has just grown swells for a moment: the eye is told which side it was
      if (g.left !== counted.left) bump.left = g.left > counted.left ? 1 : 0;
      if (g.right !== counted.right) bump.right = g.right > counted.right ? 1 : 0;
      counted.left = g.left;
      counted.right = g.right;
      bump.left = damp(bump.left, 0, 6, dt);
      bump.right = damp(bump.right, 0, 6, dt);
      // screen-space text multiplies its pixel size by the scale it inherits: undo the mount and the dive zoom
      const inherited = group.getWorldScale(size).x;
      left.scale.setScalar((1 + 0.28 * bump.left) / inherited);
      right.scale.setScalar((1 + 0.28 * bump.right) / inherited);
      const l = `← ${g.left}`;
      const r = `${g.right} →`;
      if (left.text !== l) left.text = l;
      if (right.text !== r) right.text = r;
    },
  };
  group.add(gate.leftAnchor, gate.rightAnchor);
  return gate;
}
