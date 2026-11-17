/**
 * The reaction inside the section (VISUAL.md §5.2 «Рух»): events at the zinc front — a flash, two `cyan`
 * electrons that run across the gel to the pin and along it to the minus cap, the zinc atom drifting off into
 * the paste, a `coral` spark where the oxide takes an electron from the can — and `sky` ions creeping through
 * the separator. `activity` is the rate (0 = still); `life` moves the front toward the axis and ends the events.
 * Everything lives in the section's frame and shows only with the cut.
 */
import { Euler, type Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { SEC } from './battery-section';
import { seeded } from './battery-grains';

const EVENTS = 7;
const IONS = 16;
/** Events per second at activity 1. */
const RATE = 2.2;

export const smooth = (a: number, b: number, v: number): number => {
  const k = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return k * k * (3 - 2 * k);
};

/** 1 while the battery can still react, → 0 at the very end of its life. */
export const aliveOf = (life: number): number => 1 - smooth(0.82, 0.98, life);

export interface Reaction {
  /** Events per second relative to the full rate, 0 … 1. */
  activity: number;
  life: number;
  update(dt: number, t: number, cut: number): void;
}

interface Event {
  t0: number;
  x: number;
  y: number;
  side: number;
}

export function createReaction(section: Group): Reaction {
  const rnd = seeded(23);
  const dot = new IcosahedronGeometry(1, 2);
  const electrons = new InstancedMesh(dot, K.glow({ color: 'cyan', intensity: 2 }), 2 * EVENTS);
  const sparks = new InstancedMesh(
    G.ring(1, 0.32, 20, 6),
    K.glow({ color: 'coral', intensity: 1.4, whiten: 0.2 }),
    EVENTS,
  );
  const flashes = new InstancedMesh(
    dot,
    K.glow({ color: 'cyan', intensity: 1.1, additive: true, opacity: 0.55 }),
    EVENTS,
  );
  const ions = new InstancedMesh(dot, K.glow({ color: 'sky', intensity: 1.15, whiten: 0.3 }), IONS);
  const atoms = new InstancedMesh(dot, K.toon({ color: 'mist' }), EVENTS);
  const meshes = [electrons, sparks, flashes, ions, atoms];
  for (const mesh of meshes) {
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    section.add(mesh);
  }
  const ionSlots = Array.from({ length: IONS }, (_, i) => ({
    x: SEC.coreFrom + 0.06 + (SEC.coreTo - SEC.coreFrom - 0.12) * ((i + rnd()) / IONS),
    side: i % 2 ? 1 : -1,
    phase: rnd(),
  }));
  const events: Event[] = Array.from({ length: EVENTS }, () => ({ t0: -99, x: 0, y: 0, side: 1 }));

  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const facing = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0)); // ring axis → +z of the section
  const hide = (mesh: InstancedMesh, i: number): void => {
    mesh.setMatrixAt(i, m.makeScale(0, 0, 0));
  };
  const put = (mesh: InstancedMesh, i: number, at: Vector3, r: number, rot = q.identity()): void => {
    mesh.setMatrixAt(i, m.compose(at, rot, s.setScalar(r)));
  };

  const stepEvent = (ev: Event, i: number, tau: number): void => {
    // flash at the zinc grain
    if (tau < 0.6) put(flashes, i, p.set(ev.x, ev.y, 0), 0.055 * Math.sin((Math.PI * tau) / 0.6));
    else hide(flashes, i);
    // the zinc atom drifts off toward the separator and dissolves
    if (tau > 0.05 && tau < 1.6) {
      put(atoms, i, p.set(ev.x + 0.01, ev.y + ev.side * 0.03 * (tau / 1.6), 0.004), 0.016 * (1 - tau / 1.6));
    } else hide(atoms, i);
    // two electrons: across the gel to the pin, along the pin to the minus cap
    const total = 0.5 + (ev.x + 0.93) / 1.1;
    for (let k = 0; k < 2; k++) {
      const u = tau - 0.1 - k * 0.12;
      if (u < 0 || u > total) {
        hide(electrons, 2 * i + k);
        continue;
      }
      const lane = ev.side * (SEC.pin + 0.012);
      if (u < 0.5) p.set(ev.x + (k ? 0.012 : -0.012), ev.y + (lane - ev.y) * smooth(0, 0.5, u), 0.016);
      else p.set(ev.x - (u - 0.5) * 1.1, lane, 0.016);
      put(electrons, 2 * i + k, p, 0.023 * Math.min(1, (total - u) / 0.15));
    }
    // the oxide takes an electron from the can: a coral spark on the steel
    const c = tau - 0.35;
    if (c > 0 && c < 0.9) {
      put(
        sparks,
        i,
        p.set(ev.x + 0.08, ev.side * (SEC.canIn + 0.009), 0.016),
        0.024 * Math.sin((Math.PI * c) / 0.9),
        facing,
      );
    } else hide(sparks, i);
  };

  let spawn = 0;
  const state: Reaction = {
    activity: 0,
    life: 0,
    update(dt, t, cut) {
      const alive = aliveOf(state.life);
      // events only where they are seen: the section open; none once the battery is dead
      spawn = Math.min(spawn + (cut > 0.3 ? RATE * state.activity * alive : 0) * dt, 1);
      const front = Math.max(1 - 0.94 * state.life ** 1.5, 0.3);
      for (const ev of events) {
        if (spawn < 1) break;
        if (t - ev.t0 < 3) continue;
        spawn -= 1;
        ev.t0 = t;
        ev.side = rnd() < 0.5 ? 1 : -1;
        ev.x = -0.65 + 1.45 * rnd();
        ev.y = ev.side * (front * SEC.sepIn - 0.018);
      }
      events.forEach((ev, i) => stepEvent(ev, i, t - ev.t0));
      // ions creep across the separator; still when the reaction is still
      const drift = 0.25 * state.activity * alive;
      ionSlots.forEach((io, i) => {
        io.phase = (io.phase + drift * dt) % 1;
        const y = io.side * (SEC.cathodeIn + 0.016 - io.phase * 0.045);
        put(
          ions,
          i,
          p.set(io.x + 0.01 * Math.sin(io.phase * 9), y, 0.012),
          0.0085 * Math.sin(Math.PI * io.phase) + 0.003,
        );
      });
      for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
    },
  };
  state.update(0, 0, 0);
  return state;
}
