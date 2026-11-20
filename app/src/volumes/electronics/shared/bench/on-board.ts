/**
 * The parts on the breadboard in 3D (docs/volumes/electronics/VISUAL.md §4, §6): one model of `shared/parts` per part
 * of the board's state (`sim/board`), standing on its legs — one `Leg` of `shared/hand` per leg, the ends the hand
 * moves. `sync()` follows the state: a part that came gets its model and its legs (`buildPart`), a part that left the
 * board is disposed. While the hand does not drive a part (`driven`), its legs follow the state at once — a leg moved
 * stands in its new socket, a leg taken out of its socket hangs in the air over where it was (the body keeps its turn),
 * a jumper's end the hand laid down lies there; while the hand drives it, the legs are the hand's (they travel, and the
 * board changes when they arrive). `update` moves the legs and stands every model on them; a part the hand carries
 * from the tray is levelled with the table on its way (`level`), and a body glows `cyan` under the pointer (`glow`).
 *
 * `show(id, model, sockets)` stands a model on the board that the state does not hold: a kind whose key the circuit
 * model's catalog does not have yet (capacitors and transistors, until E1-5 and E1-6 are in), shown but never in the
 * circuit.
 *
 * Local frame of `group` = the board's own frame (add it to `BoardView.group`).
 */
import { Group, Quaternion, Vector3 } from 'three';
import type { BoardState, SocketId } from '@electronics/sim/board';
import { Leg, type LegWorld } from '../hand/leg';
import { buildPart, type PartEye, type PartModel } from '../parts';
import type { BoardView } from './board-view';
import { tame } from './materials';

export interface PartsOnBoard {
  /** Every part's model; add it to the board view's group. */
  readonly group: Group;
  /** The models of the parts of the state, by id. */
  readonly models: ReadonlyMap<string, PartModel>;
  /** The legs every part of the state stands on, by id (the hand moves them). */
  readonly legs: ReadonlyMap<string, readonly Leg[]>;
  /** The models shown outside the circuit (`show`), by id. */
  readonly shown: ReadonlyMap<string, PartModel>;
  /** Whether the hand drives the part now: its legs are the hand's (set by the bench). */
  driven: (id: string) => boolean;
  /** Make the models follow the state (cheap when nothing changed: every frame). */
  sync(): void;
  /** Stand a model the state does not hold on these sockets (one per leg); it is the layer's from now on. */
  show(id: string, model: PartModel, sockets: readonly SocketId[]): void;
  /** Take a shown model away and dispose it. */
  hide(id: string): void;
  /** The body's glow 0…1 under the pointer (`cyan`; 0.3 is the hover's). */
  glow(id: string, amount: number): void;
  /** 0 level with the table … 1 in the board's frame: a part on its way from the tray. */
  level(id: string, k: number): void;
  /** Every frame: the legs travel, the models stand on them; a pot's knob follows its setting; the print shows where
   * it can be read. */
  update(dt: number, eye: PartEye): void;
  dispose(): void;
}

/** How high above the board a leg in the air is drawn. */
const AIR = 0.25;

