/**
 * One DOM twin per WebGL view (`Hud.domTwin`): volume-bound views (home, glossary, map) are swapped per volume and
 * come back when the reader returns to the volume — they get the twin built the first time.
 */
import type { Overlay } from '@/hud/shell';

export function twinOf(make: (gl: Overlay) => Overlay): (gl: Overlay) => Overlay {
  const twins = new WeakMap<Overlay, Overlay>();
  return (gl) => {
    let t = twins.get(gl);
    if (!t) twins.set(gl, (t = make(gl)));
    return t;
  };
}
