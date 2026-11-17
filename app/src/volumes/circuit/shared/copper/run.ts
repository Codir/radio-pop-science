/**
 * The run of one electron in the field (`resistance/bumps`, VISUAL §6 «Удар»): between atoms the field speeds it
 * up toward the plus (−X of the copper world), so its path bends that way; at an atom it bounces off and starts
 * again slowly — the run is lost. Pure helpers over the flat arrays of `electron-sim.ts` (positions and unit
 * directions, 3 numbers per electron). A stated simplification: the speed-up is exaggerated beyond measure so that
 * the eye sees it (the true gain between two hits is a ten-billionth of the electron's speed).
 */

/**
 * Move electron e for `dt` seconds at `speed` along its direction plus the field's pull `field` (units/s²) toward
 * −X; writes the new direction and returns the new speed, never above `top` (a flight that finds no atom would
 * otherwise race off).
 */
export function accelerate(
  pos: Float32Array,
  dir: Float32Array,
  e: number,
  speed: number,
  field: number,
  dt: number,
  top: number,
): number {
  const o = 3 * e;
  const vx = dir[o]! * speed - field * dt;
  const vy = dir[o + 1]! * speed;
  const vz = dir[o + 2]! * speed;
  const s = Math.max(Math.hypot(vx, vy, vz), 1e-6);
  dir[o] = vx / s;
  dir[o + 1] = vy / s;
  dir[o + 2] = vz / s;
  const v = Math.min(s, top);
  pos[o] = pos[o]! + dir[o]! * v * dt;
  pos[o + 1] = pos[o + 1]! + dir[o + 1]! * v * dt;
  pos[o + 2] = pos[o + 2]! + dir[o + 2]! * v * dt;
  return v;
}

/**
 * After a bounce near the edge of the area the followed electron keeps to (`half` around `centre`): a direction
 * that would carry it further out is turned back toward the middle. Away from the edge the bounce is left as it is.
 */
export function steerInward(
  pos: Float32Array,
  dir: Float32Array,
  e: number,
  centre: { x: number; y: number },
  half: readonly [number, number],
): void {
  const o = 3 * e;
  for (const a of [0, 1] as const) {
    const off = pos[o + a]! - (a === 0 ? centre.x : centre.y);
    if (Math.abs(off) > 0.45 * half[a] && off * dir[o + a]! > 0) dir[o + a] = -dir[o + a]!;
  }
}
