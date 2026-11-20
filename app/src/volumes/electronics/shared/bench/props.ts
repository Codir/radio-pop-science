/**
 * The permanent things of the bench (docs/volumes/electronics/VISUAL.md §2, §4.1, §5), each one on its place: the
 * battery's open box with the switch on its lid, the player, the speaker and the lamp on its post — the models with
 * real marks of `shared/parts` (E2-4) — and the magnifier's holder; on the table the places of the two instruments:
 * the multimeter's (`shared/instruments`, E2-6; the bench puts it in `meter`) and the oscilloscope, still a stand-in of
 * its size and colours (E2-9). The tray of parts is the hand's (`shared/hand/tray.ts`), the wires of these things are
 * `fixed.ts`'s.
 */
import { Group, Object3D, Vector3 } from 'three';
import { Builder } from '@/kit';
import {
  BULB_BOTTOM,
  BULB_SCALE,
  createBattery9v,
  createBulb,
  createPlayer,
  createSpeaker,
  type BulbModel,
  type PartEye,
  type PartView,
} from '../parts';
import { LAMP, PLACES } from './layout';
import { addLampPost, addLensHolder } from './mounts';
import { SLIDER_TRAVEL, SLIDER_Y, createSlider, type SliderModel } from './switch-slider';

/** Where the instruments wait while no step has them: beyond the frame's edge, on the table (world x, z). */
export const AWAY = {
  meter: [PLACES.meter.x - 4.2, PLACES.meter.z + 0.6],
  scope: [PLACES.scope.x + 4.6, PLACES.scope.z],
} as const;

export interface Props {
  /** What stands on the base: add to the base frame. */
  onBase: Group;
  /** What stands on the table (world): the two instruments. */
  onTable: Group;
  /** Where the lamp's filament is (base frame): the lamp's light hangs here. */
  filament: Object3D;
  /** The lamp: the circuit's bulb made smaller; the bench gives its filament the light rig's glow. */
  bulb: BulbModel;
  /** The permanent things with real marks (`shared/parts`): their prints, and the hook of the model's state. */
  things: { readonly battery: PartView; readonly player: PartView; readonly speaker: PartView };
  /** The battery's switch: the yellow slider on the box's lid. */
  slider: SliderModel;
  /** The instruments' groups (world), placed by `place`: the multimeter's case goes into `meter`. */
  meter: Group;
  scope: Group;
  /** 0 = open (the thumb pushed to the left, the gap shows) … 1 = closed. */
  setSwitch(closed: number): void;
  /** The instruments: 0 away beyond the frame's edge … 1 on their places. */
  place(meter: number, scope: number): void;
  /** Every frame: the prints of the permanent things («9 V», «8 Ω», «6 V») where they can be read. */
  view(eye: PartEye): void;
}

/** The oscilloscope on the table, its face toward the reader: a dark screen with no trace yet (VISUAL §5.2). */
function scope(): Group {
  const { width: W, depth: D, height: H } = PLACES.scope;
  const b = new Builder('scope');
  b.box(W, H, D, { r: 0.12, c: 'slate' });
  b.box(W - 0.14, H - 0.14, 0.02, { at: [0, 0.07, D / 2], r: 0.04, c: 'ink' });
  b.box(1.6, 1.28, 0.02, { at: [-0.25, 0.3, D / 2 + 0.012], r: 0.03, slot: 'gloss', c: 'bg.deep' });
  for (const y of [0.55, 1.0, 1.45])
    b.cyl(0.09, 0.06, { at: [0.85, y, D / 2], rot: [Math.PI / 2, 0, 0], seg: 20, c: 'mist' });
  const group = b.build().group;
  group.name = 'scope';
  return group;
}

export function createProps(): Props {
  const b = new Builder('props');
  addLampPost(b);
  addLensHolder(b);
  const model = b.build();
  const onBase = new Group();
  onBase.name = 'props';
  onBase.add(model.group);

  const battery = createBattery9v();
  battery.group.position.set(PLACES.battery.x, 0, PLACES.battery.z);
  const player = createPlayer();
  player.group.position.set(PLACES.player.x, 0, PLACES.player.z);
  const speaker = createSpeaker();
  speaker.group.position.set(PLACES.speaker.x, 0, PLACES.speaker.z);
  // the lamp stands in its post's socket, the middle of its glass at `LAMP.glassY`
  const bulb = createBulb();
  bulb.group.position.set(LAMP.x, BULB_BOTTOM, LAMP.z);
  onBase.add(battery.group, player.group, speaker.group, bulb.group);
  // the light hangs where the bulb's filament is
  const filament = new Object3D();
  filament.name = 'lamp:filament';
  filament.position.set(LAMP.x, BULB_BOTTOM + bulb.filament.position.y * BULB_SCALE, LAMP.z);
  onBase.add(filament);

  const slider = createSlider();
  slider.group.position.set(PLACES.switch.x, PLACES.battery.height + SLIDER_Y, PLACES.switch.z);
  onBase.add(slider.group);
  const sliderX = PLACES.switch.x;

  const onTable = new Group();
  onTable.name = 'table-props';
  // the multimeter's place: the bench puts the instrument in it
  const m = new Group();
  m.name = 'meter';
  const s = scope();
  onTable.add(m, s);

  const at = new Vector3();
  const smooth = (x: number): number => x * x * (3 - 2 * x);
  /** On the table between where an instrument waits and its place, eased. */
  const slide = (g: Group, from: readonly [number, number], to: { x: number; z: number }, shown: number) => {
    const k = smooth(Math.min(Math.max(shown, 0), 1));
    g.position.set(from[0], 0, from[1]).lerp(at.set(to.x, 0, to.z), k);
    g.visible = shown > 1e-3;
  };
  const props: Props = {
    onBase,
    onTable,
    filament,
    bulb,
    things: { battery, player, speaker },
    slider,
    meter: m,
    scope: s,
    setSwitch(closed) {
      slider.group.position.x = sliderX - SLIDER_TRAVEL * (1 - Math.min(Math.max(closed, 0), 1));
    },
    place(meterShown, scopeShown) {
      slide(m, AWAY.meter, PLACES.meter, meterShown);
      slide(s, AWAY.scope, PLACES.scope, scopeShown);
    },
    view(eye) {
      battery.view(eye);
      player.view(eye);
      speaker.view(eye);
      bulb.view(eye);
    },
  };
  props.setSwitch(0);
  props.place(0, 0);
  return props;
}
