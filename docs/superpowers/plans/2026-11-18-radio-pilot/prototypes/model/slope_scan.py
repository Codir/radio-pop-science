import numpy as np
# channel rate: 20 Msps shown; deviation f(u) = -4.3 + 8.3 u MHz ; u: 0 sync, 0.3 black, 1 white
fs = 20.0
def curve(r, theta_deg, os=1):
    u = np.linspace(0, 1, 201)
    w = 2*np.pi*(-4.3 + 8.3*u)/(fs*os)
    th = np.deg2rad(theta_deg)
    H = 1/np.abs(1 - r*np.exp(1j*(th - w)))
    return u, H
best = []
for os in (1, 2):
    for r in np.arange(0.05, 0.96, 0.05):
        for th in np.arange(-180, 181, 2.0):
            u, H = curve(r, th, os)
            if not np.all(np.diff(H) > 0): continue
            m = (u >= 0.3)
            # straight line through black and white
            a = (H[m][-1]-H[m][0])/(1-0.3)
            lin = H[m][0] + a*(u[m]-0.3)
            err = np.max(np.abs(H[m]-lin))/(H[m][-1]-H[m][0])
            # sensitivity: span relative to mean level (AM depth) -> noise advantage
            depth = (H[m][-1]-H[m][0])/H[m].mean()
            syncsep = (H[m][0]-H[0])/(H[m][-1]-H[m][0])  # sync depth relative to picture span (ideal 0.3/0.7=0.43)
            best.append((err, os, round(r,2), th, depth, syncsep))
best.sort()
for os in (1,2):
    print('oversample', os)
    shown = 0
    for b in best:
        if b[1]==os and b[4] > 0.25 and b[5] > 0.2:
            print('  nonlin %.3f  r=%.2f theta=%6.1f  depth=%.2f  sync/picture=%.2f' % (b[0], b[2], b[3], b[4], b[5]))
            shown += 1
            if shown >= 6: break
