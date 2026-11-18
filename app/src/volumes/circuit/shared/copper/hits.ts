/**
 * The hit counter of the copper world (`resistance/*`, later `drain/inner`): every time a free electron of the focal
 * slab runs into an atom (`sim.onHit`), it is counted, and the hits the reader should see make the atom flash
 * `orange` and tremble harder, the trembling running on to two neighbours a moment later (VISUAL §6 «Удар»).
 *
 * - `marked`: hits of the marked electron (`copper.marked`) since `reset()` — every one of them flashes.
 * - `total`, `rate`: hits of all focus electrons since `reset()`, and a smoothed rate (hits per second).
 * - `flashRate`: how many hits of the other electrons may flash per second (default 0: only the marked one's) —
 *   enough to see that every electron hits, never a flicker.
 * - `last`: the latest hit of the marked electron (site, its position in local units, the counter's clock).
 *
 * Mount it once after the copper (`createHits(copper)`), call `update(dt)` after `copper.update`. It owns
 * `sim.onHit`.
 */
import { Vector3 } from 'three';
import type { Copper } from './copper';
import { PITCH } from './layout';

/** A contact reported again by the same electron on the same atom within this time is the same hit. */
const SAME_HIT = 0.2;
/** The trembling reaches the neighbours this long after the hit. */
const WAVE_DELAY = 0.11;
/** What a hit does to its atom and to the two neighbours: flash 0…1, extra trembling (units; the atom is 2 across). */
const HIT = { flash: 1, shake: 0.13 } as const;
const OTHER = { flash: 0.7, shake: 0.09 } as const;
const NEIGHBOUR = { flash: 0.22, shake: 0.07 } as const;

export interface HitEvent {
  site: number;
  /** Where the atom was hit (local units of the copper world). */
  at: Vector3;
  /** The counter's clock (seconds since it was made). */
  time: number;
}

export interface Hits {
  /** Hits of the marked electron since `reset()`. */
  readonly marked: number;
  /** Hits of every focus electron since `reset()`. */
  readonly total: number;
  /** Smoothed hits per second of every focus electron. */
  readonly rate: number;
  /** The latest hit of the marked electron, or null. */
  readonly last: HitEvent | null;
  /** The counter's clock (seconds). */
  readonly time: number;
  /** Hits of the other electrons that may flash per second (0 = only the marked electron's). */
  flashRate: number;
  /** Strength of the flashes and the trembling 0…1 (0 = counted, not shown). Default 1. */
  show: number;
  reset(): void;
  update(dt: number): void;
}

export function createHits(copper: Copper): Hits {
  const { lattice, sim } = copper;
  const sites = lattice.sites;
  // the four neighbours of each atom in its own plane (the grid is square in every plane)
  const around = sites.map((s) =>
    sites
      .map((q, i) => ({ i, q }))
      .filter(({ q }) => q.plane === s.plane && Math.abs(q.p.distanceTo(s.p) - PITCH) < 0.1)
      .map(({ i }) => i),
  );
  const lastBy = new Map<number, { site: number; time: number }>();
  const wave: { site: number; at: number }[] = [];
  const normal = new Vector3();
  const to = new Vector3();
  let clock = 0;
  let budget = 0;
  let recent = 0;
  const state = {
    marked: 0,
    total: 0,
    rate: 0,
    last: null as HitEvent | null,
  };
  const flashAt = (site: number, e: number, kind: { flash: number; shake: number }): void => {
    const k = hits.show;
    if (k <= 0) return;
    lattice.kick(site, kind.flash * k, kind.shake * k);
    // the trembling runs on to the two neighbours the electron pushed toward
    const c = sites[site]!.p;
    normal.set(c.x - sim.pos[3 * e]!, c.y - sim.pos[3 * e + 1]!, 0).normalize();
    const next = [...around[site]!]
      .sort((a, b) => to.subVectors(sites[b]!.p, c).dot(normal) - to.subVectors(sites[a]!.p, c).dot(normal))
      .slice(0, 2);
    for (const n of next) wave.push({ site: n, at: clock + WAVE_DELAY });
  };
  sim.onHit = (e, site) => {
    const seen = lastBy.get(e);
    if (seen && seen.site === site && clock - seen.time < SAME_HIT) return;
    lastBy.set(e, { site, time: clock });
    state.total++;
    recent++;
    if (e === copper.marked) {
      state.marked++;
      state.last = { site, at: sites[site]!.p.clone(), time: clock };
      flashAt(site, e, HIT);
    } else if (budget >= 1) {
      budget -= 1;
      flashAt(site, e, OTHER);
    }
  };
  const hits: Hits = {
    get marked() {
      return state.marked;
    },
    get total() {
      return state.total;
    },
    get rate() {
      return state.rate;
    },
    get last() {
      return state.last;
    },
    get time() {
      return clock;
    },
    flashRate: 0,
    show: 1,
    reset() {
      state.marked = state.total = 0;
      state.last = null;
      lastBy.clear();
    },
    update(dt) {
      clock += dt;
      // a token bucket: at most `flashRate` flashes a second, never two at once after a pause
      budget = Math.min(budget + hits.flashRate * dt, 1);
      if (dt > 0) state.rate += (recent / dt - state.rate) * Math.min(dt, 1);
      recent = 0;
      for (let i = wave.length - 1; i >= 0; i--) {
        const w = wave[i]!;
        if (clock < w.at) continue;
        lattice.kick(w.site, NEIGHBOUR.flash * hits.show, NEIGHBOUR.shake * hits.show);
        wave.splice(i, 1);
      }
    },
  };
  return hits;
}
