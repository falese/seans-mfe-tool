/**
 * Guard: every `ADR-<nnn>` reference on the project's *authoritative* surfaces
 * must resolve to a real `docs/architecture-decisions/ADR-<nnn>-*.md` file.
 *
 * Why this exists: the ADR library has been renumbered more than once (most
 * recently the 001-043 reflow). Each renumber left dangling references behind
 * — in runtime code, EJS templates, package.json descriptions, and scripts —
 * pointing at ADR numbers whose files had moved. This test fails the build the
 * moment a new dangling reference appears, so the rot can't return silently.
 *
 * Scope is deliberate. It covers the surfaces we keep current — source,
 * packages, scripts, the canonical spec, the ADR set itself, and top-level
 * docs. It does NOT police point-in-time records (requirements docs,
 * acceptance criteria, generated example output, anything under */archive/, or
 * .github instructions): those legitimately cite the numbering that was
 * current when they were written.
 *
 * Limitation: this checks that the referenced ADR *file exists*, not that the
 * number still means what the reference says. A semantic mismatch (e.g. a
 * comment citing "ADR-013: BaseMFE" when ADR-013 is now a different decision)
 * will not be caught here — only a missing file will.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ADR_DIR = path.join(REPO_ROOT, 'docs', 'architecture-decisions');

// Build the regex from parts so this file never contains a literal ADR-<digits>
// token that would make the guard trip over its own source.
const ADR_REF = new RegExp('ADR-' + '(\\d{3})', 'g');
const ADR_FILE = new RegExp('^ADR-' + '(\\d{3})' + '-');

const SCAN_DIRS = ['src', 'packages', 'scripts', path.join('docs', 'architecture-decisions')];
const SCAN_FILES = ['README.md', 'CLAUDE.md', path.join('docs', 'spec.md')];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'examples', 'archive']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', '.yml', '.ejs', '.feature']);

/** Recursively collect text files under a directory, skipping SKIP_DIRS. */
function collectFiles(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(full, acc);
    } else if (TEXT_EXT.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
}

/** Set of ADR numbers that actually have a file, e.g. "041". */
function existingAdrNumbers(): Set<string> {
  const nums = new Set<string>();
  for (const name of fs.readdirSync(ADR_DIR)) {
    const m = name.match(ADR_FILE);
    if (m) nums.add(m[1]);
  }
  return nums;
}

describe('ADR reference integrity', () => {
  it('has at least one ADR on disk (sanity)', () => {
    expect(existingAdrNumbers().size).toBeGreaterThan(0);
  });

  it('every ADR-<nnn> reference on authoritative surfaces resolves to a file', () => {
    const existing = existingAdrNumbers();

    const files: string[] = [];
    for (const d of SCAN_DIRS) collectFiles(path.join(REPO_ROOT, d), files);
    for (const f of SCAN_FILES) {
      const full = path.join(REPO_ROOT, f);
      if (fs.existsSync(full)) files.push(full);
    }

    const violations: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const seen = new Set<string>();
      for (const match of text.matchAll(ADR_REF)) {
        const num = match[1];
        if (existing.has(num) || seen.has(num)) continue;
        seen.add(num);
        violations.push(`${path.relative(REPO_ROOT, file)} -> ADR-${num} (no matching docs/architecture-decisions/ADR-${num}-*.md)`);
      }
    }

    expect(violations).toEqual([]);
  });
});
