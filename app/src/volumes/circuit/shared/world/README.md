# `shared/world` — the composed world of the volume `circuit`

The stand (`shared/stage`, W1) and the copper world (`shared/copper`, W2) in **one scene**, one number for the
floor, the flight through the lens between them and back, the lens as a window onto «ряди», and the floor for
the map's ruler and a «де ми» cue. Owner: `B-circuit-prologue`. Users: `prologue`, `wire` (and every later chapter).

## Mount

```ts
const world = mountWorld(ctx); // theme { sky: 'studio', mood: 'studio' }
world.define({
  // = ctx.stage.define, remembered by the world
  atoms: { camera: 'copper-rows', params: { deep: 2, closed: 1, lens: 1 } },
});
return {
  enterStep: (id, info) => world.enterStep(id, info), // first
  update: (dt, t) => world.update(dt, t), // runs stand.update and copper.update
};
```

Do not call `stand.update` / `copper.update`, `ctx.env.tune` / `setScale`, and give no `envTune` / `post` to steps
below the stand: the world owns both floors' env and post (`look.ts`) and re-asserts them after each entry.

## `deep` — where the reader is (`levels.ts`)

| `deep` | floor (`volume.json` axis) | camera at the stop         | what is drawn                                       |
| ------ | -------------------------- | -------------------------- | --------------------------------------------------- |
| 0      | `stand` (3)                | `lens` (or the step's)     | the stand; copper only as the lens window           |
| 1      | `part` (2) «жила дроту»    | `handover` = `copper-core` | the copper core over the stand's (dissolve 0.8 → 1) |
| 2      | `rows` (1)                 | `copper-rows`              | copper depth 1; the stand is gone from 1.3          |
| 3      | `atom` (0)                 | `copper-atom`              | copper depth 2                                      |

`world.floor` = 3 − `deep` (continuous), `world.floorId`, `world.floorName(volume, visited)` (via `floorLabel`).

## The flight (`flight.ts`)

A change of `deep` between steps is flown, not tweened: (from the stand) the lens onto the wire and the camera to
`lens` (1.4 s) → through the ring to `handover` (2.1 s) → one leg per floor (2.2 s) → the last leg ends on the
step's camera; upward the same way, then to the step's camera with the lens back to the step's `lens`. Camera
and `deep` share duration and ease (`sine.inOut`), so the rim arcs, the sheath and the dissolve happen exactly
where the camera is. Within a step: `world.fly(deep, camera, info)`; `world.flying` while legs run.
A chapter that starts below the stand (`wire`) can open with the whole dive: `world.flyIn(stepId, info)` jumps to
the stand plan (lens in its holder) and flies to the step's floor and camera (5.7 s to «ряди»; `strips/flyin-sheet.jpg`).
With `reducedMotion` every leg is shortened by the camera's own rule, `deep` with it.

## Params (`params.ts`)

`closed` 0 · `unfold` 1 · `moon` 1 · `charge` 1 · `lens` 0 · `lensCall` 0 · `snail` 0 · `ruler` 0 · `spark` 0 ·
`poles` 0 · `window` 0 · `deep` 0. `world.value(name)` reads one.

## Light and post below (`look.ts`)

`copper.lamp` = `stand.glow`; below the stand `copperEnv(glow)` and `copperPost(depth, scale)` blend in (1.1 s) and
follow the lamp; on the way up the stand's light rig is made to re-tune the room. `world.drift` (default 0.05):
the electrons' common shift as a share of their speed at full glow, right → left; 0 with the lamp off.

## The lens as a window (`window.ts`)

`params: { window: 1, lens: 1 }` on a stand step: the copper world at «ряди» is drawn **inside the resting lens**
— a stencil portal (an iris disc on the glass writes stencil 1 and resets depth to far; every copper material
draws only where stencil = 1). No second camera, no render target. `world.window.span` = copper units across the
window (14 keeps the marked electron's leash inside). `world.lensPose` (board frame) lays the lens somewhere else
over the wire for that step; it glides there from `poses.overWire`.

## Verified (frames in `/srv/electricity/qa/B-circuit-prologue/strips/`)

`ring-sheet` (lens → ring → «жила»), `rows-sheet` («жила» → «ряди»), `up-sheet` (rows → riddle shot), `race-sheet`
(window + race), all at 1280×720 under `?hud=dom`. Known: the dissolve shows a colour jump (the copper core is a
brighter, more saturated orange than the stand's core); the metal turns into dots within ≈ 0.25 s of the floor
leg. Both are in the libraries and filed in `docs/requests/B-circuit-prologue.md`.

## Not here

The atom floor (`deep` 3) is wired but not shot by the prologue (chapter 1's). Three lenses at once (`flow/together`)
need three windows of one world — not built. A «де ми» HUD ladder is a platform element (request filed).

## The dive as a position (round 4, DECISIONS §60 p) — `dive.ts`

`world.scrub(t)` / `world.travelTo(t, seconds?)` / `world.takeLens()` / `world.release()` / `world.position` /
`world.goal`, `t` −½…3 (−½ = `−LENS_LEG` the stand plan with the lens in its holder · 0 the lens over the wire ·
1 «жила» · 2 «ряди» · 3 «один атом»). While the rail is engaged the frame — camera (stops' shots interpolated:
direction slerped, distance log-lerped), the lens, `deep`, every dissolve — is a function of `t`.

- The lens leg −½…0 (round 5, owner 2026-11-17: the slider's first move jumped): the lens rises first, lands on the
  wire at 85 % of the leg; the camera follows from 10 % and arrives with the pace the push-in starts with; the ring
  leg 0…1 eases in (slope 0.22) so the joint at 0 keeps its pace (`__tests__/dive.test.ts`). `takeLens()` glides the
  rail to 0 (from the stand: through the lens leg). A slider that starts with the lens on the wire (`wire/atoms`)
  simply uses 0…3 — nothing changed there. Before the rail engages, `position` is what the state shows
  (`deep`, `lens`); engaging never cuts: an orbit, the idle drift or a camera move still under way is carried as an
  offset that fades out in ≈ 0.5 s.
- `travelTo(t, seconds)`: a timed, eased glide (a rewind, e.g. «Назад» from `prologue/dive` to `click`);
  `release()`: the rail lets go where it is (the step's own motion takes the camera from there).
  A depth slider: `onChange: travelTo`, `onInput: (v, how) => how === 'drag' && scrub(v)`, and patch `current` with
  `world.position` (UI_API §3.3). Step flights (`fly`, `flyIn`, a change of `deep` between steps) ride the same rail:
  lens leg → travel → (if the step's camera is not the stop's shot) one camera move. A step entry releases the rail.
