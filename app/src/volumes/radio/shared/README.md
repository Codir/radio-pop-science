# `shared` — the world of the volume «Радіо»

The scene's side of the volume: the yard with the camera on the pole and the monitor in the house, the camera's eye,
the line to the signal model (`sim/core`) and the monitor's screen. No step logic lives here. Chapters and the
sandboxes of the volume `_dev` take the world from `@radio/shared/**`; the sandboxes may not import `@radio/sim/**`
(the plan's correction П7) — that is why `world/index.ts` passes on `DEFAULT_STATE`, the model's types
(`FmLinkState`, `Meters`, `ProbeRequest`, `ProbeData`, `TapId`, `ProbeView`, `ChannelNo`), `YARD_SHOTS`, `screenShot`
and `RouteStop`.

## Mount

```ts
export default defineScene((ctx) => {
  const world = mountWorld(ctx, { dusk: 0.15 }); // the yard, the eye, the line, the screen; one call per mount
  ctx.stage.define({
    look: {
      camera: 'yard',
      enter() {
        world.resetLine(); // every step starts from DEFAULT_STATE ...
        world.line.air.route = 2; // ... and sets its own state
        world.yard.wicket = 0;
      },
    },
  });
  return {
    update: (dt, t) => world.update(dt, t), // runs the yard (cat, swing, lights) and the model
  };
});
```

`WorldOptions`: `link` — `'auto'` (default: the model in a background thread when there is one, otherwise on the
main thread), `'sync'` (always on the main thread), `'off'` (no model: `world.link` is `null` and the screen stays
dark glass); `seed` — the model's seed, default 1; `dusk` — the yard's dusk at mounting. On a held page (`?freeze`,
П11) the line is always `'sync'`: a held frame needs no thread.

Each mount builds its own world (П12: two copies of a chapter can live side by side at a chapter boundary), and one
`ctx.onDispose` releases the link (with its thread), the eye and the screen.

## `world.line` — the knobs a chapter sets

`world.line` is an `FmLinkState`; steps write into its fields, the model reads the whole state on every frame of the
model. `world.resetLine()` copies `DEFAULT_STATE` into the same three objects (`air`, `camera`, `monitor`), so a
reference a step keeps stays valid.

| Field | Range | Default | What it is |
|---|---|---|---|
| `air.route` | 0…4 | 1 | where the monitor stands: 0 the yard (20 m from the camera) · 1 the kitchen · 2 the hallway · 3 the far room · 4 the cellar; straight lines between the stops |
| `air.nudge` | −0.15…0.15 m | 0 | «move the antenna» along `SITE.nudgeAxis` |
| `air.gate` | 0…1 | 0 | the leaf of the garage gate: 0 shut … 1 open (the reflected ray from 0.3 on) |
| `air.tray` | 0…1 | 0 | the baking tray: 0 on the kitchen worktop … 1 right at the monitor's antenna |
| `air.txPowerMw` | 0.1…10 | 10 | the camera's power, mW |
| `air.txChannel` | 1…4 | 3 | the camera's channel |
| `air.router`, `air.oven` | on/off | off | the neighbour's router, the microwave oven |
| `camera.sync` | on/off | on | the camera's block of sync pulses |
| `monitor.on` | on/off | on | the monitor; off — the screen goes dark |
| `monitor.rxChannel` | 1…4 or `null` | `null` | the monitor's channel; `null` — the same as the camera's |
| `monitor.lineLength` | samples per line | 288 | the monitor's own line rhythm; 288 is right, and at the default trust the sync pulses pull it in while \|lineLength − 288\| < 4 (B9c) |
| `monitor.syncTrust` | 0…1 | 0.25 | how much the rhythm listens to the sync pulses |
| `monitor.detector` | `'slope'` · `'angle'` | `'slope'` | the detector |
| `monitor.limiter` | on/off | on | the limiter |

Next to it: `world.probe` (`ProbeRequest` or `null`) — what the probe asks of the model with every frame; read
back are `world.meters` and `world.probeData` (of the frame on the screen; the link's own copies, replaced by the
next frame, never overwritten) and `world.luma` (the camera's frame the model was fed, 128 × 96, row 0 at the top).

## `world.yard` — the yard (`yard/`)

| Member | Who writes it | What it is |
|---|---|---|
| `dusk` | the chapter | 0 early evening … 1 night (`VISUAL.md` §5 gives each chapter's dusk) |
| `wicket` | the chapter | the wicket in the camera's view: −1…1, 0 shut |
| `catAt` | the chapter | 0…1 along the cross fence, default 0.5 (batch 3, C3a) |
| `garageGate`, `tray` | **the world**, from `line.air.gate` and `line.air.tray` | do not set them: the next update overwrites them |
| `monitorAt(route, nudge)` | **the world**, from `line.air.route` and `line.air.nudge` | do not call it |
| `screenLight` | **the world** | the screen's light on the kitchen: `screen.power` × the mean of the frame on the screen / 255 |
| `update(dt, t)` | **the world** | the cat, the swing, the trees, the lights; chapters do not call it |
| `hidden` | whoever adds a thing to the scene | what the camera in the yard must not see (see the rules) |
| `anchors` | — | `lens`, `cameraAntenna`, `cable`, `monitor`, `monitorScreen`, `monitorAntenna`, `wicket`, `cat`, `garageGate` (and `shedWall`, `nook` from C3a) |
| `root` | — | the yard's group in `ctx.root` |

The eye's camera is a child of `anchors.lens` (it looks where the lens looks); the screen is a child of
`anchors.monitorScreen`.

## Rules

- **The world owns the environment and the post-processing** (`yard/look.ts`): chapters do not call
  `ctx.env.tune`, `ctx.env.setScale` or `ctx.post.base`, and steps get no `envTune` or `post`. The dusk is a knob of
  the yard, not a grade of the frame; the engine's film grain stays off (П2): the only grain on screen is the model's.
- **Everything the camera in the yard must not see goes into `yard.hidden`**: stands, the probe, the map, the copy
  of the screen, labels. The eye hides them for its own pass. They also **cast no shadow**: on a live frame the eye
  reuses the shadow map of the main render (B1a), so a hidden stand would leave its shadow on the monitor without
  the stand. `world.update` therefore turns `castShadow` off on everything under `yard.hidden` on every update; a
  part added to a hidden group later loses it on the next update.
- **The screen changes only through the knobs of the line.** Nothing but the world calls `world.screen.show`, and no
  shader or texture draws snow, tearing or ghosts (the plan's global constraints): whatever the monitor shows, the
  model computed from what the eye saw. `screen.power` follows `line.monitor.on` (λ 8/s; at once on a held frame)
  and stays 0 with `link: 'off'`.
- **On a held page** the model computes one `still` frame on a held frame (dt 0) and only when something changed: an
  update with dt > 0 since the last held frame, or `line`, `probe`, `yard.dusk` or `yard.wicket`. Any other change of
  the scene (a moved cat, a prop) reaches the screen after `__app.step`.
- **The monitor's route is straight between the stops** (`routePoint`): exact on the five stops, on a straight line
  between them, so between stops it passes through walls. Chapters put it on a stop, or move it under a camera cut,
  as their texts decide.
- **The tray rests on the kitchen worktop** (`places.trayRest` is fixed there). From `tray` 0.7 on it stands across
  the line by the monitor's antenna wherever the monitor is, but below 0.7 it travels on an arc from the worktop, so
  that arc only makes sense with the monitor in the kitchen (route 1); at the other stops it flies through walls.
- A state the model refuses (`createFmLink` throws on a damaged state) is an error, not a held frame: on a live page
  the link keeps the last good frame and logs once; on a held page `still` throws once and is not retried until
  something changes again (as in the rule above).

## For checks: `__app.read('radio-world')`

`{ mode, frames, fps, modelMs, meters, screenHash, screenMean, screenNoise, eye }` — `mode`: `'worker'`, `'sync'` or
`'off'`; `frames`: screens shown, live and held; `fps`: the link's frames of the model per second of engine time;
`modelMs`: `ms` of the frame on the screen; `meters`: its meters; `screenHash`: FNV-1a (32 bits, `fnv1a`) of the
12 288 cells on the screen; `screenMean`; `screenNoise`: the mean |difference| of neighbouring cells within a row;
`eye`: `{ format, passes, lastMs, lastCalls }`. The hash and the means are computed when read, not every frame.

## Parts

| Part | What it is | Batch (task) |
|---|---|---|
| `link/` | the scene's link to the model: `createLink` — a background thread, one request on its way, the main thread as the fallback | 2 (B11) |
| `screen/eye.ts` | the camera's eye: one extra renderer pass into 128 × 96 and its luma (decision 24) | 2 (B1a) |
| `screen/screen.ts` | the monitor's screen: a 128 × 96 texture only the model updates | 2 (B1a) |
| `models/` | the objects of the yard: camera, pole, monitor, wicket, shed, garage, cat, tray, … | 2 (B12) |
| `yard/` | `mountYard`: the objects placed by the model's numbers, the dusk and the lights, the shots | 2 (B13); the cat's walk and the anchors `shedWall`, `nook` — 3 (C3a) |
| `whereami/` | the miniature «where are we» and the route and nudge sliders | 2 (B15) |
| `world/` | `mountWorld`: the yard, the eye, the line and the screen behind one call | 2 (B14) |
| `probe/` | the probe and its strip | 3 (C2) |
| `stand/` | the camera's stand: blocks and the plate of cells | 3 (C3b) |
| `screen/runner.ts`, `screen/inset.ts` | the runner on the plate and its twin on the screen; the copy of the screen in an inset | 3 (C3b) |
| `map/` | the map of the road with its two lanes | 3 (C3c) |
| `screen/` | the «slow screen» of chapter `raster` | 7 |
