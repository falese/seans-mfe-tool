#!/usr/bin/env ts-node
/**
 * Fleet consistency gate (#296).
 *
 * Runs the reusable `mfe:validate` core (`mfeValidateCommand`) over every MFE
 * under the search roots and fails if any is internally inconsistent
 * (manifest ⇄ package.json ⇄ federation `shared`, react/react-dom pins, runtime
 * dependency). This is the CI wiring the issue calls for — the *logic* lives in
 * and is unit-tested by the platform (`@seans-mfe/codegen` + the command core),
 * not sprinkled across examples.
 *
 * Complements #295's drift gate: that gate owns generator-owned files; this one
 * owns the developer-owned config the drift gate intentionally never touches.
 *
 * Usage:
 *   ts-node scripts/check-mfe-consistency.ts                # scan examples/**
 *   ts-node scripts/check-mfe-consistency.ts path/to/mfe    # scan explicit roots
 */

import * as fs from 'fs';
import * as path from 'path';
import { mfeValidateCommand } from '../src/commands/mfe/validate';

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST = 'mfe-manifest.yaml';

function findManifestDirs(root: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(path.join(dir, entry.name));
      } else if (entry.name === MANIFEST) {
        out.push(dir);
      }
    }
  };
  walk(root);
  return out;
}

async function main(): Promise<void> {
  const argRoots = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const roots =
    argRoots.length > 0
      ? argRoots.map((r) => path.resolve(REPO_ROOT, r))
      : [path.join(REPO_ROOT, 'examples')];

  const dirs = [...new Set(roots.flatMap(findManifestDirs))].sort();
  const failed: string[] = [];
  /** MFEs with ADR-082 migration warnings — advisory, so they do not fail. */
  const warned: Array<{ dir: string; count: number }> = [];

  for (const dir of dirs) {
    try {
      const result = await mfeValidateCommand({ dir });
      const warnings = result.issues.filter((i) => i.severity === 'warning');
      if (warnings.length > 0) {
        warned.push({ dir: path.relative(REPO_ROOT, dir), count: warnings.length });
      }
    } catch {
      // mfeValidateCommand already prints the per-rule detail; record the dir.
      failed.push(path.relative(REPO_ROOT, dir));
    }
  }

  if (failed.length > 0) {
    console.error(
      `\n${failed.length} of ${dirs.length} MFE(s) failed consistency validation:\n` +
        failed.map((f) => `  - ${f}`).join('\n') +
        `\n\nRun: npx ts-node src/commands/mfe/validate.ts <dir>  (or seans-mfe-tool mfe:validate <dir>)`,
    );
    process.exit(1);
  }

  // Say it in the summary, not only inline. A reader who scrolls to the last
  // line is the reader this exists for — reporting "all consistent" over a
  // fleet with known-stale developer code is the blindness ADR-082 was written
  // to end, and it would be perverse to reproduce it here.
  if (warned.length > 0) {
    const total = warned.reduce((n, w) => n + w.count, 0);
    console.log(
      `\n${dirs.length} MFE(s) checked — all internally consistent, ` +
        `with ${total} platform-migration warning(s) in ${warned.length} MFE(s):\n` +
        warned.map((w) => `  ⚠ ${w.dir} (${w.count})`).join('\n') +
        `\n\nThese do not fail the gate. Run: seans-mfe-tool mfe:validate <dir>  (--strict to enforce)`,
    );
    return;
  }

  console.log(`\n${dirs.length} MFE(s) checked — all internally consistent.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
