import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { bulbDims } from '../bulb';
import { resample } from '../dyn-tube';
import { BATTERY, BOARD, LAMP, LENS, LOOP, RULER, SWITCH, WIRE } from '../layout';
import { filamentColor } from '../light';
import { HANDOVER, STAGE_FOV, boardToWorld } from '../shots';
import { torchDims } from '../torch';

describe('stand layout (VISUAL.md §2, §9)', () => {
  it('the loop takes at least 70 % of the board both ways and its corners are ≥ 3 wire thicknesses', () => {
    expect((LOOP.right - LOOP.left) / BOARD.width).toBeGreaterThanOrEqual(0.7);
    expect((LOOP.near - LOOP.far) / BOARD.depth).toBeGreaterThanOrEqual(0.7);
    expect(LOOP.corner).toBeGreaterThanOrEqual(3 * 2 * WIRE.sheath);
    expect(BOARD.width / BOARD.depth).toBeCloseTo(1.5, 5);
  });

  it('the near side holds, in order, minus clamp · battery · plus clamp · free wire · switch', () => {
    const straightLeft = LOOP.left + LOOP.corner;
    const straightRight = LOOP.right - LOOP.corner;
    expect(BATTERY.minusX).toBeGreaterThanOrEqual(straightLeft - 1e-9);
    expect(BATTERY.minusX).toBeLessThan(BATTERY.x - BATTERY.length / 2);
    expect(BATTERY.plusX).toBeGreaterThan(BATTERY.x + BATTERY.length / 2);
    expect(SWITCH.inX).toBeGreaterThan(BATTERY.plusX + 0.25); // the magnifier's stretch of wire
    expect(LENS.wireSpot.x).toBeCloseTo((BATTERY.plusX + SWITCH.inX) / 2, 5);
    expect(SWITCH.outX).toBeLessThanOrEqual(straightRight + 1e-9);
    expect(SWITCH.outX - SWITCH.inX).toBeCloseTo(SWITCH.width, 5);
  });

  it('the lamp stands in the far right corner and the ruler is ten battery-centimetres long', () => {
    expect(LAMP.x).toBe(LOOP.right);
    expect(LAMP.z).toBe(LOOP.far);
    expect((RULER.x1 - RULER.x0) / RULER.cm).toBeCloseTo(BATTERY.length / 5, 5); // battery = 5 cm
  });
});

describe('hand-over pose', () => {
  it('looks across the wire and the core fills the safe frame', () => {
    expect(HANDOVER.direction.x).toBe(0); // perpendicular to the wire (world +x)
    expect(HANDOVER.direction.length()).toBeCloseTo(1, 6);
    const half = Math.tan((STAGE_FOV * Math.PI) / 360) * HANDOVER.distance;
    expect(half).toBeCloseTo(WIRE.core, 6);
    expect(HANDOVER.spot.distanceTo(boardToWorld(LENS.wireSpot.x, LOOP.y, LENS.wireSpot.z))).toBeCloseTo(
      0,
      6,
    );
    expect(HANDOVER.position.distanceTo(HANDOVER.spot)).toBeCloseTo(HANDOVER.distance, 6);
  });
});

describe('lamp size is a parameter', () => {
  it('the flashlight head always holds the globe, whatever its radius', () => {
    for (const globe of [0.45, 0.52, 0.66, 0.8]) {
      const bulb = bulbDims(globe);
      const torch = torchDims(bulb);
      expect(torch.head - torch.wall).toBeGreaterThan(globe); // the globe fits inside the head
      expect(torch.glassX).toBeGreaterThan(torch.bulbX + bulb.globeY + globe); // and behind the glass
      expect(bulb.filamentY).toBeGreaterThan(bulb.thread);
    }
    expect(bulbDims().globe).toBe(LAMP.glass);
  });

  it('the resting magnifier lies inside the board and clear of the loop', () => {
    const { x, z } = LENS.holder;
    expect(x - LENS.radius).toBeGreaterThan(-BOARD.width / 2);
    expect(z + LENS.radius).toBeLessThan(BOARD.depth / 2);
    // distance from the ring's centre to the loop's rounded near-left corner (arc centre + radius + wire)
    const d = Math.hypot(x - (LOOP.left + LOOP.corner), z - (LOOP.near - LOOP.corner));
    expect(d).toBeGreaterThanOrEqual(LOOP.corner + WIRE.sheath + LENS.radius);
  });
});

describe('helpers', () => {
  it('filament colour runs dark → red → orange → yellow → white without jumps', () => {
    let previous = filamentColor(0);
    for (let i = 1; i <= 50; i++) {
      const c = filamentColor(i / 50);
      expect(
        Math.abs(c.r - previous.r) + Math.abs(c.g - previous.g) + Math.abs(c.b - previous.b),
      ).toBeLessThan(0.25);
      previous = c.clone();
    }
    const hot = filamentColor(1);
    expect(Math.min(hot.r, hot.g, hot.b)).toBeGreaterThan(0.85);
    const warm = filamentColor(0.3);
    expect(warm.r).toBeGreaterThan(warm.g * 2); // red before orange and yellow
  });

  it('resample keeps the ends and spaces points evenly', () => {
    const out = resample([new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 3, 0)], 9);
    expect(out).toHaveLength(9);
    expect(out[0]!.x).toBe(0);
    expect(out[8]!.y).toBeCloseTo(3, 6);
    expect(out[2]!.distanceTo(out[1]!)).toBeCloseTo(0.5, 6);
  });
});
