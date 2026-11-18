/**
 * `dive` — «Углиб дроту». The depth slider IS the dive (DECISIONS §60 p, UI_API §3.3), from the lens in its holder
 * on: its first stretch (0…`LEAD`) is the take of the lens — it rises out of its holder, crosses the stand and
 * settles on the near wire while the camera comes with it to the dive's start —, the rest is the dive itself
 * (camera, `deep`, the ring, the dissolve, the metal turning into rows). Drag it and the scene follows the hand both
 * ways (`world.scrub`; back to 0 lays the lens back in its holder), let go anywhere and it stays; click the track or
 * use the keys and it glides there (`world.travelTo`, speed-limited). A tap or a drag on the lens itself glides the
 * slider through the lens stretch — the same motion (the owner, 2026-11-17: «має бути видно ще рух лупи»). The
 * three names stand as marks: стенд (0) · усередині дроту · ряди кульок. The goal holds after 2 s at the end.
 *
 * The switch is the reader's here too (`switch.ts`); the moment the reader starts the dive — the slider in any way,
 * or the lens — an open switch closes by itself and the light comes on in that frame (the owner, 2026-11-17).
 */
import type { ChapterContext } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import { LENS_LEG, type CircuitWorld } from '@circuit/shared/world';
import type { PartNames } from './parts';

/**
 * Length of the lens stretch on the slider: the rail's lens leg (−½…0), a fifth of the track — long enough to read
 * as its own motion (≈ 1.6 s when a click glides through it), short enough that the three marks keep room for their
 * names on a phone (at 0 · 0.6 · 1 of the track; a third of the track pushed «усередині дроту» into «ряди кульок»).
 */
export const LEAD = LENS_LEG;
/** The rail's end for the prologue: «ряди» (2); the prologue does not go to one atom. */
const END = 2;
/** Seconds at the end before the takeaway (script: «пробув там щонайменше 2 s»). */
const DWELL = 2;

export interface DiveStep {
  spec: StepUiSpec;
  enter(): void;
  update(dt: number): void;
  /** For the interaction test (`__app.read('prologue')`). */
  state(): {
    lens: number;
    slider: number;
    /** The rail's position (−½ the lens in its holder … 0 on the wire … 2 «ряди»). */
    position: number;
    /** The same in slider units (`position + LEAD`): what the track's fill shows. */
    at: number;
    moving: boolean;
    dwell: number;
    /** The step's own «лупа» callout is up. */
    named: boolean;
  };
}

export function diveStep(
  ctx: ChapterContext,
  world: CircuitWorld,
  ui: StepUiApi,
  labels: readonly string[],
  names: PartNames,
  /** True while the step's panel is held back (the unfolding plays): the depth slider waits with the text. */
  held: () => boolean,
  /** The reader started the dive (the scene closes an open switch). */
  started: () => void,
  /** Another step's name for the lens (`riddle`: «позначена іскорка» on hover), with when it applies. */
  otherName?: { text: string; when: () => boolean },
): DiveStep {
  const [lensLabel = '', wheelLabel = '', ...stopLabels] = labels;
  const lens = world.stand.tools.lens;
  let dwell = 0;
  let shownFill = -1;
  let calling = true;
  const active = (): boolean => ctx.stage.current === 'dive';
  /**
   * The lens is the reader's only once it lies in its holder: not while the flashlight unfolds (it is still inside
   * the flashlight or growing out of it, and with an orbited camera its spot is on screen as empty air).
   */
  const placed = (): boolean => active() && !held();
  const lensOn = (): boolean => world.value('lens') > 0.99;
  /** The reader's first touch of the dive: names go, an open switch closes. */
  const touch = (): void => {
    names.dismiss();
    started();
  };

  const take = (): void => {
    // only from the lens stretch: once the slider is past it the lens already lies on the wire
    if (!placed() || world.goal >= 0) return;
    touch();
    ui.set('depth', LEAD);
    world.takeLens();
  };
  // one registration for the lens (a second one on its glass would swallow the tap that takes it here)
  const other = (): boolean => otherName?.when() ?? false;
  ctx.input.register(lens.group, {
    tooltip: () => (other() ? (otherName?.text ?? '') : lensLabel),
    cursor: 'grab',
    enabled: () => (placed() && world.goal < 0) || other(),
    click: take,
    dragEnd: take,
  });
  const anchor = lens.glass.position.clone();
  const named = (): boolean => placed() && world.value('lens') < 0.01 && !names.shown && world.deep < 0.01;
  ctx.qa.probe('lens', () => lens.glass.getWorldPosition(anchor));

  const spec: StepUiSpec = {
    reset: true,
    controls: [
      {
        type: 'slider',
        id: 'depth',
        label: wheelLabel,
        min: 0,
        max: LEAD + END,
        value: 0,
        step: 0.005,
        marks: [0, LEAD + 1, LEAD + 2].map((v, i) => ({ value: v, label: stopLabels[i] ?? '' })),
        format: (v) => stopLabels[Math.round(Math.max(v - LEAD, 0))] ?? '',
        // held with the panel's text (stepUi `panel.hiddenUntil` holds only the text: requests §7); never blocked
        visible: () => !held(),
        // UI_API §3.3: the thumb is the target; a drag is followed frame by frame, a click on the track or a key
        // glides there; the track's fill shows where the dive is now (`current`, patched in `update`)
        onChange: (v) => {
          touch();
          world.travelTo(v - LEAD);
        },
        onInput: (v, how) => {
          if (how === 'drag') world.scrub(v - LEAD);
        },
      },
    ],
    callouts: [
      ...names.callouts,
      {
        anchor: () => lens.glass.getWorldPosition(anchor),
        text: lensLabel,
        visible: named,
      },
    ],
    goal: () => lensOn() && dwell >= DWELL,
  };
  return {
    spec,
    enter() {
      dwell = 0;
      calling = true;
      names.reset();
      // a deep link lands on the stand with the lens in its holder, the slider at the start
      ui.set('depth', 0);
    },
    update(dt) {
      if (!active()) return;
      const at = world.position + LEAD;
      if (Math.abs(at - shownFill) > 0.002) ui.patch('depth', { current: (shownFill = at) });
      // the ring stops calling «take me» once the lens has left its holder
      if (calling && world.position > -0.995) {
        calling = false;
        ctx.stage.setParam('lensCall', 0, { duration: 0.4 });
      }
      dwell = world.position > END - 0.005 && world.goal > END - 0.005 ? dwell + dt : 0;
    },
    state: () => ({
      lens: world.value('lens'),
      slider: Number(ui.value('depth')),
      position: world.position,
      at: world.position + LEAD,
      moving: world.position !== world.goal,
      dwell,
      named: named(),
    }),
  };
}
