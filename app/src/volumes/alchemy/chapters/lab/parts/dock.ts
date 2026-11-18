/**
 * The dock of the lab — the controls the game is played with, one declaration per step (`stepUi`): the nuclide
 * card, the projectile choice, the electron counter and the tools of the step, plus the step's honesty chips,
 * hotspots and the board: the nuclide chart, the collection, the readouts and the status line. It also turns the
 * session's events into messages: a toast per event, the status line, a sound.
 *
 * A step shows only the tools its quest allows (the same list `Session.tools` gives: `quests.ts`). While a
 * fission waits for the fragment choice, the tools give way to the two fragment buttons and «Почати знову».
 * The free lab adds «Новий старт» (`start-picker.ts`): while its choice is open, only the choice is offered — the
 * tools, the projectile choice, the electron counter, «Нейтралізувати» and «Почати знову» give way to the two
 * sliders, «Взяти як старт» and «Скасувати». Its board adds «Почати звідси» for a natural nuclide picked on the chart.
 * Seven buttons would take a fourth row of the action row and make the dock scroll at 1280×720, so in the free lab
 * «Нейтралізувати» takes the place of «Почати знову» while the atom is charged.
 *
 * Height at 1280×720 (UI_API §3.1): the dock must not scroll. As the plan orders, the card's last row («Заряд і
 * зв'язок») is the caption of the electron counter and the readouts sit on the board; that was still too tall for
 * `free` and `superheavy`, so the status line (passive, like the readouts) joins them on the board and the
 * projectile choice carries its caption as a tooltip.
 *
 * Hotspots and callouts of the scene are bound here too: the nucleus, the shells and the emitter in the first
 * step, the countdown ring in `star-forge`, the fission fragments in `fission`; in every step, while a fission
 * waits for the choice, callouts name the two fragments hanging in the scene (picked there or with the buttons).
 *
 * The board is «Карта нуклідів» (plan decision 10): the chart (`nuclide-chart.ts`), the line of a picked cell, the
 * «Уся карта» switch and the collection counters, then the readouts and the status line (and in the free lab the
 * button «Почати звідси», last as on every board). The energy readout has a row of its own under the status line:
 * consecutive readouts share a row, and its «виділилось ≈ 18,6 keV» does not fit beside the other two on a
 * 520-unit board.
 */
import type { Object3D } from 'three';
import { audio } from '@/audio';
import { fmtUnit, NBSP } from '@/content';
import type { ChapterContext } from '@/engine/api';
import { domKit } from '@/hud';
import type {
  ButtonSpec, CalloutSpec, ControlSpec, CustomSpec, HonestySpec, HotspotSpec, StepUiApi, StepUiSpec,
} from '@/hud';
import { SEMANTIC } from '@/style';
import { Label, UiNode } from '@/ui3d';
import { MAX_Z, NUCLIDE_COUNT, maxElectrons, nuclideKey, type NuclideRef } from '@alchemy/sim/core';
import { ALL_TOOLS, PROJECTILES, isFleeting, questById } from '@alchemy/sim/lab';
import type { GameState, ProjectileId, ToolId } from '@alchemy/sim/lab';
import { createCountStepper } from '@alchemy/shared/count-stepper';
import type { StepId } from '../chapter';
import { L } from '../labels';
import type { AtomView } from './atom-view';
import { pickedLine, type ChartView } from './chart-model';
import type { Loaded } from './emitter';
import type { FissionView } from './fission-view';
import { createNuclideChart, type ChartFrame, type NuclideChart } from './nuclide-chart';
import { FLEETING_DELAY_S, type Session, type SessionEvent } from './session';
import { endPicking, isNatural, pickerControls, picking } from './start-picker';
import { cardRows, elapsedText, energyText, eventLine, questDoneLine } from './text';

export interface Lab {
  readonly ctx: ChapterContext;
  readonly ui: StepUiApi<StepId>;
  readonly session: Session;
  readonly atom: AtomView;
  /** What the dock binds to the event animations: the emitter's hotspot anchor and the fission fragments. */
  readonly fx: {
    readonly emitter: Object3D;
    readonly fission: Pick<FissionView, 'anchors' | 'middle' | 'choosing' | 'label'>;
  };
}

type Tone = 'ok' | 'info' | 'warning';