export function createPartsOnBoard(
  board: BoardView,
  state: BoardState,
  ground: LegWorld['ground'],
): PartsOnBoard {
  const group = new Group();
  group.name = 'parts';
  const models = new Map<string, PartModel>();
  const legs = new Map<string, Leg[]>();
  const shown = new Map<string, PartModel>();
  const levels = new Map<string, number>();
  const glows = new Map<string, number>();
  const world: LegWorld = { socket: (id, out) => board.socketLocal(id, out), ground };

  const adopt = (id: string, model: PartModel): void => {
    model.group.name = id;
    for (const m of model.materials) tame(m);
    group.add(model.group);
  };

  /**
   * Where a leg out of its socket hangs while the hand does not hold it: over where it was, as the part's shape stands
   * now (its quarter turn, a re-seated leg's reach), measured from the first leg in a socket; null when no leg is in
   * one.
   */
  const air = (model: PartModel, sockets: readonly (SocketId | null)[], i: number): Vector3 | null => {
    const k = sockets.findIndex((s) => s !== null);
    if (k < 0) return null;
    return board.socketLocal(sockets[k]!).add(model.legTips[i]!).sub(model.legTips[k]!).setY(AIR);
  };

  const remove = (id: string): void => {
    models.get(id)?.dispose();
    models.delete(id);
    legs.delete(id);
    levels.delete(id);
    glows.delete(id);
  };

  const q = new Quaternion();
  const level = new Quaternion();
  const one = new Quaternion();
  const pivot = new Vector3();
  const turned = new Vector3();
  const tips: Vector3[] = [];

  /** Stand the model on its legs; a part on its way from the tray turned about the middle of its tips, level with
   * the table at 0 (the tips stay where the legs are, the body levels). */
  const stand = (id: string, m: PartModel): void => {
    const own = legs.get(id)!;
    const k = levels.get(id) ?? 1;
    tips.length = own.length;
    if (k >= 1) {
      m.group.position.set(0, 0, 0);
      m.group.quaternion.identity();
      own.forEach((leg, i) => (tips[i] = (tips[i] ?? new Vector3()).copy(leg.pos)));
    } else {
      board.group.getWorldQuaternion(level).invert();
      pivot.set(0, 0, 0);
      for (const leg of own) pivot.add(leg.pos);
      pivot.divideScalar(own.length);
      q.copy(level).slerp(one, k);
      m.group.quaternion.copy(q);
      m.group.position.copy(pivot).sub(turned.copy(pivot).applyQuaternion(q));
      q.invert();
      own.forEach(
        (leg, i) => (tips[i] = (tips[i] ?? new Vector3()).copy(leg.pos).sub(pivot).applyQuaternion(q).add(pivot)),
      );
    }
    if (tips.some((t, i) => t.distanceToSquared(m.legTips[i]!) > 1e-12)) m.fit(tips);
  };

  const layer: PartsOnBoard = {
    group,
    models,
    legs,
    shown,
    driven: () => false,
    sync() {
      for (const [id, m] of models) {
        const p = state.parts.get(id);
        if (p === undefined || p.spec !== m.key) remove(id);
      }
      for (const p of state.parts.values()) {
        let model = models.get(p.id);
        if (model === undefined) {
          const built = buildPart(p.spec);
          if (built === null) continue;
          model = built;
          adopt(p.id, model);
          models.set(p.id, model);
          legs.set(
            p.id,
            p.legs.map((s, i) =>
              s !== null
                ? new Leg(world, { kind: 'socket', socket: s })
                : new Leg(world, { kind: 'hand', at: air(built, p.legs, i) ?? built.legTips[i]!.clone() }),
            ),
          );
        }
        const own = legs.get(p.id)!;
        const m = model;
        if (layer.driven(p.id)) {
          m.group.visible = true;
          continue;
        }
        // nothing in a socket, nothing lying where the hand left it: nowhere to stand
        m.group.visible = p.legs.some((s) => s !== null) || own.some((l) => l.place.kind === 'lie');
        // not the hand's: the legs are where the state says, at once
        p.legs.forEach((s, i) => {
          const leg = own[i]!;
          if (s !== null) {
            if (leg.seated !== s || leg.socket !== s) leg.go({ kind: 'socket', socket: s }, 0);
            return;
          }
          if (leg.place.kind === 'lie') return; // a jumper's end the hand laid down
          const at = air(m, p.legs, i);
          if (at === null) return;
          if (leg.place.kind === 'hand') leg.carry(at);
          else leg.go({ kind: 'hand', at }, 0);
        });
        for (const leg of own) leg.update(0);
        stand(p.id, m);
      }
    },
    show(id, model, sockets) {
      layer.hide(id);
      if (sockets.length !== model.legTips.length) {
        model.dispose();
        throw new RangeError(`parts on the board: ${id} needs ${model.legTips.length} sockets`);
      }
      model.fit(sockets.map((s) => board.socketLocal(s)));
      adopt(id, model);
      shown.set(id, model);
    },
    hide(id) {
      shown.get(id)?.dispose();
      shown.delete(id);
    },
    glow(id, amount) {
      const m = models.get(id);
      if (!m || glows.get(id) === amount) return;
      glows.set(id, amount);
      for (const x of m.body) x.setEmissive('cyan', amount);
    },
    level(id, k) {
      if (models.has(id)) levels.set(id, Math.min(Math.max(k, 0), 1));
    },
    update(dt, eye) {
      for (const [id, m] of models) {
        for (const leg of legs.get(id)!) leg.update(dt);
        stand(id, m);
        m.setLook({ setting: state.settings.get(id) ?? 0.5 }, dt);
        m.view(eye);
      }
      for (const m of shown.values()) m.view(eye);
    },
    dispose() {
      for (const id of [...models.keys()]) remove(id);
      for (const id of [...shown.keys()]) layer.hide(id);
    },
  };
  return layer;
}
