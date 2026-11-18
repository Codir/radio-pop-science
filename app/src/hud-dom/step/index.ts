/**
 * Area `step` of the DOM interface (docs/HUD_DOM.md §16): header, step panel (sections, «Див. також»,
 * reading-level switch) and step navigator. Data from the shared view models (`hud/model/`).
 *
 * The step panel lives in the DOM column of `hud-dom/dock` (D3), which places it, runs the height budget through
 * the panel's sizing API; on touch shells the DOM sheet (`hud-dom/touch`) hosts it. Header and navigator are drawn on
 * every shell; the touch shells restyle them (`touch/touch.css`: compact header, navigation row / pill).
 */
import type { DomHud } from '../core/context';
import { setClass } from '../core/dom';
import { uiSounds } from '../chrome/sounds';
import { createDomHeader } from './header';
import { createDomNavigator } from './navigator';
import { createDomStepPanel, type DomStepPanel } from './step-panel';
import './step.css';

let stepPanel: DomStepPanel | null = null;

/** The DOM step panel (null before the mount): D3's column places `el` and calls its sizing API. */
export function domStepPanel(): DomStepPanel | null {
  return stepPanel;
}

export function mount(dom: DomHud): void {
  const { hud, webgl } = dom;
  const header = createDomHeader(hud, () => dom.root.querySelector<HTMLElement>('[data-region="system"]'));
  const panel = createDomStepPanel(hud);
  stepPanel = panel;
  const navigator = createDomNavigator(hud);
  for (const el of [header.el, panel.el, navigator.el]) uiSounds(el);

  dom.claim('header');
  // the WebGL header stays in the layout at opacity 0 on every shell: the WebGL column and board are placed under its box
  webgl.header.opacity = 0;
  dom.region(
    {
      el: header.el,
      onChapter: (m) => header.onChapter(m),
      onLayout: (m) => {
        header.onLayout(m);
        // layout classes of the desktop shell (`wide` is the core's): CSS of every area may key on them
        for (const l of ['wide', 'narrow', 'portrait'] as const) setClass(dom.root, `kd-layout-${l}`, m.layout === l);
      },
    },
    { inset: { side: 'top', extra: 8 }, region: 'header' },
  );

  // placed and sized by the DOM column (`hud-dom/dock`, `fit` / `chrome` / `want` / `setCompact`)
  dom.claim('step-panel');
  dom.region({
    el: panel.el,
    onContent: (c) => panel.onContent(c),
    onChapter: (m) => panel.onChapter(m),
    onStep: (id, instant) => panel.onStep(id, instant),
    update: () => panel.update(),
  });

  dom.claim('navigator');
  webgl.navigator.visible = false;
  dom.region(
    {
      el: navigator.el,
      onChapter: (m) => navigator.onChapter(m),
      onStep: () => navigator.sync(),
      update: () => navigator.update(),
      onLayout: (m) => {
        navigator.onLayout(m);
      },
    },
    { inset: { side: 'bottom', extra: 8 }, region: 'navigator' },
  );
}
