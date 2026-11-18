import numpy as np
from scipy import signal
COLS, ROWS, FRAME_LINES = 128, 96, 100
FRONT, SYNC, BACK, ACTIVE, LS = 7, 21, 26, 234, 288
AT_SYNC, SPAN = -4.3e6, 8.3e6
def rad(u): return 2*np.pi*(AT_SYNC+SPAN*u)/20e6
def lp(n, fc):
    k = np.arange(n)-(n-1)/2
    h = 2*fc*np.sinc(2*fc*k)*np.hamming(n)
    return h/h.sum()
def test_frame():
    f = np.zeros((ROWS, COLS))
    c = np.arange(COLS)[None,:]; r = np.arange(ROWS)[:,None]
    f[:] = 40 + (c*0+1)*(r*1.0)          # background: vertical grey gradient 40..135
    f[8:40, 8:40] = 255                    # white shed wall
    f[8:40, 44:60] = 0                     # black nook
    f[48:80, 8:56] = np.where((np.arange(8,56)%2==0)[None,:], 255, 0)  # pickets, one cell
    f[84:92, :] = np.round(np.arange(COLS)*255/(COLS-1))[None,:]        # grey ramp
    cy, cx = 30, 96
    blob = ((r-cy)**2/14**2 + (c-cx)**2/18**2) <= 1
    f[blob] = 90
    f[cy-6, cx] = 255
    return np.clip(np.round(f),0,255).astype(np.uint8)
def encode(luma, sync=True):
    out = np.empty(FRAME_LINES*LS, dtype=np.float32)
    k = np.arange(ACTIVE)
    p = (k+0.5)*COLS/ACTIVE - 0.5
    i0 = np.clip(np.floor(p).astype(int), 0, COLS-1); i1 = np.clip(i0+1, 0, COLS-1); fr = np.clip(p-np.floor(p),0,1)
    low = 0.0 if sync else 0.3
    for l in range(FRAME_LINES):
        row = out[l*LS:(l+1)*LS]
        row[:FRONT] = 0.3
        if l < ROWS:
            row[FRONT:FRONT+SYNC] = low; row[FRONT+SYNC:FRONT+SYNC+BACK] = 0.3
            y = luma[l].astype(np.float64)
            v = y[i0]*(1-fr) + y[i1]*fr
            row[54:] = 0.3 + 0.7*v/255
        else:
            row[FRONT:FRONT+255] = low; row[FRONT+255:] = 0.3
    return out
class Decoder:
    def __init__(self, seed=1):
        self.rng = np.random.default_rng(seed); self.reset()
    def reset(self):
        self.ph = 0.0; self.line = 0; self.run = 0; self.marks = 0; self.wander = 0.0; self.P = 288.0
        self.acc = np.zeros(COLS); self.cnt = np.zeros(COLS); self.n = 0; self.found = False; self.prevv = 0.3; self.frac = 0.5
    def process(self, video, lineLength, trust, threshold, screen, W=16):
        pulses = 0; lost = 0; lines = 0
        off0 = None; drift_acc = 0.0
        ph, line, run, marks = self.ph, self.line, self.run, self.marks
        acc, cnt = self.acc, self.cnt
        P = lineLength + self.wander
        found = self.found
        prev = self.prevv; frac = self.frac
        S = COLS/ACTIVE
        for v in video:
            if off0 is None:
                d = ph - (self.n % LS); d = (d + 144) % 288 - 144; off0 = d
            if v < threshold:
                if run == 0:
                    frac = (prev - threshold)/(prev - v) if prev > v else 0.5   # where between the two sample centres
                run += 1
                if run == 10:
                    # crossing position in line phase: centre of previous sample + frac ; this sample's centre is ph+0.5
                    start = (ph - 9) + 0.5 - 1 + frac
                    err = start - FRONT
                    err = (err + P/2) % P - P/2
                    ph -= trust*err
                    drift_acc -= trust*err
                    pulses += 1
                    if abs(err) <= W: found = True
                elif run == 65:
                    line = ROWS + marks; marks = min(marks+1, 3)
            else:
                if 10 <= run < 65: marks = 0
                run = 0
            prev = v
            if line < ROWS:
                a = (ph - 54)*S; b = a + S
                if b > 0 and a < COLS:
                    c0 = int(np.floor(a)) if a > 0 else 0
                    if a < 0: a = 0.0
                    if b > COLS: b = float(COLS)
                    c1 = int(np.floor(b))
                    if c1 == c0 or b == c1:
                        acc[c0] += v*(b-a); cnt[c0] += (b-a)
                    else:
                        acc[c0] += v*(c1-a); cnt[c0] += (c1-a)
                        if c1 < COLS: acc[c1] += v*(b-c1); cnt[c1] += (b-c1)
            ph += 1; self.n += 1
            if ph >= P:
                ph -= P
                if line < ROWS:
                    m = cnt > 0.25
                    val = (acc[m]/cnt[m] - 0.3)/0.7*255
                    screen[line, m] = np.clip(np.round(val), 0, 255)
                acc[:] = 0; cnt[:] = 0
                line = (line+1) % FRAME_LINES
                lines += 1
                if not found: lost += 1
                found = False
                drift_acc -= P - LS
                self.wander = np.clip(self.wander + self.rng.normal(0, 0.01), -0.05, 0.05)
                P = lineLength + self.wander
        self.ph, self.line, self.run, self.marks, self.found = ph, line, run, marks, found
        self.prevv = prev; self.frac = frac
        return dict(pulses=pulses, lost=lost, lines=lines, lineOffset=off0, lineDrift=drift_acc/max(lines,1))
