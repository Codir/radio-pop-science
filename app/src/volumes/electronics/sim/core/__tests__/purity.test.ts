// The circuit model stays pure TypeScript: nothing under sim/ reaches the engine, three.js, the DOM, a clock, a timer
// or chance. The engine's lint keeps such rules for chapters only, so this test reads the texts of the files (the same
// test guards the model of the radio volume). For the forbidden names it reads comments too: they must not be written
// in the model even there.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SIM = new URL('../..', import.meta.url); // …/sim/

/** The text without comments. (A `//` inside a string would cut its line short; the model has no such strings.) */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

/** Module names in code: `import … from '…'` and `export … from '…'`; `import '…'`; `import('…')` and `require('…')`. */
const IMPORTS: readonly RegExp[] = [
  /^[ \t]*(?:import|export)\b[\w$\s{},*]*?\bfrom\s*(['"])([^'"\n]+)\1/gm,
  /^[ \t]*import\s*(['"])([^'"\n]+)\1/gm,
  /\b(?:import|require)\s*\(\s*(['"])([^'"\n]+)\1/g,
];

/** A global object counts when it is used as one: `typeof name`, `name.x`, `name?.x`, `name[…]`. */
const asObject = (name: string): RegExp =>
  new RegExp(`\\btypeof\\s+${name}\\b|(?<![.\\w$])${name}(?:\\?\\.|\\.(?=[A-Za-z_$])|\\[)`);

/** What a file of the model must not name: how the violation is reported and how it looks in the text. */
const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['crypto', /\bcrypto\s*\.\s*(?:getRandomValues|randomUUID)\b/],
  ['Date.now', /\bDate\s*\.\s*now\b/],
  ['new Date', /\bnew\s+Date\b/],
  ['performance.now', /\bperformance\s*\.\s*now\b/],
  ['setTimeout', /\bsetTimeout\b/],
  ['setInterval', /\bsetInterval\b/],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['document', asObject('document')],
  ['window', asObject('window')],
];

/** Does the module name `spec`, written in `file` (a path from sim/), stay inside sim/? Only relative names can. */
function inside(spec: string, file: string): boolean {
  if (!/^\.\.?(?:\/|$)/.test(spec)) return false;
  const at = file.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '..') {
      if (at.length === 0) return false;
      at.pop();
    } else if (part !== '.' && part !== '') at.push(part);
  }
  return true;
}

/** Violations in the text of one file; `file` is its path from sim/. */
function violations(text: string, file: string): string[] {
  const out = new Set<string>();
  const bare = code(text);
  for (const pattern of IMPORTS) {
    for (const match of bare.matchAll(pattern)) if (!inside(match[2]!, file)) out.add(match[2]!);
  }
  for (const [name, pattern] of FORBIDDEN) if (pattern.test(text)) out.add(name);
  return [...out];
}

// every *.ts under sim/ except the tests
const files = readdirSync(SIM, { recursive: true, encoding: 'utf8' })
  .map((name) => name.replaceAll('\\', '/'))
  .filter((name) => name.endsWith('.ts') && !name.split('/').includes('__tests__'))
  .sort();
const found = files.flatMap((file) =>
  violations(readFileSync(new URL(file, SIM), 'utf8'), file).map((violation) => `${file}: ${violation}`),
);

describe('purity of the circuit model', () => {
  it('catches what is slipped in', () => {
    expect(violations("import { Vector3 } from 'three';", 'core/a.ts')).toEqual(['three']);
    expect(violations("import { Rng } from '@/engine/random';", 'core/a.ts')).toHaveLength(1);
    expect(violations("import { x } from '../../shared/sound';", 'core/a.ts')).toHaveLength(1); // leaves sim/
    for (const bad of [
      'Math.random()',
      'Date.now()',
      'performance.now()',
      'setTimeout(f, 1)',
      'setInterval(f, 1)',
      'document.body',
      'window.x',
    ])
      expect(violations(bad, 'core/a.ts')).toHaveLength(1);
    expect(
      violations(
        "import { PARTS } from './parts';\nimport f from './__fixtures__/divider.json';",
        'core/a.ts',
      ),
    ).toEqual([]);
    // the other ways to write an import, a clock, a timer and chance
    for (const bad of [
      "import 'three';",
      "const three = await import('three');",
      "const fs = require('node:fs');",
      "export * from '@electronics/shared/bench';",
      "import type {\n  Object3D, // the board\n} from 'three';",
      "import { x } from '../x';", // from a file that lies in sim/ itself
      'new Date()',
      'requestAnimationFrame(f)',
      'crypto.getRandomValues(bytes)',
      "typeof window !== 'undefined'",
      "document?.title ?? ''",
      '// even in a comment: Math.random',
    ])
      expect(violations(bad, 'a.ts')).toHaveLength(1);
    // …and what is not one: the same folder and its neighbours inside sim/, words of plain speech
    for (const fine of [
      "export * from './mna';\nimport { x } from '../transient/x';",
      "export const KEY = 'resistor-4k7';\nconst from = Float64Array.from([1, 2]);",
      "export function f(): void {\n  // the numbers come from 'the plan'\n}",
      '// A node of the window between two rows. The whole document is read by the test.',
    ])
      expect(violations(fine, 'core/a.ts')).toEqual([]);
  });

  it('nothing impure under sim/', () => {
    // netlist, parts, mna, topology, dc, state, index — at least these modules
    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(found).toEqual([]);
  });
});
