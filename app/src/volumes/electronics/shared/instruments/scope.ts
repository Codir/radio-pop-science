/**
 * The bench's oscilloscope (docs/volumes/electronics/VISUAL.md §5.2, §2): a `slate` case on the table at the back on
 * the right, its `ink` face toward the reader — the screen of dark glass with its grid of ten by eight divisions, no
 * numbers on it; three knobs; the two inputs with the rings of their channels — and the two probes on their leads, an
 * `ink` handle with a ring of the channel's colour (`lime`, `magenta`), and the ground's black clip on the battery's
 * minus wire by its power terminal (it takes no socket; the scope's ground is the − rail, node 0).
 *
 * What it shows is `scope-model.ts`'s: the samples of the circuit model in time, the voltage of the row each probe is
 * in. The step's board chart (`chart`) is the main trace (the design §6.2); the screen here shows the very same sweep
 * in 160 points (80 pairs of the smallest and the largest sample). The trace is not a light: it is painted in its
 * channel's colour over the glass (`RibbonLines` in the `normal` blend), with no glow and no bloom.
 *
 * Built of the pieces `createScope` of `@/fx` is made of — `createScreen` and `RibbonLines` — and not of `createScope`
 * itself: its traces are drawn again only on its own tick, which runs only when the engine's time moves
 * (`fx/core/tick.ts`), so on a held page (`?freeze`) the window computed at once would never reach the screen; and it
 * holds its trace in 0.8 of the screen's half height and 0.94 of its width, where the scale here is the grid's own.
 *
 * Frames: the case is built in its own (the origin on the table under the middle of the case, +z toward the reader)
 * and the bench slides it in and out on the table (world); the probes, their leads and the ground's lead live in the
 * board's frame (the hand's), as the multimeter's do (`meter.ts`).
 */
import { Group, Mesh, Vector3 } from 'three';
import { RibbonLines, createScreen } from '@/fx';
import { Builder, G } from '@/kit';
import { K, col, type ColorLike } from '@/style';
import type { ChartSpec } from '@/hud';
import type { SocketId } from '@electronics/sim/board';
import { PLACES } from '../bench/layout';
import { DynTube, resample } from '../bench/dyn-tube';
import { disposeTree } from '../parts/part';
import type { StillTap } from '../model';
import { PROBE, createProbePair, type Probe, type ProbePairWorld, type ProbePlaces } from './probe';
import { SCOPE_COLORS, SCREEN_POINTS, ScopeModel, type ScopeSettings, type ScopeSetup, type ScopeWords } from './scope-model';

export type ScopeProbeName = 'ch1' | 'ch2';
export const SCOPE_PROBES: readonly ScopeProbeName[] = ['ch1', 'ch2'];

/** The case (VISUAL §5.2, `PLACES.scope`): 2.4 × 1.4 × 1.9. */
const { width: W, depth: D, height: H } = PLACES.scope;
/** The screen (VISUAL §5.2): 1.6 × 1.28 (5 : 4) on the face, its bottom 0.3 over the table, left of the knobs. */
export const SCOPE_SCREEN = { width: 1.6, height: 1.28, x: -0.25, bottom: 0.3 } as const;
/**
 * The inputs on the face under the screen's left part (case frame), a ring of the channel's colour each: the side of
 * the board, so that the leads leave toward it and never cross the screen.
 */
const JACK = { y: 0.15, x: { ch1: -0.72, ch2: -0.44 } } as const;
/**
 * Where the probes' leads leave the case (the inputs) and where the probes rest (case frame): on the table in front of
 * the scope, lying with their tips toward the reader and their backs toward the inputs. On a phone, where the
 * instrument is not in the shot, on the base in front of the board where the multimeter's rest (VISUAL §9).
 */
const PROBE_PLACES: ProbePlaces<ScopeProbeName> = {
  jack: { ch1: [JACK.x.ch1, JACK.y, D / 2 + 0.07], ch2: [JACK.x.ch2, JACK.y, D / 2 + 0.07] },
  rest: {
    ch1: { x: -0.85, z: D / 2 + 1.5, axis: [0.1, -1] },
    ch2: { x: -0.2, z: D / 2 + 1.6, axis: [0.15, -1] },
  },
  phoneRest: {
    ch1: { x: -2.0 + PROBE.needle + PROBE.guard + PROBE.handle + PROBE.cap, z: 2.3 },
    ch2: { x: 1.4, z: 2.3 },
  },
};
/** How far a probe's tip reaches from its input in plan: to the board's farthest socket (`-1`, ≈ 9.6) and more. */
export const SCOPE_LEAD = { reach: 10.5 } as const;
/**
 * The ground's clip: on the battery's minus wire by its power terminal on the right end of the − rail (VISUAL §3:
 * (2.75; 1.95) of the board's frame), its lead from the ground's jack left of the inputs over the battery's box.
 */
const GROUND = { at: [2.95, 0.12, 1.95], jack: { x: -1.0, y: 0.15 }, radius: 0.03, arch: 1.9 } as const;
/**
 * The grid's tint: `steel` at 0.6 — the platform's screen adds a tenth of it on the lines and draws its rim in it,
 * which at full `steel` is a light frame round the glass (VISUAL §5.2: a grid of `steel` at 0.35 over dark glass).
 */
