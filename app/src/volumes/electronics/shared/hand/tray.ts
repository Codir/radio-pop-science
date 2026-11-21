/**
 * The tray of parts on the table (docs/volumes/electronics/VISUAL.md §6, «Лоток»): a stepped `slate` block right
 * against the base's front edge with two rows of six slots — the low parts (≤ 0.9 tall with their legs, ≤ 0.5 deep)
 * in front, the tall and wide ones a step higher behind; the row is the part's size's choice. Dark `ink` foam in every
 * slot, and in it a sample of the slot's kind standing as it will stand on the board (its legs bent to its footprint):
 * on its way to the board a part does not change. One slot is one kind (`spec`), and its supply never ends (plan
 * decision 10): a sample taken, a new one rises from the foam in 0.3 s; a part let go off the board flies back into
 * its slot in 0.4 s and is gone into the sample. A part taken gets the next id of the board's counter (`nextId`):
 * `R1`, `R2` … never twice. On the step in front of each slot its label — numbers and units made by the code («4,7 kΩ»,
 * «100 nF 50 V», «1N4007») — shown only where it reads (≥ 16 px-equivalent); an LED has none (its colour shows), nor
 * has a jumper.
 * On a phone the tray is out of the frame: its slots are buttons of the dock (VISUAL §9), the chapter's.
 *
 * World frame (the table): the tray stands level on the table, its slots' samples level with it.
 */
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { fmtSI } from '@/content';
import { Builder } from '@/kit';
import { PARTS } from '@electronics/sim/core';
import { footprintOf, nextId, type BoardState } from '@electronics/sim/board';
import { tame } from '../bench/materials';
import { PLACES } from '../bench/layout';
import {
  DIODES,
  LEG,
  TRANSISTORS,
  buildPart,
  electrolyticPrint,
  type PartEye,
  type PartModel,
} from '../parts';
import { Prints, disposeTree } from '../parts/part';

const T = PLACES.tray;

export const TRAY = {
  /** Width of one slot along the tray. */
  pitch: T.width / T.slots,
  /** The foam on the floor of every slot (its top is where the samples' legs stand). */
  foam: 0.02,
  /** A new sample rises from the foam in this time after one was taken (s). */
  rise: 0.3,
  /** A part let go off the board flies back into its slot in this time (s). */
  back: 0.4,
  /** The low row takes a part at most this tall with its legs and this deep (VISUAL §6). */
  low: { height: 0.9, depth: 0.5 },
  /** The labels' em on the step's face in front of each slot: the front row's face is 0.4 tall, the back row's riser
   * 0.25; from the main shot both read at ≈ 20 px-equivalent (a vertical face seen from ≈ 52° above). */
  label: { front: 0.22, back: 0.19 },
} as const;

export type TrayRow = 'front' | 'back';

/** The size of a part standing as on the board (its nominal tips): how tall, deep (z) and wide (x, with its legs). */
export function partSize(m: PartModel): { height: number; depth: number; width: number } {
  const h = m.hit;
  const first = m.nominal[0]!;
  const last = m.nominal[m.nominal.length - 1]!;
  return {
    height: h.position.y + h.scale.y / 2,
    depth: h.scale.z,
    width: Math.max(h.scale.x, last.x - first.x + 2 * LEG.radius),
  };
}

/** The row the part takes: the low ones in front, the tall or deep ones behind. */
export function trayRow(m: PartModel): TrayRow {
  const s = partSize(m);
  return s.height <= TRAY.low.height + 1e-9 && s.depth <= TRAY.low.depth + 1e-9 ? 'front' : 'back';
}

/** The label of a slot: the value with its unit, a diode's or transistor's model; '' for an LED, a jumper. A
 * capacitor's is its capacitance and its rated voltage, as an electrolytic's can is printed («100 μF 6,3 V»): two
 * capacitors of one value (the 6.3 V and the 16 V can, the ceramic and the film of 100 nF) never share a label, which
 * on a phone is all the dock's button shows (VISUAL §9). */
