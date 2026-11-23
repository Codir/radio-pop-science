/**
 * Where a step's callout points (the batch E3 lesson, `resistor-pick/on`): on the part's body on the screen, never
 * over it — the bench's shots are oblique, so a point over a part lands on whatever stands behind it (the amplifier's
 * LED «on» before its 2,2 kΩ R1 from the shot `meter`). `onBody` is the point: the middle of the part's `hit` box moved
 * toward the camera by half the box's thinner side across (an LED's collar, a resistor's lacquer, a can's sleeve);
 * `firstUnder` is the part a ray from the eye through a point meets first — the checks' proof that each point shows on
 * its own part.
 */
import { Raycaster, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Bench } from '../bench';

type Eye = Pick<ChapterContext, 'camera'>;

/** The callout's point on the part `id` (world), every frame anew; far below the bench while the part is not there. */
export function onBody(ctx: Eye, bench: Bench, id: string): () => Vector3 {
  const v = new Vector3();
  const size = new Vector3();
  const toward = new Vector3();
  return (): Vector3 => {
    const m = bench.parts.models.get(id);
    if (!m) return v.set(0, -100, 0);
    m.hit.getWorldPosition(v);
    m.hit.getWorldScale(size);
    toward.copy(ctx.camera.camera.position).sub(v).normalize();
    return v.addScaledVector(toward, Math.min(size.x, size.z) / 2);
  };
}

/** The part a ray from the eye through `p` (world) meets first, by the parts' `hit` boxes; null — none. */
export function firstUnder(ctx: Eye, bench: Bench, p: Vector3): string | null {
  const eye = ctx.camera.camera.position;
  const ray = new Raycaster(eye.clone(), p.clone().sub(eye).normalize());
  let first: string | null = null;
  let near = Infinity;
  for (const [id, m] of bench.parts.models) {
    const hit = ray.intersectObject(m.hit, false)[0];
    if (hit && hit.distance < near) {
      near = hit.distance;
      first = id;
    }
  }
  return first;
}
