/**
 * The snail (VISUAL.md §5.6). A simple living figure as tall as the battery's diameter: spiral shell `amber` /
 * `orange` with two tonal bands, body `mist` with a pink tint, two feelers with dot eyes. It creeps evenly along
 * the wire in the crawl (`tools/crawl.ts`, which places it and draws its trail) — a measure, not a clown.
 * Local frame: +x = forward, origin on the board under the middle of the foot.
 */
import { BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { K, col } from '@/style';
import { BATTERY } from '../layout';

const HEIGHT = BATTERY.radius * 2;
/** The shell leans to the snail's left by this angle, is this much wider than its tube, and sits back over the foot. */
const SHELL_LEAN = { angle: -0.6, width: 1.55, shift: 0.07 } as const;

function shellGeometry(): Mesh['geometry'] {
  // logarithmic spiral in the local XY plane, the tube thins toward the centre; it bulges a little sideways
  const pts: Vector3[] = [];
  const turns = 2.35;
  const n = 96;
  const R = HEIGHT * 0.36;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = -0.5 + s * turns * Math.PI * 2;
    const r = R * Math.exp(-s * 2.1);
    pts.push(new Vector3(-Math.cos(a) * r, Math.sin(a) * r, 0.05 * s));
  }
  const g = G.tube(pts, HEIGHT * 0.2, { seg: 16, taper: (t) => Math.max(1 - t * 0.86, 0.1) });
  // two tonal bands along the spiral: colour by the angle around the tube
  const uv = g.getAttribute('uv');
  const colors = new Float32Array(uv.count * 3);
  const light = col('amber');
  const dark = col('orange').lerp(col('orange.dark'), 0.35);
  for (let i = 0; i < uv.count; i++) {
    const around = uv.getY(i);
    const band = Math.abs(((around * 2) % 1) - 0.5) < 0.17 ? dark : light;
    colors.set([band.r, band.g, band.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

export interface SnailModel {
  /** Placed, turned, scaled and shown by the crawl (`tools/crawl.ts`). */
  group: Group;
  /** Phase of the creeping wave in radians, and how hard it creeps 0…1 — 0 is rest. Set by the crawl. */
  wave: number;
  effort: number;
  /** The body's motion; call every frame. */
  update(dt: number, t: number): void;
}

export function createSnail(): SnailModel {
  const b = new Builder('snail');
  const skin = col('mist').lerp(col('pink'), 0.22);
  const skinDark = col('mist').lerp(col('pink'), 0.4).lerp(col('slate'), 0.25);
  // foot: a long flat drop; neck and head rise at the front
  b.sphere(0.2, { at: [0, 0.07, 0], s: [2.3, 0.4, 0.8], seg: 20, slot: 'soft', c: [skinDark, skin] });
  b.sphere(0.13, { at: [0.3, 0.17, 0], s: [1.15, 1.25, 0.95], seg: 18, slot: 'soft', c: [skinDark, skin] });
  b.sphere(0.115, { at: [0.36, 0.3, 0], seg: 18, slot: 'soft', c: skin });
  const model = b.build();
  const group = model.group;
  const body = group.getObjectByName('snail:soft');
  const shell = new Mesh(
    shellGeometry(),
    K.toon({ color: 'white', vertexColors: true, gloss: 0.6, highlight: 0.5 }),
  );
  // a full shell carried leaning to one side, as snails do: from behind and from above it shows its spiral
  // face, not the edge of a disc
  shell.rotation.set(SHELL_LEAN.angle, 0, -0.18);
  shell.scale.set(1, 1, SHELL_LEAN.width);
  shell.castShadow = shell.receiveShadow = true;
  shell.name = 'snail:shell';
  group.add(shell);
  // horns: each its own little group so that it can sway from its root
  const hornMaterial = K.toon({ color: skin, softness: 0.2 });
  const eyeMaterial = K.toon({ color: 'ink', gloss: 0.9 });
  const horns: Group[] = [];
  for (const k of [-1, 1] as const) {
    const horn = new Group();
    horn.position.set(0.4, 0.37, k * 0.05);
    const stalk = new Mesh(G.capsule(0.022, 0.19, 8), hornMaterial);
    stalk.position.y = 0.085;
    const eye = new Mesh(G.sphere(0.034, 10), eyeMaterial);
    eye.position.y = 0.185;
    horn.add(stalk, eye);
    horns.push(horn);
    group.add(horn);
  }
  group.traverse((o) => (o.castShadow = true));
  group.visible = false;
  const state = { wave: 0, effort: 0 };
  return {
    group,
    get wave() {
      return state.wave;
    },
    set wave(v: number) {
      state.wave = v;
    },
    get effort() {
      return state.effort;
    },
    set effort(v: number) {
      state.effort = Math.min(Math.max(v, 0), 1);
    },
    update(_dt, t) {
      // creeping: the foot stretches and gathers, the shell is carried after it with a small rock, the feelers
      // reach forward and feel about; at rest only a breath of the feelers is left
      const w = state.wave;
      const k = state.effort;
      const stretch = Math.sin(w) * k;
      horns.forEach((horn, i) => {
        horn.rotation.z =
          -0.45 - 0.16 * k + 0.2 * k * Math.sin(w * 0.5 + i * 2.2) + 0.03 * Math.sin(t * 0.8 + i);
        horn.rotation.x =
          (i ? 0.3 : -0.3) + 0.14 * k * Math.sin(w * 0.37 + i * 1.3) + 0.02 * Math.sin(t * 0.6 + i);
      });
      if (body) body.scale.set(1 + 0.085 * stretch, 1 - 0.06 * stretch, 1);
      shell.position.set(
        -0.07 - 0.04 * Math.sin(w - 0.9) * k,
        HEIGHT * 0.5 - 0.012 * stretch,
        SHELL_LEAN.shift,
      );
      shell.rotation.z = -0.18 + 0.05 * Math.sin(w - 0.9) * k;
    },
  };
}