export function trayLabel(spec: string): string {
  const s = Object.hasOwn(PARTS, spec) ? PARTS[spec]! : undefined;
  if (s === undefined) return '';
  if (s.kind === 'resistor' || s.kind === 'pot') return fmtSI(s.ohms, 'Ω');
  if (s.kind === 'capacitor') return electrolyticPrint(s.farads, s.ratedV);
  if (Object.hasOwn(DIODES, spec)) return DIODES[spec]!;
  if (Object.hasOwn(TRANSISTORS, spec)) return TRANSISTORS[spec]!.print;
  return '';
}

export interface TraySlot {
  readonly spec: string;
  readonly row: TrayRow;
  /** Its place in its row, from the left. */
  readonly index: number;
  /** The middle of the slot on its foam (world): the samples' legs stand at this height. */
  readonly at: Vector3;
  /** The invisible box over the slot: what the hand takes a new part by (gesture 1). */
  readonly hit: Mesh;
  /** The sample standing in the foam. */
  readonly sample: PartModel | null;
  readonly label: string;
}

export interface Tray {
  /** The block, the foam, the samples, the labels; add to the bench's group (world). */
  readonly group: Group;
  readonly slots: readonly TraySlot[];
  /** Stand these kinds in the tray, each in the row its size asks for, in this order from the left. A kind the bench
   * has no model for, or more than six in a row, is a RangeError. */
  set(specs: readonly string[]): void;
  slot(spec: string): TraySlot | undefined;
  /** A new part of the kind from its slot: the next id of the board's counter; a new sample rises. Null when the tray
   * has no such kind. */
  take(spec: string, state: BoardState): string | null;
  /** Where the legs' tips of a part standing in the slot are (world), its sample at rest. */
  tips(spec: string): Vector3[] | null;
  /** Every frame: the rising samples; the labels where they read. */
  update(dt: number, eye?: PartEye): void;
  dispose(): void;
}

interface Slot extends TraySlot {
  sample: PartModel | null;
  /** 0 just taken (deep in the foam) … 1 standing. */
  up: number;
  /** The sample's resting position (world). */
  readonly rest: Vector3;
}

const ease = (x: number): number => x * x * (3 - 2 * x);

/** The stepped block with its foam: the back row high and deep, the front row low and shallow. */
function block(): Group {
  const b = new Builder('tray');
  const { width: W, front, back, slots } = T;
  const z0 = T.z - T.depth / 2; // the back edge, right against the base
  const t = b.part('tray', { at: [T.x, 0, 0] });
  t.box(W, back.top, back.depth, { at: [0, 0, z0 + back.depth / 2], r: 0.05, c: 'slate' });
  t.box(W, front.top, front.depth, { at: [0, 0, z0 + back.depth + front.depth / 2], r: 0.05, c: 'slate' });
  for (let i = 0; i < slots; i++) {
    const x = (i - (slots - 1) / 2) * TRAY.pitch;
    t.box(TRAY.pitch - 0.12, TRAY.foam, back.depth - 0.14, {
      at: [x, back.top, z0 + back.depth / 2],
      r: 0.008,
      c: 'ink',
    });
    t.box(TRAY.pitch - 0.12, TRAY.foam, front.depth - 0.12, {
      at: [x, front.top, z0 + back.depth + front.depth / 2],
      r: 0.008,
      c: 'ink',
    });
  }
  const group = b.build().group;
  group.name = 'tray-block';
  return group;
}

