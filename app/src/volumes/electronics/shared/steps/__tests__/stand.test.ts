/**
 * The step stand (`stand.ts`) and the depth slider (`depth.ts`) on a live bench (`mountBench` with a stub context and
 * the engine's own `CameraDirector`, no WebGL): a step's own board, the door made anew on every visit or — `keepDoor`
 * — kept between two dive steps into the same part (not on a deep link, not into another part), given up once its
 * rail is home after the door's steps; with `sound` the bench's speaker in sound and the player under a tap (the
 * model's level of the player, kept by a new board); the instruments' cases named; the slider's way and the
 * magnifier's tap as the rail's moves.
 */
import { describe, expect, it } from 'vitest';
import type { StepInfo } from '@/engine/api';
import type { SliderSpec } from '@/hud';
import { LENS_LEG } from '../../dive';
import { createStepStand, type StepStand } from '../stand';
import { DEPTH_ID, depthSlider } from '../depth';
import { stubContext } from './context';

const DT = 1 / 60;
const info = (instant: boolean): StepInfo =>
  ({ from: null, instant, direction: 1, index: 0 }) as unknown as StepInfo;
/** A 330 Ω in b5 … b9: the LED's loop's resistor. */
const R1 = [{ id: 'R1', spec: 'resistor-330', at: 'b5' }] as const;

function standOn(keepDoor: boolean) {
  const s = stubContext();
  const stand = createStepStand(s.ctx, { keepDoor });
  stand.board(R1);
  stand.snap();
  s.camera.go('board', { instant: true });
  const t = { now: 0 };
  const frames = (n: number, until?: () => boolean): void => {
    for (let i = 0; i < n && !until?.(); i++) {
      t.now += DT;
      stand.update(DT, t.now);
    }
  };
  return { ...s, stand, frames };
}

/** Into the floor `part` on the door's rail (0.75), the way a step's slider sends it. */
function dive(stand: StepStand, frames: (n: number, until?: () => boolean) => void): void {
  frames(1);
  expect(stand.door?.ready).toBe(true);
  stand.door!.travelTo(0.75);
  frames(600, () => !stand.door!.rail.moving);
  expect(stand.door!.floor).toBe('part');
}

describe('the step stand', () => {
  it('puts a step’s own board: the parts before off, these new and whole', () => {
    const { stand } = standOn(false);
    expect([...stand.bench.state.parts.keys()]).toEqual(['R1']);
    stand.board([{ id: 'R2', spec: 'resistor-1k', at: 'b12' }]);
    expect([...stand.bench.state.parts.keys()]).toEqual(['R2']);
    expect(stand.phone()).toBe(false);
    expect(createStepStand(stubContext('phone').ctx).phone()).toBe(true);
  });

  it('without `keepDoor`, makes a new door on every visit', () => {
    const { stand, frames } = standOn(false);
    const first = stand.openDoor('R1', info(false));
    dive(stand, frames);
    const second = stand.openDoor('R1', info(false));
    expect(second).not.toBe(first);
    expect(stand.door).toBe(second);
  });

  it('with `keepDoor`, keeps the door into the same part with its rail where it is — not on a deep link', () => {
    const { stand, frames, stage } = standOn(true);
    const first = stand.openDoor('R1', info(false));
    dive(stand, frames);
    stage.current = 'b';
    expect(stand.openDoor('R1', info(false))).toBe(first);
    expect(first.rail.position).toBeCloseTo(0.75, 9);
    // a deep link into the same step makes it anew
    const linked = stand.openDoor('R1', info(true));
    expect(linked).not.toBe(first);
  });

  it('with `keepDoor`, still makes a new door into another part', () => {
    const { stand, frames } = standOn(true);
    stand.board([...R1, { id: 'R2', spec: 'resistor-1k', at: 'b12' }]);
    const first = stand.openDoor('R1', info(false));
    dive(stand, frames);
    expect(stand.openDoor('R2', info(false))).not.toBe(first);
  });

  it('gives the door up once its rail is home after the door’s steps', () => {
    const { stand, frames } = standOn(true);
    stand.openDoor('R1', info(false));
    dive(stand, frames);
    stand.closeDoor(info(false), 'board');
    expect(stand.door).not.toBeNull();
    frames(900, () => stand.door === null);
    expect(stand.door).toBeNull();
  });
});

