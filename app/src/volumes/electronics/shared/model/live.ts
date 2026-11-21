/**
 * The circuit model in time on the bench (docs/volumes/electronics/VISUAL.md §5.2; plan decisions 14, 17): the board
 * now on the bench played at the volume's rate by E1-9's stream (`shared/sound`: one background thread, the main
 * thread when there is none), its samples numbered, for the oscilloscope's taps and the speaker's current (E2-10), on
 * the same thread.
 *
 * - **Live, at 24 000 samples a second** (E1-7's verdict, sim/core/README.md, «Speed»), in E1-9's blocks of 1536.
 * - **Paced by the engine's clock**: the blocks are planned back to back on the bench's own time (`BlockPlan`, E1-9's
 *   bookkeeping, on a clock nobody hears: no underruns counted) — a request leaves while the plan has room, and `now`
 *   is the sample the plan plays at this moment, which the scope shows.
 * - **Or by the speaker's sound output** (`sound`, E2-10: `shared/instruments/speaker.ts`): a request leaves while
 *   the output wants a block, every block's speaker current goes to it, and `now` is the sample heard now. The
 *   speaker's tap comes first in every request — its current while it is in the circuit of the board given, the ground
 *   (0 V: silence) while it is not, so that a request's board and taps always agree — and the scope's taps after it.
 * - **The board follows the bench's model** (`BenchModel`): a new solve (a part put in, a knob or the switch turned, a
 *   part burnt) gives the stream the board of that moment, and the model goes on with it from its last moment; a
 *   step's own new board (`restart`: `bench.preset`, `bench.clear`) and every new start after a pause start the model
 *   again from its operating point.
 * - **So does the damage**: the driver is the one that burns a part or bulges a can (`advance`), and the stream plays
 *   what it says — the damage of the board goes with every start and with every solve that changed it
 *   (`StreamDamage`: a burnt part a gap, a bulged can its leak, every other part whole), and the stream's model fails
 *   nothing on its own heat. A part burnt before the scope came, or while it was away, is a gap on its screen too.
 * - **Only while it is wanted** (`update(dt, run)`): no thread is made before then, nothing is computed while not.
 * - **A held page** (`?freeze`) runs on the main thread, so that every frame of fixed time gives the same samples; its
 *   oscilloscope shows `BenchModel.still` on a held frame.
 *
 * `since` is the model's moment (s, the stream's numbering) from which the samples are of the board and the probes
 * now: the first sample of the first block asked with them. The checks read the trace from there.
 */
import type { ChapterContext } from '@/engine/api';
import {
  BlockPlan,
  createStream,
  type BlockReply,
  type Netlist,
  type ProbeSpec,
  type Stream,
  type StreamDamage,
  type StreamMode,
  type WorkerLike,
} from '../sound';
import type { BenchModel } from './driver';

/** The volume's rate and E1-9's block (shared/sound/README.md, «Rate and block»). */
export const LIVE = { rate: 24000, block: 1536 } as const;

/** What plays the speaker's current and paces the model by its output (`shared/instruments/speaker.ts`). */
export interface LiveSound {
  /** The part whose current is played (the bench's speaker `SPK`). */
  readonly part: string;
  /** Whether the output takes one more block now: the stream asks before every request. */
  wants(): boolean;
  /**
   * Every block, in order: the speaker's current (the ground's 0 V while the speaker is out of the circuit) and how
   * many of its samples the model computed.
   */
  play(first: number, current: Float32Array, steps: number): void;
  /** The stream's sample heard now, or null before any block. */
  heard(): number | null;
}

export interface LiveOptions {
  /** A held page: the main thread only. */
  readonly frozen: boolean;
  /**
   * Every block, in order: the stream's index of its first sample, a channel a tap (the scope's, as `taps` gave
   * them), and how many of its samples the model computed (after a moment without a solution the rest are its zeros,
   * which are never to be shown: G7).
   */
  onBlock(first: number, samples: readonly Float32Array[], steps: number): void;
  /** The model started again (a new board, a start after a pause): what was shown is of the old one. */
  onRestart?(): void;
  /** The speaker (E2-10): it takes every block's speaker current, and its output paces the model. */
  readonly sound?: LiveSound;
  /** A test's thread. */
  makeWorker?: () => WorkerLike;
}

