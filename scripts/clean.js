#!/usr/bin/env node
/**
 * Remove every build artifact this repo produces.
 *
 * Three times in one session a stale artifact outlived its source and the
 * symptom looked like working code:
 *
 *   - `dist/commands/api.js` survived the api command's move into
 *     @seans-mfe/plugin-api. oclif kept serving the old file, reported the
 *     command's owner as the root package, and `api --help` worked — off code
 *     that no longer existed in the tree.
 *   - `check:template-typecheck` resolves @seans-mfe-tool/runtime to
 *     dist/runtime, so editing packages/runtime/src and running the gate
 *     reported green against the previous build.
 *   - packages/plugin-adr/dist kept a compiled `_adr-root.js` after the source
 *     moved, so every CLI invocation warned about a command that was gone.
 *
 * None of those are exotic. They are the ordinary consequence of a repo where
 * `tsc -b` is incremental, oclif reads a manifest, and several gates resolve
 * packages to their compiled output. The fix is a reliable way to get back to
 * zero.
 *
 * Artifacts are DISCOVERED, not listed. A hardcoded list is how the previous
 * generation of this repo's tooling missed things — generate-schemas.ts knew
 * about exactly one plugin, and the command conformance sweep knew about
 * exactly one command root. A new package is covered here the day it exists.
 *
 * Usage:
 *   npm run clean                # remove them
 *   npm run clean -- --dry-run   # list what would be removed
 *   npm run clean -- --json      # machine-readable list (implies --dry-run)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

/** Directories whose immediate children are workspace-ish and may build. */
const WORKSPACE_PARENTS = ['packages', 'examples'];

/** Artifact names produced by `tsc`, `tsc -b`, and `oclif manifest`. */
const ARTIFACT_NAMES = ['dist', 'oclif.manifest.json', 'tsconfig.tsbuildinfo'];

/** Generated but not a staleness hazard; removed for completeness. */
const EXTRA_ROOT_ARTIFACTS = ['coverage', '_site'];

const exists = (p) => fs.existsSync(p);

/**
 * Every artifact path, discovered from the tree.
 *
 * Note `dist/runtime`: the runtime does not build into
 * packages/runtime/dist — `tsc -p packages/runtime/tsconfig.build.json` emits
 * into the ROOT dist, and scripts/copy-runtime-files.js stages it there. It is
 * covered by removing the root dist, not by the per-package walk, which is
 * precisely the kind of asymmetry a hand-written list gets wrong.
 */
function findArtifacts() {
  const found = [];

  for (const name of [...ARTIFACT_NAMES, ...EXTRA_ROOT_ARTIFACTS]) {
    const p = path.join(REPO_ROOT, name);
    if (exists(p)) found.push(p);
  }

  for (const parent of WORKSPACE_PARENTS) {
    const parentDir = path.join(REPO_ROOT, parent);
    if (!exists(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const name of ARTIFACT_NAMES) {
        const p = path.join(parentDir, entry.name, name);
        if (exists(p)) found.push(p);
      }
    }
  }

  return found.sort();
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const dryRun = asJson || argv.includes('--dry-run');

  const artifacts = findArtifacts();
  const relative = artifacts.map((p) => path.relative(REPO_ROOT, p));

  if (asJson) {
    process.stdout.write(JSON.stringify({ dryRun: true, artifacts: relative }) + '\n');
    return;
  }

  if (artifacts.length === 0) {
    console.log('clean: nothing to remove — the tree is already clean.');
    return;
  }

  for (const [i, target] of artifacts.entries()) {
    if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
    console.log(`  ${dryRun ? 'would remove' : 'removed'}  ${relative[i]}`);
  }

  console.log(
    `\nclean: ${dryRun ? 'would remove' : 'removed'} ${artifacts.length} artifact(s).` +
      (dryRun ? '' : '\nRun `npm run build` before any gate that resolves a package to its dist.'),
  );
}

main();
