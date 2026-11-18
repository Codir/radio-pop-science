/**
 * `battery/inside` — «Дві речовини». The camera comes to the battery (`battery` shot), the lens goes home. The dock
 * slider «Розріз» IS the cut (UI_API §3.3: a drag follows the thumb, a click eases). With the section open the reader
 * touches the zinc, the separator with paste and the manganese oxide (one name at a time, on the layer). Once all
 * three are touched the «first moment» plays: the pole scale appears above the minus cap and falls to «порівну»,
 * then the battery fills its poles itself (`cell.hold`) — the reaction flashes at the zinc front, thinning out as
 * the scale climbs to its mark. Goal: cut at the end, three layers touched, the scale back on the mark.
 */
import { Vector3 } from 'three';
import type { BatteryLayer } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { besideOnScreen } from '../world';

/** The three layers the script names, with their caption index in `inside`. */
const LAYERS: readonly [BatteryLayer, number][] = [
  ['zinc', 1],
  ['separator', 2],
  ['cathode', 3],
];
/** The section counts as open from here (the thumb at the end). */
const OPEN = 0.97;

type Phase = 'idle' | 'wait' | 'drop' | 'fill' | 'done';

export const insideStep: StepFactory = ({ ctx, ui, world: bw, reached, reach }) => {
  const { cell, cut, scale, lens } = bw;
  const here = (): boolean => ctx.stage.current === 'inside';
  const touched = new Set<BatteryLayer>();
  let hovered: BatteryLayer | null = null;
  let named: BatteryLayer | null = null;
  let phase: Phase = 'idle';
  let clock = 0;
  let from = 0;
  let told = -1;
  /** Names on the layers: while the reader touches them, and a moment after the last one. */
  const naming = (): boolean => phase === 'idle' || phase === 'wait';

  for (const [id] of LAYERS) {
    ctx.input.register(cell.layers[id].pick, {
      cursor: 'pointer',
      enabled: () => here() && cell.cut > 0.6 && phase === 'idle',
      hover: (over) => {
        hovered = over ? id : hovered === id ? null : hovered;
      },
      click: () => {
        touched.add(id);
        named = id;
      },
    });
  }
  const minusAt = new Vector3();
  const scaleAt = new Vector3();
  ctx.qa.expose('inside', () => ({ touched: [...touched], phase, cut: cut.shown, named }));
  for (const [id] of LAYERS)
    ctx.qa.probe(`layer-${id}`, () => cell.layers[id].anchor.getWorldPosition(new Vector3()));

  return {
    spec: { ...bw.state('cut'), cameraMove: { duration: 1.9 } },
    ui: {
      goal: () => reached('inside'),
      controls: [
        {
          type: 'slider',
          id: 'cut',
          label: caption('inside', 0),
          min: 0,
          max: 1,
          value: 0,
          format: () => '',
          onChange: (v: number) => (cut.target = v),
          onInput: (_v: number, how: string) => (cut.drag = how === 'drag'),
        },
      ],
      callouts: LAYERS.map(([id, i]) => ({
        anchor: cell.layers[id].anchor,
        text: caption('inside', i),
        visible: () => here() && cell.cut > 0.6 && naming() && (hovered ?? named) === id,
      })),
    },
    enter(info) {
      lens.goTo('holder');
      bw.metal.active = false;
      ctx.stage.setParam('window', 0, { instant: true });
      touched.clear();
      hovered = named = null;
      told = -1;
      if (reached('inside')) {
        phase = 'done';
        cell.hold = true;
      } else {
        phase = 'idle';
        cell.hold = false;
        cell.surplus = cell.lack = cell.mark;
      }
      if (info.instant) {
        cut.target = 0;
        cell.surplus = cell.lack = cell.mark;
      }
      ui.set('cut', cut.target);
      cut.tau = 0.3;
    },
    leave() {
      cell.highlight = null;
      cut.drag = false;
    },
    update(dt) {
      if (!here()) return;
      if (Math.abs(cut.shown - told) > 0.002) ui.patch('cut', { current: (told = cut.shown) });
      cell.highlight = naming() && cell.cut > 0.6 ? (hovered ?? named) : null;
      const open = cut.shown >= OPEN;
      if (phase === 'idle' && open && touched.size === LAYERS.length) {
        phase = 'wait';
        clock = 0;
      }
      clock += dt;
      if (phase === 'wait' && clock > 1.6) {
        // the first moment: the scale shows the minus as it is, then falls to «порівну»
        phase = 'drop';
        clock = 0;
        from = cell.surplus;
      }
      if (phase === 'drop') {
        const k = Math.min(clock / 1.1, 1);
        cell.surplus = cell.lack = from * (1 - k * k * (3 - 2 * k));
        if (k >= 1) {
          phase = 'fill';
          cell.hold = true;
        }
      }
      if (phase === 'fill' && cell.surplus >= cell.mark * 0.97) {
        phase = 'done';
        reach('inside');
      }
      // the scale above the minus cap, from the first moment on
      cell.anchors.minusCap.getWorldPosition(minusAt);
      scale.mark = cell.mark;
      scale.names = [false, true, true];
      scale.low = -0.25;
      scale.level = cell.surplus;
      scale.shown = phase === 'idle' ? 0 : 1;
      // below the minus cap (the clump is pulled upward in `balance`; above it the phone's header would cut it)
      scale.place(besideOnScreen(ctx, minusAt, 0.02, -0.4, scaleAt), ctx.camera.camera, [-1, 1]);
    },
  };
};
