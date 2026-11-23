/**
 * The numbers of the bench (docs/volumes/electronics/VISUAL.md §2, §8, §9), copied in its shape from
 * `circuit/shared/stage/__tests__/layout.test.ts` (shared/README.md, «Копії») and held to the bench's own rules: the
 * places on the base and on the table, the shots seen through a camera of `STAGE_FOV`, the HUD's panels (desktop)
 * and the phone's re-framing by the real `CameraDirector`.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CameraDirector, type Shot } from '@/engine/camera/director';
import { createLayout } from '@electronics/sim/board';
import { BOARD_Y } from '../base';
import { resample } from '../dyn-tube';
import { BOARD, LAMP, LENS, PLACES, SWITCH } from '../layout';
import { BENCH_AMBIENT, filamentColor } from '../light';
import { STAGE_FOV, STAGE_SHOTS, benchShots, boardToWorld } from '../shots';
import { worldToBoard } from '../tools';

const layout = createLayout();
const P = layout.spec.pitch;
const deg = (r: number) => (r * 180) / Math.PI;
const COS = Math.cos(BOARD.tilt);
const SIN = Math.sin(BOARD.tilt);

/** Signed distance from (x, z) of the base frame to the outline of the base's face (negative inside). */
function toEdge(x: number, z: number): number {
  const c = BOARD.corner;
  const qx = Math.abs(x) - (BOARD.width / 2 - c);
  const qz = Math.abs(z) - (BOARD.depth / 2 - c);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - c;
}
/** How far a box (x, z, width, depth) stays inside the face. */
const boxMargin = (x: number, z: number, w: number, d: number): number =>
  Math.min(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => -toEdge(x + (sx * w) / 2, z + (sz * d) / 2))));
/** How far a disc stays inside the face (the face is convex: the disc's nearest point lies along the gradient). */
const discMargin = (x: number, z: number, r: number): number => -toEdge(x, z) - r;

/** The breadboard's body in the base frame: x0, x1, z0, z1. */
const BODY = (() => {
  const { x, z, left, right, beyond } = PLACES.breadboard;
  const a1 = layout.socket('+1')!;
  const a17 = layout.socket('+17')!;
  return { x0: x + a1.x - left, x1: x + a17.x + right, z0: z + a1.z - beyond, z1: z - a1.z + beyond };
})();
/** Clearance of a disc from the breadboard's body (its rectangle; the rounded corners only add to it). */
const offBody = (x: number, z: number, r: number): number =>
  Math.hypot(Math.max(BODY.x0 - x, 0, x - BODY.x1), Math.max(BODY.z0 - z, 0, z - BODY.z1)) - r;

