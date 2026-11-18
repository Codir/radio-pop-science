/**
 * The practicum's three wires as the reader handles them (VISUAL §5.7): A = plus → switch (`p1`), B = switch → lamp
 * (`p2`), C = lamp → minus (`m2` + the second seat's jumper + `m1`; its middle stays on the far side's staples).
 * Six ends (`ends.ts`), each with a big `cyan` grip; any end goes into any clamp, a clamp takes two. The shapes are
 * written into the stand's own four pieces every frame while `active`: loose → curves (`curves.ts`), an end home in
 * its stand clamp → the wire settles onto its stand route (eased), so the assembled stand IS the stand of every
 * other chapter (and the stand's own shapes take over again, unchanged, when `active` is off).
 */
import { Vector3 } from 'three';
import { BARE } from '@circuit/shared/stage/wires';
import { standPath, type WireId } from '@circuit/shared/stage/wires';
import type { CircuitStage } from '@circuit/shared/stage';
import { glide, type Glide } from './glide';
import { CLAMP_CAPACITY, HOME, WIRE_KEYS, type CircuitState, type ClampId, type WireKey } from './circuit';
import { REST, REST_OUT } from './clamps';
import { blend, hermite, lengths, peeled } from './curves';
import { END_KEYS, End, type EndKey, type Place } from './ends';
import { createGrips, type Grips } from './grips';

/** Points of the blended polylines handed to the stand (it resamples them to each piece's rings). */
const N = 160;
/** Seconds a wire takes to settle onto (or lift off) its stand route. */
const SETTLE = 0.55;

export interface Wiring {
  ends: Readonly<Record<EndKey, End>>;
  grips: Grips;
  /** The wiring writes the wires' shapes (off: the stand's own shapes, e.g. while it folds). */
  active: boolean;
  /** The copper core of each wire is whole (C's break is in its far stretch, `m2`). */
  whole: Record<WireKey, boolean>;
  /** Share of the bare copper shown at each end (0 = the sheath reaches the tip). Travels; set its target. */
  bare: Readonly<Record<EndKey, Glide>>;
  /** Topology now (the switch from the caller). */
  state(switchClosed: boolean): CircuitState;
  /** Ends in a clamp. */
  count(clamp: ClampId): number;
  /** Put an end into a clamp (slot chosen; a shared clamp fans its two ends). */
  plug(key: EndKey, clamp: ClampId, seconds?: number): void;
  /** Lay an end on the board at its resting place (or `at`). */
  lay(key: EndKey, seconds?: number, at?: Vector3, out?: Vector3): void;
  /** The hand takes an end (it follows `carry`). */
  take(key: EndKey): void;
  carry(key: EndKey, at: Vector3): void;
  /** Every end to its stand clamp (`hop`: each also lifts out and goes back in — the stand «resets»). */
  home(seconds: number, hop?: boolean): void;
  /** Move one end into a clamp with a hop (the reset's version of `plug`). */
  hop(key: EndKey, clamp: ClampId, seconds: number, shared?: { slot: number }): void;
  /** Lift added to a piece's whole shape (board frame; the new far wire coming down, `find-fault` 3). */
  lift: Record<WireId, Vector3>;
  /** Every end to its resting place in front of the stand. */
  loose(seconds: number): void;
  /** Where a carried end's wire holds it from and how far it reaches (a free wire whose other end is clamped). */
  reach(key: EndKey): { from: Vector3; most: number } | null;
  /** True while anything travels. */
  readonly moving: boolean;
  snap(): void;
  /** After the world's update. */
  update(dt: number, t: number): void;
}

const TUBES: Record<WireKey, readonly WireId[]> = { a: ['p1'], b: ['p2'], c: ['m1', 'm2'] };
/**
 * The free wires' own lengths (board units): the plus→switch jumper a little longer than its place on the stand
 * (it lies beside its clamps with some slack), the lamp wire its route's. A taut wire drags a loose other end along
 * (`TAUT`); with the other end clamped the hand may pull it longer only up to `REACH` (`Wiring.reach`).
 */
export const LENGTH = { p1: 1.15, p2: 3.6 } as const;
const TAUT = 1.1;
const REACH = 2.9;

