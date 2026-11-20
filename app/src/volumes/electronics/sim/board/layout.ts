/**
 * The breadboard as numbers: where its sockets are, how they join into rows, and which model node every row is. The
 * look and the numbers are fixed by docs/volumes/electronics/VISUAL.md §3.
 *
 * The board's frame: the origin is the middle of the field of sockets on the board's top face, +x to the right, +z
 * toward the reader, in units of the scene. 17 columns (1 … 17, left to right) cross 12 lines (far to near): the rail
 * `+`, the lines a … e, the channel, the lines f … j, the rail `-`. A socket is named as on a real board: `a1` … `j17`,
 * `+1` … `+17`, `-1` … `-17` (an ASCII hyphen; the board prints a minus sign).
 */

export type Line = '+' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | '-';

/** The lines from far to near: the grid index `gz` of a line is its place here. */
export const LINES: readonly Line[] = ['+', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', '-'];

/** `${line}${column}`: 'a1', 'j17', '+9', '-17'. */
export type SocketId = string;

/** A group of sockets joined inside the board: the five of one column on one side of the channel (`'7ae'`,
 * `'7fj'`) or a whole rail (`'+'`, `'-'`). One row is one node of the model. */
export type RowId = string;

export interface BoardSpec {
  /** Columns of sockets. */
  readonly columns: number;
  /** The pitch P: from one socket to the next along a line or across one (units). */
  readonly pitch: number;
  /** How much farther than the pitch the lines e and f are apart: the channel between them (units). */
  readonly channel: number;
  /** How much farther than the pitch a rail lies from the line a (j) (units). */
  readonly railGap: number;
}

/** The stylised board of the bench (VISUAL.md §3): three times a real 2.54 mm pitch, one rail on each side. */
export const BOARD_SPEC: BoardSpec = Object.freeze({ columns: 17, pitch: 0.3, channel: 0.3, railGap: 0.15 });

/** How near a socket's mouth a leg, a plug or a probe tip snaps into it (units): 0.45 P, so two neighbouring
 * sockets never both claim a point (VISUAL.md §6). */
export const SNAP = 0.135;

export interface SocketSpec {
  readonly id: SocketId;
  readonly line: Line;
  /** 1 … columns. */
  readonly column: number;
  readonly row: RowId;
  /** The model node of its row. */
  readonly node: number;
  /** Grid indices: `gx` = column − 1; `gz` = the place of the line in `LINES` (+ 0, a 1 … e 5, f 6 … j 10, − 11). */
  readonly gx: number;
  readonly gz: number;
  /** The socket's mouth in the board's frame (units). */
  readonly x: number;
  readonly z: number;
}

export interface BoardLayout {
  readonly spec: BoardSpec;
  /** Every socket, line by line from far to near, each line left to right: `sockets[gz · columns + gx]`. */
  readonly sockets: readonly SocketSpec[];
  /** The rows in the order of their nodes: `rows[0]` = `'-'` (the ground, node 0), `rows[1]` = `'+'`, then `'1ae'`,
   * `'1fj'`, `'2ae'` … */
  readonly rows: readonly RowId[];
  socket(id: SocketId): SocketSpec | undefined;
  atGrid(gx: number, gz: number): SocketSpec | undefined;
  /** The model node of a row; −1 when the board has no such row. */
  node(row: RowId): number;
  /** The socket whose mouth is nearest to (x, z) when it is at most `within` away, otherwise null. Sockets stand at
   * every column of every line, so the nearest column and the nearest line make the nearest socket. */
  nearest(x: number, z: number, within: number): SocketSpec | null;
}

const FAR_SIDE: readonly Line[] = ['a', 'b', 'c', 'd', 'e'];

const rowOf = (line: Line, column: number): RowId =>
  line === '+' || line === '-' ? line : `${column}${FAR_SIDE.includes(line) ? 'ae' : 'fj'}`;

/** The z of every line, by `gz`: the channel is centred on z = 0, the rails lie beyond the lines a and j. */
function lineZ(spec: BoardSpec): number[] {
  const { pitch, channel, railGap } = spec;
  const e = -(pitch + channel) / 2;
  const a = e - 4 * pitch;
  const near = [0, 1, 2, 3, 4].map((k) => -e + k * pitch); // f … j
  const far = [0, 1, 2, 3, 4].map((k) => a + k * pitch); // a … e
  return [a - pitch - railGap, ...far, ...near, near[4]! + pitch + railGap];
}

export function createLayout(spec: BoardSpec = BOARD_SPEC): BoardLayout {
  const { columns, pitch } = spec;
  const zs = lineZ(spec);
  const middle = (columns + 1) / 2;

  const rows: RowId[] = ['-', '+'];
  for (let column = 1; column <= columns; column++) rows.push(`${column}ae`, `${column}fj`);
  const nodes = new Map(rows.map((row, i) => [row, i]));

  const sockets: SocketSpec[] = [];
  LINES.forEach((line, gz) => {
    for (let gx = 0; gx < columns; gx++) {
      const column = gx + 1;
      const row = rowOf(line, column);
      sockets.push(
        Object.freeze({
          id: `${line}${column}`,
          line,
          column,
          row,
          node: nodes.get(row)!,
          gx,
          gz,
          x: (column - middle) * pitch,
          z: zs[gz]!,
        }),
      );
    }
  });
  const byId = new Map(sockets.map((s) => [s.id, s]));

  const atGrid = (gx: number, gz: number): SocketSpec | undefined =>
    Number.isInteger(gx) && Number.isInteger(gz) && gx >= 0 && gx < columns && gz >= 0 && gz < LINES.length
      ? sockets[gz * columns + gx]
      : undefined;

  return {
    spec,
    sockets,
    rows,
    socket: (id) => byId.get(id),
    atGrid,
    node: (row) => nodes.get(row) ?? -1,
    nearest(x, z, within) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      const gx = Math.min(Math.max(Math.round(x / pitch + middle - 1), 0), columns - 1);
      let gz = 0;
      for (let k = 1; k < zs.length; k++) if (Math.abs(z - zs[k]!) < Math.abs(z - zs[gz]!)) gz = k;
      const s = sockets[gz * columns + gx]!;
      return Math.hypot(x - s.x, z - s.z) <= within ? s : null;
    },
  };
}
