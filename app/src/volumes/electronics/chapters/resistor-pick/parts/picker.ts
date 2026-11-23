/**
 * A touch on a resistor's body picks one of its bands (`bands`, the script's «Бачимо»): an invisible twin of the
 * part's `hit` box (never drawn, still hit by a ray — the hand's own target is that box, and one object takes one set of
 * handlers), registered while `enabled` holds; a click there gives the band whose middle is nearest along the body
 * (`bandAt` of `shared/parts`, from the hit point in the part's body frame). It follows the part's model: a new model
 * under the id (a step's board put again) gets a new twin. As `shared/steps/names.ts` does for the names.
 */
import { Mesh, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Bench } from '@electronics/shared/bench';
import { bandAt, type PartModel } from '@electronics/shared/parts';

export interface BandPicker {
  /** Every frame after the bench updated: the twin follows the part's model and its pose. */
  update(): void;
}

export function bandPicker(
  ctx: ChapterContext,
  bench: Bench,
  partId: string,
  enabled: () => boolean,
  pick: (band: number) => void,
): BandPicker {
  let twin: { model: PartModel; mesh: Mesh; off: () => void } | null = null;
  const drop = (): void => {
    if (!twin) return;
    twin.off();
    twin.mesh.removeFromParent();
    twin = null;
  };
  const adopt = (model: PartModel): void => {
    const hit = model.hit;
    // the hit's own geometry and its never-drawn material, shared (the part disposes them)
    const mesh = new Mesh(hit.geometry, hit.material);
    mesh.name = `${model.key}:bands`;
    (hit.parent as Object3D).add(mesh);
    const off = ctx.input.register(mesh, {
      cursor: 'pointer',
      enabled,
      click: (e) => {
        if (!e.point) return;
        const x = model.bodyGroup.worldToLocal(e.point.clone()).x;
        const band = bandAt(x, model);
        if (band !== null) pick(band);
      },
    });
    twin = { model, mesh, off };
  };
  ctx.onDispose(drop);
  return {
    update() {
      const model = bench.parts.models.get(partId) ?? null;
      if (twin && twin.model !== model) drop();
      if (!twin && model) adopt(model);
      if (!twin) return;
      const hit = twin.model.hit;
      if (twin.mesh.parent !== hit.parent) (hit.parent as Object3D).add(twin.mesh);
      twin.mesh.position.copy(hit.position);
      twin.mesh.quaternion.copy(hit.quaternion);
      twin.mesh.scale.copy(hit.scale);
    },
  };
}