export function createTray(): Tray {
  const group = new Group();
  group.name = 'tray';
  const body = block();
  group.add(body);
  const hitGeometry = new BoxGeometry(1, 1, 1);
  const hitMaterial = new MeshBasicMaterial({ visible: false });
  let slots: Slot[] = [];
  let prints = new Prints();
  const labels = new Group();
  labels.name = 'tray:labels';
  group.add(labels);

  const clear = (): void => {
    for (const s of slots) {
      s.sample?.dispose();
      s.hit.removeFromParent();
    }
    for (const t of prints.texts) {
      t.removeFromParent();
      t.dispose();
    }
    prints = new Prints();
    slots = [];
  };

  const z0 = T.z - T.depth / 2;
  const middle = { back: z0 + T.back.depth / 2, front: z0 + T.back.depth + T.front.depth / 2 } as const;

  const tray: Tray = {
    group,
    get slots() {
      return slots;
    },
    set(specs) {
      const made = specs.map((spec) => {
        const sample = buildPart(spec);
        if (sample === null) throw new RangeError(`tray: no model for '${spec}'`);
        return { spec, sample, row: trayRow(sample) };
      });
      for (const row of ['front', 'back'] as const) {
        const n = made.filter((m) => m.row === row).length;
        if (n > T.slots) {
          for (const m of made) m.sample.dispose();
          throw new RangeError(`tray: ${n} kinds in the ${row} row, at most ${T.slots}`);
        }
      }
      clear();
      const count = { front: 0, back: 0 };
      for (const { spec, sample, row } of made) {
        const index = count[row]++;
        const at = new Vector3(T.x + (index - (T.slots - 1) / 2) * TRAY.pitch, T[row].top + TRAY.foam, middle[row]);
        // the sample stands in the foam as on the board: the middle between its outer tips over the slot's middle
        const first = sample.nominal[0]!;
        const last = sample.nominal[sample.nominal.length - 1]!;
        const rest = new Vector3(at.x - (first.x + last.x) / 2, at.y, at.z);
        sample.group.position.copy(rest);
        sample.group.name = `tray:${spec}`;
        for (const m of sample.materials) tame(m);
        group.add(sample.group);
        // the hand takes a new one by the slot: a box over the slot as tall as the sample
        const size = partSize(sample);
        const hit = new Mesh(hitGeometry, hitMaterial);
        hit.name = `tray-hit:${spec}`;
        hit.scale.set(TRAY.pitch - 0.1, size.height + 0.1, T[row].depth - 0.1);
        hit.position.set(at.x, at.y + (size.height + 0.1) / 2, at.z);
        group.add(hit);
        const label = trayLabel(spec);
        if (label !== '') {
          // on the step's face in front of the slot: the front row's face to the reader, the back row's riser
          const y = row === 'front' ? T.front.top / 2 : (T.front.top + T.back.top) / 2;
          const z = row === 'front' ? z0 + T.depth : z0 + T.back.depth;
          prints.add(labels, label, { size: TRAY.label[row], color: 'mist', at: [at.x, y, z + 0.004] });
        }
        slots.push({ spec, row, index, at, hit, sample, label, up: 1, rest });
      }
    },
    slot: (spec) => slots.find((s) => s.spec === spec),
    take(spec, state) {
      const s = slots.find((x) => x.spec === spec);
      const fp = s ? footprintOf(spec) : null;
      if (!s || fp === null || fp.prefix === '') return null;
      s.up = 0;
      tray.update(0);
      return nextId(state, fp.prefix);
    },
    tips(spec) {
      const s = slots.find((x) => x.spec === spec);
      if (!s || !s.sample) return null;
      group.updateWorldMatrix(true, false);
      return s.sample.nominal.map((t) => t.clone().add(s.rest).applyMatrix4(group.matrixWorld));
    },
    update(dt, eye) {
      for (const s of slots) {
        if (!s.sample) continue;
        if (s.up < 1) s.up = Math.min(s.up + Math.max(dt, 0) / TRAY.rise, 1);
        // deep in the foam (inside the block) while it rises: as deep as the sample is tall
        const deep = partSize(s.sample).height + TRAY.foam;
        s.sample.group.position.set(s.rest.x, s.rest.y - deep * (1 - ease(s.up)), s.rest.z);
      }
      if (eye) prints.view(eye);
    },
    dispose() {
      clear();
      hitGeometry.dispose();
      hitMaterial.dispose();
      // the block's own geometry and materials: once the group leaves the tree, the chapter's teardown no longer
      // reaches them (a geometry left behind by every mount, found by the sandbox's check `leaks`)
      disposeTree(body);
      group.removeFromParent();
    },
  };
  return tray;
}