describe('the base and its places (VISUAL §2)', () => {
  it('has the numbers of the document', () => {
    expect(BOARD.width).toBe(8.4);
    expect(BOARD.depth).toBe(5.6);
    expect(BOARD.width / BOARD.depth).toBeCloseTo(1.5, 9);
    expect(deg(BOARD.tilt)).toBeCloseTo(15, 9);
    expect(BOARD.thickness).toBe(0.62);
    expect(BOARD.feet).toBe(0.16);
    expect(PLACES.breadboard).toMatchObject({ x: -0.3, z: 0, width: 5.7, depth: 4.3, height: 0.3 });
    expect(PLACES.battery).toMatchObject({ x: 3.45, z: 1.6, width: 1.2, depth: 2.0, height: 0.8 });
    expect(PLACES.switch).toMatchObject({ x: 3.45, z: 2.25, travel: 0.3 });
    expect(PLACES.player).toMatchObject({ x: 3.45, z: -0.35, width: 1.0, depth: 1.4, height: 0.3 });
    expect(PLACES.speaker).toMatchObject({ x: 3.45, z: -1.95, radius: 0.65 });
    expect(PLACES.lamp).toMatchObject({ x: -3.6, z: -2.0, glass: 0.38, glassY: 1.2 });
    expect(LENS).toMatchObject({ holder: { x: -3.6, z: 1.95 }, radius: 0.42 });
    expect(PLACES.tray).toMatchObject({ x: 0, z: 3.6, width: 7.8, depth: 1.7 });
    expect(PLACES.meter).toMatchObject({ x: -5.6, z: 1.2, width: 1.4, depth: 2.4, height: 0.4 });
    expect(PLACES.scope).toMatchObject({ x: 5.7, z: -3.0, width: 2.4, depth: 1.4, height: 1.9 });
    // the lamp is the highest thing on the base: the top of its glass 1.58 above the face
    expect(LAMP.glassY + LAMP.glass).toBeCloseTo(1.58, 9);
  });

  it('the breadboard body is the field of sockets and its margins: 5.7 × 4.3, the posts on the right', () => {
    expect(BODY.x1 - BODY.x0).toBeCloseTo(PLACES.breadboard.width, 9);
    expect(BODY.z1 - BODY.z0).toBeCloseTo(PLACES.breadboard.depth, 9);
    expect(BODY.x0).toBeCloseTo(-3.0, 9);
    expect(BODY.x1).toBeCloseTo(2.7, 9);
    expect(PLACES.breadboard.right).toBeGreaterThan(PLACES.breadboard.left); // the power posts stand there
  });

  it('everything on the face stays at least 0.1 inside its edge', () => {
    const margins = {
      breadboard: boxMargin(
        (BODY.x0 + BODY.x1) / 2,
        (BODY.z0 + BODY.z1) / 2,
        BODY.x1 - BODY.x0,
        BODY.z1 - BODY.z0,
      ),
      battery: boxMargin(PLACES.battery.x, PLACES.battery.z, PLACES.battery.width, PLACES.battery.depth),
      player: boxMargin(PLACES.player.x, PLACES.player.z, PLACES.player.width, PLACES.player.depth),
      speaker: discMargin(PLACES.speaker.x, PLACES.speaker.z, PLACES.speaker.radius),
      lamp: discMargin(PLACES.lamp.x, PLACES.lamp.z, PLACES.lamp.glass),
      lens: discMargin(LENS.holder.x, LENS.holder.z, LENS.radius),
    };
    for (const [name, m] of Object.entries(margins)) expect(m, name).toBeGreaterThanOrEqual(0.1 - 1e-9);
    // the switch lies on the battery box's lid, its thumb's whole travel too
    expect(Math.abs(PLACES.switch.x - PLACES.battery.x) + SWITCH.travel).toBeLessThan(
      PLACES.battery.width / 2,
    );
    expect(PLACES.switch.z).toBeLessThan(PLACES.battery.z + PLACES.battery.depth / 2);
    expect(PLACES.switch.z).toBeGreaterThan(PLACES.battery.z);
  });

  it('the magnifier, the lamp and the speaker keep off the breadboard (0.18, 0.22, 0.10)', () => {
    expect(offBody(LENS.holder.x, LENS.holder.z, LENS.radius)).toBeCloseTo(0.18, 9);
    expect(offBody(PLACES.lamp.x, PLACES.lamp.z, PLACES.lamp.glass)).toBeCloseTo(0.22, 9);
    expect(offBody(PLACES.speaker.x, PLACES.speaker.z, PLACES.speaker.radius)).toBeCloseTo(0.1, 9);
    // the battery box and the player are beside the body as well
    expect(PLACES.battery.x - PLACES.battery.width / 2).toBeGreaterThan(BODY.x1);
    expect(PLACES.player.x - PLACES.player.width / 2).toBeGreaterThan(BODY.x1);
  });

  it('the battery box, the player and the speaker do not touch (gaps 0.25)', () => {
    const batteryFar = PLACES.battery.z - PLACES.battery.depth / 2;
    const playerNear = PLACES.player.z + PLACES.player.depth / 2;
    const playerFar = PLACES.player.z - PLACES.player.depth / 2;
    expect(batteryFar - playerNear).toBeCloseTo(0.25, 9);
    expect(playerFar - (PLACES.speaker.z + PLACES.speaker.radius)).toBeCloseTo(0.25, 9);
  });

  it('the tray stands right against the base’s front edge, the instruments beside it on the table', () => {
    const front = (BOARD.depth / 2) * COS; // the face's near edge, world z
    const trayBack = PLACES.tray.z - PLACES.tray.depth / 2;
    expect(trayBack).toBeCloseTo(2.75, 9);
    expect(trayBack - front).toBeGreaterThan(0);
    expect(trayBack - front).toBeLessThan(0.1);
    expect(PLACES.tray.front.depth + PLACES.tray.back.depth).toBeCloseTo(PLACES.tray.depth, 9);
    expect(PLACES.tray.back.top - PLACES.tray.front.top).toBeCloseTo(0.25, 9);
    expect(PLACES.tray.width).toBeLessThanOrEqual(BOARD.width);
    // the multimeter left of the base, the oscilloscope right and behind it; both on the table (radius 8.6)
    const meterRight = PLACES.meter.x + PLACES.meter.width / 2;
    expect(meterRight).toBeLessThan(-BOARD.width / 2);
    const scopeLeft = PLACES.scope.x - PLACES.scope.width / 2;
    expect(scopeLeft).toBeGreaterThan(BOARD.width / 2);
    expect(PLACES.scope.z + PLACES.scope.depth / 2).toBeCloseTo(-2.3, 9); // the face
    for (const t of [PLACES.meter, PLACES.scope])
      expect(Math.hypot(Math.abs(t.x) + t.width / 2, Math.abs(t.z) + t.depth / 2)).toBeLessThan(8.6);
  });
});

