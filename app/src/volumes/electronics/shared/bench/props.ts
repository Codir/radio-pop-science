/**
 * The permanent things of the bench as stand-ins (docs/volumes/electronics/VISUAL.md §2, §4.1, §5, §6): each one on
 * its place, of its size and in its colours, built from a few plain shapes — the battery's open box with the switch
 * on its lid, the player, the speaker, the lamp on its post, the magnifier's holder, the tray of parts and the two
 * instruments. The models with real marks replace them in batch E2 (parts E2-4, tray E2-5, meter E2-6, oscilloscope
 * E2-9); their places, sizes and the lamp's filament (where the light of the lamp hangs) stay.
 */
import { Group, Mesh, Object3D, SphereGeometry, Vector3 } from 'three';
import { Builder } from '@/kit';
import { col } from '@/style';
import { LAMP, PLACES } from './layout';
import { sheath } from './materials';
import { addLampPost, addLensHolder } from './mounts';
import { SLIDER_TRAVEL, SLIDER_Y, createSlider, type SliderModel } from './switch-slider';

const mix = (a: string, b: string, k: number) => col(a).lerp(col(b), k);
const STEEL = ['steel', 'mist'] as const;

/** Where the instruments wait while no step has them: beyond the frame's edge, on the table (world x, z). */
export const AWAY = {
  meter: [PLACES.meter.x - 4.2, PLACES.meter.z + 0.6],
  scope: [PLACES.scope.x + 4.6, PLACES.scope.z],
} as const;

export interface Props {
  /** What stands on the base: add to the base frame. */
  onBase: Group;
  /** What stands on the table (world): the tray and the two instruments. */
  onTable: Group;
  /** The lamp's filament, in the middle of its glass: the lamp's light hangs here. */
  filament: Object3D;
  /** The battery's switch: the yellow slider on the box's lid. */
  slider: SliderModel;
  /** The instruments' groups (world), placed by `place`. */
  meter: Group;
  scope: Group;
  /** 0 = open (the thumb pushed to the left, the gap shows) … 1 = closed. */
  setSwitch(closed: number): void;
  /** The instruments: 0 away beyond the frame's edge … 1 on their places. */
  place(meter: number, scope: number): void;
}

/** The battery's open box with the battery lying in it, the lid at the near end and the switch's two contacts. */
function battery(b: Builder): void {
  const { width: W, depth: D, height: H } = PLACES.battery;
  const box = b.part('batteryBox', { at: [PLACES.battery.x, 0, PLACES.battery.z] });
  const wall = 0.06;
  const lidZ = PLACES.switch.z - PLACES.battery.z; // the switch sits in the middle of the lid
  const lid = 2 * (D / 2 - lidZ); // from the lid's far edge to the box's near wall, the switch in its middle
  box.box(W, 0.08, D, { r: 0.03, c: 'slate' });
  for (const s of [-1, 1] as const) {
    box.box(wall, H, D, { at: [s * (W / 2 - wall / 2), 0, 0], r: 0.02, c: 'slate' });
    box.box(W, H, wall, { at: [0, 0, s * (D / 2 - wall / 2)], r: 0.02, c: 'slate' });
  }
  box.box(W, 0.07, lid, { at: [0, H - 0.07, D / 2 - lid / 2], r: 0.025, c: 'slate' });
  // the 9 V battery lies along z, its contacts under the lid; an amber band beside them
  const len = 1.87;
  const z0 = D / 2 - wall - len / 2;
  box.box(1.02, 0.67, len, { at: [0, 0.08, z0], r: 0.06, slot: 'gloss', c: 'ink' });
  box.box(1.03, 0.68, 0.18, { at: [0, 0.075, D / 2 - lid - 0.1], r: 0.05, slot: 'gloss', c: 'amber' });
  // the switch's two contacts on the lid: steel lands with a stud each, the air gap between them
  for (const s of [-1, 1] as const) {
    const cx = s * (SLIDER_TRAVEL / 2 + 0.11);
    box.box(0.2, 0.04, 0.24, { at: [cx, H, lidZ], r: 0.012, slot: 'metal', c: STEEL });
    box.cyl(0.05, SLIDER_Y, {
      at: [s * (SLIDER_TRAVEL / 2 + 0.06), H, lidZ],
      seg: 14,
      slot: 'metal',
      c: 'mist',
    });
  }
}

