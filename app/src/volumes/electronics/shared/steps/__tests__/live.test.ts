/**
 * The steps' pieces on a live bench (`createStepStand` over a stub context with the engine's `CameraDirector`, no
 * WebGL): the knob of a pot in the panel (`knob.ts`: the model's setting from the slider, the knob on the board
 * following), the dock's «Нові деталі» (`fresh.ts`: shown only while something is burnt or bulged, the step's board
 * whole again on a press) and the callouts' points on a part's body (`callouts.ts`: the point on the part toward the
 * camera, and the part a ray through it meets first — on the amplifier from the shot `meter`, the LED «on» before its
 * resistor R1, the driver's load R5 and the reservoir C3 each its own); and a part's print on a phone, hidden on the
 * step's shot and read down at the part on the dive's floor `part` (the bench's `PartEye.close`, VISUAL §9's
 * exception).
 */
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fmtPercent } from '@/content/format';
import type { StepInfo } from '@/engine/api';
import { setFontData, type FontJson, type Text3D } from '@/text';
import { AMPLIFIER_PRESET, type PresetPart } from '@electronics/sim/board';
import { knobAngle, type PotModel } from '../../parts';
import { createStepStand, type StepStand } from '../stand';
import { knobSlider } from '../knob';
import { FRESH_ID, damaged, freshButton } from '../fresh';
import { firstUnder, onBody } from '../callouts';
import { stubContext } from './context';

const DT = 1 / 60;

function live(parts: readonly PresetPart[], leads?: Record<string, string>, form: 'desktop' | 'phone' = 'desktop') {
  const s = stubContext(form);
  const stand = createStepStand(s.ctx);
  stand.board(parts, leads as never);
  stand.snap();
  const t = { now: 0 };
  const frames = (n: number, until?: () => boolean): void => {
    for (let i = 0; i < n && !until?.(); i++) {
      t.now += DT;
      stand.update(DT, t.now);
    }
  };
  return { ...s, stand, bench: stand.bench, frames };
}

describe('the knob in the panel', () => {
  it('sets the pot’s setting from the slider, and the knob on the board follows it; off while the camera flies', () => {
    const { bench, frames } = live([{ id: 'P1', spec: 'pot-10k', at: 'b5', setting: 0.5 }]);
    const marks = [
      { value: 0, label: 'low' },
      { value: 1, label: 'high' },
    ];
    const s = knobSlider(bench, 'volume', 'P1', 'volume', marks, 0.1);
    expect(s).toMatchObject({ type: 'slider', id: 'volume', label: 'volume', min: 0, max: 1, value: 0.1 });
    expect(s.marks).toEqual(marks);
    expect(s.step).toBe(0.01);
    expect(s.format?.(0.25)).toBe(fmtPercent(0.25));
    const pot = bench.parts.models.get('P1') as PotModel;
    expect(pot.knob.rotation.y).toBeCloseTo(knobAngle(0.5), 6);
    // a drag: the model's setting at once, the knob within a few frames
    s.onInput?.(0.2, 'drag');
    expect(bench.state.settings.get('P1')).toBe(0.2);
    frames(30);
    expect(pot.knob.rotation.y).toBeCloseTo(knobAngle(0.2), 3);
    // a click or a key: the same
    s.onChange?.(0.9);
    expect(bench.state.settings.get('P1')).toBe(0.9);
    frames(30);
    expect(pot.knob.rotation.y).toBeCloseTo(knobAngle(0.9), 3);
    // the model solves the new setting: the wiper's row moves with it
    expect((s.disabled as () => boolean)()).toBe(false);
    bench.flying = true;
    expect((s.disabled as () => boolean)()).toBe(true);
  });
});

/** + rail → jumper → 9ae → 100 Ω across the channel → 9fj → jumper → − rail: 0.786 W on a 0.25 W part. */
const OVERLOAD: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+9', to: 'a9' },
  { id: 'R1', spec: 'resistor-100', at: 'b9', o: 1 },
  { id: 'J2', spec: 'jumper', at: 'j9', to: '-9' },
];
/** A 100 μF on 6,3 V the wrong way round straight on the battery: the model bulges it after ≈ 1,2 s. */
const REVERSED: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
  { id: 'C1', spec: 'electrolytic-100u-6v3', at: 'c4', o: 2 },
  { id: 'J2', spec: 'jumper', at: 'e4', to: '-4' },
];

