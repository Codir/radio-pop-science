/**
 * The two small parts the flashlight shares with the stand: the yellow slider of the switch (a thumb piece on
 * a steel bridge — "повзунок-місток") and the conical spring that presses on the battery's minus.
 */
import { CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3 } from 'three';
import type { KToonMaterial } from '@/style';
import { Builder } from '@/kit';
import { K } from '@/style';
import { SWITCH } from './layout';

/** Height of the slider's origin above the face when it sits on the switch block. */
export const SLIDER_Y = 0.26;
/** How far the slider travels between closed (0) and open: the bridge leaves the left contact. */
export const SLIDER_TRAVEL = SWITCH.gap / 2 + 0.15;

/** Origin = centre of the bridge's underside; the bridge spans both contact studs when the slider is centred. */
export interface SliderModel {
  group: Group;
  /**
   * 0…1: the thumb's own faint glow — a glow-in-the-dark switch, so that the reader finds it in a black frame
   * (`prologue/click`). Below the bloom threshold; the stage fades it out as the room gets light.
   */
  setGlow(amount: number): void;
}

export function createSlider(): SliderModel {
  const b = new Builder('slider');
  b.box(SWITCH.gap + 0.2, 0.035, 0.2, { r: 0.012, slot: 'metal', c: ['steel', 'mist'] });
  b.box(0.3, 0.15, 0.42, { at: [0, 0.03, 0], r: 0.05, slot: 'gloss', c: ['amber', 'yellow'] });
  // three grip ridges
  for (const dx of [-0.075, 0, 0.075])
    b.box(0.035, 0.035, 0.34, { at: [dx, 0.17, 0], r: 0.014, slot: 'gloss', c: 'yellow.light' });
  const model = b.build();
  const thumb = model.mats.get('gloss') as KToonMaterial;
  thumb.setEmissive('yellow', 0);
  return {
    group: model.group,
    setGlow(amount) {
      // a small floor keeps the thumb yellow under the lamp's warm light too
      thumb.emissiveIntensity = 0.14 + 0.5 * Math.min(Math.max(amount, 0), 1);
    },
  };
}

export interface SpringModel {
  group: Group;
  /** Rest length along local +x (from the origin). Scale `group.scale.x` to compress it. */
  length: number;
}

/** Conical compression spring along local +x, wide end at the origin, narrow end toward the battery. */
export function createSpring(length = 0.2, turns = 4.5): SpringModel {
  const pts: Vector3[] = [];
  const n = Math.round(turns * 16);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = s * turns * Math.PI * 2;
    const r = 0.2 - 0.09 * s;
    pts.push(new Vector3(s * length, Math.cos(a) * r, Math.sin(a) * r));
  }
  const mesh = new Mesh(
    new TubeGeometry(new CatmullRomCurve3(pts), n * 2, 0.021, 8, false),
    K.metal({
      color: 'steel',
      gradient: { bottom: 'steel', top: 'mist', range: [-0.2, 0.2] },
      specular: 0.8,
    }),
  );
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.name = 'spring';
  const group = new Group();
  group.name = 'spring';
  group.add(mesh);
  return { group, length };
}