/** The player: a flat `slate` box with a dark window and a «play» triangle (geometry, not text). */
function player(b: Builder): void {
  const { width: W, depth: D, height: H } = PLACES.player;
  const p = b.part('player', { at: [PLACES.player.x, 0, PLACES.player.z] });
  p.box(W, H, D, { r: 0.08, c: 'slate' });
  p.box(W * 0.72, 0.012, D * 0.4, { at: [0, H, -D * 0.16], r: 0.004, slot: 'gloss', c: 'ink' });
  p.cyl(0.13, 0.014, { at: [0, H, D * 0.24], seg: 3, rot: [0, Math.PI / 2, 0], c: 'mist' });
}

/** The speaker, face up on three low feet: `steel` frame and magnet, `slate` surround, `ink` cone. */
function speaker(b: Builder): void {
  const R = PLACES.speaker.radius;
  const s = b.part('speaker', { at: [PLACES.speaker.x, 0, PLACES.speaker.z] });
  for (const a of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6])
    s.cyl(0.07, 0.2, { at: [Math.cos(a) * R * 0.62, 0, Math.sin(a) * R * 0.62], seg: 12, c: 'ink' });
  s.cyl(R * 0.42, 0.14, { at: [0, 0.06, 0], seg: 32, slot: 'metal', c: STEEL, bevel: 0.03 });
  s.lathe(
    [
      [R * 0.3, 0.2],
      [R, 0.3],
      [R, 0.36],
      [R * 0.86, 0.36],
      [R * 0.3, 0.24],
    ],
    { seg: 48, slot: 'metal', c: 'steel' },
  );
  s.lathe(
    [
      [0, 0.25],
      [R * 0.3, 0.25],
      [R * 0.78, 0.34],
      [R * 0.86, 0.36],
      [R * 0.86, 0.365],
      [0, 0.365],
    ],
    { seg: 48, c: 'ink' },
  );
  s.ring(R * 0.85, 0.035, { at: [0, 0.37, 0], axis: 'y', seg: 48, tubeSeg: 8, c: 'slate' });
  s.dome(R * 0.22, 0.06, { at: [0, 0.27, 0], seg: 24, c: 'ink' });
}

/** The tray on the table: a stepped `slate` block, two rows of six slots with dark foam (VISUAL §6). */
function tray(b: Builder): void {
  const { width: W, front, back, slots } = PLACES.tray;
  const z0 = PLACES.tray.z - PLACES.tray.depth / 2; // the back edge, right against the base
  const t = b.part('tray', { at: [PLACES.tray.x, 0, 0] });
  t.box(W, back.top, back.depth, { at: [0, 0, z0 + back.depth / 2], r: 0.05, c: 'slate' });
  t.box(W, front.top, front.depth, { at: [0, 0, z0 + back.depth + front.depth / 2], r: 0.05, c: 'slate' });
  const pitch = W / slots;
  for (let i = 0; i < slots; i++) {
    const x = (i - (slots - 1) / 2) * pitch;
    t.box(pitch - 0.12, 0.02, back.depth - 0.14, {
      at: [x, back.top, z0 + back.depth / 2],
      r: 0.008,
      c: 'ink',
    });
    t.box(pitch - 0.12, 0.02, front.depth - 0.12, {
      at: [x, front.top, z0 + back.depth + front.depth / 2],
      r: 0.008,
      c: 'ink',
    });
  }
}

/** The multimeter, display up, its top away from the reader: display window, the dial, two jacks (VISUAL §5.1). */
function meter(): Group {
  const { width: W, depth: D, height: H } = PLACES.meter;
  const b = new Builder('meter');
  b.box(W, H, D, { r: 0.12, c: 'slate' });
  b.box(W - 0.16, 0.02, D - 0.16, { at: [0, H, 0], r: 0.05, c: 'ink' });
  b.box(W - 0.4, 0.02, 0.62, {
    at: [0, H + 0.01, -D / 2 + 0.5],
    r: 0.03,
    slot: 'gloss',
    c: mix('steel', 'mist', 0.5),
  });
  b.cyl(0.32, 0.08, { at: [0, H + 0.01, 0.15], seg: 32, c: 'slate', bevel: 0.03 });
  b.box(0.06, 0.03, 0.26, { at: [0, H + 0.09, 0.05], r: 0.01, c: 'mist' });
  for (const [x, ring] of [
    [-0.3, 'ink'],
    [0.3, 'coral'],
  ] as const) {
    b.ring(0.09, 0.025, {
      at: [x, H + 0.03, D / 2 - 0.35],
      axis: 'y',
      seg: 24,
      tubeSeg: 8,
      slot: 'gloss',
      c: ring,
    });
    b.cyl(0.06, 0.02, { at: [x, H + 0.01, D / 2 - 0.35], seg: 16, c: 'ink' });
  }
  const group = b.build().group;
  group.name = 'meter';
  return group;
}

