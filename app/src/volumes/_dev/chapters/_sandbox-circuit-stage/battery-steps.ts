/**
 * The battery steps of the stand showcase (K-battery-inside): every parameter of `stand.stand.battery.inside`
 * and the meter on a slider. Step entry sets the preset; the sliders take over from there.
 */
import type { ChapterContext, StepInfo } from '@/engine/api';
import { Vector3 } from 'three';
import { stepUi } from '@/hud';
import {
  BATTERY_LAYERS,
  type BatteryLayer,
  type CircuitStage,
  LIFE_STATES,
  followVoltage,
  meterVoltage,
} from '@circuit/shared/stage';

interface Preset {
  cut: number;
  island: number;
  life: number;
  reaction: number;
  surplus: number;
  lack: number;
  closed: number;
}
const BASE: Preset = { cut: 0, island: 0, life: 0, reaction: 0, surplus: 0, lack: 0, closed: 1 };
const BATTERY_PRESETS: Record<string, Preset> = {
  'battery-cut': { ...BASE, cut: 1, island: 1, reaction: 1, surplus: 0.6, lack: 0.6 },
  'battery-cut-stand': { ...BASE, cut: 1, reaction: 1, surplus: 0.6, lack: 0.6 },
  'battery-dead-cut': { ...BASE, cut: 1, life: 1, reaction: 1, surplus: 0.5, lack: 0.5 },
  'battery-minus': { ...BASE, surplus: 0.75, closed: 0 },
  'battery-plus': { ...BASE, lack: 0.75, closed: 0 },
  'battery-voltage': { ...BASE, closed: 0 },
};
const KEYS = ['cut', 'island', 'life', 'reaction', 'surplus', 'lack'] as const;
const LIFE_MARKS = [
  { value: LIFE_STATES.fresh, label: 'свіжа' },
  { value: LIFE_STATES.working, label: 'працює' },
  { value: LIFE_STATES.tired, label: 'втомлена' },
  { value: LIFE_STATES.dead, label: 'сіла' },
];

export function batterySteps(ctx: ChapterContext, stand: CircuitStage) {
  const cell = stand.stand.battery.inside;
  const gauge = stand.tools.gauge;
  const ui = stepUi(ctx);
  // scrub state of every slider (UI_API §3.3): the thumb is the target, the scene follows
  const target: Record<(typeof KEYS)[number], number> = {
    cut: 0,
    island: 0,
    life: 0,
    reaction: 0,
    surplus: 0,
    lack: 0,
  };
  const shown = { ...target };
  const drag: Record<string, boolean> = {};
  let active = false;
  let needle = 1.5;
  let hovered: BatteryLayer | null = null;
  const slider = (id: (typeof KEYS)[number], label: string, marks?: typeof LIFE_MARKS) => ({
    type: 'slider' as const,
    id,
    label,
    min: 0,
    max: 1,
    value: 0,
    format: (v: number) => `${Math.round(v * 100)} %`,
    ...(marks ? { marks } : {}),
    onChange: (v: number) => (target[id] = v),
    onInput: (_v: number, how: string) => (drag[id] = how === 'drag'),
  });
  const cutUi = [
    slider('cut', 'Розріз'),
    slider('island', 'Світло розрізу'),
    slider('life', 'Життя', LIFE_MARKS),
    slider('reaction', 'Реакція'),
  ];
  const poleUi = [slider('surplus', 'Надлишок на мінусі'), slider('lack', 'Нестача на плюсі')];
  const counts = {
    type: 'readout' as const,
    id: 'counts',
    label: 'Рівень: мінус · плюс',
    text: () => `${Math.round(cell.surplus * 100)} % · ${Math.round(cell.lack * 100)} %`,
  };
  // the battery keeps its poles itself (battery/inside «first moment», battery/balance: drag the clump away)
  const holdUi = [
    {
      type: 'toggle' as const,
      id: 'hold',
      label: 'Батарейка тримає полюси',
      value: false,
      onChange: (v: boolean) => (cell.hold = v),
    },
    {
      type: 'button' as const,
      id: 'first',
      label: 'Перша мить',
      onClick: () => {
        cell.surplus = cell.lack = 0;
        cell.hold = true;
        ui.set('hold', true);
      },
    },
  ];
  const closedUi = {
    type: 'toggle' as const,
    id: 'closed',
    label: 'Коло замкнене',
    value: true,
    onChange: (v: boolean) => (stand.closed = v ? 1 : 0),
  };
  const callouts = (Object.keys(BATTERY_LAYERS) as BatteryLayer[]).map((id) => ({
    anchor: cell.layers[id].anchor,
    text: BATTERY_LAYERS[id],
    visible: () => active && hovered === id && cell.cut > 0.5,
  }));
  ui.define({
    'battery-cut': { controls: [...cutUi, ...poleUi, ...holdUi], callouts },
    'battery-dead-cut': { controls: [...cutUi, ...poleUi], callouts },
    'battery-cut-stand': { controls: [...cutUi], callouts },
    'battery-minus': { controls: [...poleUi, counts] },
    'battery-plus': { controls: [...poleUi, counts] },
    'battery-voltage': { controls: [slider('life', 'Життя', LIFE_MARKS), closedUi] },
  });
  const plane = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  ctx.input.register(cell.clump.handle, {
    tooltip: 'зайві електрони',
    cursor: 'grab',
    dragStart: () => cell.clump.grab(),
    drag: (e) => {
      // drag across the plane facing the camera through the heap
      ctx.camera.camera.getWorldDirection(plane).negate();
      cell.clump.handle.getWorldPosition(through);
      if (e.planePoint(plane, through, hit)) cell.clump.moveTo(hit);
    },
    dragEnd: () => void cell.clump.release(),
    enabled: () => active && cell.surplusCount > 0,
  });
  for (const id of Object.keys(BATTERY_LAYERS) as BatteryLayer[]) {
    // the name shows as a callout on the layer (no tooltip: it would say it twice)
    ctx.input.register(cell.layers[id].pick, {
      hover: (over) => {
        hovered = over ? id : hovered === id ? null : hovered;
        cell.highlight = hovered;
      },
      enabled: () => active && cell.cut > 0.5,
    });
  }
  return {
    enterStep(id: string, info: StepInfo): void {
      const preset = BATTERY_PRESETS[id];
      active = preset !== undefined;
      const p = preset ?? BASE;
      for (const k of KEYS) {
        target[k] = p[k];
        if (info.instant || !active) shown[k] = p[k];
        if (active) ui.set(k, p[k]);
      }
      if (active) ui.set('closed', p.closed > 0.5);
      cell.hold = false;
      if (active) ui.set('hold', false);
    },
    update(dt: number): void {
      for (const k of KEYS) {
        if (cell.hold && (k === 'surplus' || k === 'lack')) {
          // the battery drives these: the sliders follow it
          target[k] = shown[k] = cell[k];
          if (active) ui.set(k, shown[k]);
          continue;
        }
        shown[k] = drag[k] ? target[k] : shown[k] + (target[k] - shown[k]) * (1 - Math.exp(-dt / 0.25));
        cell[k] = shown[k];
        if (active) ui.patch(k, { current: shown[k] });
      }
      cell.reaction = shown.reaction * (active ? stand.closed : 0);
      cell.current = active ? stand.closed * 0.6 : 0;
      if (active) {
        needle = followVoltage(needle, meterVoltage(shown.life, stand.closed), dt);
        stand.charge = 1 - shown.life;
        gauge.value = needle;
      }
    },
  };
}
