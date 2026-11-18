/**
 * Chapter borders of the volume (VISUAL §3: «між главами — повернення на план «Стенд» (2–3 s). Межа глав — завжди
 * той самий кадр»). The last frame of a chapter and the first of its neighbour are one picture: the stand shot,
 * the lens in its holder with its window shut, nothing of a chapter's own on the table, the switch and the wires'
 * tint as the border says. Leaving (`SceneHooks.leaveChapter`) walks the scene there — a flight up through the lens
 * if it is below the stand; arriving starts on it and moves on into the step (`arrive`), so «Далі: наступний розділ»
 * and «Назад» across a border are one continuous move (the platform cross-fades two equal frames: `seamless`).
 * `prologue | wire` is the exception: the prologue ends on the «away» frame and `world.flyIn` starts there.
 */
import type { ChapterContext, StepSpec } from '@/engine/api';
import { AWAY_MOON, AWAY_POST } from './away';
import { LENS_LEG } from './dive';

/** The state of the stand on a border (the rest is fixed: stand shot, lens home, window shut, dive at 0). */
export interface BorderState {
  /** The switch: 0 open (dark lamp), 1 closed. */
  closed: 0 | 1;
  /** The plus/minus tint of the wires. */
  poles: 0 | 1;
  /** The «away» frame instead of the stand shot (the stand behind the prologue's map board, cold light low). */
  away?: true;
}

/** Journey order of the volume's chapters (volume.json); the border between two neighbours is keyed by the first. */
export const ORDER = ['prologue', 'wire', 'charge', 'battery', 'flow', 'resistance', 'lamp', 'drain', 'build'];

/**
 * Each border, by the earlier chapter of the pair. The lamp is lit on a border when the outgoing chapter's last step
 * ends lit and the incoming chapter's first step starts lit (scripts' «Бачимо»), dark otherwise — never a blink off
 * and on between two lit steps. Where only one side is lit, that chapter moves the switch as a visible, calm part of
 * its walk to the border or of its entry (`flow/push` → the lamp lights as the reader goes on; `lamp/inside` opens
 * the switch on entry).
 *
 * | border | outgoing last step | incoming first step | border |
 * |---|---|---|---|
 * | prologue · wire | `map`: lit, behind the board | `atoms`: lit | lit, «away» |
 * | wire · charge | `plastic`: dark | `rub`: the lamp as it is (dark all chapter) | dark |
 * | charge · battery | `shift`: dark | `poles`: open, dark | dark |
 * | battery · flow | `voltage`: dark | `connect`: dark | dark |
 * | flow · resistance | `push`: dark within the slider, «світить, коли читач іде далі» | `bumps`: closed, lit | lit |
 * | resistance · lamp | `balance`: lit | `inside`: lit, the switch opens on entry | lit |
 * | lamp · drain | `story`: ends lit | `hours`: lit | lit |
 * | drain · build | `life`: lit, new battery | `first-light`: lit, the ends come out on entry | lit |
 */
export const BORDERS: Readonly<Record<string, BorderState>> = {
  prologue: { closed: 1, poles: 0, away: true },
  wire: { closed: 0, poles: 0 },
  charge: { closed: 0, poles: 0 },
  battery: { closed: 0, poles: 1 },
  flow: { closed: 1, poles: 1 },
  resistance: { closed: 1, poles: 1 },
  lamp: { closed: 1, poles: 1 },
  drain: { closed: 1, poles: 1 },
};

/** The border between the chapter `here` and its neighbour `there` (null: not neighbours, or no fixed frame). */
export function borderOf(here: string, there: string): BorderState | null {
  const a = ORDER.indexOf(here);
  const b = ORDER.indexOf(there);
  if (a < 0 || b < 0 || Math.abs(a - b) !== 1) return null;
  return BORDERS[ORDER[Math.min(a, b)]!] ?? null;
}

