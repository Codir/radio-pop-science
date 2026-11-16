/**
 * Placeholder scene of the path sandboxes: a table, a wire (copper core, plastic sheath) and a lamp. It gives
 * the step panel something calm to sit over and exercises the path panel's goal: each step's first N captions
 * («Підписи» of the document) become dock buttons, and the step's goal (`stepUi … goal`) holds once every one
 * of them was pressed — then the panel shows the takeaway and the lamp lights up. The real `circuit` scenes are
 * built by the volume's builders.
 */
import { CylinderGeometry, Mesh, SphereGeometry } from 'three';
import type { ChapterContent } from '@/content';
import { defineScene, type SceneModule } from '@/engine/api';
import { stepUi } from '@/hud';
import { K } from '@/style';

const SHOTS: readonly { position: [number, number, number]; target: [number, number, number] }[] = [
  { position: [0, 2.4, 7.5], target: [0, 0, 0] },
  { position: [2.6, 1.6, 4.6], target: [0.4, 0.2, 0] },
];

/** A slider that scrubs the scene (UI_API §3.3): its caption and the captions of its three marks, by index. */
export interface ScrubSpec {
  readonly label: number;
  readonly marks: readonly [number, number, number];
}

/**
 * @param buttons step id → how many of its first captions are the step's action buttons
 * @param opts `holdNav`: steps whose navigator stays hidden until their goal (stepUi `nav.hiddenUntil`);
 *   `scrub`: steps with a slider that scrubs the core along the wire and the lamp's glow
 */
export function placeholderScene(
  content: ChapterContent,
  buttons: Readonly<Record<string, number>>,
  opts: { holdNav?: readonly string[]; scrub?: Readonly<Record<string, ScrubSpec>> } = {},
): SceneModule {
  const steps = content.steps.map((s) => s.id);
  return defineScene((ctx) => {
    const { root, stage, camera } = ctx;
    const table = new Mesh(
      new CylinderGeometry(4.6, 4.8, 0.2, 72),
      K.toon({ color: 'bg.indigo', gloss: 0.15 }),
    );
    table.position.y = -0.7;
    table.receiveShadow = true;
    const core = new Mesh(new CylinderGeometry(0.05, 0.05, 4.2, 20), K.toon({ color: 'amber', gloss: 0.9 }));
    core.rotation.z = Math.PI / 2;
    const sheath = new Mesh(
      new CylinderGeometry(0.12, 0.12, 3.2, 28),
      K.toon({ color: 'slate', gloss: 0.3 }),
    );
    sheath.rotation.z = Math.PI / 2;
    sheath.position.x = -0.5;
    const glow = K.glow({ color: 'yellow', intensity: 0.25, falloff: 2 });
    const lamp = new Mesh(new SphereGeometry(0.34, 32, 20), glow);
    lamp.position.set(2.5, 0.1, 0);
    for (const m of [core, sheath]) m.castShadow = true;
    root.add(table, core, sheath, lamp);
    camera.shots(Object.fromEntries(steps.map((s, i) => [`s${i}`, SHOTS[i % SHOTS.length]!])));
    stage.define(
      Object.fromEntries(steps.map((s, i) => [s, { show: [table, core, sheath, lamp], camera: `s${i}` }])),
    );

    // the scrubbed state: `target` from the slider, `shown` follows it — directly while the thumb is dragged,
    // eased after a click on the track or a key (UI_API §3.3)
    const scrub = { target: 0, shown: 0, drag: false, reported: -1 };
    const pressed = new Map<string, Set<string>>();
    const reached = (id: string): boolean => (pressed.get(id)?.size ?? 0) >= (buttons[id] ?? 0);
    // one binding per chapter: `stepUi(ctx)` again would start a new, empty one
    const api = stepUi(ctx);
    api.define(
      Object.fromEntries(
        content.steps.map((s) => {
          const labels = (s.labels ?? []).slice(0, buttons[s.id] ?? 0);
          const controls = labels.map((label, k) => ({
            type: 'button' as const,
            id: `${s.id}-do-${k}`,
            label,
            primary: k === 0,
            onClick: () => pressed.set(s.id, new Set([...(pressed.get(s.id) ?? []), label])),
          }));
          const sc = opts.scrub?.[s.id];
          const caption = (i: number): string => s.labels?.[i] ?? '';
          const slider = sc
            ? [
                {
                  type: 'slider' as const,
                  id: `${s.id}-scrub`,
                  label: caption(sc.label),
                  min: 0,
                  max: 1,
                  value: 0,
                  format: () => '',
                  marks: sc.marks.map((i, k) => ({ value: k / 2, label: caption(i) })),
                  onChange: (v: number) => (scrub.target = v),
                  onInput: (_v: number, how: 'drag' | 'jump' | 'step') => (scrub.drag = how === 'drag'),
                },
              ]
            : [];
          const goal = (): boolean => reached(s.id) && (!sc || scrub.shown > 0.98);
          const nav = opts.holdNav?.includes(s.id) ? { hiddenUntil: 'goal' as const } : undefined;
          return [s.id, { controls: [...controls, ...slider], reset: true, goal, nav }];
        }),
      ),
    );
    return {
      update(dt, t) {
        const id = stage.current ?? '';
        if (opts.scrub?.[id]) {
          scrub.shown = scrub.drag
            ? scrub.target
            : scrub.shown + (scrub.target - scrub.shown) * (1 - Math.exp(-dt / 0.25));
          core.position.x = scrub.shown * 0.8;
          if (Math.abs(scrub.shown - scrub.reported) > 0.002)
            api.patch(`${id}-scrub`, { current: (scrub.reported = scrub.shown) });
        }
        const lit = reached(stage.current ?? '') ? 1.6 : 0.25;
        glow.intensity += (lit - glow.intensity) * Math.min(1, dt * 4);
        lamp.scale.setScalar(1 + 0.03 * Math.sin(t * 2));
      },
    };
  });
}
