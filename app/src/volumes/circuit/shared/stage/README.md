# `shared/stage` — the table floor of the volume `circuit`

The demonstration stand in a dark room, the flashlight that unfolds into it, the lamp as the real key light,
and the tools that live on the stand (`docs/volumes/circuit/VISUAL.md` §2, §3, §5.1, §5.6, §5.7). A library:
models, materials, light and motion with **states and parameters, no step logic**. Showcase:
`app/src/volumes/_dev/chapters/_sandbox-circuit-stage` (23 steps, one per state or beat); the crawl: `_sandbox-circuit-crawl`.

## Mount

```ts
import { STAGE_SHOTS, mountStage } from '@circuit/shared/stage';

export default defineScene((ctx) => {
  const stand = mountStage(ctx); // adds everything to ctx.root, sets the room's environment
  ctx.camera.shots(STAGE_SHOTS); // stand · flashlight · lamp · lens · handover
  ctx.stage.param('closed', 0, { duration: 0.01, onChange: (v) => (stand.closed = v) });
  ctx.stage.define({ intro: { params: { closed: 1 }, camera: 'stand' } });
  return {
    enterStep: (_id, info) => info.instant && stand.snap(), // deep link: no heating ramp
    update: (dt, t) => stand.update(dt, t), // every frame
  };
});
```

The manifest must use `theme: { sky: 'studio', mood: 'studio' }` (the room is built on the `studio` backdrop
with everything of it switched off). Do not call `ctx.env.tune()` yourself: the light rig owns it.
A chapter of `circuit` needs `shared` in the lint rule's `SHARED_IN_VOLUME` (`docs/requests/W1-circuit-stage.md` §2).

## Parameters (`CircuitStage`) — plain numbers, set them from `stage.param(..., { onChange })`

| Field                | Range | Meaning                                                                                                                                                                                                         |
| -------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `closed`             | 0 / 1 | the switch: 0 open (the air gap shows, cold light), 1 closed. The slider and the filament follow with their own short inertia; the whole frame changes, not a halo                                              |
| `charge`             | 1 … 0 | the battery's life as the outside shows it: the lamp's glow (`glowOfCharge`), the pool on the board, the amber band paling to grey in the last third                                                            |
| `moon`               | 0 … 1 | the cold key light from the upper left. 0 in `prologue/click` (the lamp is the only light)                                                                                                                      |
| `unfold`             | 0 … 1 | 0 = the flashlight lying on the board, 1 = the stand. One pure function of the number: drag it, stop it, play it backwards. `unfold × UNFOLD_SECONDS` (6 s) is the time on the six-beat timeline `BEATS`        |
| `lens`               | 0 … 1 | the magnifier: 0 in its holder, 1 in use over the near wire (`LENS.wireSpot`)                                                                                                                                   |
| `dive`               | 0 … 1 | progress of the flight through the ring: the rim's arcs appear in the frame's corners (from 0.5), the sheath of the wire under the lens dissolves (0.7 … 1). Move the camera with the shots `lens` → `handover` |
| `lensCall`           | 0 … 1 | the step asks the reader to take the magnifier: the resting ring turns full cyan and pulses. Default 0 — at rest the ring is quiet (thin, greyed) so that the lamp stays the hero                               |
| `poles`              | 0 … 1 | how much the wires tell plus from minus: 0 (default) both sheaths nearly one neutral tint — the prologue and chapters 1–2 know no poles; 1 = coral from the plus, blue from the minus (from `battery/poles` on) |
| `setGlow(v \| null)` | 0 … 1 | take the filament's glow by hand (`lamp/glow` scrubs the incandescence scale); `null` gives it back                                                                                                             |
| `glow` (read)        | 0 … 1 | what the filament shows now. Pass it down to the lower floors: warm light when > 0                                                                                                                              |

Tools (`stand.tools`): `gauge.shown` 0…1 and `gauge.value` (volts, needle + number), `frame.shown`,
`frame.setOnLoop(s)` / `frame.setAt(point, tangent)`, `frame.setNumber('12')`, `lens.setPose(from, to, k)`
for other places (`LensPose` in the board frame; `poses.holder`, `poses.overWire` exist). Probes, hotspots:
`stand.stand.anchors.{battery,switch,lamp,plus,minus}`, `stand.stand.wires.core('p1')`, `tools.lens.glass`.

### Options and entry states

