/**
 * The prologue's own shots, beside the world's (`stand`, `flashlight`, `lens`, `handover`, `copper-*`).
 * World coordinates; the stand is mounted at the origin.
 */
import type { Shot } from '@/engine/api';
import { AWAY_SHOT } from '@circuit/shared/world';

export const PROLOGUE_SHOTS = {
  /** `map`: the world's «away» frame — the stand pulled back behind the map board (the next chapter starts here). */
  map: AWAY_SHOT,
} satisfies Record<string, Shot>;
