#!/usr/bin/env ts-node
/**
 * Generate-and-diff drift gate for MFEs (#295).
 *
 * CI enforcement of ADR-043's idempotent-regeneration property, using the same
 * generate-and-diff idiom the repo already applies to schemas (build:schemas:check).
 *
 * The codegen tags every emitted file with an `overwrite` flag
 * (`unified-generator.ts`): `overwrite: true` files are **generator-owned** — a
 * plain `remote:generate` re-stamps them every run, so they must always match a
 * fresh generation from `mfe-manifest.yaml`. `overwrite: false` files are
 * developer-owned (feature code, package.json, bundler config) and are NOT
 * touched here — their manifest consistency is the job of `mfe validate` (#296).
 *
 * This script regenerates each MFE from its manifest and diffs only the
 * generator-owned files. Any hand-edit to that platform-contract code (the class
 * of silent drift behind the meridian-docking-simulation regression) fails CI.
 *
 * Usage:
 *   npm run check:mfe-drift            # regenerate generator-owned files in place
 *   npm run check:mfe-drift -- --check # diff only; exit 1 on drift (CI)
 *   npm run check:mfe-drift -- --check examples/meridian-station
 *
 * Refs #295
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseAndValidateDirectory } from '@seans-mfe/dsl';
import { generateAllFiles, diffGeneratedOwned } from '@seans-mfe/codegen';

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECK_MODE = process.argv.includes('--check');
const roots = process.argv
  .slice(2)
  .filter((a) => !a.startsWith('--'))
  .map((r) => path.resolve(REPO_ROOT, r));
const SEARCH_ROOTS = roots.length > 0 ? roots : [path.join(REPO_ROOT, 'examples')];

/** Recursively find every directory containing an mfe-manifest.yaml. */
function findManifestDirs(root: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === 'mfe-manifest.yaml')) {
      out.push(dir);
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== 'node_modules' && e.name !== 'dist') {
        walk(path.join(dir, e.name));
      }
    }
  };
  walk(root);
  return out;
}

interface Drift {
  file: string;
  reason: 'missing' | 'stale';
}

const readCurrent = (p: string): string | null =>
  fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;

async function checkMfe(dir: string): Promise<{ drift: Drift[]; written: string[] }> {
  const result = await parseAndValidateDirectory(dir);
  if (!result.valid || !result.manifest) {
    throw new Error(`invalid manifest in ${path.relative(REPO_ROOT, dir)}`);
  }
  const { files } = await generateAllFiles(result.manifest, dir);
  const { drift } = diffGeneratedOwned(files, readCurrent);

  if (CHECK_MODE) {
    return {
      drift: drift.map((d) => ({ file: path.relative(REPO_ROOT, d.file), reason: d.reason })),
      written: [],
    };
  }

  const written: string[] = [];
  for (const d of drift) {
    const target = files.find((f) => f.path === d.file);
    if (!target) continue;
    fs.mkdirSync(path.dirname(target.path), { recursive: true });
    fs.writeFileSync(target.path, target.content);
    written.push(path.relative(REPO_ROOT, target.path));
  }
  return { drift: [], written };
}

async function main(): Promise<void> {
  const mfeDirs = SEARCH_ROOTS.flatMap(findManifestDirs).sort();
  if (mfeDirs.length === 0) {
    console.error('No mfe-manifest.yaml found under:', SEARCH_ROOTS.map((r) => path.relative(REPO_ROOT, r)).join(', '));
    process.exit(1);
  }

  let totalDrift = 0;
  let totalWritten = 0;

  for (const dir of mfeDirs) {
    const rel = path.relative(REPO_ROOT, dir);
    try {
      const { drift, written } = await checkMfe(dir);
      if (CHECK_MODE) {
        if (drift.length > 0) {
          totalDrift += drift.length;
          console.error(`DRIFT ${rel}`);
          for (const d of drift) console.error(`  ${d.reason.toUpperCase()}: ${d.file}`);
        } else {
          console.log(`OK    ${rel}`);
        }
      } else if (written.length > 0) {
        totalWritten += written.length;
        console.log(`regenerated ${written.length} file(s) in ${rel}`);
        for (const w of written) console.log(`  ${w}`);
      } else {
        console.log(`OK    ${rel}`);
      }
    } catch (err) {
      console.error(`ERROR ${rel}: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  if (CHECK_MODE && totalDrift > 0) {
    console.error(
      `\nGenerator-owned drift detected in ${totalDrift} file(s). ` +
        `Run: npm run check:mfe-drift  (then commit the result)`,
    );
    process.exit(1);
  }
  if (!CHECK_MODE) {
    console.log(`\n${totalWritten === 0 ? 'No drift — nothing to regenerate.' : `Regenerated ${totalWritten} file(s).`}`);
  } else {
    console.log(`\n${mfeDirs.length} MFE(s) checked — no generator-owned drift.`);
  }
}

main().catch((err) => {
  console.error('check-mfe-drift failed:', (err as Error).message || err);
  process.exit(1);
});
