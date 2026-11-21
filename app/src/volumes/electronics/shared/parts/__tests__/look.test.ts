/**
 * The look of the model's state (`look.ts`, docs/volumes/electronics/VISUAL.md §4.4, §4.6, §4.8): pure maps from what
 * the circuit model says — heat, condition, an LED's current, a filament's temperature — to what the part shows, each
 * monotone; the heat a colour of the surface only, never light; the marks of a burnt part; the bulged electrolytic as a
 * look under its state's name.
 */
import { Color, Vector4, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { col, heatRamp, type KToonMaterial } from '@/style';
import { PARTS, ROOM_KELVIN, ledLumens, type LedSpec } from '@electronics/sim/core';
import {
  HEAT_LOOK,
  KIND_LOOK,
  LED_DARK,
  LED_FULL_LUMENS,
  SCORCH,
  createBulb,
  createElectrolytic,
  createSpeaker,
  createLed,
  createResistor,
  heatShare,
  kindLook,
  lampGlow,
  ledBrightness,
  mixOf,
  surfaceOf,
  type PartStatus,
} from '..';

const CONDITIONS: readonly PartStatus[] = ['ok', 'warm', 'hot'];
const HEATS = Array.from({ length: 61 }, (_, i) => i / 40); // 0 … 1.5

/** Non-decreasing along the list (a hair of rounding allowed). */
function rising(values: readonly number[], what: string): void {
  for (let i = 1; i < values.length; i++)
    expect(values[i]!, what).toBeGreaterThanOrEqual(values[i - 1]! - 1e-12);
}

/** The surface's mixes one after the other: the heat tint, the scorch, the char (VISUAL §4.8). */
function inTurn(base: Color, s: ReturnType<typeof surfaceOf>): Color {
  return base.clone().lerp(heatRamp(s.t), s.tint).lerp(SCORCH, s.scorch).lerp(col('ink'), s.char);
}

describe('heat on the surface (VISUAL §4.8)', () => {
  it('t = min(1, max(0, (h − 0.5) / 0.5)): none up to half the limit, full at the limit and beyond (a shorted battery)', () => {
    expect(heatShare(0)).toBe(0);
    expect(heatShare(0.5)).toBe(0);
    expect(heatShare(0.75)).toBeCloseTo(0.5, 12);
    expect(heatShare(1)).toBe(1);
    expect(heatShare(6)).toBe(1);
    expect(heatShare(Number.NaN)).toBe(0);
    rising(HEATS.map(heatShare), 'heatShare');
  });

  it('the tint is 0.3 · t of heatRamp(t); a hot body scorches toward wireBrown·ink up to 30 % with t; ok and warm do not', () => {
    for (const status of CONDITIONS) {
      const looks = HEATS.map((h) => surfaceOf(h, status));
      rising(
        looks.map((s) => s.tint),
        `${status}: tint`,
      );
      rising(
        looks.map((s) => s.scorch),
        `${status}: scorch`,
      );
      for (const [i, s] of looks.entries()) {
        const t = heatShare(HEATS[i]!);
        expect(s.t).toBeCloseTo(t, 12);
        expect(s.tint).toBeCloseTo(HEAT_LOOK.tint * t, 12);
        expect(s.scorch).toBeCloseTo(status === 'hot' ? HEAT_LOOK.scorch * t : 0, 12);
        expect(s.char).toBe(0);
      }
    }
    expect(HEAT_LOOK).toMatchObject({ from: 0.5, tint: 0.3, scorch: 0.3, char: 0.75, fade: 1 });
    expect(SCORCH.equals(col('wireBrown').lerp(col('ink'), 0.5))).toBe(true);
  });

  it('a burnt body is charred, mix(body, ink, 0.75) (an LED’s dome 0.6), and its heat tint goes within 1 s', () => {
    const resistor = kindLook('resistor-100');
    const led = kindLook('led-red');
    const fading = [0, 0.25, 0.5, 0.99, 1, 2, Infinity].map((s) => surfaceOf(1, 'burnt', s, resistor));
    expect(fading[0]!.tint).toBeCloseTo(HEAT_LOOK.tint, 12);
    for (let i = 1; i < fading.length; i++) expect(fading[i]!.tint).toBeLessThanOrEqual(fading[i - 1]!.tint);
    expect(fading[4]!.tint).toBe(0);
    for (const s of fading) {
      expect(s.char).toBe(0.75);
      expect(s.scorch).toBe(0);
    }
    expect(surfaceOf(1, 'burnt', 5, led).char).toBe(0.6);
    // after the fade, exactly the char of VISUAL: mix(body, ink, 0.75)
    const body = col('mist');
    const m = mixOf(surfaceOf(1, 'burnt', 5, resistor), new Vector4());
    const shown = body.clone().lerp(new Color(m.x, m.y, m.z), m.w);
    const want = body.clone().lerp(col('ink'), 0.75);
    expect(shown.r).toBeCloseTo(want.r, 9);
    expect(shown.g).toBeCloseTo(want.g, 9);
    expect(shown.b).toBeCloseTo(want.b, 9);
  });

  it('a battery and a speaker are tinted but never scorched or charred; the lamp’s heat is its filament', () => {
    expect(KIND_LOOK.battery).toMatchObject({ scorch: false, char: 0 });
    expect(KIND_LOOK.speaker).toMatchObject({ scorch: false, char: 0 });
    const shorted = surfaceOf(6, 'hot', Infinity, kindLook('battery-9v'));
    expect(shorted).toMatchObject({ t: 1, tint: HEAT_LOOK.tint, scorch: 0, char: 0 });
    expect(kindLook('resistor-1k')).toBe(KIND_LOOK.resistor);
    expect(kindLook('no-such-part')).toMatchObject({ scorch: true, char: 0.75 });
  });

  it('one mix stands for the three in turn, for any colour of the body', () => {
    const out = new Vector4();
    for (const body of [col('mist'), col('ink'), col('red'), new Color(0.6, 0.4, 0.2)]) {
      for (const s of [
        surfaceOf(0.2, 'ok'),
        surfaceOf(0.8, 'warm'),
        surfaceOf(0.95, 'hot'),
        surfaceOf(1, 'burnt', 0.3),
        surfaceOf(1, 'burnt', 3),
      ]) {
        mixOf(s, out);
        const once = body.clone().lerp(new Color(out.x, out.y, out.z), out.w);
        const want = inTurn(body, s);
        expect(once.r).toBeCloseTo(want.r, 9);
        expect(once.g).toBeCloseTo(want.g, 9);
        expect(once.b).toBeCloseTo(want.b, 9);
      }
    }
    expect(mixOf(surfaceOf(0, 'ok'), out).w).toBe(0);
  });
});

describe('the light of the model (VISUAL §4.4, §4.6)', () => {
  it('an LED’s b = min(1, (Φ / Φ₀)^(1/3)), Φ₀ the red one’s flux at 20 mA; dark below 0.02 and the wrong way round', () => {
    expect(LED_FULL_LUMENS).toBeCloseTo(ledLumens(PARTS['led-red'] as LedSpec, 0.02), 6);
    expect(ledBrightness('led-red', 0.02)).toBeCloseTo(1, 3);
    expect(ledBrightness('led-red', 0.001)).toBeCloseTo(0.368, 3);
    // blue and white reach full near 1 mA: the model says they are 20–30 times brighter
    expect(ledBrightness('led-blue', 0.001)).toBe(1);
    expect(ledBrightness('led-white', 0.001)).toBeGreaterThan(0.99);
    expect(ledBrightness('led-white', 0.0011)).toBe(1);
    expect(ledBrightness('led-red', 0)).toBe(0);
    expect(ledBrightness('led-red', -0.01)).toBe(0);
    expect(ledBrightness('led-red', Number.NaN)).toBe(0);
    // b < 0.02: no light at all
    const dim = ((LED_DARK * 0.99) ** 3 * LED_FULL_LUMENS) / (PARTS['led-red'] as LedSpec).lumensPerAmp;
    expect(ledBrightness('led-red', dim)).toBe(0);
    expect(ledBrightness('resistor-1k', 0.02)).toBe(0);
    for (const key of ['led-red', 'led-yellow', 'led-green', 'led-blue', 'led-white']) {
      rising(
        Array.from({ length: 80 }, (_, i) => ledBrightness(key, (i / 80) * 0.04)),
        key,
      );
    }
  });

  it('the lamp’s glow is the incandescence scale at the model’s filament temperature: 6 V pale yellow, 3 V amber', () => {
    // cold (the model's room, 27 °C) or unknown: dark
    expect(lampGlow(undefined)).toBe(0);
    expect(lampGlow(ROOM_KELVIN)).toBe(0);
    expect(lampGlow(Number.NaN)).toBe(0);
    // 6 V: 2163 K ≈ 1 890 °C (VISUAL §4.6) — between yellow.light (0.84, 1 850 °C) and white
    expect(lampGlow(2163)).toBeGreaterThan(0.84);
    expect(lampGlow(2163)).toBeLessThan(0.9);
    // 3 V: 1658 K ≈ 1 385 °C — amber (0.66 at 1 400 °C)
    expect(lampGlow(1658)).toBeCloseTo(0.651, 2);
    rising(
      Array.from({ length: 60 }, (_, i) => lampGlow(300 + i * 45)),
      'lampGlow',
    );
  });
});

/** The marks a burnt part shows (VISUAL §4.8): named `<key>:burnt`, hidden until it burnt. */
const marks = (root: Object3D): Object3D | undefined => root.getObjectByName(`${root.name}:burnt`);

describe('the hook of the model’s state on a part', () => {
  it('heat colours the body’s surface and never lights it: no emissive at any heat; the bands keep their colour', () => {
    const r = createResistor(100, 0.05, 'resistor-100');
    for (const heat of [0, 0.6, 0.9, 1]) {
      r.setLook({ heat, status: heat > 0.95 ? 'hot' : 'warm', load: 3.14 }, 1 / 60);
      for (const m of r.body) expect(m.emissiveIntensity).toBe(0);
    }
    const body = r.body[0]! as KToonMaterial;
    const mixed = body.uniforms.uKHeat!.value as Vector4;
    expect(mixed.w).toBeGreaterThan(0.3);
    expect(body.fragmentShader).toContain('uKHeat');
    // the bands are not the body: they take no heat, so the value reads on a hot part…
    const bands = r.materials.filter((m) => !r.body.includes(m) && m.uniforms.uKHeat && m !== r.materials[0]);
    const share = (m: KToonMaterial) => (m.uniforms.uKHeat!.value as Vector4).w;
    const painted = r.group.getObjectByName('resistor-100:toon')!;
    const band = (painted as Mesh).material as KToonMaterial;
    expect(bands).toContain(band);
    expect(share(band)).toBe(0);
    // …and char with the body when it burnt: barely seen then
    r.setLook({ heat: 1, status: 'burnt' }, 1 / 60);
    expect(share(band)).toBe(HEAT_LOOK.char);
  });

  it('a burnt resistor shows its charred belt and crack, a burnt LED its dark spot; neither before', () => {
    const r = createResistor(100, 0.05, 'resistor-100');
    const belt = marks(r.group)!;
    expect(belt).toBeDefined();
    r.setLook({ heat: 0.99, status: 'hot' }, 1 / 60);
    expect(belt.visible).toBe(false);
    r.setLook({ heat: 1, status: 'burnt' }, 1 / 60);
    expect(belt.visible).toBe(true);
    // the mark of a burnt part never glows: a lit K material
    belt.traverse((o) => {
      const m = (o as Mesh).material as KToonMaterial | undefined;
      if (m) expect(m.emissiveIntensity ?? 0).toBe(0);
    });

    const led = createLed('red');
    const spot = marks(led.group)!;
    led.setLook({ light: 1, status: 'warm', heat: 0.7 }, 1 / 60);
    expect(spot.visible).toBe(false);
    led.setLook({ light: 0, status: 'burnt', heat: 1 }, 1 / 60);
    expect(spot.visible).toBe(true);
    expect(led.glow.visible).toBe(false);
    expect(led.halo.visible).toBe(false);
  });

  it('an LED’s halo follows its brightness: radius 0.6, opacity 0.5 · b, none below 0.02', () => {
    const led = createLed('green');
    led.setLook({ light: 0 }, 0);
    expect(led.halo.visible).toBe(false);
    led.setLook({ light: 1 }, 1 / 60);
    expect(led.halo.visible).toBe(true);
    expect(led.haloSize).toBeCloseTo(1.2, 9);
    expect(led.haloPower).toBeCloseTo(0.5, 9);
    led.setLook({ light: 0.4 }, 1 / 15);
    expect(led.haloPower).toBeCloseTo(0.2, 9);
  });

  it('the heat tint fades within 1 s of the burn whatever the frames: dt 0 holds it, dt 1/15 runs it', () => {
    const r = createResistor(100, 0.05, 'resistor-100');
    const shown = () => ((r.body[0]! as KToonMaterial).uniforms.uKHeat!.value as Vector4).clone();
    r.setLook({ heat: 1, status: 'hot', load: 3 }, 1 / 60);
    r.setLook({ heat: 1, status: 'burnt' }, 1 / 60);
    const first = shown();
    r.setLook({ heat: 1, status: 'burnt' }, 0);
    expect(shown().equals(first)).toBe(true);
    for (let i = 0; i < 15; i++) r.setLook({ heat: 1, status: 'burnt' }, 1 / 15);
    const done = shown();
    const want = mixOf(surfaceOf(1, 'burnt', Infinity, kindLook('resistor-100')), new Vector4());
    expect(done.sub(want).length()).toBeLessThan(1e-9);
  });

  it('a burnt speaker shows a dark ring on its cone and nothing charred; a burnt lamp a broken coil and a grey top', () => {
    const speaker = createSpeaker();
    const ring = speaker.group.getObjectByName('speaker:burnt')!;
    speaker.setLook({ heat: 0.9, status: 'hot', load: 3.6 }, 1 / 60);
    expect(ring.visible).toBe(false);
    expect(speaker.surface.scorch).toBe(0);
    expect(speaker.surface.tint).toBeGreaterThan(0);
    speaker.setLook({ heat: 1, status: 'burnt' }, 1 / 60);
    expect(ring.visible).toBe(true);
    expect(speaker.surface.char).toBe(0);

    const bulb = createBulb();
    const coil = bulb.coil.geometry;
    const soot = bulb.group.getObjectByName('bulb:burnt')!;
    expect(soot.visible).toBe(false);
    bulb.setBurnt(true);
    expect(bulb.burnt).toBe(true);
    expect(bulb.coil.geometry).not.toBe(coil);
    expect(soot.visible).toBe(true);
    // the coil is broken: two stretches, a gap in the middle of the span
    const pos = bulb.coil.geometry.getAttribute('position');
    const xs = Array.from({ length: pos.count }, (_, i) => pos.getX(i));
    expect(xs.some((x) => Math.abs(x) < 0.005)).toBe(false);
    bulb.setBurnt(false);
    expect(bulb.coil.geometry).toBe(coil);
    expect(soot.visible).toBe(false);
  });

  it('a bulged electrolytic shows its bulged top and opened vent under the state’s name, flat otherwise', () => {
    const c = createElectrolytic(470e-6, 16);
    const bulged = c.group.getObjectByName(`${c.key}:bulged`)!;
    expect(bulged).toBeDefined();
    c.setLook({ status: 'ok' }, 0);
    expect(bulged.visible).toBe(false);
    c.setLook({ status: 'bulged' }, 0);
    expect(bulged.visible).toBe(true);
    // the top rises 0.05 above the can's rim
    c.group.updateMatrixWorld(true);
    let top = -Infinity;
    bulged.traverse((o) => {
      const g = (o as Mesh).geometry;
      if (!g) return;
      g.computeBoundingBox();
      top = Math.max(top, g.boundingBox!.max.clone().applyMatrix4(o.matrixWorld).y);
    });
    expect(top).toBeGreaterThan(0.3 + c.size.h + 0.04);
    expect(top).toBeLessThan(0.3 + c.size.h + 0.07);
  });
});
