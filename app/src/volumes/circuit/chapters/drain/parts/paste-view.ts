/**
 * `inner`'s view inside the magnifier over the dead battery: the separator enlarged (`paste-shader.ts`) with the
 * deposit that grew in it, and the paste's charged particles (`sky`, as the battery's section draws them) carrying
 * the charge across it from the oxide (right) toward the zinc (left). Where a particle meets a lump of deposit it
 * slows, often sticks for a moment — the lump glows `orange` — then squeezes on. Few particles (VISUAL §6: the eye
 * must find one); the stuck ones are the brightest. Lies in the lens's ring plane, just behind the glass.
 */
import { CircleGeometry, Group, Mesh, Object3D, ShaderMaterial, Vector2, Vector4 } from 'three';
import { col } from '@/style';
import { createSoftDots } from '@circuit/shared/copper/soft-dots';
import { BLOBS, PASTE_FRAGMENT, PASTE_VERTEX } from './paste-shader';

/** Radius of the picture in the ring's frame (the ring's inner edge is ≈ 0.39). */
const R = 0.388;
const COUNT = 11;
/** Free speed (disc radii per second) and the share of it left inside a lump. */
const SPEED = 0.42;
const SLOW = 0.22;

interface Particle {
  x: number;
  y: number;
  lane: number;
  phase: number;
  stuck: number;
  /** The lump it last stuck in (it sticks once per lump). */
  last: number;
  at: Vector2;
}

/** A fixed, irregular layer of deposit: most of it on the zinc's side of the separator and in it (seeded). */
function deposit(): Vector4[] {
  let s = 7;
  const rnd = (): number => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: Vector4[] = [];
  for (let i = 0; i < BLOBS; i++) {
    const x = -0.75 + 1.05 * rnd() ** 1.3;
    const y = -0.85 + 1.7 * ((i + rnd() * 0.8) / BLOBS);
    out.push(new Vector4(x, y, 0.09 + 0.08 * rnd(), 0));
  }
  return out;
}

export interface PasteView {
  group: Group;
  /** 0 hidden … 1 shown. */
  shown: number;
  light: number;
  /** Anchors for captions (in the ring's frame): a lump of deposit, the stream of particles. */
  anchors: { deposit: Object3D; particles: Object3D };
  /** Particles stuck right now. */
  readonly stuck: number;
  update(dt: number, t: number): void;
}

export function createPasteView(): PasteView {
  const group = new Group();
  group.name = 'drain:paste-view';
  group.position.z = -0.011;
  const blobs = deposit();
  const material = new ShaderMaterial({
    uniforms: {
      uRadius: { value: R },
      uBlobs: { value: blobs },
      uShown: { value: 0 },
      uLight: { value: 1 },
      uTime: { value: 0 },
      uGel: { value: col('bg.indigo').lerp(col('slate'), 0.25) },
      uPaste: { value: col('bg.violet').lerp(col('ink'), 0.35) },
      uOxide: { value: col('ink') },
      uOxidePale: { value: col('slate') },
      uDeposit: { value: col('mist').lerp(col('slate'), 0.4) },
      uHot: { value: col('orange') },
    },
    vertexShader: PASTE_VERTEX,
    fragmentShader: PASTE_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const disc = new Mesh(new CircleGeometry(R, 64), material);
  disc.renderOrder = 940;
  const dots = createSoftDots(COUNT, 'sky');
  dots.mesh.renderOrder = 945;
  dots.mesh.position.z = 0.004;
  group.add(disc, dots.mesh);
  const depositAt = new Object3D();
  const big = blobs.reduce((a, b) => (b.z > a.z && Math.abs(b.y) < 0.5 ? b : a), blobs[0]!);
  depositAt.position.set(big.x * R, big.y * R, 0);
  const particlesAt = new Object3D();
  particlesAt.position.set(0.62 * R, 0.1 * R, 0);
  group.add(depositAt, particlesAt);

  const parts: Particle[] = [];
  for (let i = 0; i < COUNT; i++) {
    const lane = -0.8 + (1.6 * (i + 0.5)) / COUNT;
    parts.push({
      x: 1 - 2 * ((i * 0.618) % 1),
      y: lane,
      lane,
      phase: i * 1.7,
      stuck: 0,
      last: -1,
      at: new Vector2(),
    });
  }
  let shown = 0;
  let stuckNow = 0;
  const view: PasteView = {
    group,
    get shown() {
      return shown;
    },
    set shown(v: number) {
      shown = v;
      material.uniforms.uShown!.value = v;
      dots.fade = v;
      group.visible = v > 0.004;
    },
    light: 1,
    anchors: { deposit: depositAt, particles: particlesAt },
    get stuck() {
      return stuckNow;
    },
    update(dt, t) {
      material.uniforms.uLight!.value = view.light;
      material.uniforms.uTime!.value = t;
      for (const b of blobs) b.w = Math.max(0, b.w - dt / 0.45);
      if (!group.visible) return;
      stuckNow = 0;
      parts.forEach((p, i) => {
        let inLump = -1;
        for (let k = 0; k < blobs.length; k++) {
          const b = blobs[k]!;
          if (Math.hypot(p.x - b.x, p.y - b.y) < b.z * 0.95) inLump = k;
        }
        if (p.stuck > 0) {
          p.stuck -= dt;
          stuckNow++;
        } else {
          if (inLump >= 0 && inLump !== p.last) {
            p.last = inLump;
            // stuck: most of the time, for a while (the hit flashes the lump)
            if (Math.sin(p.phase * 12.9898 + t * 3.1) > -0.4) {
              p.stuck = 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(p.phase * 7.1 + t));
              blobs[inLump]!.w = 1;
            }
          }
          const v = SPEED * (inLump >= 0 ? SLOW : 1);
          p.x -= v * dt;
          p.y = p.lane + 0.08 * Math.sin(t * 1.3 + p.phase);
        }
        if (p.x < -1.08) {
          p.x = 1.08;
          p.last = -1;
          p.lane = -0.8 + 1.6 * (0.5 + 0.5 * Math.sin(p.phase * 3.3 + t * 0.7));
        }
        // a stuck particle trembles in place
        const shake = p.stuck > 0 ? 0.025 : 0.008;
        p.at.set(p.x + shake * Math.sin(t * 31 + i), p.y + shake * Math.cos(t * 27 + i * 2));
        const edge = Math.max(0, 1 - Math.max(0, Math.hypot(p.at.x, p.at.y) - 0.86) / 0.14);
        dots.set(i, p.at.x * R, p.at.y * R, 0, 0.055, edge * (p.stuck > 0 ? 1.35 : 0.8));
      });
      dots.commit();
    },
  };
  view.shown = 0;
  return view;
}
