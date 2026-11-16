/**
 * Area `custom` of the DOM interface (docs/HUD_DOM.md §8, §16): the host of `custom` step-UI controls and
 * `hudLayer(ctx)` (chapter overlays).
 *
 * `customWidget(spec, host)` is what the dock / board (D3) call for a `custom` control under `?hud=dom`:
 * 1. `spec.dom` → the chapter's DOM widget (built once per spec, detached — not disposed — when the step is left);
 * 2. a kit chart node (`HeatMap`, `RadarChart` of `@/ui3d`) → its DOM twin, built from the node's props and
 *    state; the node forwards every later call to the twin (`node.twin`), so chapters keep one object;
 * 3. anything else → null: the caller draws the WebGL `node` (hybrid fallback) and one warning is logged per
 *    control (D9 turns that warning into a `chapter-check` failure when the fallback goes).
 */
import type { CustomSpec, DomHost, DomWidget } from '@/hud/step-ui-types';
import { HeatMap, RadarChart } from '@/ui3d';
import type { DomHud } from '../core/context';
import { DomHeatMap, DomRadarChart } from '../charts';
import { registerDomHud } from './layer';
import './custom.css';

export type { DomHost, DomWidget } from '@/hud/step-ui-types';
export { hudLayer, domHudActive } from './layer';

export function mount(dom: DomHud): void {
  registerDomHud(dom);
}

/** The `DomHost` of the DOM interface: the HUD's tweens on the engine clock and the reduced-motion state. */
export function domHost(dom: DomHud): DomHost {
  return { tweens: dom.hud.host.tweens, reducedMotion: () => dom.hud.host.reducedMotion() };
}

/** DOM twin of a kit chart node, or null for any other node. */
function kitTwin(node: CustomSpec['node'], host: DomHost): DomWidget | null {
  if (node instanceof HeatMap) {
    const cfg = node.cfg;
    const twin = new DomHeatMap({
      ...cfg,
      marker: node.marker ?? undefined,
      // a drag on the twin moves the WebGL node's marker too (its getter stays right), then tells the chapter
      onPick: (x, y, v) => {
        node.twin = null;
        node.setMarker(x, y, false);
        node.twin = twin;
        cfg.onPick?.(x, y, v);
      },
    });
    node.twin = twin;
    return twin;
  }
  if (node instanceof RadarChart) {
    const state = node.snapshot();
    const twin = new DomRadarChart({ ...node.cfg, series: state.series }, host);
    twin.highlight(state.highlighted);
    node.twin = twin;
    return twin;
  }
  return null;
}

const built = new WeakMap<CustomSpec, DomWidget | null>();
const warned = new WeakSet<CustomSpec>();

/**
 * The DOM widget of a `custom` control (once per spec), or null → draw the WebGL node (see the file header).
 * The caller names the element it places `data-ui="ctl-<id>"`, as for every control.
 */
export function customWidget(spec: CustomSpec, host: DomHost): DomWidget | null {
  if (built.has(spec)) return built.get(spec)!;
  const w = spec.dom ? spec.dom(host) : kitTwin(spec.node, host);
  if (!w && !warned.has(spec)) {
    warned.add(spec);
    console.warn(`hud-dom: custom control '${spec.id}' has no 'dom' widget — drawn by the WebGL fallback`);
  }
  built.set(spec, w);
  return w;
}
