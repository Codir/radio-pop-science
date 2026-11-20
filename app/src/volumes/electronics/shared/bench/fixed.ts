/**
 * The wires of the permanent things (docs/volumes/electronics/VISUAL.md §2, «Дроти постійних речей», §4.1):
 * - the battery's two short wires to the power posts at the right end of the rails — `coral` from the plus through the
 *   switch to the post of `+`, `ink` from the minus to the post of `−`; fixed once and for all, in no socket;
 * - the plug leads of the things off the board (plan decision 4): two from the speaker (`coral` «+», `ink` «−»), two
 *   from the player (`coral` signal, `ink` common), two from the lamp (`mist`, it has no polarity). Each is a wire 4.0
 *   long from its thing — it reaches its half of the board — with a plug at its end: a sleeve in the wire's colour 0.22
 *   long and a steel pin 0.12 that goes into a mouth. A plug stands upright in its socket and lies on its side where
 *   it was let go; the hand moves it (gesture 2, `lead:<name>`), a step puts it in a socket (`bench.preset`).
 *
 * The plugs' names are the board's state's (`spk+`, `spk-`, `pl+`, `pl-`, `lamp1`, `lamp2`); the netlist reads the
 * speaker's and the lamp's from `BENCH_FIXED`, the player's when the catalog has it (E1-7).
 *
 * Frame: the board's own (the breadboard's group); the things stand on the base, 0.3 below the board's face.
 */
import { Group, Mesh, Vector3, type Object3D } from 'three';
import { damp } from '@/engine/api';
import { Builder, G } from '@/kit';
import { K, type ColorLike } from '@/style';
import { BOARD_SPEC, type BoardState } from '@electronics/sim/board';
import { BOARD_LOOK } from './board-view';
import { DynTube } from './dyn-tube';
import { LAMP, PLACES } from './layout';
import { SPEAKER } from '../parts';
import { hermite, type EndPose } from '../hand/curves';
import { Leg, type LegWorld } from '../hand/leg';
import type { LeadEnd } from '../hand/hands';
import type { Terrain } from '../hand/terrain';

/** A lead: its length (the plug reaches this far from its thing, in plan) and the wire's radius. */
export const LEAD = { length: 4.0, radius: 0.035 } as const;
/** A plug, along its axis from the tip of its pin: the pin into the mouth, the sleeve above it. */
export const PLUG = { dip: 0.04, pin: 0.12, sleeve: 0.22, radius: 0.05, pinRadius: 0.02 } as const;
/** From the tip to the top of the sleeve, where the wire starts. */
const PLUG_TOP = PLUG.pin - PLUG.dip + PLUG.sleeve;
/** The middle of the sleeve: where the grip sits. */
const PLUG_MID = PLUG.pin - PLUG.dip + PLUG.sleeve / 2;

/** The base frame → the board's frame (the board's frame is the base's moved to the breadboard, no turn). */
const B = PLACES.breadboard;
const onBoard = (x: number, y: number, z: number): Vector3 => new Vector3(x - B.x, y - B.height, z - B.z);

interface LeadSpec {
  readonly name: string;
  readonly color: ColorLike;
  /** Where the wire leaves its thing (board frame) and which way. */
  readonly from: Vector3;
  readonly out: Vector3;
  /** Where the plug lies at rest (board frame, plan), its wire toward the thing. */
  readonly rest: readonly [number, number];
}

const R = SPEAKER.radius;
/** The leads of the things: from their lugs, the grommet and the lamp's screw terminals (VISUAL §4.1). */
export const LEADS: readonly LeadSpec[] = [
  {
    name: 'spk+',
    color: 'coral',
    from: onBoard(PLACES.speaker.x - R + 0.02, SPEAKER.rim, PLACES.speaker.z + 0.14),
    out: new Vector3(-1, 0, 0),
    rest: [2.72, -1.0],
  },
  {
    name: 'spk-',
    color: 'ink',
    from: onBoard(PLACES.speaker.x - R + 0.02, SPEAKER.rim, PLACES.speaker.z - 0.14),
    out: new Vector3(-1, 0, 0),
    rest: [2.72, -1.3],
  },
  {
    name: 'pl+',
    color: 'coral',
    from: onBoard(PLACES.player.x - PLACES.player.width / 2 - 0.05, PLACES.player.height / 2, PLACES.player.z + 0.39),
    out: new Vector3(-1, 0, 0),
    rest: [2.72, -0.15],
  },
  {
    name: 'pl-',
    color: 'ink',
    from: onBoard(PLACES.player.x - PLACES.player.width / 2 - 0.05, PLACES.player.height / 2, PLACES.player.z + 0.39),
    out: new Vector3(-1, 0, 0),
    rest: [2.72, 0.15],
  },
  {
    name: 'lamp1',
    color: 'mist',
    from: onBoard(LAMP.x - LAMP.term, LAMP.termY, LAMP.z),
    out: new Vector3(-1, 0, 0),
    rest: [-3.05, -1.25],
  },
  {
    name: 'lamp2',
    color: 'mist',
    from: onBoard(LAMP.x, LAMP.termY, LAMP.z + LAMP.term),
    out: new Vector3(0, 0, 1),
    rest: [-3.05, -0.9],
  },
];

