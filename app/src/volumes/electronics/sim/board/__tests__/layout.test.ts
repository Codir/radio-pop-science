/**
 * The breadboard's sockets and rows against docs/volumes/electronics/VISUAL.md §3: the numbers of its table, the names
 * of the sockets, the rows a model node stands for, and the grid maths that finds the socket under a point.
 */
import { describe, expect, it } from 'vitest';
import { GROUND } from '../../core';
import { BOARD_SPEC, LINES, SNAP, createLayout, type Line } from '../layout';

const layout = createLayout();
const P = BOARD_SPEC.pitch;
const COLUMNS = Array.from({ length: 17 }, (_, i) => i + 1);

/** VISUAL.md §3, «Лінії, z». */
const LINE_Z: Record<Line, number> = {
  '+': -1.95,
  a: -1.5,
  b: -1.2,
  c: -0.9,
  d: -0.6,
  e: -0.3,
  f: 0.3,
  g: 0.6,
  h: 0.9,
  i: 1.2,
  j: 1.5,
  '-': 1.95,
};

describe('the breadboard layout (VISUAL.md §3)', () => {
  it('has the numbers of the table: 17 columns, the pitch 0.3, the channel 0.3, the rail gap 0.15', () => {
    expect(BOARD_SPEC).toEqual({ columns: 17, pitch: 0.3, channel: 0.3, railGap: 0.15 });
    expect(layout.spec).toBe(BOARD_SPEC);
    expect(LINES).toEqual(['+', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', '-']);
  });

  it('has 17 × 12 = 204 sockets named as on a real board: a1 … j17, +1 … +17, -1 … -17', () => {
    expect(layout.sockets).toHaveLength(204);
    const ids = layout.sockets.map((s) => s.id);
    expect(new Set(ids).size).toBe(204);
    const want = LINES.flatMap((line) => COLUMNS.map((column) => `${line}${column}`));
    expect([...ids].sort()).toEqual([...want].sort());
    expect(layout.socket('a1')).toMatchObject({ line: 'a', column: 1, gx: 0, gz: 1 });
    expect(layout.socket('j17')).toMatchObject({ line: 'j', column: 17, gx: 16, gz: 10 });
    expect(layout.socket('+9')).toMatchObject({ line: '+', column: 9, gx: 8, gz: 0 });
    expect(layout.socket('-17')).toMatchObject({ line: '-', column: 17, gx: 16, gz: 11 });
    for (const bad of ['a0', 'a18', 'k1', 'A1', '−1', '', '1a']) expect(layout.socket(bad)).toBeUndefined();
  });

  it('puts the lines at their z and the columns at (column − 9) · P; the grid indices find every socket', () => {
    for (const s of layout.sockets) {
      expect(s.z, s.id).toBeCloseTo(LINE_Z[s.line], 12);
      expect(s.x, s.id).toBeCloseTo((s.column - 9) * P, 12);
      expect(s.gx).toBe(s.column - 1);
      expect(s.gz).toBe(LINES.indexOf(s.line));
      expect(layout.atGrid(s.gx, s.gz)).toBe(s);
      expect(layout.socket(s.id)).toBe(s);
    }
    expect(layout.socket('a1')!.x).toBeCloseTo(-2.4, 12);
    expect(layout.socket('a17')!.x).toBeCloseTo(2.4, 12);
    // the channel: e → f is the pitch and the channel; a rail lies a pitch and the rail gap beyond a (j)
    expect(layout.socket('f1')!.z - layout.socket('e1')!.z).toBeCloseTo(P + BOARD_SPEC.channel, 12);
    expect(layout.socket('a1')!.z - layout.socket('+1')!.z).toBeCloseTo(P + BOARD_SPEC.railGap, 12);
    expect(layout.socket('-1')!.z - layout.socket('j1')!.z).toBeCloseTo(P + BOARD_SPEC.railGap, 12);
    for (const [gx, gz] of [
      [-1, 0],
      [17, 0],
      [0, -1],
      [0, 12],
      [0.5, 1],
    ] as const)
      expect(layout.atGrid(gx, gz)).toBeUndefined();
  });

  it('has 36 rows: 34 strips of five sockets and two rails of seventeen', () => {
    expect(layout.rows).toHaveLength(36);
    const members = new Map<string, string[]>();
    for (const s of layout.sockets) members.set(s.row, [...(members.get(s.row) ?? []), s.id]);
    expect([...members.keys()].sort()).toEqual([...layout.rows].sort());
    expect(members.get('+')).toEqual(COLUMNS.map((c) => `+${c}`));
    expect(members.get('-')).toEqual(COLUMNS.map((c) => `-${c}`));
    expect(members.get('7ae')).toEqual(['a7', 'b7', 'c7', 'd7', 'e7']);
    expect(members.get('7fj')).toEqual(['f7', 'g7', 'h7', 'i7', 'j7']);
    const strips = layout.rows.filter((row) => row !== '+' && row !== '-');
    expect(strips).toHaveLength(34);
    for (const row of strips) expect(members.get(row), row).toHaveLength(5);
  });

  it('gives every row one model node: − is the ground (node 0), + node 1, then 1ae 2, 1fj 3 … 17fj 35', () => {
    expect(layout.rows.slice(0, 6)).toEqual(['-', '+', '1ae', '1fj', '2ae', '2fj']);
    expect(layout.rows[35]).toBe('17fj');
    expect(layout.node('-')).toBe(GROUND);
    expect(layout.node('+')).toBe(1);
    expect(layout.node('1ae')).toBe(2);
    expect(layout.node('17fj')).toBe(35);
    layout.rows.forEach((row, i) => expect(layout.node(row)).toBe(i));
    for (const s of layout.sockets) expect(s.node).toBe(layout.node(s.row));
    expect(layout.node('18ae')).toBe(-1);
  });

  it('snaps within SNAP of a mouth, and never between two sockets: SNAP is 0.45 P', () => {
    expect(SNAP).toBeCloseTo(0.45 * P, 12);
    expect(SNAP).toBeLessThan(P / 2);
    for (const s of layout.sockets) {
      expect(layout.nearest(s.x, s.z, SNAP)).toBe(s);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const r = 0.99 * SNAP;
        expect(layout.nearest(s.x + r * Math.cos(a), s.z + r * Math.sin(a), SNAP)).toBe(s);
      }
    }
  });

  it('gives null beyond SNAP: between neighbours, in the channel, off the board', () => {
    const a5 = layout.socket('a5')!;
    expect(layout.nearest(a5.x + 1.01 * SNAP, a5.z, SNAP)).toBeNull();
    expect(layout.nearest(a5.x + P / 2, a5.z, SNAP)).toBeNull(); // halfway to a6
    expect(layout.nearest(a5.x, a5.z + P / 2, SNAP)).toBeNull(); // halfway to b5
    expect(layout.nearest(a5.x, 0, SNAP)).toBeNull(); // the middle of the channel
    expect(layout.nearest(-2.4 - 1.01 * SNAP, -1.5, SNAP)).toBeNull(); // left of a1
    expect(layout.nearest(0, 1.95 + 1.01 * SNAP, SNAP)).toBeNull(); // beyond the − rail
    expect(layout.nearest(Number.NaN, 0, SNAP)).toBeNull();
    // a wider reach still finds the nearest socket
    expect(layout.nearest(10, -10, Infinity)).toBe(layout.socket('+17'));
    expect(layout.nearest(a5.x + 0.4 * P, a5.z + 0.1, P)).toBe(a5);
    expect(layout.nearest(a5.x + 0.6 * P, a5.z + 0.1, P)).toBe(layout.socket('a6'));
  });
});
