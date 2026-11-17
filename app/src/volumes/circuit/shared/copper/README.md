# `shared/copper` — «усередині міді»: the lower floors of the volume `circuit`

One object, `createCopper(ctx)`, holds the wire core, the rows of copper atoms, one atom, the free electrons
and the plastic sheath (VISUAL §3, §6). It knows nothing about steps: a chapter mounts it, writes parameters and
calls `update(dt, t)`. Every state chapter 1 needs is shown in the showcase
`#/_dev/_sandbox-circuit-copper/<step>?debug` (`app/src/volumes/_dev/chapters/_sandbox-circuit-copper`, the
table `states.ts` is the list of states with their parameter values; `interact.ts` shows pointer handling).

## Mounting

```ts
const copper = createCopper(ctx);
ctx.root.add(copper.group);
const scale = mountAtHandover(copper.group, HANDOVER);        // mount.ts; HANDOVER comes from shared/stage
camera.shots(copperShots(copper.group, 'copper-'));           // shots.ts → 'copper-core', 'copper-rows', …
stage.param('depth', 0, { onChange: (v) => (copper.depth = v) });
stage.param('lamp', 0, { onChange: (v) => (copper.lamp = v) });
stage.define({ atoms: { camera: 'copper-rows', params: { depth: 1, lamp: 1 },
                        envTune: copperEnv(1, copper.group), post: copperPost(1, scale) } });
return { update(dt, t) { copper.update(dt, t); }, enterStep(_, info) { if (info.instant) copper.snap(); } };
```

