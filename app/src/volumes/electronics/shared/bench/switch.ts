/**
 * The battery's slide switch under the reader's hand (docs/volumes/electronics/VISUAL.md §4.1, §6): a tap flips it.
 * Copied from `circuit/chapters/build/parts/switch.ts` (shared/README.md, «Копії»): the generous invisible hit volume
 * on the small slider, the tap, the count of flips; the world's `flying` is the bench's, and `closed` is the setting of
 * the model's part `SW` in the board's state (0 open, 1 closed) — the bench places the slider from it with its own
 * inertia (`bench.closed`), so this part only flips it.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';

export interface SwitchPart {
  /** The invisible hit volume on the slider (QA presses it). */
  readonly hit: Mesh;
  /** Flips by the reader since `reset()`. */
  readonly flips: number;
  /** Called after each flip by the reader. */
  onFlip: (() => void) | null;
  reset(): void;
  dispose(): void;
}

/**
 * `slider`: the slider's group (the hit follows it); `closed`: the switch's setting now, `set`: write it; `live`:
 * whether a tap may flip it now (the camera is still, the step allows it); `label`: the tooltip.
 */
export function switchPart(
  ctx: ChapterContext,
  slider: Object3D,
  closed: () => number,
  set: (v: number) => void,
  live: () => boolean,
  label: () => string,
): SwitchPart {
  const hit = new Mesh(new SphereGeometry(0.36, 16, 10), new MeshBasicMaterial({ visible: false }));
  hit.name = 'bench-switch-hit';
  slider.add(hit);
  let flips = 0;
  const part: SwitchPart = {
    hit,
    get flips() {
      return flips;
    },
    onFlip: null,
    reset() {
      flips = 0;
    },
    dispose() {
      off();
      hit.removeFromParent();
      hit.geometry.dispose();
      (hit.material as MeshBasicMaterial).dispose();
    },
  };
  const off = ctx.input.register(hit, {
    tooltip: label,
    cursor: 'pointer',
    enabled: live,
    click: () => {
      if (!live()) return;
      set(closed() >= 0.5 ? 0 : 1);
      // the switch's own sound (VISUAL §1: `toggle`), silent before the first gesture and with `?noaudio`
      audio.play('toggle');
      flips++;
      part.onFlip?.();
    },
  });
  return part;
}
