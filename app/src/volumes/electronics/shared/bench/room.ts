/**
 * Copied from `circuit/shared/stage/room.ts` (shared/README.md, «Копії»): the bench stands in the circuit's room
 * (docs/volumes/electronics/VISUAL.md §2).
 * The dark room: night, void → deep indigo, a smooth round table top without a single detail,
 * and far behind, out of focus, a few warm and cool blurs — a hint of a window, no objects.
 * The room has no light of its own except the cold "moon" (the environment's key light, from the upper left).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  CircleGeometry,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { ChapterContext } from '@/engine/api';
import { G } from '@/kit';
import { col, type ColorLike, type EnvOverrides } from '@/style';
import { surface } from './materials';

/** Radius of the table top and the y of its surface (world). */
export const TABLE = { radius: 8.6, y: 0, thickness: 0.34 } as const;

/** Direction toward the moon (world): upper left, slightly in front of the stand. */
export const MOON_DIR = new Vector3(-0.62, 0.72, 0.3).normalize();

/** Environment base for the `studio` backdrop kind: everything the room does not have is switched off. */
export const ROOM_ENV: EnvOverrides = {
  top: 'bg.void',
  mid: 'bg.deep',
  bottom: 'bg.void',
  horizon: 0.02,
  horizonWidth: 0.34,
  bokeh: 0,
  motes: 0,
  floor: 0,
  sunDir: [MOON_DIR.x, MOON_DIR.y, MOON_DIR.z],
  keyColor: col('sky').lerp(col('white'), 0.25),
  rimColor: 'blue',
  rimDir: [-0.5, 0.45, -0.74],
  fogColor: 'bg.void',
  fogDensity: 0,
};

const BLUR_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
// a defocused light: flat disc with a soft edge and a slightly brighter rim, like a real out-of-focus highlight
const BLUR_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float r = length( vUv - 0.5 ) * 2.0;
  float disc = 1.0 - smoothstep( 0.72, 1.0, r );
  float rim = smoothstep( 0.45, 0.8, r ) * 0.35 + 0.65;
  gl_FragColor = vec4( uColor * disc * rim * uAlpha, 1.0 );
}`;

function blur(color: ColorLike, alpha: number, size: number, x: number, y: number, z: number): Mesh {
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: col(color) }, uAlpha: { value: alpha } },
    vertexShader: BLUR_VERTEX,
    fragmentShader: BLUR_FRAGMENT,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    fog: false,
  });
  const mesh = new Mesh(new CircleGeometry(size, 40), material);
  mesh.position.set(x, y, z);
  mesh.name = 'room-blur';
  mesh.renderOrder = -5;
  return mesh;
}

export interface Room {
  group: Group;
  table: Mesh;
  /** 0…1: how much the far blurs show (they are part of the room, so they stay when the lamp is off). */
  setBlurs(amount: number): void;
}

export function createRoom(ctx: ChapterContext): Room {
  ctx.env.base(ROOM_ENV);
  const group = new Group();
  group.name = 'room';

  // table top: a thick disc with a rounded rim; only arcs of its edge show around the stand
  const R = TABLE.radius;
  const profile: G.Pt[] = G.fillet(
    [
      [0, -TABLE.thickness],
      [R - 0.12, -TABLE.thickness],
      [R, -TABLE.thickness * 0.5],
      [R - 0.02, 0],
      [0, 0],
    ],
    [0, 0.1, 0.12, 0.1, 0],
    5,
  );
  // the top darkens softly toward its edge (the stand is the lit island) and the rounded rim is a tone lighter,
  // so the table's far arc reads as an edge against the room instead of a flat disc ending
  const tableGeometry = G.lathe(profile, { seg: 128 });
  const tp = tableGeometry.getAttribute('position');
  const shade = new Float32Array(tp.count * 3);
  for (let i = 0; i < tp.count; i++) {
    const r = Math.hypot(tp.getX(i), tp.getZ(i)) / R;
    const rim = tp.getY(i) < -0.004 || r > 0.985 ? 1.9 : 1;
    const k = (1 - 0.5 * Math.min(Math.max((r - 0.45) / 0.55, 0), 1) ** 1.6) * rim;
    shade.set([k, k, k * (rim > 1 ? 1.15 : 1)], i * 3);
  }
  tableGeometry.setAttribute('color', new BufferAttribute(shade, 3));
  const table = new Mesh(
    tableGeometry,
    surface({ color: 'bg.indigo', scatter: 0.085, pool: 0.5, vertexColors: true }),
  );
  table.position.y = TABLE.y;
  table.receiveShadow = true;
  table.name = 'table';
  group.add(table);

  // the hint of a window: five blurs far behind and above the table, warm and cool, never an object
  // (they sit below the table's level on purpose: the main shot looks down, and its upper corners — beside the
  // table's far arc — are the only place where "far behind" is in the frame)
  const blurs = [
    blur(col('amber').lerp(col('orange'), 0.4), 0.3, 2.2, -17.2, -9.9, -30),
    blur('sky', 0.16, 1.4, -24.5, -7.6, -31),
    blur(col('blue').lerp(col('violet'), 0.5), 0.3, 2.6, 21, -8.6, -32),
    blur(col('yellow').lerp(col('white'), 0.3), 0.18, 1.1, 16.5, -6.8, -30),
    blur('bg.plum', 0.5, 3.4, -13.5, -5.6, -33),
  ];
  for (const b of blurs) group.add(b);
  const base = blurs.map((b) => (b.material as ShaderMaterial).uniforms.uAlpha!.value as number);
  return {
    group,
    table,
    setBlurs(amount) {
      blurs.forEach((b, i) => ((b.material as ShaderMaterial).uniforms.uAlpha!.value = base[i]! * amount));
    },
  };
}
