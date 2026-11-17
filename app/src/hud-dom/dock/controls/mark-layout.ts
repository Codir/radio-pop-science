/**
 * Where the slider's mark names go once their widths are known (`slider.ts` measures them after layout). Each name
 * starts where the CSS fallback puts it — anchored at 3 %…97 % of the strip, pivot sliding with t, so the ends stay
 * inside — which is the desktop look whenever there is room. Names that would come closer than `gap` are pushed
 * apart as a group (centred on their own preferred spots, clamped to the strip, so an end name stays aligned to its
 * end and the others shift inward). A name that would then no longer stand over its tick drops to a second line
 * under that tick instead; the end names keep the first line as long as they fit. Pure: unit-tested without a DOM.
 */

export interface MarkBox {
  /** position on the track, 0…1 */
  readonly t: number;
  /** measured width of the name, px */
  readonly w: number;
}

export interface MarkPlace {
  /** left edge, px from the strip's left */
  readonly x: number;
  /** 0 — the line under the track; 1 — the second line */
  readonly row: 0 | 1;
}

/** The tick's x on the strip, as the CSS fallback anchors it (3 %…97 % of the width). */
export const markAnchor = (t: number, width: number): number => width * (0.03 + 0.94 * t);

/** Preferred left edge: the CSS fallback's pivot sliding with t, kept inside the strip. */
const preferred = (m: MarkBox, width: number): number =>
  Math.min(Math.max(markAnchor(m.t, width) - m.t * m.w, 0), Math.max(width - m.w, 0));

/**
 * Lays out one line: names (sorted by t) that overlap are merged into clusters placed at their members' mean
 * preferred offset and clamped to [0, width]; clusters merge until none overlaps. Returns the left edges, or null
 * when the names cannot fit on one line while each still covers its own tick.
 */
function line(marks: readonly MarkBox[], width: number, gap: number): number[] | null {
  interface Cluster {
    first: number;
    count: number;
    /** sum over members of (preferred left − offset inside the cluster) */
    sum: number;
    span: number;
    x: number;
  }
  const clusters: Cluster[] = [];
  const place = (c: Cluster): void => {
    c.x = Math.min(Math.max(c.sum / c.count, 0), Math.max(width - c.span, 0));
  };
  marks.forEach((m, i) => {
    const c: Cluster = { first: i, count: 1, sum: preferred(m, width), span: m.w, x: 0 };
    place(c);
    clusters.push(c);
    for (;;) {
      const b = clusters[clusters.length - 1];
      const a = clusters[clusters.length - 2];
      if (!a || !b || a.x + a.span + gap <= b.x) break;
      // b's members sit after a's span and the gap: their preferred lefts count relative to the merged start
      a.sum += b.sum - b.count * (a.span + gap);
      a.count += b.count;
      a.span += gap + b.span;
      place(a);
      clusters.pop();
    }
  });
  const xs: number[] = [];
  for (const c of clusters) {
    let x = c.x;
    for (let i = c.first; i < c.first + c.count; i++) {
      xs.push(x);
      x += (marks[i]?.w ?? 0) + gap;
    }
  }
  const fits =
    clusters.every((c) => c.span <= width + 0.5) &&
    marks.every((m, i) => {
      const a = markAnchor(m.t, width);
      const x = xs[i] ?? 0;
      return x <= a + 0.5 && a <= x + m.w + 0.5;
    });
  return fits ? xs : null;
}

/**
 * Places the names (`marks` in any order; the result keeps that order). `gap` is the smallest free space between
 * two names on one line, px.
 */
export function layoutMarks(marks: readonly MarkBox[], width: number, gap: number): MarkPlace[] {
  const order = marks.map((_, i) => i).sort((a, b) => (marks[a]?.t ?? 0) - (marks[b]?.t ?? 0));
  // first line priority: the two ends, then the inner names from the left
  const priority = order.length > 1 ? [order[0], order[order.length - 1], ...order.slice(1, -1)] : order;
  const rows: (0 | 1)[] = marks.map(() => 1);
  const solve = (row: 0 | 1): number[] | null =>
    line(
      order.filter((i) => rows[i] === row).map((i) => marks[i] as MarkBox),
      width,
      gap,
    );
  for (const i of priority) {
    if (i === undefined) continue;
    rows[i] = 0;
    if (!solve(0)) rows[i] = 1;
  }
  const out: MarkPlace[] = marks.map(() => ({ x: 0, row: 0 }));
  for (const row of [0, 1] as const) {
    const members = order.filter((i) => rows[i] === row);
    // the second line is best effort: if even it cannot fit, each name stays at its preferred spot
    const xs = solve(row) ?? members.map((i) => preferred(marks[i] as MarkBox, width));
    members.forEach((i, k) => (out[i] = { x: xs[k] ?? 0, row }));
  }
  return out;
}
