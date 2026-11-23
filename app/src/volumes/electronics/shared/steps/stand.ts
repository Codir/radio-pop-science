/**
 * A chapter's facade over the bench of the volume (`createStepStand`), for the chapters whose steps put their own
 * boards: the bench mounted once, the magnifier's door into a part, its lens keeper and the ladder «де ми», and the
 * names under the pointer of the things a step keeps in place (`names.ts`) and of the instruments' cases. Steps put
 * their own boards (`board`: `bench.preset`, the step's whole bench) and say what the hand may take. A chapter's own
 * `stand.ts` makes it once. With `keepDoor`, a door the step before left open into the same part stays (two dive
 * steps in a row: going from one to the other the camera stays where it is); without it every `openDoor` makes a new
 * door. With `sound`, the bench's speaker is in sound (the amplifier on the board plays what the player gives it) and
 * the player is under a tap where a step lets it (`Naming.tap`): its level is the model's setting of the bench's
 * `PLAYER`, 0 stopped, and stays as it is across a step's new board — every step sets it on entry (`play`); the
 * speaker is named where a step names it (`Naming.speaker`).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import type { ChapterContext, StepInfo } from '@/engine/api';
import type { FloorLadder } from '@/hud-dom/journey';
import { PARTS } from '@electronics/sim/core';
import { mountBench, setSetting, type Bench, type BenchShot, type PresetPart, type SocketId } from '../bench';
import { benchLadder, lensKeeper, partDoor, type Door, type LensKeeper } from '../dive';
import { partNames, type Names } from './names';

/** What the names under the pointer say in the step on screen ('' or absent — none); whether a tap plays the player. */
export interface Naming {
  /** A part the step keeps in place, by its id. */
  part?(id: string): string;
  /** The multimeter's case. */
  meter: string;
  /** The oscilloscope's case. */
  scope?: string;
  /** The player's box (with `sound`). */
  player?: string;
  /** The speaker (with `sound`), by a long touch too: a step that lets the hand take nothing near it names it. */
  speaker?: string;
  /** A tap on the player's box starts or stops it (with `sound`). */
  tap?: boolean;
}

const SILENT: Naming = { meter: '' };
/** The bench's player: the fixed part whose setting is its level. */
const PLAYER = 'PLAYER';
/** The player's level when it plays: the catalog's amplitude, 0,3 V. */
const PLAYING = (() => {
  const p = PARTS.player;
  return p?.kind === 'player' ? p.amplitude : 0.3;
})();

export interface StepStandOptions {
  /** A door into the part the door still open goes into stays, with its rail where it is (not on a deep link). */
  keepDoor?: boolean;
  /** The bench's speaker in sound (`mountBench`'s option) and the player under a tap. */
  sound?: boolean;
}

export interface StepStand {
  readonly bench: Bench;
  /** The door of the dive step on screen, or one whose rail still flies home; null otherwise. */
  readonly door: Door | null;
  readonly keeper: LensKeeper;
  readonly ladder: FloorLadder;
  /** The names of the step on screen (a step sets it on entry). */
  naming: Naming;
  /**
   * A step's own board (`bench.preset`, the step's whole bench): everything off first — the parts and the plugs of the
   * bench's things — then these parts and plugs, new and whole. The switch and the player's level stay as they are.
   */
  board(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId>>): void;
  /** The player plays (its level above 0; the catalog's 0,3 V while no level is set). */
  playing(): boolean;
  /** Start or stop the player: the model's setting, the next solve plays it. */
  play(on: boolean): void;
  /** How many times the reader started or stopped the player with a tap (QA). */
  readonly taps: number;
  /** The page is a phone's (the bench shows the shot `phone`; the tray, the switch and the player are in the dock). */
  phone(): boolean;
  /**
   * A door into `partId` from the shot `lead`, its lens to the holder's pose; the old one given up. With `keepDoor`
   * the door left open into the same part stays instead (its rail where it is), unless the step is a deep link.
   */
  openDoor(partId: string, info: StepInfo, lead?: BenchShot): Door;
  /** Leaving the door's step(s): the rail flies home first, then the shot `then` (or at once on a deep link). */
  closeDoor(info: StepInfo, then: BenchShot): void;
  snap(): void;
  /** Every frame: the bench, then the door, the lens over everything, the ladder and the names. */
  update(dt: number, t: number): void;
}

