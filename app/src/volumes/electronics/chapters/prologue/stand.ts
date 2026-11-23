/**
 * The chapter's facade over the bench of the volume (`@electronics/shared/**`): the bench mounted once with its
 * speaker in sound (what the board gives the speaker is what one hears), the player under a tap (its level is the
 * model's setting of the bench's `PLAYER`: 0 stopped; the tap is the engine's first gesture, from which the volume's
 * sound starts), the names under the pointer of the player, the speaker and the oscilloscope's case, the step's call
 * (a pulse on the thing it wants touched) and the wave on the speaker as the dock shows it — the largest voltage on it
 * over the last 0,5 s of what it sounded of the step's own board. Steps put their own board (`board`: cleared, then
 * `bench.preset`), set the switch, the player and the knob and say what the hand may take.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import type { ChapterContext } from '@/engine/api';
import { mountBench, setSetting, type Bench, type PresetPart, type SocketId } from '@electronics/shared/bench';
import { CREST_SECONDS, IDS, PLAYING } from './parts/boards';
import { soundOff, stepCrest } from './parts/dock';
import { createCall, type Call } from './parts/marks';

/** What the names under the pointer say in the step on screen ('' — none); whether a tap plays the player. */
export interface Naming {
  player: string;
  speaker: string;
  scope: string;
  /** A tap on the player's box starts or stops it (`quiet`). */
  tap: boolean;
}

const SILENT: Naming = { player: '', speaker: '', scope: '', tap: false };

export interface PrologueStand {
  readonly bench: Bench;
  /** The names of the step on screen (a step sets them on entry). */
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
   * sample of the step's own board on (0 until it is heard).
   */
  crest(): number;
  /** The stream's index of the first sample of the step's own board, null until its first block came. */
  readonly from: number | null;
  /** The volume's sound is silent not by the circuit's will (the dock's line «Звук вимкнено…»). */
  soundOff(): boolean;
  /** The step's call: one thing pulses `cyan` (a part's id, `player`), set every frame by the step on screen. */
  readonly call: Call;
  snap(): void;
  update(dt: number, t: number): void;
}

export function createPrologueStand(ctx: ChapterContext): PrologueStand {
  const bench = mountBench(ctx, { sound: true });
  const hover = (): boolean => ctx.device.hover !== false;
  const call = createCall(bench);
  let taps = 0;
  // the first sample of the step's own board: the first block whose `since` is new after the step's preset
  let from: number | null = null;
  let waiting = false;
  let sinceAt = Number.NaN;
  const stand: PrologueStand = {
    bench,
    naming: SILENT,
    board(parts, leads) {
      call.to(null, 0);
      bench.clear();
      bench.preset(parts, leads);
      from = null;
      waiting = true;
      sinceAt = bench.live.since;
    },
    playing: () => (bench.state.settings.get(IDS.player) ?? PLAYING) > 0,
    play(on) {
      setSetting(bench.state, IDS.player, on ? PLAYING : 0);
    },
    get taps() {
      return taps;
    },
    knob: () => bench.state.settings.get(IDS.pot) ?? 0.5,
    phone: () => ctx.device.formFactor === 'phone',
    crest() {
      const sp = bench.speaker;
      return sp === null ? 0 : stepCrest(sp.heard(), from, bench.live.rate, CREST_SECONDS, (s) => sp.peak(s));
    },
    get from() {
      return from;
    },
    soundOff: () => soundOff(bench.speaker?.output.state ?? null, ctx.store.get().settings),
    call,
    snap() {
      bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
      const since = bench.live.since;
      if (waiting && Number.isFinite(since) && !Object.is(since, sinceAt)) {
        from = Math.round(since * bench.live.rate);
        waiting = false;
      }
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
  // QA: the player's box (a tap plays it) and the speaker
  ctx.qa.probe('player', () => bench.props.things.player.group.getWorldPosition(new Vector3()));
  ctx.qa.probe('speaker', () => bench.props.things.speaker.group.getWorldPosition(new Vector3()));
  // the speaker's name (`quiet`, where the hand takes nothing: by a long touch too); the oscilloscope's under a pointer
  // that hovers (on a touch screen a twin would take the taps meant for the probe's grip beside it)
  ctx.input.register(bench.props.things.speaker.group, {
    cursor: 'default',
    tooltip: () => stand.naming.speaker,
    enabled: () => !bench.flying && stand.naming.speaker !== '',
  });
  ctx.input.register(bench.oscilloscope.body, {
    cursor: 'default',
    tooltip: () => stand.naming.scope,
    enabled: () => hover() && !bench.flying && bench.scope > 0.99 && stand.naming.scope !== '',
  });
  return stand;
}
