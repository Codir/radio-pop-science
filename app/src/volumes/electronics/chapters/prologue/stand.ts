/**
 * The chapter's facade over the bench of the volume: the step stand of `@electronics/shared/steps` with sound
 * (`createStepStand(ctx, { sound: true })` — the bench mounted once with its speaker in sound, what the board gives
 * the speaker is what one hears; the player under a tap where a step lets it, its level the model's setting of the
 * bench's `PLAYER`, 0 stopped, the tap the engine's first gesture from which the volume's sound starts; the names under
 * the pointer of the player, the speaker and the oscilloscope's case), and the chapter's own: the step's call (a pulse
 * on the thing it wants touched), the volume knob's setting, and the wave on the speaker as the dock shows it — the
 * largest voltage on it over the last 0,5 s of what it sounded of the step's own board. Steps put their own board
 * (`board`: `bench.preset`, the step's whole bench), set the switch, the player and the knob and say what the hand may
 * take.
 */
import type { ChapterContext } from '@/engine/api';
import type { Bench, PresetPart, SocketId } from '@electronics/shared/bench';
import { createStepStand, type Naming } from '@electronics/shared/steps';
import { CREST_SECONDS, IDS } from './parts/boards';
import { soundOff, stepCrest } from './parts/dock';
import { createCall, type Call } from './parts/marks';

export interface PrologueStand {
  readonly bench: Bench;
  /** The names of the step on screen (a step sets them on entry; the multimeter never comes here: its name ''). */
  naming: Naming;
  /**
   * A step's own board: everything off first — the parts and the plugs of the bench's things — then these parts and
   * plugs, new and whole. The model starts again from the board's operating point; the step's call ends.
   */
  board(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId>>): void;
  /** The player plays (its level above 0; the catalog's 0,3 V when the board names none). */
  playing(): boolean;
  /** Start or stop the player: the model's setting, the next solve plays it. */
  play(on: boolean): void;
  /** How many times the reader started or stopped the player with a tap (the step's call; QA). */
  readonly taps: number;
  /** The volume knob's setting now. */
  knob(): number;
  /** The page is a phone's (the bench shows the shot `phone`; the switch is in the dock). */
  phone(): boolean;
  /**
   * The dock's «Хвиля на динаміку» (V): the largest voltage on the speaker over the last 0,5 s heard, from the first
   * whole chunk of the step's own board on (0 until one is heard).
   */
  crest(): number;
  /**
   * The stream's index of the first sample of the step's own board — the first block after the model started again
   * with it (`live.begun` once `live.starts` has passed the step's mark) — null until that block came.
   */
  readonly from: number | null;
  /** The volume's sound is silent not by the circuit's will (the dock's line «Звук вимкнено…»). */
  soundOff(): boolean;
  /** The step's call: one thing pulses `cyan` (a part's id, `player`), set every frame by the step on screen. */
  readonly call: Call;
  snap(): void;
  update(dt: number, t: number): void;
}

export function createPrologueStand(ctx: ChapterContext): PrologueStand {
  const stand = createStepStand(ctx, { sound: true });
  const { bench } = stand;
  const call = createCall(bench);
  // the first sample of the step's own board: the first block after the start that follows the step's preset (a block
  // of the board before may still come between the preset and that start: it moves `since`, not `begun`)
  let from: number | null = null;
  let startsAt = 0;
  return {
    bench,
    get naming() {
      return stand.naming;
    },
    set naming(n: Naming) {
      stand.naming = n;
    },
    board(parts, leads) {
      call.to(null, 0);
      stand.board(parts, leads);
      from = null;
      startsAt = bench.live.starts;
    },
    playing: () => stand.playing(),
    play: (on) => stand.play(on),
    get taps() {
      return stand.taps;
    },
    knob: () => bench.state.settings.get(IDS.pot) ?? 0.5,
    phone: () => stand.phone(),
    crest() {
      const sp = bench.speaker;
      return sp === null ? 0 : stepCrest(sp.heard(), from, CREST_SECONDS, (s, start) => sp.peak(s, start));
    },
    get from() {
      return from;
    },
    soundOff: () => soundOff(bench.speaker?.output.state ?? null, ctx.store.get().settings),
    call,
    snap() {
      stand.snap();
    },
    update(dt, t) {
      stand.update(dt, t);
      const { live } = bench;
      if (from === null && live.starts > startsAt && live.begun !== null) from = live.begun;
    },
  };
}