/* ------------------------------------------------------------------------------------------- shots */

const v3 = (p: readonly number[]) => new Vector3(p[0], p[1], p[2]);
const w = (x: number, y: number, z: number) => boardToWorld(x, y, z);
const socketWorld = (id: string) => {
  const s = layout.socket(id)!;
  return w(PLACES.breadboard.x + s.x, PLACES.breadboard.height, PLACES.breadboard.z + s.z);
};
const SOCKETS = layout.sockets.map((s) => socketWorld(s.id));

/** A camera of the shot with the bench's safe frame (fov 27°, 3 : 2) — the desktop frame. */
function frameCamera(shot: Shot): PerspectiveCamera {
  const c = new PerspectiveCamera(shot.fov ?? STAGE_FOV, 1.5, 0.1, 100);
  c.position.copy(v3(shot.position as readonly number[]));
  c.lookAt(v3(shot.target as readonly number[]));
  c.updateMatrixWorld();
  return c;
}
/** The largest |x| or |y| of the points in the safe frame (−1 … 1). */
const within = (c: PerspectiveCamera, pts: readonly Vector3[]) =>
  Math.max(...pts.map((p) => p.clone().project(c)).map((n) => Math.max(Math.abs(n.x), Math.abs(n.y))));
/** One pitch along the line e near column 9, as a share of the safe frame's width. */
const pitchShare = (c: PerspectiveCamera) => {
  const a = socketWorld('e9').project(c);
  const b = socketWorld('e10').project(c);
  return Math.hypot(b.x - a.x, (b.y - a.y) / 1.5) / 2;
};

const BASE_CORNERS = [-1, 1].flatMap((sx) =>
  [-1, 1].map((sz) => w((sx * BOARD.width) / 2, 0, (sz * BOARD.depth) / 2)),
);
const LAMP_TOP = w(LAMP.x, LAMP.glassY + LAMP.glass, LAMP.z);
const TRAY = (() => {
  const { x, z, width, depth, front, back } = PLACES.tray;
  return [-1, 1].flatMap((s) => [
    new Vector3(x + (s * width) / 2, front.top, z + depth / 2),
    new Vector3(x + (s * width) / 2, back.top, z - depth / 2),
  ]);
})();
const METER = [-1, 1].flatMap((sx) =>
  [-1, 1].map(
    (sz) =>
      new Vector3(
        PLACES.meter.x + (sx * PLACES.meter.width) / 2,
        PLACES.meter.height,
        PLACES.meter.z + (sz * PLACES.meter.depth) / 2,
      ),
  ),
);
const SCOPE_FACE = [-1, 1].flatMap((sx) =>
  [0, PLACES.scope.height].map(
    (y) =>
      new Vector3(PLACES.scope.x + (sx * PLACES.scope.width) / 2, y, PLACES.scope.z + PLACES.scope.depth / 2),
  ),
);

