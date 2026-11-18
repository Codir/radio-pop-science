/**
 * The heat view through the magnifier (VISUAL.md §5.3 `lamp/hot-spot`, PATH `resistance/heat`): whatever the ring
 * covers turns false colour — things at room temperature (wires, battery, the lamp's base) cold `blue`, the
 * leads warmer toward the coil, the coil white when it works. Everything else under the ring (board, table,
 * room) sinks into a cold dark.
 *
 * No render target (phone budget): every mesh of the stand gets a twin that shares its geometry, drawn after the
 * scene in false colour; its fragment shader keeps only what is seen THROUGH the ring (the ray from the camera
 * to the fragment crosses the lens disc inside its radius). A dark disc on the lens glass lays the cold ground.
 * The twins are built on the first use and drawn only while `thermal > 0` (≈ 50 small draw calls; the shader drops
 * everything outside the ring at once).
 */
import { type BufferGeometry, LessEqualDepth, Mesh, type Object3D, ShaderMaterial, Vector3 } from 'three';
import { col } from '@/style';
import { ROOM_C, WORK_C, temperatureOfHeat } from './bulb-heat';

/** False-colour scale of the heat view, cold → hot. */
const STOPS = ['blue', 'violet', 'magenta', 'orange', 'yellow', 'white'] as const;

/** Position on the false-colour scale 0…1 for a temperature: logarithmic, so a lead at 300 °C is already warm. */
export function thermalShade(celsius: number): number {
  const x = Math.max(celsius - ROOM_C, 0);
  return Math.min(Math.log1p(x / 40) / Math.log1p((WORK_C - ROOM_C) / 40), 1);
}

const VERTEX = /* glsl */ `
uniform float uY0;
uniform float uY1;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vAlong;
varying float vTint;
#ifdef USE_TINT
attribute vec3 color;
#endif
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vWorld = w.xyz;
  vNormalW = normalize( mat3( modelMatrix ) * normal );
  vAlong = clamp( ( position.y - uY0 ) / max( uY1 - uY0, 1e-4 ), 0.0, 1.0 );
#ifdef USE_TINT
  vTint = color.r;
#else
  vTint = 1.0;
#endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const LENS_TEST = /* glsl */ `
uniform vec3 uLensC;
uniform vec3 uLensN;
uniform float uLensR;
// 1 inside the ring as seen from the camera (soft over a hair of the radius), 0 outside
float throughLens( vec3 p ) {
  vec3 d = p - cameraPosition;
  float dn = dot( d, uLensN );
  if ( abs( dn ) < 1e-5 ) return 0.0;
  float t = dot( uLensC - cameraPosition, uLensN ) / dn;
  if ( t <= 0.0 || t >= 1.0 ) return 0.0;
  float r = length( cameraPosition + d * t - uLensC );
  return 1.0 - smoothstep( uLensR * 0.985, uLensR, r );
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uStops[6];
uniform float uAmount;
uniform float uShade0;
uniform float uShade1;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vAlong;
varying float vTint;
${LENS_TEST}
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
  float shade = mix( uShade0, uShade1, vAlong ) * vTint;
  vec3 v = normalize( cameraPosition - vWorld );
  float facing = abs( dot( normalize( vNormalW ), v ) );
  // flat false colour with a little form: lit centre, darker toward the silhouette, hot things glow past 1
  // a soft key from above in the view keeps the forms of the cold parts apart (a socket is not a flat blue blob)
  float key = 0.5 + 0.5 * normalize( vNormalW ).y;
  vec3 c = ramp( shade ) * ( 0.38 + 0.4 * facing + 0.32 * key );
  c += vec3( 0.18, 0.22, 0.45 ) * pow( 1.0 - facing, 3.0 ) * ( 1.0 - shade ); // cold rim
  c *= 1.0 + 0.7 * smoothstep( 0.8, 1.0, shade );
  gl_FragColor = vec4( c, inside );
}`;

const DISC_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAmount;
void main() {
  gl_FragColor = vec4( uColor, uAmount );
}`;

const DISC_VERTEX = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

/** What a twin shows: one shade, a shade along the local height, or the coil (shade × its cooler ends). */
type Kind = 'room' | 'leads' | 'coil';

export interface ThermalView {
  /** 0…1: how much of the heat view shows inside the ring. */
  set(amount: number): void;
  /** Every frame: the ring's place, the coil's heat, which twins can be seen through the ring. */
  update(heat: number): void;
}

export interface ThermalSetup {
  /** Everything that gets a twin (the stand: battery, lamp, switch, wires, mounts). */
  root: Object3D;
  /** The magnifier's glass disc (local XY plane, facing +z). */
  glass: Mesh;
  /** The lamp's group (its local frame: origin the bottom contact, +y up) and the heights of its leads. */
  bulb: Object3D;
  stemY: number;
  filamentY: number;
}

