/**
 * The yard of the volume (B13): every object of `shared/models` built once from `LAYOUT.plan` and put where the
 * model's numbers say — the first camera with its antenna exactly at `tx`, the monitor with its antenna exactly
 * where the model computes the field — with the dusk and the lights of `look.ts` and the eight shots of `shots.ts`.
 * `mountYard` adds it to the chapter's root; chapters (through `shared/world`) move the monitor, open the wicket and
 * the garage gate, slide the tray, set the dusk and the screen's light, and put into `hidden` what the camera in the
 * yard must not see.
 */
import { Group, Matrix4, type Object3D, Quaternion, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, type KitModel } from '@/kit';
import {
  HOUSE_SKIRT,
  MONITOR_ANTENNA,
  MONITOR_CASE,
  SURFACE,
  type V3,
  buildYardProps,
  pole,
} from '../models';
import { LAYOUT, LENS, gateYaw, monitorPlace } from './layout';
import { type YardLook, mountLook } from './look';
import { YARD_SHOTS } from './shots';

export { LAYOUT, LENS, monitorPlace, screenPlace } from './layout';
export { YARD_SHOTS, screenShot } from './shots';

export type RouteStop = 'yard' | 'kitchen' | 'hallway' | 'far-room' | 'cellar';

export interface Yard {
  readonly root: Group;
  readonly anchors: Readonly<
    Record<
      | 'lens'
      | 'cameraAntenna'
      | 'monitor'
      | 'monitorScreen'
      | 'monitorAntenna'
      | 'wicket'
      | 'cat'
      | 'garageGate'
      | 'cable',
      Object3D
    >
  >;
  /** 0 early evening … 1 night. */
  dusk: number;
  /** The wicket in the camera's view: −1…1, 0 — shut. */
  wicket: number;
  /** 0…1 (from `AirState.gate`). */
  garageGate: number;
  /** 0…1 (from `AirState.tray`). */
  tray: number;
  /** 0…1: the screen's light on the kitchen; `mountWorld` writes power × mean brightness / 255 here. */
  screenLight: number;
  monitorAt(route: number, nudge: number): void;
  /** What the camera in the yard must not see (stands, probe, map, labels). */
  readonly hidden: Object3D[];
  /** The cat, the swing, the trees; the lights. */
  update(dt: number, t: number): void;
}

/** The wicket's leaf turns this far at `wicket` ±1, radians. */
const WICKET_SWING = 1.05;
/**
 * The tray (the contract's law of the tray): from `tray` = `across` on it stands across the line from the monitor's
 * antenna to `tx`, `distance` from the antenna (d₂ of the law), and slides level across it so that its edge is
 * `h = h0 + k·tray` metres from the line (0.08 past it at 1) — the edge the model computes the loss from; its lower
 * side stays `clear` above the monitor's case. Before that it travels from its rest on the worktop along an arc,
 * lifted `lift` over both ends, on the side of its rest: it never crosses the line.
 */
const TRAY = {
  distance: 0.05,
  across: 0.7,
  h0: -0.4,
  k: 0.48,
  wide: 0.4,
  deep: 0.3,
  lift: 0.35,
  clear: 0.005,
} as const;

const Y = new Vector3(0, 1, 0);
const v3 = (p: V3): Vector3 => new Vector3(p[0], p[1], p[2]);

/** Put `model` so that its anchor `name` lies at `at`, turned by `yaw` about Y (its own rest pose). */
function placeBy(model: KitModel, name: string, at: V3, yaw: number): void {
  model.group.rotation.set(0, yaw, 0);
  const local = model.anchorLocal(name).applyAxisAngle(Y, yaw);
  model.group.position.set(at[0] - local.x, at[1] - local.y, at[2] - local.z);
}

