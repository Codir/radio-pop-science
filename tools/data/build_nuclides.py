#!/usr/bin/env python3
"""Convert the IAEA ground-state snapshot into app/src/volumes/alchemy/sim/data/nuclides.json.

The only place that knows the source format. Standard library only. All cleaning rules are listed in
tools/data/README.md.

Usage: python3 tools/data/build_nuclides.py [--src CSV] [--out JSON]
"""
import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SRC = ROOT / "tools/data/iaea/ground_states-2026-11-17.csv"
DEFAULT_OUT = ROOT / "app/src/volumes/alchemy/sim/data/nuclides.json"

SOURCE = "IAEA Nuclear Data Section — Live Chart of Nuclides, ground states"
SNAPSHOT = "2026-11-17"
AGE_OF_UNIVERSE_S = 4.35e17
MIN_SHARE = 1e-4

# Source decay code -> our code. Anything absent is dropped.
CODES = {
    "B-": "b-", "EC+B+": "ec/b+", "EC": "ec", "B+": "b+", "A": "a", "P": "p", "2P": "2p",
    "N": "n", "2N": "2n", "B-N": "b-n", "B-2N": "b-2n", "B-3N": "b-3n", "B-4N": "b-4n",
    "B-P": "b-p", "B-A": "b-a", "ECP": "b+p", "B+P": "b+p", "EC2P": "b+2p", "B+2P": "b+2p",
    "ECA": "b+a", "B+A": "b+a", "2B-": "2b-", "2EC": "2b+", "2B+": "2b+", "SF": "sf",
}

# Our code -> (dZ, dN) of the daughter. `sf` has no daughter check.
SHIFTS = {
    "b-": (1, -1), "b+": (-1, 1), "ec": (-1, 1), "ec/b+": (-1, 1), "a": (-2, -2), "p": (-1, 0),
    "2p": (-2, 0), "n": (0, -1), "2n": (0, -2), "b-n": (1, -2), "b-2n": (1, -3), "b-3n": (1, -4),
    "b-4n": (1, -5), "b-p": (0, -1), "b-a": (-1, -3), "b+p": (-2, 1), "b+2p": (-3, 1),
    "b+a": (-3, -1), "2b-": (2, -2), "2b+": (-2, 2),
}


def num(text):
    return float(text) if text.strip() != "" else None


def half_life(row):
    if row["half_life"] == "STABLE":
        return "stable"
    return num(row["half_life_sec"])


def sig6(x):
    return float(f"{x:.6g}")


def branches(row, keys, dropped, stats):
    hl = half_life(row)
    if hl == "stable":
        return []
    if row["operator_hl"] in ("GT", "GE") and isinstance(hl, float) and hl > AGE_OF_UNIVERSE_S:
        return []
    z, n = int(row["z"]), int(row["n"])
    seen, merged = set(), {}  # merged: our code -> share (None = empty source share)
    for i in (1, 2, 3):
        src = row[f"decay_{i}"].strip()
        if not src or src in seen:
            continue
        seen.add(src)
        code = CODES.get(src)
        if code is None:
            dropped[src] += 1
            continue
        if code != "sf":
            dz, dn = SHIFTS[code]
            if (z + dz, n + dn) not in keys:
                stats["daughter"] += 1
                continue
        share = num(row[f"decay_{i}_%"])
        if code in merged:
            a, b = merged[code], share
            merged[code] = None if a is None and b is None else (a or 0) + (b or 0)
        else:
            merged[code] = share
    if not merged:
        return []
    if all(v is None for v in merged.values()):
        shares = {c: 1.0 for c in merged}
    else:
        shares = {c: (v or 0.0) for c, v in merged.items()}
    total = sum(shares.values())
    if total <= 0:
        return []
    shares = {c: v / total for c, v in shares.items()}
    shares = {c: v for c, v in shares.items() if v >= MIN_SHARE}
    total = sum(shares.values())
    out = sorted(((c, v / total) for c, v in shares.items()), key=lambda cv: -cv[1])
    return [[c, sig6(v)] for c, v in out]


def build(src):
    with open(src, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    keys = {(int(r["z"]), int(r["n"])) for r in rows if int(r["z"]) > 0}
    dropped, stats = Counter(), Counter()
    neutron = None
    symbols = {}
    nuclides = []
    for r in rows:
        z, n = int(r["z"]), int(r["n"])
        if z == 0:
            if n == 1:
                neutron = {"massExcess": float(r["massexcess"]), "halfLife": float(r["half_life_sec"])}
            continue
        symbols[z] = r["symbol"]
        disc = num(r["discovery"])
        nuclides.append([
            z, n, half_life(r), branches(r, keys, dropped, stats),
            num(r["abundance"]), num(r["massexcess"]), None if disc is None else int(disc),
        ])
    nuclides.sort(key=lambda x: (x[0], x[1]))
    assert neutron is not None, "no (0, 1) row"
    assert sorted(symbols) == list(range(1, len(symbols) + 1)), "gap in Z"
    data = {
        "source": SOURCE, "snapshot": SNAPSHOT, "neutron": neutron,
        "symbols": [symbols[z] for z in sorted(symbols)], "nuclides": nuclides,
    }
    return data, dropped, stats


def write(data, out):
    head = {k: data[k] for k in ("source", "snapshot", "neutron", "symbols")}
    lines = ["{"]
    for k, v in head.items():
        lines.append(f"{json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))},")
    lines.append('"nuclides": [')
    lines.append(",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in data["nuclides"]))
    lines.append("]")
    lines.append("}")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()
    data, dropped, stats = build(args.src)
    write(data, args.out)
    nuc = data["nuclides"]
    print(f"nuclides: {len(nuc)}  elements: {len(data['symbols'])}")
    print(f"branches dropped for a missing daughter: {stats['daughter']}")
    print("dropped source codes: " + ", ".join(f"{c} {k}" for c, k in dropped.most_common()))
    print(f"written: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
