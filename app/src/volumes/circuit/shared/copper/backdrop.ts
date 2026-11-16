/**
 * The air of the lower floors. The state of the circuit reaches down here as light (VISUAL §3): with the lamp
 * on, warm light pours from above; with the lamp off the same space is cool and dim. Two parts share one
 * shader: a dome behind everything, and thin veils between the atomic planes that lay that light and the dark
 * of the depth over the planes behind — so the rows recede whatever the host chapter's fog and sky are.
 */
import {
  BackSide,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { col, kGlobals } from '@/style';
import { PLANE_GAP, PLANES } from './layout';

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform vec3 uDeep;   // colour of the depth
uniform vec3 uVoid;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform vec3 uUp;     // «above» and «right» of the copper world in world space
uniform vec3 uRight;
uniform float uLamp;
uniform float uAlpha;
uniform float uVeil;  // 0 = dome, 1 = veil between planes
uniform float uKTime;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dot(dir, uUp);                       // sine of the elevation of this line of sight
  float side = mix(-0.45, 0.45, uLamp);          // the lamp stands to the upper right, the cool light is upper left
  float lateral = dot(dir, uRight);
  float glow = smoothstep(-0.3, 0.34, h * 0.92 + lateral * side * 0.5);
  glow *= glow;
  // shafts: a fan of soft rays from the lamp far above the frame, drifting very slowly; each veil has its own
  // phase, so the rays have depth
  float fan = atan(lateral - side * 1.3, 0.85 - h);
  float bands = 0.5 + 0.3 * sin(fan * 19.0 + uKTime * 0.05 + uVeil * vLocal.z * 1.7) + 0.2 * sin(fan * 41.0 - uKTime * 0.03 + uVeil * vLocal.z);
  bands = mix(1.0, smoothstep(0.15, 0.85, bands), 0.3 * smoothstep(0.0, 0.3, glow));
  vec3 light = mix(uCool * 0.3, uWarm * 0.72, uLamp) * glow * bands * mix(1.0, 0.3, uVeil);
  vec3 base = mix(uVoid, uDeep, smoothstep(-0.5, 0.25, h));
  float a = uAlpha * mix(1.0, 0.6 + 0.1 * glow, uVeil);
  gl_FragColor = vec4(base + light, a);
}`;

export interface Backdrop {
  /** The dome: mount it unscaled. The veils between the atomic planes: mount them with the lattice. */
  group: Group;
  sheets: Group;
  /** 0 = lamp off (cool, dim) … 1 = lamp on (warm light from above). */
  lamp: number;
  /** 0…1 presence of the dome (0 on the wire-core floor: the room shows) and of the veils. */
  dome: number;
  veils: number;
  /** «Above» in world space (set from the mount's orientation). */
  up: Vector3;
  right: Vector3;
}

export function createBackdrop(): Backdrop {
  const group = new Group();
  group.name = 'copper-backdrop';
  const uniforms = (veil: number) => ({
    uDeep: { value: col('bg.deep').lerp(col('bg.indigo'), 0.35) },
    uVoid: { value: col('bg.void') },
    uWarm: { value: col('yellow.light').lerp(col('amber'), 0.25) },
    uCool: { value: col('sky') },
    uUp: shared.uUp,
    uRight: shared.uRight,
    uLamp: shared.uLamp,
    uAlpha: { value: 1 },
    uVeil: { value: veil },
    uKTime: kGlobals.uKTime,
  });
  const shared = {
    uUp: { value: new Vector3(0, 1, 0) },
    uRight: { value: new Vector3(1, 0, 0) },
    uLamp: { value: 0 },
  };
  const material = (veil: number): ShaderMaterial =>
    new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: uniforms(veil),
      transparent: true,
      depthWrite: false,
      side: veil ? DoubleSide : BackSide,
    });
  const domeMaterial = material(0);
  const dome = new Mesh(new SphereGeometry(300, 32, 20), domeMaterial);
  dome.name = 'copper-dome';
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  group.add(dome);
  const veilMaterial = material(1);
  const sheets = new Group();
  sheets.name = 'copper-veils';
  const sheet = new PlaneGeometry(260, 160);
  for (let k = 0; k < PLANES - 1; k++) {
    const veil = new Mesh(sheet, veilMaterial);
    // well in front of the plane it veils: the atoms are view-facing impostors, and from the side their depth
    // comes a little nearer than the true sphere — at the half-way point they showed through as bright spots
    veil.position.z = -(k * PLANE_GAP + 0.85);
    // far to near, after the dome and before haze, tails and glows
    veil.renderOrder = -10 + k * -1;
    veil.name = `copper-veil-${k}`;
    sheets.add(veil);
  }
  return {
    group,
    sheets,
    get lamp() {
      return shared.uLamp.value;
    },
    set lamp(v: number) {
      shared.uLamp.value = v;
    },
    get dome() {
      return domeMaterial.uniforms.uAlpha!.value as number;
    },
    set dome(v: number) {
      domeMaterial.uniforms.uAlpha!.value = v;
      dome.visible = v > 0.003;
    },
    get veils() {
      return veilMaterial.uniforms.uAlpha!.value as number;
    },
    set veils(v: number) {
      veilMaterial.uniforms.uAlpha!.value = v;
      sheets.visible = v > 0.003;
    },
    up: shared.uUp.value,
    right: shared.uRight.value,
  };
}
