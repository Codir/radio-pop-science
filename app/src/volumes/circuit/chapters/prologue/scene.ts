/**
 * The prologue's scene: the composed world (`@circuit/shared/world`) in four steps — click, dive, riddle, map; the
 * unfolding of the flashlight into the stand is the transition from `click` to `dive` (DECISIONS §60 p).
 * Step logic lives in `steps/*.ts`; this file wires the world, the step states, the goals and the hooks.
 */
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { floorLadder } from '@/hud-dom/journey';
import { AWAY_POST, mountWorld } from '@circuit/shared/world';
import content from './content';
import { PROLOGUE_SHOTS } from './shots';
import { diveStep } from './steps/dive';
import { mapStep } from './steps/map';
import { partNames } from './steps/parts';
import { riddleStep } from './steps/riddle';
import { switchControl } from './steps/switch';
import { createUnfolding } from './steps/unfold';

export default defineScene((ctx) => {
  const world = mountWorld(ctx);
  ctx.camera.shots(PROLOGUE_SHOTS);
  const labels = (id: string): readonly string[] => content.steps.find((s) => s.id === id)?.labels ?? [];
  const ui = stepUi(ctx);
  const toggle = switchControl(ctx, world, labels('click')[0] ?? '', ['click'], ['dive']);
  const unfolding = createUnfolding(ctx, world);
  // captions 5–8 of `dive`: the parts' names as they land
  const [, , , , , battery = '', lamp = '', switchName = '', wire = ''] = labels('dive');
  const names = partNames(ctx, world, unfolding, { battery, lamp, switch: switchName, wire });
  // the unfolding plays with nothing to read or to use: text and controls of `dive` come together when it ends
  const held = (): boolean => unfolding.playing;
  const riddle = riddleStep(ctx, world, ui, labels('riddle'));
  const dive = diveStep(ctx, world, ui, labels('dive'), names, held, riddle.lensName);
  const map = mapStep(ctx);
  // «де ми» (VISUAL §3): the platform's floor ladder, shown during a dive and on the lower floors
  // behind the map board the stand is out of focus: its small print («1,5 V») would read as unreadable text there
  const print = world.stand.group.getObjectByName('battery:print');
  const ladder = floorLadder(ctx, { floor: () => (world.deep > 0.01 ? world.floorId : null) });

  world.define({
    // the flashlight lies on the board in the dark: no moon, the lamp is the only light once clicked
    click: { camera: 'flashlight', params: { unfold: 0, moon: 0, closed: 0 } },
    // «Далі» from `click` with the lamp off: the switch clicks on first (the step's `closed`), then it unfolds
    dive: { camera: 'stand', params: { closed: 1, lensCall: 1 } },
    // the lamp is off on entry: the reader switches it on; the lens is a window onto «ряди»
    // the crawl (DECISIONS §60 t): the scene switches the lamp by the time and takes the lens from over the wire
    // to the wire's start by itself; the step starts dark (time 0) — arriving from a lit `dive` it dims calmly
    riddle: { camera: 'crawl', params: { closed: 0, lens: 1 } },
    // the map on the board is the hero: the stand stays behind it, lamp in its state, but calm — the room's
    // cold light low, strongly out of focus (the focus is in front of it, `AWAY_FOCUS`), the corners darker
    map: {
      camera: 'map',
      params: { closed: 1, moon: 0.3 },
      post: AWAY_POST,
    },
  });
  ui.define({
    click: {
      reset: true,
      callouts: [
        {
          anchor: world.stand.stand.slider,
          text: labels('click')[0] ?? '',
          visible: () => ctx.stage.current === 'click',
        },
      ],
      goal: () => toggle.lightings >= 2 && world.stand.glow > 0.5,
      // the navigator waits for the first light (UI_API §3.4): the step's only way on is the switch
      nav: { hiddenUntil: () => toggle.lightings >= 1 || world.stand.glow > 0.5 },
    },
    // the script: no text to read mid-motion — the step's text appears with the last beat of the unfolding
    dive: { ...dive.spec, panel: { hiddenUntil: () => !held() } },
    riddle: riddle.spec,
    map: map.spec,
  });
  ctx.qa.expose('prologue', () => ({
    deep: world.deep,
    floor: world.floorId,
    flying: world.flying,
    glow: world.stand.glow,
    light: world.stand.light.lamp.intensity,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    lightings: toggle.lightings,
    unfold: { value: unfolding.value, playing: unfolding.playing },
    dive: dive.state(),
    names: names.up(),
    riddle: riddle.state(),
    map: map.state(),
  }));
  return {
    enterStep(id, info) {
      world.enterStep(id, info);
      if (id === 'click') toggle.reset();
      if (id === 'dive') {
        // from `click` by «Далі»: the unfolding plays as the transition; any other way in shows the stand
        if (!info.instant && info.from === 'click') unfolding.play('stand');
        else unfolding.finish();
      }
      if (id === 'click' && !info.instant && info.from === 'dive') {
        // «Назад»: the same motion backwards, the lamp on until the flashlight has closed, then the dark of `click`
        ctx.stage.setParam('closed', 1, { instant: true });
        ctx.stage.setParam('moon', 1, { instant: true });
        unfolding.reverse('flashlight', () => ctx.stage.setParam('closed', 0, { instant: true }));
      }
      if (id === 'dive') dive.enter();
      // the crawl arrives with `riddle` and leaves with every other step, as one motion (shared/stage README «Crawl»)
      if (id === 'riddle') riddle.enter(info);
      else world.stand.crawlScene.hide(info.instant);
    },
    update(dt, t) {
      world.update(dt, t);
      toggle.update();
      unfolding.update(dt);
      dive.update(dt);
      riddle.update(dt);
      ladder.update();
      // the stand hides the print on phones (under 14 px there); no step of the prologue needs the number, so
      // nothing replaces it in the interface. Keep that rule, and hide it behind the map board too
      if (print) print.visible = ctx.device.formFactor !== 'phone' && ctx.stage.current !== 'map';
    },
  };
});
