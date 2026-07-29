/**
 * The platform-migrations registry (ADR-082).
 *
 * Two kinds of assertion here, and the second matters more than the first.
 *
 * Entries are checked against what they claim to match — but also against what
 * they must *not* match. A migration that fires on compliant code trains people
 * to ignore it, which is worse than not having it: the fleet keeps drifting and
 * now there is a warning nobody reads. So every entry gets negative cases drawn
 * from the code the platform itself emits today.
 */

import {
  PLATFORM_MIGRATIONS,
  compareVersions,
  findMigrationHits,
  severityFor,
  type PlatformMigration,
} from '../platform-migrations';

const byId = (id: string): PlatformMigration => {
  const entry = PLATFORM_MIGRATIONS.find((m) => m.id === id);
  if (!entry) throw new Error(`no migration registered with id "${id}"`);
  return entry;
};

describe('compareVersions', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.0.1', '1.0.0', 1],
    ['1.0.0', '1.0.1', -1],
    ['2.0.0', '1.9.9', 1],
    ['1.10.0', '1.9.0', 1], // numeric, not lexicographic
    ['1.0.0', '1.0', 0], // missing parts read as zero
  ])('compares %s to %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it('ignores a prerelease suffix rather than throwing on it', () => {
    expect(compareVersions('2.0.0-rc.1', '2.0.0')).toBe(0);
  });
});

describe('severityFor', () => {
  const entry: PlatformMigration = {
    ...byId('typed-errors'),
    since: '1.0.0',
    failsAt: '2.0.0',
  };

  it('warns while the platform is inside the grace window', () => {
    expect(severityFor(entry, '1.4.0')).toBe('warning');
  });

  it('is an error once the platform reaches failsAt', () => {
    expect(severityFor(entry, '2.0.0')).toBe('error');
    expect(severityFor(entry, '2.1.0')).toBe('error');
  });

  it('warns indefinitely when an entry declares no failsAt', () => {
    expect(severityFor({ ...entry, failsAt: undefined }, '99.0.0')).toBe('warning');
  });
});

describe('the registry', () => {
  it('registers at least the two entries the drill produced', () => {
    expect(PLATFORM_MIGRATIONS.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every entry the fields a developer needs to act', () => {
    for (const m of PLATFORM_MIGRATIONS) {
      expect(m.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(m.message.length).toBeGreaterThan(10);
      // The fix is the half that cannot be derived from a diff — an entry
      // without one is a complaint, not a migration.
      expect(m.fix.length).toBeGreaterThan(10);
      expect(m.adr).toMatch(/^ADR-\d{3}$/);
      expect(m.since).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('uses unique ids, since they key the suppression a consumer would write', () => {
    const ids = PLATFORM_MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('typed-errors', () => {
  const entry = byId('typed-errors');
  const hits = (text: string): number =>
    findMigrationHits(entry, { path: 'src/index.tsx', text }).length;

  it('catches the raw throw the drill found in 19 developer-owned files', () => {
    expect(hits("if (!container) {\n  throw new Error('Root element not found');\n}")).toBe(1);
  });

  it('reports the line so the developer does not have to search', () => {
    const [hit] = findMigrationHits(entry, {
      path: 'src/index.tsx',
      text: "const a = 1;\nconst b = 2;\nthrow new Error('boom');\n",
    });
    expect(hit.line).toBe(3);
    expect(hit.text).toBe("throw new Error('boom');");
  });

  it('catches every whitespace form', () => {
    expect(hits('throw  new  Error (msg)')).toBe(1);
    expect(hits('throw new Error(`x ${y}`)')).toBe(1);
  });

  it('stays silent on the typed errors the platform now emits', () => {
    expect(hits("throw new SystemError('Root element not found');")).toBe(0);
    expect(hits("throw new ValidationError('bad', 'field', 'required');")).toBe(0);
    expect(hits("throw new NetworkError(`BFF request failed`, response.status);")).toBe(0);
  });

  it('does not fire on an Error that is constructed but not thrown', () => {
    expect(hits('const e = new Error("just a value");')).toBe(0);
    expect(hits('reject(new Error("async"));')).toBe(0);
  });
});

describe('validation-error-renamed', () => {
  const entry = byId('validation-error-renamed');
  const hits = (text: string): number =>
    findMigrationHits(entry, { path: 'src/thing.ts', text }).length;

  it('catches the record type imported under its old name', () => {
    expect(hits("import type { ValidationError } from '@seans-mfe-tool/runtime';")).toBe(1);
  });

  it('catches it alongside other type imports', () => {
    expect(
      hits("import type { Context, ValidationError, LoadResult } from '@seans-mfe-tool/runtime';"),
    ).toBe(1);
  });

  it('leaves the thrown class alone — that name is still correct', () => {
    // The class is a value import and did not move. Only the type record was
    // renamed, so flagging every ValidationError would be wrong.
    expect(hits("import { ValidationError } from '@seans-mfe-tool/runtime';")).toBe(0);
    expect(hits("throw new ValidationError('bad', 'field', 'required');")).toBe(0);
  });

  it('leaves the new name alone', () => {
    expect(hits("import type { ValidationIssue } from '@seans-mfe-tool/runtime';")).toBe(0);
  });

  it('ignores a same-named type from somewhere else entirely', () => {
    expect(hits("import type { ValidationError } from './my-own-types';")).toBe(0);
  });
});

describe('findMigrationHits over real generated shapes', () => {
  it('is silent on the current index.tsx template output', () => {
    const current = [
      "import { createRoot } from 'react-dom/client';",
      "import { SystemError } from '@seans-mfe-tool/runtime';",
      '',
      "const container = document.getElementById('root');",
      'if (!container) {',
      "  throw new SystemError('Root element not found');",
      '}',
    ].join('\n');

    for (const m of PLATFORM_MIGRATIONS) {
      expect(findMigrationHits(m, { path: 'src/index.tsx', text: current })).toEqual([]);
    }
  });
});