const GRID = col('steel').multiplyScalar(0.6);
const TRACE = { width: 0.018, lift: 0.006 } as const;

export interface Oscilloscope {
  /** The case on the table (its own frame): the bench slides it in and out (`props.scope`). */
  readonly body: Group;
  /** The probes, their leads and the ground's lead (board frame). */
  readonly leads: Group;
  readonly probes: ReadonlyMap<ScopeProbeName, Probe<ScopeProbeName>>;
  /** What it shows (the sweep, the roll, the chart's points). */
  readonly model: ScopeModel;
  /** The step's scale, display and trigger. */
  readonly settings: ScopeSettings;
  /** A step's scale, display and trigger (the rest the defaults): the sweep and the roll start again. */
  configure(setup: ScopeSetup): void;
  /** Where each probe's tip is. */
  readonly sockets: Readonly<Record<ScopeProbeName, SocketId | null>>;
  /** What the model in time records for the two channels: the node of each probe's row (0, the ground, when out). */
  taps(): StillTap[];
  /** A step puts the tips into sockets at once, or back to rest (null). */
  put(at: Partial<Record<ScopeProbeName, SocketId | null>>): void;
  /** The step's board chart: the main trace. */
  chart(id: string, words: ScopeWords, height?: number): ChartSpec;
  /** Before the hand, every frame: the probes the hand does not hold follow the case (`shown` 0 away … 1 on its
   * place), the leads follow the tips. */
  update(dt: number, shown: number, busy: (name: ScopeProbeName) => boolean): void;
  /** The model's samples (`live.ts`), a channel each, from `first` on. */
  feed(first: number, samples: readonly ArrayLike<number>[]): void;
  /** After the model, every frame: the sweep or the roll up to the sample shown now; the screen when it changed. */
  show(now: number | null): void;
  /** A held page's window (`BenchModel.still`), the first of its samples at the model's moment `start` (s). */
  hold(samples: readonly ArrayLike<number>[], start: number): void;
  /** The model in time started again: nothing of the old board is shown. */
  reset(): void;
  snap(): void;
  dispose(): void;
}

/** The case, the face, the glass's bezel, the knobs and the inputs (no moving part; the screen and traces aside). */
function buildCase(): Group {
  const b = new Builder('scope');
  b.box(W, H, D, { r: 0.12, c: 'slate' });
  b.box(W - 0.14, H - 0.14, 0.02, { at: [0, 0.07, D / 2], r: 0.04, c: 'ink' });
  const { width: sw, height: sh, x: sx, bottom } = SCOPE_SCREEN;
  b.box(sw + 0.08, sh + 0.08, 0.02, { at: [sx, bottom - 0.04, D / 2 + 0.012], r: 0.04, slot: 'gloss', c: 'bg.deep' });
  for (const y of [0.55, 1.0, 1.45])
    b.cyl(0.09, 0.06, { at: [0.85, y, D / 2], rot: [Math.PI / 2, 0, 0], seg: 20, c: 'mist' });
  const jack = (x: number, ring: ColorLike) => {
    b.cyl(0.07, 0.04, { at: [x, JACK.y, D / 2], rot: [Math.PI / 2, 0, 0], seg: 20, c: ring });
    b.cyl(0.035, 0.07, { at: [x, JACK.y, D / 2], rot: [Math.PI / 2, 0, 0], seg: 12, slot: 'metal', c: 'steel' });
  };
  jack(JACK.x.ch1, SCOPE_COLORS[0]);
  jack(JACK.x.ch2, SCOPE_COLORS[1]);
  jack(GROUND.jack.x, 'ink');
  const group = b.build().group;
  group.traverse((o) => void ((o as Mesh).isMesh && ((o.castShadow = true), (o.receiveShadow = true))));
  return group;
}

/** The ground's clip on the battery's minus wire: a small black crocodile, its jaws along the wire. */
function buildClip(): Group {
  const b = new Builder('scope-ground');
  b.box(0.22, 0.06, 0.08, { r: 0.02, c: 'ink' });
  b.box(0.12, 0.04, 0.06, { at: [-0.06, 0.06, 0], r: 0.015, c: 'ink' });
  const group = b.build().group;
  group.name = 'scope:ground';
  group.position.set(...GROUND.at);
  return group;
}

