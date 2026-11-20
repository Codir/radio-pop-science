/**
 * Copied from `circuit/chapters/build/parts/glide.ts` (shared/README.md, «Копії»), unchanged below this note.
 */
/**
 * A number that travels to its target in a given time, eased in and out, from wherever it is — also when a new
 * target arrives mid-way (it starts from the value shown, with no jump). The chapter's props are numbers like this:
 * a step entry sets targets, «Назад» sets the old ones, and everything plays both ways.
 */
export interface Glide {
  /** The value shown now. */
  readonly value: number;
  readonly target: number;
  /** True while it travels. */
  readonly moving: boolean;
  /** Travel to `to` in `seconds` (0 = at once). */
  go(to: number, seconds: number): void;
  /** Jump (deep links). */
  set(v: number): void;
  update(dt: number): number;
}

const ease = (x: number): number => x * x * (3 - 2 * x);

export function glide(initial = 0): Glide {
  let value = initial;
  let from = initial;
  let to = initial;
  let t = 1;
  let seconds = 0;
  return {
    get value() {
      return value;
    },
    get target() {
      return to;
    },
    get moving() {
      return t < 1;
    },
    go(target, s) {
      if (target === to && t < 1) return;
      if (s <= 0 || target === value) {
        value = from = to = target;
        t = 1;
        return;
      }
      from = value;
      to = target;
      seconds = s;
      t = 0;
    },
    set(v) {
      value = from = to = v;
      t = 1;
    },
    update(dt) {
      if (t < 1) {
        t = Math.min(t + dt / seconds, 1);
        value = from + (to - from) * ease(t);
      }
      return value;
    },
  };
}
