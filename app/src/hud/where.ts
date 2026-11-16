/**
 * «Де ми»: the floor of the volume's axis the reader is on right now, as the chapter on screen reports it
 * (`floorLadder` of `@/hud-dom/journey` feeds it from the scene, e.g. `world.floorId` of a dive). The header's
 * axis chip reads it — on a phone that chip is the whole «де ми» cue, on a desk it backs the ladder. Pure state;
 * the chapter's report ends with the chapter (`setWhere(key, null)`).
 */
import { floorLabel, type ChapterManifest, type VolumeManifest } from '@/engine/api';

let where: { key: string; floor: string } | null = null;
const listeners = new Set<() => void>();

/** The chapter `key` (`volume/chapter`) reports its current floor id, or null (no floor cue: the chapter's own). */
export function setWhere(key: string, floor: string | null): void {
  const next = floor === null ? (where?.key === key ? null : where) : { key, floor };
  if (next?.key === where?.key && next?.floor === where?.floor) return;
  where = next;
  for (const fn of listeners) fn();
}

export function onWhere(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The floor id the chapter `key` reports now (null: none). */
export function whereFloor(key: string): string | null {
  return where?.key === key ? where.floor : null;
}

/**
 * Text of the header's axis chip: in a volume with named floors, the floor the reader is on (the reported one,
 * else the chapter's own), by the name the reader may see now (`floorLabel`: plain until introduced); in any
 * other volume the chapter's axis label as it was.
 */
export function axisChipText(
  m: ChapterManifest,
  volume: VolumeManifest | undefined,
  visited: Readonly<Record<string, readonly string[]>>,
): string {
  const floors = volume?.journey.axis.floors ?? [];
  if (!volume || floors.length === 0) return m.axisLabel;
  const id = whereFloor(`${m.volume}/${m.id}`);
  const floor = floors.find((f) => f.id === id) ?? floors.find((f) => f.label === m.axisLabel);
  return floor ? floorLabel(volume, floor, visited) : m.axisLabel;
}
