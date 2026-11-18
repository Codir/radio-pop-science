/**
 * `balance`: the lens carried round the loop. The track is the loop itself (`loopPath()`, closed, `u` 0…1); the
 * lens sticks to it, and along it to the parts and the terminals: near a stop it slows and settles (a soft detent,
 * continuous both ways). What lies under the lens is read from the board point: the wires from the minus and from
 * the plus, the switch, the battery, the lamp — each with a weight that eases in and out, so the strip, the frosted
 * glass and the lens's height never jump at a border. Board frame; every place from the stand's layout.
 */
import { Vector3 } from 'three';
import { G } from '@/kit';
import { BATTERY, LAMP, LOOP, SWITCH, loopPath } from '@circuit/shared/stage';

export type Place = 'minus' | 'plus' | 'switch' | 'battery' | 'lamp';

/** How much of each place is under the lens (0…1 each; the wires fill the rest). */
export interface Under {
  battery: number;
  switch: number;
  lamp: number;
  /** The place that holds the lens now (the largest weight; a wire when none of the parts). */
  place: Place;
}

export interface LensTrack {
  /** Point on the loop (board frame) at `u`. */
  at(u: number, out: Vector3): Vector3;
  /** The nearest `u` to a board point, searching only within `reach` of `from` (the lens never jumps across). */
  nearest(p: Vector3, from: number, reach: number): number;
  /** `u` as the lens shows it: settling softly on the stops (parts, terminals). */
  sticky(u: number): number;
  under(u: number, out: Under): Under;
  /** `u` of a board point on the loop (exact for points of the loop). */
  uOf(x: number, z: number): number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const wrap = (u: number): number => ((u % 1) + 1) % 1;
/** Signed shortest distance from `a` to `b` round the loop. */
const towards = (a: number, b: number): number => wrap(b - a + 0.5) - 0.5;

export function lensTrack(): LensTrack {
  const path = loopPath();
  const total = G.pathLength(path);
  const tmp = new Vector3();
  const probe = new Vector3();
  const track: LensTrack = {
    at: (u, out) => G.pathAt(path, wrap(u) * total, out),
    nearest(p, from, reach) {
      let best = from;
      let d = Infinity;
      const n = Math.max(12, Math.ceil((2 * reach * total) / 0.015));
      for (let i = 0; i <= n; i++) {
        const u = from - reach + (2 * reach * i) / n;
        const q = track.at(u, tmp).distanceTo(p);
        if (q < d) {
          d = q;
          best = u;
        }
      }
      return wrap(best);
    },
    sticky(u) {
      let out = u;
      for (const s of stops) {
        const d = towards(s.u, u) / s.width;
        if (Math.abs(d) >= 1) continue;
        // a detent: slow over the stop, quicker at its edges, the same place at both edges
        out = s.u + s.width * (d - (s.hold * Math.sin(Math.PI * d)) / Math.PI);
      }
      return wrap(out);
    },
    under(u, out) {
      track.at(u, tmp);
      const near = smooth(LOOP.near - 0.35, LOOP.near - 0.05, tmp.z);
      out.lamp = smooth(0.85, 0.3, Math.hypot(tmp.x - LAMP.x, tmp.z - LAMP.z));
      out.battery =
        near *
        smooth(BATTERY.minusX - 0.1, BATTERY.minusX + 0.25, tmp.x) *
        smooth(BATTERY.plusX + 0.1, BATTERY.plusX - 0.25, tmp.x);
      out.switch =
        near *
        smooth(SWITCH.inX - 0.12, SWITCH.inX + 0.1, tmp.x) *
        smooth(SWITCH.outX + 0.12, SWITCH.outX - 0.1, tmp.x);
      const most = Math.max(out.lamp, out.battery, out.switch);
      if (most > 0.5) out.place = most === out.lamp ? 'lamp' : most === out.battery ? 'battery' : 'switch';
      else out.place = minusSide(tmp) ? 'minus' : 'plus';
      return out;
    },
    uOf(x, z) {
      return track.nearest(probe.set(x, LOOP.y, z), 0.5, 0.5);
    },
  };
  // the wire from the minus: the left side, the far side up to the lamp, and the near side left of the minus clamp
  const minusSide = (p: Vector3): boolean =>
    p.x < LOOP.left + 0.3 || p.z < LOOP.far + 0.3
      ? !(p.x > LAMP.x - 0.2 && p.z > LAMP.z)
      : p.x < BATTERY.minusX;
  const stops = [
    { x: BATTERY.x, z: LOOP.near, width: 0.05, hold: 0.75 },
    { x: SWITCH.x, z: LOOP.near, width: 0.035, hold: 0.75 },
    { x: LOOP.right - 0.12, z: LOOP.far + 0.12, width: 0.05, hold: 0.8 },
    { x: BATTERY.minusX, z: LOOP.near, width: 0.018, hold: 0.5 },
    { x: BATTERY.plusX, z: LOOP.near, width: 0.018, hold: 0.5 },
  ].map((s) => ({ u: track.uOf(s.x, s.z), width: s.width, hold: s.hold }));
  return track;
}
