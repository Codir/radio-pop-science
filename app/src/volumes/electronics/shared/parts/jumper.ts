/**
 * A jumper from the tray (docs/volumes/electronics/VISUAL.md §2, §4): a `violet` insulated wire, bent down at both
 * ends into its sockets, its bare tinned ends in the mouths; 4 P from the tray, re-seated anywhere from 1 P to 16 P.
 * The whole wire follows its ends: `fit` reshapes it for any span.
 *
 * Draw calls: the insulation, the bare ends (the legs).
 */
import { Box3, Group, Mesh, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { BOARD_SPEC } from '@electronics/sim/board';
import { LEG, Prints, assemble, bent, type PartModel } from './part';

export const JUMPER = {
  /** Height of the wire's middle above the board, and the insulation's radius. */
  height: 0.15,
  radius: 0.045,
  /** Where the insulation ends and the bare wire goes on into the socket. */
  bare: 0.07,
  /** Radius of the wire's bends. */
  bend: 0.07,
} as const;

export interface JumperModel extends PartModel {
  /** The insulated wire, rebuilt with its span. */
  readonly insulation: Mesh;
}

export function createJumper(key = 'jumper'): JumperModel {
  const body = new Group();
  const insulation = new Mesh(undefined, K.toon({ color: 'violet', gloss: 0.4, highlight: 0.4 }));
  insulation.name = `${key}:insulation`;
  body.add(insulation);
  const { height: H, radius: r, bare } = JUMPER;
  const span = 4 * BOARD_SPEC.pitch;
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(
      new Vector3(-span / 2 - 0.06, 0.03, -0.07),
      new Vector3(span / 2 + 0.06, H + r + 0.03, 0.07),
    ),
    legX: [0, span],
    legPaths: (local) =>
      local.map((t) => [new Vector3(t.x, t.y + LEG.dip, t.z), new Vector3(t.x, t.y + bare + 0.02, t.z)]),
    follow: (local, hit) => {
      const a = local[0]!;
      const b = local[local.length - 1]!;
      const old = insulation.geometry;
      insulation.geometry = G.tube(
        bent(
          [
            new Vector3(a.x, a.y + bare, a.z),
            new Vector3(a.x, Math.max(a.y, b.y) + H, a.z),
            new Vector3(b.x, Math.max(a.y, b.y) + H, b.z),
            new Vector3(b.x, b.y + bare, b.z),
          ],
          JUMPER.bend,
        ),
        r,
        { seg: 10 },
      );
      old.dispose();
      // the box of gesture 1 runs along the wire
      const length = Math.hypot(b.x - a.x, b.z - a.z) + 0.12;
      hit.scale.set(length, H + r, 0.14);
      hit.position.set((a.x + b.x) / 2, 0.03 + (H + r) / 2, (a.z + b.z) / 2);
    },
    bodyMaterials: [insulation.material],
    prints: new Prints(),
  });
  return Object.assign(m, { insulation });
}
