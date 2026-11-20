/**
 * `mountBench` with a stub context (no WebGL): the lamp's light rig is placed as its comment promises — the lamp light
 * at the filament, the shadowless bounce above the lamp's pool, every frame (light.ts `LightRig.bounce`); and what the
 * circuit model's state shows on the bench (E2-7) — the lamp lit by its filament's temperature, an LED by its current
 * with one of the board's three lights, an overloaded resistor warming, burning once and staying burnt (a new one «ok»
 * until it closes the circuit), the lamp burning out with no wisp, a short warming the battery's box; and the wisps a
 * chapter can only read.
 */
import { Group, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { nextId, put, remove, seatLead, seatLeg } from '@electronics/sim/board';
import { lampGlow, ledBrightness, type LedModel } from '../../parts';
import { BOARD, LAMP, PLACES, mountBench, worldToBoard, type PresetPart } from '..';

/** A chapter context with only what the bench uses at mount and per frame. */
function stubContext() {
  const root = new Group();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const ctx = {
    root,
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
    // the hand registers the parts, their grips, the tray's slots and the switch; nothing presses them here
    input: { register: () => () => {}, on: () => () => {} },
    device: { formFactor: 'desktop', hover: true },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
    quality: { count: (n: number) => n },
    random: { next, range: (a: number, b: number) => a + (b - a) * next() },
    env: {
      base: () => {},
      setScale: () => {},
      setShadow: () => {},
      tune: () => {},
      params: { keyIntensity: 0 },
    },
    post: { base: () => {} },
    camera: { shots: () => {}, camera: new PerspectiveCamera(27, 1920 / 1080, 0.1, 100) },
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
  return ctx;
}

describe('the lamp’s bounce light', () => {
  it('hangs above the lamp’s pool: over the face, between the lamp and the middle of the board', () => {
    const bench = mountBench(stubContext());
    // the lamp lit by the model: its plugs on the rails, the switch closed
    bench.preset([], { lamp1: '+1', lamp2: '-1' });
    bench.closed = 1;
    bench.snap();
    expect(bench.lamp).toBeGreaterThan(0.9);
    expect(bench.light.bounce.intensity).toBeGreaterThan(0);
    const lamp = new Vector3(LAMP.x, LAMP.glassY, LAMP.z);
    const at = worldToBoard(bench.light.bounce.position);
    // above the face and above the glass's top, not under the base (where an unplaced light sits: the world origin)
    expect(at.y).toBeGreaterThan(LAMP.glassY + LAMP.glass);
    expect(at.y).toBeLessThan(3);
    // over the face, not past its edges
    expect(Math.abs(at.x)).toBeLessThan(BOARD.width / 2);
    expect(Math.abs(at.z)).toBeLessThan(BOARD.depth / 2);
    // near the lamp, toward the middle of the board: in plan, nearer the board's middle than the lamp is
    const plan = (p: Vector3) => new Vector3(p.x, 0, p.z);
    const middle = new Vector3(PLACES.breadboard.x, 0, PLACES.breadboard.z);
    const away = plan(at).distanceTo(plan(lamp));
    expect(away).toBeGreaterThan(0.5);
    expect(away).toBeLessThan(2);
    expect(plan(at).distanceTo(middle)).toBeLessThan(plan(lamp).distanceTo(middle) - 0.5);
  });

  it('follows the filament every frame, lamp lit or dark', () => {
    const bench = mountBench(stubContext());
    const before = bench.light.bounce.position.clone();
    const filament = new Vector3();
    bench.props.filament.getWorldPosition(filament);
    expect(before.distanceTo(filament)).toBeGreaterThan(1);
    // move the lamp (as if its post were elsewhere): the bounce keeps its offset from the filament
    bench.props.filament.position.x += 0.5;
    bench.update(1 / 60, 1 / 60);
    expect(bench.light.bounce.position.x - before.x).toBeCloseTo(0.5, 9);
    expect(bench.light.bounce.position.y - before.y).toBeCloseTo(0, 9);
  });
});

/** Every light under the chapter's root (the lamp, its bounce, the LEDs' three). */
function lightsOf(root: Object3D): number {
  let n = 0;
  root.traverse((o) => void ((o as { isLight?: boolean }).isLight && n++));
  return n;
}

/** + rail → jumper → 9ae → 100 Ω across the channel → 9fj → jumper → − rail: 0.786 W on a 0.25 W part. */
const OVERLOAD: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+9', to: 'a9' },
  { id: 'R1', spec: 'resistor-100', at: 'b9', o: 1 },
  { id: 'J2', spec: 'jumper', at: 'j9', to: '-9' },
];

describe('the model’s state on the bench (VISUAL §1 principle 3, §4.4, §4.6, §4.8)', () => {
  it('the lamp burns as the model says: dark out of the circuit, its filament’s place on the scale in it', () => {
    const ctx = stubContext();
    const bench = mountBench(ctx);
    expect(bench.lamp).toBe(0);
    expect(bench.light.lamp.intensity).toBe(0);
    // + rail → 15 Ω → 15 Ω → the lamp → − rail (VISUAL §4.6): ≈ 5.9 V on it, ≈ 1 875 °C
    bench.preset(
      [
        { id: 'R1', spec: 'resistor-15', at: 'b3', o: 1 },
        { id: 'R2', spec: 'resistor-15', at: 'g3' },
        { id: 'J1', spec: 'jumper', at: 'j7', to: '-7' },
      ],
      { lamp1: '+2', lamp2: 'a3' },
    );
    bench.closed = 1;
    bench.snap();
    const lamp = bench.model.part('LAMP')!;
    expect(lamp.condition).toBe('warm');
    expect(bench.lamp).toBeCloseTo(lampGlow(lamp.kelvin), 12);
    expect(lamp.kelvin! - 273.15).toBeGreaterThan(1850);
    expect(lamp.kelvin! - 273.15).toBeLessThan(1900);
    expect(bench.light.lamp.intensity).toBeGreaterThan(0);
    // the switch opens: the model's filament is cold, the lamp goes dark with its inertia
    bench.closed = 0;
    for (let i = 0; i < 60; i++) bench.update(1 / 60, i / 60);
    expect(bench.lamp).toBe(0);
    expect(bench.light.output).toBeLessThan(1e-3);
  });

  it('an LED lights by the model’s current: its glow and halo, and one of the three lights of the board', () => {
    const ctx = stubContext();
    const bench = mountBench(ctx);
    const lights = lightsOf(ctx.root);
    expect(bench.leds.lights.every((l) => l.intensity === 0)).toBe(true);
    // + rail → jumper → 3ae → 330 Ω across the channel → 3fj → the red LED → 4fj → jumper → − rail
    bench.preset([
      { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
      { id: 'R1', spec: 'resistor-330', at: 'b3', o: 1 },
      { id: 'LED1', spec: 'led-red', at: 'g3' },
      { id: 'J2', spec: 'jumper', at: 'j4', to: '-4' },
    ]);
    bench.closed = 1;
    bench.update(1 / 60, 1 / 60);
    const i = bench.model.reading('LED1')!.i;
    expect(i).toBeCloseTo(0.02124, 4);
    const led = bench.parts.models.get('LED1') as LedModel;
    expect(led.glow.visible).toBe(true);
    expect(led.halo.visible).toBe(true);
    expect(led.glowMaterial.intensity).toBeCloseTo(1.8 * ledBrightness('led-red', i), 12);
    expect(bench.leds.lit).toEqual(['LED1']);
    expect(bench.leds.lights[0]!.intensity).toBeGreaterThan(0);
    // its resistor is warm (0.149 W of 0.25 W), never more
    expect(bench.model.part('R1')!.condition).toBe('warm');
    // the switch opens: no current, no light, the lights stay where they are
    bench.closed = 0;
    bench.update(1 / 60, 2 / 60);
    expect(led.glow.visible).toBe(false);
    expect(bench.leds.lit).toEqual([]);
    expect(lightsOf(ctx.root)).toBe(lights);
  });

  it('an overloaded resistor warms, burns once with one wisp, stays burnt; a new one from the tray is «ok», then hot', () => {
    const ctx = stubContext();
    const bench = mountBench(ctx);
    const lights = lightsOf(ctx.root);
    bench.preset(OVERLOAD);
    bench.closed = 1;
    bench.snap();
    const r1 = bench.parts.models.get('R1')!;
    expect(bench.model.part('R1')!.condition).toBe('hot');
    expect(r1.surface.tint).toBe(0); // cold yet: hot by its load, not by its heat
    // frames of 1/60 s; a held frame (dt 0) now and then changes nothing
    let t = 0;
    let warm = 0;
    while (bench.model.part('R1')!.condition !== 'burnt' && t < 10) {
      bench.update(1 / 60, (t += 1 / 60));
      if (Math.round(t * 60) % 30 === 0) {
        const heat = bench.model.part('R1')!.heat;
        bench.update(0, t);
        expect(bench.model.part('R1')!.heat).toBe(heat);
      }
      if (warm === 0 && r1.surface.tint > 0) warm = t;
    }
    // the tint came as the heat passed half the limit (τ·ln(L / (L − 0.5)) ≈ 1.7 s), the burn at ≈ 3.83 s
    expect(warm).toBeGreaterThan(1.6);
    expect(warm).toBeLessThan(1.8);
    expect(t).toBeGreaterThan(3.82);
    expect(t).toBeLessThan(3.86);
    expect(bench.smoke.fired).toBe(1);
    expect(bench.smoke.active).toBe(1);
    expect(r1.group.getObjectByName('resistor-100:burnt')!.visible).toBe(true);
    expect(r1.surface.char).toBe(0.75);
    expect(bench.model.reading('R1')!.i).toBe(0);
    // the wisp goes within 1.2 s; nothing more is let out; no light was added or taken away
    for (let i = 0; i < 90; i++) bench.update(1 / 60, (t += 1 / 60));
    expect(bench.smoke.active).toBe(0);
    expect(bench.smoke.fired).toBe(1);
    expect(r1.surface.tint).toBe(0);
    expect(lightsOf(ctx.root)).toBe(lights);
    // into the tray for good, and a new 100 Ω from it as the hand gives it: a new id, set down leg by leg
    const legs = [...bench.state.parts.get('R1')!.legs];
    remove(bench.state, 'R1');
    const id = nextId(bench.state, 'R');
    expect(id).not.toBe('R1');
    // leg 0 in b9, leg 1 still in the air: out of the circuit — «ok», cold, no current, whole to the eye
    expect(put(bench.layout, bench.state, { id, spec: 'resistor-100', legs: [legs[0]!, null] })).toBe(true);
    bench.update(1 / 60, (t += 1 / 60));
    expect(bench.model.part(id)).toEqual({ condition: 'ok', load: 0, heat: 0 });
    expect(bench.model.reading(id)).toBeNull();
    const r2 = bench.parts.models.get(id)!;
    expect(r2.group.getObjectByName('resistor-100:burnt')!.visible).toBe(false);
    expect(r2.surface).toMatchObject({ tint: 0, scorch: 0, char: 0 });
    // leg 1 in: the circuit closes, and the new one is hot by its load at once, still cold and whole to the eye
    expect(seatLeg(bench.layout, bench.state, id, 1, legs[1]!)).toBe(true);
    bench.update(1 / 60, t + 1 / 60);
    expect(bench.model.part(id)).toMatchObject({ condition: 'hot' });
    expect(bench.model.part(id)!.heat).toBeLessThan(0.01);
    expect(r2.group.getObjectByName('resistor-100:burnt')!.visible).toBe(false);
    expect(r2.surface).toMatchObject({ tint: 0, char: 0 });
    // the wisp of R1 was the only one: the new part's being set down lets none out
    expect(bench.smoke.fired).toBe(1);
  });

  it('gives a chapter no way to let a wisp out: `smoke` is what is in the air, read-only', () => {
    const bench = mountBench(stubContext());
    expect(Object.keys(bench.smoke).sort()).toEqual(['active', 'fired']);
    expect('puff' in bench.smoke).toBe(false);
    expect(bench.smoke).toMatchObject({ active: 0, fired: 0 });
  });

  it('the lamp burns out on the bare battery with no wisp and stays so; a step’s preset starts the fixed things whole', () => {
    const ctx = stubContext();
    const bench = mountBench(ctx);
    bench.preset([], { lamp1: '+1', lamp2: '-1' });
    bench.closed = 1;
    let t = 0;
    // 1.08 W of its 0.7 W: E1-4 burns it after ≈ 2.1 s
    while (bench.model.part('LAMP')!.condition !== 'burnt' && t < 5) bench.update(1 / 60, (t += 1 / 60));
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(2.3);
    expect(bench.props.bulb.burnt).toBe(true);
    // no wisp: the filament breaks inside the sealed glass, nothing leaves the bulb (VISUAL §4.8)
    expect(bench.smoke.fired).toBe(0);
    expect(bench.smoke.active).toBe(0);
    for (let i = 0; i < 30; i++) bench.update(1 / 60, (t += 1 / 60));
    expect(bench.smoke.fired).toBe(0);
    expect(bench.lamp).toBe(0);
    // a plug out and in again by the hand: still burnt (the same lamp), dark
    expect(seatLead(bench.layout, bench.state, 'lamp2', null)).toBe(true);
    bench.update(1 / 60, (t += 1 / 60));
    expect(bench.model.part('LAMP')!.condition).toBe('burnt');
    expect(seatLead(bench.layout, bench.state, 'lamp2', '-1')).toBe(true);
    bench.update(1 / 60, (t += 1 / 60));
    expect(bench.model.part('LAMP')!.condition).toBe('burnt');
    expect(bench.props.bulb.burnt).toBe(true);
    expect(bench.lamp).toBe(0);
    // a step's preset is the step's own bench: the lamp it puts in is whole and lights again
    bench.preset([], { lamp1: '+1', lamp2: '-1' });
    bench.update(1 / 60, t + 1 / 60);
    expect(bench.model.part('LAMP')!.condition).toBe('hot');
    expect(bench.props.bulb.burnt).toBe(false);
    expect(bench.lamp).toBeGreaterThan(0.9);
  });

  it('a short warms the battery’s box by the tint, no more; the battery never burns', () => {
    const ctx = stubContext();
    const bench = mountBench(ctx);
    bench.preset([{ id: 'J1', spec: 'jumper', at: '+5', to: '-5' }]);
    bench.closed = 1;
    for (let i = 0; i < 600; i++) bench.update(1 / 15, i / 15);
    const bat = bench.model.part('BAT')!;
    expect(bat.condition).toBe('hot');
    expect(bat.heat).toBeGreaterThan(1);
    expect(bench.props.things.battery.surface).toMatchObject({ t: 1, scorch: 0, char: 0 });
    expect(bench.props.things.battery.surface.tint).toBeCloseTo(0.3, 12);
  });
});