const SKIP = /glass|halo|glare|depth|bead|motes/;

export function createThermal(setup: ThermalSetup): ThermalView {
  const lens = { uLensC: { value: new Vector3() }, uLensN: { value: new Vector3() }, uLensR: { value: 0 } };
  const amount = { value: 0 };
  const stops = { value: STOPS.map((t) => col(t)) };
  const make = (kind: Kind): ShaderMaterial =>
    new ShaderMaterial({
      name: `thermal.${kind}`,
      uniforms: {
        ...lens,
        uStops: stops,
        uAmount: amount,
        uShade0: { value: 0 },
        uShade1: { value: 0 },
        uY0: { value: kind === 'leads' ? setup.stemY : 0 },
        uY1: { value: kind === 'leads' ? setup.filamentY : 1 },
      },
      defines: kind === 'coil' ? { USE_TINT: '' } : {},
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthFunc: LessEqualDepth,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
  const mats = { room: make('room'), leads: make('leads'), coil: make('coil') };
  const disc = new Mesh(
    setup.glass.geometry,
    new ShaderMaterial({
      name: 'thermal.ground',
      uniforms: { uColor: { value: col('bg.void').lerp(col('bg.indigo'), 0.35) }, uAmount: { value: 0 } },
      vertexShader: DISC_VERTEX,
      fragmentShader: DISC_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  disc.name = 'thermal:ground';
  disc.renderOrder = 4990;
  disc.raycast = () => {};
  disc.visible = false;
  setup.glass.add(disc);

  interface Twin {
    src: Mesh;
    twin: Mesh;
  }
  let twins: Twin[] | null = null;
  const build = (): Twin[] => {
    const list: Twin[] = [];
    const bulbMeshes = new Set<Object3D>();
    setup.bulb.traverse((o) => bulbMeshes.add(o));
    setup.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || (m as { isInstancedMesh?: boolean }).isInstancedMesh || SKIP.test(m.name)) return;
      // flat print (text) has no normals: its twin would shade NaN, which the bloom spreads (`build/short`)
      if (!m.geometry.getAttribute('normal')) return;
      const material = m.material as { transparent?: boolean; name?: string } | undefined;
      if (!material || /glass|thermal/.test(material.name ?? '')) return;
      const coil = /filament|fine-coil/.test(m.name);
      const kind: Kind = coil ? 'coil' : bulbMeshes.has(m) ? 'leads' : 'room';
      const twin = new Mesh(m.geometry, mats[kind]);
      twin.name = `thermal:${m.name}`;
      twin.renderOrder = 4995;
      twin.raycast = () => {};
      twin.castShadow = false;
      twin.receiveShadow = false;
      twin.visible = false;
      list.push({ src: m, twin });
    });
    // added after the walk (adding children while traversing would visit the twins)
    for (const t of list) t.src.add(t.twin);
    return list;
  };

  const c = new Vector3();
  const s = new Vector3();
  let on = false;
  /** The ring's centre, facing and radius (world) into the uniforms. */
  const aim = (): void => {
    const glass = setup.glass;
    glass.updateWorldMatrix(true, false);
    glass.getWorldPosition(c);
    lens.uLensC.value.copy(c);
    lens.uLensN.value.set(0, 0, 1).transformDirection(glass.matrixWorld);
    glass.getWorldScale(s);
    const geo = glass.geometry as BufferGeometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    lens.uLensR.value = geo.boundingSphere!.radius * Math.max(s.x, s.y);
  };
  // the chapter may lay the lens after the stage's update: the shader takes the ring where it is drawn (the
  // ground disc is drawn first of all the heat view)
  disc.onBeforeRender = () => void aim();
  return {
    set(value) {
      amount.value = Math.min(Math.max(value, 0), 1);
      on = amount.value > 0.002;
      if (on && !twins) twins = build();
      disc.visible = on;
      (disc.material as ShaderMaterial).uniforms.uAmount!.value = 0.9 * amount.value;
      if (!on && twins) for (const t of twins) t.twin.visible = false;
    },
    update(heat) {
      if (!on || !twins) return;
      const coilC = temperatureOfHeat(heat);
      mats.coil.uniforms.uShade0!.value = mats.coil.uniforms.uShade1!.value = thermalShade(coilC);
      // the supports: room temperature at the stem, about a third of the coil's temperature at their tips
      mats.leads.uniforms.uShade1!.value = thermalShade(ROOM_C + 0.35 * (coilC - ROOM_C));
      for (const t of twins) {
        // the wires rebuild their geometry while they change shape
        if (t.twin.geometry !== t.src.geometry) t.twin.geometry = t.src.geometry;
        t.twin.visible = true;
      }
    },
  };
}
