/**
 * The permanent places of the bench (docs/volumes/electronics/VISUAL.md §2). Copied from
 * `circuit/shared/stage/layout.ts` (shared/README.md, «Копії»): the base keeps its name `BOARD` and its shape, only
 * larger; the circuit's loop of wire, battery, switch, seat, staples and ruler gave way to `PLACES` — the breadboard
 * and the fixed things of this volume.
 *
 * Everything on the base is given in the BASE FRAME: origin at the centre of the base's face, +x to the reader's
 * right, +y out of the face, +z toward the reader. The frame is tilted 15° toward the reader (`BOARD.tilt`), so «up»
 * on the base is not world up. What stands on the table (the tray, the instruments) is given in WORLD units: the base
 * stands in the middle of the table, +y up, +z toward the reader, the table top at y = 0.
 *
 * Scale: 1 unit ≈ 26 mm of the toy stand (the 9 V battery is 1.87 long); the breadboard and the parts on it are three
 * times real in that scale (VISUAL §2 «Мірило»).
 */

/** The base: a thick rounded slab, 3 : 2, its face tilted toward the reader. */
export const BOARD = {
  /** Face size (3 : 2) and slab thickness. */
  width: 8.4,
  depth: 5.6,
  thickness: 0.62,
  corner: 0.34,
  /** Tilt of the face toward the reader, radians (15°). */
  tilt: (15 * Math.PI) / 180,
  /** Height of the front feet: the gap between the table and the slab's front bottom edge. */
  feet: 0.16,
} as const;

/**
 * Where the things stand (VISUAL §2 «Місця на основі», «Місця на столі»). On the base: (x, z) in the base frame;
 * on the table (`tray`, `meter`, `scope`): (x, z) in world units. Sizes are x × z × height.
 */
export const PLACES = {
  /**
   * The breadboard: (x, z) is the middle of the field of sockets — the origin of the board's own frame
   * (`sim/board/layout.ts`), which lies `height` above the face. The body reaches `left` beyond column 1, `right`
   * beyond column 17 (the two power posts stand there) and `beyond` past each rail.
   */
  breadboard: { x: -0.3, z: 0, width: 5.7, depth: 4.3, height: 0.3, left: 0.3, right: 0.6, beyond: 0.2 },
  /** The open box with the 9 V battery. */
  battery: { x: 3.45, z: 1.6, width: 1.2, depth: 2.0, height: 0.8 },
  /** The battery's slide switch on the box's lid, the nearest thing on the base; its thumb travels along x. */
  switch: { x: 3.45, z: 2.25, travel: 0.3 },
  /** The player, the source of the music. */
  player: { x: 3.45, z: -0.35, width: 1.0, depth: 1.4, height: 0.3 },
  /** The speaker, face up on three low feet. */
  speaker: { x: 3.45, z: -1.95, radius: 0.65 },
  /** The 6 V lamp in its socket on a post: the glass's radius and the height of its middle above the face. */
  lamp: { x: -3.6, z: -2.0, glass: 0.38, glassY: 1.2 },
  /**
   * The tray of parts on the table, right against the base's front edge: a stepped block of two rows of six slots —
   * the front row low and shallow, the back row a step higher and deep (VISUAL §6).
   */
  tray: {
    x: 0,
    z: 3.6,
    width: 7.8,
    depth: 1.7,
    slots: 6,
    front: { depth: 0.5, top: 0.4 },
    back: { depth: 1.2, top: 0.65 },
  },
  /** The multimeter, lying display up, its top away from the reader (VISUAL §5.1). */
  meter: { x: -5.6, z: 1.2, width: 1.4, depth: 2.4, height: 0.4 },
  /** The oscilloscope, its screen toward the reader: the face is the plane z = z + depth / 2 (VISUAL §5.2). */
  scope: { x: 5.7, z: -3.0, width: 2.4, depth: 1.4, height: 1.9 },
} as const;

/** The magnifier's holder: a ring lying flat in the near left corner of the base. */
export const LENS = {
  /** Centre of the ring at rest (base frame). */
  holder: { x: -3.6, z: 1.95 },
  /** Outer radius of the ring. */
  radius: 0.42,
} as const;

/** The battery's switch: the gap between its two contacts and how far the thumb travels from closed to open. */
export const SWITCH = {
  /** Air gap between the two contacts under the thumb (it shows when the thumb is pushed open, to the left). */
  gap: 0.3,
  /** From closed (the bridge on both contacts) to open, along −x. */
  travel: PLACES.switch.travel,
} as const;

/** The lamp's post: where its socket ends (the thread goes into it) and its two screw terminals. */
export const LAMP = {
  x: PLACES.lamp.x,
  z: PLACES.lamp.z,
  /** Height of the socket's top above the face. */
  socketY: 0.62,
  /** Middle of the glass, where the filament hangs, and its radius. */
  glassY: PLACES.lamp.glassY,
  glass: PLACES.lamp.glass,
  /** Distance of its two screw terminals from the post's axis. */
  term: 0.26,
  /** Height of the terminals' barrels above the face. */
  termY: 0.16,
} as const;