describe('the shots (VISUAL §8)', () => {
  it('have the numbers of the document', () => {
    expect(STAGE_FOV).toBe(27);
    expect(STAGE_SHOTS.stand).toMatchObject({
      position: [0, 10.8, 12.6],
      target: [0, 1.15, 0.95],
      fit: { center: [0, 1.1, 0.8], radius: 5.6 },
    });
    expect(STAGE_SHOTS.board).toMatchObject({
      position: [-0.3, 7.6, 7.7],
      target: [-0.3, 1.45, 0.35],
      fit: { center: [-0.3, 1.8, 0.1], radius: 3.2 },
    });
    expect(STAGE_SHOTS.phone).toMatchObject({
      position: [-0.3, 10.0, 5.8],
      target: [-0.3, 1.79, 0.08],
      fit: { center: [-0.3, 1.79, 0.08], radius: 2.55 },
    });
    expect(STAGE_SHOTS.meter).toMatchObject({
      position: [-2.2, 11.3, 12.9],
      target: [-1.9, 1.05, 0.85],
      fit: { center: [-2.4, 1.0, 0.9], radius: 5.45 },
    });
    expect(STAGE_SHOTS.scope).toMatchObject({
      position: [1.6, 11.2, 12.6],
      target: [1.6, 1.4, -0.2],
      fit: { center: [2.0, 1.4, -0.8], radius: 5.6 },
    });
    // the phone's target and fit centre: the middle of the field of sockets
    const mid = w(PLACES.breadboard.x, PLACES.breadboard.height, PLACES.breadboard.z);
    expect(mid.distanceTo(v3(STAGE_SHOTS.phone.target))).toBeLessThan(0.006);
  });

  it('stand: the base’s corners, the lamp’s top and the tray’s corners in 0.95 of the frame; P ≥ 0.025', () => {
    const c = frameCamera(STAGE_SHOTS.stand);
    expect(within(c, [...BASE_CORNERS, LAMP_TOP, ...TRAY])).toBeLessThanOrEqual(0.95);
    expect(pitchShare(c)).toBeGreaterThanOrEqual(0.025);
    // ≈ 55° to the face: steeper than the circuit's 52°, so the deeper base and the tray fit
    const view = v3(STAGE_SHOTS.stand.target).sub(v3(STAGE_SHOTS.stand.position)).normalize();
    const normal = new Vector3(0, COS, SIN);
    expect(deg(Math.asin(-view.dot(normal)))).toBeGreaterThan(50);
    expect(deg(Math.asin(-view.dot(normal)))).toBeLessThan(60);
  });

  it('board: all 204 sockets in 0.9 of the frame; P ≥ 0.04', () => {
    const c = frameCamera(STAGE_SHOTS.board);
    expect(within(c, SOCKETS)).toBeLessThanOrEqual(0.9);
    expect(pitchShare(c)).toBeGreaterThanOrEqual(0.04);
  });

  it('meter and scope: the instrument and all the sockets in 0.95 of the frame', () => {
    expect(within(frameCamera(STAGE_SHOTS.meter), [...METER, ...SOCKETS])).toBeLessThanOrEqual(0.95);
    expect(within(frameCamera(STAGE_SHOTS.scope), [...SCOPE_FACE, ...SOCKETS])).toBeLessThanOrEqual(0.95);
  });

  it('every subject but the phone’s lies in its shot’s `fit` sphere', () => {
    const inside = (shot: Shot, pts: readonly Vector3[]) => {
      const fit = shot.fit as { center: readonly number[]; radius: number };
      return Math.max(...pts.map((p) => p.distanceTo(v3(fit.center)))) <= fit.radius;
    };
    expect(inside(STAGE_SHOTS.stand, [...BASE_CORNERS, LAMP_TOP, ...TRAY])).toBe(true);
    expect(inside(STAGE_SHOTS.board, SOCKETS)).toBe(true);
    expect(inside(STAGE_SHOTS.meter, [...METER, ...SOCKETS])).toBe(true);
    expect(inside(STAGE_SHOTS.scope, [...SCOPE_FACE, ...SOCKETS])).toBe(true);
  });

  it('on a phone every name of the bench is the `phone` shot; elsewhere the shots are their own', () => {
    const p = benchShots(true);
    for (const name of ['stand', 'board', 'meter', 'scope', 'phone', 'amp'] as const)
      expect(p[name]).toBe(STAGE_SHOTS.phone);
    expect(benchShots(false)).toBe(STAGE_SHOTS);
  });
});

/* ------------------------------------------------------------------- the real camera, HUD panels */

/** The director on a viewport with the HUD's panels (fractions measured on the DOM interface, see below). */
function director(
  width: number,
  height: number,
  insets: Record<'left' | 'right' | 'top' | 'bottom', number>,
  phone: boolean,
  shot: Shot,
) {
  const d = new CameraDirector();
  d.reframe = phone;
  d.setViewport(width, height);
  d.setInsets(insets, true);
  d.go(shot, { instant: true });
  d.camera.updateMatrixWorld();
  /** A world point in CSS px. */
  const px = (p: Vector3) => {
    const n = p.clone().project(d.camera);
    return { x: (n.x / 2 + 0.5) * width, y: (0.5 - n.y / 2) * height };
  };
  const free = {
    x0: insets.left * width,
    x1: (1 - insets.right) * width,
    y0: insets.top * height,
    y1: (1 - insets.bottom) * height,
  };
  /** The largest share of the free area's half-width / half-height the points reach from its middle. */
  const reach = (pts: readonly Vector3[]) => {
    const cx = (free.x0 + free.x1) / 2;
    const cy = (free.y0 + free.y1) / 2;
    const q = pts.map(px);
    return {
      x: Math.max(...q.map((p) => Math.abs(p.x - cx) / ((free.x1 - free.x0) / 2))),
      y: Math.max(...q.map((p) => Math.abs(p.y - cy) / ((free.y1 - free.y0) / 2))),
    };
  };
  return { px, reach };
}