export function createOscilloscope(
  world: ProbePairWorld,
  fs: number,
  lookahead: number,
  setup: ScopeSetup = {},
): Oscilloscope {
  const body = new Group();
  body.name = 'oscilloscope';
  body.add(buildCase());
  // the screen and the two traces, on the glass
  const { width: sw, height: sh, x: sx, bottom } = SCOPE_SCREEN;
  const glass = new Group();
  glass.name = 'scope:screen';
  glass.position.set(sx, bottom + sh / 2, D / 2 + 0.026);
  const screen = createScreen({ width: sw, height: sh, divisions: [10, 8], accent: GRID, radius: 0.03 });
  glass.add(screen);
  const lines = SCOPE_COLORS.map((color, i) => {
    const line = new RibbonLines({
      capacity: SCREEN_POINTS + 2,
      color,
      width: TRACE.width,
      intensity: 1,
      blend: 'normal',
      dashStrength: 0,
      endFade: [0, 0],
      hotCore: 0,
      minPixels: 1.6,
    });
    line.position.z = TRACE.lift * (i + 1);
    line.renderOrder = 2 + i;
    glass.add(line);
    return line;
  });
  body.add(glass);
  const points = SCOPE_COLORS.map(() => Array.from({ length: SCREEN_POINTS }, () => new Vector3()));

  // the two channels' probes: an `ink` handle with a ring of the channel's colour; their sockets are the scope's taps
  const pair = createProbePair(world, {
    what: 'scope',
    names: SCOPE_PROBES,
    colors: { ch1: { handle: 'ink', ring: SCOPE_COLORS[0] }, ch2: { handle: 'ink', ring: SCOPE_COLORS[1] } },
    places: PROBE_PLACES,
    reach: SCOPE_LEAD.reach,
  });
  const { leads, probes, sockets } = pair;
  // the ground's clip and its lead (static: made when the scope has come, hidden while it moves)
  const clip = buildClip();
  leads.add(clip);
  const groundTube = new DynTube(36, 8);
  const groundLead = new Mesh(groundTube.geometry, K.toon({ color: 'ink', gloss: 0.4, highlight: 0.4 }));
  groundLead.name = 'scope:ground-lead';
  groundLead.frustumCulled = false;
  groundLead.receiveShadow = true;
  leads.add(groundLead);
  let groundAt = Number.NaN;

  const model = new ScopeModel(fs, setup, lookahead);
  let drawn = -1;
  const jackWorld = new Vector3();

  /** The ground's lead from its jack over the battery's box down to the clip (board frame). */
  const layGround = (): void => {
    body.localToWorld(jackWorld.set(GROUND.jack.x, GROUND.jack.y, D / 2 + 0.03));
    const from = world.frame.worldToLocal(jackWorld.clone());
    const to = new Vector3(...GROUND.at).add(new Vector3(0.08, 0.02, 0));
    const pts = [
      from,
      from.clone().add(new Vector3(0, 0.1, 0.25)),
      from.clone().lerp(to, 0.5).setY(GROUND.arch),
      to.clone().add(new Vector3(0.35, 0.45, 0)),
      to,
    ];
    const path: Vector3[] = [];
    resample(G.roundPath(pts, 0.4, 8), groundTube.rings, path);
    groundTube.update(path, new Vector3(0, 1, 0), (_i, out) => {
      out[0] = GROUND.radius;
      out[1] = GROUND.radius;
    });
  };

  /** The traces on the glass from the model's screen points, a channel each (a channel off: not drawn). */
  const draw = (): void => {
    for (let c = 0; c < lines.length; c++) {
      const values = model.screen(c);
      const line = lines[c]!;
      line.visible = values !== null;
      if (!values) continue;
      const pts = points[c]!;
      for (let k = 0; k < SCREEN_POINTS; k++) pts[k]!.set((k / (SCREEN_POINTS - 1) - 0.5) * sw, values[k]! * (sh / 2), 0);
      line.setLines([{ points: pts }]);
    }
    drawn = model.version;
  };

  const scope: Oscilloscope = {
    body,
    leads,
    probes,
    model,
    get settings() {
      return model.settings;
    },
    configure(setup) {
      model.settings = setup;
    },
    sockets,
    taps() {
      return SCOPE_PROBES.map((name) => {
        const s = sockets[name];
        return { node: s === null ? 0 : (world.layout.socket(s)?.node ?? 0) };
      });
    },
    put: (at) => pair.put(at),
    chart: (id, words, height) => model.chart(id, words, height),
    update(dt, shown, busy) {
      // the probes the hand does not hold follow the case, and leave with it
      const placed = pair.follow(dt, body, shown, busy);
      const k = Math.min(Math.max(shown, 0), 1);
      // the ground: its clip and lead only while the scope stands on its place (never on a phone: not in its shot)
      const ground = placed && !world.phone();
      clip.visible = groundLead.visible = ground;
      if (ground && groundAt !== k) {
        layGround();
        groundAt = k;
      }
      if (!ground) groundAt = Number.NaN;
      // a channel whose probe is out of the board shows nothing
      SCOPE_PROBES.forEach((name, c) => model.setOn(c, sockets[name] !== null));
    },
    feed(first, samples) {
      model.feed(first, samples);
    },
    show(now) {
      if (now !== null) model.update(now);
      if (model.version !== drawn) draw();
    },
    hold(samples, start) {
      model.hold(samples, start);
      if (model.version !== drawn) draw();
    },
    reset() {
      model.reset();
    },
    snap() {
      pair.snap();
    },
    dispose() {
      pair.dispose();
      groundTube.geometry.dispose();
      (groundLead.material as { dispose(): void }).dispose();
      disposeTree(clip);
      body.removeFromParent();
      disposeTree(body);
    },
  };
  scope.snap();
  draw();
  return scope;
}