/** Seconds of the walk back to the stand plan (VISUAL §3: 2–3 s). */
export const LEAVE_SECONDS = 2.4;
/** From below: the rewind of the dive up to the stand plan; «away» then pulls back behind the board and rests (≈ 3.4 s). */
const AWAY_RISE = 1.9;
const AWAY_PULL = 1.0;
/** Seconds the «away» frame rests before the swap: the phone's re-framing (eased, ≈ 0.17 s time constant) settles. */
const AWAY_REST = 0.5;
/** Seconds after arrival before the switch moves (the reader first sees the same stand). */
export const SWITCH_DELAY = 0.5;
/** Seconds the filament takes to settle after the switch moved on the way to a border (its glow has inertia). */
const SETTLE = 0.45;
/** Seconds the arriving chapter holds the border frame: the platform's cross-fade of the two equal frames. */
export const HOLD = 0.5;

/** What the world lends the border moves. */
export interface BorderDeps {
  ctx: ChapterContext;
  specs: Readonly<Record<string, StepSpec>>;
  value(name: string): number;
  readonly deep: number;
  readonly flying: boolean;
  release(): void;
  fly(deep: number, camera: string, lens: number): void;
  /** A timed glide of the dive rail to `t` (−`LENS_LEG` = the stand plan, the lens in its holder). */
  travel(t: number, seconds: number): void;
  /** Put the stand's moving parts on their values at once and shut the lens window. */
  snap(): void;
}

export interface Borders {
  /** Walk to the border with `to`; returns «there» (for `leaveChapter`). Null when `to` is no neighbour. */
  leave(to: string): (() => boolean) | null;
  /**
   * Start the step `id` (entered instantly behind the platform's cross-fade) on the border with `from`, then move
   * into the step's own state on the first frame: the dive if it is below the stand, else its camera and params.
   * False when `from` is no neighbour (a deep link: the step stays as entered).
   */
  arrive(id: string, from: string | null, opts?: { camera?: boolean; then?: () => void }): boolean;
  /** Forward from the world's update. */
  update(dt: number): void;
}

