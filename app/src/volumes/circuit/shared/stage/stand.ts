/**
 * Everything that stands on the board, assembled in the BOARD FRAME, with each thing on its permanent place
 * (VISUAL.md §2): mounts, the one battery, the one switch (slider), the one lamp, the four pieces of wire.
 * The unfolding (`unfold.ts`) moves the same objects between these places and the flashlight.
 */
import { type Group, Vector3, type Object3D } from 'three';
import { Builder } from '@/kit';
import { createBattery, type BatteryModel } from './battery';
import { BULB, createBulb, type BulbDims, type BulbModel } from './bulb';
import { BATTERY, LAMP, SWITCH } from './layout';
import { addMounts } from './mounts';
import { SLIDER_TRAVEL, SLIDER_Y, createSlider, createSpring, type SpringModel } from './small-parts';
import { createWires, type Wires } from './wires';

/** Permanent places of the moving parts (board frame). */
export const PLACE = {
  battery: new Vector3(BATTERY.x, BATTERY.y, BATTERY.z),
  /** Wide end of the spring, on the minus clamp's leaf. */
  spring: new Vector3(BATTERY.x - BATTERY.length / 2 - 0.185, BATTERY.y, BATTERY.z),
  springLength: 0.165,
  /** Bottom contact of the bulb, on the socket's floor. */
  bulb: new Vector3(LAMP.x, LAMP.socketY - 0.2, LAMP.z),
  /** Slider, closed (bridging both contacts). */
  slider: new Vector3(SWITCH.x, SLIDER_Y, SWITCH.z),
} as const;

export interface Stand {
  /** Add to the board frame. */
  group: Group;
  /** The mounts, by name, and their names in the order of the growing wave. */
  mounts: Record<string, Group>;
  mountOrder: string[];
  battery: BatteryModel;
  bulb: BulbModel;
  slider: Group;
  spring: SpringModel;
  wires: Wires;
  /** Put every moving part on its permanent place (the finished stand). `open` 0…1 = slider position. */
  settle(open: number): void;
  /** The slider's glow-in-the-dark 0…1 (see `SliderModel.setGlow`). */
  setSliderGlow(amount: number): void;
  /** Slider only: 0 = closed (bridge on both contacts) … 1 = open (the gap shows). */
  setSwitch(open: number): void;
  /** Objects worth a tooltip / hotspot, on their places. */
  anchors: Record<'battery' | 'switch' | 'lamp' | 'plus' | 'minus', Object3D>;
}

export function createStand(bulbDims: BulbDims = BULB): Stand {
  const b = new Builder('stand');
  const mountOrder = addMounts(b);
  b.anchor('battery', BATTERY.x, BATTERY.y + BATTERY.radius, BATTERY.z)
    .anchor('switch', SWITCH.x, SLIDER_Y + 0.2, SWITCH.z)
    .anchor('lamp', LAMP.x, PLACE.bulb.y + bulbDims.filamentY + 0.02, LAMP.z)
    .anchor('plus', BATTERY.plusX, 0.3, BATTERY.z)
    .anchor('minus', BATTERY.minusX, 0.3, BATTERY.z);
  const model = b.build();
  const group = model.group;
  const mounts: Record<string, Group> = {};
  for (const name of mountOrder) mounts[name] = model.part(name);

  const battery = createBattery();
  const bulb = createBulb(bulbDims);
  const sliderModel = createSlider();
  const slider = sliderModel.group;
  const spring = createSpring();
  const wires = createWires();
  group.add(battery.group, bulb.group, slider, spring.group, wires.group);

  const setSwitch = (open: number): void => {
    slider.position.copy(PLACE.slider);
    slider.position.x += Math.min(Math.max(open, 0), 1) * SLIDER_TRAVEL;
  };
  return {
    group,
    mounts,
    mountOrder,
    battery,
    bulb,
    slider,
    spring,
    wires,
    setSwitch,
    setSliderGlow: sliderModel.setGlow,
    settle(open) {
      for (const m of Object.values(mounts)) m.scale.setScalar(1);
      battery.group.position.copy(PLACE.battery);
      battery.group.quaternion.identity();
      spring.group.position.copy(PLACE.spring);
      spring.group.quaternion.identity();
      spring.group.scale.set(PLACE.springLength / spring.length, 1, 1);
      bulb.group.position.copy(PLACE.bulb);
      bulb.group.quaternion.identity();
      slider.quaternion.identity();
      setSwitch(open);
      wires.setStand();
    },
    anchors: {
      battery: model.anchor('battery'),
      switch: model.anchor('switch'),
      lamp: model.anchor('lamp'),
      plus: model.anchor('plus'),
      minus: model.anchor('minus'),
    },
  };
}
