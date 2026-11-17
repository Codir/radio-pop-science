/**
 * The water picture (`flow/pump`, VISUAL §5.7): ONE number `morph` 0 (the stand) … 1 (the picture) turns the stand
 * into a closed glass pipe full of water **on the same places**: each wire swells into a glass pipe as the water
 * rises out of its core; the battery gives way to a pump, the lamp to a narrow place with a paddle wheel in a glass
 * chamber, the switch to a tap; all other hardware of the stand (clamps, spring, cradle, staples, the lamp's post,
 * the second seat, the magnifier and its holder) sinks into the board with the same move and rises back on the way
 * back. `open` is the tap: the water runs from the pump round the loop (bubbles drawn out along the flow, faster in
 * the narrow place), the wheel turns; shut, both stand still in the same frame. Board frame.
 */
import {
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Group,
  type Object3D,
} from 'three';
import { G } from '@/kit';
import { K, col } from '@/style';
import {
  BATTERY,
  LAMP,
  LOOP,
  SWITCH,
  WIRE,
  loopPath,
  tameAll,
  type CircuitStage,
} from '@circuit/shared/stage';
import { DynTube, resample } from '@circuit/shared/stage/dyn-tube';
import { CHAMBER, PUMP, createChamber, createPump, createTap, glassLook } from './water-models';

const RINGS = 300;
const PIPE = 0.135;
const WATER = 0.1;
const NARROW = 0.06;
const BUBBLES = 46;
/** The water's speed round the loop in the wide pipe, units per second (≈ 8 s per lap). */
const SPEED = 1.8;
/**
 * Where the chamber stands: on the far pipe just before the lamp's corner, facing the reader; the pipe runs through
 * its lower part, under the axle — an undershot wheel, turned by the water passing beneath it (board frame).
 */
const CHAMBER_AT = new Vector3(LAMP.x - 0.78, 0, LOOP.far);

export interface Water {
  morph: number;
  /** The tap is open. */
  open: boolean;
  /** The pointer is over the tap (its handle lifts a little), pressed on it (dips). */
  hover: boolean;
  press: boolean;
  /** The water runs now (open and fully a picture). */
  readonly flowing: boolean;
  /** Where to name things (world). */
  anchors: { pump: Group; tap: Group; wheel: Group };
  /** The tap's generous hit volume. */
  tapHit: Mesh;
  update(dt: number): void;
}

const ramp = (x: number, a: number, b: number): number => Math.min(Math.max((x - a) / (b - a), 0), 1);
const smooth = (x: number): number => x * x * (3 - 2 * x);
const backOut = (x: number): number => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const MOUNTS = [
  'clampMinus',
  'clampPlus',
  'cradle',
  'switchBlock',
  'lampPost',
  'seat',
  'seatJumper',
  'lensHolder',
];

