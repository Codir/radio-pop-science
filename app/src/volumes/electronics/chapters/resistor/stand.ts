/**
 * The chapter's facade over the bench of the volume (`@electronics/shared/**`): the bench mounted once, the magnifier's
 * door into a part (step `inside`), its lens keeper and the ladder «де ми», the names under the pointer of the things
 * a step keeps in place (`parts/names.ts`), and the dock's controls a phone needs instead of the tray and the
 * battery's switch (`parts/dock.ts`). Steps put their own boards (`board`: cleared, then `bench.preset`) and say what
 * the hand may take.
 */
import type { ChapterContext, StepInfo } from '@/engine/api';
import type { FloorLadder } from '@/hud-dom/journey';
import { mountBench, type Bench, type BenchShot, type PresetPart, type SocketId } from '@electronics/shared/bench';
import { benchLadder, lensKeeper, partDoor, type Door, type LensKeeper } from '@electronics/shared/dive';
import { partNames, type Names } from './parts/names';

/** What the names under the pointer say in the step on screen ('' — none). */
export interface Naming {
  part(id: string): string;
  meter: string;
}

const SILENT: Naming = { part: () => '', meter: '' };

export interface ResistorStand {
  readonly bench: Bench;
  /** The door of step `inside` while it is open or its rail still flies home; null otherwise. */
  readonly door: Door | null;
  readonly keeper: LensKeeper;
  readonly ladder: FloorLadder;
  /** The names of the step on screen (a step sets it on entry). */
  naming: Naming;
  /**
   * A step's own board: everything off first — the parts and the plugs of the bench's things (a plug a preset does
   * not name stays where it is, and `bench.preset` seats the parts before the plugs: after `amp` the speaker's plug in
   * c10 would stand where the LED's loop needs its cathode) — then these parts and plugs, new and whole.
   */
  board(parts: readonly PresetPart[], leads?: Readonly<Record<string, SocketId>>): void;
  /** The page is a phone's (the bench shows the shot `phone`; the tray and the switch are in the dock). */
  phone(): boolean;
  /** A door into `partId` from the shot `lead` (the old one given up); the lens to its holder pose. */
  openDoor(partId: string, info: StepInfo, lead?: BenchShot): Door;
  /** Leaving the door's step: the rail flies home first, then the shot `then` (or at once on a deep link). */
  closeDoor(info: StepInfo, then: BenchShot): void;
  snap(): void;
  /** Every frame: the bench, then the door, the lens over everything, the ladder and the names. */
  update(dt: number, t: number): void;
}

export function createResistorStand(ctx: ChapterContext): ResistorStand {
  const bench = mountBench(ctx);
  const keeper = lensKeeper(bench.tools);
  let door: Door | null = null;
  /** The door stays only while its step is on screen or its rail still has the camera. */
  let doorStep: string | null = null;
  const ladder = benchLadder(ctx, () => door?.floor ?? null);
  const stand: ResistorStand = {
    bench,
    get door() {
      return door;
    },
    keeper,
    ladder,
    naming: SILENT,
    board(parts, leads) {
      bench.clear();
      bench.preset(parts, leads);
    },
    phone: () => ctx.device.formFactor === 'phone',
    openDoor(partId, info, lead = 'board') {
      door?.dispose();
      const d = partDoor(ctx, bench, partId, { lead });
      door = d;
      doorStep = ctx.stage.current ?? null;
      keeper.call = 1;
      if (info.instant) keeper.snap(() => d.lens(d.rail.position));
      else keeper.to(() => d.lens(d.rail.position), 1.2);
      return d;
    },
    closeDoor(info, then) {
      keeper.call = 0;
      if (!door) return;
      door.home({ instant: info.instant, then });
      doorStep = null;
    },
    snap() {
      bench.snap();
    },
    update(dt, t) {
      bench.update(dt, t);
      if (door) {
        door.update(dt);
        const p = door.rail.position;
        const engaged = door.rail.engaged;
        keeper.rim = engaged ? door.rim(p) : 0;
        keeper.glass = engaged ? door.glass(p) : 1;
        keeper.late(dt, t);
        // back on the step's shot after the step: the door is given up, the bench lays the lens again
        if (doorStep === null && !engaged) {
          door.dispose();
          door = null;
        }
      }
      ladder.update();
      names.update();
    },
  };
  const names: Names = partNames(
    ctx,
    bench,
    (id) => stand.naming.part(id),
    () => stand.naming.meter,
  );
  return stand;
}
