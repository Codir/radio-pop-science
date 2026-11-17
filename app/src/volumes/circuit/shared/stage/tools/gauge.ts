/**
 * The voltage gauge (VISUAL.md §5.7, chapter `battery/voltage`, `drain/*`): a small desk instrument lying on the
 * table at the stand's near edge, in front of the battery, its face leaning back toward the reader. ONE big
 * printed scale 0 … 2 V, a needle and the number; nothing else on it. Two springy probes on leads — `blue` for
 * the minus, `coral` for the plus — rest on the table beside it and are laid on the battery's clamps
 * (`probes.minus.on`, `probes.plus.on`), or follow the reader's hand (`probes.*.hold(world)`).
 *
 * Built in the BOARD frame (the tools' frame); the table is placed through `boardToWorld`'s inverse.
 */
import { Group, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { K, SEMANTIC, col } from '@/style';
import { Text3D } from '@/text';
import { BOARD_Y } from '../base';
import { DynTube, resample } from '../dyn-tube';
import { BATTERY, BOARD } from '../layout';

export type ProbeId = 'minus' | 'plus';

export interface Probe {
  /** 0 = resting on the table beside the meter … 1 = its tip on its clamp (eased in between). */
  on: number;
  /** The probe's body: register it with `ctx.input` to drag it. */
  handle: Group;
  /** Follow the hand: the tip goes to this world point (null = back to `on`'s place). */
  hold(world: Vector3 | null): void;
  /** Where the tip touches its clamp (world) — snap when the hand comes near it. */
  readonly pole: Vector3;
  /** Where the tip is now (world). */
  readonly tip: Vector3;
  /** Where the tip lies at rest beside the meter (world; while the meter is shown). */
  readonly rest: Vector3;
}

export interface GaugeModel {
  group: Group;
  /** Volts shown by the needle and the number (0 … 2). Feed it `followVoltage(…)` for the real needle. */
  value: number;
  /** 0 = away … 1 = on the table (it slides in, growing from 0.4 of its size). */
  shown: number;
  /** Brightness of the unlit number and scale, to follow the room's light (0.3 dark … 1 lit). */
  light: number;
  probes: Record<ProbeId, Probe>;
  /** Both tips on their clamps (`on` ≥ 0.99 and not held elsewhere). */
  readonly touching: boolean;
  /** On the meter's face, at the number (callout anchor). */
  readonly anchor: Object3D;
}

const WIDTH = 1.5;
const HEIGHT = 0.95;
const DEPTH = 0.26;
/** Scale: 0 … 2 V over 104° of arc; the number below its right end. */
const SWEEP = (104 * Math.PI) / 180;
const PIVOT_X = -0.17;
const PIVOT_Y = -0.27;
const RADIUS = 0.44;
const MAX = 2;
/** The face leans back: 55° above the horizon in the world (≈ the main shot's view), its lower edge on the table. */
const LEAN = (55 * Math.PI) / 180;

const angleOf = (volts: number): number => SWEEP / 2 - (Math.min(Math.max(volts, 0), MAX) / MAX) * SWEEP;
const smooth = (v: number): number => {
  const k = Math.min(Math.max(v, 0), 1);
  return k * k * (3 - 2 * k);
};

const COS = Math.cos(BOARD.tilt);
const SIN = Math.sin(BOARD.tilt);
/** World → board frame (the inverse of `boardToWorld`; the stage group sits at the world origin). */
function toBoard(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  const h = y - BOARD_Y;
  return out.set(x, h * COS + z * SIN, -h * SIN + z * COS);
}
function toWorld(v: Vector3, out = new Vector3()): Vector3 {
  return out.set(v.x, BOARD_Y + v.y * COS - v.z * SIN, v.y * SIN + v.z * COS);
}

/**
 * On the table in front of the board's near edge, below the minus half of the battery and the lens holder (world;
 * y = the table's top): left of the frame's middle, so on the stand plan lowered a little (`battery/voltage`) it
 * stays clear of the interface's bar at the bottom centre.
 */
export const GAUGE_HOME = new Vector3(BATTERY.x - 1.05, 0, BOARD.depth / 2 + 0.62);
const HOME_WORLD = GAUGE_HOME;

/** The instrument's body, face, scale (ticks + printed numbers) and needle; face +z, origin = body centre. */
function buildMeter(): { group: Group; needle: Group; number: Text3D; prints: Text3D[] } {
  const b = new Builder('gauge');
  b.box(WIDTH, HEIGHT, DEPTH, { mid: true, r: 0.11, seg: 3, c: ['ink', 'slate'] });
  b.box(WIDTH - 0.14, HEIGHT - 0.14, 0.02, {
    mid: true,
    at: [0, 0, DEPTH / 2],
    r: 0.07,
    slot: 'matte',
    c: col('bg.violet').lerp(col('slate'), 0.3),
  });
  // ticks every 0.1 V, longer every 0.5 V
  for (let i = 0; i <= 20; i++) {
    const a = angleOf(i / 10);
    const major = i % 5 === 0;
    const len = major ? 0.1 : 0.05;
    const r = RADIUS + len / 2;
    b.box(major ? 0.026 : 0.014, len, 0.012, {
      mid: true,
      at: [PIVOT_X - Math.sin(a) * r, PIVOT_Y + Math.cos(a) * r, DEPTH / 2 + 0.015],
      rot: [0, 0, a],
      r: 0,
      slot: 'matte',
      c: major ? 'white' : 'mist',
    });
  }
  b.cyl(0.055, 0.03, {
    at: [PIVOT_X, PIVOT_Y, DEPTH / 2 + 0.01],
    axis: 'z',
    seg: 20,
    slot: 'metal',
    c: 'mist',
  });
  // the two sockets of the leads on the top edge
  for (const s of [-1, 1] as const) {
    b.cyl(0.05, 0.05, {
      at: [s * (WIDTH / 2 - 0.2), HEIGHT / 2 - 0.015, -0.02],
      axis: 'y',
      seg: 16,
      slot: 'gloss',
      c: s < 0 ? SEMANTIC.dcMinus : SEMANTIC.dcPlus,
    });
  }
  const model = b.build();
  const group = model.group;
  const needle = new Group();
  const blade = new Mesh(
    G.rbox(0.03, RADIUS + 0.04, 0.012, 0.005, 1),
    K.toon({ color: SEMANTIC.fieldE, emissive: SEMANTIC.fieldE, emissiveIntensity: 0.35, keepHue: true }),
  );
  blade.position.y = (RADIUS + 0.04) / 2 - 0.02;
  needle.add(blade);
  needle.position.set(PIVOT_X, PIVOT_Y, DEPTH / 2 + 0.028);
  const text = (s: string, size: number): Text3D =>
    new Text3D(s, {
      font: 'display',
      size,
      color: 'white',
      anchorX: 'center',
      anchorY: 'middle',
      halo: false,
      rich: false,
    });
  const number = text('1,6 V', 0.17);
  number.position.set(WIDTH / 2 - 0.33, PIVOT_Y + 0.02, DEPTH / 2 + 0.016);
  // the printed scale: 0 · 0,5 · 1 · 1,5 · 2 just outside the major ticks
  const prints = ['0', '0,5', '1', '1,5', '2'].map((s, i) => {
    const t = text(s, 0.1);
    const a = angleOf(i / 2);
    t.position.set(
      PIVOT_X - Math.sin(a) * (RADIUS + 0.17),
      PIVOT_Y + Math.cos(a) * (RADIUS + 0.17),
      DEPTH / 2 + 0.016,
    );
    return t;
  });
  group.add(needle, number, ...prints);
  return { group, needle, number, prints };
}

/** A probe: steel needle, collar and the coloured handle along +y from the tip at the origin. */
function buildProbe(id: ProbeId): Group {
  const b = new Builder(`gauge-probe-${id}`);
  b.cyl(0.013, 0.17, { at: [0, 0, 0], axis: 'y', seg: 10, slot: 'metal', c: 'mist', bevel: 0.006 });
  b.cyl(0.032, 0.035, { at: [0, 0.16, 0], axis: 'y', seg: 14, slot: 'metal', c: 'steel', bevel: 0.01 });
  b.cyl(0.045, 0.33, {
    at: [0, 0.19, 0],
    axis: 'y',
    seg: 16,
    slot: 'gloss',
    c: id === 'minus' ? SEMANTIC.dcMinus : SEMANTIC.dcPlus,
    bevel: 0.02,
  });
  b.cyl(0.03, 0.05, { at: [0, 0.515, 0], axis: 'y', seg: 12, slot: 'toon', c: 'ink', bevel: 0.012 });
  return b.build().group;
}
/** The tip-to-lead length of a probe. */
const PROBE_BACK = 0.56;

export function createGauge(): GaugeModel {
  const group = new Group();
  group.name = 'gauge';
  const meter = buildMeter();
  group.add(meter.group);
  // the meter leans back by LEAN in the world: in the board frame that is LEAN plus the board's own tilt
  const lean = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -LEAN - BOARD.tilt);
  const upW = new Vector3(0, Math.cos(-LEAN), Math.sin(-LEAN));
  const backW = new Vector3(0, Math.sin(LEAN), Math.cos(LEAN));
  // lowest point of the leaning box on the table
  const lift = (HEIGHT / 2) * upW.y + (DEPTH / 2) * backW.y + 0.02;
  const homeBoard = toBoard(HOME_WORLD.x, lift, HOME_WORLD.z);
  const awayBoard = toBoard(HOME_WORLD.x, lift, HOME_WORLD.z + 0.9);
  const toBoardDir = (x: number, y: number, z: number): Vector3 => toBoard(x, y + BOARD_Y, z).normalize();

  const leadMat = K.toon({ color: col('ink').lerp(col('slate'), 0.5), gloss: 0.4, highlight: 0.4 });
  const ids: ProbeId[] = ['minus', 'plus'];
  const half = BATTERY.length / 2;
  const probes = {} as Record<ProbeId, Probe>;
  const parts = ids.map((id) => {
    const sign = id === 'minus' ? -1 : 1;
    const body = buildProbe(id);
    body.traverse((o) => (o.castShadow = false));
    const handle = new Group();
    handle.name = `gauge:probe-${id}`;
    handle.add(body);
    const lead = new DynTube(30, 8);
    const leadMesh = new Mesh(lead.geometry, leadMat);
    leadMesh.frustumCulled = false;
    group.add(handle, leadMesh);
    // on its clamp: the tip on the outer face of the spring leaf, half-way up, the handle up and out
    const leafX = sign < 0 ? BATTERY.x - half - 0.2 : BATTERY.x + half + 0.105;
    const poleBoard = new Vector3(leafX + sign * 0.04, BATTERY.y + 0.12, BATTERY.z + 0.1);
    const onAxis = new Vector3(sign * 0.55, 0.75, 0.38).normalize();
    // resting: lying on the table beside the meter, handle toward the reader
    const restBoard = toBoard(HOME_WORLD.x + sign * (WIDTH / 2 + 0.32), 0.05, HOME_WORLD.z - 0.25);
    const restAxis = toBoardDir(sign * 0.25, 0.06, 1);
    const state = { on: 1, held: null as Vector3 | null };
    const tip = new Vector3();
    const tipWorld = new Vector3();
    const restWorld = new Vector3();
    const poleWorld = toWorld(poleBoard);
    const probe: Probe = {
      get on() {
        return state.on;
      },
      set on(v: number) {
        state.on = Math.min(Math.max(v, 0), 1);
        apply();
      },
      handle,
      hold(world) {
        state.held = world ? toBoard(world.x, world.y, world.z) : null;
        apply();
      },
      get pole() {
        return poleWorld;
      },
      get tip() {
        return toWorld(tip, tipWorld);
      },
      get rest() {
        return toWorld(restBoard, restWorld);
      },
    };
    probes[id] = probe;
    return { id, sign, handle, lead, state, tip, poleBoard, onAxis, restBoard, restAxis };
  });

  let value = 1.6;
  let shown = 1;
  let text = '';
  let light = 1;
  const white = col('white');
  const up = new Vector3(0, 1, 0);
  const axis = new Vector3();
  const q = new Quaternion();
  const socket = new Vector3();
  const back = new Vector3();
  const pts = Array.from({ length: 6 }, () => new Vector3());
  const path: Vector3[] = [];
  const leadUp = new Vector3(0, 1, 0);
  const apply = (): void => {
    meter.needle.rotation.z = angleOf(value);
    const next = `${value.toFixed(1).replace('.', ',')} V`;
    if (next !== text) meter.number.text = text = next;
    const e = smooth(shown);
    group.visible = shown > 0.004;
    meter.group.position.lerpVectors(awayBoard, homeBoard, e);
    meter.group.quaternion.copy(lean);
    meter.group.scale.setScalar(0.4 + 0.6 * e);
    meter.group.updateMatrix();
    for (const p of parts) {
      const k = smooth(p.state.on) * e;
      if (p.state.held) p.tip.copy(p.state.held);
      else p.tip.lerpVectors(p.restBoard, p.poleBoard, k);
      const lifted = p.state.held ? smooth(p.tip.distanceTo(p.restBoard) / 0.5) : k;
      axis.lerpVectors(p.restAxis, p.onAxis, lifted).normalize();
      p.handle.position.copy(p.tip);
      p.handle.quaternion.copy(q.setFromUnitVectors(up, axis));
      p.handle.visible = e > 0.02;
      // the lead: from the meter's socket down to the table, a sag, up into the probe's back
      socket.set(p.sign * (WIDTH / 2 - 0.2), HEIGHT / 2 + 0.03, -0.02).applyMatrix4(meter.group.matrix);
      back.copy(p.tip).addScaledVector(axis, PROBE_BACK);
      pts[0]!.copy(socket);
      pts[1]!.copy(socket).add(toBoardDir(p.sign * 0.1, 1, -0.3).multiplyScalar(0.2));
      pts[2]!.lerpVectors(socket, back, 0.45).add(toBoardDir(0, -1, 0).multiplyScalar(0.12));
      pts[3]!.lerpVectors(socket, back, 0.75).addScaledVector(axis, 0.25);
      pts[4]!.copy(back).addScaledVector(axis, 0.14);
      pts[5]!.copy(back);
      resample(G.roundPath(pts, 0.3, 6), p.lead.rings, path);
      p.lead.update(path, leadUp, (_i, out) => {
        out[0] = out[1] = 0.024 * (0.4 + 0.6 * e);
      });
    }
  };
  const anchor = new Object3D();
  anchor.position.copy(meter.number.position);
  meter.group.add(anchor);
  apply();
  return {
    group,
    probes,
    anchor,
    get touching() {
      return parts.every((p) => p.state.on >= 0.99 && !p.state.held);
    },
    get value() {
      return value;
    },
    set value(v: number) {
      value = v;
      apply();
    },
    get shown() {
      return shown;
    },
    set shown(v: number) {
      shown = Math.min(Math.max(v, 0), 1);
      apply();
    },
    get light() {
      return light;
    },
    set light(v: number) {
      light = Math.min(Math.max(v, 0), 1);
      const c = white.clone().multiplyScalar(0.35 + 0.65 * light);
      meter.number.color = c;
      for (const t of meter.prints) t.color = c;
    },
  };
}
