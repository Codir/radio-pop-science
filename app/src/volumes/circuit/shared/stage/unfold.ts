/**
 * The unfolding of the flashlight into the stand (VISUAL.md §5.1) as ONE pure function of `u` ∈ 0…1, so the
 * reader can drag it, stop it and lead it back (`build/flashlight` plays it backwards). Six beats over 6 s:
 *
 *   1  0.0–0.8   the housing splits lengthwise, the halves slide apart by their diameter
 *   2  0.8–1.6   halves, mirror and glass rise in an arc to the shelf; the parts hover in a row
 *   3  1.45–2.45 the mounts grow out of the board in a wave from left to right (every 55 ms)
 *   4  2.2–4.15  one part at a time, each visibly travelling and settling: lamp, battery, switch — battery → cradle, spring → minus clamp, lamp rises and screws one turn into the socket,
 *                slider → switch block; both strips follow without letting go
 *   5  3.8–5.0   the strips round into wires, the sheath grows from the clamps, the wires lie down on the staples
 *   6  5.0–6.0   rest (camera, magnifier — `beat6` 0…1 is exported for them)
 *
 * No contact ever opens: every strip end is computed from the part it touches, so the lamp never has a reason
 * to go out — its light is parented to the filament and travels with it.
 */
import { CatmullRomCurve3, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { BATTERY, BOARD, LAMP, LOOP, SEAT, SHELF_WORLD, SWITCH } from './layout';
import { BOARD_Y } from './base';
import { SLIDER_TRAVEL } from './small-parts';
import { PLACE, type Stand } from './stand';
import { TORCH, torchPath, type Torch, type TorchDims } from './torch';
import { BULB, type BulbDims } from './bulb';
import { WIRE_IDS, standPath, type WireId } from './wires';
import { resample } from './dyn-tube';

export const UNFOLD_SECONDS = 6;
/**
 * Recommended way to PLAY the unfolding as one move, without the reader's hand (`stand.playUnfold()`):
 * the timeline runs at constant speed — every beat has its own ease-in and ease-out, the first frame and the
 * last have zero velocity — stretched to `seconds`; the camera stays on `flashlight` through beats 1–2, starts
 * one move to `stand` when beat 3 begins (`cameraAt` of the progress) and arrives with the wires
 * (`cameraSeconds`, ease `cinematic`). The practicum plays the same backwards: `playUnfold(seconds, 0)`, camera
 * back to `flashlight` at progress 1 − `cameraAt` − cameraSeconds / seconds.
 */
export const UNFOLD_PLAY = { seconds: 7, cameraAt: 1.5 / 6, cameraSeconds: 3.6 } as const;
/** Beat boundaries in seconds — `beatOf(u)` and the showcase use them. */
export const BEATS = [0, 0.8, 1.6, 2.6, 3.8, 5.0, 6.0] as const;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const smooth = (x: number): number => x * x * (3 - 2 * x);
const inOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const backOut = (x: number): number => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
const hump = (x: number): number => Math.sin(Math.PI * clamp01(x));

/** Torch frame in the board frame: lying on the board, head to the right and a little toward the reader. */
const YAW = -0.52;
const HOVER_LIFT = 0.3;
/** Points per strip while it moves (the finished stand uses the exact paths). */
const SAMPLES: Record<WireId, number> = { m1: 140, m2: 24, p1: 24, p2: 90 };

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const quat = (axis: Vector3, angle: number): Quaternion => new Quaternion().setFromAxisAngle(axis, angle);

interface Pose {
  p: Vector3;
  q: Quaternion;
}
const pose = (p: Vector3, q = new Quaternion()): Pose => ({ p, q });

/** World pose → board frame (the shelf is level in the world, the board frame is tilted). */
function fromWorld(p: Vector3, q: Quaternion): Pose {
  const inv = quat(X, -BOARD.tilt);
  return {
    p: p
      .clone()
      .sub(new Vector3(0, BOARD_Y, 0))
      .applyQuaternion(inv),
    q: inv.clone().multiply(q),
  };
}

export interface Unfold {
  /** `u` 0 = flashlight … 1 = stand; `open` 0 = slider closed … 1 = open. */
  set(u: number, open: number): void;
  /** Progress of beat 6 (0…1) for the things that arrive last. */
  readonly beat6: number;
  /** Index 0…5 of the beat `u` is in. */
  beatOf(u: number): number;
  /** 1 while the lamp sits in the mirror (the flashlight has a beam) … 0 once the mirror has left. */
  readonly beam: number;
  /** Direction of the flashlight's axis in the board frame. */
  readonly axis: Vector3;
}

export function createUnfold(stand: Stand, torch: Torch, T: TorchDims = TORCH, B: BulbDims = BULB): Unfold {
  // the lying torch rests on its tail cap and on the rim of its wider head, so it points up a little
  const rim = T.head + 0.035;
  const PITCH = Math.atan2(rim - 0.4, T.front - 0.05 + 1.8);
  const TORCH_AT = new Vector3(-0.95, 0.4 + 1.8 * Math.tan(PITCH), -0.6);
  const qA = quat(Y, YAW).multiply(quat(Z, PITCH));
  const qH = quat(Y, YAW);
  const carrier = new Matrix4();
  const carrierQ = new Quaternion();
  const carrierP = new Vector3();
  const one = new Vector3(1, 1, 1);
  const setCarrier = (t: number): void => {
    const h = smooth(ramp(t, 0.8, 1.5));
    carrierQ.copy(qA).slerp(qH, h);
    carrierP.copy(TORCH_AT).addScaledVector(Y, HOVER_LIFT * h);
    carrier.compose(carrierP, carrierQ, one);
  };
  const inTorch = (local: Vector3, out: Vector3): Vector3 => out.copy(local).applyMatrix4(carrier);

  // shelf poses of the housing (level in the world): the two halves lie round side up, one nested on the
  // other, head to the left — away from the lamp, so its memory does not compete with it;
  const shelfY = SHELF_WORLD.y;
  const turn = quat(Y, Math.PI);
  const shelf = {
    far: fromWorld(new Vector3(0.95, shelfY, SHELF_WORLD.z - 0.05), quat(X, -Math.PI / 2).multiply(turn)),
    near: fromWorld(
      new Vector3(1.2, shelfY + 0.09, SHELF_WORLD.z + 0.04),
      quat(X, Math.PI / 2 - 0.05).multiply(turn),
    ),
  };
  // the mirror and the glass go back where they belong — inside the head of the lower half — so the shelf
  // holds one tidy thing, the housing
  const stored = {
    mirror: pose(shelf.far.p.clone(), shelf.far.q.clone()),
    glass: pose(
      new Vector3(T.glassX, 0, 0).applyQuaternion(shelf.far.q).add(shelf.far.p),
      shelf.far.q.clone(),
    ),
  };

  // attachment points of the strip ends: local to the part that carries them, in the torch and on the stand
  const term = (x: number, z: number): Vector3 => new Vector3(x, LOOP.y, z);
  const INSET = 0.07;
  const bulbUp = quat(Z, -Math.PI / 2); // bulb local +y → torch +x
  const local = {
    bulbT: new Vector3(T.bulbX, 0, 0),
    battT: new Vector3(T.batteryX, 0, 0),
    springT: new Vector3(T.springX, 0, 0),
    sliderT: new Vector3(T.sliderX, T.body - 0.005, 0),
  };
  const paths = Object.fromEntries(
    WIRE_IDS.map((id) => [
      id,
      {
        torch: resample(torchPath(id, T, B), SAMPLES[id]),
        stand: resample(standPath(id), SAMPLES[id]),
        out: [] as Vector3[],
      },
    ]),
  ) as Record<WireId, { torch: Vector3[]; stand: Vector3[]; out: Vector3[] }>;
  const state = { beat6: 0, beam: 1, axis: new Vector3(1, 0, 0) };
  const tmp = new Vector3();
  const tmpQ = new Quaternion();
  const a = new Vector3();
  const b = new Vector3();

  /** Move `object` between two poses with an arc of height `lift` (board frame up). */
  const place = (object: Object3D, from: Pose, to: Pose, e: number, lift: number): void => {
    object.position
      .copy(from.p)
      .lerp(to.p, e)
      .addScaledVector(Y, lift * hump(e));
    object.quaternion.copy(from.q).slerp(to.q, e);
  };
  const torchPose = (localP: Vector3, localQ?: Quaternion): Pose => {
    const q = carrierQ.clone();
    if (localQ) q.multiply(localQ);
    return { p: inTorch(localP, new Vector3()), q };
  };

  /* ---------------------------------------------------------------- beats 1–2: the housing leaves */
  const route = new CatmullRomCurve3(
    [new Vector3(), new Vector3(-6.0, -1.0, 0.4), new Vector3(-5.9, -0.9, -2.9), new Vector3()],
    false,
    'catmullrom',
    0.5,
  );
  const housing = (t: number): void => {
    const apart = inOut(ramp(t, 0, 0.8)) * T.head * 2;
    for (const [half, sign, to, t0] of [
      [torch.far, -1, shelf.far, 0.8],
      [torch.near, 1, shelf.near, 0.86],
    ] as const) {
      // the far half slides straight aside; the near half — the one that would come at the reader — opens only
      // a little toward the reader and mostly slides back along the torch's axis, tail first, away from the camera
      const from = torchPose(sign < 0 ? tmp.set(0, 0, -apart) : tmp.set(-1.15 * apart, 0, 0.5 * apart));
      const k = inOut(ramp(t, t0, t0 + (sign < 0 ? 0.68 : 0.9)));
      if (sign < 0) {
        place(half, from, to, k, 1.5);
      } else {
        // the near half must never cross the picture: it slides on the way it already goes (to the front
        // left), drops below the level of the face beside the board — out of the flashlight shot — runs back
        // along the board's left side and rises to the shelf from behind (Catmull-Rom through two low points)
        route.points[0]!.copy(from.p);
        route.points[3]!.copy(to.p);
        route.getPoint(k, half.position);
        half.quaternion.copy(from.q).slerp(to.q, k);
      }
    }
    // mirror and glass first slide forward off the lamp, then follow the halves
    const off = smooth(ramp(t, 0.8, 1.05));
    place(torch.mirror, torchPose(tmp.set(off * 1.25, 0, 0)), stored.mirror, inOut(ramp(t, 1.02, 1.6)), 1.1);
    place(
      torch.glass,
      torchPose(tmp.set(T.glassX + off * 1.6, 0, 0)),
      stored.glass,
      inOut(ramp(t, 0.98, 1.56)),
      1.3,
    );
  };

  /* ------------------------------------------- beats 3–4: mounts grow, the parts take their places */
  const bulbP = new Vector3();
  const bulbQ = new Quaternion();
  const sliderP = new Vector3();
  const sliderQ = new Quaternion();
  const e = { batt: 0, slider: 0, bulb: 0 };
  const parts = (t: number, open: number): void => {
    stand.mountOrder.forEach((name, i) => {
      const g = backOut(ramp(t, 1.45 + i * 0.055, 1.83 + i * 0.055));
      const m = stand.mounts[name]!;
      m.visible = g > 1e-3;
      m.scale.setScalar(Math.max(g, 1e-3));
    });
    e.batt = smooth(ramp(t, 2.75, 3.85));
    place(stand.battery.group, torchPose(local.battT), pose(PLACE.battery), e.batt, 0.4);
    place(stand.spring.group, torchPose(local.springT), pose(PLACE.spring), e.batt, 0.4);
    const len = T.springLength + (PLACE.springLength - T.springLength) * e.batt;
    stand.spring.group.scale.set(len / stand.spring.length, 1, 1);

    e.slider = smooth(ramp(t, 3.2, 4.15));
    place(stand.slider, torchPose(local.sliderT), pose(PLACE.slider), e.slider, 0.35);
    sliderP.copy(stand.slider.position);
    sliderQ.copy(stand.slider.quaternion);
    stand.slider.position.addScaledVector(
      tmp.copy(X).applyQuaternion(sliderQ),
      clamp01(open) * SLIDER_TRAVEL,
    );

    // the lamp: out of the mirror's place and up above the socket, turning upright; then one turn down into it
    const travel = smooth(ramp(t, 2.2, 3.4));
    const screw = smooth(ramp(t, 3.35, 3.95));
    e.bulb = clamp01(0.75 * travel + 0.25 * screw);
    const from = torchPose(local.bulbT, bulbUp);
    bulbP.copy(from.p).lerp(tmp.copy(PLACE.bulb).addScaledVector(Y, 0.44), travel);
    bulbP.addScaledVector(Y, 0.75 * hump(travel) - 0.44 * screw);
    bulbQ.copy(from.q).slerp(tmpQ.identity(), travel);
    stand.bulb.group.position.copy(bulbP);
    stand.bulb.group.quaternion.copy(bulbQ).multiply(tmpQ.setFromAxisAngle(Y, Math.PI * 2 * screw));
  };

  /* ------------------------------------------- beats 4–5: the strips follow, then become the wires */
  const first = (id: WireId): Vector3 => paths[id].torch[0]!;
  const last = (id: WireId): Vector3 => paths[id].torch[paths[id].torch.length - 1]!;
  const unBulb = bulbUp.clone().invert();
  // strip ends, local to the part they touch: [in the torch, on the stand]
  const ends = {
    m1a: [first('m1').clone().sub(local.springT), term(BATTERY.minusX + INSET, LOOP.near).sub(PLACE.spring)],
    m2b: [
      last('m2').clone().sub(local.bulbT).applyQuaternion(unBulb),
      term(LAMP.x - LAMP.term + INSET, SEAT.z).sub(PLACE.bulb),
    ],
    p1a: [first('p1').clone().sub(local.battT), term(BATTERY.plusX - INSET, LOOP.near).sub(PLACE.battery)],
    p1b: [last('p1').clone().sub(local.sliderT), term(SWITCH.inX + INSET, LOOP.near).sub(PLACE.slider)],
    p2a: [first('p2').clone().sub(local.sliderT), term(SWITCH.outX - INSET, LOOP.near).sub(PLACE.slider)],
    p2b: [
      last('p2').clone().sub(local.bulbT).applyQuaternion(unBulb),
      term(LAMP.x, LAMP.z + LAMP.term - INSET).sub(PLACE.bulb),
    ],
  } as const;
  const end = (key: keyof typeof ends, p: Vector3, q: Quaternion, k: number, out: Vector3): Vector3 =>
    out.copy(ends[key][0]).lerp(ends[key][1], k).applyQuaternion(q).add(p);
  // which way the flat side of each strip faces in the torch (carrier axes): against the wall it runs along
  const flat: Record<WireId, Vector3> = { m1: X, m2: Z, p1: X, p2: Y };
  const up = new Vector3();
  const wires = (t: number): void => {
    if (t >= UNFOLD_SECONDS - 1e-6) return stand.wires.setStand();
    const w = smooth(ramp(t, 2.2, 4.7));
    const lift = 0.14 * hump(ramp(t, 2.6, 4.95));
    const round = smooth(ramp(t, 4.05, 4.75));
    const cover = smooth(ramp(t, 4.2, 5.0));
    const battery = stand.battery.group;
    const spring = stand.spring.group;
    for (const id of WIRE_IDS) {
      const { torch: from, stand: to, out } = paths[id];
      const n = from.length;
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1);
        const p = (out[i] ??= new Vector3());
        inTorch(from[i]!, p)
          .lerp(to[i]!, w)
          .addScaledVector(Y, lift * Math.sin(Math.PI * s));
      }
      // pin both ends to the parts they touch; the correction fades quadratically along the piece
      const start =
        id === 'm1'
          ? end('m1a', spring.position, spring.quaternion, e.batt, a)
          : id === 'p1'
            ? end('p1a', battery.position, battery.quaternion, e.batt, a)
            : id === 'p2'
              ? end('p2a', sliderP, sliderQ, e.slider, a)
              : null;
      const finish =
        id === 'm2'
          ? end('m2b', bulbP, bulbQ, e.bulb, b)
          : id === 'p1'
            ? end('p1b', sliderP, sliderQ, e.slider, b)
            : id === 'p2'
              ? end('p2b', bulbP, bulbQ, e.bulb, b)
              : null;
      if (start) start.sub(out[0]!);
      if (finish) finish.sub(out[n - 1]!);
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1);
        if (start) out[i]!.addScaledVector(start, (1 - s) ** 2);
        if (finish) out[i]!.addScaledVector(finish, s ** 2);
      }
      stand.wires.setShape(id, {
        path: out,
        round,
        cover,
        copper: 1,
        up: up.copy(flat[id]).applyQuaternion(carrierQ),
      });
    }
  };

  return {
    get beat6() {
      return state.beat6;
    },
    get beam() {
      return state.beam;
    },
    axis: state.axis,
    beatOf(u) {
      const t = clamp01(u) * UNFOLD_SECONDS;
      let i = 0;
      while (i < 5 && t >= BEATS[i + 1]!) i++;
      return i;
    },
    set(u, open) {
      const t = clamp01(u) * UNFOLD_SECONDS;
      setCarrier(t);
      state.beat6 = smooth(ramp(t, 5.0, 6.0));
      state.beam = 1 - smooth(ramp(t, 0.8, 1.02));
      state.axis.copy(X).applyQuaternion(carrierQ);
      housing(t);
      parts(t, open);
      wires(t);
    },
  };
}