- **Frame of reference** (local units of `copper.group`): the wire axis is **X** (left ↔ right in the frame; the
  stand's lamp is to the right), the plane of atoms the reader looks at is **XY at z = 0**, the bulk recedes
  along **−Z**, the reader stands on **+Z**; **+Y** is «above» (the far side of the board, where the light
  comes from). Atom radius 1, neighbours 3.2 apart, electron radius 1/6, origin = the hero atom the dive ends in.
- **Uniform scale only.** `copper.space` (a child) carries the zoom of the dive; do not touch it.
- `copper.toLocal(worldPoint)` and `copper.localRay(ray, out)` convert pointer hits into the units of
  `lattice`, `atom` and `sim` (they include the dive zoom).
- Not under `ctx.root`? Then dispose the group yourself; under it everything is released automatically.

## Hand-over from the stand (`W1-circuit-stage`)

W1's pose (`/srv/electricity/qa/W1-circuit-stage/handover-pose.md`, `HANDOVER` in `shared/stage/shots.ts`): the
camera looks across the near wire, 4.17 core radii from its axis, fov 27°, the core's diameter equals the height
of the 3 : 2 safe frame, the sheath is already gone. `mountAtHandover(group, { point, view, axis, coreRadius })`
puts this world there: at `depth = 0` the shot `core` is the same camera pose and shows the same band of copper
(`CORE_R` 6.1 units at `CAMERA_Z` 19.7, `CAMERA_FOV` 27°), so the two worlds can be exchanged by a dissolve.
The showcase is mounted at W1's numbers of 2026-11-16 (scale ≈ 0.0059, tilted 41°) — everything is verified at
that transform, not only at the origin.

Things that follow from that pose:

- **The engine's camera keeps world «up»** (`director.ts` sets it every frame). With the world tilted 41°, any
  turn of the camera to the side rolls the picture. So no shot is turned sideways (only raised), and
  `copperShots` narrows the reader's sideways look-around to ±0.03 rad when the mount is tilted. If a chapter
  needs a turned view, the engine needs `Shot.up` (request in `docs/requests/W2-circuit-copper.md`).
- **Light**: lamp on — warm, from the upper right; circuit open — cool and weak, from the upper left.
  `copperEnv(lamp, group)` returns the rig (`sunDir`, key, fill, rim) in world space for the mounted group;
  `copper.lamp` drives the backdrop glow, the veils between the planes and the metal of the core.
- **Common drift** when the circuit is closed runs right → left in the frame: `copper.sim.drift` negative.
- **Lens rim**: W1's stage owns `lensRim` (an overlay object that stays on screen on all lower floors).
  `copper.rim` is the same thing drawn here in screen space for the showcase and for stand-alone use
  (`rim.amount` 0…1, `rim.open` 0.3 a ring in the frame … 0.97 corner arcs). Show one of the two, not both:
  in a chapter with the stand set `copper.rim.amount = 0`.
- **World-unit lens parameters** (`dofRange`, `dofReference`, `aoRadius`) and `ctx.env.setScale` follow the mount
  scale: use `copperPost(depth, scale)` and `ctx.env.setScale(COPPER_LOOK_RADIUS * scale)`. With the stand in the
  same chapter the env scale belongs to the stand — then pass only `copperPost`.
- Screen-space `Text3D` multiplies its pixel size by the scale it inherits; labels you attach inside the group
  must be counter-scaled (see `gate.ts`).

## Parameters

| Parameter | Range, default | What it does |
|---|---|---|
| `copper.depth` | 0 … 2, **1** | The floor. 0 «жила дроту» (hand-over) · 1 «ряди атомів» · 2 «один атом». Continuous: 0 → 1 dots show in the metal at the true places of the lattice, become balls in the dark, the real atoms and electrons come in and the flat picture opens (by 0.9); 1 → 2 the neighbours shrink away, the crowd of electrons fades, the hero's ball shrinks into its nucleus and uncovers the electron layers. Tween it yourself (showcase step `dive`: 6 s + 3 s). |
| `copper.lamp` | 0 … 1, **0** | State of the circuit as light: backdrop glow, veils, core metal. Pair it with `copperEnv(lamp, group)`. |
| `copper.atoms` | 1 …, **Infinity** | How many atoms exist, in `Site.rank` order: 1 lone atom, 2 a pair, 5 a row, 15 a piece (`ROW_ATOMS`, `PIECE_ATOMS`), `Infinity` the crystal. Atoms pop in ≈ 40 per second; each brings its own outer electron (first 32). |
| `copper.sim.shared` | 0 … 1, **1** | 0: every outer electron circles its own atom; 1: they are shared and roam the piece (`wire/shared`). |
| `copper.sim.speed` | units/s, **12** | Speed of the random flight (the frame is ≈ 17 units wide → 0.7 frame widths per second). |
| `copper.sim.drift` | share of `speed`, **0** | Common shift along X added to the random flight (chapters 4 – 6: 0.03 … 0.06, negative = toward the left). Not shown in chapter 1. |
| `copper.look` | `{ x, y }`, **0, 0** | The point of the focal plane the camera looks at; the crowd keeps around it and never rises above the copper's top surface (`COPPER_TOP`). Set it with the shot (`edge`, `plastic`). |
| `copper.marked` / `markNearest(x?, y?)` | index, **−1** | The marked electron: white core, white ring, path of its last 2.4 s; the crowd dims to 60 %; it turns back before the edge of the frame. |
| `copper.sim.gate` | `{ on, x, y, half, left, right }` | The counter frame's window in the plane x = `x` and the two counts (reset them yourself). `copper.gate.shown` 0 / 1 pops the frame, `copper.gate.numbers` shows «← n» «n →» above it. |
| `copper.lattice.selected` / `touch(site)` | site, **−1** | The chosen atom stays swollen, lit, in a brighter veil; `touch` is a one-off swell. `lattice.siteAt(localPoint)` finds the atom under a hit. |
| `copper.lattice.tremble` | units, **0.05** | Trembling of the atoms (2.5 % of the diameter). |
| `copper.lattice.heat` | 0 … 1, **0** | Foreseen for chapters 5 – 6: trembling up to 12 % and an orange rim. Not used in chapter 1. |
| `copper.atom.apart`, `.aside` | 0 … 1, **0**; vector | The electrons move aside by `aside` (default 2.2 to the left), the nucleus stays (`wire/inside-atom`). |
| `copper.atom.hold(i, point)` / `hold(-1)` | i 0 … 27 near, `OUTER` (28) | Drag an electron toward a point (local units). A near one gives less and less and springs back; the outer one follows and beyond 2.15 units from the nucleus comes off: `atom.freed` (until `atom.reset()`). `atom.nearest(origin, direction)` picks the electron along a ray. |
| `copper.rim.amount`, `.open` | 0 … 1, **1**; **0.97** | The magnifier's rim in the corners (see «Hand-over»). |

Derived from `depth` every frame (do not set): `lattice.fade / others / heroShrink / reveal`, `electrons.fade`,
`atom.open / outerShown / nucleusShown`, `core.*`, `backdrop.dome / veils`, `plastic.fade`, `sim.piece`.

## States of chapter 1 → parameters (showcase steps in brackets)

| Step of the path | Shot | Parameters |
|---|---|---|
| `prologue/dive`, start of `wire/atoms` | `core` → `rows` | `depth` 0 → 1 [`core`, `core-off`, `dive`, `dive-a`, `dive-b`] |
| `wire/atoms` | `rows` | `depth` 1; click → `lattice.selected` [`rows`, `rows-lit`, `rows-touch`] |
| `wire/inside-atom` | `atom`, `apart` | `depth` 2, `atom.apart` 0 … 1 [`atom`, `atom-apart`] |
| `wire/outer` | `atom` | `depth` 2, `atom.hold(…)` [`outer-near`, `outer-free`] |
| `wire/shared` | `one`, `pair`, `row`, `piece` | `depth` 1, `atoms` 1 / 2 / 5 / 15, `sim.shared` 0 → 1 [`shared-1` … `shared-piece`] |
| `wire/restless` | `rows`, `gate` | `markNearest()`, `sim.gate.on`, `gate.shown` [`restless`, `restless-count`] |
| `wire/plastic` | `edge`, `plastic` | `look.y` = `COPPER_TOP` + 0.4 … + 8.6 [`plastic-edge`, `plastic`] |

No «+» / «−» anywhere: the electron character is created with `glyph: 'none'`.

## Shots (`shots.ts`)

`COPPER_SHOTS` are in the local frame; `copperShots(group, prefix)` returns them for the mounted group with
`fov` 27°, `fit` (phones re-frame from it) and the orbit limits. Names: `core`, `rows`, `atom`, `apart`, `one`,
`pair`, `row`, `piece`, `gate`, `edge`, `plastic`. All look straight along −Z, only raised a little (no yaw,
see «Hand-over»). The counter frame is shown as a window by perspective alone: put it left of the middle
(`sim.gate.x ≈ −4.8`, between two columns of atoms) and use the shot `gate`.

## What is in the frame, and why (VISUAL §6)

- **Atoms** — matte coral balls (`coral` → `coral.dark`, lit by the rig), no marks, each in a thin veil of its own
  electrons (`haze.ts`); a touch more than 2 % trembling. Copper is face-centred cubic: every plane is a square
  grid, the next plane stands behind the gaps. Three rows of the focal plane are in focus; the planes behind
  lose light behind the veils of `backdrop.ts` and melt in the depth of field.
- **Free electrons** — 32 in the slab of the focal plane (about 14 inside a 16 : 9 frame; never more than 20)
  and 44 dimmer ones in the planes behind (depth only). Each flies straight, turns at random and off the atoms,
  and never enters the plastic; solid tapered tails (`streaks.ts`), length by speed.
- **One atom** — the nucleus is one glowing coral ball («ядро збільшено»: say it in the panel); 28 soft blurs
  in three layers 2 · 8 · 18 that flow slowly (`soft-dots.ts`, `shells.ts`); the 29th, outer electron farther out
  and drawn as the bright electron character. No orbit lines.
- **Plastic** — violet atoms in wavy zigzag chains, one electron per atom on a short thread (`plastic.ts`).
- **Stated simplifications** (no longer shown on the panel — DECISIONS §60 x): electrons as small balls; the wire, atom and nucleus
  are not to scale; motion slowed by many orders of magnitude; polymer chains simplified to one kind of atom.

## Performance (RTX 5060, quality `high`, `tools/qa/chapter-check.mjs _dev/_sandbox-circuit-copper`)

Measured numbers are in `docs/reports/W2-circuit-copper.md`. Orders of magnitude: ≤ 4 ms per frame at
1920×1080, ≤ 46 draw calls, ≤ 13 000 triangles; 812 instanced atoms (4 planes), 76 electrons, one CPU loop over them
per frame. Everything repeated is instanced; no shadows are cast (impostor spheres do not use shadow maps).

## Foreseen for chapters 2 – 7 (not built, not blocked)

- **Signs** (`charge/signs`): the atom and electron styles take `glyph`; make a second `createOrbs` with
  `glyph: 'minus'` / `'plus'` and cross-fade, or add a `signs` switch to `electrons.ts` / `lattice.ts`.
- **Field arrows, the charged ball next to a piece of copper** (`charge/shift`): the world is an ordinary group —
  add `@/fx` arrows beside it in local units; `sim.drift` already shifts the crowd; an end-stop (electrons
  gathering at one side) needs a wall in `electron-rules.ts` (like `keepInCopper`).
- **Common drift** (chapter 4): `sim.drift` (3 – 6 % of `speed`, VISUAL §6) with the random flight kept; the
  counter frame then counts unequal numbers. Three magnifiers at once (`flow/together`) need three views of
  this world: render it to a target per lens, or mount three instances (≈ 3 ms each at 1080p).
- **Collisions and heat** (chapter 5): `collide()` in `electron-rules.ts` returns the site that was hit — flash
  it with `lattice.touch(site)` and raise `lattice.heat`; a per-atom heat value needs one more instanced
  attribute in `haze.ts`.
- **Tungsten filament** (chapter 6): another lattice (tungsten is body-centred cubic) and another palette —
  `layout.ts` (`latticeSites`) and the colours in `lattice.ts` are the two places to parameterise.
- **Battery** (chapter 3) is not this world.

## Refinement pass of 2026-11-16 (after `prologue` and `wire` were built) — every change

Nothing was removed or renamed; `createCopper` and all earlier parameters work as before.

**New (all optional)**

| Addition | Default | What for |
|---|---|---|
| `copper.hero = site`, `copper.heroPosition(out)` | 0 | The dive below «ряди» opens **any** atom of the focal plane (`lattice.siteAt`). Set it on the rows floor: nothing moves there; on the way to depth 2 the world slides so the atom arrives where every shot looks. The free electrons do not move. Replaces the chapter's `world.recentre`. `atom.hold / nearest / electronPosition` take and give lattice units (`copper.toLocal`), wherever the hero is. |
| `copper.growSeconds` | 1.1 | A big change of `atoms` (a piece of 15 → the whole crystal) grows inside out within this time instead of appearing at once; small changes keep ≈ 40 atoms a second; 0 = at once (the old behaviour for big changes). |
| `sim.gate.balance`, `sim.gate.turned` | 0 (off) | The pull toward equal counts a real wire has: the side that gained electrons pushes the next ones back. Here the electron about to add to the lead takes one of its random turns at the frame, with probability 0.5 · balance · lead². At 1 the counts never part by more than two (about one on average); under one turn per electron in ten seconds. **Use it with the lamp off only** (it would fight a drift). Unit-tested (`__tests__/counter.test.ts`). |
| `driftFor(lamp, share = 0.05)` (`electron-sim.ts`) | — | The common shift for a lamp state: exactly 0 with the lamp off, right → left in proportion to the glow. Unit-tested: lamp off → equal traffic both ways. At 5 % the net flow is ≈ 14 electrons a minute through the frame against a random traffic of ± 13 — it shows in the counts only over a minute or more. |
| `gate.leftAnchor`, `gate.rightAnchor` | — | Where the two counts stand: anchors for interface labels (`gate.numbers = false` hides the scene's own). |
| `GATE_SHOT_X` (`shots.ts`) | −4.8 | Where the frame stands for the shot `gate`. |
| `core.balls`, `core.open`, `core.warmth`, `core.eye`, `STAND_COPPER` (`core.ts`) | — | Stages of the dive (driven by `depth`) and the stand's measured copper. |
| Showcase `_dev/_sandbox-circuit-copper-world` | — | The copper world inside `mountWorld` (the stand above it): one step per floor and lamp state, `part-stand` = the stand's own core as the reference. |

**Changed look or behaviour**

- **Depth 0 is the stand's wire at the moment of the dissolve, colour for colour.** The bright orange core
  with a white band is gone. `STAND_COPPER.handed` holds what the stand's bare core looks like under the
  stand's own light at `deep` 0.99 of the flight (since the stand's pass 4: one even muted copper, a little
  brighter above with the lamp on), `STAND_COPPER.inside` the same wire in the light of this floor; `core.warmth` goes from
  the first to the second over depth 0.02 – 0.34. Measured in the composed world, not in a showcase:
  `qa/W2-circuit-copper/profile.sh` flies the leg with and without the copper world and prints both profiles
  (re-measured after the stand's pass 4: within 3 / 255 per band, both lamp states). At rest on «жила» the frame is that muted copper.
- **Depth 0 → 1 is four eased stages** over the whole leg instead of a pop: dots in the metal (0.05 – 0.4) →
  balls in the dark (0.3 – 0.62) → real atoms and electrons in front of that flat picture (0.54 – 0.8) → the
  picture opens to the depth behind (0.72 – 0.9). The dots are drawn where the line of sight meets the real
  atoms, so flat and real balls coincide. The zoom is gentler: lattice scale 0.03 → 0.62 (at 0.7) → 1.
- **Depth 1 → 2:** the hero's ball uncovers its layers from the outside in while it shrinks to the nucleus; the
  neighbours leave later (1.12 – 1.62) — no bare ball on dark in the middle.
- **Light:** the veils between the planes carry less of the lamp's light (the upper rows no longer wash toward
  beige); the dome's warm glow is 12 % weaker.
- **Counter frame:** deeper frame (a window ≈ 55 px wide at 1280×720 by perspective alone), counts 46 px-eq
  (≈ 32 px tall at 1280×720), the count that grew swells for a moment; shot `gate` looks at x = −0.6.
- `core.fade` is 1 unless the host dissolves the core (the composed world does); `core.surface` stays 0.35.

**Continuity along `depth` (the chapter scrubs the dive by hand).** Every property is a continuous, eased
function of `depth`; nothing is switched. On the way rows → one atom the three veils are driven by what they
let through together (so the dome's light comes up evenly, depth 1.06 – 1.5), the neighbours give up their
area evenly (1.06 – 1.68, radius ∝ √), the warm-up of the core goes 55 % of the way to the «inside» look.
`qa/W2-circuit-copper/sweep.mjs` (showcase steps `sweep`, `sweep-off`) runs 0 → 2 → 0 and prints the largest
step of the mean frame luminance and colour between neighbouring samples; with 240 samples each way the largest
is 1.4 / 255 of luminance (a discontinuity would not shrink with finer sampling; these do).
