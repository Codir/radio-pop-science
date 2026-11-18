/**
 * `story`'s read-out: the moment after the click as a reader says it, from the script's captions of the step
 * (`caption(i)`: 1 «0», 2…5 «1 мільярдна» … «1 десята секунди», 6…13 word forms «мільярдні» · «мільярдних» ·
 * «мільйонні» · «мільйонних» · «тисячні» · «тисячних» · «соті» · «сотих», 14 «секунди»): «0,4 мільярдних секунди»,
 * «1 мільярдна секунди», «3 мільйонні секунди», «50 тисячних секунди», «2 соті секунди», «1 десята секунди».
 * Round numbers only (1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500), the largest not above the true time — the
 * read-out never flickers. Ukrainian agreement: 1 → the mark's own caption; 2–4 (not 12–14) → the first form;
 * 5 and more, and decimals → the second.
 */
const NBSP = ' ';
/** Units by decade: seconds, caption of «1 …» (−1 = none), few form, many form. */
const UNITS: readonly (readonly [number, number, number, number])[] = [
  [1e-9, 2, 6, 7],
  [1e-6, 3, 8, 9],
  [1e-3, 4, 10, 11],
  [1e-2, -1, 12, 13],
];
const ROUND = [1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500];
/** At this many seconds (and above) the read-out is the last mark, «1 десята секунди». */
const TENTH = 0.1;

export function sayMoment(seconds: number, caption: (i: number) => string): string {
  const second = caption(14);
  const one = (mark: number): string => {
    const c = caption(mark);
    return c.endsWith(second) ? c : `${c}${NBSP}${second}`;
  };
  if (seconds <= 0) return caption(1);
  if (seconds >= TENTH * 0.999) return one(5);
  if (seconds < 1e-9 * 0.999) {
    // the first stretch, as `flow/push`: tenths of a billionth
    const tenth = Math.min(9, Math.max(1, Math.floor((seconds / 1e-9) * 10 + 1e-6)));
    return `0,${tenth}${NBSP}${caption(7)}${NBSP}${second}`;
  }
  // from 20 thousandths on the hundredths read better («2 соті»), below that the decade's own unit
  const unit =
    seconds >= 0.02 ? UNITS[3]! : seconds >= 1e-3 * 0.999 ? UNITS[2]! : seconds >= 1e-6 * 0.999 ? UNITS[1]! : UNITS[0]!;
  const n = seconds / unit[0];
  let r = 1;
  for (const k of ROUND) if (k <= n + 1e-6) r = k;
  if (r === 1 && unit[1] >= 0) return one(unit[1]);
  const last = r % 10;
  const few = last >= 2 && last <= 4 && (r % 100 < 12 || r % 100 > 14);
  return `${r}${NBSP}${caption(few ? unit[2] : unit[3])}${NBSP}${second}`;
}
