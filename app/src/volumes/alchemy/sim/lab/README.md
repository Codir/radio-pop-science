# sim/lab — the model behind the nuclear lab

Import from `@alchemy/sim/lab` (`index.ts`; the alias `@alchemy/*` is in `app/tsconfig.json`). Pure TypeScript, no three.js, no storage, no clock,
no `Math.random`: dice come in as arguments (`u` in [0, 1)). Tests in `__tests__/`. Nuclide data comes from `sim/core`.

## State and event

`GameState` is immutable: `{ z, n, electrons, elapsedSeconds, moves, history, pending, fissioned, shed }`.
Every tool returns a `Turn = { state, event }`. When nothing changes, `state` is the very same object. The
`event` says what happened and is all the scene needs to animate and to write the step text:
`capture`, `bounce`, `knockOut`, `decay`, `fission`, `fragment`, `electrons`, `refused`.
`pending` is a fission that waits for the player to pick a fragment; while it is set, every other tool refuses
with `pending`.

## Tools

| Tool | API | Move? |
|---|---|---|
| projectile (`n p d he3 alpha c12 o16 ca48`) | `fireAt(state, projectile)` | yes, if it transforms |
| gamma, knock out a neutron / a proton | `knock(state, 'n' \| 'p')` | yes |
| wait for decay | `waitForDecay(state, uTime, uBranch)`, `waitRefusal(state)` | yes |
| fleeting nucleus falls apart by itself | `autoDecay(state, uTime, uBranch)`, `isFleeting(state)` | no |
| pick a fission fragment | `chooseFragment(state, 'heavy' \| 'light')` | no |
| add or remove shell electrons | `setElectrons(state, count)` | no |

Quests: `QUESTS`, `questById`, `reached(goal, state)`, `FREE_START`; the solver (`solver.ts`) proves each quest has
a route. Saved progress: `progress.ts` (below).

## Moves

Moves count transformations of the nucleus only. These events are moves: a projectile hit that changes the
nucleus (capture, proton-proton fusion, a fission started by a neutron), a gamma knock-out, and a decay after
"wait" (including a spontaneous fission reached that way). These are not moves: a bounce, a refusal, an electron
change, a decay of a fleeting nucleus by itself (`autoDecay`), and choosing a fragment.

## Rules the scene relies on

- **Neutron drip line.** A neutron that would "capture" into the very same nuclide (after evaporating one
  neutron) is a `bounce`, not a capture: nothing changed, no move.
- **Stable nuclides have no branches** in the data, so waiting on them always refuses with `stable`.
- **Why "wait" refuses** (`waitRefusal`, or `event.reason` of a `refused` event):
  - `stable`: the nuclide is stable;
  - `notObserved`: a long-lived nuclide whose decay has never been observed (the half-life is only a lower bound
    above the age of the Universe, for example ²⁰⁴Pb);
  - `needsElectron`: it has decay branches, but none is playable now, because the only ones need shell electrons
    the atom does not have (electron capture takes 1, double positron decay 2);
  - `noData`: the table has no usable decay for it, or the daughter is not in the table;
  - `pending`: a fission fragment must be chosen first.
  (`noProduct` is for tools that have no result: no such knock-out, no fragment to choose.)
- **A fleeting nucleus that cannot decay right now** (a bare atom whose only branch is electron capture) simply
  stays. `isFleeting` is true, but `autoDecay` refuses, so the scene must not start a countdown for it; check
  `waitRefusal(state) === null` first.
- **The sign of Q comes from the number.** Knock-out is usually endothermic (Q below 0) but not always, and some
  listed decays have a negative Q too. Text must read the sign from `q`, never assume it. `q` is in keV and is
  `null` when a mass is unknown. Energy is only an indicator.
- **Electrons.** Decays that use electrons (`ec` takes 1, `2b+` takes 2) need them; after any move the count is
  clipped to what the new element can hold, and the excess is reported in `state.shed`.

## Simplifications of the model

Each one must show up in the chips or in the text of the step.

- The waiting time is skipped: "wait" jumps to the decay and adds a sampled lifetime to `elapsedSeconds`.
- A fleeting (short-lived) nucleus lives 2 s in the game before it falls apart.
- `ec/b+` becomes `b+` above the 1022 keV threshold and `ec` below it (and then needs an electron).
- The four fissile nuclides (²³³U, ²³⁵U, ²³⁹Pu, ²⁴¹Pu) always split on a neutron hit (in nature about 85 % of
  captures do), and always into the same pair of fragments.
- Spontaneous fission uses one formula for all nuclei (an asymmetric split around mass 140).
- "Extra" neutrons evaporate: a capture may lose up to 4 neutrons to land on a nuclide that exists.
- Decay branches rarer than 0,01 % (after normalising) are dropped.
- Thresholds and cross sections of reactions are ignored: a hit always works if the product exists; energy is
  only an indicator.

## Saved progress (`progress.ts`)

`parseProgress(text)` reads untrusted storage text and never throws: anything that is not a plain object gives
`EMPTY_PROGRESS`; each field is validated on its own, so a bad field loses only itself. Numbers are sanitised
(`JSON.parse('1e999')` is `Infinity`). Use it with `PROGRESS_KEY`:

```ts
const progress = parseProgress(storage.getItem(PROGRESS_KEY));   // storage access is the scene's job
storage.setItem(PROGRESS_KEY, serializeProgress(discover(progress, z, n)));
```

`discover` and `recordBest` return the same object when nothing changes, so a caller can skip the write.
`saveFree` ignores a state that waits for a fragment choice. `restoreFree` builds a fresh state around the
saved nuclide (history is just that nuclide, nothing pending, `fissioned: false`, `shed: 0`), or `¹H` when
nothing is saved. `nextVisit` bumps the visit counter; `countDiscovered` gives `{ elements, nuclides }`.
