/**
 * The crawl (the owner's snail scene, DECISIONS §60 r–s): ONE number — seconds of true time — places everything.
 * The snail creeps on the board beside the wire itself, the way the electrons go (from the battery's minus
 * toward the lamp), at 1 mm/s, and leaves a pale trail as long as its way so far. Centimetre ticks are printed
 * along its lane. The spark's few millimetres are shown at the wire's START, inside the magnifier (`loupe.ts`).
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { K, col } from '@/style';
import { Text3D } from '@/text';
import { CM, CRAWL_SPEED, createLane, type Lane } from './crawl-lane';
import type { SnailModel } from './snail';

/** The snail's foot: from its nose to its tail, and from its tail to the origin of its group (snail.ts). */
const BODY = { length: 0.94, tail: 0.46 } as const;
/** Ticks start this far from the lane's centre line toward the wire; numbers lie this far the other way. */
const MARKS = { ticks: 0.25, numbers: 0.44 } as const;

/**
 * The arrival as one motion: the windows of the presence 0…1 in which each part comes in (and, backwards,
 * leaves). The magnifier flies to the wire's start, its picture opens like an iris, the ticks come up as a wave
 * along the lane, the snail creeps to its start, numbers and trail last.
 */
export const CRAWL_BEATS = {
  lens: [0, 0.62],
  picture: [0.5, 0.9],
  snail: [0.3, 1],
  numbers: [0.6, 1],
} as const satisfies Record<string, readonly [number, number]>;

const smooth = (x: number): number => x * x * (3 - 2 * x);
const ramp = (x: number, a: number, b: number): number => Math.min(Math.max((x - a) / (b - a), 0), 1);

const TRAIL_VERTEX = /* glsl */ `
attribute float aAlong;
attribute float aSide;
varying float vAlong;
varying float vSide;
void main() {
  vAlong = aAlong;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
const TRAIL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uHead;
uniform float uStart;
varying float vAlong;
varying float vSide;
void main() {
  if ( vAlong > uHead ) discard;
  float edge = 1.0 - smoothstep( 0.45, 1.0, abs( vSide ) );
  // fresh and glistening right behind the snail, drier further back; soft where it began
  float fresh = 0.5 + 0.5 * exp( -( uHead - vAlong ) / 0.9 );
  float begin = smoothstep( uStart, uStart + 0.25, vAlong );
  gl_FragColor = vec4( uColor, uAlpha * edge * fresh * begin );
}`;

export interface CrawlModel {
  group: Group;
  lane: Lane;
  /** Length of the snail's way in centimetres, the seconds it takes, the spark's way meanwhile in millimetres. */
  lengthCm: number;
  duration: number;
  scaleMm: number;
  /** Where the two are after `seconds`: centimetres / millimetres from their starts. */
  snailCmAt(seconds: number): number;
  sparkMmAt(seconds: number): number;
  /** Print the numbers (default true; false where they would be under 14 px — phones). */
  labels: boolean;
  /** Place everything for `seconds` of true time; `shown` 0…1 brings the state up; `t` = engine time. */
  set(seconds: number, shown: number, light: number, t: number): void;
}