describe('the step stand with sound', () => {
  it('mounts the bench’s speaker in sound only when asked', () => {
    expect(createStepStand(stubContext().ctx).bench.speaker).toBeNull();
    expect(createStepStand(stubContext().ctx, { sound: true }).bench.speaker).not.toBeNull();
  });

  it('plays and stops the player by the model’s level, which a new board keeps; a tap flips it where the step lets it', () => {
    const { ctx, handlers } = stubContext();
    const stand = createStepStand(ctx, { sound: true });
    const { bench } = stand;
    // no level set: the player plays at the catalog's 0,3 V
    expect(stand.playing()).toBe(true);
    stand.play(false);
    expect(bench.state.settings.get('PLAYER')).toBe(0);
    expect(stand.playing()).toBe(false);
    stand.board(R1);
    expect(stand.playing()).toBe(false);
    stand.play(true);
    expect(bench.state.settings.get('PLAYER')).toBeCloseTo(0.3, 12);
    // the tap on the player's box: only where the step's naming lets it, never while the camera flies
    const tap = handlers.get(bench.props.things.player.group)!;
    expect(tap.enabled?.()).toBe(false);
    stand.naming = { meter: '', player: 'player', tap: true };
    expect(tap.enabled?.()).toBe(true);
    expect(tap.tooltip?.()).toBe('player');
    tap.click?.();
    expect(stand.playing()).toBe(false);
    expect(stand.taps).toBe(1);
    bench.flying = true;
    expect(tap.enabled?.()).toBe(false);
    tap.click?.();
    expect(stand.taps).toBe(1);
  });

  it('names the speaker where the step does, by a long touch too, never while the camera flies', () => {
    const { ctx, handlers } = stubContext('phone');
    const stand = createStepStand(ctx, { sound: true });
    const { bench } = stand;
    const speaker = handlers.get(bench.props.things.speaker.group)!;
    expect(speaker).toBeDefined();
    expect(speaker.enabled?.()).toBe(false);
    stand.naming = { meter: '', speaker: 'speaker' };
    expect(speaker.enabled?.()).toBe(true);
    expect(speaker.tooltip?.()).toBe('speaker');
    bench.flying = true;
    expect(speaker.enabled?.()).toBe(false);
    // no sound: the bench's speaker is not named by the stand
    const quiet = stubContext();
    const silent = createStepStand(quiet.ctx);
    expect(quiet.handlers.has(silent.bench.props.things.speaker.group)).toBe(false);
  });

  it('has no tap on the player without sound', () => {
    const { ctx, handlers } = stubContext();
    const stand = createStepStand(ctx);
    expect(handlers.has(stand.bench.props.things.player.group)).toBe(false);
  });

  it('names the instruments’ cases by the step’s words, once they stand on their places', () => {
    const { ctx, handlers } = stubContext();
    const stand = createStepStand(ctx);
    const { bench } = stand;
    const meter = handlers.get(bench.multimeter.body)!;
    const scope = handlers.get(bench.oscilloscope.body)!;
    stand.naming = { meter: 'meter', scope: 'scope' };
    expect(meter.enabled?.()).toBe(false);
    expect(scope.enabled?.()).toBe(false);
    bench.meter = 1;
    bench.scope = 1;
    expect(meter.enabled?.()).toBe(true);
    expect(scope.enabled?.()).toBe(true);
    expect([meter.tooltip?.(), scope.tooltip?.()]).toEqual(['meter', 'scope']);
    stand.naming = { meter: '' };
    expect(meter.enabled?.()).toBe(false);
    expect(scope.enabled?.()).toBe(false);
  });
});

describe('the depth slider', () => {
  it('runs 0 … end + LENS_LEG over the rail, words by halves; a click glides, a drag scrubs, the fill follows', () => {
    const { ctx, stand, frames, handlers } = standOn(false);
    const sets: [string, unknown][] = [];
    const patches: [string, number | undefined][] = [];
    const ui = {
      set: (id: string, v: unknown) => void sets.push([id, v]),
      patch: (id: string, p: { current?: number }) => void patches.push([id, p.current]),
    };
    let here = true;
    const depth = depthSlider(
      ctx,
      stand.bench,
      ui,
      () => stand.door,
      () => here,
      0.75,
      {
        label: 'depth',
        top: 'bench',
        bottom: 'part',
      },
    );
    const c: SliderSpec = depth.control;
    expect(c.id).toBe(DEPTH_ID);
    expect(depth.max).toBeCloseTo(0.75 + LENS_LEG, 12);
    expect(c.max).toBe(depth.max);
    expect(c.marks?.map((m) => m.label)).toEqual(['bench', 'part']);
    expect(c.format?.(0.1)).toBe('bench');
    expect(c.format?.(depth.max)).toBe('part');
    // no door yet: the slider is not greyed by a door that rests; with one resting, until it is ready
    stand.openDoor('R1', info(false));
    expect(depth.resting()).toBe(true);
    frames(1);
    expect((c.disabled as () => boolean)()).toBe(false);
    // the tap on the resting lens: the slider to the end of the lens's leg, the rail to the floor `part`'s start
    const tap = handlers.get(stand.bench.tools.lens.group)!;
    expect(tap.enabled?.()).toBe(true);
    tap.click?.();
    expect(sets).toEqual([[DEPTH_ID, LENS_LEG]]);
    frames(600, () => !stand.door!.rail.moving);
    expect(stand.door!.rail.position).toBeCloseTo(0, 9);
    expect(tap.enabled?.()).toBe(false);
    // a click on the slider's end glides the rail to `end`; the fill follows it, in the slider's units
    c.onChange?.(depth.max);
    frames(600, () => !stand.door!.rail.moving);
    expect(stand.door!.rail.position).toBeCloseTo(0.75, 9);
    depth.reset();
    depth.update();
    expect(patches.at(-1)).toEqual([DEPTH_ID, stand.door!.rail.position + LENS_LEG]);
    // a drag scrubs: the rail follows the hand (a short time constant, no glide) to the slider's place
    c.onInput?.(LENS_LEG + 0.6, 'drag');
    frames(120);
    expect(stand.door!.rail.position).toBeCloseTo(0.6, 3);
    // a jump of the slider is not a drag: only `onChange` glides
    c.onInput?.(LENS_LEG + 0.2, 'jump');
    frames(120);
    expect(stand.door!.rail.position).toBeCloseTo(0.6, 3);
    // off the step: neither the tap nor the fill
    here = false;
    const n = patches.length;
    depth.reset();
    depth.update();
    expect(patches.length).toBe(n);
    expect(tap.enabled?.()).toBe(false);
  });
});
