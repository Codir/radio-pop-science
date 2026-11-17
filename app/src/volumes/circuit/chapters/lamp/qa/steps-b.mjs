// Steps `hot-spot`, `glow`, `energy` of the interaction test (interactions.mjs passes its context).

export async function hotSpot({ page, p, check, takeaway, snap, read, at, advance }) {
  await advance(page, 0.5);
  const lens = await at(page, 'lens');
  const hold = await p.down(lens.x, lens.y);
  const battery = await at(page, 'wire-by-battery');
  await hold.move(battery.x, battery.y, 20);
  await advance(page, 0.8);
  const sw = await at(page, 'switch');
  await hold.move(sw.x + 40, sw.y, 16);
  const lamp = await at(page, 'wire-by-lamp');
  await hold.move(lamp.x, lamp.y, 24);
  await advance(page, 0.6);
  await snap('hot-spot-lamp');
  check('no takeaway before 2 s over the lamp', !(await takeaway()));
  await hold.up();
  await advance(page, 2.4);
  const s = await read(page, 'hot-spot');
  check('the lens visited the wire by the battery', s.nearBattery);
  check('takeaway after 2 s over the lamp', await takeaway(), s.overLamp.toFixed(2));
  check('heat view on', s.thermal > 0.99, s.thermal.toFixed(2));
  await snap('hot-spot-goal');
}

export async function glow({ page, p, check, takeaway, snap, smooth, sweep, read }) {
  const j = await sweep(p, 'heat', 0, 1.04, 50);
  smooth('slider up: camera still', j.camera, 0.05);
  let g = await read(page, 'glow');
  check('at the end the coil is yellow-white', g.heat > 0.95, g.heat.toFixed(3));
  await snap('glow-end');
  check('no takeaway before the way back', !(await takeaway()));
  await sweep(p, 'heat', 1, 0.2, 40);
  g = await read(page, 'glow');
  check('in the first third the coil is dark or dull red', g.heat < 0.12, g.heat.toFixed(3));
  check('takeaway after end → first third', await takeaway());
  await snap('glow-goal');
}

export async function energy({ page, p, check, takeaway, snap, read, at, advance }) {
  await advance(page, 1);
  const e0 = await read(page, 'energy');
  check('the section is open', e0.cut > 0.99, e0.cut.toFixed(2));
  const tap = async () => {
    const q = await at(page, 'switch');
    await p.tap(q.x, q.y);
  };
  await tap();
  await advance(page, 1.4);
  const on = await read(page, 'energy');
  check('closed: the reaction runs', on.activity > 0.05, on.activity.toFixed(3));
  await snap('energy-closed');
  await tap();
  await advance(page, 1.2);
  const off = await read(page, 'energy');
  check('open: the reaction stills', off.activity < 0.02, off.activity.toFixed(3));
  check('no takeaway after one round', !(await takeaway()));
  await tap();
  await advance(page, 0.6);
  await tap();
  await advance(page, 0.6);
  check('takeaway after two rounds', await takeaway());
  await snap('energy-goal');
}

export async function handover({ page, p, check, takeaway, snap, read, at, advance }) {
  await advance(page, 0.5);
  const q = await at(page, 'switch');
  await p.tap(q.x, q.y);
  const mid = await read(page, 'handover');
  check('the glow is on its way (0.7 s battery → lamp)', mid.front > 0.3 && mid.front < 1, mid.front.toFixed(2));
  check('no takeaway before 2 s', !(await takeaway()));
  await advance(page, 1.8);
  const h = await read(page, 'handover');
  check('the glow reached the lamp', h.front >= 1, h.front.toFixed(2));
  check('takeaway after 2 s watched', await takeaway());
  await snap('handover-goal');
}

export async function story({ page, p, check, takeaway, snap, smooth, sweep, read, advance }) {
  await advance(page, 0.5);
  let j = await sweep(p, 'time', 0, 1.04, 120);
  smooth('«Час» forward: camera', j.camera, 2);
  smooth('«Час» forward: lens', j.lens, 2);
  await advance(page, 0.3);
  let s = await read(page, 'story');
  // the camera settles on the stand plan (its follow is speed-capped); the hold counts from there
  for (let i = 0; i < 40 && s.held === 0; i++) {
    await advance(page, 0.25);
    s = await read(page, 'story');
  }
  check('at the end: 0,1 s, the coil yellow-white', s.x >= 0.999 && s.heat > 0.95, `${s.x} · ${s.heat.toFixed(3)}`);
  check('no takeaway before the hold', !(await takeaway()));
  await advance(page, 1.2);
  check('takeaway after 1 s at the end', await takeaway());
  const l = await read(page, 'lamp');
  check('the camera stands on the stand plan', Math.hypot(l.cameraRaw[0], l.cameraRaw[1] - 8.05, l.cameraRaw[2] - 8.6) < 0.6, l.camera.join(','));
  await snap('story-goal');
  j = await sweep(p, 'time', 1, 0, 120);
  smooth('«Час» backward: camera', j.camera, 2);
  j = await sweep(p, 'time', 0, 1.04, 60);
  smooth('«Час» in one second, forward: camera', j.camera, 4);
  await advance(page, 1.5);
}
