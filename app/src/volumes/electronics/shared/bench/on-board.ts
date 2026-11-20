/**
 * The parts on the breadboard in 3D (docs/volumes/electronics/VISUAL.md §4): one model of `shared/parts` per part of
 * the board's state (`sim/board`), standing on the mouths of the sockets its legs are in. `sync()` follows the state —
 * a part that came gets its model (`buildPart`), a part whose legs moved stands on its new sockets (the legs bend to
 * them), a part that left the board is disposed. A leg in the air (`null`, the part is out of the circuit) is drawn
 * above the board where the part's own shape puts it; the hand (E2-5) carries it for real.
 *
 * `show(id, model, sockets)` stands a model on the board that the state does not hold: a kind whose key the circuit
 * model's catalog does not have yet (capacitors and transistors, until E1-5 and E1-6 are in), shown but never in the
 * circuit.
 *
 * Local frame of `group` = the board's own frame (add it to `BoardView.group`).
 */
import { Group, type Vector3 } from 'three';
import type { BoardState, SocketId } from '@electronics/sim/board';
import { buildPart, type PartEye, type PartModel } from '../parts';
import type { BoardView } from './board-view';
import { tame } from './materials';

export interface PartsOnBoard {
  /** Every part's model; add it to the board view's group. */
  readonly group: Group;
  /** The models of the parts of the state, by id. */
  readonly models: ReadonlyMap<string, PartModel>;
  /** The models shown outside the circuit (`show`), by id. */
  readonly shown: ReadonlyMap<string, PartModel>;
  /** Make the models follow the state (cheap when nothing changed: every frame). */
  sync(): void;
  /** Stand a model the state does not hold on these sockets (one per leg); it is the layer's from now on. */
  show(id: string, model: PartModel, sockets: readonly SocketId[]): void;
  /** Take a shown model away and dispose it. */
  hide(id: string): void;
  /** Every frame: a pot's knob follows its setting; the print shows where it can be read. */
  update(dt: number, eye: PartEye): void;
  dispose(): void;
}

/** How high above the board a leg in the air is drawn. */
const AIR = 0.25;

export function createPartsOnBoard(board: BoardView, state: BoardState): PartsOnBoard {
  const group = new Group();
  group.name = 'parts';
  const models = new Map<string, PartModel>();
  const shown = new Map<string, PartModel>();

  const adopt = (id: string, model: PartModel): void => {
    model.group.name = id;
    for (const m of model.materials) tame(m);
    group.add(model.group);
  };

  /** The tips of the legs (board frame) for sockets, a missing one where the part's shape puts it, in the air. */
  const tipsOf = (model: PartModel, legs: readonly (SocketId | null)[]): Vector3[] | null => {
    const tips = legs.map((s) => (s === null ? null : board.socketLocal(s)));
    const k = tips.findIndex((t) => t !== null);
    if (k < 0) return null;
    const from = tips[k]!;
    return tips.map((t, i) => t ?? from.clone().add(model.nominal[i]!).sub(model.nominal[k]!).setY(AIR));
  };

  const remove = (map: Map<string, PartModel>, id: string): void => {
    map.get(id)?.dispose();
    map.delete(id);
  };

  const layer: PartsOnBoard = {
    group,
    models,
    shown,
    sync() {
      for (const [id, m] of models) {
        const p = state.parts.get(id);
        if (p === undefined || p.spec !== m.key) remove(models, id);
      }
      for (const p of state.parts.values()) {
        let model = models.get(p.id);
        if (model === undefined) {
          const built = buildPart(p.spec);
          if (built === null) continue;
          model = built;
          adopt(p.id, model);
          models.set(p.id, model);
        }
        const tips = tipsOf(model, p.legs);
        if (tips === null) {
          model.group.visible = false;
          continue;
        }
        model.group.visible = true;
        if (tips.some((t, i) => t.distanceToSquared(model.legTips[i]!) > 1e-12)) model.fit(tips);
      }
    },
    show(id, model, sockets) {
      remove(shown, id);
      const tips = tipsOf(model, sockets);
      if (tips === null || tips.length !== model.legTips.length) {
        model.dispose();
        throw new RangeError(`parts on the board: ${id} needs ${model.legTips.length} sockets`);
      }
      model.fit(tips);
      adopt(id, model);
      shown.set(id, model);
    },
    hide(id) {
      remove(shown, id);
    },
    update(dt, eye) {
      for (const [id, m] of models) {
        m.setLook({ setting: state.settings.get(id) ?? 0.5 }, dt);
        m.view(eye);
      }
      for (const m of shown.values()) m.view(eye);
    },
    dispose() {
      for (const id of [...models.keys()]) remove(models, id);
      for (const id of [...shown.keys()]) remove(shown, id);
    },
  };
  return layer;
}
