/**
 * ADR-017 guard: no raw `throw new Error()` in production code (#320).
 *
 * ADR-017 has said "never `throw new Error()`" since April, `lint` was listed
 * as its `verified-by`, and no lint rule ever enforced it — so 39 raw throws
 * accumulated across 14 files. This is the gate that was missing.
 *
 * It matters beyond tidiness because two mechanisms read the error's `type`:
 *
 *   • `formatError` (ADR-018) classifies by it, so a raw Error becomes
 *     `unknown` → exit 70, indistinguishable from a genuine crash;
 *   • `endSpan` (ADR-081) attributes `error.type` from it, so a raw Error
 *     reports `"Error"` on every failed `cli.command` span.
 *
 * Scanned: everything under `src` and `packages`. Excluded: tests (a raw Error
 * is the right way to make a stub blow up), and `templates` directories, whose
 * EJS is source for generated MFEs rather than code this repo runs.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Roots bound by ADR-017.
 *
 * `examples` is in scope because generated MFEs are the platform's own output:
 * a decision the platform will not follow in the code it emits is not a
 * platform decision. `templates` is in scope for the same reason, one level up
 * — it is where that output is decided.
 */
const ROOTS = ['src', 'packages', 'examples'];

/**
 * `.ejs` carries the generated code. Scanning the rendered examples alone would
 * miss a template regression until someone regenerated, and `check-mfe-drift`
 * only diffs generator-owned files — so a raw throw reintroduced into
 * `index.tsx.ejs` would reach every future MFE unseen.
 */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.ejs']);

const EXCLUDED_SEGMENTS = ['__tests__', 'node_modules', 'dist', 'fixtures', 'coverage'];

/**
 * The API generator emits a standalone Express app that does not depend on
 * `@falese/smt-contracts`, so the typed classes are not reachable from its
 * output. ADR-063 has that whole axis parked behind #251, and
 * `examples/meridian-station/DX-REPORT.md` §0.2 records that the generated API
 * does not boot. Typing its throws is part of that work, not this rule.
 */
const EXCLUDED_PATHS = [path.join('src', 'codegen', 'templates', 'api')];

/** `throw new Error(` — the exact construct ADR-017 forbids. */
const RAW_THROW = /\bthrow\s+new\s+Error\s*\(/;

/**
 * A line may name the forbidden construct without being one — the migrations
 * registry (ADR-082) quotes it in the message it shows developers, and prose
 * about a rule is not a violation of it.
 *
 * Reuses the repo's existing marker rather than inventing a second convention:
 * `adr-lint-ignore: <rule>` is what `packages/dsl/src/adr-validation.ts`
 * already recognises. Same spelling, same intent, one thing to learn.
 *
 * Honoured on the offending line **or the one above it**, following the
 * `eslint-disable-next-line` idiom — a long message wraps, and demanding the
 * marker share a line with the text would fight the formatter.
 */
const SUPPRESSION = /adr-lint-ignore:\s*no-raw-error-throws/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (EXCLUDED_SEGMENTS.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) continue;
    if (EXCLUDED_PATHS.some((p) => path.relative(REPO_ROOT, full).startsWith(p))) continue;
    out.push(full);
  }
  return out;
}

function sourceFiles(): string[] {
  return ROOTS.flatMap((root) => walk(path.join(REPO_ROOT, root)));
}

interface Violation {
  file: string;
  line: number;
  text: string;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const file of sourceFiles()) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((text, index) => {
      const suppressed = SUPPRESSION.test(text) || SUPPRESSION.test(lines[index - 1] ?? '');
      if (RAW_THROW.test(text) && !suppressed) {
        violations.push({
          file: path.relative(REPO_ROOT, file),
          line: index + 1,
          text: text.trim(),
        });
      }
    });
  }
  return violations;
}

describe('ADR-017: typed errors only', () => {
  it('scans a meaningful number of files (guards against a silently empty sweep)', () => {
    // A path typo would make the sweep pass by finding nothing at all.
    expect(sourceFiles().length).toBeGreaterThan(100);
  });

  it('finds no raw `throw new Error()` in production code', () => {
    const violations = findViolations();

    // Report the sites, not a count — a bare "expected 3 to be 0" tells
    // whoever hits this nothing about where to look.
    const report = violations
      .map((v) => `  ${v.file}:${v.line}  ${v.text}`)
      .join('\n');

    expect(
      report &&
        `Raw Error throws found. Use ValidationError / BusinessError / NetworkError /\n` +
          `SystemError / TimeoutError / SecurityError from @falese/smt-contracts (ADR-017):\n${report}`,
    ).toBe('');
  });

  it('still catches a violation when one is introduced', () => {
    // Pins the matcher itself: a regex that stopped matching would make the
    // test above pass for the wrong reason, which is the failure mode of every
    // scanning gate.
    expect(RAW_THROW.test("    throw new Error('boom');")).toBe(true);
    expect(RAW_THROW.test('throw new Error(`x ${y}`)')).toBe(true);
    expect(RAW_THROW.test('  throw  new  Error (msg)')).toBe(true);
    expect(RAW_THROW.test("throw new ValidationError('boom', 'f', 'c');")).toBe(false);
    expect(RAW_THROW.test('const e = new Error("not a throw");')).toBe(false);
  });

  it('lets a line opt out when it only quotes the construct', () => {
    // The registry has to print `throw new Error()` to tell a developer what is
    // wrong; without an escape hatch this rule would forbid describing itself.
    const quoted =
      "  message: 'Raw `throw new Error()` is not typed', // adr-lint-ignore: no-raw-error-throws";
    expect(RAW_THROW.test(quoted)).toBe(true);
    expect(SUPPRESSION.test(quoted)).toBe(true);
  });

  it('honours the marker on the preceding line, since long messages wrap', () => {
    expect(SUPPRESSION.test('  // adr-lint-ignore: no-raw-error-throws — quoting it')).toBe(true);
  });

  it('does not accept a marker for a different rule', () => {
    expect(SUPPRESSION.test('// adr-lint-ignore: code-cites-ratified-adr')).toBe(false);
  });
});
