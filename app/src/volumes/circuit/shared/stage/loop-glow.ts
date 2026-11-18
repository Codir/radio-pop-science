/**
 * A soft sleeve of light round the wire of the loop (VISUAL §5.4, §5.5): the push of the field running along the
 * loop from the switch both ways (`flow/push`, amber), the energy flowing along both wires from the battery to the
 * lamp (`lamp/handover`, `lamp/story`, yellow), a brief glow of the whole perimeter (`flow/loop`). It lies OUTSIDE
 * the wire — thickest at the wire's surface, melting outward — never inside the copper. One mesh, additive.
 *
 * Positions are shares of `loopPath()` (the loop as one closed path, `tools/frame.ts`, clockwise seen from above —
 * the electrons' way — starting at the second seat). Two fronts leave `origin`, one each way, and meet at `meet`
 * when `front` = 1: the forward front covers the loop from `origin` to `meet` going the path's way, the backward
 * one the rest. With `meet` = `origin` + 0.5 they run equally fast (the field from the switch); with the lamp as
 * `meet` and the battery as `origin` the two run along the two wires to the lamp (the energy).
 *
 *   const glow = createLoopGlow();  stand.base.frame.add(glow.group);
 *   glow.origin = glow.at(SWITCH.x, LOOP.near);  glow.meet = glow.origin + 0.5;  glow.color.set(col('amber'));
 *   glow.front = k;  glow.intensity = 1;  glow.update(t);   // every frame; `front` scrubs both ways
 */
import { AdditiveBlending, type Color, Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import { G } from '@/kit';
import { col } from '@/style';
import { LOOP, WIRE } from './layout';
import { loopPath } from './tools/frame';

const VERT = /* glsl */ `
varying float vS;
varying float vFacing;
uniform float uTotal;
void main() {
  vS = uv.x / uTotal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // some rings of the swept tube carry zero normals: no division by their length (a ternary does not guard it
  // on every GPU — both branches may be evaluated and mixed), so zero normals give 0, never NaN
  vec3 n = normalMatrix * normal;
  vFacing = min(abs(dot(n, normalize(-mv.xyz))) / max(length(n), 1e-4), 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying float vS;
varying float vFacing;
uniform vec3 uColor;
uniform float uOrigin;   // where the fronts start (share of the path)
uniform float uAhead;    // share the forward front covers at front = 1
uniform float uFront;    // 0 … 1
uniform float uEdge;     // soft width of a front (share)
uniform float uWake;     // brightness behind a front (0 … 1)
uniform float uPeak;     // extra brightness at a front
uniform float uIntensity;
uniform float uFlow;     // stripes running along (energy); 0 = none
uniform float uStripes;  // stripes round the whole loop
uniform float uDepth;    // how much darker a stripe's gap is (0 … 1)
uniform float uOutward;  // 1: stripes run away from the origin on both sides (energy to the lamp); 0: the path's way
uniform float uTime;
uniform vec2 uHide[4];  // stretches (shares of the path, from → to) where the sleeve passes unseen
void main() {
  float f = fract(vS - uOrigin);        // distance going the path's way
  float b = fract(uOrigin - vS);        // going against it
  float ra = uFront * uAhead;           // how far each front has got
  float rb = uFront * (1.0 - uAhead);
  float ca = 1.0 - smoothstep(ra - uEdge, ra + uEdge * 0.25, f);
  float cb = 1.0 - smoothstep(rb - uEdge, rb + uEdge * 0.25, b);
  float covered = max(ca, cb) * step(0.0001, uFront);
  // the bright band at each front, fading as the two meet into the steady wake
  float xa = (f - ra) / max(uEdge, 1e-4);
  float xb = (b - rb) / max(uEdge, 1e-4);
  float pa = exp(-xa * xa) * ca;
  float pb = exp(-xb * xb) * cb;
  float peak = max(pa, pb) * uPeak * (1.0 - smoothstep(0.9, 1.0, uFront) * 0.6);
  float along = uOutward > 0.5 ? (f <= uAhead ? f : b) : f;
  float stripes = uFlow > 0.0 ? 1.0 - uDepth * (0.5 - 0.5 * sin((along * uStripes - uTime * uFlow) * 6.2831853)) : 1.0;
  // the sleeve: dense where the eye looks through most of it (over the wire), melting at its outer edge
  // (no pow / sqrt: drivers compute them as x · inversesqrt(x) or exp2(y · log2 x), which is NaN at 0 — and
  // some rings of the tube face nowhere — the bloom then spreads each NaN into a black blot)
  float sleeve = vFacing * vFacing;
  float shown = 1.0;
  for (int i = 0; i < 4; i++) {
    vec2 h = uHide[i];
    if (h.y > h.x) {
      float e = 0.006;
      shown *= 1.0 - smoothstep(h.x - e, h.x + e, vS) * (1.0 - smoothstep(h.y - e, h.y + e, vS));
    }
  }
  float a = (covered * uWake * stripes + peak) * sleeve * uIntensity * shown;
  if (a < 0.002) discard;
  // alpha 0 with premultiplied additive blending, as the fx library does: the alpha belongs to the post pipeline
  gl_FragColor = vec4(uColor * a, 0.0);
}`;

export interface LoopGlow {
  /** Add to the board frame (`stand.base.frame`). */
  group: Mesh;
  /** Where the two fronts start, and where they meet at `front` = 1 (shares of `loopPath()`). */
  origin: number;
  meet: number;
  /** 0 nothing … 1 the two fronts have met (both ways, scrub freely). */
  front: number;
  /** 0 … 1 overall. */
  intensity: number;
  /** Brightness left behind the fronts (0 a travelling pulse only … 1 all lit), and the fronts' own extra. */
  wake: number;
  peak: number;
  /** Soft width of a front, as a share of the loop. */
  edge: number;
  /** Stripes running along the path's way at this speed (energy); 0 = steady light. */
  flow: number;
  /**
   * How many stripes round the whole loop (default 90) and how deep their gaps are, 0 … 1 (default 0.5: the
   * brightness runs 0.5 … 1). Few, shallow stripes read as a soft continuous flow (`lamp/handover`).
   */
  stripes: number;
  stripeDepth: number;
  /** Stripes run away from `origin` along both fronts (energy from the battery to the lamp) instead of the path's
   *  way (default false). */
  outward: boolean;
  /**
   * Stretches of the loop (pairs of shares, from < to, at most 4) where the sleeve passes unseen — through the
   * battery's body, the switch's block (`flow/push`). Default none.
   */
  hide: [number, number][];
  color: Color;
  /** Share of `loopPath()` nearest to a board point on the loop (x, z). */
  at(x: number, z: number): number;
  /** A point (board frame) at a share of the loop. */
  pointAt(s: number, out?: Vector3): Vector3;
  update(t: number): void;
}

/** The loop as one closed path without coinciding points (the corners' arcs leave some), and its length. */
let cached: { path: Vector3[]; total: number } | null = null;
function loop(): { path: Vector3[]; total: number } {
  if (!cached) {
    const path = loopPath().filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]!) > 1e-4);
    cached = { path, total: G.pathLength(path) };
  }
  return cached;
}
const tp = new Vector3();
const tq = new Vector3();
const ts = new Vector3();

