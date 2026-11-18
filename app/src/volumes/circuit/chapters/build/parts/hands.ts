/**
 * The reader's hand on the wires' ends: press a grip and the end leaves its clamp (or the board) with the hand;
 * carried near a clamp's mouth it clicks in by itself (`SNAP`) — the clamp it was just pulled from only after the
 * hand has gone away from it once; let go anywhere else and it lies there. A step says which ends may be taken
 * and which clamps take them (`policy`); everything is inert while the world flies or the step forbids it.
 */
import { Quaternion, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boardToWorld, worldToBoard, type CircuitStage } from '@circuit/shared/stage';
import type { CircuitWorld } from '@circuit/shared/world';
import { CLAMP_CAPACITY, CLAMP_IDS, type ClampId } from './circuit';
import { AREA, CLAMPS, LYING } from './clamps';
import { END_KEYS, type EndKey } from './ends';
import type { Wiring } from './wiring';

/** Board distance from a clamp's mouth at which a carried end clicks in. */
export const SNAP = 0.34;
/** How far the hand must go from the clamp an end left before that clamp takes it again. */
const AWAY = 0.5;

export interface HandPolicy {
  take(key: EndKey): boolean;
  plug(key: EndKey, clamp: ClampId): boolean;
  /** After an end clicked into a clamp / was laid down by the hand. */
  plugged?(key: EndKey, clamp: ClampId): void;
  dropped?(key: EndKey): void;
  tooltip?(key: EndKey): string;
}

export interface Hands {
  policy: HandPolicy | null;
  /** The end in the hand now. */
  readonly held: EndKey | null;
  /** The clamp a carried end would click into right now (for a cue), or null. */
  readonly near: ClampId | null;
}

export function createHands(
  ctx: ChapterContext,
  world: CircuitWorld,
  stage: CircuitStage,
  wiring: Wiring,
): Hands {
  let held: EndKey | null = null;
  let left: ClampId | null = null;
  let near: ClampId | null = null;
  const up = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  const p = new Vector3();
  const q = new Quaternion();
  const live = (k: EndKey): boolean => !!hands.policy && !world.flying && hands.policy.take(k);
  const nearest = (key: EndKey, x: number, z: number): ClampId | null => {
    let best: ClampId | null = null;
    let bestD = SNAP;
    for (const c of CLAMP_IDS) {
      const m = CLAMPS[c].mouth;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d >= bestD) continue;
      if (c === left) continue;
      const others = END_KEYS.filter((k) => k !== key && wiring.ends[k].clamp === c).length;
      if (others >= CLAMP_CAPACITY || !hands.policy?.plug(key, c)) continue;
      best = c;
      bestD = d;
    }
    return best;
  };
  const hands: Hands = {
    policy: null,
    get held() {
      return held;
    },
    get near() {
      return near;
    },
  };
  for (const key of END_KEYS) {
    const g = wiring.grips.of[key];
    ctx.input.register(g.hit, {
      cursor: 'grab',
      tooltip: () => hands.policy?.tooltip?.(key) ?? '',
      enabled: () => live(key) && wiring.grips.of[key].shown.value > 0.9 && (held === null || held === key),
      hover: (on: boolean) => void (g.hover = on),
      dragStart: () => {
        if (!live(key)) return;
        held = key;
        left = wiring.ends[key].clamp;
        wiring.take(key);
      },
      drag: (e) => {
        if (held !== key) return;
        up.set(0, 1, 0).applyQuaternion(stage.base.frame.getWorldQuaternion(q));
        boardToWorld(0, LYING + 0.2, 0, through);
        if (!e.planePoint(up, through, hit)) return;
        worldToBoard(hit, p);
        p.x = Math.min(Math.max(p.x, AREA.x0), AREA.x1);
        p.z = Math.min(Math.max(p.z, AREA.z0), AREA.z1);
        // a wire held at its other end reaches only so far
        const r = wiring.reach(key);
        if (r) {
          const d = Math.hypot(p.x - r.from.x, p.z - r.from.z);
          if (d > r.most) {
            p.x = r.from.x + ((p.x - r.from.x) * r.most) / d;
            p.z = r.from.z + ((p.z - r.from.z) * r.most) / d;
          }
        }
        wiring.carry(key, p);
        if (left && Math.hypot(CLAMPS[left].mouth.x - p.x, CLAMPS[left].mouth.z - p.z) > AWAY) left = null;
        const c = nearest(key, p.x, p.z);
        if (!c) return;
        held = null;
        left = null;
        near = null;
        wiring.plug(key, c);
        hands.policy?.plugged?.(key, c);
      },
      dragEnd: () => {
        if (held !== key) return;
        held = null;
        left = null;
        const e = wiring.ends[key];
        wiring.lay(key, 0.3, e.pos, e.out);
        hands.policy?.dropped?.(key);
      },
    });
    ctx.qa.probe(`end-${key}`, g.grip);
  }
  for (const c of CLAMP_IDS)
    ctx.qa.probe(`clamp-${c}`, () => {
      const m = CLAMPS[c].mouth;
      return boardToWorld(m.x, m.y, m.z);
    });
  return hands;
}
