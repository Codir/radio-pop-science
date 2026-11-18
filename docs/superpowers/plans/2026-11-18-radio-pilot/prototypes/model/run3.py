import numpy as np, sys, time
from chain import *
luma = test_frame()
det = sys.argv[1] if len(sys.argv)>1 else 'slope'
trust = float(sys.argv[2]) if len(sys.argv)>2 else 0.25
def run(dbm, frames=6, warm=2, seed=7, **kw):
    L = Link(seed); acc = np.zeros((ROWS,COLS)); scrs=[]; lost=0
    for i in range(warm): L.step(luma, dbm, detector=det, trust=trust, **kw)
    for i in range(frames):
        s, st = L.step(luma, dbm, detector=det, trust=trust, **kw); scrs.append(s.astype(float)); lost += st['lost']/st['lines']
    return scrs, lost/frames
ref_s, _ = run(-54); ref = np.mean(ref_s, axis=0)
levels = list(range(-60, -94, -2)); clean = []; losts=[]
for dbm in levels:
    scrs, lost = run(dbm)
    mse = np.mean([(s-ref)**2 for s in scrs]); c = 10*np.log10(255**2/mse); clean.append(c); losts.append(lost)
    print(dbm, 'clean %.1f dB'%c, 'syncLost %.3f'%lost)
clean = np.array(clean); lv = np.array(levels)
def slope(a,b):
    m = (lv<=a)&(lv>=b); return np.polyfit(lv[m], clean[m], 1)[0]
print('slope -60..-76: %.2f'%slope(-60,-76), ' slope -84..-92: %.2f'%slope(-84,-92), 'slope -62..-74 %.2f'%slope(-62,-74))
# knee: where the curve falls 3 dB below the straight line fitted on -60..-72
m = (lv<=-60)&(lv>=-72); p = np.polyfit(lv[m], clean[m], 1); dev = np.polyval(p, lv) - clean
for l, dv in zip(lv, dev): print(l, 'below line %.1f'%dv)
