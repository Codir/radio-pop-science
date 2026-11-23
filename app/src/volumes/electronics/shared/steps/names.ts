/**
 * Names under the pointer (a long press on a touch screen) for the things a step does not let the hand take: the bench's
 * hand names only what it may take (`HandPolicy.tooltip`), so a jumper or an LED the step keeps in place gets its name
 * here — an invisible twin of the part's `hit` box beside it (never drawn, still hit by a ray; not a child of the
 * hit, so the hand's own target never meets it), enabled only while the hand may not take that part. The multimeter's
 * case gets one too. The words are the step's captions: `name(id)` gives them ('' — no name). Only where a pointer
 * hovers (`device.hover`): on a touch screen a twin would take the taps meant for a grip beside it (the engine's
 * rings of slop), and the names there are the dock's and the panel's.
 */
import { Mesh, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Bench } from '../bench';
import type { PartModel } from '../parts';

export interface Names {
  /** Every frame after the bench updated: twins for the parts that came, gone with the parts that left. */
  update(): void;
}

export function partNames(
  ctx: ChapterContext,
  bench: Bench,
  name: (id: string) => string,
  meterName: () => string,
): Names {
  const hover = (): boolean => ctx.device.hover !== false;
  const twins = new Map<string, { model: PartModel; twin: Mesh; off: () => void }>();
  const drop = (id: string): void => {
    const t = twins.get(id);
    if (!t) return;
    t.off();
    t.twin.removeFromParent();
    twins.delete(id);
  };
  const adopt = (id: string, model: PartModel): void => {
    const hit = model.hit;
    // the hit's own geometry and its never-drawn material, shared (the part disposes them)
    const twin = new Mesh(hit.geometry, hit.material);
    twin.name = `${model.key}:name`;
    (hit.parent as Object3D).add(twin);
    const off = ctx.input.register(twin, {
      cursor: 'default',
      tooltip: () => name(id),
      enabled: () =>
        hover() && !bench.flying && name(id) !== '' && !(bench.hands.policy?.take(`part:${id}`) ?? true),
    });
    twins.set(id, { model, twin, off });
  };
  ctx.input.register(bench.multimeter.body, {
    cursor: 'default',
    tooltip: meterName,
    enabled: () => hover() && !bench.flying && bench.meter > 0.99 && meterName() !== '',
  });
  ctx.onDispose(() => {
    for (const id of [...twins.keys()]) drop(id);
  });
  return {
    update() {
      for (const [id, t] of [...twins]) if (bench.parts.models.get(id) !== t.model) drop(id);
      for (const [id, m] of bench.parts.models) if (!twins.has(id)) adopt(id, m);
      for (const t of twins.values()) {
        const hit = t.model.hit;
        if (t.twin.parent !== hit.parent) (hit.parent as Object3D).add(t.twin);
        t.twin.position.copy(hit.position);
        t.twin.quaternion.copy(hit.quaternion);
        t.twin.scale.copy(hit.scale);
      }
    },
  };
}
