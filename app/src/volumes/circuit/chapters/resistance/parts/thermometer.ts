/**
 * `heat`: the small thermometer clipped to the near wire beside the lens (script: «маленький термометр-стовпчик
 * (`orange`), без чисел, лише риска „без струму“»). A glass tube standing up from a clip round the wire, an orange
 * bulb and column, one white tick. `level` 0 = the column's top at the tick (no current) … 1 = one tick's width
 * above it (the wire with the current; the script: «на ширину самої риски, не більше»). Board frame; lit like the
 * stand's own props.
 */
import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Object3D } from 'three';
import { K, col } from '@/style';
import { LOOP, WIRE } from '@circuit/shared/stage';
import { sheath, tame } from '@circuit/shared/stage/materials';

/** Height of the tick above the wire's axis, its own height (= how far the column rises), the tube's length. */
const TICK_Y = 0.34;
const TICK_H = 0.04;
const TUBE = { radius: 0.05, from: 0.14, to: 0.5 } as const;
const BULB = { radius: 0.072, y: 0.16 } as const;
const COLUMN_R = 0.04;
const SIZE = 2.95;

export interface Thermometer {
  group: Group;
  /** Where the caption stands (above the tube). */
  top: Object3D;
  /** 0 hidden … 1 shown: it grows up out of its clip. */
  shown: number;
  /** 0 the column at the tick … 1 one tick's height above it. */
  level: number;
  /** Put it on a straight wire: the clip's centre (board x, z) and whether the wire runs along board z. */
  place(x: number, z: number, alongZ: boolean): void;
  update(): void;
}

export function thermometer(): Thermometer {
  const group = new Group();
  group.name = 'resistance-thermometer';
  const inner = new Group();
  group.add(inner);
  // drawn larger than life, so that its column reads on the step's shot (a little less in height: it must not
  // reach up into the lamp)
  group.scale.set(SIZE, SIZE * 0.85, SIZE);
  const orange = tame(K.toon({ color: 'orange', emissive: 'orange', emissiveIntensity: 0.25, gloss: 0.4 }));
  const clipMat = tame(K.toon({ color: 'slate', gloss: 0.5 }));
  // the clip: a ring round the wire (its axis along the wire, board x) and a short neck up to the bulb
  const clip = new Mesh(new TorusGeometry(WIRE.sheath + 0.014, 0.016, 8, 28), clipMat);
  clip.rotation.y = Math.PI / 2;
  const neck = new Mesh(new CylinderGeometry(0.018, 0.022, BULB.y - BULB.radius, 10), clipMat);
  neck.position.y = (BULB.y - BULB.radius) / 2 + 0.02;
  const bulb = new Mesh(new SphereGeometry(BULB.radius, 20, 14), orange);
  bulb.position.y = BULB.y;
  // the column: a unit cylinder from the bulb up, scaled to its height
  const columnGeo = new CylinderGeometry(COLUMN_R, COLUMN_R, 1, 12);
  columnGeo.translate(0, 0.5, 0);
  const column = new Mesh(columnGeo, orange);
  column.position.y = BULB.y;
  const glass = new Mesh(
    new CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.to - TUBE.from, 18, 1, false),
    sheath({ color: col('white'), opacity: 0.24, edgeOpacity: 0.85, gloss: 0.9, highlight: 0.5 }),
  );
  glass.position.y = (TUBE.from + TUBE.to) / 2;
  glass.renderOrder = 3;
  const cap = new Mesh(
    new SphereGeometry(TUBE.radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    glass.material,
  );
  cap.position.y = TUBE.to;
  cap.renderOrder = 3;
  // the one tick, on the side that faces the reader, a little wider than the tube
  const tick = new Mesh(
    new CylinderGeometry(TUBE.radius + 0.006, TUBE.radius + 0.006, TICK_H, 24, 1, true),
    K.glow({ color: 'white', intensity: 0.9 }),
  );
  tick.position.y = TICK_Y;
  for (const m of [clip, neck, bulb, column]) m.castShadow = true;
  inner.add(clip, neck, bulb, column, glass, cap, tick);
  const top = new Group();
  top.position.y = TUBE.to + 0.08;
  inner.add(top);
  const t: Thermometer = {
    group,
    top,
    shown: 0,
    level: 0,
    place(x, z, alongZ) {
      group.position.copy(new Vector3(x, LOOP.y, z));
      // the clip's ring goes round the wire; the tick faces the reader either way
      clip.rotation.y = alongZ ? 0 : Math.PI / 2;
    },
    update() {
      const s = Math.min(Math.max(t.shown, 0), 1);
      group.visible = s > 0.004;
      // it grows up out of the clip: the clip first, the tube after (an eased scale along the board's up)
      const e = s * s * (3 - 2 * s);
      inner.scale.set(0.6 + 0.4 * e, Math.max(e, 1e-3), 0.6 + 0.4 * e);
      // at rest the column ends at the tick's upper edge; with the current it stands one tick's height above it
      column.scale.y = TICK_Y + TICK_H / 2 + TICK_H * Math.min(Math.max(t.level, 0), 1) - BULB.y;
    },
  };
  return t;
}