/** What the dock keeps for one chapter instance (one `Lab`): built on first use. */
interface Dock {
  /** The card's rows without the last one (that one is the counter's caption). */
  readonly card: () => readonly (readonly string[])[];
  /** One electron counter for all twelve steps: the same `custom` spec (and node) in every step. */
  readonly electrons: CustomSpec;
  readonly releaseCounter: () => void;
  /** The status line: the latest event, or the quest's result once it is won (until the next run). */
  status: { readonly text: string; readonly tone: Tone } | null;
  won: boolean;
  /** This run has met a fleeting nucleus / a fission: the chips that explain them stay until the next run. */
  sawFleeting: boolean;
  sawFission: boolean;
  /** Hide the toast of the latest event (a newer event replaces it) and the toast of the result. */
  hideEventToast: (() => void) | null;
  hideResultToast: (() => void) | null;
  /** The nuclide chart: one node for all twelve steps (like the counter), and its `custom` control. */
  readonly chart: NuclideChart;
  readonly chartSpec: CustomSpec;
  /** The collection under the chart: discovered elements and nuclides. */
  readonly elements: () => number;
  readonly nuclides: () => number;
  /** The line of the picked nuclide ('' when none). */
  readonly pickedText: () => string;
  /** The nuclide picked on the chart; a new run forgets it. */
  picked: NuclideRef | null;
}

// keyed by the chapter instance: a new instance (the chapter left and entered again) gets a new dock
const docks = new WeakMap<Lab, Dock>();

const TONE_COLOR = { ok: 'ui.ok', info: 'ui.info', warning: 'ui.warning' } as const;
/**
 * Steps whose quest is about a fleeting nucleus (it lives 2 s instead of its real half-life) and steps about a
 * fission (an illustrative split): their chip is always on. Every other step can still reach one with its own
 * tools (⁴H after three shots in `heavy-hydrogen`, ²³⁹Pu split in `plutonium`), so there the chip appears with it.
 */
const FLEETING_STEPS: readonly StepId[] = ['sun', 'star-forge', 'uranium-chain', 'superheavy', 'free'];
const ILLUSTRATIVE_STEPS: readonly StepId[] = ['fission', 'superheavy', 'free'];
/** The main button of a step: the first of these that the step has. */
const PRIMARY_ORDER = ['fire', 'wait', 'gamma-p'] as const;
/** Caption size of the counter (UI.text.caption, the smallest the HUD allows). */
const CAPTION_SIZE = 15;

const pending = (lab: Lab): boolean => lab.session.state.pending !== null;
/** The tools are on offer: no fragment choice is pending and no new start is being chosen. */
const playing = (lab: Lab): boolean => !pending(lab) && !picking(lab);

/**
 * The electron counter («−  N  +», `shared/count-stepper.ts`) with the card's «Заряд і зв'язок» under it — the
 * charge is what the counter changes. Both interfaces: the WebGL node and the DOM twin show the same caption.
 */
function electronCounter(lab: Lab, caption: () => string): Pick<Dock, 'electrons' | 'releaseCounter'> {
  const { session } = lab;
  const counter = createCountStepper({
    id: 'electrons',
    label: L.dock.electrons,
    color: SEMANTIC.electron,
    minus: L.dock.minus,
    plus: L.dock.plus,
    get: () => session.state.electrons,
    min: () => 0,
    max: () => maxElectrons(session.state.z),
    // hidden while a fragment choice is pending (or a new start is chosen); a «+» still held then must not raise
    // 8 refusals a second
    onStep: (delta) => {
      if (playing(lab)) session.setElectrons(session.state.electrons + delta);
    },
  });
  const line = new Label('', { size: CAPTION_SIZE, color: 'mist' }, { width: 'fill' });
  const node = new UiNode({ dir: 'col', gap: 4, width: 'fill', children: [counter.node, line] });
  let view: HTMLElement | null = null;
  let shown = '';
  return {
    electrons: {
      type: 'custom',
      id: 'electrons',
      node,
      dom: () => {
        const { h, setStyle } = domKit;
        view = h('span.dk-cap', null, shown);
        setStyle(view, 'white-space', 'normal');
        const el = h('div', null, counter.dom().el, view);
        setStyle(el, 'display', 'flex');
        setStyle(el, 'flex-direction', 'column');
        setStyle(el, 'gap', 'calc(4 * var(--u))');
        return { el };
      },
      update: (t) => {
        counter.update(t);
        const text = caption();
        if (text === shown) return;
        line.text = shown = text;
        if (view) domKit.setText(view, text);
      },
      visible: () => playing(lab),
    },
    releaseCounter: () => counter.release(),
  };
}