/**
 * The share of `loopPath()` (0…1) nearest to a board point (x, z) on the loop — the nearest point of its SEGMENTS
 * (each straight side is one long segment, so its vertices alone would not do).
 */
export function loopShare(x: number, z: number): number {
  const { path, total } = loop();
  tp.set(x, LOOP.y, z);
  let best = 0;
  let d = Infinity;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const len = a.distanceTo(path[i]!);
    ts.subVectors(path[i]!, a);
    const t = len > 0 ? Math.min(Math.max(ts.dot(tq.subVectors(tp, a)) / (len * len), 0), 1) : 0;
    const dist = tq.copy(a).addScaledVector(ts, t).distanceTo(tp);
    if (dist < d) {
      d = dist;
      best = acc + t * len;
    }
    acc += len;
  }
  return best / total;
}

export function createLoopGlow(radius = WIRE.sheath * 3): LoopGlow {
  // (a zero-length step would give the tube NaN normals)
  const { path, total } = loop();
  const uniforms = {
    uColor: { value: col('amber') },
    uOrigin: { value: 0 },
    uAhead: { value: 0.5 },
    uFront: { value: 0 },
    uEdge: { value: 0.02 },
    uWake: { value: 0.35 },
    uPeak: { value: 1 },
    uIntensity: { value: 0 },
    uFlow: { value: 0 },
    uStripes: { value: 90 },
    uDepth: { value: 0.5 },
    uOutward: { value: 0 },
    uTime: { value: 0 },
    uHide: { value: [0, 1, 2, 3].map(() => new Vector2(0, 0)) },
    uTotal: { value: total },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  const geometry = G.tube(path, radius, { seg: 18, closed: false, caps: false });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'loop-glow';
  mesh.renderOrder = 6;
  mesh.frustumCulled = false;
  const glow: LoopGlow = {
    group: mesh,
    origin: 0,
    meet: 0.5,
    front: 0,
    intensity: 0,
    wake: 0.35,
    peak: 1,
    edge: 0.02,
    flow: 0,
    stripes: 90,
    stripeDepth: 0.5,
    outward: false,
    hide: [],
    color: uniforms.uColor.value,
    at: loopShare,
    pointAt(s, out = new Vector3()) {
      return G.pathAt(path, (((s % 1) + 1) % 1) * total, out);
    },
    update(t) {
      const u = uniforms;
      u.uOrigin.value = ((glow.origin % 1) + 1) % 1;
      u.uAhead.value = (((glow.meet - glow.origin) % 1) + 1) % 1 || 1;
      u.uFront.value = Math.min(Math.max(glow.front, 0), 1);
      u.uEdge.value = glow.edge;
      u.uWake.value = glow.wake;
      u.uPeak.value = glow.peak;
      u.uIntensity.value = glow.intensity;
      u.uFlow.value = glow.flow;
      u.uStripes.value = glow.stripes;
      u.uDepth.value = glow.stripeDepth;
      u.uOutward.value = glow.outward ? 1 : 0;
      u.uHide.value.forEach((v, i) => {
        const h = glow.hide[i];
        v.set(h ? h[0] : 0, h ? h[1] : 0);
      });
      u.uTime.value = t;
      mesh.visible = glow.intensity > 0.002 && glow.front > 0;
    },
  };
  return glow;
}
