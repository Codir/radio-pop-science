/**
 * The voltage gauge (VISUAL.md §5.7): a small instrument with ONE big scale, a needle and a number; two springy
 * probes lean on the battery's clamps. It is a tool like the magnifier, not a part of the circuit: smaller
 * than the battery, and nothing on it but the scale and the number.
 *
 * It hangs above and behind the battery, facing the reader (board frame). `value` is in volts (0 … 2).
 */
import { Group, Mesh, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { K, SEMANTIC, col } from '@/style';
import { Text3D } from '@/text';
import { BATTERY } from '../layout';

export interface GaugeModel {
  group: Group;
  /** Volts shown by the needle and the number (0 … 2). */
  value: number;
  /** 0 = away (folded up, probes off the clamps) … 1 = probes on the clamps. */
  shown: number;
  /** Brightness of the unlit number, to follow the room's light (0.3 dark … 1 lit). */
  light: number;
}

const WIDTH = 1.52;
const HEIGHT = 0.8;
/** Scale: 0 … 2 V over 104° of arc on the left of the face; the number stands to its right. */
const SWEEP = (104 * Math.PI) / 180;
const PIVOT_X = -0.24;
const PIVOT_Y = -0.2;
const RADIUS = 0.4;
const MAX = 2;

const angleOf = (volts: number): number => SWEEP / 2 - (Math.min(Math.max(volts, 0), MAX) / MAX) * SWEEP;

export function createGauge(): GaugeModel {
  const b = new Builder('gauge');
  b.box(WIDTH, HEIGHT, 0.24, { mid: true, r: 0.11, seg: 3, c: ['ink', 'slate'] });
  // face: a slightly lighter inset
  b.box(WIDTH - 0.14, HEIGHT - 0.14, 0.02, {
    mid: true,
    at: [0, 0, 0.12],
    r: 0.07,
    slot: 'matte',
    c: col('bg.violet').lerp(col('slate'), 0.3),
  });
  // the scale: ticks every 0.1 V, longer every 0.5 V
  for (let i = 0; i <= 20; i++) {
    const a = angleOf(i / 10);
    const major = i % 5 === 0;
    const len = major ? 0.1 : 0.05;
    const r = RADIUS + len / 2;
    b.box(major ? 0.026 : 0.014, len, 0.012, {
      mid: true,
      at: [PIVOT_X + Math.sin(a) * r, PIVOT_Y + Math.cos(a) * r, 0.135],
      rot: [0, 0, -a],
      r: 0,
      slot: 'matte',
      c: major ? 'white' : 'mist',
    });
  }
  b.cyl(0.055, 0.03, { at: [PIVOT_X, PIVOT_Y, 0.13], axis: 'z', seg: 20, slot: 'metal', c: 'mist' });
  // probes: two springy steel arcs from the body's lower corners down to the clamps' leaves
  const half = BATTERY.length / 2;
  for (const s of [-1, 1] as const) {
    const tipX = s < 0 ? -half - 0.2 : half + 0.105;
    const path = G.roundPath(
      [
        new Vector3(s * (WIDTH / 2 - 0.16), -HEIGHT / 2 + 0.03, 0),
        new Vector3(s * (WIDTH / 2 + 0.12), -HEIGHT / 2 - 0.2, 0.05),
        new Vector3(tipX, -0.86, 0.34),
        new Vector3(tipX, -1.0, 0.42),
      ],
      0.22,
      6,
    );
    b.tube(path, 0.017, { seg: 8, slot: 'metal', c: ['steel', 'mist'] });
    b.sphere(0.05, {
      at: [tipX, -1.0, 0.42],
      seg: 12,
      slot: 'gloss',
      c: s > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus,
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
  needle.position.set(PIVOT_X, PIVOT_Y, 0.148);
  const number = new Text3D('1,5 V', {
    font: 'display',
    size: 0.17,
    color: 'white',
    anchorX: 'center',
    anchorY: 'middle',
    halo: false,
    rich: false,
  });
  number.position.set(WIDTH / 2 - 0.36, -0.02, 0.136);
  group.add(needle, number);

  // home: above and behind the battery, facing the reader; "away" = lifted and tipped back
  const home = new Vector3(BATTERY.x, 1.72, BATTERY.z - 0.66);
  let value = 1.5;
  let shown = 1;
  let text = '';
  let light = 1;
  const white = col('white');
  const apply = (): void => {
    needle.rotation.z = angleOf(value);
    const next = `${value.toFixed(1).replace('.', ',')} V`;
    if (next !== text) number.text = text = next;
    const e = shown * shown * (3 - 2 * shown);
    group.visible = shown > 0.004;
    group.position.copy(home).add(new Vector3(0, 0.9 * (1 - e), -0.35 * (1 - e)));
    group.rotation.x = -0.26 - 0.5 * (1 - e);
    group.scale.setScalar(0.4 + 0.6 * e);
  };
  apply();
  return {
    group,
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
      number.color = white.clone().multiplyScalar(0.35 + 0.65 * light);
    },
  };
}
