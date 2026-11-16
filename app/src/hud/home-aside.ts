/**
 * The way between the front door and the volumes kept aside (docs/VOLUMES.md §3, DECISIONS §60). On the home
 * screen of the default volume: one secondary button per aside volume, labelled from its manifest
 * (`volume.json → aside.label`). On the home screen of an aside volume: the way back to the default volume.
 * Set apart from the main flow by the home screen (`home.ts` places it at the foot of the screen).
 */
import type { VolumeManifest } from '@/engine/api';
import { Button, Label, UiNode } from '@/ui3d';
import type { Hud } from './shell';

export interface AsideRow {
  readonly node: UiNode;
  /** Fit the row into `room` units of width: a label too long for one line wraps (phones held upright). */
  fit(room: number): void;
}

/** One way out of this home screen: to the default volume, or to an aside volume. */
export interface AsideLink {
  /** QA name: `home-back`, `home-aside-<id>`. */
  readonly name: string;
  readonly label: string;
  readonly icon: 'prev' | 'book';
  readonly volume: string;
}

/** The links of a volume's home screen (none for a volume in the main flow other than the default one). */
export function asideLinks(hud: Hud, volume: VolumeManifest): AsideLink[] {
  const { library } = hud.engine;
  const home = library.defaultVolume;
  if (volume.aside !== null)
    return [{ name: 'home-back', label: `До тому «${home.title}»`, icon: 'prev', volume: home.id }];
  if (volume.id !== home.id) return [];
  return library.aside.map((v) => ({
    name: `home-aside-${v.id}`,
    label: v.aside ?? v.title,
    icon: 'book',
    volume: v.id,
  }));
}

/** Go to a volume from a home screen: its home screen takes over in place (`Hud.register`), or opens. */
export function enterVolume(hud: Hud, id: string): void {
  const { store, nav } = hud.engine;
  // a first visit: the volume's first step loads behind its home screen, not visited until the learner gets there
  if (store.get().lastIn[id] === undefined) hud.landing.arm();
  void nav.gotoVolume(id).then((ok) => {
    if (ok && hud.overlay !== 'home') hud.open('home');
  });
}

/** The row of buttons, or null when this home screen has none. */
export function createAsideRow(hud: Hud, volume: VolumeManifest): AsideRow | null {
  const buttons = asideLinks(hud, volume).map(
    (l) =>
      new Button({
        name: l.name,
        label: l.label,
        icon: l.icon,
        variant: 'ghost',
        onClick: () => enterVolume(hud, l.volume),
      }),
  );
  if (buttons.length === 0) return null;
  const node = new UiNode({
    name: 'home-aside',
    dir: 'row',
    gap: 12,
    wrap: true,
    justify: 'center',
    children: buttons,
  });
  let narrow: boolean | null = null;
  return {
    node,
    fit(room) {
      node.maxW = room;
      // ≈ one line of the longest label at the button's text size, plus the icon and the paddings
      const longest = Math.max(...buttons.map((b) => b.label.length));
      const wrap = longest * 9.5 + 90 > room;
      if (wrap === narrow) return;
      narrow = wrap;
      for (const b of buttons) {
        const text = b.children.find((c): c is Label => c instanceof Label);
        text?.setStyle(wrap ? { nowrap: false, maxWidth: room - 90, align: 'center' } : { nowrap: true });
        b.height = wrap ? 'hug' : 46;
        b.padT = b.padB = wrap ? 9 : 0;
      }
    },
  };
}
