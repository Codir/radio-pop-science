/**
 * What each of the three lenses of `flow/together` and `flow/push` shows: «усередині міді» (VISUAL §6) drawn as a
 * picture on a disc behind the glass — the front row of copper atoms (matte coral balls, a faint veil of their own
 * electrons), the row behind them out of focus, and about eight free electrons darting with short tails. Three full
 * copper worlds would not fit the frame's budget (and the stencil window shows one), so this is the same look in
 * one draw call per lens. The common shift is `shift` (atom spacings, integrated by the owner: it stands still
 * when the drift stops and runs on when it starts — in the same frame in all three lenses); `angle` turns the
 * picture so the wire's axis runs along the wire's direction as the reader sees it.
 */
import { CircleGeometry, Mesh, ShaderMaterial, Vector2 } from 'three';
import { col } from '@/style';

const VERT = /* glsl */ `
varying vec2 vP;
uniform float uRadius;
void main() {
  vP = position.xy / uRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
varying vec2 vP;
uniform float uTime;
uniform float uShift;    // the crowd's common shift along the wire, atom spacings
uniform float uWarm;     // 0 lamp off … 1 lamp on
uniform float uSeed;
uniform vec2 uAxis;      // the wire's direction in the picture (unit)
uniform vec3 uDeep;
uniform vec3 uCoral;
uniform vec3 uCoralDark;
uniform vec3 uCyan;
uniform vec3 uVeil;
const float CELLS = 2.3;   // atom spacings across the glass
const float R = 0.3125;    // atom radius / spacing (1 : 3.2)
const int N = 24;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
vec2 hash2(float n) { return vec2(hash(n), hash(n + 17.13)); }
// darting: straight flights between random waypoints, a new one a few times a second (−1 … 1)
vec2 dart(float id, float t) {
  float k = t * (2.6 + 2.2 * hash(id * 7.31)) + hash(id * 3.7) * 10.0;
  float i = floor(k);
  vec2 a = hash2(id * 13.1 + i * 1.37);
  vec2 b = hash2(id * 13.1 + (i + 1.0) * 1.37);
  return mix(a, b, fract(k)) * 2.0 - 1.0;
}
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0));
}
vec2 electron(float id, float t) {
  // a home of its own in a periodic tile 4 × 3 spacings, carried by the common shift; darting about it (the
  // tile is wide enough that a home wraps round only where its electron is outside the glass)
  vec2 home = hash2(id * 5.17 + uSeed) * vec2(4.0, 3.0);
  home.x = mod(home.x + uShift, 4.0) - 2.0;
  home.y -= 1.5;
  return home + dart(id + uSeed * 3.0, t) * vec2(0.48, 0.42);
}

void main() {
  float r = length(vP);
  // picture coordinates: x along the wire (the electrons' way), y across; in atom spacings
  vec2 q = vec2(dot(vP, uAxis), dot(vP, vec2(-uAxis.y, uAxis.x))) * CELLS * 0.5;
  float aa = fwidth(q.x) * 1.2;
  vec3 light = normalize(mix(vec3(-0.5, 0.6, 0.62), vec3(0.55, 0.6, 0.58), uWarm));
  vec3 c = uDeep * (1.0 - 0.35 * r * r);
  // the row behind: soft, dim, between the front atoms
  vec2 gb = q + vec2(0.5, 0.5);
  vec2 cb = gb - floor(gb + 0.5);
  float back = 1.0 - smoothstep(R * 0.7, R * 1.25, length(cb));
  c = mix(c, uCoralDark * 0.42, back * 0.8);
  // the front row: matte coral balls lit from the lamp (warm) or the moon (cool), each in a faint veil
  vec2 cf = q - floor(q + 0.5);
  float d = length(cf);
  c += uVeil * 0.16 * exp(-pow((d - R * 1.25) / 0.12, 2.0));
  float ball = 1.0 - smoothstep(R - aa, R + aa, d);
  vec3 n = vec3(cf / R, sqrt(max(1.0 - dot(cf, cf) / (R * R), 0.0)));
  float lit = clamp(dot(n, light), 0.0, 1.0);
  vec3 atom = mix(uCoralDark, uCoral, 0.25 + 0.75 * lit) * mix(0.72, 1.0, uWarm);
  atom += uCoral * 0.18 * pow(1.0 - n.z, 3.0);
  c = mix(c, atom, ball);
  // free electrons: bright cyan beads with short tapered tails, painted over everything
  float t = mod(uTime, 500.0);
  for (int i = 0; i < N; i++) {
    float id = float(i);
    vec2 p = electron(id, t);
    vec2 pt = electron(id, t - 0.07);
    float dd = length(q - p);
    float tail = segment(q, p, pt);
    float along = clamp(dot(q - pt, p - pt) / max(dot(p - pt, p - pt), 1e-6), 0.0, 1.0);
    c = mix(c, uCyan * 0.85, (1.0 - smoothstep(0.012, 0.012 + 0.05 * along + aa, tail)) * 0.75);
    c += uCyan * 0.35 * exp(-dd * dd / 0.012);
    c = mix(c, mix(uCyan, vec3(1.0), 0.45), 1.0 - smoothstep(0.065 - aa, 0.065 + aa, dd));
  }
  // the glass: darker toward the rim, one soft crescent of light at the upper left
  c *= 1.0 - 0.45 * smoothstep(0.7, 1.0, r);
  float crescent = smoothstep(0.78, 0.88, r) * (1.0 - smoothstep(0.9, 0.97, r))
    * smoothstep(0.55, 0.98, dot(vP / max(r, 1e-4), normalize(vec2(-0.62, 0.78))));
  c += vec3(0.75, 0.9, 1.0) * crescent * (0.1 + 0.12 * uWarm);
  gl_FragColor = vec4(c, 1.0);
}`;

export interface LensPicture {
  mesh: Mesh;
  /** Common shift (atom spacings) — integrate it yourself; time; the lamp; the wire's direction in the picture. */
  set(shift: number, t: number, warm: number, axis: Vector2): void;
}

export function lensPicture(radius: number, seed: number): LensPicture {
  const material = new ShaderMaterial({
    uniforms: {
      uRadius: { value: radius },
      uTime: { value: 0 },
      uShift: { value: 0 },
      uWarm: { value: 0 },
      uSeed: { value: seed },
      uAxis: { value: new Vector2(1, 0) },
      uDeep: { value: col('bg.void').lerp(col('coral.dark'), 0.16) },
      uCoral: { value: col('coral') },
      uCoralDark: { value: col('coral.dark') },
      uCyan: { value: col('cyan') },
      uVeil: { value: col('cyan.dark') },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const mesh = new Mesh(new CircleGeometry(radius, 72), material);
  mesh.name = 'flow-lens-picture';
  mesh.position.z = -0.014;
  return {
    mesh,
    set(shift, t, warm, axis) {
      const u = material.uniforms;
      u.uShift!.value = shift;
      u.uTime!.value = t;
      u.uWarm!.value = warm;
      (u.uAxis!.value as Vector2).copy(axis);
    },
  };
}
