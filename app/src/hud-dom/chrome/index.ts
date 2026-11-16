/**
 * Area `chrome` of the DOM interface (docs/HUD_DOM.md §16): spine, system row, tooltips, toasts, loading pill;
 * the onboarding hints are toasts (`hud/hints.ts installOnboarding` → `hud.toast` → the DOM stack).
 * Every shell: on phones and tablets the touch area restyles them (`touch/touch.css`: the spine is hidden, the system
 * row keeps the map and the menu button).
 */
import type { VolumeManifest } from '@/engine/api';
import { journeyFromManifests, loadJourney, wantsFixture } from '@/hud/journey';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { findNode } from '../core/webgl';
import { createDomLoading } from './loading';
import { uiSounds } from './sounds';
import { createDomSpine, type DomSpine } from './spine';
import { createDomSystem } from './system';
import { createDomToasts } from './toasts';
import { createTooltips } from './tooltips';
import './chrome.css';

export function mount(dom: DomHud): void {
  const { hud, webgl } = dom;
  const { engine } = hud;
  const desk = (): boolean => hud.metrics.shell === 'desk';

  // ---- spine: one per volume, the one of the chapter on screen is shown
  const spines = new Map<string, DomSpine>();
  const host = h('div.kd-spine-host');
  let volumeId = '';
  let chapterId = '';
  const showSpine = (v: VolumeManifest): void => {
    let s = spines.get(v.id);
    if (!s) {
      const registry = engine.library.registry(v.id);
      if (registry && !(wantsFixture() && v.fixtures?.journey)) s = createDomSpine(hud, journeyFromManifests(v, registry.chapters));
      else {
        // the journey fixture (`?fixture`) arrives asynchronously, as in the WebGL plugin
        void loadJourney(engine, v).then((j) => {
          if (spines.has(v.id)) return;
          spines.set(v.id, createDomSpine(hud, j));
          if (volumeId === v.id) showSpine(v);
        });
        return;
      }
      spines.set(v.id, s);
    }
    s.refresh();
    if (chapterId) s.setChapter(chapterId);
    host.replaceChildren(s.el);
    hud.relayout();
  };
  uiSounds(host);
  engine.store.subscribe((st) => st.progress, () => spines.get(volumeId)?.refresh());
  dom.claim('spine');
  dom.region(
    {
      el: host,
      onVolume: (v) => {
        volumeId = v.id;
        showSpine(v);
      },
      onChapter: (m) => {
        chapterId = m.id;
        if (m.volume === volumeId) spines.get(volumeId)?.setChapter(m.id);
      },
      onLayout: (m) => {
        host.hidden = !(m.layout === 'wide' && desk());
      },
      update: () => {
        const gl = webgl.spine();
        if (gl) gl.visible = false;
      },
    },
    { inset: { side: 'left', extra: 6 }, region: 'spine' },
  );

  // ---- system row
  const system = createDomSystem(hud);
  uiSounds(system.el);
  dom.claim('system');
  dom.region(
    {
      el: system.el,
      onVolume: () => system.onVolume(),
      onLayout: () => (webgl.system.visible = false),
    },
    { region: 'system' },
  );

  // ---- tooltips of the DOM controls (3D objects keep the WebGL tooltip until D6), toasts, loading pill
  dom.claim('tooltips');
  const tips = createTooltips(hud, dom.root);
  dom.region({ el: tips.el, update: () => tips.update() }, { layer: 'tip' });

  dom.claim('toasts');
  const toasts = createDomToasts(hud);
  dom.region({ el: toasts.el, onLayout: () => toasts.place() }, { layer: 'tip' });

  dom.claim('loading');
  const loading = createDomLoading(hud);
  const glLoading = findNode(hud.chrome, 'loading');
  dom.region({
    el: loading.el,
    update: (dt) => {
      loading.update(dt);
      if (glLoading) glLoading.visible = false;
    },
  });
}