/**
 * What the chart shows, read from the session: the same object until the centre, the trail, the collection or
 * the goal change (a new object makes the chart redraw). The discovered set is rebuilt only with the collection.
 */
function chartViews(lab: Lab): Pick<Dock, 'elements' | 'nuclides'> & { readonly view: () => ChartView } {
  const { session } = lab;
  let keys: readonly string[] | null = null;
  let discovered: ReadonlySet<string> = new Set();
  let elements = 0;
  let view: ChartView | null = null;
  const sync = (): ReadonlySet<string> => {
    const now = session.progress.discovered;
    if (now !== keys) {
      keys = now;
      discovered = new Set(now);
      elements = new Set(now.map((k) => k.slice(0, k.indexOf('-')))).size;
    }
    return discovered;
  };
  return {
    view() {
      const set = sync();
      const { z, n, history } = session.state;
      const goal = session.quest?.goal ?? null;
      if (!view || view.center.z !== z || view.center.n !== n || view.trail !== history || view.discovered !== set || view.goal !== goal)
        view = { center: { z, n }, discovered: set, trail: history, goal };
      return view;
    },
    elements: () => {
      sync();
      return elements;
    },
    nuclides: () => sync().size,
  };
}

function dockOf(lab: Lab): Dock {
  const known = docks.get(lab);
  if (known) return known;
  const { session } = lab;
  // the card changes only with the state (an immutable object): format it once per state
  let carded: GameState | null = null;
  let rows: string[][] = [];
  let caption = '';
  const card = (): string[][] => {
    if (carded !== session.state) {
      const all = cardRows((carded = session.state));
      rows = all.slice(0, -1);
      caption = all.at(-1)?.[1] ?? '';
    }
    return rows;
  };
  const chargeAndBinding = (): string => {
    card();
    return caption;
  };
  const views = chartViews(lab);
  const chart = createNuclideChart({
    view: views.view,
    full: () => lab.ui.value<boolean>('full') === true,
    picked: () => dock.picked,
    onPick: (ref) => {
      dock.picked = ref;
    },
  });
  lab.ctx.onDispose(() => chart.dispose());
  // the picked line changes only with the pick and the collection
  let lineOf: { readonly ref: NuclideRef; readonly view: ChartView } | null = null;
  let line = '';
  const pickedText = (): string => {
    const ref = dock.picked;
    if (!ref) return '';
    const view = views.view();
    if (!lineOf || lineOf.ref !== ref || lineOf.view.discovered !== view.discovered) {
      lineOf = { ref, view };
      line = pickedLine(ref, view.discovered.has(nuclideKey(ref.z, ref.n)));
    }
    return line;
  };
  const dock: Dock = {
    card,
    ...electronCounter(lab, chargeAndBinding),
    status: null,
    won: false,
    sawFleeting: false,
    sawFission: false,
    hideEventToast: null,
    hideResultToast: null,
    chart,
    chartSpec: { type: 'custom', id: 'chart', node: chart.node, dom: chart.dom, update: (t) => chart.update(t) },
    elements: views.elements,
    nuclides: views.nuclides,
    pickedText,
    picked: null,
  };
  docks.set(lab, dock);
  return dock;
}

/** What QA reads of the chart (`__app.read('lab')`): the window on screen and the picked nuclide's key. */
export function chartState(lab: Lab): { readonly chart: ChartFrame; readonly picked: string | null } {
  const dock = dockOf(lab);
  return { chart: dock.chart.frame(), picked: dock.picked ? nuclideKey(dock.picked.z, dock.picked.n) : null };
}

/** The tools of a step's quest (all of them in the free lab) — what `Session.tools` gives inside the step. */
function toolsOf(step: StepId): readonly ToolId[] {
  return questById(step)?.tools ?? ALL_TOOLS;
}

const projectilesOf = (step: StepId): ProjectileId[] =>
  PROJECTILES.filter((p) => toolsOf(step).includes(p.id)).map((p) => p.id);
const knocksOut = (step: StepId): boolean => toolsOf(step).some((t) => t === 'gamma-n' || t === 'gamma-p');

/** The projectile «Вистрілити» sends in `step`: the only one of the step, or the one chosen in the dock. */
function chosenProjectile(lab: Lab, step: StepId): ProjectileId | null {
  const projectiles = projectilesOf(step);
  if (projectiles.length === 0) return null;
  const chosen = projectiles.length > 1 ? lab.ui.value<string>('projectile') : projectiles[0];
  return projectiles.find((p) => p === chosen) ?? projectiles[0]!;
}

