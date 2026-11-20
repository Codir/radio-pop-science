/**
 * Small hashes and means for the bench's checks, copied from `radio/shared/world/index.ts` (shared/README.md,
 * «Копії»): QA readers report a hash of what the model gave (a sweep, a solution) instead of the numbers themselves,
 * so two pages can be compared in one value.
 */

/** FNV-1a, 32 bits, as eight hexadecimal digits. */
export function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The mean of the cells; 0 for none. (In `radio` it took bytes only; here any numbers.) */
export function meanOf(cells: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < cells.length; i++) sum += cells[i]!;
  return cells.length > 0 ? sum / cells.length : 0;
}
