import numpy as np
from yardgeo import *
def design(S, stop, delta, beta, half=50.0):
    tx = S['tx']; rx = S['stops'][stop]; d = np.linalg.norm(rx[:2]-tx[:2])
    b = np.deg2rad(beta); rdir = np.array([-np.sin(b), np.cos(b)])
    lo, hi = 0.1, 40.0
    for _ in range(60):
        t = (lo+hi)/2; sp = rx[:2] - t*rdir
        if np.linalg.norm(sp - tx[:2]) + t > d + delta: hi = t
        else: lo = t
    sp = rx[:2] - t*rdir
    inc = (sp - tx[:2]); inc /= np.linalg.norm(inc)
    n = rdir - inc; n /= np.linalg.norm(n); along = np.array([-n[1], n[0]])
    S['leaf'] = (sp - half*along, sp + half*along)
    return sp, along
def report(S, routes=(0,1,2,3,4)):
    for r in routes:
        rays, rxdbm, rx = trace(S, r, 0, 1)
        closed = trace(S, r, 0, 0)[1]
        if len(rays) < 2: print(' route', r, 'no reflection; level', round(closed,2)); continue
        a = 10**((rays[1]['gainDb']-rays[0]['gainDb'])/20)
        # scan nudge for min and spacing
        ns = np.arange(-0.15, 0.1501, 0.001); lv = np.array([trace(S, r, n, 1)[1] for n in ns])
        mins = [i for i in range(1,len(ns)-1) if lv[i] < lv[i-1] and lv[i] <= lv[i+1]]
        sp = np.diff(ns[mins])*100 if len(mins) > 1 else []
        fs = np.arange(2400e6, 2483.01e6, 0.25e6); nmin = ns[np.argmin(lv)]
        lf = np.array([trace(S, r, nmin, 1, f=f)[1] for f in fs]); fm = [fs[i] for i in range(1,len(fs)-1) if lf[i] < lf[i-1] and lf[i] <= lf[i+1]]
        d1 = rays[0]['d']; d2 = rays[1]['d']
        print(' route', r, 'a %.3f'%a, 'deepest %.2f dB'%(lv.min()-closed), 'best +%.2f'%(lv.max()-closed), 'dead spots at cm', np.round(ns[mins]*100,1), 'spacing', np.round(sp,2), 'notches MHz', np.round(np.array(fm)/1e6,1), 'extra %.2f m'%(d2-d1), 'delay %.1f ns'%(rays[1]['delayNs']-rays[0]['delayNs']), 'spec (%.2f, %.2f)'%(rays[1]['sp'][0], rays[1]['sp'][1]))
for stop, delta, beta in ((1, 10.0, 28), (1, 10.0, 25), (2, 10.3, 30)):
    S = make()
    sp, along = design(S, stop, delta, beta)
    tx = S['tx']; rx = S['stops'][stop]
    ddir = (rx[:2]-tx[:2]); ddir /= np.linalg.norm(ddir); b = np.deg2rad(beta); rdir = np.array([-np.sin(b), np.cos(b)])
    ax = ddir - rdir; S['nudgeAxis'] = ax/np.linalg.norm(ax)
    print('designed at stop', stop, 'delta', delta, 'beta', beta, 'leaf point (%.2f, %.2f) along (%.3f, %.3f)'%(sp[0], sp[1], along[0], along[1]), 'nudge axis', np.round(S['nudgeAxis'],3))
    report(S)
