import { type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/api';
import type { Orbs } from '@/fx';
import { MAX_N, MAX_Z, maxElectrons, shellCounts } from '@alchemy/sim/core';
import { ShellAtom } from '../shell-atom';

const atom = new ShellAtom(new Rng(7), { maxProtons: MAX_Z, maxNeutrons: MAX_N });

/** Electrons drawn this frame (inner shells + the valence shell). */
const drawnElectrons = (): number =>
  atom.group.children.filter((c) => c.name === 'orbs:electron').reduce((sum, c) => sum + (c as Orbs).instances, 0);
/** Glass shell spheres shown this frame. */
const drawnShells = (): number =>
  atom.group.children.filter((c) => (c as Mesh).isMesh && !c.name.startsWith('orbs:') && c.visible).length;

const show = (z: number, electrons: number): void => {
  atom.set(z, 0, shellCounts(z, electrons), true);
  atom.update(0, 0);
};

describe('ShellAtom (seven shells)', () => {
  it('draws every electron of every atom or ion the game can hold', () => {
    const lost: string[] = [];
    for (let z = 1; z <= MAX_Z; z++) {
      for (let e = 0; e <= maxElectrons(z); e++) {
        show(z, e);
        if (drawnElectrons() !== e) lost.push(`Z=${z} e=${e}: ${drawnElectrons()} drawn`);
      }
    }
    expect(lost).toEqual([]);
  });

  it('shows one shell for hydrogen, six for lead, seven for californium and oganesson', () => {
    const shells = (z: number): number => (show(z, z), drawnShells());
    expect(shells(1)).toBe(1);
    expect(shells(82)).toBe(6);
    expect(shells(98)).toBe(7);
    expect(shells(118)).toBe(7);
    expect((show(1, 0), drawnShells())).toBe(0); // a bare proton
  });
});