describe('«Нові деталі» in the dock', () => {
  it('shows only while a part burnt, on the step’s own screen, and a press puts the step’s board back whole', () => {
    const { bench, frames } = live(OVERLOAD);
    bench.closed = 1;
    let here = true;
    let pressed = 0;
    const b = freshButton(bench, 'fresh', () => here, () => {
      pressed++;
      bench.preset(OVERLOAD);
      bench.closed = 0;
    });
    expect(b).toMatchObject({ type: 'button', id: FRESH_ID, label: 'fresh' });
    const visible = b.visible as () => boolean;
    frames(1);
    // hot at once by its load, not burnt yet: no button
    expect(bench.model.part('R1')?.condition).toBe('hot');
    expect(damaged(bench)).toBe(false);
    expect(visible()).toBe(false);
    frames(600, () => bench.model.part('R1')?.condition === 'burnt');
    expect(bench.model.part('R1')?.condition).toBe('burnt');
    expect(damaged(bench)).toBe(true);
    expect(visible()).toBe(true);
    here = false;
    expect(visible()).toBe(false);
    here = true;
    b.onClick();
    expect(pressed).toBe(1);
    frames(1);
    expect(bench.model.part('R1')?.condition).toBe('ok');
    expect(visible()).toBe(false);
  });

  it('shows while a can is bulged too, and while a thing of the bench (the lamp) is burnt', () => {
    const can = live(REVERSED);
    can.bench.closed = 1;
    can.frames(600, () => can.bench.model.part('C1')?.condition === 'bulged');
    expect(can.bench.model.part('C1')?.condition).toBe('bulged');
    expect(damaged(can.bench)).toBe(true);
    const lamp = live([], { lamp1: '+1', lamp2: '-1' });
    lamp.bench.closed = 1;
    lamp.frames(600, () => lamp.bench.model.part('LAMP')?.condition === 'burnt');
    expect(lamp.bench.model.part('LAMP')?.condition).toBe('burnt');
    expect(damaged(lamp.bench)).toBe(true);
  });
});

describe('the callouts’ points on a part', () => {
  function onMeterShot(): ReturnType<typeof live> & { stand: StepStand } {
    const l = live(AMPLIFIER_PRESET.parts, AMPLIFIER_PRESET.leads);
    l.camera.go('meter', { instant: true });
    l.frames(1);
    l.camera.camera.updateMatrixWorld(true);
    return l;
  }

  it('puts the point on the part’s body toward the camera, so a ray through it meets that part first', () => {
    const { ctx, bench } = onMeterShot();
    for (const id of ['LED1', 'R1', 'R5', 'C3']) {
      const p = onBody(ctx, bench, id)();
      expect(firstUnder(ctx, bench, p), id).toBe(id);
      // on the body: within its box (a little beyond, toward the camera, by half its thinner side at most)
      const box = new Box3().setFromObject(bench.parts.models.get(id)!.hit).expandByScalar(0.3);
      expect(box.containsPoint(p), id).toBe(true);
    }
  });

  it('is far below the bench for a part that is not there; a point over nothing meets no part', () => {
    const { ctx, bench } = onMeterShot();
    expect(onBody(ctx, bench, 'R99')().y).toBeLessThan(-50);
    expect(firstUnder(ctx, bench, new Vector3(0, -100, 0))).toBeNull();
  });
});

describe('a part’s print on a phone, down at the part', () => {
  it('is hidden on the step’s shot and shown on the dive’s floor `part` where it reads (the bench’s eye is `close`)', () => {
    const fonts = new URL('../../../../../../public/fonts/fonts.json', import.meta.url);
    setFontData(JSON.parse(readFileSync(fonts, 'utf8')) as FontJson);
    // the ceramic disc of `capacitor-kinds/ceramic` alone on the board, its code «104» toward the reader
    const { bench, stand, camera, frames } = live([{ id: 'C1', spec: 'ceramic-100n', at: 'e8' }], undefined, 'phone');
    camera.go('board', { instant: true });
    frames(2);
    const code = bench.parts.models.get('C1')!.group.getObjectByName('print:104') as Text3D;
    expect(code).toBeDefined();
    expect(code.visible).toBe(false);
    const door = stand.openDoor('C1', { from: null, instant: false, direction: 1, index: 0 } as unknown as StepInfo);
    frames(1);
    expect(door.ready).toBe(true);
    door.travelTo(0.75);
    frames(600, () => !door.rail.moving);
    frames(2);
    expect(door.floor).toBe('part');
    expect(bench.flying).toBe(true);
    expect(code.visible).toBe(true);
  });
});
