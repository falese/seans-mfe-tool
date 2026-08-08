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
 * It also checks the opposite direction: a manifest that *shrank* (e.g. a
 * `data:` section removed) can leave generator-owned files on disk that the
 * current manifest no longer generates at all — invisible to a same-set diff
 * because they never enter it. Found live in `examples/abc-kids/*`: 12 MFEs
 * with no `data:` still carried a root `server.ts` from before it was
 * removed. `findOrphanedGeneratedFiles` (`packages/codegen/src/drift.ts`)
 * catches this by also generating the manifest with `data` forced present, to
 * learn every generator-owned path this manifest's shape could ever produce,
 * and flagging any that exist on disk but not in the real generation.
 * Orphans are reported, never auto-deleted — same "warn, don't rewrite"
 * posture as ADR-082.
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
import { parseAndValidateDirectory } from '@falese/smt-dsl';
import type { DSLManifest } from '@falese/smt-dsl';
import { generateAllFiles, diffGeneratedOwned, findOrphanedGeneratedFiles } from '@falese/smt-codegen';
import { resolveFrameworkVariant } from '../src/framework/loader';

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
  reason: 'missing' | 'stale' | 'orphaned';
}

const readCurrent = (p: string): string | null =>
  fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;

/**
 * A manifest with every optional field that gates generator-owned output
 * forced present, so `generateAllFiles` produces the full universe of
 * generator-owned paths this manifest's shape could ever imply — not just
 * what it implies today. Currently that's just `data` (the BFF gate); extend
 * here if another optional section starts owning files of its own.
 */
function maximalManifest(manifest: DSLManifest): DSLManifest {
  if (manifest.data) return manifest;
  return {
    ...manifest,
    data: {
      sources: [
        { name: 'orphanProbe', handler: { openapi: { source: 'https://example.com/openapi.yaml' } } },
      ],
    },
  };
}

async function checkMfe(dir: string): Promise<{ drift: Drift[]; written: string[] }> {
  const result = await parseAndValidateDirectory(dir);
  if (!result.valid || !result.manifest) {
    throw new Error(`invalid manifest in ${path.relative(REPO_ROOT, dir)}`);
  }
  // Resolve the variant rather than letting codegen derive it (ADR-061 §3).
  // This script's non---check mode WRITES what it generates, so an MFE on a
  // third-party framework would have been reported as fully drifted and then
  // overwritten with React output — the repair tool corrupting the thing it
  // repairs.
  const frameworkVariant = resolveFrameworkVariant(result.manifest);

  const { files } = await generateAllFiles(result.manifest, dir, { frameworkVariant });
  const { drift } = diffGeneratedOwned(files, readCurrent);

  const { files: maximalFiles } = await generateAllFiles(maximalManifest(result.manifest), dir, {
    frameworkVariant,
  });
  const orphaned = findOrphanedGeneratedFiles(files, maximalFiles, readCurrent);

  const allDrift = [...drift, ...orphaned];

  if (CHECK_MODE) {
    return {
      drift: allDrift.map((d) => ({ file: path.relative(REPO_ROOT, d.file), reason: d.reason })),
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
  return {
    drift: orphaned.map((d) => ({ file: path.relative(REPO_ROOT, d.file), reason: d.reason })),
    written,
  };
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
      } else {
        if (written.length > 0) {
          totalWritten += written.length;
          console.log(`regenerated ${written.length} file(s) in ${rel}`);
          for (const w of written) console.log(`  ${w}`);
        }
        if (drift.length > 0) {
          totalDrift += drift.length;
          console.log(`ORPHANED (not removed — remove by hand) in ${rel}`);
          for (const d of drift) console.log(`  ${d.file}`);
        }
        if (written.length === 0 && drift.length === 0) {
          console.log(`OK    ${rel}`);
        }
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
    if (totalDrift > 0) {
      console.log(`${totalDrift} orphaned generator-owned file(s) found — not removed automatically, remove by hand.`);
    }
  } else {
    console.log(`\n${mfeDirs.length} MFE(s) checked — no generator-owned drift.`);
  }
}

main().catch((err) => {
  console.error('check-mfe-drift failed:', (err as Error).message || err);
  process.exit(1);
});
