/**
 * The unfolding as one timed transition (DECISIONS §60 p; script `dive`, «Бачимо»): «Далі» on `click` opens the
 * flashlight into the stand by itself — `stand.playUnfold` (the stage's recommended timeline, `UNFOLD_PLAY`: six
 * beats at constant speed, zero velocity at both ends), the lamp never going out — while one camera move carries
 * the frame from the flashlight to the stand plan and the room's cold light comes up with the stand. «Назад»
 * plays the same motion backwards, faster (`REVERSE_SECONDS`, the owner 2026-11-17: the way back is a rewind, not
 * a second showing); the camera's move and moment scale with it. A deep link shows the end.
 */
import type { ChapterContext } from '@/engine/api';
import { UNFOLD_PLAY, type UnfoldPlay } from '@circuit/shared/stage';
import type { CircuitWorld } from '@circuit/shared/world';

/**
 * When the camera leaves the flashlight (share of the play) and how long it travels. The stage proposes beat 3
 * (0.25); starting at beat 2 fills the stretch where only the mounts grow and keeps the frame moving as one
 * (strips `c2d-*`).
 */
const CAMERA_AT = 0.06;
const CAMERA_SECONDS = 5.6;
/** The whole way back (`reverse`): the same timeline and camera move, played faster. */
export const REVERSE_SECONDS = 3;

export interface Unfolding {
  /** From the closed flashlight to the stand; the camera ends on `to`. */
  play(to: string): void;
  /** From the stand back into the flashlight; the camera ends on `to`; `done` once it is closed. */
  reverse(to: string, done?: () => void): void;
  /** The stand, at once (deep link). */
  finish(): void;
  readonly playing: boolean;
  /** 0 … 1: the stand's `unfold`. */
  readonly value: number;
  /** Seconds since the motion stopped (∞ before it ever ran). */
  readonly since: number;
  update(dt: number): void;
}

export function createUnfolding(ctx: ChapterContext, world: CircuitWorld): Unfolding {
  const { stand } = world;
  let run: UnfoldPlay | null = null;
  let dir: 1 | -1 = 1;
  /** Seconds of the running play (forwards `UNFOLD_PLAY.seconds`, backwards `REVERSE_SECONDS`). */
  let total: number = UNFOLD_PLAY.seconds;
  let shot = '';
  let moved = false;
  let since = Infinity;
  let onDone: (() => void) | undefined;
  const start = (to: 0 | 1, camera: string): void => {
    // the step's own tween of `unfold` would take the stand over: hold the param where the play starts
    ctx.stage.setParam('unfold', 1 - to, { instant: true });
    total = to === 1 ? UNFOLD_PLAY.seconds : REVERSE_SECONDS;
    run = stand.playUnfold(total, to);
    // the stage began a move to the step's shot; the frame stays where the reader left it (orbit, zoom, drift)
    // until the camera's moment comes, and the move leaves from there — never a snap back to the shot first
    ctx.camera.hold(to === 1 ? 'flashlight' : 'stand');
    dir = to === 1 ? 1 : -1;
    shot = camera;
    moved = false;
    since = 0;
  };
  return {
    get playing() {
      return run !== null;
    },
    get value() {
      return stand.unfold;
    },
    get since() {
      return since;
    },
    play(to) {
      start(1, to);
    },
    reverse(to, done) {
      onDone = done;
      start(0, to);
    },
    finish() {
      run = null;
      since = 0;
      ctx.stage.setParam('unfold', 1, { instant: true });
    },
    update(dt) {
      // the room's cold light comes up with the stand (none while it is still a flashlight in the dark)
      if (run)
        ctx.stage.setParam('moon', Math.min(1, Math.max(0, (stand.unfold - 0.12) / 0.6)), { instant: true });
      if (!run) {
        since += dt;
        return;
      }
      const p = run.progress;
      // forwards the camera leaves the flashlight early; backwards it arrives there late — the same move reversed,
      // its length a fixed share of the play (so a faster rewind still lands the camera with the closing parts)
      const share = CAMERA_SECONDS / UNFOLD_PLAY.seconds;
      const due = dir > 0 ? p >= CAMERA_AT : p >= 1 - CAMERA_AT - share;
      if (!moved && due) {
        moved = true;
        ctx.camera.go(shot, { duration: share * total, ease: 'power1.inOut' });
      }
      if (run.done) {
        run = null;
        since = 0;
        ctx.stage.setParam('unfold', dir > 0 ? 1 : 0, { instant: true });
        onDone?.();
        onDone = undefined;
      }
    },
  };
}
