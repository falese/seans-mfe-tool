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
  // Real `ng build --configuration production` output. Two things the earlier
  // hand-written version of these tests got wrong, and only capturing real
  // output revealed:
  //
  //   1. ng writes to STDERR while rspack and tsc write to stdout, and it
  //      emits ANSI colour even when piped — so the diagnostic's file, line,
  //      column and code are separated by escape sequences.
  //   2. Its module-resolution errors use a webpack form
  //      (`./file:line:colStart-colEnd - Error: Module not found: ...`)
  //      that shares no shape with rspack's `ERROR in` header.
  //
  // Against this fixture the parser originally produced ONE unknown error.
  const errors = parseBuildOutput(fixture('ng-build-errors.txt'));

  it('finds every diagnostic in the real output', () => {
    // 10 TS diagnostics + 1 webpack module-resolution line. Counted by
    // stripping ANSI and matching, because `grep 'error TS'` finds zero in this
    // fixture — the escapes sit between "error" and the code, which is exactly
    // why the parser missed all of them before.
    expect(errors).toHaveLength(11);
  });

  it('gives every error a file and a position', () => {
    for (const error of errors) {
      expect(error.file).toBeTruthy();
      expect(typeof error.line).toBe('number');
    }
  });

  it('sees through ANSI colour codes', () => {
    const typeError = errors.find((e) => e.code === 'TS2322');
    expect(typeError).toMatchObject({
      file: 'src/app/app.component.ts',
      line: 22,
      column: 9,
      category: 'type',
    });
    expect(typeError?.message).toBe("Type 'number' is not assignable to type 'string'.");
  });

  it('leaves no escape sequences in any field', () => {
    // eslint-disable-next-line no-control-regex
    const ansi = /\[/;
    for (const error of errors) {
      expect(ansi.test(error.message)).toBe(false);
      expect(ansi.test(error.file ?? '')).toBe(false);
    }
  });

  it('parses the webpack-form module-not-found line', () => {
    const moduleError = errors.find((e) => e.message.includes('runtime/angular') && e.line === 2);
    expect(moduleError).toMatchObject({
      file: './src/platform/base-mfe/mfe.ts',
      line: 2,
      category: 'dependency',
    });
    expect(moduleError?.suggestion).toMatch(/install/i);
  });

  it('classifies TS2307 as dependency, not type', () => {
    const missing = errors.filter((e) => e.code === 'TS2307');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((e) => e.category === 'dependency')).toBe(true);
  });

  it('does not mistake progress lines for errors', () => {
    expect(errors.some((e) => e.message.includes('bundle generation complete'))).toBe(false);
    expect(errors.some((e) => e.category === 'unknown')).toBe(false);
  });
});
