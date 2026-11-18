/* global window, document, performance */
// Parts of `volume-walk.mjs`: the in-page frame sampler and the analysis of its samples.
//
// The sampler wraps the engine's `pipeline.render`: right after every frame is drawn it reads the camera of the
// chapter on screen (position + forward direction), the mean luminance of the WebGL picture (a 64×36 copy of the
// canvas — the 3D world only: the 2D interface is DOM above it) and the navigation state. On request (`shoot`)
// and by itself on the first frame of a new chapter it keeps a JPEG of the canvas and a 32×18 RGB thumbnail
// (for the frame comparison of a border). Live clock: the frames are the reader's frames.

/** Install the sampler in the page (idempotent). */
export async function installSampler(page) {
  await page.evaluate(() => {
    if (window.__walk) return;
    const eng = window.__app.engine;
    const canvas = eng.renderer.domElement;
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 36;
    const c2 = small.getContext('2d', { willReadFrequently: true });
    const thumbOf = () => {
      c2.drawImage(canvas, 0, 0, 32, 18);
      const d = c2.getImageData(0, 0, 32, 18).data;
      const rgb = [];
      for (let i = 0; i < d.length; i += 4) rgb.push(d[i], d[i + 1], d[i + 2]);
      return rgb;
    };
    const w = (window.__walk = {
      samples: [],
      shots: [],
      want: null,
      lastChapter: null,
      lastPh: null,
      edge: null,
    });
    const orig = eng.pipeline.render.bind(eng.pipeline);
    eng.pipeline.render = (world, hud, time) => {
      orig(world, hud, time);
      c2.drawImage(canvas, 0, 0, 64, 36);
      const d = c2.getImageData(0, 0, 64, 36).data;
      let lum = 0;
      for (let i = 0; i < d.length; i += 4) lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      lum /= d.length / 4;
      const s = eng.store.get();
      const cam = eng.runtime.director?.camera;
      const p = cam ? cam.position.toArray() : [0, 0, 0];
      const e = cam ? cam.matrixWorld.elements : null;
      const f = e ? [-e[8], -e[9], -e[10]] : [0, 0, -1];
      const ch = s.chapterId;
      w.samples.push({
        t: performance.now(),
        ch,
        st: s.stepId,
        ph: s.transition?.phase ?? 'idle',
        p,
        f,
        lum,
      });
      // the light a reader sees also includes the transition's own mix (frozen frame, iris): `lum` is after it
      const ph = s.transition?.phase ?? 'idle';
      // the outgoing chapter's frames while the next one loads (its walk to the border): the latest is kept, so
      // the frame right before the swap is at hand
      if (ph === 'loading' && ch === w.lastChapter)
        w.edge = {
          name: 'edge',
          ch,
          st: s.stepId,
          i: w.samples.length - 1,
          jpg: canvas.toDataURL('image/jpeg', 0.85),
          thumb: thumbOf(),
        };
      let name = w.want;
      if (w.lastChapter !== null && ch !== w.lastChapter) {
        name = name ?? `enter-${ch}`;
        if (w.edge) w.shots.push({ ...w.edge, name: `edge-${w.edge.ch}` });
        w.edge = null;
      }
      // the chapter transition (if any) has just ended: the incoming chapter's own first free frame
      else if (w.lastPh !== null && w.lastPh !== 'idle' && ph === 'idle') name = name ?? `idle-${ch}`;
      w.lastChapter = ch;
      w.lastPh = ph;
      if (name) {
        w.want = null;
        w.shots.push({
          name,
          ch,
          st: s.stepId,
          i: w.samples.length - 1,
          jpg: canvas.toDataURL('image/jpeg', 0.85),
          thumb: thumbOf(),
        });
      }
    };
  });
}

/** Ask for a shot of the next frame; resolves when it is taken. */
export async function shoot(page, name) {
  await page.evaluate((n) => (window.__walk.want = n), name);
  await page.waitForFunction((n) => window.__walk.shots.some((s) => s.name === n), name, { timeout: 15000 });
}

/** Take the samples and shots gathered so far out of the page. */
export async function drain(page) {
  return page.evaluate(() => {
    const w = window.__walk;
    const out = { samples: w.samples, shots: w.shots };
    w.samples = [];
    w.shots = [];
    w.edge = null;
    return out;
  });
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (v) => Math.hypot(...v);
const angle = (a, b) => {
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b) || 1);
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
};
const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Per-frame steps of a run of samples and the frames that jump: a one-frame change far larger than the frames
 * around it (a cut) — camera position (world units), view direction (degrees), mean luminance (0…255).
 * `lim`: absolute floors under which a step is never a jump.
 */
export function jumps(samples, lim = { pos: 0.12, deg: 1.2, lum: 6 }) {
  const steps = samples.slice(1).map((s, i) => ({
    i: i + 1,
    pos: len(sub(s.p, samples[i].p)),
    deg: angle(s.f, samples[i].f),
    lum: Math.abs(s.lum - samples[i].lum),
    swap: s.ch !== samples[i].ch,
  }));
  const found = [];
  for (const k of ['pos', 'deg', 'lum']) {
    steps.forEach((st, j) => {
      const around = steps
        .slice(Math.max(0, j - 4), j)
        .concat(steps.slice(j + 1, j + 5))
        .map((x) => x[k]);
      if (st[k] > lim[k] && st[k] > 4 * Math.max(median(around), lim[k] / 8))
        found.push({
          kind: k,
          at: st.i,
          size: st[k],
          swap: st.swap,
          step: samples[st.i].st,
          ch: samples[st.i].ch,
        });
    });
  }
  const largest = Object.fromEntries(
    ['pos', 'deg', 'lum'].map((k) => [k, Math.max(0, ...steps.map((s) => s[k]))]),
  );
  return { found, largest };
}

/** Luminance of a crossing: before (median of the first frames), after, and the largest excursion between. */
export function lightCourse(samples, head = 8) {
  const before = median(samples.slice(0, head).map((s) => s.lum));
  const after = median(samples.slice(-head).map((s) => s.lum));
  const peak = samples.reduce(
    (m, s) => (Math.abs(s.lum - before) > Math.abs(m - before) ? s.lum : m),
    before,
  );
  // a flash: the light leaves both ends' level and comes back (an excursion beyond the straight way between)
  const excursion = Math.max(0, Math.min(Math.abs(peak - before), Math.abs(peak - after)));
  return { before, after, peak, excursion };
}

/** Difference of two 32×18 RGB thumbnails: mean absolute (0…255) and the worst of 8×6 blocks. */
export function frameDiff(a, b) {
  let sum = 0;
  const blocks = new Array(48).fill(0);
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    const px = Math.floor(i / 3);
    const x = px % 32;
    const y = Math.floor(px / 32);
    blocks[Math.floor(y / 3) * 8 + Math.floor(x / 4)] += d;
  }
  return { mean: sum / a.length, block: Math.max(...blocks) / (12 * 3) };
}