export function water(stage: CircuitStage, phone: () => boolean): Water {
  const frame = stage.base.frame;
  const path = resample(
    loopPath().filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]!) > 1e-4),
    RINGS,
  );
  const total = G.pathLength(path);
  /** How wide the pipe is at a point (1 the full pipe … NARROW/PIPE … 0 hidden inside a vessel). */
  const widthAt = (p: Vector3): number => {
    if (Math.abs(p.z - LOOP.near) < 0.01 && Math.abs(p.x - BATTERY.x) < PUMP.r - 0.02) return 0;
    const d = Math.abs(p.z - LOOP.far) < 0.01 ? Math.abs(p.x - CHAMBER_AT.x) : Infinity;
    if (d < CHAMBER.r * 0.92) return 0;
    const k = smooth(ramp(d, CHAMBER.r * 0.92, CHAMBER.r * 1.7));
    return NARROW / PIPE + (1 - NARROW / PIPE) * k;
  };
  const width = path.map(widthAt);
  const widthOf = (s: number): number => width[Math.min(Math.round(s * (RINGS - 1)), RINGS - 1)]!;
  const glass = new DynTube(RINGS, 28);
  const core = new DynTube(RINGS, 20);
  const glassMat = glassLook();
  const glassMesh = new Mesh(glass.geometry, glassMat);
  glassMesh.renderOrder = 4;
  const coreMesh = new Mesh(
    core.geometry,
    K.toon({
      color: col('sky').lerp(col('white'), 0.3),
      emissive: 'sky',
      emissiveIntensity: 0.3,
      gloss: 0.8,
      keepHue: true,
    }),
  );
  coreMesh.castShadow = true;
  for (const m of [glassMesh, coreMesh]) m.frustumCulled = false;
  const bubbles = new InstancedMesh(
    new SphereGeometry(0.03, 10, 8),
    new MeshBasicMaterial({ color: col('white') }),
    BUBBLES,
  );
  bubbles.frustumCulled = false;
  const pump = createPump();
  const chamber = createChamber();
  const tap = createTap();
  pump.group.position.set(BATTERY.x, 0, LOOP.near);
  chamber.group.position.copy(CHAMBER_AT);
  tap.group.position.set(SWITCH.x, 0, LOOP.near);
  const vessels = [pump.group, chamber.group, tap.group];
  frame.add(glassMesh, coreMesh, bubbles, ...vessels);
  tameAll(frame as Group);
  // everything of the stand that is not wire, battery, lamp or switch sinks into the board in the picture
  const hardware: Object3D[] = [
    ...MOUNTS.map((n) => stage.stand.mounts[n]).filter((m): m is Group => Boolean(m)),
    ...Object.keys(stage.stand.mounts)
      .filter((n) => n.startsWith('staple'))
      .map((n) => stage.stand.mounts[n]!),
    stage.stand.spring.group,
    stage.stand.battery.group,
    stage.stand.bulb.group,
    stage.stand.slider,
  ];
  const up = new Vector3(0, 1, 0);
  const m4 = new Matrix4();
  const p = new Vector3();
  const t = new Vector3();
  const q = new Quaternion();
  const X = new Vector3(1, 0, 0);
  const sc = new Vector3();
  const ss = Array.from({ length: BUBBLES }, (_, i) => (i * 0.61803) % 1);
  const lane = Array.from({ length: BUBBLES }, (_, i) => ((i * 0.377) % 1) * 2 - 1);
  let wheelA = 0;
  let pumpA = 0;
  let lever = 0;
  let lift = 0;
  let shown = -1;
  const w: Water = {
    morph: 0,
    open: true,
    hover: false,
    press: false,
    get flowing() {
      return w.open && w.morph > 0.98;
    },
    anchors: { pump: pump.group, tap: tap.group, wheel: chamber.turn },
    tapHit: tap.hit,
    update(dt) {
      const m = Math.min(Math.max(w.morph, 0), 1);
      const visible = m > 0.001;
      for (const o of [glassMesh, coreMesh, bubbles, ...vessels]) o.visible = visible;
      // the stand's own things give way and come back (every frame: the stand re-lays some of them)
      const gone = 1 - smooth(ramp(m, 0.08, 0.5));
      for (const o of hardware) {
        o.scale.setScalar(Math.max(gone, 1e-3));
        o.visible = gone > 0.002;
      }
      // the magnifier in its holder sinks with it (the tools set its scale every frame: multiply)
      stage.tools.lens.group.scale.multiplyScalar(Math.max(gone, 1e-3));
      if (gone < 0.002) stage.tools.lens.group.visible = false;
      stage.stand.battery.printShown = gone > 0.6 && !phone();
      stage.stand.wires.group.visible = m < 0.6;
      // the unlit room a little lighter while the picture stands (it has no lamp of its own)
      stage.ambient = 0.5 + 0.35 * smooth(ramp(m, 0.2, 0.9));
      if (!visible) {
        shown = -1;
        return;
      }
      if (Math.abs(m - shown) > 1e-4) {
        shown = m;
        const swell = smooth(ramp(m, 0, 0.6));
        const rise = smooth(ramp(m, 0.08, 0.6));
        const shape = smooth(ramp(m, 0.4, 0.85));
        glass.update(path, up, (i, out) => {
          const k = 1 + (width[i]! - 1) * shape;
          out[0] = out[1] = Math.max((WIRE.sheath * 1.04 + (PIPE - WIRE.sheath * 1.04) * swell) * k, 1e-4);
        });
        core.update(path, up, (i, out) => {
          const k = 1 + (width[i]! - 1) * shape;
          out[0] = out[1] = Math.max((WIRE.core * 0.9 + (WATER - WIRE.core * 0.9) * rise) * k * 0.98, 1e-4);
        });
        glassMat.opacity = 0.1 * swell;
        pump.group.scale.setScalar(Math.max(backOut(ramp(m, 0.38, 0.86)), 1e-3));
        chamber.group.scale.setScalar(Math.max(backOut(ramp(m, 0.44, 0.94)), 1e-3));
        tap.group.scale.setScalar(Math.max(backOut(ramp(m, 0.36, 0.82)), 1e-3));
      }
      // the water: round from the pump the electrons' way while the tap is open; at once still when it shuts
      const run = w.flowing ? 1 : 0;
      wheelA += run * dt * 3.2; // the water passes under the axle left → right: the wheel turns anticlockwise
      pumpA -= dt * (w.open ? 5 : 2.2);
      lever += ((w.open ? 0 : -Math.PI / 2) - lever) * Math.min(dt * 12, 1);
      lift += ((w.press ? -0.03 : w.hover ? 0.05 : 0) - lift) * Math.min(dt * 18, 1);
      pump.turn.rotation.y = pumpA;
      chamber.turn.rotation.z = wheelA;
      tap.turn.rotation.y = lever;
      tap.turn.position.y = LOOP.y + 0.36 + lift;
      const b = smooth(ramp(m, 0.8, 1));
      for (let i = 0; i < BUBBLES; i++) {
        // as fast as the pipe is narrow: the same water passes a smaller section faster (capped)
        const k = Math.max(widthOf(ss[i]!), NARROW / PIPE);
        ss[i] = (ss[i]! + (run * SPEED * dt * Math.min(1 / (k * k), 3.5)) / total) % 1;
        G.pathAt(path, ss[i]! * total, p, t);
        const r = (WATER + 0.008) * widthOf(ss[i]!);
        p.y += r * (0.78 + 0.18 * lane[i]!);
        p.z += r * 0.5 * lane[i]!;
        // drawn out along the flow: a streak when the water runs (longer where it is fast), a bead when it stands
        const stretch = run ? 1 + 1.2 * Math.min(1 / (k * k), 3.5) * 0.5 : 1;
        q.setFromUnitVectors(X, t);
        m4.compose(p, q, sc.set(b * stretch, b * 0.8, b * 0.8));
        bubbles.setMatrixAt(i, m4);
      }
      bubbles.instanceMatrix.needsUpdate = true;
    },
  };
  return w;
}