H_CH = lp(63, 0.1)
H_VID = lp(31, 0.275)
R, TH = 0.2, np.deg2rad(82)
def slope_cal():
    def H(u): return 1/abs(1-R*np.exp(1j*(TH-rad(u))))
    a = 0.7/(H(1.0)-H(0.3)); b = 0.3 - a*H(0.3); return a, b
SA, SB = slope_cal()
class Link:
    def __init__(self, seed=1):
        self.rng = np.random.default_rng(seed); self.dec = Decoder(seed); self.reset()
    def reset(self):
        self.phase = 0.0; self.zi_up = np.zeros(len(H_CH)-1, complex); self.zi_ch = np.zeros(len(H_CH)-1, complex)
        self.zs = np.zeros(1, complex); self.zv = np.zeros(len(H_VID)-1); self.prev = 1+0j; self.dec.reset()
        self.screen = np.zeros((ROWS, COLS), np.uint8)
    def step(self, luma, dbm, sync=True, lineLength=288.0, trust=0.25, detector='slope', limiter=True, noise=True, ripple=None):
        u = encode(luma, sync)
        ph = self.phase + np.cumsum(rad(u.astype(np.float64))); self.phase = ph[-1] % (2*np.pi)
        x = np.exp(1j*ph)
        up = np.zeros(len(x)*5, complex); up[::5] = x*5
        wb, self.zi_up = signal.lfilter(H_CH, 1, up, zi=self.zi_up)
        amp = 10**(dbm/20)
        wb = wb*amp
        if ripple is not None: wb = wb*ripple
        if noise:
            sig = 10**(-92/20)/np.sqrt(2*np.sum(H_CH**2))
            wb = wb + sig*(self.rng.standard_normal(len(wb)) + 1j*self.rng.standard_normal(len(wb)))
        f, self.zi_ch = signal.lfilter(H_CH, 1, wb, zi=self.zi_ch)
        ch = f[::5]
        self.pw = 10*np.log10(np.mean(np.abs(ch)**2))
        floor = 10**(-100/20)
        if limiter:
            m = np.abs(ch); ch = np.where(m >= floor, ch/np.maximum(m,1e-30), ch/floor)
        else:
            ch = ch/amp
        if detector == 'slope':
            y, self.zs = signal.lfilter([1], [1, -R*np.exp(1j*TH)], ch, zi=self.zs)
            v = SA*np.abs(y) + SB; thr = 0.226
        else:
            prev = np.concatenate(([self.prev], ch[:-1])); self.prev = ch[-1]
            v = (np.angle(ch*np.conj(prev))*20e6/(2*np.pi) - AT_SYNC)/SPAN; thr = 0.15
        v, self.zv = signal.lfilter(H_VID, 1, v, zi=self.zv)
        self.video = v
        st = self.dec.process(v, lineLength, trust, thr, self.screen)
        return self.screen.copy(), st
