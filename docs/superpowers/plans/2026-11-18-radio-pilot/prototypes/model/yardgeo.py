import numpy as np
LAM = 0.1224; C = 299.792458  # m/us -> m per microsecond; use ns: 0.299792458 m/ns
GAIN = 1.1
LOSS = dict(brick=8.0, wood=3.0, glass=1.0, slab=10.0, iron=30.0)
def make(x0=19.2):
    S = dict()
    S['tx'] = np.array([0.0, 0.0, 3.0])
    S['stops'] = [np.array(p, float) for p in ((19.0, 6.0, 1.2), (x0+0.6, 0.0, 1.2), (x0+4.0, 0.0, 1.2), (x0+8.0, 0.0, 1.2), (x0+7.4, 0.0, -1.5))]
    xe = x0 + 9.4
    S['walls'] = [
        ((x0, -3.0), (x0, 3.0), 'brick'),            # west shell
        ((x0, -3.0), (xe, -3.0), 'brick'),           # south shell
        ((x0, 3.0), (xe, 3.0), 'brick'),             # north shell
        ((xe, -3.0), (xe, 3.0), 'brick'),            # east shell
        ((x0+2.2, -3.0), (x0+2.2, 3.0), 'wood'),     # kitchen | hallway: partition
        ((x0+2.5, -3.0), (x0+2.5, 3.0), 'wood'),     # ... and cupboard along it
        ((x0+5.8, -3.0), (x0+5.8, 3.0), 'brick'),    # hallway | far room
        ((x0+2.5, -2.4), (x0+5.8, -2.4), 'wood'),    # wardrobe at the south end of the hallway (doors)
        ((x0+2.5, -2.7), (x0+5.8, -2.7), 'wood'),    # ... its back
    ]
    S['slabZ'] = -0.2
    S['leaf'] = None
    return S
def seg_cross(p, q, a, b):
    # 2D segment intersection (proper)
    p = np.asarray(p[:2]); q = np.asarray(q[:2]); a = np.asarray(a); b = np.asarray(b)
    r = q - p; s = b - a; den = r[0]*s[1] - r[1]*s[0]
    if abs(den) < 1e-12: return False
    t = ((a[0]-p[0])*s[1] - (a[1]-p[1])*s[0])/den
    u = ((a[0]-p[0])*r[1] - (a[1]-p[1])*r[0])/den
    return 0 < t < 1 and 0 <= u <= 1
def wall_loss(S, p, q):
    L = 0.0
    for a, b, m in S['walls']:
        if seg_cross(p, q, a, b): L += LOSS[m]
    if (p[2] - S['slabZ'])*(q[2] - S['slabZ']) < 0: L += LOSS['slab']
    return L
def fspl(d): return 20*np.log10(4*np.pi*d/LAM)
def tray_loss(tray, d1):
    if tray <= 0: return 0.0
    h = -0.4 + 0.6*tray; d2 = 0.05
    v = h*np.sqrt(2*(d1+d2)/(LAM*d1*d2))
    if v < -0.78: return 0.0
    return 6.9 + 20*np.log10(np.sqrt((v-0.1)**2+1) + v - 0.1)
def rx_point(S, route, nudge):
    i = int(min(np.floor(route), 3)); f = route - i
    p = S['stops'][i]*(1-f) + S['stops'][i+1]*f
    ax = S.get('nudgeAxis', np.array([1.0, 0.0]))
    return p + np.array([ax[0]*nudge, ax[1]*nudge, 0.0])
def gate_factor(g):
    t = np.clip((g-0.3)/0.6, 0, 1); return t*t*(3-2*t)
def trace(S, route=1, nudge=0, gate=0, tray=0, txmw=10, f=2450e6):
    tx = S['tx']; rx = rx_point(S, route, nudge)
    rays = []
    d = np.linalg.norm(rx-tx)
    tl = tray_loss(tray, d)
    rays.append(dict(gainDb=2*GAIN - fspl(d) - wall_loss(S, tx, rx) - tl, delayNs=d/0.299792458, d=d))
    gf = gate_factor(gate)
    if S['leaf'] is not None and gf > 0:
        a, b = [np.asarray(v, float) for v in S['leaf']]
        n = np.array([-(b-a)[1], (b-a)[0]]); n /= np.linalg.norm(n)
        img = tx.copy(); img[:2] = tx[:2] - 2*np.dot(tx[:2]-a, n)*n
        # specular point: intersection of img->rx with line a-b
        r = rx[:2]-img[:2]; s = b-a; den = r[0]*s[1]-r[1]*s[0]
        if abs(den) > 1e-12:
            t = ((a[0]-img[0])*s[1] - (a[1]-img[1])*s[0])/den
            u = ((a[0]-img[0])*r[1] - (a[1]-img[1])*r[0])/den
            if 0 < t < 1 and 0 <= u <= 1:
                sp = img + t*(rx-img); sp3 = np.array([sp[0], sp[1], img[2] + t*(rx[2]-img[2])])
                dr = np.linalg.norm(rx-img)
                L = wall_loss(S, tx, sp3) + wall_loss(S, sp3, rx)
                rays.append(dict(gainDb=2*GAIN - fspl(dr) - L - tl + 20*np.log10(gf), delayNs=dr/0.299792458, d=dr, sp=sp3))
    ptx = 10*np.log10(txmw)
    h = sum(10**(r['gainDb']/20)*np.exp(-2j*np.pi*f*r['delayNs']*1e-9) for r in rays)
    rxdbm = ptx + 20*np.log10(abs(h))
    return rays, rxdbm, rx