function trailGeometry(lane: Lane): BufferGeometry {
  const from = -BODY.length;
  const n = Math.ceil((lane.length - from) / 0.04);
  const position = new Float32Array((n + 1) * 6);
  const along = new Float32Array((n + 1) * 2);
  const side = new Float32Array((n + 1) * 2);
  const index: number[] = [];
  const p = new Vector3();
  for (let i = 0; i <= n; i++) {
    const d = from + ((lane.length - from) * i) / n;
    for (const k of [0, 1] as const) {
      lane.at(d, k ? 0.12 : -0.12, p);
      position.set([p.x, 0.006, p.z], (i * 2 + k) * 3);
      along[i * 2 + k] = d;
      side[i * 2 + k] = k ? 1 : -1;
    }
    if (i < n) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setAttribute('aAlong', new BufferAttribute(along, 1));
  g.setAttribute('aSide', new BufferAttribute(side, 1));
  g.setIndex(index);
  return g;
}

export function createCrawl(snail: SnailModel): CrawlModel {
  const lane = createLane();
  const group = new Group();
  group.name = 'crawl';
  const q = new Vector3();
  const nose = new Vector3();
  const tail = new Vector3();
  const yawOf = (tangent: Vector3): number => Math.atan2(-tangent.z, tangent.x);
  // ticks every centimetre of the snail's way (longer every five), numbers every five
  // one instanced box, so that each tick can grow by itself: they come up as a wave along the lane
  const count = Math.floor(lane.lengthCm + 1e-6) + 1;
  const ticks = new InstancedMesh(new BoxGeometry(1, 0.005, 1), K.toon({ color: 'white' }), count);
  ticks.name = 'crawl:ticks';
  ticks.receiveShadow = true;
  const marks: { at: Vector3; yaw: number; width: number; len: number }[] = [];
  const numbers: Text3D[] = [];
  for (let cm = 0; cm < count; cm++) {
    const five = cm % 5 === 0;
    const len = five ? 0.2 : 0.11;
    const yaw = yawOf(lane.at(cm * CM, MARKS.ticks + len / 2, q));
    marks.push({ at: q.clone(), yaw, width: five ? 0.028 : 0.018, len });
    ticks.setColorAt(cm, col(five ? 'white' : 'mist'));
    if (!five) continue;
    lane.at(cm * CM, -MARKS.numbers, q);
    const n = new Text3D(cm === 0 ? '0' : `${cm} см`, {
      font: 'display',
      size: 0.17,
      color: 'white',
      anchorX: 'center',
      anchorY: 'middle',
      halo: false,
      rich: false,
    });
    n.position.set(q.x, 0.05, q.z);
    n.rotation.x = -1.1;
    numbers.push(n);
    group.add(n);
  }
  group.add(ticks);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const size = new Vector3();
  const UP = new Vector3(0, 1, 0);
  let ticksAt = -1;
  /** Tick `i` grows while the presence passes its own short window (0.12 … 0.7 along the lane). */
  const growTicks = (p: number): void => {
    if (p === ticksAt) return;
    ticksAt = p;
    marks.forEach((m, i) => {
      const g = smooth(ramp(p, 0.12 + (0.45 * i) / (count - 1), 0.25 + (0.45 * i) / (count - 1)));
      size.set(m.width, 1, Math.max(m.len * g, 1e-4));
      ticks.setMatrixAt(i, matrix.compose(m.at, turn.setFromAxisAngle(UP, m.yaw), size));
    });
    ticks.instanceMatrix.needsUpdate = true;
  };
  const trailMaterial = new ShaderMaterial({
    uniforms: {
      uColor: { value: col('mist').lerp(col('white'), 0.45) },
      uAlpha: { value: 0 },
      uHead: { value: 0 },
      uStart: { value: -BODY.length },
    },
    vertexShader: TRAIL_VERTEX,
    fragmentShader: TRAIL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const trail = new Mesh(trailGeometry(lane), trailMaterial);
  trail.name = 'crawl:trail';
  trail.renderOrder = 1;
  group.add(trail);
  const white = col('mist').lerp(col('white'), 0.4);
  const snailCmAt = (seconds: number): number =>
    Math.min((Math.max(seconds, 0) * CRAWL_SPEED.snail) / 10, lane.lengthCm);
  const sparkMmAt = (seconds: number): number =>
    Math.min(Math.max(seconds, 0), lane.duration) * CRAWL_SPEED.spark;
  const motion = { seconds: 0, t: 0, effort: 0, phase: 0, shown: 0 };
  return {
    group,
    lane,
    lengthCm: lane.lengthCm,
    duration: lane.duration,
    scaleMm: lane.scaleMm,
    snailCmAt,
    sparkMmAt,
    labels: true,
    set(seconds, shown, light, t) {
      // `shown` is the presence 0…1 of the whole state, run at constant speed; every part has its own window
      // of it (CRAWL_BEATS), so the scene arrives and leaves as one motion: ticks → snail → numbers and trail
      const p = Math.min(Math.max(shown, 0), 1);
      group.visible = p > 0.004;
      if (!group.visible) {
        snail.group.visible = false;
        motion.shown = 0;
        return;
      }
      growTicks(p);
      const lettered = smooth(ramp(p, ...CRAWL_BEATS.numbers));
      for (const n of numbers) {
        n.color = white.clone().multiplyScalar(0.3 + 0.7 * light);
        n.opacity = lettered;
        n.visible = this.labels && lettered > 0.004;
      }
      // the snail: nose on the measured point, the body on the chord behind it — so it turns smoothly through
      // the corner over its own length. Arriving, it creeps the last stretch to its place while it grows (the
      // way it comes out on the ruler); leaving, the same backwards
      const e = smooth(ramp(p, ...CRAWL_BEATS.snail));
      const d = snailCmAt(seconds) * CM - (1 - e) * 0.9;
      lane.at(d, 0, nose);
      lane.at(d - BODY.length * e, 0, tail);
      q.copy(nose).sub(tail).normalize();
      snail.group.visible = e > 0.004;
      snail.group.position.copy(tail).addScaledVector(q, BODY.tail * e);
      snail.group.rotation.y = yawOf(q);
      snail.group.scale.setScalar(Math.max(e, 1e-3));
      const trailed = smooth(ramp(p, ...CRAWL_BEATS.numbers));
      trailMaterial.uniforms.uHead!.value = d - BODY.length + 0.2;
      trailMaterial.uniforms.uAlpha!.value = (0.1 + 0.2 * light) * trailed;
      // the body's wave runs on the engine's clock but only while the snail moves — with the time, or on its
      // way in and out; when it stops, the snail rests
      const dt = Math.min(Math.max(t - motion.t, 0), 0.1);
      const creeping = Math.abs(seconds - motion.seconds) > 1e-6 && seconds < lane.duration;
      const arriving = Math.abs(p - motion.shown) > 1e-6 && e > 0 && e < 1;
      motion.effort += ((creeping || arriving ? 1 : 0) - motion.effort) * Math.min(dt * 5, 1);
      motion.phase += dt * 3.1 * motion.effort;
      motion.seconds = seconds;
      motion.shown = p;
      motion.t = t;
      snail.wave = motion.phase;
      snail.effort = motion.effort;
    },
  };
}
