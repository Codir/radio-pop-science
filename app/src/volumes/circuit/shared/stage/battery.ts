/**
 * The one AA battery of the volume: dark `ink` jacket with an `amber` band toward the plus (as in volume 1,
 * where it read at a glance), steel shoulder and nub at «+», flat plate at «−», pole marks on the jacket.
 * Origin = centre of the can, axis along local +x, «+» at +x.
 *
 * `charge` 1 … 0 is what the OUTSIDE shows of the battery's life (VISUAL.md §5.8): the amber band pales to a
 * dull `mist` and the jacket loses its gloss tone — a dead battery must be told from a fresh one without a label.
 */
import { type Group, Mesh, type Object3D, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { K, col } from '@/style';
import { Text3D } from '@/text';
import { BATTERY } from './layout';

export interface BatteryModel {
  group: Group;
  /** 1 fresh … 0 dead. */
  charge: number;
  /** Whether «1,5 V» is printed on the jacket (off where it would be too small to read — label it in the interface). */
  printShown: boolean;
  /** Where the print sits, for a caption of the interface (`getWorldPosition`). */
  printAnchor: Object3D;
  /** Brightness of the printed «1,5 V» 0…1 (the print is unlit text: it follows the room's light). */
  light: number;
  /** Tips of the poles in the battery's local space (where the clamp's contact and the spring touch). */
  plusTip: Vector3;
  minusTip: Vector3;
}

/** A strip lying on the can's surface: `len` along the axis, `arc` radians around it, centred at angle `phi`. */
function mark(b: Builder, x: number, len: number, arc: number, phi: number, c: string): void {
  const R = BATTERY.radius + 0.004;
  const g = G.lathe(
    [
      [R, -len / 2],
      [R, len / 2],
    ],
    { seg: 6, phiStart: phi - arc / 2, phiLength: arc },
  );
  b.add(g, { slot: 'toon', c, at: [x, 0, 0], rot: [0, 0, -Math.PI / 2] });
}

export function createBattery(): BatteryModel {
  const { length: L, radius: R } = BATTERY;
  const b = new Builder('battery');
  const jacket = L * 0.64;
  b.cyl(R, jacket, {
    at: [-L / 2, 0, 0],
    axis: 'x',
    seg: 48,
    slot: 'gloss',
    c: ['ink', 'slate'],
    bevel: 0.035,
  });
  // steel shoulder under the band's far end, the «+» nub and the flat «−» plate
  b.cyl(R * 0.94, 0.05, {
    at: [L / 2 - 0.05, 0, 0],
    axis: 'x',
    seg: 40,
    slot: 'metal',
    c: 'mist',
    bevel: 0.02,
  });
  b.cyl(0.105, 0.105, {
    at: [L / 2 - 0.01, 0, 0],
    axis: 'x',
    seg: 24,
    slot: 'metal',
    c: 'mist',
    bevel: 0.025,
  });
  b.cyl(R * 0.8, 0.03, {
    at: [-L / 2 - 0.02, 0, 0],
    axis: 'x',
    seg: 32,
    slot: 'metal',
    c: 'mist',
    bevel: 0.01,
  });
  b.cyl(R + 0.007, 0.045, {
    at: [-L / 2 + jacket - 0.02, 0, 0],
    axis: 'x',
    seg: 48,
    slot: 'metal',
    c: 'mist',
    bevel: 0.012,
  });
  // pole marks, turned toward the reader
  // G.lathe: φ = 0 → +x; laid along x it becomes φ = π/2 → facing the reader (+z), φ = π → facing up
  const phi = Math.PI / 2 + 0.85;
  mark(b, L / 2 - 0.3, 0.2, 0.2, phi, 'white');
  mark(b, L / 2 - 0.3, 0.055, 0.72, phi, 'white');
  mark(b, -L / 2 + 0.27, 0.2, 0.2, phi, 'mist');

  const model = b.build();
  const band = new Mesh(
    G.cyl(R + 0.004, L - jacket - 0.07, { seg: 48, bevel: 0.03 }).rotateZ(-Math.PI / 2),
    K.toon({ color: 'amber', gloss: 0.75, highlight: 0.6 }),
  );
  band.position.x = -L / 2 + jacket + 0.02;
  band.castShadow = band.receiveShadow = true;
  band.name = 'battery:band';
  model.group.add(band);

  // «1,5 V» printed on the jacket, on the same line as the pole marks
  const print = new Text3D('1,5 V', {
    font: 'display',
    size: 0.19,
    color: 'mist',
    anchorX: 'center',
    anchorY: 'middle',
    halo: false,
    rich: false,
  });
  print.position.set(-0.36, Math.cos(0.85) * 0 + Math.sin(0.85) * (R + 0.008), Math.cos(0.85) * (R + 0.008));
  print.rotation.x = -0.85;
  print.name = 'battery:print';
  model.group.add(print);
  const ink = col('mist');
  let light = 1;

  const fresh = col('amber');
  const dead = col('mist').lerp(col('slate'), 0.45);
  let charge = 1;
  return {
    group: model.group,
    plusTip: new Vector3(L / 2 + 0.095, 0, 0),
    minusTip: new Vector3(-L / 2 - 0.02, 0, 0),
    printAnchor: print,
    get printShown() {
      return print.visible;
    },
    set printShown(v: boolean) {
      print.visible = v;
    },
    get light() {
      return light;
    },
    set light(v: number) {
      light = Math.min(Math.max(v, 0), 1);
      print.color = ink.clone().multiplyScalar(0.12 + 0.6 * light);
    },
    get charge() {
      return charge;
    },
    set charge(v: number) {
      charge = Math.min(Math.max(v, 0), 1);
      // the band keeps its colour for most of the life and pales in the last third
      band.material.color.copy(dead).lerp(fresh, Math.min(charge / 0.35, 1) ** 0.8);
    },
  };
}