export function createBorders(here: string, d: BorderDeps): Borders {
  const { ctx } = d;
  let pending: { id: string; camera: boolean; wait: number; then?: () => void } | null = null;
  /** The arriving step's switch, after `SWITCH_DELAY` (cancelled by a leave). */
  let switchLater: { value: number; wait: number } | null = null;
  /** The «away» border: once the flight up has landed on the stand plan, pull back behind the board. */
  let awayAfterFlight = false;
  /** Below the stand the switch waits for the flight up (the light from above would go out mid-flight). */
  let switchAfterFlight: BorderState | null = null;
  /** The rewind's rail lets the camera go once it has landed on the stand plan. */
  let releaseAfterFlight = false;
  /** Seconds since the switch took the border's state (the filament needs a moment to cool or to light). */
  let sinceSwitch = 0;
  const setSwitch = (b: BorderState): void => {
    sinceSwitch = d.value('closed') === b.closed ? SETTLE : 0;
    ctx.stage.setParam('closed', b.closed);
    ctx.stage.setParam('poles', b.poles, { duration: LEAVE_SECONDS * 0.6 });
  };
  /** Seconds the pull-back's light and focus still need (the predicate waits for them, not only the camera). */
  let awayLeft = 0;
  /** The room's light and the focus go to the «away» look over `seconds` (alongside the camera's moves). */
  const awayLook = (seconds: number): void => {
    awayLeft = seconds;
    ctx.stage.setParam('moon', AWAY_MOON, { duration: seconds });
    ctx.post.apply(AWAY_POST, { duration: seconds });
  };
  return {
    leave(to) {
      const b = borderOf(here, to);
      if (!b) return null;
      pending = null;
      switchLater = null;
      awayAfterFlight = false;
      switchAfterFlight = null;
      releaseAfterFlight = false;
      if (d.deep > 0.01 && b.away) {
        // back to the prologue from below: one timed rewind of the dive up to the stand plan (the lens back in its
        // holder), the pull-back behind the board right after it; the light and focus change across both
        setSwitch(b);
        d.travel(-LENS_LEG, AWAY_RISE);
        awayLook(AWAY_RISE + AWAY_PULL);
        awayLeft += AWAY_REST;
        awayAfterFlight = true;
      } else if (d.deep > 0.01) {
        // up through the lens in one timed rewind of the dive to the stand plan (the lens back in its holder);
        // the switch once it has landed (the light from above must not go out mid-flight)
        d.travel(-LENS_LEG, AWAY_RISE);
        switchAfterFlight = b;
        releaseAfterFlight = true;
      } else {
        setSwitch(b);
        d.release();
        if (b.away) {
          ctx.camera.go('away', { duration: AWAY_PULL * 1.5, ease: 'sine.inOut' });
          awayLook(AWAY_PULL * 1.5);
        } else ctx.camera.go('stand', { duration: LEAVE_SECONDS, ease: 'sine.inOut' });
        ctx.stage.setParam('lens', 0, { duration: LEAVE_SECONDS * 0.75 });
      }
      ctx.stage.setParam('window', 0, { duration: 0.4 });
      ctx.stage.setParam('lensCall', 0, { duration: 0.4 });
      return () =>
        !awayAfterFlight &&
        awayLeft <= 0 &&
        !switchAfterFlight &&
        sinceSwitch >= SETTLE &&
        !d.flying &&
        !ctx.camera.moving &&
        d.value('lens') < 0.005 &&
        d.value('window') < 0.005 &&
        d.value('closed') === b.closed;
    },
    arrive(id, from, opts = {}) {
      const b = from === null ? null : borderOf(here, from);
      if (!b) return false;
      d.release();
      ctx.camera.go('stand', { instant: true });
      ctx.stage.setParam('deep', 0, { instant: true });
      ctx.stage.setParam('lens', 0, { instant: true });
      ctx.stage.setParam('window', 0, { instant: true });
      ctx.stage.setParam('lensCall', 0, { instant: true });
      ctx.stage.setParam('closed', b.closed, { instant: true });
      ctx.stage.setParam('poles', b.poles, { instant: true });
      d.snap();
      pending = { id, camera: opts.camera !== false, wait: HOLD, then: opts.then };
      return true;
    },
    update(dt) {
      sinceSwitch += dt;
      awayLeft -= dt;
      if (switchLater && (switchLater.wait -= dt) <= 0) {
        ctx.stage.setParam('closed', switchLater.value);
        switchLater = null;
      }
      if (releaseAfterFlight && !d.flying) {
        releaseAfterFlight = false;
        d.release();
      }
      if (switchAfterFlight && !d.flying) {
        setSwitch(switchAfterFlight);
        switchAfterFlight = null;
      }
      if (awayAfterFlight && !d.flying) {
        awayAfterFlight = false;
        d.release();
        ctx.camera.go('away', { duration: AWAY_PULL, ease: 'sine.inOut' });
      }
      if (!pending || (pending.wait -= dt) > 0) return;
      const { id, camera, then } = pending;
      pending = null;
      then?.();
      const spec = d.specs[id];
      if (!spec) return;
      const params = (spec.params ?? {}) as Record<string, number>;
      const deep = params.deep ?? 0;
      // `camera: false`: the chapter moves the camera (and a dive) itself, from `then`
      if (deep > 0.01 && camera && typeof spec.camera === 'string') d.fly(deep, spec.camera, params.lens ?? 1);
      else if (camera && spec.camera !== undefined && spec.camera !== 'stand')
        ctx.camera.go(spec.camera, { duration: spec.cameraMove?.duration ?? LEAVE_SECONDS, ease: 'sine.inOut' });
      for (const [name, v] of Object.entries(params)) {
        if (name === 'deep' || (deep > 0.01 && name === 'lens')) continue;
        if (name === 'closed') switchLater = { value: v, wait: SWITCH_DELAY };
        // a param the world does not know reads NaN: set it anyway
        else if (!(Math.abs(d.value(name) - v) <= 1e-3)) ctx.stage.setParam(name, v);
      }
    },
  };
}
