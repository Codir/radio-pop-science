/**
 * The chapter's facade over the bench of the volume (`@electronics/shared/**`): the bench mounted once with its
 * speaker in sound (the amplifier on the board plays what the player gives it), the player under a tap (its level
 * is the model's setting of the bench's `PLAYER`: 0 stopped), the names under the pointer of the instruments' cases
 * and of the player. Steps put their own board (`board`: cleared, then `bench.preset`), set the switch and the player
 * and say what the hand may take.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import { mountBench, setSetting, type Bench, type PresetPart, type SocketId } from '@electronics/shared/bench';
import { PLAYING } from './parts/boards';

/** What the names under the pointer say in the step on screen ('' — none); whether a tap plays the player. */
export interface Naming {
  meter: string;
  scope: string;
  player: string;
  /** A tap on the player's box starts or stops it (`wave`). */
  tap: boolean;
}

const SILENT: Naming = { meter: '', scope: '', player: '', tap: false };
/** The bench's player: the fixed part whose setting is its level. */
const PLAYER = 'PLAYER';

export interface MeterStand {
  readonly bench: Bench;
  /** The names of the step on screen (a step sets them on entry). */
  naming: Naming;
  /**
   * A step's own board: everything off first — the parts and the plugs of the bench's things (a plug a preset does
   * not name stays where it is) — then these parts and plugs, new and whole.
   */
  board(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId>>): void;
  /** The player plays (its level above 0; the catalog's 0,3 V when the board names none). */
  playing(): boolean;
  /** Start or stop the player: the model's setting, the next solve plays it. */
  play(on: boolean): void;
  /** How many times the reader started or stopped the player with a tap (QA). */
  readonly taps: number;
  /** The page is a phone's (the bench shows the shot `phone`; the tray, the switch and the player are in the dock). */
  phone(): boolean;
  snap(): void;
  update(dt: number, t: number): void;
}

export function createMeterStand(ctx: ChapterContext): MeterStand {
  const bench = mountBench(ctx, { sound: true });
  const hover = (): boolean => ctx.device.hover !== false;
  let taps = 0;
  const stand: MeterStand = {
    bench,
    naming: SILENT,
    board(parts, leads) {
      bench.clear();
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
    snap() {
      bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
    },
  };
  // the player: a tap starts or stops the melody where the step lets it (the engine's first gesture with it: the
  // volume's sound output starts on it); its name under the pointer
  ctx.input.register(bench.props.things.player.group, {
    cursor: 'pointer',
    tooltip: () => stand.naming.player,
    enabled: () => !bench.flying && stand.naming.tap,
    click: () => {
      if (bench.flying || !stand.naming.tap) return;
      stand.play(!stand.playing());
      audio.play('toggle');
      taps++;
    },
  });
  // QA: the player's box (a tap plays it)
  ctx.qa.probe('player', () => bench.props.things.player.group.getWorldPosition(new Vector3()));
  // the instruments' cases: their names under a pointer that hovers (on a touch screen a twin would take the taps meant
  // for the probes' grips beside it; the names there are the dock's and the board's)
  ctx.input.register(bench.multimeter.body, {
    cursor: 'default',
    tooltip: () => stand.naming.meter,
    enabled: () => hover() && !bench.flying && bench.meter > 0.99 && stand.naming.meter !== '',
  });
  ctx.input.register(bench.oscilloscope.body, {
    cursor: 'default',
    tooltip: () => stand.naming.scope,
    enabled: () => hover() && !bench.flying && bench.scope > 0.99 && stand.naming.scope !== '',
  });
  return stand;
}
