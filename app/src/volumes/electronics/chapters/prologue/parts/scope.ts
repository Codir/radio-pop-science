/**
 * The oscilloscope of `riddle` (VISUAL §5.2; the script's «Бачимо»): one scale for the three points, one in which the
 * battery's 9 V fits — 2,5 V a division with 0 V in the middle (±10 V) — and sweeps of 5 ms a division triggered by
 * the probe's own channel (running free on the flat rail). The step's board: the title «Прилад з екраном» and the
 * chart of the bench's scope, its axes named by their units alone (the prologue gives the instrument no words: its
 * chapter is the next one), its one channel by the caption «Щуп».
 */
import type { ChartSpec } from '@/hud';
import type { Bench } from '@electronics/shared/bench';
import type { ScopeSettings, ScopeSetup } from '@electronics/shared/instruments';

export const RIDDLE: ScopeSetup = Object.freeze({
  display: 'sweep',
  timePerDiv: 0.005,
  voltsPerDiv: 2.5,
  ground: 0,
  trigger: { channel: 0, slope: 1, auto: true },
} as const);

/** The step's board: its title and the chart (one channel; the second has no name and stays out of the legend). */
export function riddleBoard(bench: Bench, id: string, title: string, probe: string) {
  const chart: ChartSpec = bench.oscilloscope.chart(id, {
    x: (s: ScopeSettings) => s.unit,
    y: 'V',
    ch1: probe,
    ch2: '',
  });
  return { title, size: 'md' as const, children: [chart] };
}