/** The step shoots or knocks out nucleons: it has the emitter. */
export const hasEmitter = (step: StepId): boolean => projectilesOf(step).length > 0 || knocksOut(step);

/** What the emitter holds ready now: the projectile to fire, a γ source where the step only knocks out, or nothing. */
export function loaded(lab: Lab): Loaded {
  const step = lab.session.step;
  return chosenProjectile(lab, step) ?? (knocksOut(step) ? 'gamma' : null);
}

/** Every step has all five chips; in this order they pack into the fewest rows of the step panel. */
function honestyOf(step: StepId, dock: Dock): HonestySpec[] {
  const slowed = { slowed: 1e15, text: `${L.honesty.fleeting} ${fmtUnit(FLEETING_DELAY_S, L.units.second)}` };
  return [
    'simplified',
    'notToScale',
    { text: L.honesty.waitSkipped },
    ILLUSTRATIVE_STEPS.includes(step) ? 'illustrative' : { kind: 'illustrative', visible: () => dock.sawFission },
    FLEETING_STEPS.includes(step) ? slowed : { ...slowed, visible: () => dock.sawFleeting },
  ];
}

/**
 * «Почати звідси» on the free lab's board: a new run from the natural nuclide picked on the chart — what «Взяти як
 * старт» does for the dock's choice. Not while a fragment choice is pending or a new start is chosen in the dock.
 */
function startHere(lab: Lab, dock: Dock): ButtonSpec {
  return {
    type: 'button',
    id: 'start-here',
    label: L.free.startHere,
    onClick: () => {
      const ref = dock.picked;
      if (ref && playing(lab)) lab.session.startFrom(ref.z, ref.n); // a new run forgets the pick
    },
    visible: () => {
      const ref = dock.picked;
      return ref !== null && playing(lab) && isNatural(ref);
    },
  };
}

export function stepSpec(lab: Lab, step: StepId): StepUiSpec {
  const dock = dockOf(lab);
  const { session, atom, fx } = lab;
  const tools = toolsOf(step);
  const projectiles = projectilesOf(step);
  const ready = (): boolean => playing(lab);
  const choosing = (): boolean => picking(lab);
  /** «Нейтралізувати» is on offer: the tools are, and the atom is charged. */
  const neutralising = (): boolean => ready() && session.state.electrons !== session.state.z;
  const projectile = (): ProjectileId => chosenProjectile(lab, step)!;

  const buttons: ButtonSpec[] = [];
  const button = (id: string, label: string, onClick: () => void, visible: () => boolean): void => {
    buttons.push({ type: 'button', id, label, onClick, visible });
  };
  if (projectiles.length > 0) button('fire', L.tools.fire, () => session.fire(projectile()), ready);
  if (tools.includes('gamma-n')) button('gamma-n', L.tools.gammaN, () => session.knock('n'), ready);
  if (tools.includes('gamma-p')) button('gamma-p', L.tools.gammaP, () => session.knock('p'), ready);
  if (tools.includes('wait')) button('wait', L.tools.wait, () => session.wait(), ready);
  button('neutral', L.tools.neutral, () => session.neutralise(), neutralising);
  button('pick-heavy', L.fission.heavy, () => session.pickFragment('heavy'), () => pending(lab) && !choosing());
  button('pick-light', L.fission.light, () => session.pickFragment('light'), () => pending(lab) && !choosing());
  // the free lab's action row holds six buttons at 1280×720 (three rows; a fourth makes the dock scroll): there
  // «Нейтралізувати» takes the place of «Почати знову» while it is on offer
  const restartShown = step === 'free' ? () => !choosing() && !neutralising() : () => !choosing();
  button('restart', L.tools.restart, () => session.restart(), restartShown);
  const primary = PRIMARY_ORDER.find((id) => buttons.some((b) => b.id === id));
  for (const b of buttons) if (b.id === primary) b.primary = true;

  const controls: ControlSpec[] = [{ type: 'table', id: 'card', rows: dock.card }];
  if (projectiles.length > 1) {
    controls.push({
      type: 'segmented',
      id: 'projectile',
      hint: L.dock.projectile,
      items: projectiles.map((id) => ({ id, label: PROJECTILES.find((p) => p.id === id)!.symbol })),
      value: projectiles[0],
      visible: ready,
    });
  }
  controls.push(dock.electrons, ...buttons);
  // the free lab: «Новий старт» after «Почати знову»; its sliders go to the top of the dock (UI_API §3)
  if (step === 'free') controls.push(...pickerControls(lab));

  const HOTSPOTS: Partial<Record<StepId, HotspotSpec[]>> = {
    'heavy-hydrogen': [
      { anchor: atom.anchors.nucleus, content: 'nucleus' },
      { anchor: atom.anchors.shells, content: 'shells' },
      { anchor: fx.emitter, content: 'emitter' },
    ],
    'star-forge': [{ anchor: atom.anchors.countdown, content: 'countdown', visible: () => atom.counting }],
    fission: [{ anchor: fx.fission.middle, content: 'fragments', visible: () => fx.fission.choosing }],
  };
  // a fission can happen in several steps (plutonium, superheavy, free): its fragments are named in every one
  const callouts: CalloutSpec[] = (['heavy', 'light'] as const).map((which) => ({
    anchor: fx.fission.anchors[which],
    text: () => fx.fission.label(which),
    side: which === 'heavy' ? 'up' : 'down',
    visible: () => fx.fission.choosing,
  }));
  return {
    controls,
    board: {
      title: L.chart.title,
      size: 'md',
      children: [
        dock.chartSpec,
        { type: 'note', id: 'picked', text: dock.pickedText, icon: 'target', color: 'mist', visible: () => dock.picked !== null },
        { type: 'toggle', id: 'full', label: L.chart.full, value: false },
        {
          type: 'stats',
          id: 'collection',
          columns: 2,
          items: [
            { label: L.chart.elements, get: () => `${dock.elements()}${NBSP}/${NBSP}${MAX_Z}` },
            { label: L.chart.nuclides, get: () => `${dock.nuclides()}${NBSP}/${NBSP}${NUCLIDE_COUNT}` },
          ],
        },
        { type: 'readout', id: 'moves', label: L.dock.moves, digits: 0, get: () => session.state.moves },
        { type: 'readout', id: 'elapsed', label: L.dock.elapsed, text: () => elapsedText(session.state.elapsedSeconds) },
        {
          type: 'note',
          id: 'status',
          text: () => dock.status?.text ?? '',
          icon: 'info',
          color: () => TONE_COLOR[dock.status?.tone ?? 'info'],
          visible: () => dock.status !== null,
        },
        // after the status line, not next to the other two: in their row its long text would overrun the board
        { type: 'readout', id: 'energy', label: L.dock.energy, text: () => energyText(session.lastQ) },
        // (a board shows its buttons last)
        ...(step === 'free' ? [startHere(lab, dock)] : []),
      ],
    },
    honesty: honestyOf(step, dock),
    hotspots: HOTSPOTS[step] ?? [],
    callouts,
    // every entry starts a new run: the projectile choice returns to the step's first projectile
    reset: true,
  };
}