export function mountYard(ctx: ChapterContext, opts: { dusk?: number } = {}): Yard {
  const plan = LAYOUT.plan;
  const places = LAYOUT.places;
  const props = buildYardProps(plan, ctx.random.fork('yard'));
  const root = new Group();
  root.name = 'yard';

  /* --------------------------------------------------------------------- ground, buildings, fences */
  props.island.group.position.set(plan.centre[0], 0, plan.centre[1]);
  // drawn in scene axes already
  for (const m of [props.island, props.house, props.shed, props.garage, props.fence, props.trees])
    root.add(m.group);

  /* ------------------------------------------------------------------------- the pole and the cameras */
  const at = (k: keyof typeof places, y?: number): Vector3 => {
    const p = places[k].position;
    return new Vector3(p[0], y ?? p[1], p[2]);
  };
  // the pole's height follows the antenna (built here, not the default one of buildYardProps)
  const stand = pole({ height: LAYOUT.tx[1] + 0.2 });
  stand.group.position.copy(at('pole'));
  stand.group.rotation.y = places.pole.yaw;
  root.add(stand.group);

  // the first camera: −Z of its lens from LENS.position at LENS.lookAt, the whip turned back upright, then the whole
  // camera moved so that its antenna lies exactly at `tx`
  const cam1 = props.camera1;
  const look = v3(LENS.lookAt).sub(v3(LENS.position)).normalize();
  const tilt = Math.asin(look.y);
  cam1.group.rotation.set(tilt, Math.atan2(-look.x, -look.z), 0, 'YXZ');
  cam1.part('rod').rotation.x = -tilt;
  const antenna = cam1.anchorLocal('antenna').applyQuaternion(cam1.group.quaternion);
  cam1.group.position.set(LAYOUT.tx[0] - antenna.x, LAYOUT.tx[1] - antenna.y, LAYOUT.tx[2] - antenna.z);
  root.add(cam1.group);
  // the bracket from the pole's upper clamp to the middle of the camera's back wall
  const mount1 = stand.anchorWorld('mount1');
  const bracket = new Builder('bracket')
    .rod(
      [mount1.x, mount1.y, mount1.z],
      [cam1.group.position.x, cam1.group.position.y, cam1.group.position.z],
      0.01,
      {
        seg: 8,
        c: SURFACE.iron.c,
        slot: SURFACE.iron.slot,
      },
    )
    .build();
  root.add(bracket.group);
  // the second camera: its origin on the lower clamp, looking south like the first, level
  const cam2 = props.camera2;
  cam2.group.position.copy(stand.anchorWorld('mount2'));
  cam2.group.rotation.y = places.pole.yaw - Math.PI / 2;
  root.add(cam2.group);

  /* ------------------------------------------------------------------------------------- small props */
  // the wicket: its origin on the ground under the middle of the leaf, the hinge at the south end of the opening
  props.wicket.group.position.copy(at('wicket', 0));
  props.wicket.group.rotation.y = places.wicket.yaw;
  // the cat: its white spot exactly at places.cat
  placeBy(props.cat, 'spot', places.cat.position, places.cat.yaw);
  props.swing.group.position.copy(at('swing'));
  props.swing.group.rotation.y = places.swing.yaw;
  // the bicycle stands on the skirt of the house
  props.bicycle.group.position.copy(at('bicycle', HOUSE_SKIRT.top));
  props.bicycle.group.rotation.y = places.bicycle.yaw;
  props.lantern.group.position.copy(at('lantern'));
  props.lantern.group.rotation.y = places.lantern.yaw;
  // the neighbour's window: its router where the model has it
  placeBy(props.neighbour, 'router', plan.neighbour.router, plan.neighbour.yaw);
  // the phone flat on the window board, along it
  props.phone.group.position.copy(props.house.anchorLocal('phone'));
  props.phone.group.rotation.y = Math.PI / 2;
  for (const m of [
    props.wicket,
    props.cat,
    props.swing,
    props.bicycle,
    props.lantern,
    props.neighbour,
    props.phone,
  ])
    root.add(m.group);

  /* ------------------------------------------------------------------------- the monitor and the tray */
  const mon = props.monitor;
  const monAntenna = mon.anchorLocal('antenna');
  root.add(mon.group);
  const tray = props.tray;
  root.add(tray.group);
  const rest = {
    position: at('trayRest'),
    quaternion: new Quaternion().setFromAxisAngle(Y, places.trayRest.yaw),
  };
  let route = 1;
  let nudge = 0;
  let trayK = 0;
  const placeMonitor = (): void => {
    const { position: p, yaw } = monitorPlace(route, nudge);
    const f = yaw + Math.PI / 2;
    mon.group.rotation.set(0, f, 0);
    const a = monAntenna.clone().applyAxisAngle(Y, f);
    mon.group.position.set(p[0] - a.x, p[1] - a.y, p[2] - a.z);
  };
  /** The tray's pose standing across the line (`tray` ≥ ACROSS), with its edge `h` from the line. */
  const across = (h: number): { position: Vector3; quaternion: Quaternion } => {
    const ant = v3(monitorPlace(route, nudge).position);
    const u = v3(LAYOUT.tx).sub(ant).normalize();
    const p = ant.clone().addScaledVector(u, TRAY.distance);
    // n: level and across the line, toward the tray's rest; v: up across the line
    const n = new Vector3(-u.z, 0, u.x).normalize();
    if (n.dot(rest.position.clone().sub(ant)) < 0) n.negate();
    const v = new Vector3().crossVectors(u, n).normalize();
    if (v.y < 0) v.negate();
    // the tray's own axes: X (its 0.40 m side) along n, Z (its 0.30 m side) along v; its sheet faces the antenna
    const quaternion = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(n, new Vector3().crossVectors(v, n), v),
    );
    // its lower side just above the monitor's case (the case stands under the line, close to the antenna); its
    // origin is the middle of the sheet
    const caseTop = ant.y - MONITOR_ANTENNA[1] + MONITOR_CASE.height / 2 + TRAY.clear;
    const up = (caseTop - p.y) / v.y + TRAY.deep / 2;
    return { position: p.addScaledVector(n, TRAY.wide / 2 - h).addScaledVector(v, up), quaternion };
  };
  const placeTray = (): void => {
    const k = Math.min(1, Math.max(0, trayK));
    if (k >= TRAY.across) {
      const pose = across(TRAY.h0 + TRAY.k * k);
      tray.group.position.copy(pose.position);
      tray.group.quaternion.copy(pose.quaternion);
      return;
    }
    const ready = across(TRAY.h0 + TRAY.k * TRAY.across);
    const s0 = k / TRAY.across;
    const s = s0 * s0 * (3 - 2 * s0);
    // a quadratic arc from the rest to the ready pose, lifted over both
    const mid = rest.position.clone().add(ready.position).multiplyScalar(0.5);
    mid.y = Math.max(rest.position.y, ready.position.y) + TRAY.lift;
    const a = rest.position.clone().lerp(mid, s);
    const b = mid.clone().lerp(ready.position, s);
    tray.group.position.copy(a.lerp(b, s));
    tray.group.quaternion.copy(rest.quaternion).slerp(ready.quaternion, s);
  };

  /* ------------------------------------------------------------------------------------------ look */
  let dusk = opts.dusk ?? 0.2;
  let screenLight = 0;
  const lookOf: YardLook = mountLook(ctx, {
    lamp: props.lantern.anchor('light'),
    screen: mon.anchor('screen'),
    glow: [props.lantern, props.neighbour, props.bicycle],
    dusk,
  });

  ctx.root.add(root);
  ctx.camera.shots(YARD_SHOTS);

  const anchors = {
    lens: cam1.anchor('lens'),
    cameraAntenna: cam1.anchor('antenna'),
    cable: cam1.anchor('cable'),
    monitor: mon.group,
    monitorScreen: mon.anchor('screen'),
    monitorAntenna: mon.anchor('antenna'),
    wicket: props.wicket.anchor('latch'),
    cat: props.cat.anchor('spot'),
    garageGate: props.garage.anchor('gate'),
  };
  for (const [name, anchor] of Object.entries(anchors))
    ctx.qa.probe(`yard:${name}`, anchor, { origin: true });

  let wicket = 0;
  let garageGate = 0;
  const leaf = props.wicket.part('leaf');
  const gate = props.garage.part('gate');
  placeMonitor();
  placeTray();
  gate.rotation.y = gateYaw(0);

  const yard: Yard = {
    root,
    anchors,
    get dusk() {
      return dusk;
    },
    set dusk(v: number) {
      dusk = v;
      lookOf.set(dusk, screenLight);
    },
    get wicket() {
      return wicket;
    },
    set wicket(v: number) {
      wicket = Math.min(1, Math.max(-1, v));
      leaf.rotation.y = wicket * WICKET_SWING;
    },
    get garageGate() {
      return garageGate;
    },
    set garageGate(v: number) {
      garageGate = Math.min(1, Math.max(0, v));
      gate.rotation.y = gateYaw(garageGate);
    },
    get tray() {
      return trayK;
    },
    set tray(v: number) {
      trayK = Math.min(1, Math.max(0, v));
      placeTray();
    },
    get screenLight() {
      return screenLight;
    },
    set screenLight(v: number) {
      screenLight = v;
      lookOf.set(dusk, screenLight);
    },
    monitorAt(r: number, n: number) {
      route = r;
      nudge = n;
      placeMonitor();
      placeTray();
    },
    hidden: [],
    update(dt, t) {
      props.cat.update(dt, t);
      props.swing.update(dt, t);
      props.trees.update(dt, t);
      lookOf.set(dusk, screenLight);
    },
  };
  return yard;
}
