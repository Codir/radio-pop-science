/**
 * Progress ring of the map's title bar, its chapter card and the library cards: the header's ring (`step/header.ts`,
 * classes `.ring` of `step/step.css`) at any size — an SVG arc over a track, the label in the middle.
 */
import { h, setStyle, setText } from '../core/dom';

const SVG = 'http://www.w3.org/2000/svg';

export interface Ring {
  readonly el: HTMLElement;
  set(fraction: number, label: string, spoken: string): void;
}

/** `size` in units (the WebGL `ProgressRing` size); `name` = `data-ui`. */
export function ring(size: number, name?: string): Ring {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 46 46');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG, 'circle');
  const arc = document.createElementNS(SVG, 'circle');
  for (const c of [track, arc]) {
    c.setAttribute('cx', '23');
    c.setAttribute('cy', '23');
    c.setAttribute('r', '20');
    c.setAttribute('pathLength', '100');
  }
  track.setAttribute('class', 'track');
  arc.setAttribute('class', 'arc');
  svg.append(track, arc);
  const text = h('span.ring-label', { 'aria-hidden': 'true' });
  const el = h('div.ring.mp-ring', { role: 'img', 'data-ui': name, style: `--size: ${size}` }, text);
  el.prepend(svg);
  return {
    el,
    set(fraction, label, spoken) {
      // no arc at all at 0 (a round cap would draw a dot)
      setStyle(
        arc as unknown as HTMLElement,
        'stroke-dasharray',
        fraction > 0 ? `${(Math.min(fraction, 1) * 100).toFixed(2)} 100` : '0 100',
      );
      setStyle(arc as unknown as HTMLElement, 'opacity', fraction > 0 ? '' : '0');
      setText(text, label);
      el.setAttribute('aria-label', spoken);
    },
  };
}
