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

/** Roots whose production code is bound by ADR-017. */
const ROOTS = ['src', 'packages'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const EXCLUDED_SEGMENTS = ['__tests__', 'templates', 'node_modules', 'dist', 'fixtures'];

/** `throw new Error(` — the exact construct ADR-017 forbids. */
const RAW_THROW = /\bthrow\s+new\s+Error\s*\(/;

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
      if (RAW_THROW.test(text)) {
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
          `SystemError / TimeoutError / SecurityError from @seans-mfe/contracts (ADR-017):\n${report}`,
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
});
