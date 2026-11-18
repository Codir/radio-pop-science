/**
 * The dock of the lab — the controls the game is played with, one declaration per step (`stepUi`): the nuclide
 * card, the projectile choice, the electron counter and the tools of the step, plus the step's honesty chips,
 * hotspots and the board with the readouts and the status line. It also turns the session's events into
 * messages: a toast per event, the status line, a sound.
 *
 * A step shows only the tools its quest allows (the same list `Session.tools` gives: `quests.ts`). While a
 * fission waits for the fragment choice, the tools give way to the two fragment buttons and «Почати знову».
 *
 * Height at 1280×720 (UI_API §3.1): the dock must not scroll. As the plan orders, the card's last row («Заряд і
 * зв'язок») is the caption of the electron counter and the readouts sit on the board; that was still too tall for
 * `free` and `superheavy`, so the status line (passive, like the readouts) joins them on the board and the
 * projectile choice carries its caption as a tooltip.
 */
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import type { ChapterContext } from '@/engine/api';
import { domKit } from '@/hud';
import type { ButtonSpec, ControlSpec, CustomSpec, HonestySpec, HotspotSpec, StepUiApi, StepUiSpec } from '@/hud';
import { SEMANTIC } from '@/style';
import { Label, UiNode } from '@/ui3d';
import { maxElectrons } from '@alchemy/sim/core';
import { ALL_TOOLS, PROJECTILES, isFleeting, questById } from '@alchemy/sim/lab';
import type { GameState, ProjectileId, ToolId } from '@alchemy/sim/lab';
import { createCountStepper } from '@alchemy/shared/count-stepper';
import type { StepId } from '../chapter';
import { L } from '../labels';
import type { AtomView } from './atom-view';
import { FLEETING_DELAY_S, type Session, type SessionEvent } from './session';
import { cardRows, elapsedText, energyText, eventLine, questDoneLine } from './text';

export interface Lab {
  readonly ctx: ChapterContext;
  readonly ui: StepUiApi<StepId>;
  readonly session: Session;
  readonly atom: AtomView;
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
    // hidden while a fragment choice is pending; a «+» still held then must not raise 8 refusals a second
    onStep: (delta) => {
      if (!pending(lab)) session.setElectrons(session.state.electrons + delta);
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
      visible: () => !pending(lab),
    },
    releaseCounter: () => counter.release(),
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
  const dock: Dock = {
    card,
    ...electronCounter(lab, chargeAndBinding),
    status: null,
    won: false,
    sawFleeting: false,
    sawFission: false,
    hideEventToast: null,
    hideResultToast: null,
  };
  docks.set(lab, dock);
  return dock;
}

/** The tools of a step's quest (all of them in the free lab) — what `Session.tools` gives inside the step. */
function toolsOf(step: StepId): readonly ToolId[] {
  return questById(step)?.tools ?? ALL_TOOLS;
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

export function stepSpec(lab: Lab, step: StepId): StepUiSpec {
  const dock = dockOf(lab);
  const { session, ui, atom } = lab;
  const tools = toolsOf(step);
  const projectiles = PROJECTILES.filter((p) => tools.includes(p.id)).map((p) => p.id);
  const free = (): boolean => !pending(lab);
  /** The projectile to fire: the only one of the step, or the one chosen in the dock. */
  const projectile = (): ProjectileId => {
    const chosen = projectiles.length > 1 ? ui.value<string>('projectile') : projectiles[0];
    return projectiles.find((p) => p === chosen) ?? projectiles[0]!;
  };

  const buttons: ButtonSpec[] = [];
  const button = (id: string, label: string, onClick: () => void, visible: () => boolean): void => {
    buttons.push({ type: 'button', id, label, onClick, visible });
  };
  if (projectiles.length > 0) button('fire', L.tools.fire, () => session.fire(projectile()), free);
  if (tools.includes('gamma-n')) button('gamma-n', L.tools.gammaN, () => session.knock('n'), free);
  if (tools.includes('gamma-p')) button('gamma-p', L.tools.gammaP, () => session.knock('p'), free);
  if (tools.includes('wait')) button('wait', L.tools.wait, () => session.wait(), free);
  button('neutral', L.tools.neutral, () => session.neutralise(), () => free() && session.state.electrons !== session.state.z);
  button('pick-heavy', L.fission.heavy, () => session.pickFragment('heavy'), () => pending(lab));
  button('pick-light', L.fission.light, () => session.pickFragment('light'), () => pending(lab));
  button('restart', L.tools.restart, () => session.restart(), () => true);
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
      visible: free,
    });
  }
  controls.push(dock.electrons, ...buttons);

  const hotspots: HotspotSpec[] =
    step === 'heavy-hydrogen'
      ? [
          { anchor: atom.anchors.nucleus, content: 'nucleus' },
          { anchor: atom.anchors.shells, content: 'shells' },
        ]
      : [];
  return {
    controls,
    board: {
      title: L.dock.board,
      size: 'sm',
      children: [
        { type: 'readout', id: 'moves', label: L.dock.moves, digits: 0, get: () => session.state.moves },
        { type: 'readout', id: 'elapsed', label: L.dock.elapsed, text: () => elapsedText(session.state.elapsedSeconds) },
        { type: 'readout', id: 'energy', label: L.dock.energy, text: () => energyText(session.lastQ) },
        {
          type: 'note',
          id: 'status',
          text: () => dock.status?.text ?? '',
          icon: 'info',
          color: () => TONE_COLOR[dock.status?.tone ?? 'info'],
          visible: () => dock.status !== null,
        },
      ],
    },
    honesty: honestyOf(step, dock),
    hotspots,
    // every entry starts a new run: the projectile choice returns to the step's first projectile
    reset: true,
  };
}

/**
 * Tells the player what an event of the session did: a toast (the newest event replaces the previous one), the
 * status line on the board and a sound. Uses the event's own payload — a queued event may be older than the
 * session. A new run (`reset`: an entry or «Почати знову») clears the line and the toasts and says nothing.
 */
export function announce(lab: Lab, e: SessionEvent): void {
  const dock = dockOf(lab);
  switch (e.type) {
    case 'reset':
      dock.status = null;
      dock.won = false;
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
