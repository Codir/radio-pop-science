import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CameraDirector, type Shot } from '../camera/director';

const a: Shot = { position: [0, 2, 10], target: [0, 0, 0], drift: 0 };
const b: Shot = { position: [8, 4, 2], target: [1, 0, 0], drift: 0 };
const dt = 1 / 60;

/** A director on shot `a`, orbited and zoomed by the reader, the orbit settled. */
function orbited(): CameraDirector {
  const d = new CameraDirector();
  d.setViewport(1280, 720);
  d.shots({ a, b });
  d.go('a', { instant: true });
  d.orbitBy(-180, 90);
  d.zoomBy(1.3);
  for (let i = 0; i < 120; i++) d.update(dt);
  return d;
}

describe('camera hold (a scene waits for its moment without snapping the reader’s view)', () => {
  it('keeps the orbited pose on screen and leaves from it on the next go()', () => {
    const d = orbited();
    const before = d.camera.position.clone();
    expect(before.distanceTo(new Vector3(0, 2, 10))).toBeGreaterThan(1);
    d.go('b', { duration: 2 }); // the stage's move to the next step's shot …
    d.hold('a'); // … held by the scene in the same frame
    for (let i = 0; i < 30; i++) d.update(dt);
    expect(d.camera.position.distanceTo(before)).toBeLessThan(1e-6);
    // the scene's move: the first frames leave from the held pose, every frame step stays small
    d.go('b', { duration: 2 });
    let prev = d.camera.position.clone();
    const steps: number[] = [];
    for (let i = 0; i < 150; i++) {
      d.update(dt);
      steps.push(d.camera.position.distanceTo(prev));
      prev = d.camera.position.clone();
    }
    // eased: it starts at rest (a ~13-unit arc over 2 s peaks near 0.3 per frame)
    expect(steps[0]).toBeLessThan(0.01);
    expect(Math.max(...steps)).toBeLessThan(0.4);
    expect(d.camera.position.distanceTo(new Vector3(8, 4, 2))).toBeLessThan(1e-3);
  });

  it('nothing unwinds after a hold: the orbit is baked in, not eased back', () => {
    const d = orbited();
    const before = d.camera.position.clone();
    d.hold();
    for (let i = 0; i < 120; i++) d.update(dt);
    expect(d.camera.position.distanceTo(before)).toBeLessThan(1e-6);
  });
});
