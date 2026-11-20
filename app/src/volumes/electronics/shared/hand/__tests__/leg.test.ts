/**
 * One end the hand moves (docs/volumes/electronics/VISUAL.md §6): a leg of a part, a plug, a probe's tip. Every change
 * of place is a travel from where it is shown, eased, rising in a low arc (a short way rises less); its direction
 * turns the shorter way round; it is `seated` in a socket only when it has arrived there — the click is the moment of
 * contact, and the board's netlist reads arrived legs only.
 */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createLayout } from '@electronics/sim/board';
import { Leg, type LegWorld } from '../leg';
import { SEAT_LIFT, SEAT_SECONDS } from '../hands';

const layout = createLayout();
const world: LegWorld = {
  socket: (id, out) => {
    const s = layout.socket(id)!;
    return out.set(s.x, 0, s.z);
  },
  ground: () => -0.25,
};
const mouth = (id: string) => world.socket(id, new Vector3());

/** Frames of `dt` until `seconds` have passed; returns every shown position on the way. */
function run(leg: Leg, seconds: number, dt = 1 / 60, anchor?: Vector3): Vector3[] {
  const out: Vector3[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    leg.update(dt, anchor);
    out.push(leg.pos.clone());
  }
  return out;
}

describe('a leg on its way', () => {
  it('starts where it is shown, ends in the socket on time, eased: slow at both ends, never past the target', () => {
    const leg = new Leg(world, { kind: 'socket', socket: 'a3' });
    expect(leg.pos.distanceTo(mouth('a3'))).toBeLessThan(1e-12);
    leg.go({ kind: 'socket', socket: 'a8' }, 0.3, 0);
    const path = run(leg, 0.3);
    expect(path.at(-1)!.distanceTo(mouth('a8'))).toBeLessThan(1e-9);
    const steps = path.map((p, i) => p.distanceTo(i ? path[i - 1]! : mouth('a3')));
    // eased: the first and the last steps are the smallest, the middle one the largest
    const mid = steps[Math.floor(steps.length / 2)]!;
    expect(steps[0]!).toBeLessThan(mid / 3);
    expect(steps.at(-1)!).toBeLessThan(mid / 3);
    // straight along the line, x only
    for (const p of path) {
      expect(p.x).toBeGreaterThanOrEqual(mouth('a3').x - 1e-12);
      expect(p.x).toBeLessThanOrEqual(mouth('a8').x + 1e-12);
      expect(Math.abs(p.z - mouth('a3').z)).toBeLessThan(1e-12);
    }
  });

  it('rises in a low arc: at most a third of the way (0.32 of it), the full lift on a hop', () => {
    const peak = (from: string, to: string, lift: number, hop = false) => {
      const leg = new Leg(world, { kind: 'socket', socket: from });
      leg.go({ kind: 'socket', socket: to }, 0.18, lift, hop);
      return Math.max(...run(leg, 0.18, 1 / 600).map((p) => p.y));
    };
    const one = layout.spec.pitch; // a3 → a4: one pitch, 0.3
    expect(peak('a3', 'a4', SEAT_LIFT)).toBeCloseTo(Math.min(SEAT_LIFT, 0.32 * one), 4);
    expect(peak('a3', 'a13', SEAT_LIFT)).toBeCloseTo(SEAT_LIFT, 4); // a long way: the whole lift
    expect(peak('a3', 'a4', 0.4)).toBeCloseTo(0.32 * one, 4);
    // a hop rises by the lift whatever the way: a leg lifted out of its socket and put back
    expect(peak('a3', 'a3', 0.2, true)).toBeCloseTo(0.2, 4);
  });

  it('is seated only on arrival: not while it travels, at once when the travel ends', () => {
    const leg = new Leg(world, { kind: 'socket', socket: 'a3' });
    expect(leg.seated).toBe('a3');
    leg.go({ kind: 'socket', socket: 'a8' }, SEAT_SECONDS, SEAT_LIFT);
    expect(leg.seated).toBeNull();
    expect(leg.socket).toBe('a8');
    expect(leg.moving).toBe(true);
    const frames = Math.round(SEAT_SECONDS * 60);
    for (let i = 0; i < frames - 1; i++) {
      leg.update(1 / 60);
      expect(leg.seated, `frame ${i + 1}`).toBeNull();
    }
    leg.update(1 / 60);
    expect(leg.moving).toBe(false);
    expect(leg.seated).toBe('a8');
    // frames of dt = 0 (a held page) move nothing and seat nothing early
    leg.go({ kind: 'socket', socket: 'a9' }, SEAT_SECONDS);
    for (let i = 0; i < 10; i++) leg.update(0);
    expect(leg.seated).toBeNull();
    expect(leg.pos.distanceTo(mouth('a8'))).toBeLessThan(1e-12);
    // a long frame (1/15 s, the engine's cap) is tolerated: it gets there in fewer frames
    for (let i = 0; i < 3; i++) leg.update(1 / 15);
    expect(leg.seated).toBe('a9');
  });

  it('leaves its socket at once when sent elsewhere; going back to the same socket keeps it seated', () => {
    const leg = new Leg(world, { kind: 'socket', socket: 'b5' });
    leg.go({ kind: 'socket', socket: 'b5' }, SEAT_SECONDS);
    expect(leg.seated).toBe('b5');
    leg.go({ kind: 'hand', at: new Vector3(0, 0.2, 0) }, 0);
    expect(leg.seated).toBeNull();
    expect(leg.held).toBe(true);
    expect(leg.pos.toArray()).toEqual([0, 0.2, 0]);
    // in the hand it follows the hand at once
    leg.carry(new Vector3(0.5, 0.2, 0.1));
    leg.update(1 / 60);
    expect(leg.pos.toArray()).toEqual([0.5, 0.2, 0.1]);
    // laid down where it is: on the ground of the bench
    leg.go({ kind: 'lie', at: leg.pos.clone(), out: new Vector3(1, 0, 0) }, 0);
    expect(leg.pos.y).toBe(-0.25);
    leg.snap();
    expect(leg.seated).toBeNull();
  });

  it('turns its direction the shorter way round, never through zero', () => {
    // a carried end trails its anchor: from pointing at 170° to pointing at −170° it turns through 180°, not 0°
    const deg = (v: Vector3) => (Math.atan2(v.z, v.x) * 180) / Math.PI;
    const leg = new Leg(world, { kind: 'lie', at: new Vector3(0, 0, 0), out: new Vector3(-1, 0, 0.17).normalize() });
    expect(deg(leg.out)).toBeCloseTo(170.35, 1);
    leg.go({ kind: 'lie', at: new Vector3(0.4, 0, 0), out: new Vector3(-1, 0, -0.17).normalize() }, 0.2);
    for (let i = 0; i < 12; i++) {
      leg.update(1 / 60);
      expect(Math.abs(leg.out.length() - 1)).toBeLessThan(1e-9);
      // never near 0°: the turn stays on the left side
      expect(Math.abs(deg(leg.out)), `frame ${i}`).toBeGreaterThan(169);
    }
    expect(deg(leg.out)).toBeCloseTo(-170.35, 1);
  });
});
