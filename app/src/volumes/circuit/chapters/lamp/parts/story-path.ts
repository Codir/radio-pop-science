/**
 * `story`: the one slider «Час» as the position of everything (DECISIONS §60 p). Four equal stretches of the track,
 * `x` 0…1: 0 → 1 ns (linear, as `flow/push`), 1 ns → 1 µs → 1 ms → 0,1 s (logarithmic). This file holds the pure
 * maps of `x` — true time, the camera's place on its rail, the lens's way onto the coil and back, the window, the
 * fade of the field's wave, the atoms' heat — so the step is a function of the slider both ways.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import { LAMP, STAGE_SHOTS, boardToWorld, worldDirToBoard, worldToBoard, type LensPose } from '@circuit/shared/stage';

type V = [number, number, number];
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const ramp = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
export const smooth = (x: number): number => x * x * (3 - 2 * x);

/** Where the stretches start (shares of the track) and their decades of time: 0 · 1 ns · 1 µs · 1 ms · 0,1 s. */
export const MARKS = [0, 0.25, 0.5, 0.75, 1] as const;
const EXP = [-9, -6, -3, -1] as const;
/** Share of the first stretch at which the field's two fronts meet (script: ≈ 0,8, as `flow/push`). */
export const MEET = 0.8;

/** True time (s) at a share of the track. */
export function secondsAt(x: number): number {
  const c = clamp01(x);
  if (c <= 0.25) return (c / 0.25) * 1e-9;
  const i = Math.min(Math.floor((c - 0.25) / 0.25), 2);
  const k = (c - 0.25 - 0.25 * i) / 0.25;
  return 10 ** (EXP[i]! + (EXP[i + 1]! - EXP[i]!) * k);
}

/** The field's wave (`flow/push` continued): fronts 0…1 in the first stretch, then it fades as the camera dives. */
export const waveFront = (x: number): number => Math.min(clamp01(x / 0.25) / MEET, 1);
export const waveLight = (x: number): number => (x <= 0 ? 0 : 1 - smooth(ramp(x, 0.26, 0.34)));

/** The lens: 0 in its holder … 1 on the coil (on its way between 0.2 and 0.3, back between 0.75 and 0.86). */
export const lensOn = (x: number): number => smooth(ramp(x, 0.2, 0.3)) * (1 - smooth(ramp(x, 0.75, 0.86)));
/**
 * The window onto the filament's atoms inside the lens (the world's iris: its radius follows this share), as a
 * function of the CAMERA's place on its rail (stops), not of the slider: whatever the camera's lag behind a fast
 * scrub, the window is open only while the camera is at the ring, and it closes from the edge in as the camera
 * starts back, so the atoms give way to the coil behind them as a shrinking disc.
 */
export const windowOpen = (rail: number): number => smooth(ramp(rail, 2.3, 2.9)) * (1 - smooth(ramp(rail, 3.02, 3.55)));
/** The atoms' heat (trembling, orange rim) through the third stretch and on. */
export const atomsHeat = (x: number): number => smooth(ramp(x, 0.45, 0.78));

const coil = boardToWorld(LAMP.x, LAMP.filamentY, LAMP.z);
/** From the coil toward the reader, a little above (`lampCoil`'s line of sight). */
const view = new Vector3(0.12, 0.34, 0.93).normalize();
/** The ring's centre on the coil's line of sight, just outside the glass. */
const ringAt = coil.clone().addScaledVector(view, 0.9);
const v3 = (p: Vector3): V => [p.x, p.y, p.z];

/** The lens on the coil (board frame): facing the camera's line, its handle down and to the right. */
export const COIL_POSE: LensPose = (() => {
  const facing = worldDirToBoard(view.clone());
  const handle = new Vector3(0.6, -0.55, 0.3);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  return { position: worldToBoard(ringAt.clone()), facing, handle, scale: 1.05, grip: 1 / 1.05 };
})();

/** The way out looks at the coil's height and stays high: never down past the lamp's base. */
const outSide = coil.clone().add(new Vector3(0, -0.15, 0));
/** On the way out: the lamp's corner from the stand's side, so the camera never sweeps low past the base. */
const sideShot: Shot = {
  position: v3(outSide.clone().add(new Vector3(-2.9, 4.5, 4.9))),
  target: v3(outSide),
  fov: 27,
  fit: { center: v3(outSide), radius: 1.6 },
};
/** The camera's stops, and the track shares where it is at each (between: on the rail, eased by the rail). */
export const STORY_STOPS: readonly Shot[] = [
  STAGE_SHOTS.stand,
  sideShot,
  {
    position: v3(ringAt.clone().addScaledVector(view, 2.1)),
    target: v3(coil),
    fov: 27,
    near: 0.03,
    fit: { center: v3(ringAt), radius: 0.55 },
  },
  {
    // the window just fills the frame's width: its rim stays as arcs in the corners (the door's look)
    position: v3(ringAt.clone().addScaledVector(view, 0.85)),
    target: v3(coil),
    fov: 30,
    near: 0.02,
    fit: { center: v3(ringAt), radius: 0.3 },
  },
  {
    position: v3(coil.clone().addScaledVector(view, 1.25)),
    target: v3(coil),
    fov: 22,
    near: 0.03,
    fit: { center: v3(coil), radius: 0.36 },
  },
  sideShot,
  STAGE_SHOTS.stand,
];
/** Track share → rail position (stops 0…6), piecewise linear; flat = the camera holds. */
const KEYS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.1, 0],
  [0.24, 1],
  [0.3, 2],
  [0.38, 3],
  [0.73, 3],
  [0.8, 4],
  [0.84, 4],
  [0.93, 5],
  [1, 6],
];
export function railAt(x: number): number {
  const c = clamp01(x);
  for (let i = 1; i < KEYS.length; i++) {
    const [x1, r1] = KEYS[i]!;
    if (c <= x1) {
      const [x0, r0] = KEYS[i - 1]!;
      const k = (c - x0) / (x1 - x0);
      // ease only into and out of a hold (or the ends): between two moves the camera keeps going
      const still = (j: number): boolean => j < 1 || j >= KEYS.length || KEYS[j]![1] === KEYS[j - 1]![1];
      const easeIn = still(i - 1);
      const easeOut = still(i + 1);
      const e = easeIn && easeOut ? smooth(k) : easeIn ? k * k : easeOut ? 1 - (1 - k) * (1 - k) : k;
      return r0 + (r1 - r0) * e;
    }
  }
  return KEYS[KEYS.length - 1]![1];
}