export function createStepStand(ctx: ChapterContext, opts: StepStandOptions = {}): StepStand {
  const bench = mountBench(ctx, { sound: opts.sound === true });
  const keeper = lensKeeper(bench.tools);
  const hover = (): boolean => ctx.device.hover !== false;
  let door: Door | null = null;
  /** The door stays only while one of its steps is on screen or its rail still has the camera. */
  let doorStep: string | null = null;
  let taps = 0;
  const ladder = benchLadder(ctx, () => door?.floor ?? null);
  const stand: StepStand = {
    bench,
    get door() {
      return door;
    },
    keeper,
    ladder,
    naming: SILENT,
    board(parts, leads) {
      bench.preset(parts, leads);
    },
    playing: () => (bench.state.settings.get(PLAYER) ?? PLAYING) > 0,
    play(on) {
      setSetting(bench.state, PLAYER, on ? PLAYING : 0);
    },
    get taps() {
      return taps;
    },
    phone: () => ctx.device.formFactor === 'phone',
    openDoor(partId, info, lead = 'board') {
      keeper.call = 1;
      doorStep = ctx.stage.current ?? null;
      if (opts.keepDoor && door && door.partId === partId && !info.instant) {
        // the door stays: its rail is where the step before left it (or on its way home: the step takes it from there)
        return door;
      }
      door?.dispose();
      const d = partDoor(ctx, bench, partId, { lead });
      door = d;
      if (info.instant) keeper.snap(() => d.lens(d.rail.position));
      else keeper.to(() => d.lens(d.rail.position), 1.2);
      return d;
    },
    closeDoor(info, then) {
      keeper.call = 0;
      if (!door) return;
      door.home({ instant: info.instant, then });
      doorStep = null;
    },
    snap() {
      bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
      if (door) {
        door.update(dt);
        const p = door.rail.position;
        const engaged = door.rail.engaged;
        keeper.rim = engaged ? door.rim(p) : 0;
        keeper.glass = engaged ? door.glass(p) : 1;
        keeper.late(dt, t);
        // back on the step's shot after the door's step(s): the door is given up, the bench lays the lens again
        if (doorStep === null && !engaged) {
          door.dispose();
          door = null;
        }
      }
      ladder.update();
      names.update();
    },
  };
  const names: Names = partNames(
    ctx,
    bench,
    (id) => stand.naming.part?.(id) ?? '',
    () => stand.naming.meter,
  );
  // the oscilloscope's case: its name under a pointer that hovers (on a touch screen a twin would take the taps meant
  // for the probes' grips beside it; the names there are the dock's and the board's)
  ctx.input.register(bench.oscilloscope.body, {
    cursor: 'default',
    tooltip: () => stand.naming.scope ?? '',
    enabled: () => hover() && !bench.flying && bench.scope > 0.99 && (stand.naming.scope ?? '') !== '',
  });
  if (opts.sound) {
    // the player: a tap starts or stops the melody where the step lets it (the engine's first gesture with it: the
    // volume's sound output starts on it); its name under the pointer
    ctx.input.register(bench.props.things.player.group, {
      cursor: 'pointer',
      tooltip: () => stand.naming.player ?? '',
      enabled: () => !bench.flying && stand.naming.tap === true,
      click: () => {
        if (bench.flying || stand.naming.tap !== true) return;
        stand.play(!stand.playing());
        audio.play('toggle');
        taps++;
      },
    });
    // QA: the player's box (a tap plays it) and the speaker
    ctx.qa.probe('player', () => bench.props.things.player.group.getWorldPosition(new Vector3()));
    ctx.qa.probe('speaker', () => bench.props.things.speaker.group.getWorldPosition(new Vector3()));
    // the speaker's name, by a long touch too (a step that names it lets the hand take nothing beside it)
    ctx.input.register(bench.props.things.speaker.group, {
      cursor: 'default',
      tooltip: () => stand.naming.speaker ?? '',
      enabled: () => !bench.flying && (stand.naming.speaker ?? '') !== '',
    });
  }
  return stand;
}
