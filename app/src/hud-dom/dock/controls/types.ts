/**
 * What every DOM control of the dock and the board gives its builder (`../build.ts`): the element named
 * `ctl-<id>` and the hooks of the step-UI binding (`ui.set`, `ui.patch`, `ui.press`, `disabled`, per-frame work).
 */
import type { ControlPatch } from '@/hud/step-ui';

export type Value = number | boolean | string;

export interface DomControl {
  readonly el: HTMLElement;
  /** Programmatic value (`ui.set`): the widget follows, nothing is notified. */
  set?(value: Value): void;
  /** Inputs: grey out and refuse input. */
  setDisabled?(on: boolean): void;
  /** Live label / range (`ui.patch`). */
  patch?(p: ControlPatch): void;
  /** Press feedback of a scripted press (`ui.press`). */
  flash?(): void;
  /** Per-frame work while on screen (polled values); `t` = engine time, seconds. */
  tick?(t: number): void;
  /** The column's layout pass (the only place a control may read layout): size-dependent choices. */
  layout?(): void;
  /** The step is left. */
  dispose?(): void;
}

let serial = 0;
/** A document-unique id for `<label for>` / `aria-labelledby`. */
export const uid = (id: string): string => `kd-ctl-${id.replace(/[^\w-]/g, '_')}-${++serial}`;