- `mountStage(ctx, { globe })` — radius of the lamp's glass globe (default 0.66 = 16 % of the frame height in
  the main shot; 0.52 is the smallest that still reads at 1280×720, about 13 %). The flashlight's head is built
  around the globe, so the lamp never changes size in the unfolding. Side by side: `qa/W1-circuit-stage/lamp-scale.jpg`.
- **The glass and depth of field.** Transparent glass writes no depth, so the post pipeline's depth of field
  blurred the globe by whatever lay behind it (smeared rim over the far room, sharp over the table). The bulb
  carries an invisible depth-only copy of its glass (`bulb:glass-depth`, drawn last, 1.2 % larger): the globe is
  focused like the solid lamp. Any other large glass that must read crisp needs the same (`depthShell` in
  `bulb.ts`). Steps `lamp-off`, `lamp-top`, `lamp-top-off` of the showcase show the glass on dark and light ground.
- **Lamp on or off at step entry** is just `closed` in the step's params plus `stand.snap()` on an instant entry
  (deep link): `prologue/open`, `prologue/dive` enter with `closed: 1`; `prologue/riddle`, `wire/restless` with 0.
- **The slider in the dark**: the thumb has its own faint yellow glow that fades as the room gets light — it is
  visible in the black frame of `prologue/click` without any light. Nothing to set.
- **At the click the light is there at once**: the pool, the bounce and the room switch in the same frame; only
  the coil's colour takes about 0.1 s to run up its scale. Switching off, both cool together.
- **The dive's look** (`stand.dive`): from 0.45 the sheath under the lens dissolves (eased) and the bare core
  becomes one even copper that does not depend on the lamp or the environment — see requests §5.
- `stand.stand.battery.printShown` / `.printAnchor`: «1,5 V» is not printed on phones (it would be under
  14 px); label it in the interface at the anchor.
- **`ambient`** 0 … 1 (default 0.5): lifts only the UNLIT room — the flashlight before the click, the open
  circuit, the dead battery — and steps back as the lamp's output rises (0 = the first, darker look). Mean
  luminance of the frame at 1280×720, ambient 0 → 0.5: flashlight off 15.9 → 24.9, circuit open 36.2 → 39.9,
  dead battery 35.9 → 39.6; lamp on unchanged (52.3).
- **`stand.playUnfold(seconds = 7, to = 1)`** plays the unfolding by itself from wherever `unfold` is (`to = 0`
  folds it back for the practicum) and returns `{ progress, done }`; a hand on `unfold` takes over. Recommended
  timeline `UNFOLD_PLAY`: 7 s for the whole way at constant speed (each beat eases itself; first and last frame
  have zero velocity), camera on `flashlight` through beats 1–2, one `cinematic` move to `stand` starting at
  progress 0.25 and lasting 3.6 s. Showcase step `play`; strip `qa/W1-circuit-stage/play-strip.jpg`.
