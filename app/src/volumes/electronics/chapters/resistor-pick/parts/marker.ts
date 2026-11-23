/**
 * The mark of the band chosen last in `bands` (the script's «Бачимо»: the stand marks the chosen band; `yellow` is the
 * colour of «вибране», VISUAL §1): a small yellow cone beside the resistor's body, past its upper edge on the screen,
 * its tip toward the middle of that band — so it never covers a band's colour and is not taken for a band itself. One
 * draw call; like the hand's grips (`cyan`, «можна взяти», VISUAL §6) it carries a faint glow of its own colour, so the
 * dark room does not turn its yellow olive — an affordance of the interface, not a light of the circuit. Placed every
 * frame from the camera and the part's body frame.
 */
import { Group, Mesh, Quaternion, Vector3, type Camera } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { tameAll } from '@electronics/shared/bench';
import { AXIAL_Y, RESISTOR, type ResistorModel } from '@electronics/shared/parts';

export const MARKER = {
  /** The cone's base radius and its height (board units; the body is 0.29 across). */
  radius: 0.042,
  height: 0.095,
  /** How far the tip stays from the body's surface, beyond its upper edge on the screen. */
  gap: 0.04,
  /** Its own faint glow (the grips' resting glow is 0.18). */
  glow: 0.35,
} as const;

export interface BandMarker {
  readonly group: Group;
  /** Every frame after the bench updated: over band `band` of `model` as `camera` sees it, or hidden (null). */
  show(model: ResistorModel | null, band: number | null, camera: Camera): void;
  /** Where the tip points (world), for the checks; null while hidden. */
  readonly aim: Vector3 | null;
  dispose(): void;
}

const Y = new Vector3(0, 1, 0);

export function createBandMarker(parent: Group): BandMarker {
  // the tip at the origin, the base `height` along +y: turned so that +y is the screen's up beside the body
  const geometry = G.cone(MARKER.radius, MARKER.height, { seg: 20 }).rotateX(Math.PI).translate(0, MARKER.height, 0);
  const material = K.toon({ color: 'yellow', emissive: 'yellow', emissiveIntensity: MARKER.glow, keepHue: true });
  const group = new Group();
  group.name = 'band-marker';
  group.add(new Mesh(geometry, material));
  group.visible = false;
  parent.add(group);
  // the bench's cap on the lamp's light, as every lit material of the bench has it
  tameAll(group);
  const mid = new Vector3();
  const up = new Vector3();
  const axis = new Vector3();
  const tip = new Vector3();
  const q = new Quaternion();
  let aim: Vector3 | null = null;
  return {
    group,
    get aim() {
      return aim;
    },
    show(part, band, camera) {
      const x = band === null ? undefined : part?.bandX[band];
      if (!part || x === undefined) {
        group.visible = false;
        aim = null;
        return;
      }
      part.bodyGroup.updateWorldMatrix(true, false);
      // the band's middle on the axis, and the axis itself (world)
      part.bodyGroup.localToWorld(mid.set(x, AXIAL_Y, 0));
      axis.set(1, 0, 0).transformDirection(part.bodyGroup.matrixWorld);
      // the screen's up, square to the axis: beyond the body's upper edge as the camera sees it
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      up.addScaledVector(axis, -up.dot(axis)).normalize();
      const scale = part.bodyGroup.getWorldScale(tip).x;
      tip.copy(mid).addScaledVector(up, (RESISTOR.radius + MARKER.gap) * scale);
      parent.updateWorldMatrix(true, false);
      group.position.copy(parent.worldToLocal(tip.clone()));
      // the cone's +y along the screen's up, in the parent's frame
      q.setFromUnitVectors(Y, up);
      group.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));
      group.scale.setScalar(scale / parent.getWorldScale(new Vector3()).x);
      group.visible = true;
      aim = mid.clone();
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