export function createWiring(stage: CircuitStage): Wiring {
  const wires = stage.stand.wires;
  const routes = Object.fromEntries(
    (['p1', 'p2', 'm1', 'm2'] as const).map((id) => {
      const r = standPath(id);
      return [id, { pts: r, rev: [...r].reverse(), acc: lengths(r), revAcc: lengths([...r].reverse()) }];
    }),
  ) as Record<WireId, { pts: Vector3[]; rev: Vector3[]; acc: number[]; revAcc: number[] }>;
  const homeOf = (key: EndKey): ClampId => HOME[key[0] as WireKey][key[1] === '0' ? 0 : 1];
  const ends = Object.fromEntries(
    END_KEYS.map((k) => [k, new End(k, { kind: 'clamp', clamp: homeOf(k), slot: 0, shared: false })]),
  ) as Record<EndKey, End>;
  const bare = Object.fromEntries(END_KEYS.map((k) => [k, glide(1)])) as Record<EndKey, Glide>;
  const settle = { p1: glide(1), p2: glide(1), m1: glide(1), m2: glide(1) } as Record<WireId, Glide>;
  const grips = createGrips(stage, ends);
  const whole: Record<WireKey, boolean> = { a: true, b: true, c: true };
  const free: Vector3[] = [];
  const sides = { p1: 1, p2: 1 };
  const shaped: Vector3[] = [];
  const anchor = new Vector3();

  const count = (clamp: ClampId, but?: EndKey): number =>
    END_KEYS.filter((k) => k !== but && ends[k].clamp === clamp).length;
  /** Re-seat the ends of a clamp: one alone sits in the middle, two side by side. */
  const reseat = (clamp: ClampId, seconds: number): void => {
    const here = END_KEYS.filter((k) => ends[k].clamp === clamp);
    here.forEach((k, slot) => {
      const p = ends[k].place;
      const shared = here.length > 1;
      if (p.kind === 'clamp' && (p.slot !== slot || p.shared !== shared))
        ends[k].go({ kind: 'clamp', clamp, slot, shared }, seconds, 0.05);
    });
  };
  const wiring: Wiring = {
    ends,
    grips,
    active: false,
    whole,
    bare,
    state(switchClosed) {
      const end = (k: EndKey) => ({ clamp: ends[k].seated, contact: ends[k].contact });
      const w = (key: WireKey) => ({
        ends: [end(`${key}0` as EndKey), end(`${key}1` as EndKey)] as const,
        whole: whole[key],
      });
      return { switchClosed, wires: { a: w('a'), b: w('b'), c: w('c') } };
    },
    count: (clamp) => count(clamp),
    plug(key, clamp, seconds = 0.22) {
      const was = ends[key].clamp;
      const slot = count(clamp, key) >= CLAMP_CAPACITY - 1 ? 1 : 0;
      ends[key].go({ kind: 'clamp', clamp, slot, shared: slot > 0 }, seconds, 0.12);
      reseat(clamp, seconds);
      if (was && was !== clamp) reseat(was, 0.25);
    },
    lay(key, seconds = 0.9, at, out) {
      const was = ends[key].clamp;
      const place: Place = {
        kind: 'lie',
        at: (at ?? REST[key]).clone(),
        out: (out ?? REST_OUT[key]).clone(),
      };
      ends[key].go(place, seconds, 0.35);
      if (was) reseat(was, 0.25);
    },
    take(key) {
      const was = ends[key].clamp;
      ends[key].go({ kind: 'hand', at: ends[key].pos.clone() }, 0.12, 0);
      if (was) reseat(was, 0.25);
    },
    carry(key, at) {
      ends[key].carry(at);
    },
    home(seconds, hop = false) {
      for (const k of END_KEYS) {
        const e = ends[k];
        const h = homeOf(k);
        const p = e.place;
        if (hop || p.kind !== 'clamp' || p.clamp !== h || p.shared)
          e.go({ kind: 'clamp', clamp: h, slot: 0, shared: false }, seconds, hop ? 0.22 : 0.4, hop);
      }
    },
    hop(key, clamp, seconds, shared) {
      ends[key].go({ kind: 'clamp', clamp, slot: shared?.slot ?? 0, shared: !!shared }, seconds, 0.22, true);
    },
    lift: { p1: new Vector3(), p2: new Vector3(), m1: new Vector3(), m2: new Vector3() },
    loose(seconds) {
      for (const k of END_KEYS) wiring.lay(k, seconds);
    },
    reach(key) {
      if (key[0] === 'c') return null;
      const other = ends[`${key[0]}${key[1] === '0' ? 1 : 0}` as EndKey];
      if (other.place.kind !== 'clamp') return null;
      return { from: other.pos, most: LENGTH[key[0] === 'a' ? 'p1' : 'p2'] * REACH };
    },
    get moving() {
      return END_KEYS.some((k) => ends[k].moving) || Object.values(settle).some((g) => g.moving);
    },
    snap() {
      for (const k of END_KEYS) {
        ends[k].snap();
        bare[k].set(bare[k].target);
      }
      for (const id of Object.keys(settle) as WireId[]) settle[id].set(isHome(id) ? 1 : 0);
      grips.snap();
    },
    update(dt, t) {
      follow();
      for (const k of END_KEYS) {
        bodyPoint(k, anchor);
        ends[k].update(dt, anchor);
        bare[k].update(dt);
      }
      for (const id of Object.keys(settle) as WireId[]) {
        const want = isHome(id) ? 1 : 0;
        if (settle[id].target !== want) settle[id].go(want, SETTLE);
        settle[id].update(dt);
      }
      grips.update(dt, t);
      // while the stand is (un)folding its own unfolding lays the wires
      if (!wiring.active || stage.unfold < 1) return;
      for (const key of WIRE_KEYS) for (const id of TUBES[key]) shape(id);
    },
  };

  /**
   * Which side of its chord a free wire's slack lies: away from the middle of the board (toward the reader on the
   * near side, outward elsewhere); kept until the other side is clearly the better one, so the bow never flips.
   */
  function sideOf(id: 'p1' | 'p2', a: Vector3, b: Vector3): number {
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2 - 0.2;
    const px = -(b.z - a.z);
    const pz = b.x - a.x;
    const n = Math.hypot(px, pz) * Math.hypot(mx, mz) + 1e-6;
    const lean = (px * mx + pz * mz) / n;
    if (Math.abs(lean) > 0.25) sides[id] = lean > 0 ? 1 : -1;
    return sides[id];
  }
  /** A carried end pulls a loose other end of its wire along once the wire is taut (no rubber). */
  function follow(): void {
    for (const [k, o, id] of [
      ['a0', 'a1', 'p1'],
      ['a1', 'a0', 'p1'],
      ['b0', 'b1', 'p2'],
      ['b1', 'b0', 'p2'],
    ] as const) {
      const e = ends[k];
      const other = ends[o];
      const p = other.place;
      if (!e.held || p.kind !== 'lie' || other.moving) continue;
      const most = LENGTH[id] * TAUT;
      const d = Math.hypot(p.at.x - e.pos.x, p.at.z - e.pos.z);
      if (d <= most) continue;
      const dx = (p.at.x - e.pos.x) / d;
      const dz = (p.at.z - e.pos.z) / d;
      p.at.set(e.pos.x + dx * most, p.at.y, e.pos.z + dz * most);
      p.out.set(-dx, 0, -dz);
    }
  }
  /** An end is home: in its stand clamp, alone, not moving. */
  function endHome(k: EndKey): boolean {
    const p = ends[k].place;
    return p.kind === 'clamp' && p.clamp === homeOf(k) && !p.shared && !ends[k].moving;
  }
  function isHome(id: WireId): boolean {
    if (id === 'p1') return endHome('a0') && endHome('a1');
    if (id === 'p2') return endHome('b0') && endHome('b1');
    return endHome(id === 'm1' ? 'c0' : 'c1');
  }
  /** A point of the body an end's wire comes from (a carried end leaves toward it). */
  function bodyPoint(k: EndKey, out: Vector3): Vector3 {
    if (k === 'a0') return out.copy(ends.a1.pos);
    if (k === 'a1') return out.copy(ends.a0.pos);
    if (k === 'b0') return out.copy(ends.b1.pos);
    if (k === 'b1') return out.copy(ends.b0.pos);
    // C's ends: the route's middle on the far side
    return out.copy(k === 'c0' ? routes.m1.pts[Math.floor(routes.m1.pts.length * 0.45)]! : routes.m2.pts[0]!);
  }
  /** Write one piece's shape. */
  function shape(id: WireId): void {
    const r = routes[id];
    const k = settle[id].value;
    if (id === 'p1' || id === 'p2') {
      const [e0, e1] = id === 'p1' ? [ends.a0, ends.a1] : [ends.b0, ends.b1];
      hermite(e0, e1, free, undefined, { length: LENGTH[id], side: sideOf(id, e0.pos, e1.pos) });
    } else if (id === 'm1') {
      const e = ends.c0;
      const d = Math.hypot(e.pos.x - r.pts[0]!.x, e.pos.z - r.pts[0]!.z);
      peeled(r.pts, r.acc, e, 0.5 + 0.95 * d, free);
    } else {
      const e = ends.c1;
      const d = Math.hypot(e.pos.x - r.rev[0]!.x, e.pos.z - r.rev[0]!.z);
      peeled(r.rev, r.revAcc, e, 0.5 + 0.95 * d, free).reverse();
    }
    blend(free, r.pts, k, N, shaped);
    const off = wiring.lift[id];
    if (off.lengthSq() > 0) for (const p of shaped) p.add(off);
    const [b0, b1] =
      id === 'p1' ? ['a0', 'a1'] : id === 'p2' ? ['b0', 'b1'] : id === 'm1' ? ['c0', null] : [null, 'c1'];
    const gap = id === 'm2' && !whole.c ? { at: M2_GAP, width: 0.09 } : undefined;
    // C's two pieces meet end to end on the far side: there no copper, no caps — one wire to the eye (while
    // neither is lifted off the board)
    const join = wiring.lift.m1.lengthSq() === 0 && wiring.lift.m2.lengthSq() === 0;
    wires.setShape(id, {
      path: shaped,
      round: 1,
      cover: 1,
      copper: 1,
      bare: [
        b0 ? BARE * bare[b0 as EndKey].value : join ? 0 : BARE,
        b1 ? BARE * bare[b1 as EndKey].value : join ? 0 : BARE,
      ],
      open: [!b0 && join, !b1 && join],
      gap,
    });
    if (b0) grips.place(b0 as EndKey, shaped, false);
    if (b1) grips.place(b1 as EndKey, shaped, true);
  }
  return wiring;
}

/**
 * Where C's copper is broken (`find-fault` 3): about a third of the way from the lamp along the far wire, between
 * two of `m2`'s 40 rings (so two rings collapse: a short clean gap, `wires.ts` `gap`).
 */
export const M2_GAP = 26.5 / 39;