export interface Live {
  /** Where the model runs: `off` until it was first wanted. */
  readonly mode: StreamMode | 'off';
  readonly rate: number;
  readonly block: number;
  /** How many blocks came; how long the model took for the last (ms). */
  readonly blocks: number;
  readonly ms: number;
  /** The model's moment (s) from which the blocks are of the board and probes now (NaN before the first block). */
  readonly since: number;
  /** The sample shown at this moment (the stream's index; with the speaker, the one heard), or null before any block. */
  readonly now: number | null;
  /** How far the samples may come ahead of `now` (the plan and the block on its way). */
  readonly lookahead: number;
  /** What to record for the scope: the next request carries a changed list. */
  taps(list: readonly ProbeSpec[]): void;
  /** A step's own new board: the model starts again from its operating point at the next update. */
  restart(): void;
  /** Every frame after the bench's model was synced: the board, the pacing, a request or (main thread) a block. */
  update(dt: number, run: boolean): void;
}

/** The damage of the board now on the bench, as the driver remembers it: its burnt parts and bulged cans. */
export function benchDamage(model: BenchModel): StreamDamage {
  const burnt: string[] = [];
  const bulged: string[] = [];
  for (const p of model.net?.net.parts ?? []) {
    const memory = model.state.parts.get(p.id);
    if (memory?.burnt) burnt.push(p.id);
    else if (memory?.bulged) bulged.push(p.id);
  }
  return { burnt, bulged };
}

export function createLive(ctx: ChapterContext, model: BenchModel, opts: LiveOptions): Live {
  const { rate, block } = LIVE;
  const plan = new BlockPlan({ rate }, false);
  const sound = opts.sound ?? null;
  let stream: Stream | null = null;
  let running = false;
  let fresh = false;
  let clock = 0;
  let sentVersion = -1;
  let taps: readonly ProbeSpec[] = [];
  let since = Number.NaN;
  let lastRevision = -1;
  /** The board the stream was last given: the speaker's tap is its current only while it is in that board. */
  let given: Netlist | null = null;

  /** What a request records: the speaker's tap first (with a speaker), then the scope's. */
  const probes = (): readonly ProbeSpec[] => {
    if (sound === null) return taps;
    const heard = given?.parts.some((p) => p.id === sound.part) ?? false;
    return [heard ? { part: sound.part } : { node: 0 }, ...taps];
  };

  const onBlock = (b: BlockReply): void => {
    if (sound === null) plan.add(clock, block, b.first);
    if (b.revision !== lastRevision) {
      lastRevision = b.revision;
      since = b.first / rate;
    }
    if (sound !== null) {
      sound.play(b.first, b.samples[0]!, b.steps);
      opts.onBlock(b.first, b.samples.slice(1), b.steps);
    } else opts.onBlock(b.first, b.samples, b.steps);
  };

  /** Start the model again (or for the first time) with the board and the damage of this moment. */
  const start = (): void => {
    const net = model.net!.net;
    const damage = benchDamage(model);
    sentVersion = model.version;
    given = net;
    plan.reset(false);
    if (stream === null) {
      stream = createStream(
        ctx,
        { net, rate, block, probes: probes(), damage },
        {
          wants: () => running && (sound === null ? plan.room(clock) > 0 : sound.wants()),
          onBlock,
          mode: opts.frozen ? 'sync' : 'auto',
          makeWorker: opts.makeWorker,
        },
      );
    } else {
      stream.probes(probes());
      stream.restart(net, damage);
    }
    lastRevision = -1;
    opts.onRestart?.();
  };

  return {
    get mode() {
      return stream?.mode ?? 'off';
    },
    rate,
    block,
    get blocks() {
      return stream?.blocks ?? 0;
    },
    get ms() {
      return stream?.ms ?? Number.NaN;
    },
    get since() {
      return since;
    },
    get now() {
      if (stream === null) return null;
      return sound === null ? plan.at(clock) : sound.heard();
    },
    lookahead: (plan.capacity + 1) * block,
    taps(list) {
      const same =
        list.length === taps.length &&
        list.every((p, k) => {
          const q = taps[k]!;
          return 'node' in p ? 'node' in q && q.node === p.node : 'part' in q && q.part === p.part;
        });
      if (same) return;
      taps = list.map((p) => ({ ...p }));
      stream?.probes(probes());
    },
    restart() {
      fresh = true;
    },
    update(dt, run) {
      if (!run || model.net === null || !model.ok) {
        // paused (or nothing good to play): no request; the next start is from the operating point again
        if (!run) running = false;
        return;
      }
      if (stream === null || !running || fresh) {
        fresh = false;
        running = true;
        start();
      } else if (model.version !== sentVersion) {
        // a new solve: the board of this moment, and its damage when that changed (a part burnt there); the speaker's
        // tap with it (in or out of this board), in the same request
        sentVersion = model.version;
        given = model.net.net;
        stream.board(given);
        stream.damage(benchDamage(model));
        stream.probes(probes());
      }
      clock += Math.max(dt, 0);
      stream!.pump();
    },
  };
}