/**
 * The DOM interface's panels on a desktop, as fractions of the viewport (measured in the browser with
 * `__app.engine.hud.insetFractions()` on 2026-11-20): the chapter spine on the left, the step column on the right,
 * the header on top, the step navigator at the bottom.
 */
const DESKTOP = {
  '1280x720': { left: 0.0409, right: 0.2803, top: 0.1131, bottom: 0.1175 },
  '1920x1080': { left: 0.0398, right: 0.2677, top: 0.1091, bottom: 0.113 },
} as const;

describe('the HUD’s panels on a desktop', () => {
  it('leave the tray and the instruments in the free area of their shots', () => {
    for (const [size, insets] of Object.entries(DESKTOP)) {
      const [W, H] = size.split('x').map(Number) as [number, number];
      const cases = [
        [STAGE_SHOTS.stand, [...TRAY, ...BASE_CORNERS, LAMP_TOP]],
        [STAGE_SHOTS.meter, METER],
        [STAGE_SHOTS.scope, SCOPE_FACE],
      ] as const;
      for (const [shot, pts] of cases) {
        const r = director(W, H, insets, false, shot).reach(pts);
        expect(r.x, `${size} x`).toBeLessThanOrEqual(1);
        expect(r.y, `${size} y`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the phone (VISUAL §9)', () => {
  // the free area between the top row of buttons (62 px) and the sheet: at half 422 px on 844 and 400 on 800, peeking
  // with a one-line step title 154 px (`hud/model/sheet.ts`)
  const PHONES = [
    [390, 844, 422],
    [390, 844, 154],
    [360, 800, 400],
    [360, 800, 154],
  ] as const;
  const RESTS = [-2.0, 1.4].flatMap((x) => [2.3, 2.5].map((z) => w(x, 0.05, z)));

  it('the `phone` shot keeps all 204 sockets and the probes at rest in 0.95 of the free area; P ≥ 17 px', () => {
    for (const [W, H, sheet] of PHONES) {
      const d = director(
        W,
        H,
        { left: 0, right: 0, top: 62 / H, bottom: sheet / H },
        true,
        STAGE_SHOTS.phone,
      );
      const r = d.reach(SOCKETS);
      expect(Math.max(r.x, r.y), `${W}×${H} sheet ${sheet}`).toBeLessThanOrEqual(0.95);
      const rest = d.reach(RESTS);
      expect(Math.max(rest.x, rest.y), `${W}×${H} rests`).toBeLessThanOrEqual(0.95);
      const a = d.px(socketWorld('e9'));
      const b = d.px(socketWorld('e10'));
      expect(Math.hypot(b.x - a.x, b.y - a.y), `${W}×${H} P`).toBeGreaterThanOrEqual(17);
    }
  });
});

describe('helpers', () => {
  it('base frame ↔ world are inverses', () => {
    for (const p of [new Vector3(0, 0, 0), new Vector3(-3.6, 1.2, -2), new Vector3(3.45, 0.9, 2.25)]) {
      const back = worldToBoard(boardToWorld(p.x, p.y, p.z));
      expect(back.distanceTo(p)).toBeLessThan(1e-12);
    }
    expect(boardToWorld(0, 0, 0).y).toBeCloseTo(BOARD_Y, 12);
    // the face's near edge is at the height of the slab's front: feet + thickness
    expect(boardToWorld(0, 0, BOARD.depth / 2).y).toBeCloseTo(BOARD.feet + BOARD.thickness, 12);
  });

  it('the unlit room is lifted more than in `circuit` (0.8 against 0.5)', () => {
    expect(BENCH_AMBIENT).toBe(0.8);
  });

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
  });

  it('resample keeps the ends and spaces points evenly', () => {
    const out = resample([new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 3, 0)], 9);
    expect(out).toHaveLength(9);
    expect(out[0]!.x).toBe(0);
    expect(out[8]!.y).toBeCloseTo(3, 6);
    expect(out[2]!.distanceTo(out[1]!)).toBeCloseTo(0.5, 6);
  });
});

// the pitch is the board's (sim/board), three times a real 2.54 mm
it('the bench uses the board’s pitch', () => expect(P).toBe(0.3));