export interface LeadView extends LeadEnd {
  readonly color: ColorLike;
  readonly plug: Group;
  readonly wire: Mesh;
}

export interface Fixed {
  /** The battery's wires, the leads and their plugs; add to the breadboard's group (board frame). */
  readonly group: Group;
  readonly leads: ReadonlyMap<string, LeadView>;
  /** The plugs not in the hand follow the board's state at once: in its socket, or lying at rest. */
  sync(state: BoardState, busy: (name: string) => boolean): void;
  /** Every frame: the plugs travel, the wires follow them. */
  update(dt: number): void;
  dispose(): void;
}

const UP = new Vector3(0, 1, 0);

/** A lead as the bench keeps it: its view, how upright its plug is, its wire's tube, its data. */
type LeadRec = LeadView & { up: number; readonly tube: DynTube; readonly spec: LeadSpec };

/** The battery's two wires (fixed): from the box to the posts, along the outside of the board (board frame). */
function batteryWires(): Group {
  const b = new Builder('battery-wires');
  const { x: px, z: pz } = BOARD_LOOK.post;
  const box = onBoard(PLACES.battery.x - PLACES.battery.width / 2, PLACES.battery.height, PLACES.battery.z);
  const lid = onBoard(PLACES.switch.x, PLACES.battery.height, PLACES.switch.z);
  const face = -B.height + LEAD.radius; // lying on the base's face
  // just right of the board's body: column 17 is 8 pitches right of the middle, the body 0.6 beyond it
  const edge = 8 * BOARD_SPEC.pitch + B.right + 0.06;
  const r = LEAD.radius;
  // `ink`: from the battery's snap under the lid, over the box's left wall, down to the `−` post
  const minus = [
    new Vector3(box.x + 0.25, box.y - 0.12, lid.z - 0.3),
    new Vector3(box.x + 0.02, box.y + 0.04, lid.z - 0.3),
    new Vector3(box.x - 0.08, 0.12, -pz + 0.02),
    new Vector3(px + 0.1, 0.12, -pz),
  ];
  // `coral`: from the switch's right contact, over the wall, down onto the base beside the board, along it to the far
  // end, up onto the board and into the `+` post
  const plus = [
    new Vector3(lid.x + 0.25, lid.y + 0.06, lid.z),
    new Vector3(box.x + 0.1, box.y + 0.08, lid.z),
    new Vector3(box.x - 0.05, face + 0.2, lid.z),
    new Vector3(edge, face, lid.z - 0.3),
    new Vector3(edge, face, pz + 0.3),
    new Vector3(edge - 0.02, 0.04, pz),
    new Vector3(px + 0.1, 0.12, pz),
  ];
  b.add(G.tube(G.roundPath(minus, 0.08, 6), r, { seg: 10 }), { c: 'ink', slot: 'gloss' });
  b.add(G.tube(G.roundPath(plus, 0.1, 6), r, { seg: 10 }), { c: 'coral' });
  const group = b.build().group;
  group.name = 'battery-wires';
  group.traverse((o) => void ((o as Mesh).isMesh && ((o.castShadow = false), (o.receiveShadow = true))));
  return group;
}

/** A plug standing on its tip, along +y: the steel pin, the sleeve in the wire's colour. */
function plugModel(name: string, color: ColorLike): Group {
  const b = new Builder(`plug:${name}`);
  b.cyl(PLUG.pinRadius, PLUG.pin, { at: [0, -PLUG.dip, 0], seg: 10, slot: 'metal', c: ['steel', 'mist'] });
  b.cyl(PLUG.radius, PLUG.sleeve, { at: [0, PLUG.pin - PLUG.dip, 0], seg: 14, c: color, bevel: 0.015 });
  const group = b.build().group;
  group.name = `plug:${name}`;
  group.traverse((o) => void ((o as Mesh).isMesh && ((o.castShadow = false), (o.receiveShadow = true))));
  return group;
}

