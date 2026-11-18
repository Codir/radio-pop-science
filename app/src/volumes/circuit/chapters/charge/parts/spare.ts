/**
 * The short spare piece of wire in front of the stand (VISUAL §5, chapter 2): the stand's own copper core without
 * its sheath, a few centimetres long, lying on the table along world +x (so the lens window keeps it left ↔ right,
 * `shared/world/window.ts`). Same metal as the stand's core (`shared/stage/wires.ts`), a touch thicker so that it
 * reads at the table's scale; cut ends a little brighter, as fresh cuts are.
 */
import { CapsuleGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { K } from '@/style';

export const SPARE_R = 0.075;

export interface Spare {
  group: Group;
  /** World ends of the piece (left = −x). */
  left: Vector3;
  right: Vector3;
  length: number;
}

export function createSpare(centre: Vector3, length: number): Spare {
  const group = new Group();
  group.name = 'charge-spare-wire';
  const metal = K.metal({ color: 'orange', specular: 0.22, shininess: 180, rim: 0.3, highlight: 0.2 });
  const body = new Mesh(new CapsuleGeometry(SPARE_R, length - 2 * SPARE_R, 6, 20), metal);
  body.rotation.z = Math.PI / 2;
  body.castShadow = body.receiveShadow = true;
  const cut = K.metal({ color: 'amber', specular: 0.4, shininess: 220, rim: 0.3, highlight: 0.3 });
  for (const s of [-1, 1]) {
    const end = new Mesh(new SphereGeometry(SPARE_R * 1.01, 16, 12), cut);
    end.position.x = s * (length / 2 - SPARE_R);
    end.scale.set(0.5, 1, 1);
    group.add(end);
  }
  group.add(body);
  group.position.copy(centre).setY(SPARE_R);
  return {
    group,
    left: centre
      .clone()
      .setY(SPARE_R)
      .add(new Vector3(-length / 2, 0, 0)),
    right: centre
      .clone()
      .setY(SPARE_R)
      .add(new Vector3(length / 2, 0, 0)),
    length,
  };
}
