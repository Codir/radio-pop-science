/**
 * The three things of the water picture (VISUAL §5.7 «Водяна картинка», `flow/pump`) that take the places of the
 * battery, the lamp and the switch — each a clear glass vessel the reader sees into, in the stand's materials:
 * - the pump: a round glass housing on an ink plinth with the battery's `amber` band, light water inside and a
 *   five-bladed impeller turning on an amber hub; inlet and outlet collars in line with the pipes;
 * - the narrow place: a round glass chamber standing where the lamp was and about its size, facing the reader, with
 *   a paddle wheel inside (white paddles, amber hub) — the pipes taper into it from both sides;
 * - the tap: a steel valve on the pipe with the switch's yellow handle (along the pipe = open, across = shut).
 * Board frame; each model's origin is where it stands on the board.
 */
import { CylinderGeometry, DoubleSide, Group, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';
import { Builder } from '@/kit';
import { col, type KToonMaterial } from '@/style';
import { LOOP } from '@circuit/shared/stage';
import { sheath } from '@circuit/shared/stage/materials';

export interface Spinner {
  group: Group;
  /** The part that turns (the impeller about local y, the wheel about local z, the handle about local y). */
  turn: Group;
}

const STEEL = ['steel', 'mist'] as const;
/** Light water seen through glass: translucent, lit, a touch of glow so it reads in the cold room. */
export const waterLook = () =>
  sheath({
    color: col('sky').lerp(col('white'), 0.35),
    opacity: 0.42,
    edgeOpacity: 0.7,
    gloss: 0.6,
    emissive: 'sky',
    emissiveIntensity: 0.18,
  });
export const glassLook = () =>
  sheath({
    color: col('sky').lerp(col('white'), 0.75),
    opacity: 0.1,
    edgeOpacity: 0.55,
    gloss: 1,
    highlight: 0.9,
  });

/** Housing radius and height of the pump (board units). */
export const PUMP = { r: 0.5, h: 0.5, base: 0.13 } as const;

export function createPump(): Spinner {
  const b = new Builder('flow-pump');
  b.cyl(PUMP.r + 0.06, 0.07, { seg: 48, c: ['ink', 'slate'], bevel: 0.02 });
  b.cyl(PUMP.r + 0.04, 0.06, { at: [0, 0.07, 0], seg: 48, slot: 'gloss', c: 'amber' });
  b.ring(PUMP.r, 0.028, {
    at: [0, PUMP.base + PUMP.h, 0],
    axis: 'y',
    seg: 48,
    tubeSeg: 8,
    slot: 'metal',
    c: STEEL,
  });
  // inlet and outlet: steel collars on the housing's flanks, on the pipe's axis
  for (const s of [-1, 1] as const)
    b.cyl(0.165, 0.1, {
      at: [s * (PUMP.r + 0.02), LOOP.y, 0],
      rot: [0, 0, (s * Math.PI) / 2],
      seg: 24,
      slot: 'metal',
      c: STEEL,
      bevel: 0.015,
    });
  // the axle down through the lid
  b.cyl(0.03, PUMP.h, { at: [0, PUMP.base, 0], seg: 12, slot: 'metal', c: 'mist' });
  const model = b.build();
  const ib = new Builder('flow-impeller');
  ib.cyl(0.09, 0.14, { at: [0, -0.07, 0], seg: 20, slot: 'gloss', c: 'amber' });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ib.box(0.34, 0.2, 0.05, {
      at: [Math.cos(a) * 0.24, -0.1, -Math.sin(a) * 0.24],
      rot: [0, a + 0.3, 0],
      r: 0.015,
      slot: 'gloss',
      c: ['white', 'mist'],
    });
  }
  const turn = ib.build().group;
  turn.position.y = PUMP.base + PUMP.h * 0.55;
  const inside = new Mesh(new CylinderGeometry(PUMP.r - 0.03, PUMP.r - 0.03, PUMP.h * 0.86, 48), waterLook());
  inside.position.y = PUMP.base + PUMP.h * 0.43;
  inside.renderOrder = 3;
  const wall = new Mesh(new CylinderGeometry(PUMP.r, PUMP.r, PUMP.h, 48, 1, false), glassLook());
  wall.position.y = PUMP.base + PUMP.h / 2;
  wall.renderOrder = 4;
  model.group.add(turn, inside, wall);
  return { group: model.group, turn };
}

/** The narrow place's chamber: radius, depth, centre height. */
export const CHAMBER = { r: 0.6, depth: 0.32, y: 0.64 } as const;