export function createFixed(world: LegWorld, terrain: Terrain): Fixed {
  const group = new Group();
  group.name = 'fixed';
  group.add(batteryWires());
  const leads = new Map<string, LeadRec>();
  const restOf = (s: LeadSpec): { at: Vector3; out: Vector3 } => {
    const at = new Vector3(s.rest[0], 0, s.rest[1]);
    return { at, out: s.from.clone().sub(at).setY(0).normalize() };
  };
  const axis = new Vector3();
  for (const s of LEADS) {
    const rest = restOf(s);
    const leg = new Leg(world, { kind: 'lie', at: rest.at, out: rest.out }, rest.out);
    const plug = plugModel(s.name, s.color);
    const tube = new DynTube(48, 8);
    const wire = new Mesh(tube.geometry, K.toon({ color: s.color, gloss: 0.4, highlight: 0.4 }));
    wire.name = `lead:${s.name}`;
    wire.castShadow = false;
    wire.receiveShadow = true;
    wire.frustumCulled = false;
    group.add(plug, wire);
    const lead = {
      name: s.name,
      color: s.color,
      leg,
      from: s.from,
      reach: LEAD.length,
      plug,
      wire,
      tube,
      spec: s,
      /** 0 lying on its side … 1 upright (in a socket, in the hand). */
      up: 0,
      gripAt(out: Vector3) {
        return out.copy(leg.pos).addScaledVector(lead.gripAxis(axis), PLUG_MID);
      },
      gripAxis(out: Vector3) {
        return out.copy(leg.out).lerp(UP, lead.up).normalize();
      },
    };
    leads.set(s.name, lead);
  }

  const a: EndPose = { pos: new Vector3(), out: new Vector3() };
  const b: EndPose = { pos: new Vector3(), out: new Vector3() };
  const path: Vector3[] = [];
  const last = new Map<string, string>();
  const shape = (l: LeadRec): void => {
    const ax = l.gripAxis(axis);
    l.plug.position.copy(l.leg.pos);
    l.plug.quaternion.setFromUnitVectors(UP, ax);
    // rebuild the wire only when its ends moved
    const key = `${l.leg.pos.toArray().map((v) => v.toFixed(4))}|${ax.toArray().map((v) => v.toFixed(4))}`;
    if (last.get(l.name) === key) return;
    last.set(l.name, key);
    a.pos.copy(l.spec.from);
    a.out.copy(l.spec.out);
    b.pos.copy(l.leg.pos).addScaledVector(ax, PLUG_TOP);
    b.out.copy(ax).setY(0);
    if (b.out.lengthSq() < 1e-6) b.out.copy(l.spec.from).sub(b.pos).setY(0);
    b.out.normalize();
    hermite(a, b, terrain, path, l.tube.rings, { length: Math.min(LEAD.length, a.pos.distanceTo(b.pos) * 1.25) });
    l.tube.update(path, UP, (_, out) => {
      out[0] = LEAD.radius;
      out[1] = LEAD.radius;
    });
  };

  const fixed: Fixed = {
    group,
    leads,
    sync(state, busy) {
      for (const l of leads.values()) {
        if (busy(l.name)) continue;
        const s = state.leads.get(l.name);
        if (s !== undefined) {
          if (l.leg.seated !== s || l.leg.socket !== s) l.leg.go({ kind: 'socket', socket: s }, 0);
        } else if (l.leg.place.kind === 'socket') {
          // taken out by a step: back to lying at rest
          const rest = restOf(l.spec);
          l.leg.go({ kind: 'lie', at: rest.at, out: rest.out }, 0);
        }
      }
    },
    update(dt) {
      for (const l of leads.values()) {
        l.leg.update(dt, l.spec.from);
        // upright in a socket and in the hand, on its side lying; a held frame shows where it is going
        const upright = l.leg.place.kind === 'lie' ? 0 : 1;
        l.up = dt > 0 ? damp(l.up, upright, 14, dt) : upright;
        if (Math.abs(upright - l.up) < 1e-3) l.up = upright;
        shape(l);
      }
    },
    dispose() {
      for (const l of leads.values()) {
        l.tube.geometry.dispose();
        (l.wire.material as { dispose(): void }).dispose();
      }
      group.traverse((o: Object3D) => {
        const m = o as Mesh;
        if (m.isMesh && m.geometry) m.geometry.dispose();
      });
      group.removeFromParent();
    },
  };
  // the leads lie at rest from the first frame
  for (const l of leads.values()) shape(l);
  return fixed;
}
