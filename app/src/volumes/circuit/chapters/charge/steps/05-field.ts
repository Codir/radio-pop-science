/**
 * `charge/field` — «Довкола заряду». On the table again: the rubbed balloon of `rub` hangs still on its thread;
 * the reader carries a pea-sized «+» probe around it. A thick `amber` arrow on the probe points to the balloon,
 * its length ∝ 1 / d² (capped); wherever the probe has been a pale short copy stays (≤ 40, the oldest fade), and
 * the picture of the field grows out of them (no field lines: VISUAL §7). Goal: ≥ 8 places, among them two
 * distances that differ at least threefold.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { StepInfo } from '@/engine/api';
import { createOrbs, ORB_STYLES } from '@/fx';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { createArrow } from '../parts/arrow';
import { BALLOON_R, BALLOON_TALL } from '../parts/balloon';
import { HANG_Y } from '../parts/hanger';
import { createTrail } from '../parts/trail';
import { BALLOON_AWAY, FIGURE_ASIDE, RUB_PLANE_NORMAL } from '../layout';
import type { RubState } from '../parts/rub-state';

const PROBE_R = 0.12;
/** Arrow length = K / d² (d = distance to the balloon's centre), capped. */
const K = 0.62;
const MAX = 0.9;
/** The pale copies: never shorter than this (far from the balloon they stay readable arrows), nor longer. */
const COPY = [0.34, 0.8] as const;
/** A new pale copy once the probe moved this far from the last one. */
const SPACING = 0.36;
/** The probe keeps within this distance of the balloon (world units), so the arrow stays in the frame. */
const REACH = 2.45;

export const fieldStep =
  (rub: RubState): StepFactory =>
  ({ ctx, world, reached, reach }) => {
    const { hanger } = world.props;
    const probe = createOrbs({
      kind: {
        ...ORB_STYLES.blob,
        color: 'coral',
        shade: 'coral.dark',
        selfLit: 0.45,
        intensity: 1.1,
        gloss: 0.2,
        rim: 0.7,
        glyph: 'plus',
        glyphColor: 'white',
        glyphSize: 0.62,
        shimmer: 0,
      },
      count: 1,
      radius: PROBE_R,
      halo: false,
    });
    probe.name = 'charge-probe';
    const pick = new Mesh(new SphereGeometry(0.3, 10, 8), new MeshBasicMaterial({ visible: false }));
    const arrow = createArrow(0.045, 0.17);
    const trail = createTrail();
    ctx.root.add(probe, pick, arrow.group, trail.group);
    const here = (): boolean => ctx.stage.current === 'field';
    let landed = false;
    let held = false;
    let present = 0;
    let since = 0;
    const pos = new Vector3();
    const last = new Vector3(Infinity, 0, 0);
    const centre = new Vector3();
    const hit = new Vector3();
    const d = new Vector3();
    const from = new Vector3();
    const distances: number[] = [];
    const rest = (): Vector3 => hanger.centre(centre).add(hit.set(1.15, 0.2, 0));
    const length = (r: number): number => Math.min(K / (r * r), MAX);
    ctx.input.register(pick, {
      cursor: 'grab',
      enabled: () => (here() && landed && present > 0.95) || held,
      dragStart: () => (held = true),
      drag: (e) => {
        hanger.centre(centre);
        const p = e.planePoint(RUB_PLANE_NORMAL, centre, hit);
        if (!p) return;
        // around the balloon: never inside it, never so far that the arrow leaves the frame
        d.copy(p).sub(centre);
        const r = Math.min(Math.max(d.length(), BALLOON_R * BALLOON_TALL + PROBE_R * 1.6), REACH);
        p.copy(centre).addScaledVector(d.normalize(), r);
        // above the table, below the hanger's arm
        p.y = Math.min(Math.max(p.y, PROBE_R * 2), HANG_Y - 0.35);
        pos.lerp(p, 0.85);
      },
      dragEnd: () => (held = false),
    });
    ctx.qa.probe('probe', () => pos.clone());
    ctx.qa.probe('field-balloon', () => hanger.centre(new Vector3()));
    ctx.qa.expose('field', () => ({
      places: trail.count,
      near: Math.min(...distances),
      far: Math.max(...distances),
      centre: hanger.centre(new Vector3()).toArray(),
      ready: landed && present > 0.95,
    }));

    return {
      spec: world.table('charge-field', { cameraMove: { duration: 2 } }),
      ui: {
        goal: () => reached('field'),
        callouts: [
          {
            anchor: () => pos.clone().add(hit.set(0, 0.22, 0)),
            text: caption('field', 0),
            side: 'right',
            visible: () => here() && present > 0.95 && !reached('field'),
          },
          {
            anchor: () => hanger.centre(new Vector3()).add(hit.set(-0.45, 0.4, 0)),
            text: caption('field', 1),
            side: 'left',
            visible: () => here() && present > 0.95,
          },
          {
            // on the arrows themselves: the topmost pale copy
            anchor: () => {
              const c = hanger.centre(new Vector3());
              return trail.points().reduce((a, b) => (b.y > a.y && b.y < c.y + 1.5 && b.x < c.x ? b : a), c);
            },
            text: caption('field', 2),
            side: 'up',
            visible: () => here() && reached('field'),
          },
        ],
      },
      enter(info: StepInfo) {
        landed = info.instant;
        held = false;
        trail.clear();
        distances.length = 0;
        last.set(Infinity, 0, 0);
        pos.copy(rest());
        hanger.push.set(0, 0, 0);
        // the figure steps aside: nothing between the reader and the balloon
        world.props.aside = FIGURE_ASIDE;
        // and the reader's balloon is put away to the right, out of the shot
        rub.hand.enabled = () => false;
        rub.hand.home = BALLOON_AWAY;
        if (info.instant) present = 1;
      },
      leave() {
        world.props.aside = null;
        rub.hand.home = null;
      },
      update() {
        hanger.push.set(0, 0, 0);
        hanger.centre(centre);
        const r = pos.distanceTo(centre);
        if (held && pos.distanceTo(last) > SPACING) {
          last.copy(pos);
          d.copy(centre).sub(pos).normalize();
          // never into the balloon: the tip stops short of its skin
          const room = r - BALLOON_R * BALLOON_TALL - 0.1;
          trail.lay(from.copy(pos), d, Math.min(Math.max(length(r), COPY[0]), COPY[1], room));
          distances.push(r);
          if (distances.length > 40) distances.shift();
        }
        const near = Math.min(...distances);
        const far = Math.max(...distances);
        if (!reached('field') && trail.count >= 8 && far >= 3 * near) reach('field');
      },
      tick(dt) {
        const on = here();
        since = on ? since + dt : 0;
        landed ||= on && !ctx.camera.moving;
        // the probe comes once the camera is on the table (from «ряди» the flight up takes a few seconds)
        const table = world.world.deep < 0.01 && !world.world.flying;
        present = Math.min(
          Math.max(present + (on && table && (landed || since > 1.2) ? dt : -dt) / 0.7, 0),
          1,
        );
        const k = present * present * (3 - 2 * present);
        probe.visible = pick.visible = present > 0.002;
        probe.position.copy(pos);
        probe.scale.setScalar(Math.max(k, 1e-3));
        pick.position.copy(pos);
        hanger.centre(centre);
        d.copy(centre).sub(pos).normalize();
        arrow.shown = k;
        arrow.set(from.copy(pos).addScaledVector(d, PROBE_R * 1.2), d, length(pos.distanceTo(centre)));
        trail.shown = k;
        trail.update(dt);
      },
    };
  };
