/**
 * Parses bundler and compiler output into BuildError.
 *
 * Every fixture in ./fixtures/ is REAL output, captured by breaking a project
 * and running the actual tool — not a guess at the format. Two things that
 * only show up when you do that:
 *
 *   1. Both rspack and tsc write diagnostics to STDOUT. stderr is empty. The
 *      framework plugins read `err.stderr`, so a failing build produced
 *      `{ message: '', category: 'unknown' }` — an empty string, not even the
 *      raw blob.
 *   2. rspack's error block is multi-line with box-drawing characters, and the
 *      file/line/column live on the `ERROR in <file> <line>:<col>` header, not
 *      beside the message.
 *
 * Refs #139 · #148 · ADR-036 · ADR-077
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseBuildOutput } from '../build-output-parser';

const fixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('parseBuildOutput — tsc', () => {
  const errors = parseBuildOutput(fixture('tsc-errors.txt'));

  it('finds every diagnostic', () => {
    expect(errors).toHaveLength(3);
  });

  it('extracts file, line and column', () => {
    expect(errors[0]).toMatchObject({ file: 'src/a.ts', line: 3, column: 15 });
  });

  it('keeps the message without the TS code prefix', () => {
    expect(errors[0].message).toBe("Property 'gapY' does not exist on type 'Pipe'.");
  });

  it('classifies a type error as `type`', () => {
    expect(errors[0].category).toBe('type');
    expect(errors[1].category).toBe('type');
  });

  it('classifies a missing module as `dependency`, not `type`', () => {
    // TS2307 is a type-checker diagnostic, but the actionable problem is a
    // missing dependency — that is what the agent has to fix.
    expect(errors[2]).toMatchObject({ category: 'dependency' });
  });

  it('carries the TS code so an agent can look it up', () => {
    expect(errors[0].code).toBe('TS2339');
  });
});

describe('parseBuildOutput — rspack module resolution', () => {
  const errors = parseBuildOutput(fixture('rspack-module-not-found.txt'));

  it('finds both unresolved imports', () => {
    expect(errors).toHaveLength(2);
  });

  it('takes file, line and column from the ERROR header', () => {
    expect(errors[0]).toMatchObject({ file: './src/index.js', line: 1, column: 1 });
  });

  it('keeps the message on one line, without the box drawing', () => {
    expect(errors[0].message).toBe(
      "Module not found: Can't resolve './does-not-exist' in '/project/src'",
    );
    expect(errors[0].message).not.toMatch(/[╭╰─·│]/);
  });

  it('classifies unresolved modules as `dependency`', () => {
    expect(errors.every((e) => e.category === 'dependency')).toBe(true);
  });

  it('suggests the likely fix for a bare specifier', () => {
    const react = errors.find((e) => e.message.includes("'react'"));
    expect(react?.suggestion).toMatch(/install/i);
  });

  it('suggests a path check for a relative specifier', () => {
    const relative = errors.find((e) => e.message.includes('./does-not-exist'));
    expect(relative?.suggestion).toMatch(/path/i);
  });
});

describe('parseBuildOutput — rspack parse errors', () => {
  const errors = parseBuildOutput(fixture('rspack-parse-error.txt'));

  it('finds the failure', () => {
    expect(errors).toHaveLength(1);
  });

  it('classifies it as `syntax`', () => {
    expect(errors[0].category).toBe('syntax');
  });

  it('reports the file', () => {
    expect(errors[0].file).toBe('./src/index.js');
  });

  it('recovers the line from the source gutter when the header carries none', () => {
    // A parse-error header is bare `ERROR in ./src/index.js` — no position.
    // The only position is the gutter of the excerpt rspack prints: ` 1 │ ...`.
    expect(errors[0].line).toBe(1);
  });

  it('reports no column rather than inventing one', () => {
    // The caret row (`·    ─`) encodes a column, but only relative to a gutter
    // width that varies with line-number digits. Guessing it would be worse
    // than omitting it.
    expect(errors[0].column).toBeUndefined();
  });

  it('uses the innermost message, not the "Module parse failed" wrapper', () => {
    expect(errors[0].message).toBe('JavaScript parse error: Expression expected');
  });
});

describe('parseBuildOutput — behaviour under uncertainty', () => {
  it('returns [] for empty output rather than a fake error', () => {
    expect(parseBuildOutput('')).toEqual([]);
    expect(parseBuildOutput('   \n  \n')).toEqual([]);
  });

  it('falls back to one unknown error carrying the whole output', () => {
    // Better to hand the agent the text than to silently report nothing —
    // which is what shipping today, reading the empty stderr, actually did.
    const noise = 'something went wrong in a way we do not recognise';
    const errors = parseBuildOutput(noise);
    expect(errors).toEqual([{ message: noise, category: 'unknown' }]);
  });

  it('ignores a successful build', () => {
    expect(parseBuildOutput('Rspack compiled successfully in 412 ms')).toEqual([]);
  });

  it('does not treat warnings as errors', () => {
    const out = 'WARNING in ./src/big.js\n  × asset size limit exceeded\n';
    expect(parseBuildOutput(out)).toEqual([]);
  });
});

describe('parseBuildOutput — Angular / ng', () => {
  // ng surfaces tsc diagnostics with an `Error: ` prefix and a colon-separated
  // position rather than tsc's parenthesised one.
  const output = [
    'Error: src/app/app.component.ts:12:3 - error TS2554: Expected 1 arguments, but got 0.',
    'Error: src/app/main.ts:4:1 - error TS2307: Cannot find module \'./missing\'.',
  ].join('\n');

  it('parses the ng diagnostic form', () => {
    const errors = parseBuildOutput(output);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({
      file: 'src/app/app.component.ts',
      line: 12,
      column: 3,
      code: 'TS2554',
      category: 'type',
    });
  });

  it('classifies a missing module from ng output as `dependency`', () => {
    expect(parseBuildOutput(output)[1].category).toBe('dependency');
  });
});