- The light rig re-applies itself when a step entry resets the environment, and the lens glides between its poses
  (holder, over the wire, on the wire's start) — neither jumps at a step change any more.
- `STAGE_POST.stand` (installed as the chapter's post base) and `STAGE_POST.lamp` (use as the `post` of a lamp
  close-up step): depth of field for the two kinds of shot.

## Crawl — the snail along the wire under one slider of time (`prologue/riddle`, later `flow/snail`)

DECISIONS §60 r–t. One entry, `stand.crawlScene` (`crawl-scene.ts`); nothing of it shows until `show()`.

```ts
const crawl = stand.crawlScene;
// step entry (after world.enterStep): the scene arrives / leaves as ONE motion — never set its parts yourself
if (id === 'riddle') {
  crawl.time = 0;
  crawl.show(info.instant);
} else crawl.hide(info.instant);
// the builder's slider «Час»: min 0, max crawl.duration (136.4 s), true time; every frame (UI_API §3.3):
crawl.time = shownSeconds; // the ONLY input: lamp, switch, snail, lens picture, scale, marked spark follow
```

| Member                              | Meaning                                                                                                                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time`                              | seconds of true time, clamped to 0 … `duration`. Every frame is a function of it, both ways                                                                                                                                                          |
| `duration` · `lengthCm` · `scaleMm` | 136.4 s · 13.64 cm (the snail's lane) · 6 mm (0.044 mm/s × duration; the lane's start is placed so that it is whole millimetres)                                                                                                                     |
| `show(instant?)` / `hide(instant?)` | arrival 2.0 s, leaving 1.5 s (`CRAWL_SECONDS`); `instant` for deep links. Leaving keeps `time`: the snail goes from where it is                                                                                                                      |
| `shown` · `presence` · `ready`      | asked for · 0 … 1 · in place (show captions and enable the slider when `ready`)                                                                                                                                                                      |
| `snailCm` · `sparkMm`               | where the two are now (for a readout or a goal: `time >= duration`)                                                                                                                                                                                  |
| `anchors`                           | `Object3D`s for captions: `snail` (above the shell), `lens` (centre), `lensTop/Bottom/Left/Right` (just outside the ring, as seen), `mark` (the marked spark's place on the scale), `scaleEnd` (the last tick). The lamp: `stand.stand.anchors.lamp` |

- **Lamp and switch.** While the scene is `shown` they follow the time: off at 0, on in the very frame the time
  is above 0 (the slider's thumb on the stand moves too), off again at 0. The step's own `closed` is ignored
  meanwhile and takes over at `hide()` — so give the next step (`map`: `closed: 1`) its value as usual.
- **Magnifier.** The scene takes it by itself from wherever it is — the holder (`lens: 0`) or over the wire
  (`lens: 1`) — to the start of the run (`tools.poses.overStart`, 1.9×, its right rim at the clamp's screw) and
  gives it back at `hide()`. Leave `world.lensPose` null and `window: 0` on that step. Inside it is a plain
  magnifier ≈ 3.5× of the wire's first centimetre: the scale 0 … 6 мм, cyan sparks darting (live, also at time 0),
  the marked one (white, in a ring) about a point that advances to the last tick; a caret on the scale is that
  point. Stated simplification: sparks drawn huge and few, darting made visible; lengths on the scale are true.
- **Snail.** On its own lane 0.56 inside the loop (`tools/crawl-lane.ts`), from behind the minus clamp up the
  left side, round one corner, along the far side to the lamp's terminal — the electrons' way — at 1 mm/s; pale
  trail, a tick per centimetre, «5 см», «10 см». It creeps (wave, feelers) only while it moves; on the crawl its
  shell is fuller and leans to one side, so it reads from behind as well.
- **The motion in** (`CRAWL_BEATS`, shares of the 2.0 s): lens 0 – 0.62 · its picture opens 0.5 – 0.9 · ticks as
  a wave along the lane 0.12 – 0.7 · the snail creeps to its start 0.3 – 1 · numbers and trail 0.6 – 1. Out: the
  same backwards in 1.5 s. Move the camera with the step (`dive` ends on `stand`; `map` has its own shot).
- **Shots.** `STAGE_SHOTS.crawl` for 16:9 (whole run, lamp, lens with its handle inside the frame, clear of the
  right panel) — its `fit` is the phone-portrait framing: the whole stand with the lens above a half-height
  sheet (checked at 390×844 with the DOM touch sheet). On phones the printed numbers are left out (< 14 px).
- Frames: `/srv/electricity/qa/W1-circuit-stage/crawl/v3/sheet.jpg` (key frames, phone, lens, arrival, leaving,
  snail). Showcase: `_dev/_sandbox-circuit-crawl` (`stand` → `crawl` is exactly the code above).
- **Time 0 is a dark frame**, so the scene keeps it readable: the ring is calm while the crawl has the lens
  (`CRAWL_RING` 0.22 of full cyan, no call — nobody takes the lens there) and the unlit room is lifted by
  `CRAWL_AMBIENT` on top of `ambient`; the lamp's glass, the snail at its start and the lens picture all read.
- **The handle** stays of ordinary size under the 1.9× ring (`LensPose.grip = 1 / scale`), so the whole tool is
  inside the frame at 16:9 with any panel height and above the phone sheet.
- Gone with the rebuild of `riddle` (2026-11-16): the race track, the spark's pin, the front ruler, variant A
  of the preview. `stand.snail`, `.ruler`, `.spark`, `.race` remain as inert deprecated numbers only until
  `shared/world/params.ts` drops its params of those names (requests §7).

## The frame of reference

`layout.ts` holds every permanent place in the **board frame** (origin = centre of the face, +x right, +y out
of the face, +z toward the reader; the face leans 15°). `stand.base.frame` is that frame as a `Group` — add
props for the stand there. `boardToWorld()` / `worldToBoard()` convert. 1 unit ≈ 26 mm (battery = 1.9 units).

Measured on the main shot at 1920×1080 (same ratios at 1280×720 and 3840×2160): board 62.4 % of the frame
width and 57.6 % of its height; loop 856 × 442 px (height / width 0.52); battery 18.9 % of the width; lamp
glass 16.5 % of the height; wire 22 px (core 12 px); switch 8.2 % of the width, its gap 36 px.

## The unfolding (`unfold.ts`) — VISUAL §5.1

`0–0.8 s` the housing splits, the halves slide apart · `0.8–1.6` halves, mirror, glass go to the shelf, parts
hover · `1.6–2.6` mounts grow left → right every 70 ms · `2.6–3.8` battery, spring, lamp (one screwing turn),
slider take their places, the strips follow · `3.8–5.0` strips round into wires, sheath grows from the clamps,
wires lie down on the staples · `5.0–6.0` magnifier into its holder (`unfolding.beat6`).
The lamp's light is a `PointLight` parented to the filament, so light and shadows travel with the lamp; no
contact opens (every strip end is computed from the part it touches). The camera is yours: `flashlight` for
beats 1–2, `stand` from beat 3 is what the showcase uses.

## The dive and the hand-over pose («жила дроту»)

`HANDOVER` in `shots.ts` (agreed with W2 in `docs/requests/W1-circuit-stage.md` §1): the camera looks **across**
the near wire between the plus clamp and the switch; the wire's axis is horizontal through the centre of the
frame; the copper core's silhouette lies on the upper and lower edges of the 3 : 2 safe frame (distance to the
axis = 4.17 core radii = 0.150, `Shot.fov` 27°); view direction `(0, −0.660, −0.751)` (world), up = world +y.
Left in the frame is the battery's plus, right the switch and the lamp: the electrons' common shift runs right
→ left. The whole flight happens in the stand's real geometry (the camera approaches the real wire through the
real ring), so no portal is needed up to that frame; exchange the worlds there with a dissolve.
`tools.lens.rim` (overlay layer) stays on the lower floors as the thin cyan arcs — keep `dive = 1`.

Not built: a view of the lower floor **inside** the resting lens (`flow/*`: "the lens is a window, not a
flight"). `tools.lens.glass` is the disc to put it on (render target or stencil — an engine question).

## Light and materials (what to know before adding a prop)

- `light.ts`: lamp `PointLight` 7.5 × glow^1.9, plus a shadowless bounce light above the pool (`light.bounce`), decay 1.55, cube shadow map 1024, radius 36; the moon is the
  environment's key light (halves when the lamp works). Filament colour = `filamentColor(glow)`.
- `materials.ts`: `surface()` (board, table: K.toon + warm scatter + a pool gathered into three soft steps),
  `sheath()` (translucent plastic that is LIT — `K.glass` is unlit and would shine in the dark),
  `tame()` (caps each light at 1.1 for toon materials, so things next to the lamp are not over-exposed).
  Call `tameAll(group)` after adding your own lit props. Unlit things (`Text3D`, `K.glow`, `K.glass`) must
  follow the room's light by hand, as `battery.light`, `gauge.light`, `frame.light` do.
- Nothing runs along the wires on this floor, by design.

## Performance (RTX 5060, `high`, chapter-check)

1920×1080: frame 3.0–4.7 ms (budget 8), 171–317 draw calls (budget 350), ≤ 281k triangles; 3840×2160:
7.4–12.3 ms (warning above 14); no leaks.
The cube shadow map is the main cost of draw calls: every new shadow-casting mesh on the stand adds up to
six. Merge static props (`Builder`) and set `castShadow = false` on small things.

## Not here yet (for the chapter builders)

- `flow/loop`: the slider moving to the second seat (the seat and its jumper are modelled; no motion).
- `resistance/shape`: the far wire as a snake — `wires.setShape('m2', { path, round: 1, cover: 1, copper: 1 })`
  takes any path, but the radius is fixed (thinning is not parameterised).
- `build/*`: disconnected wires with cyan handles; the reverse unfolding itself works (`unfold` 1 → 0).
- `drain/life`: the dead battery leaving for the shelf and a new one arriving (one `BatteryModel` exists).
- Cutaways of the battery and the lamp (§5.2, §5.3 close-ups) are other floors.