/** The oscilloscope on the table, its face toward the reader: a dark screen with no trace yet (VISUAL §5.2). */
function scope(): Group {
  const { width: W, depth: D, height: H } = PLACES.scope;
  const b = new Builder('scope');
  b.box(W, H, D, { r: 0.12, c: 'slate' });
  b.box(W - 0.14, H - 0.14, 0.02, { at: [0, 0.07, D / 2], r: 0.04, c: 'ink' });
  b.box(1.6, 1.28, 0.02, { at: [-0.25, 0.3, D / 2 + 0.012], r: 0.03, slot: 'gloss', c: 'bg.deep' });
  for (const y of [0.55, 1.0, 1.45])
    b.cyl(0.09, 0.06, { at: [0.85, y, D / 2], rot: [Math.PI / 2, 0, 0], seg: 20, c: 'mist' });
  const group = b.build().group;
  group.name = 'scope';
  return group;
}

export function createProps(): Props {
  const b = new Builder('props');
  battery(b);
  player(b);
  speaker(b);
  addLampPost(b);
  addLensHolder(b);
  // the lamp's thread in its socket (the lamp itself is E2-4's copy of the circuit's bulb)
  const lamp = b.part('lamp', { at: [LAMP.x, 0, LAMP.z] });
  lamp.cyl(0.15, LAMP.glassY - LAMP.glass * 0.8 - (LAMP.socketY - 0.12), {
    at: [0, LAMP.socketY - 0.12, 0],
    seg: 24,
    slot: 'metal',
    c: STEEL,
  });
  const model = b.build();
  const onBase = new Group();
  onBase.name = 'props';
  onBase.add(model.group);

  const glass = new Mesh(
    new SphereGeometry(LAMP.glass, 40, 24),
    sheath({ color: col('sky').lerp(col('white'), 0.6), opacity: 0.12, edgeOpacity: 0.55, gloss: 0.9 }),
  );
  glass.position.set(LAMP.x, LAMP.glassY, LAMP.z);
  glass.name = 'lamp:glass';
  glass.renderOrder = 3;
  const filament = new Object3D();
  filament.name = 'lamp:filament';
  filament.position.copy(glass.position);
  onBase.add(glass, filament);

  const slider = createSlider();
  slider.group.position.set(PLACES.switch.x, PLACES.battery.height + SLIDER_Y, PLACES.switch.z);
  onBase.add(slider.group);
  const sliderX = PLACES.switch.x;

  const tb = new Builder('table');
  tray(tb);
  const onTable = new Group();
  onTable.name = 'table-props';
  onTable.add(tb.build().group);
  const m = meter();
  const s = scope();
  onTable.add(m, s);

  const at = new Vector3();
  const smooth = (x: number): number => x * x * (3 - 2 * x);
  /** On the table between where an instrument waits and its place, eased. */
  const slide = (g: Group, from: readonly [number, number], to: { x: number; z: number }, shown: number) => {
    const k = smooth(Math.min(Math.max(shown, 0), 1));
    g.position.set(from[0], 0, from[1]).lerp(at.set(to.x, 0, to.z), k);
    g.visible = shown > 1e-3;
  };
  const props: Props = {
    onBase,
    onTable,
    filament,
    slider,
    meter: m,
    scope: s,
    setSwitch(closed) {
      slider.group.position.x = sliderX - SLIDER_TRAVEL * (1 - Math.min(Math.max(closed, 0), 1));
    },
    place(meterShown, scopeShown) {
      slide(m, AWAY.meter, PLACES.meter, meterShown);
      slide(s, AWAY.scope, PLACES.scope, scopeShown);
    },
  };
  props.setSwitch(0);
  props.place(0, 0);
  return props;
}