export function createChamber(): Spinner {
  const group = new Group();
  // standing on a short ink foot, faced to the reader (local +z), the chamber's bottom just under the pipes
  const b = new Builder('flow-chamber');
  for (const sx of [-1, 1] as const)
    b.box(0.12, CHAMBER.y - 0.2, 0.36, { at: [sx * (CHAMBER.r - 0.12), 0, 0], r: 0.03, c: ['ink', 'slate'] });
  b.ring(CHAMBER.r, 0.035, {
    at: [0, CHAMBER.y, CHAMBER.depth / 2],
    axis: 'z',
    seg: 56,
    tubeSeg: 8,
    slot: 'metal',
    c: STEEL,
  });
  b.ring(CHAMBER.r, 0.035, {
    at: [0, CHAMBER.y, -CHAMBER.depth / 2],
    axis: 'z',
    seg: 56,
    tubeSeg: 8,
    slot: 'metal',
    c: STEEL,
  });
  b.cyl(0.04, CHAMBER.depth + 0.08, {
    at: [0, CHAMBER.y, -CHAMBER.depth / 2 - 0.04],
    rot: [Math.PI / 2, 0, 0],
    seg: 12,
    slot: 'metal',
    c: 'mist',
  });
  group.add(b.build().group);
  const body = new CylinderGeometry(CHAMBER.r, CHAMBER.r, CHAMBER.depth, 56, 1, false);
  body.rotateX(Math.PI / 2);
  const inside = new Mesh(body.clone().scale(0.96, 0.96, 0.9), waterLook());
  inside.position.y = CHAMBER.y;
  inside.renderOrder = 3;
  const wall = new Mesh(body, glassLook());
  wall.position.y = CHAMBER.y;
  wall.renderOrder = 4;
  const wb = new Builder('flow-wheel');
  wb.cyl(0.085, 0.18, { at: [0, 0, -0.09], rot: [Math.PI / 2, 0, 0], seg: 20, slot: 'gloss', c: 'amber' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    // a box grows from its base along its own y: here from the hub outward along the spoke
    wb.box(0.06, 0.27, 0.15, {
      at: [Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0],
      rot: [0, 0, a - Math.PI / 2],
      r: 0.015,
      slot: 'gloss',
      c: ['white', 'mist'],
    });
  }
  const wheel = wb.build();
  // white paddles that stay white behind the glass and the water
  (wheel.mats.get('gloss') as KToonMaterial).setEmissive('white', 0.18);
  const turn = wheel.group;
  turn.position.y = CHAMBER.y;
  turn.scale.setScalar(CHAMBER.r / 0.46); // the paddles were laid out for a chamber of 0.46
  group.add(turn, inside, wall);
  return { group, turn };
}

export function createTap(): Spinner & { hit: Mesh } {
  const b = new Builder('flow-tap');
  b.sphere(0.21, { at: [0, LOOP.y, 0], seg: 24, slot: 'metal', c: STEEL });
  for (const s of [-1, 1] as const)
    b.cyl(0.165, 0.12, {
      at: [s * 0.2, LOOP.y, 0],
      rot: [0, 0, (s * Math.PI) / 2],
      seg: 24,
      slot: 'metal',
      c: STEEL,
      bevel: 0.015,
    });
  b.cyl(0.07, 0.2, { at: [0, LOOP.y + 0.16, 0], seg: 16, slot: 'metal', c: 'mist', bevel: 0.015 });
  const model = b.build();
  const lb = new Builder('flow-tap-handle');
  lb.cyl(0.1, 0.09, { seg: 20, slot: 'gloss', c: ['amber', 'yellow'] });
  lb.box(0.66, 0.08, 0.15, { at: [0.3, 0.005, 0], r: 0.04, slot: 'gloss', c: ['amber', 'yellow'] });
  lb.box(0.14, 0.12, 0.2, { at: [0.62, 0, 0], r: 0.05, slot: 'gloss', c: 'yellow.light' });
  const handle = lb.build();
  // the switch's yellow, kept yellow in the cold room by a little glow of its own (as the switch's thumb does)
  (handle.mats.get('gloss') as KToonMaterial).setEmissive('yellow', 0.22);
  const turn = handle.group;
  turn.position.y = LOOP.y + 0.36;
  const hit = new Mesh(
    new SphereGeometry(0.5, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide }),
  );
  hit.position.set(0.15, LOOP.y + 0.25, 0);
  hit.name = 'flow-tap-hit';
  model.group.add(turn, hit);
  return { group: model.group, turn, hit };
}
