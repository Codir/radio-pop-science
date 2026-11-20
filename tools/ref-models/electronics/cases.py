"""The circuits of the oracle. Every task of the circuit model adds its own here.

A case is a netlist in the form of app/src/volumes/electronics/sim/core/netlist.ts — the number of nodes (node 0 is
the ground) and the parts, each with an id, a key of the catalog, the node of every pin in the catalog's order and,
for a pot or a switch, a setting. The test of the model feeds the very same netlist, read from the sample, to the
model. spice.py turns it into a SPICE deck from its own catalog, runs ngspice and writes <name>.json.
"""


def part(id, spec, pins, setting=None):
    """One part of a netlist; `setting` only when it is given, as in the TypeScript type."""
    out = {'id': id, 'spec': spec, 'pins': list(pins)}
    if setting is not None:
        out['setting'] = setting
    return out


def net(nodes, *parts):
    return {'nodes': nodes, 'parts': list(parts)}


def pot_divider(setting):
    """A 10 kΩ pot from a 9 V battery, its wiper loaded by 4.7 kΩ: ccw on the ground, cw on the battery."""
    return net(3, part('B1', 'battery-9v', [1, 0]), part('P1', 'pot-10k', [0, 2, 1], setting),
               part('RL', 'resistor-4k7', [2, 0]))


def led_loops(color):
    """Four loops side by side, each a source, a resistor and an LED of one colour to the ground: the 9 V battery
    with 330 Ω and with 470 Ω, an ideal 5 V source with 330 Ω and with 470 Ω."""
    led = 'led-%s' % color
    return net(9, part('B1', 'battery-9v', [1, 0]), part('R1', 'resistor-330', [1, 2]), part('D1', led, [2, 0]),
               part('B2', 'battery-9v', [3, 0]), part('R2', 'resistor-470', [3, 4]), part('D2', led, [4, 0]),
               part('V3', 'ideal-5v', [5, 0]), part('R3', 'resistor-330', [5, 6]), part('D3', led, [6, 0]),
               part('V4', 'ideal-5v', [7, 0]), part('R4', 'resistor-470', [7, 8]), part('D4', led, [8, 0]))


# ── E1-3: linear circuits at the operating point ──────────────────────────────────────────────────────────────────
CASES = {
    # 9 V without internal resistance over 1 kΩ and 2 kΩ: 6 V in the middle
    'divider': net(3, part('V1', 'ideal-9v', [1, 0]), part('R1', 'resistor-1k', [1, 2]),
                   part('R2', 'resistor-2k', [2, 0])),
    # a series-parallel grid of five resistors from the 9 V battery
    'grid': net(4, part('B1', 'battery-9v', [1, 0]), part('R1', 'resistor-1k', [1, 2]),
                part('R2', 'resistor-2k2', [2, 0]), part('R3', 'resistor-470', [2, 3]),
                part('R4', 'resistor-1k', [3, 0]), part('R5', 'resistor-3k3', [3, 0])),
    # each of the three batteries on 100 Ω
    'battery-load': net(4, part('B1', 'battery-9v', [1, 0]), part('R1', 'resistor-100', [1, 0]),
                        part('B2', 'battery-4aa', [2, 0]), part('R2', 'resistor-100', [2, 0]),
                        part('B3', 'battery-aa', [3, 0]), part('R3', 'resistor-100', [3, 0])),
    # the pot at both ends and in the middle
    'pot-ccw': pot_divider(0),
    'pot-mid': pot_divider(0.5),
    'pot-cw': pot_divider(1),
    # the other linear parts: 6 V through a closed switch and a jumper into the speaker, the earphone with 100 Ω
    # beside it; behind an open switch a resistor that gets nothing
    'speaker-switch': net(6, part('B1', 'battery-4aa', [1, 0]), part('S1', 'switch', [1, 2], 1),
                          part('J1', 'jumper', [2, 3]), part('LS', 'speaker-8', [3, 0]),
                          part('PH', 'earphone-32', [3, 4]), part('R1', 'resistor-100', [4, 0]),
                          part('S2', 'switch', [2, 5], 0), part('R2', 'resistor-1k', [5, 0])),

    # ── E1-4: diodes and LEDs at the operating point ──────────────────────────────────────────────────────────────
    # an LED of each colour with 330 Ω and 470 Ω, from the 9 V battery and from 5 V
    **{'led-%s' % color: led_loops(color) for color in ('red', 'yellow', 'green', 'blue', 'white')},
    # both diodes forward from an ideal 5 V through 43 Ω, 430 Ω and 4.3 kΩ: about 100 mA, 10 mA and 1 mA
    'diode-forward': net(8, part('V1', 'ideal-5v', [1, 0]),
                         part('R1', 'resistor-43', [1, 2]), part('D1', 'diode-1n4148', [2, 0]),
                         part('R2', 'resistor-430', [1, 3]), part('D2', 'diode-1n4148', [3, 0]),
                         part('R3', 'resistor-4k3', [1, 4]), part('D3', 'diode-1n4148', [4, 0]),
                         part('R4', 'resistor-43', [1, 5]), part('D4', 'diode-1n4007', [5, 0]),
                         part('R5', 'resistor-430', [1, 6]), part('D5', 'diode-1n4007', [6, 0]),
                         part('R6', 'resistor-4k3', [1, 7]), part('D6', 'diode-1n4007', [7, 0])),
    # each diode and the red LED the wrong way round: the cathode towards the plus of the 9 V battery through 1 kΩ
    'diode-reverse': net(5, part('B1', 'battery-9v', [1, 0]),
                         part('R1', 'resistor-1k', [1, 2]), part('D1', 'diode-1n4148', [0, 2]),
                         part('R2', 'resistor-1k', [1, 3]), part('D2', 'diode-1n4007', [0, 3]),
                         part('R3', 'resistor-1k', [1, 4]), part('D3', 'led-red', [0, 4])),
}
