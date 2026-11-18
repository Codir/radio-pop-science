# tools/data — nuclide table

`build_nuclides.py` turns the IAEA ground-state snapshot into `app/src/volumes/alchemy/sim/data/nuclides.json`.
It is the only place that knows the source format; the game model reads only the JSON.

- Source: IAEA Nuclear Data Section, Live Chart of Nuclides, ground states —
  `https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all`
- Snapshot: 2026-11-17, `iaea/ground_states-2026-11-17.csv`
- sha256: `8aee5dc431af1e35fcb49746387b83e927b3c300e7787defbda621a08212c795`
- Licence: terms of use not verified (see `docs/THIRD_PARTY.md`).

Regenerate (standard library only, no network):

```
python3 tools/data/build_nuclides.py [--src tools/data/iaea/ground_states-2026-11-17.csv] [--out app/src/volumes/alchemy/sim/data/nuclides.json]
```

## Output format

`{ source, snapshot, neutron: {massExcess, halfLife}, symbols: [118], nuclides: [...] }`, one nuclide per line:
`[z, n, halfLife, branches, abundance, massExcess, discovered]`, sorted by `z`, then `n`. `halfLife` is seconds,
`"stable"` or `null`; `branches` is `[[code, share], ...]`.

## Cleaning rules

| Step | Rule |
|---|---|
| rows | skip Z = 0; the row (0, 1) gives `neutron.massExcess` and `neutron.halfLife` |
| `halfLife` | `half_life == 'STABLE'` gives `"stable"`; else `half_life_sec` as a number if present; else `null` |
| codes | `B-`→`b-`, `EC+B+`→`ec/b+`, `EC`→`ec`, `B+`→`b+`, `A`→`a`, `P`→`p`, `2P`→`2p`, `N`→`n`, `2N`→`2n`, `B-N`→`b-n`, `B-2N`→`b-2n`, `B-3N`→`b-3n`, `B-4N`→`b-4n`, `B-P`→`b-p`, `B-A`→`b-a`, `ECP` and `B+P`→`b+p`, `EC2P` and `B+2P`→`b+2p`, `ECA` and `B+A`→`b+a`, `2B-`→`2b-`, `2EC` and `2B+`→`2b+`, `SF`→`sf`; everything else (`IT`, `ECSF`, `SF+EC+B+`, `B-SF`, `B-5N`…`B-7N`, cluster decays) is dropped |
| repeats | the same source code twice in a row: keep the first; different source codes that map to one of our codes: add the shares |
| lower limit | `operator_hl` in {`GT`, `GE`} and `half_life_sec` > 4.35e17 s: no branches |
| daughter | a branch whose daughter nuclide is absent from the table is dropped (shifts per code are inside the script); `sf` is always kept |
| shares | all empty: equal; some empty: empty = 0; normalise to 1; drop < 1e-4; normalise again; sort largest first; 6 significant digits |
| rest | `abundance`, `massExcess`, `discovery`: a number or `null` |

Order inside one row: repeated code, map code, daughter check, merge, lower-limit rule, shares.

## Summary for this snapshot

3383 nuclides (118 elements). 32 branches dropped for a missing daughter. Dropped source codes: `SF+EC+B+` 5,
`14C` 5, `ECSF` 4, `B-7N` 2, `B-5N` 2, `B-6N` 2, `IT` 2, `24NE` 2, and one each of `B-SF`, `{+22}Ne`, `{+24}Ne`,
`Mg`, `{+25}Ne`, `{+34}Si`, `34SI`.