/**
 * Tells the player what an event of the session did: a toast (the newest event replaces the previous one), the
 * status line on the board and a sound. Uses the event's own payload — a queued event may be older than the
 * session. A new run (`reset`: an entry, «Почати знову», a new start) clears the line and the toasts, forgets the
 * chart's pick, closes the choice of a new start and says nothing.
 */
export function announce(lab: Lab, e: SessionEvent): void {
  const dock = dockOf(lab);
  switch (e.type) {
    case 'reset':
      endPicking(lab);
      dock.status = null;
      dock.won = false;
      dock.picked = null;
      dock.sawFleeting = isFleeting(e.state);
      dock.sawFission = e.state.fissioned;
      dock.hideEventToast?.();
      dock.hideResultToast?.();
      dock.hideEventToast = dock.hideResultToast = null;
      dock.releaseCounter();
      return;
    case 'done': {
      const text = questDoneLine(e.moves, e.best);
      dock.status = { text, tone: 'ok' };
      dock.won = true;
      dock.hideResultToast?.();
      dock.hideResultToast = lab.ui.toast(text, { icon: 'star', tone: 'ok', duration: 6 });
      audio.play('success');
      return;
    }
    case 'turn': {
      if (isFleeting(e.after)) dock.sawFleeting = true;
      if (e.after.fissioned || e.after.pending !== null) dock.sawFission = true;
      if (e.after.pending !== null) dock.releaseCounter();
      const line = eventLine(e.event);
      if (!dock.won) dock.status = line;
      // the counter shows its own number: a toast per electron (8 a second while «+» is held) would be noise
      if (e.event.type === 'electrons') return;
      dock.hideEventToast?.();
      dock.hideEventToast = lab.ui.toast(line.text, { tone: line.tone });
      if (line.tone === 'warning') audio.play('error', { gain: 0.5 });
      else audio.play('click');
    }
  }
}
