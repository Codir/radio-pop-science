/**
 * Warmth in the heat view for things the stage's heat view keeps at room temperature (`build/short`: the battery
 * gets hot, the wires barely warmer). The stage's view (`shared/stage/bulb-thermal.ts`) draws every part of the stand
 * cold `blue` inside the ring; this adds twins of the given meshes drawn just after it, in the same false colour
 * and the same ring test, at a shade the step sets — so a warming battery runs blue → violet → magenta → orange
 * in the ring and nothing else changes. Chapter-only and additive: nothing of the stage is touched (requests §).
 */
import { LessEqualDepth, Mesh, ShaderMaterial, Vector3, type BufferGeometry, type Object3D } from 'three';
import { col } from '@/style';

const STOPS = ['blue', 'violet', 'magenta', 'orange', 'yellow', 'white'] as const;

const VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vWorld = w.xyz;
  vNormalW = normalize( mat3( modelMatrix ) * normal );
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// the look of the stage's heat view (`bulb-thermal.ts`), one shade for the whole object
const FRAGMENT = /* glsl */ `
uniform vec3 uStops[6];
uniform float uShade;
uniform float uAmount;
uniform vec3 uLensC;
uniform vec3 uLensN;
uniform float uLensR;
varying vec3 vWorld;
varying vec3 vNormalW;
float throughLens( vec3 p ) {
  vec3 d = p - cameraPosition;
  float dn = dot( d, uLensN );
  if ( abs( dn ) < 1e-5 ) return 0.0;
  float t = dot( uLensC - cameraPosition, uLensN ) / dn;
  if ( t <= 0.0 || t >= 1.0 ) return 0.0;
  float r = length( cameraPosition + d * t - uLensC );
  return 1.0 - smoothstep( uLensR * 0.985, uLensR, r );
}
vec3 ramp( float x ) {
  float s = clamp( x, 0.0, 1.0 ) * 5.0;
  int i = int( min( floor( s ), 4.0 ) );
  vec3 a = uStops[0];
  vec3 b = uStops[1];
  for ( int k = 1; k < 5; k++ ) if ( k == i ) { a = uStops[k]; b = uStops[k + 1]; }
  return mix( a, b, s - float( i ) );
}
void main() {
  float inside = throughLens( vWorld ) * uAmount;
  if ( inside < 0.004 ) discard;
  vec3 v = normalize( cameraPosition - vWorld );
  vec3 n = normalize( vNormalW );
  float facing = abs( dot( n, v ) );
  float key = 0.5 + 0.5 * n.y;
  vec3 c = ramp( uShade ) * ( 0.38 + 0.4 * facing + 0.32 * key );
  c += vec3( 0.18, 0.22, 0.45 ) * pow( max( 1.0 - facing, 1e-3 ), 3.0 ) * ( 1.0 - uShade );
  c *= 1.0 + 0.7 * smoothstep( 0.8, 1.0, uShade );
  gl_FragColor = vec4( c, inside );
}`;

export interface Warmth {
  /** 0…1 on the false-colour scale (0 = room, the stage's own blue). */
  shade: number;
  /** 0…1: drawn only while the stage's heat view is on (pass `stand.lamp.thermal`). */
  amount: number;
  /** Twins drawn now (QA). */
  readonly count: number;
  update(): void;
}

/**
 * Twins of the meshes below `roots` whose names match `only` (the outside of a part: its section, picks and print
 * are other meshes), read through the magnifier's `glass` (local XY disc facing +z).
 */
export function createWarmth(roots: readonly Object3D[], glass: Mesh, only: RegExp): Warmth {
  const uniforms = {
    uStops: { value: STOPS.map((t) => col(t)) },
    uShade: { value: 0 },
    uAmount: { value: 0 },
    uLensC: { value: new Vector3() },
    uLensN: { value: new Vector3() },
    uLensR: { value: 0 },
  };
  const material = new ShaderMaterial({
    name: 'thermal.warm',
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthFunc: LessEqualDepth,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });
  let twins: { src: Mesh; twin: Mesh }[] | null = null;
  const build = (): void => {
    const list: { src: Mesh; twin: Mesh }[] = [];
    for (const root of roots)
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || !only.test(m.name)) return;
        // invisible pick volumes (no colour, or a material that is not drawn) get no twin
        const mat = m.material as { colorWrite?: boolean; visible?: boolean } | undefined;
        if (!mat || mat.colorWrite === false || mat.visible === false) return;
        // flat print has no normals (its shade would be NaN, spread by the bloom)
        if (!m.geometry.getAttribute('normal')) return;
        const twin = new Mesh(m.geometry, material);
        twin.name = `thermal-warm:${m.name}`;
        twin.renderOrder = 4996;
        twin.raycast = () => {};
        twin.castShadow = twin.receiveShadow = false;
        twin.onBeforeRender = aim;
        list.push({ src: m, twin });
      });
    for (const t of list) t.src.add(t.twin);
    twins = list;
  };
  const s = new Vector3();
  /** The ring where it is drawn (the chapter lays the lens after the stage's update). */
  const aim = (): void => {
    glass.updateWorldMatrix(true, false);
    glass.getWorldPosition(uniforms.uLensC.value);
    uniforms.uLensN.value.set(0, 0, 1).transformDirection(glass.matrixWorld);
    glass.getWorldScale(s);
    const geo = glass.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    uniforms.uLensR.value = geo.boundingSphere!.radius * Math.max(s.x, s.y);
  };
  const warm: Warmth = {
    shade: 0,
    amount: 0,
    get count() {
      return twins?.filter((t) => t.twin.visible).length ?? 0;
    },
    update() {
      const on = warm.amount > 0.002 && warm.shade > 0.002;
      if (on && !twins) build();
      if (!twins) return;
      for (const t of twins) {
        // a part dissolved by its material's `fade` (the battery's section while closed) is not there to be warm
        const fade = (t.src.material as { fade?: number }).fade;
        t.twin.visible = on && (fade === undefined || fade > 0.02);
        if (t.twin.geometry !== t.src.geometry) t.twin.geometry = t.src.geometry as BufferGeometry;
      }
      if (!on) return;
      uniforms.uShade.value = warm.shade;
      uniforms.uAmount.value = Math.min(warm.amount, 1) * Math.min(warm.shade / 0.05, 1);
    },
  };
  return warm;
}
