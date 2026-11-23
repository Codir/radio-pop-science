/**
 * The print of a part (`part.ts` `Prints`, VISUAL §9 and its exception): decided as a whole by its smallest text, shown
 * only where all of it has ≥ 16 px-equivalent per em (`chapter-check`'s rule). On a phone the scene shows no print —
 * but on the dive's floors `part` and `inside` (`PartEye.close`: the camera down at the part), where the desk's rule
 * reads it: the ceramic's code «104» that `capacitor-kinds/ceramic` asks the reader to read through the magnifier.
 */
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { setFontData, type FontJson, type Text3D } from '@/text';
import { buildPart, type PartEye, type PartModel } from '..';

beforeAll(() => {
  const json = JSON.parse(
    readFileSync(new URL('../../../../../../public/fonts/fonts.json', import.meta.url), 'utf8'),
  ) as FontJson;
  setFontData(json);
});

/** A phone's camera (390 × 844) `distance` in front of the part's print, looking at it straight. */
function eyeAt(m: PartModel, distance: number, over: Partial<PartEye> = {}): PartEye {
  const text = m.group.getObjectByName('print:104') as Text3D;
  m.group.updateMatrixWorld(true);
  const at = text.getWorldPosition(new Vector3());
  const camera = new PerspectiveCamera(27, 390 / 844, 0.05, 100);
  camera.position.copy(at).add(new Vector3(0, 0, distance));
  camera.lookAt(at);
  camera.updateMatrixWorld(true);
  return { camera, aspect: 390 / 844, phone: true, room: 1, ...over };
}

describe('a part’s print on a phone', () => {
  it('is hidden on the step’s shot, and read by the desk’s rule down at the part (the floors `part`, `inside`)', () => {
    const c = buildPart('ceramic-100n')!;
    const text = c.group.getObjectByName('print:104') as Text3D;
    expect(text).toBeDefined();
    // close enough that «104» has well over 16 px-equivalent per em: a phone on the step's shot still shows nothing
    c.view(eyeAt(c, 2));
    expect(text.visible).toBe(false);
    // down at the part: shown, as on a desk
    c.view(eyeAt(c, 2, { close: true }));
    expect(text.visible).toBe(true);
    expect(text.opacity).toBe(1);
    // the same camera on a desk: shown too
    c.view(eyeAt(c, 2, { phone: false }));
    expect(text.visible).toBe(true);
    // down at the part but too far for 16 px-equivalent: hidden, as on a desk
    c.view(eyeAt(c, 30, { close: true }));
    expect(text.visible).toBe(false);
    c.view(eyeAt(c, 30, { phone: false }));
    expect(text.visible).toBe(false);
    c.dispose();
  });
});
