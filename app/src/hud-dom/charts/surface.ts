/**
 * A Canvas2D surface that follows its CSS box in device pixels: one `ResizeObserver` on the
 * `device-pixel-content-box` (it also fires when the device pixel ratio changes — another monitor, browser
 * zoom), the backing store re-sized to exactly those pixels, and the HUD unit `--u` read once per resize (style
 * read on resize only, never per frame — HUD_DOM §7 rule 2).
 */

export interface CanvasBox {
  readonly g: CanvasRenderingContext2D;
  /** CSS size of the canvas, px. */
  readonly width: number;
  readonly height: number;
  /** CSS px per HUD unit (`--u`). */
  readonly u: number;
  /** Device pixels per CSS px of this canvas. */
  readonly dpr: number;
  /** The chapter accent at this element (`--accent`, CSS colour). */
  readonly accent: string;
}

/** Observe `canvas`; `onBox` runs after every size / DPR change with the backing store already re-sized. */
export function observeCanvas(canvas: HTMLCanvasElement, onBox: (box: CanvasBox) => void): () => void {
  const g = canvas.getContext('2d');
  if (!g || typeof ResizeObserver === 'undefined') return () => {};
  const ro = new ResizeObserver((entries) => {
    const e = entries[entries.length - 1]!;
    const width = e.contentRect.width;
    const height = e.contentRect.height;
    if (width <= 0 || height <= 0) return;
    const dev = e.devicePixelContentBoxSize?.[0];
    const dw = dev ? dev.inlineSize : Math.round(width * devicePixelRatio);
    const dh = dev ? dev.blockSize : Math.round(height * devicePixelRatio);
    if (canvas.width !== dw) canvas.width = dw;
    if (canvas.height !== dh) canvas.height = dh;
    const style = getComputedStyle(canvas);
    const u = parseFloat(style.getPropertyValue('--u')) || 1;
    const accent = style.getPropertyValue('--accent').trim() || '#00e5ff';
    onBox({ g, width, height, u, dpr: dw / width, accent });
  });
  try {
    ro.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    ro.observe(canvas); // browsers without device-pixel boxes (Safari < 17)
  }
  return () => ro.disconnect();
}
