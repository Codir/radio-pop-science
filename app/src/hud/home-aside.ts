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

/** The row of buttons, or null when this home screen has none. */
export function createAsideRow(hud: Hud, volume: VolumeManifest): AsideRow | null {
  const { library, store, nav } = hud.engine;
  const home = library.defaultVolume;
  const enter = (id: string): void => {
    // a first visit: the volume's first step loads behind its home screen, not visited until the learner gets there
    if (store.get().lastIn[id] === undefined) hud.landing.arm();
    // the home screen of the volume entered takes over in place (`Hud.register`); open it if none was open
    void nav.gotoVolume(id).then((ok) => {
      if (ok && hud.overlay !== 'home') hud.open('home');
    });
  };
  const buttons =
    volume.aside !== null
      ? [
          new Button({
            name: 'home-back',
            label: `До тому «${home.title}»`,
            icon: 'prev',
            variant: 'ghost',
            onClick: () => enter(home.id),
          }),
        ]
      : volume.id === home.id
        ? library.aside.map(
            (v) =>
              new Button({
                name: `home-aside-${v.id}`,
                label: v.aside ?? v.title,
                icon: 'book',
                variant: 'ghost',
                onClick: () => enter(v.id),
              }),
          )
        : [];
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
