/**
 * Kernel floor unit tests (PDR-010, ADR-089 port 4).
 *
 * `verify` is the deterministic floor — plain, independently-tested code the
 * fuzzy layer never produces. These tests are that independent test.
 */

import {
  HardenedCheckSchema,
  verify,
  type HardenedCheck,
  type HostSource,
} from '../index';

const throwsRawError: HardenedCheck = {
  id: 'typed-errors',
  message: 'Throwing a raw error skips the platform error classifier',
  fix: 'Throw a typed error instead',
  enforces: 'ADR-017',
  pattern: /\bthrow\s+new\s+Error\s*\(/,
};

describe('verify', () => {
  it('reports every matching line with a 1-indexed number and trimmed text', () => {
    const source: HostSource = {
      path: 'src/thing.ts',
      text: ['const ok = 1;', '  throw new Error("boom");', 'const also = 2;'].join('\n'),
    };

    const hits = verify(throwsRawError, source);

    expect(hits).toEqual([{ line: 2, text: 'throw new Error("boom");' }]);
  });

  it('returns no hits when the pattern is absent', () => {
    const source: HostSource = { path: 'src/clean.ts', text: 'return ok();' };
    expect(verify(throwsRawError, source)).toEqual([]);
  });

  it('exempts a line the exempt pattern matches even when pattern matched', () => {
    const check: HardenedCheck = {
      ...throwsRawError,
      id: 'with-exempt',
      exempt: /adr-lint-ignore/,
    };
    const source: HostSource = {
      path: 'src/x.ts',
      text: 'throw new Error("x"); // adr-lint-ignore',
    };
    expect(verify(check, source)).toEqual([]);
  });

  it('finds a hit on every line, not just the first', () => {
    const source: HostSource = {
      path: 'src/many.ts',
      text: 'throw new Error("a");\nthrow new Error("b");',
    };
    expect(verify(throwsRawError, source).map((h) => h.line)).toEqual([1, 2]);
  });
});

describe('HardenedCheckSchema', () => {
  it('accepts a well-formed check with real RegExp matchers', () => {
    expect(HardenedCheckSchema.safeParse(throwsRawError).success).toBe(true);
  });

  it('rejects a check whose pattern is a string, not a RegExp', () => {
    const bad = { ...throwsRawError, pattern: 'throw new Error(' };
    expect(HardenedCheckSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a check missing the fix — the half a developer needs', () => {
    const { fix: _omitted, ...noFix } = throwsRawError;
    expect(HardenedCheckSchema.safeParse(noFix).success).toBe(false);
  });
});
