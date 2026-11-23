/**
 * `prologue/stand` — «Без однієї деталі». The amplifier plays (the switch closed, the knob at 0,5, the player at
 * 0,3 V, the LED «on» lit); the model starts from its operating point with the step's board. The hand takes any part
 * of the amplifier whole but the output pair's bias diodes D2 and D3 (without either the model burns Q2) and no
 * jumper; while it is in the hand it is out of the circuit, and the model plays the board without it. It comes down
 * only into its own sockets (`place`): let go over the board it goes back there (the hand's own way back), let go off
 * the board the bench takes it off (no tray here) and the step puts it straight back on its sockets, its knob's
 * setting too. The shot `board` (a phone: `phone`); the dock: «Хвиля на динаміку» and the line about the sound.
 * Goal (`parts/goals.ts` `createVisits`): two parts out and back, the board the entry's again for 1 s after each —
 * the LED «on» out for 1,5 s, and a part without which the speaker fell silent (its crest under 5 mV for 1 s in a row
 * while it was out: P1, C1, R2, R3, Q1, R5, C2 in the model). After a first visit the step calls the half of the goal
 * not there yet: the LED, then the volume knob P1 (a `cyan` pulse).
 */
import { put, setSetting, type SocketId } from '@electronics/sim/board';
import type { StepFactory } from '../chapter';
import { caption } from '../content';
import { AMP, HOLD, IDS, KNOB, TAKE, WINDOWS } from '../parts/boards';
import { soundNote, waveGauge } from '../parts/dock';
import { createVisits } from '../parts/goals';
import { handPolicy } from '../parts/policy';

const S = 'stand';
const SPEC = new Map(AMP.parts.map((p) => [p.id, p.spec]));

export const standStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { bench } = stand;
  const word = (i: number): string => caption(S, i);
  const visits = createVisits({
    led: IDS.led,
    ledSeconds: HOLD.led,
    silent: WINDOWS.silent,
    silentSeconds: HOLD.silent,
    back: HOLD.back,
  });
  /** Where every part stood on entry: its own sockets. */
  const home = new Map<string, readonly (SocketId | null)[]>();
  let entryKey: string | null = null;
  let backs = 0;
  /** The part of the amplifier out of the circuit now (in the hand, or a leg in the air), or null. */
  const outNow = (): string | null =>
    TAKE.find((id) => {
      const p = bench.state.parts.get(id);
      return p === undefined || p.legs.some((l) => l === null);
    }) ?? null;
  /** A part let go off the board: the bench took it off; it goes straight back on its own sockets. */
  const putBack = (id: string): void => {
    const legs = home.get(id);
    const spec = SPEC.get(id);
    if (!legs || !spec || bench.state.parts.has(id)) return;
    if (put(bench.layout, bench.state, { id, spec, legs })) backs++;
    if (id === IDS.pot) setSetting(bench.state, IDS.pot, KNOB.middle);
  };
  ctx.qa.expose(S, () => ({
    out: outNow(),
    whole: entryKey !== null && bench.model.net?.key === entryKey,
    crest: stand.crest(),
    led: visits.led,
    mute: visits.mute,
    counted: visits.counted.map((v) => ({ ...v })),
    open: visits.open,
    call: stand.call.id,
    backs,
    soundOff: stand.soundOff(),
    reached: reached(S),
  }));

  return {
    spec: { camera: 'board', params: { meter: 0, scope: 0 } },
    ui: {
      reset: true,
      controls: [waveGauge(word(2), () => stand.crest()), soundNote(word(3), () => stand.soundOff())],
      goal: () => reached(S),
    },
    enter() {
      visits.reset();
      entryKey = null;
      backs = 0;
      stand.board(AMP.parts, AMP.leads);
      setSetting(bench.state, IDS.pot, KNOB.middle);
      bench.closed = 1;
      stand.play(true);
      bench.tray.set([]);
      bench.multimeter.put({ red: null, black: null });
      bench.oscilloscope.put({ ch1: null, ch2: null });
      home.clear();
      for (const p of bench.state.parts.values()) home.set(p.id, [...p.legs]);
      bench.hands.policy = handPolicy(bench, {
        part: (_spec, id) => TAKE.includes(id),
        place: (id, legs) => {
          const own = home.get(id);
          return own !== undefined && own.length === legs.length && own.every((s, k) => s === legs[k]);
        },
        done: (k, where) => {
          if (where === 'tray' && k.startsWith('part:')) putBack(k.slice('part:'.length));
        },
        name: (w) => (w.id === IDS.led ? word(1) : w.id !== undefined && TAKE.includes(w.id) ? word(0) : ''),
      });
      stand.naming = { player: '', speaker: '', scope: '', tap: false };
    },
    late(dt, t) {
      if (!here(S)) return;
      if (entryKey === null && bench.model.net !== null) entryKey = bench.model.net.key;
      const out = outNow();
      visits.feed({ out, whole: entryKey !== null && bench.model.net?.key === entryKey, crest: stand.crest() }, dt);
      // after a first visit: the half of the goal not there yet pulses, while it stands on the board and nothing is held
      const want = visits.call(IDS.pot);
      stand.call.to(want !== null && out === null && bench.hands.held === null ? want : null, t);
      if (visits.done && !reached(S)) reach(S);
    },
  };
};
