/**
 * A thick force arrow (VISUAL §4: field and push are `amber`; §7 «великі кулі й товсті стрілки»): a round shaft
 * and a cone, lit like the props but with a little glow of its own so it reads on the dark table. `set` lays it
 * from a point along a direction with a total length; the head keeps its size, so a short arrow is mostly head.
 */
import { CylinderGeometry, ConeGeometry, Group, Mesh, Quaternion, Vector3 } from 'three';
import { K } from '@/style';

const UP = new Vector3(0, 1, 0);

export interface Arrow {
  group: Group;
  /** 0…1 presence (scales the thickness: an arrow never pops). */
  shown: number;
  set(from: Vector3, dir: Vector3, length: number): void;
}

export function createArrow(radius = 0.07, head = 0.3, color = 'amber'): Arrow {
  const material = K.toon({ color, emissive: color, emissiveIntensity: 0.35, rim: 0.6 });
  const shaft = new Mesh(new CylinderGeometry(radius, radius, 1, 16), material);
  const cone = new Mesh(new ConeGeometry(radius * 2.4, head, 20), material);
  shaft.castShadow = cone.castShadow = false;
  const group = new Group();
  group.name = 'charge-arrow';
  group.add(shaft, cone);
  const q = new Quaternion();
  const d = new Vector3();
  const arrow: Arrow = {
    group,
    shown: 0,
    set(from, dir, length) {
      const s = Math.max(arrow.shown, 1e-3);
      group.visible = arrow.shown > 0.002 && length > 1e-3;
      d.copy(dir).normalize();
      q.setFromUnitVectors(UP, d);
      const h = Math.min(head, length * 0.6);
      const body = Math.max(length - h, 1e-3);
      shaft.quaternion.copy(q);
      shaft.scale.set(s, body, s);
      shaft.position.copy(from).addScaledVector(d, body / 2);
      cone.quaternion.copy(q);
      cone.scale.set(s, h / head, s);
      cone.position.copy(from).addScaledVector(d, body + h / 2);
    },
  };
  return arrow;
}
